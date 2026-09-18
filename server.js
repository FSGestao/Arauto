/**
 * Servidor customizado (Next.js + Socket.IO) — usado tanto em desenvolvimento
 * quanto dentro do Electron. Mantém o estado da projeção em memória (um único
 * processo local) e transmite atualizações em tempo real para:
 *   - a janela/página de Admin (envia eventos "admin:*")
 *   - a(s) janela/página(s) de Projeção (só recebe "state:update")
 *
 * O servidor escuta em 0.0.0.0, então a tela de projeção também pode ser
 * aberta em outro computador da mesma rede local (ex.: http://<ip>:PORTA/projection).
 */
const path = require("path");
const http = require("http");
const next = require("next");
const { Server: SocketIOServer } = require("socket.io");
const { getSecret, getLocalIPs } = require("./lib/shared");
const jwt = require("jsonwebtoken");

function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

function emptyState() {
  return {
    mode: "idle", // "idle" | "lyrics" | "announcement" | "media" | "countdown"
    song: null,
    lyricIndex: -1,
    isPlaying: false,
    startedAt: null,
    announcement: null,
    // Item de mídia (áudio/vídeo) no ar, quando mode === "media".
    media: null,
    // Arquivo de mídia do próximo passo visível do roteiro — a tela de
    // projeção usa isso pra pré-carregar e trocar sem engasgo.
    nextMedia: null,
    // Contagem regressiva, quando mode === "countdown". `countdownEndsAt` é
    // um timestamp absoluto (Date.now() + duração) — cada tela calcula o
    // "quanto falta" sozinha a partir dele, em vez de o servidor precisar
    // ficar mandando atualização a cada segundo.
    countdownEndsAt: null,
    countdownTitle: null,
    // Imagem/vídeo opcional que acompanha a contagem (ex.: um cartaz do
    // evento) — o arquivo já enviado em Mídia, aqui só o nome + o tipo.
    countdownMediaFile: null,
    countdownMediaKind: null,
    // Presente quando um Culto (roteiro) está em apresentação; usado pela
    // tela de projeção e pelo painel pra mostrar "passo X de Y" e permitir
    // avançar/voltar globalmente (teclado/clique) além dos controles ad-hoc.
    service: null,
    // true quando o que está no ar é um item avulso (aviso/música/texto
    // inserido na hora) enquanto um roteiro continua pausado por baixo —
    // ver admin:selectSong / admin:showAnnouncement / admin:resumeService.
    interjecting: false,
  };
}

/** Resumo do roteiro em apresentação, pra anexar ao liveState mesmo quando
 * o que está sendo exibido no momento é um item avulso (interjeição). */
function serviceInfoOf(activeService) {
  if (!activeService) return null;
  return {
    id: activeService.id,
    title: activeService.title,
    stepIndex: activeService.stepIndex,
    totalSteps: activeService.steps.length,
    steps: activeService.steps.map(summarizeStep),
  };
}

/** Resumo leve de um passo, pra lista lateral no painel (não manda a música/aviso inteiro).
 * Cada passo é um EVENTO do roteiro (uma música inteira, ou um aviso) — não uma
 * linha de letra — porque é isso que faz sentido mover de posição num card kanban. */
function summarizeStep(step) {
  if (step.kind === "lyrics") {
    const total = step.song.lyrics.length;
    return {
      kind: "lyrics",
      label: step.song.title,
      sublabel: step.song.artist || (total > 0 ? `${total} ${total === 1 ? "linha" : "linhas"}` : "sem letra cadastrada"),
      skip: !!step.skip,
    };
  }
  if (step.kind === "media") {
    return {
      kind: "media",
      label: step.media.title,
      sublabel: step.media.kind === "audio" ? "Áudio" : "Vídeo",
      skip: !!step.skip,
    };
  }
  return {
    kind: "announcement",
    label: step.announcement.title,
    sublabel: step.announcement.mediaType !== "none" ? "Imagem/vídeo" : step.announcement.content,
    skip: !!step.skip,
  };
}

/** Arquivo de mídia que um passo vai reproduzir, se houver (pra pré-carregar). */
function mediaFileOfStep(step) {
  if (!step) return null;
  if (step.kind === "media") return step.media.file;
  if (step.kind === "announcement" && step.announcement.mediaType === "video") {
    return step.announcement.mediaFile;
  }
  return null;
}

/** Converte o passo atual de um roteiro em apresentação para o formato de liveState. */
function stepToLiveState(activeService) {
  const step = activeService.steps[activeService.stepIndex];
  const serviceInfo = serviceInfoOf(activeService);
  if (!step) return { ...emptyState(), service: serviceInfo };

  // Próximo passo visível — só pra saber o que pré-carregar.
  const { steps } = activeService;
  let n = activeService.stepIndex + 1;
  while (n < steps.length && steps[n].skip) n++;
  const nextMedia = mediaFileOfStep(steps[n]);

  const base = { ...emptyState(), service: serviceInfo, nextMedia };

  if (step.kind === "lyrics") {
    return { ...base, mode: "lyrics", song: step.song, lyricIndex: step.lineIndex };
  }
  if (step.kind === "media") {
    return { ...base, mode: "media", media: step.media, isPlaying: true };
  }
  return { ...base, mode: "announcement", announcement: step.announcement };
}

async function createServer({ dev = false, port = 3210, host = "0.0.0.0", dir = process.cwd() } = {}) {
  const app = next({ dev, dir });
  const handle = app.getRequestHandler();
  await app.prepare();

  // Não usar apenas process.env.PORT aqui: no build de produção, o Next
  // substitui `process.env.PORT` pelo valor que existia em .env no momento
  // do `next build` (inlining estático), então uma porta escolhida em tempo
  // de execução (ex.: pelo Electron) nunca apareceria nas rotas de API.
  // globalThis é uma referência real em runtime e não sofre esse inlining.
  process.env.PORT = String(port);
  globalThis.__PROJECAO_PORT__ = port;

  const server = http.createServer((req, res) => handle(req, res));
  const io = new SocketIOServer(server, { path: "/socket.io" });

  let liveState = emptyState();
  // Culto (roteiro) em apresentação, se houver: { id, title, steps, stepIndex }
  let activeService = null;

  // Ajustes que valem pra sessão inteira, não pra um passo específico —
  // por isso ficam fora do liveState (que é remontado a cada troca de passo)
  // e são mesclados na hora de transmitir.
  let volume = 1; // 0..1 — volume de áudio/vídeo na tela de projeção
  let background = null; // arquivo de vídeo tocando ATRÁS da letra/aviso
  let mediaPaused = false; // pausa manual do item de mídia no ar

  function broadcast() {
    io.emit("state:update", { ...liveState, volume, background, mediaPaused });
  }

  // Quantas telas de cada tipo estão conectadas agora — pra quem está
  // operando saber, ANTES do culto começar, se o projetor está mesmo
  // recebendo o sinal (em vez de descobrir só quando já está tarde).
  const connections = { admin: 0, projection: 0, stage: 0 };
  function broadcastConnections() {
    io.emit("connections:update", connections);
  }

  // Pula direto para um passo específico (ex.: clique num card do roteiro)
  // — funciona mesmo que o passo esteja marcado como "excluído" (skip).
  // Sempre entra na música pela primeira linha (é um novo "evento" começando).
  // Entra num passo: além de montar o estado, tira qualquer pausa manual —
  // um item novo sempre começa tocando.
  function enterStep() {
    mediaPaused = false;
    liveState = stepToLiveState(activeService);
    broadcast();
  }

  function goToStep(index) {
    if (!activeService || !activeService.steps[index]) return;
    const step = activeService.steps[index];
    if (step.kind === "lyrics" && step.song.lyrics.length > 0) step.lineIndex = 0;
    activeService.stepIndex = index;
    enterStep();
  }

  // Avança/volta em dois níveis: primeiro tenta mover a linha de letra DENTRO
  // da música atual (o card do roteiro é a música inteira, não cada linha);
  // só quando chega no início/fim da letra é que passa pro evento visível
  // (não marcado como excluído) anterior/seguinte — entrando nele pela
  // primeira linha (avançando) ou pela última (voltando), como um slide.
  function advance(dir) {
    if (!activeService) return;
    const { steps } = activeService;
    const current = steps[activeService.stepIndex];
    if (current && current.kind === "lyrics" && current.song.lyrics.length > 0) {
      const nextLine = current.lineIndex + dir;
      if (nextLine >= 0 && nextLine < current.song.lyrics.length) {
        current.lineIndex = nextLine;
        liveState = stepToLiveState(activeService);
        broadcast();
        return;
      }
    }
    let i = activeService.stepIndex + dir;
    while (i >= 0 && i < steps.length && steps[i].skip) i += dir;
    if (i < 0 || i >= steps.length) return;
    const target = steps[i];
    if (target.kind === "lyrics" && target.song.lyrics.length > 0) {
      target.lineIndex = dir > 0 ? 0 : target.song.lyrics.length - 1;
    }
    activeService.stepIndex = i;
    enterStep();
  }

  // Reordena os cards do roteiro (arrastar-e-soltar no painel) — só muda a
  // ordem desta apresentação em memória, não o culto salvo. Mantém o mesmo
  // passo "no ar" mesmo que ele mude de posição na lista.
  function reorderSteps(from, to) {
    if (!activeService) return;
    const { steps } = activeService;
    if (from < 0 || from >= steps.length || to < 0 || to >= steps.length || from === to) return;
    const current = steps[activeService.stepIndex];
    const [moved] = steps.splice(from, 1);
    steps.splice(to, 0, moved);
    activeService.stepIndex = steps.indexOf(current);
    liveState = stepToLiveState(activeService);
    broadcast();
  }

  io.on("connection", (socket) => {
    // Sempre que alguém conecta (admin ou projeção), envia o estado atual —
    // inclusive numa reconexão depois de queda de rede, que é o caso em que
    // a tela não pode ficar congelada mostrando o passo antigo.
    socket.emit("state:update", { ...liveState, volume, background, mediaPaused });
    socket.emit("connections:update", connections);

    const token = socket.handshake.auth && socket.handshake.auth.token;
    const payload = token ? verifyToken(token) : null;
    const isAdmin = !!payload;

    // O tipo de tela (admin/projection/stage) vem do próprio cliente na
    // conexão — só serve pra contar quem está conectado, não afeta permissão
    // (essa continua vindo exclusivamente do token acima).
    const role = ["admin", "projection", "stage"].includes(socket.handshake.query.role)
      ? socket.handshake.query.role
      : "projection";
    connections[role]++;
    broadcastConnections();
    socket.on("disconnect", () => {
      connections[role]--;
      broadcastConnections();
    });

    function onlyAdmin(fn) {
      return (...args) => {
        if (!isAdmin) return;
        fn(...args);
      };
    }

    socket.on(
      "admin:selectSong",
      onlyAdmin((song) => {
        // Inserção avulsa: se houver um roteiro em apresentação, ele fica
        // pausado (guardado em activeService) em vez de ser descartado —
        // dá pra "furar a fila" com uma música e depois voltar de onde parou.
        liveState = {
          ...emptyState(),
          mode: "lyrics",
          song,
          lyricIndex: song && song.lyrics && song.lyrics.length ? 0 : -1,
          service: serviceInfoOf(activeService),
          interjecting: !!activeService,
        };
        broadcast();
      })
    );

    socket.on(
      "admin:play",
      onlyAdmin(() => {
        if (!liveState.song) return;
        const offset =
          liveState.lyricIndex >= 0 ? liveState.song.lyrics[liveState.lyricIndex].startMs : 0;
        liveState = { ...liveState, mode: "lyrics", isPlaying: true, startedAt: Date.now() - offset };
        broadcast();
      })
    );

    socket.on(
      "admin:pause",
      onlyAdmin(() => {
        liveState = { ...liveState, isPlaying: false };
        broadcast();
      })
    );

    socket.on(
      "admin:goToLine",
      onlyAdmin((index) => {
        if (!liveState.song || !liveState.song.lyrics[index]) return;
        const startedAt = liveState.isPlaying
          ? Date.now() - liveState.song.lyrics[index].startMs
          : liveState.startedAt;
        liveState = { ...liveState, mode: "lyrics", lyricIndex: index, startedAt };
        broadcast();
      })
    );

    // Corrige o texto da linha que está no ar AGORA MESMO, sem sair da
    // apresentação — a igreja já está olhando a tela errada, então a correção
    // precisa aparecer imediatamente, não só depois de avançar/voltar.
    // A gravação permanente na biblioteca é feita à parte pelo painel
    // (PATCH /api/songs/:id/lyrics), este evento só atualiza o que está ao vivo.
    socket.on(
      "admin:editCurrentLine",
      onlyAdmin((text) => {
        if (typeof text !== "string" || liveState.mode !== "lyrics" || !liveState.song) return;
        if (liveState.lyricIndex < 0 || !liveState.song.lyrics[liveState.lyricIndex]) return;

        // Muta a cópia da música em memória — tanto a que está solta em
        // liveState.song quanto, se for o caso, a que vive dentro do passo
        // ativo do roteiro (senão a correção "voltaria" ao trocar de passo
        // e retornar pra essa música mais tarde na mesma apresentação).
        liveState.song.lyrics[liveState.lyricIndex].text = text;
        if (activeService) {
          const step = activeService.steps[activeService.stepIndex];
          if (step && step.kind === "lyrics" && step.song.lyrics[liveState.lyricIndex]) {
            step.song.lyrics[liveState.lyricIndex].text = text;
          }
        }
        broadcast();
      })
    );

    socket.on(
      "admin:showAnnouncement",
      onlyAdmin((announcement) => {
        // Mesma lógica do admin:selectSong: um aviso avulso (existente, novo
        // ou um texto digitado na hora, ex. um trecho bíblico) pode ser
        // exibido sem perder o lugar no roteiro em apresentação.
        liveState = {
          ...emptyState(),
          mode: "announcement",
          announcement,
          service: serviceInfoOf(activeService),
          interjecting: !!activeService,
        };
        broadcast();
      })
    );

    // Mídia avulsa (áudio/vídeo da biblioteca) — mesma lógica de interjeição
    // do aviso/música: o roteiro continua pausado por baixo.
    socket.on(
      "admin:showMedia",
      onlyAdmin((media) => {
        if (!media || !media.file) return;
        mediaPaused = false;
        liveState = {
          ...emptyState(),
          mode: "media",
          media,
          isPlaying: true,
          service: serviceInfoOf(activeService),
          interjecting: !!activeService,
        };
        broadcast();
      })
    );

    // Play/pause do item de mídia no ar.
    socket.on(
      "admin:mediaToggle",
      onlyAdmin(() => {
        if (liveState.mode !== "media") return;
        mediaPaused = !mediaPaused;
        broadcast();
      })
    );

    // Busca de posição (arrastar a barra de progresso). Não entra no
    // liveState: é uma ordem pontual pra quem está reproduzindo.
    socket.on(
      "admin:mediaSeek",
      onlyAdmin((seconds) => {
        if (typeof seconds !== "number" || Number.isNaN(seconds)) return;
        io.emit("media:seek", seconds);
      })
    );

    // Volume global da projeção (0..1).
    socket.on(
      "admin:setVolume",
      onlyAdmin((value) => {
        if (typeof value !== "number" || Number.isNaN(value)) return;
        volume = Math.min(1, Math.max(0, value));
        broadcast();
      })
    );

    // Vídeo de fundo, que fica ATRÁS da letra/aviso e continua tocando
    // enquanto os passos mudam. `null` desliga.
    socket.on(
      "admin:setBackground",
      onlyAdmin((file) => {
        background = typeof file === "string" && file ? file : null;
        broadcast();
      })
    );

    // A tela de projeção informa o progresso do que está tocando; o servidor
    // só repassa (não guarda no liveState, pra não disparar re-render geral
    // a cada meio segundo).
    socket.on("media:progress", (payload) => {
      if (!payload || typeof payload !== "object") return;
      socket.broadcast.emit("media:progress", payload);
    });

    // Contagem regressiva — pode rodar com ou sem um roteiro em apresentação
    // (útil até antes do culto começar, tipo "entra em 5 minutos"). Mesma
    // lógica de interjeição: se houver um roteiro ativo, ele fica pausado.
    socket.on(
      "admin:startCountdown",
      onlyAdmin(({ seconds, title, mediaFile, mediaKind }) => {
        if (typeof seconds !== "number" || !(seconds > 0)) return;
        liveState = {
          ...emptyState(),
          mode: "countdown",
          countdownEndsAt: Date.now() + seconds * 1000,
          countdownTitle: typeof title === "string" ? title : "",
          countdownMediaFile: typeof mediaFile === "string" && mediaFile ? mediaFile : null,
          countdownMediaKind: mediaKind === "image" || mediaKind === "video" ? mediaKind : null,
          service: serviceInfoOf(activeService),
          interjecting: !!activeService,
        };
        broadcast();
      })
    );

    // Encerra a contagem: volta pro roteiro pausado, se houver, ou limpa a
    // tela. Não precisa de confirmação — não é destrutivo, só some do ar.
    socket.on(
      "admin:stopCountdown",
      onlyAdmin(() => {
        if (liveState.mode !== "countdown") return;
        if (activeService) enterStep();
        else {
          liveState = emptyState();
          broadcast();
        }
      })
    );

    // O operador mexeu na identidade visual (cores, nome, logo). As telas já
    // abertas carregaram essas configurações uma vez só, na abertura — sem
    // este aviso, o projetor continuaria com as cores antigas até alguém
    // recarregar a página, o que ninguém faz no meio do culto.
    socket.on(
      "admin:settingsChanged",
      onlyAdmin(() => {
        io.emit("settings:update");
      })
    );

    // Volta a exibir o passo atual do roteiro pausado, encerrando a
    // interjeição (ex.: depois de mostrar um aviso avulso no meio do culto).
    socket.on(
      "admin:resumeService",
      onlyAdmin(() => {
        if (!activeService) return;
        enterStep();
      })
    );

    socket.on(
      "admin:stop",
      onlyAdmin(() => {
        activeService = null;
        background = null; // "limpar tela" limpa também o vídeo de fundo
        mediaPaused = false;
        liveState = emptyState();
        broadcast();
      })
    );

    // Inicia a apresentação de um Culto (roteiro): o painel Admin já manda
    // os "steps" prontos (músicas/avisos já resolvidos), então o servidor só
    // guarda a sequência e a posição atual em memória.
    socket.on(
      "admin:startService",
      onlyAdmin(({ id, title, steps }) => {
        if (!Array.isArray(steps) || steps.length === 0) return;
        activeService = { id, title, steps, stepIndex: 0 };
        enterStep();
      })
    );

    // Pula direto para um passo específico (clique num card da lista lateral)
    socket.on(
      "admin:goToStep",
      onlyAdmin((index) => {
        goToStep(index);
      })
    );

    // Marca/desmarca um passo como "excluído" desta apresentação (sem alterar
    // o roteiro salvo). Se o passo atual for excluído, avança automaticamente.
    socket.on(
      "admin:toggleStepSkip",
      onlyAdmin((index) => {
        if (!activeService || !activeService.steps[index]) return;
        activeService.steps[index].skip = !activeService.steps[index].skip;
        if (index === activeService.stepIndex && activeService.steps[index].skip) {
          advance(1);
        } else {
          liveState = stepToLiveState(activeService);
          broadcast();
        }
      })
    );

    // Avançar/voltar no roteiro em apresentação — disponível para QUALQUER
    // conexão (inclusive a tela de projeção sem login), pois é só um "próximo
    // slide" enquanto uma apresentação já foi iniciada por um admin; escolher
    // qual roteiro toca continua exigindo login (admin:startService acima).
    socket.on("roteiro:next", () => advance(1));
    socket.on("roteiro:prev", () => advance(-1));

    // Arrastar um card do roteiro pra outra posição (kanban).
    socket.on(
      "admin:reorderSteps",
      onlyAdmin(({ from, to }) => {
        reorderSteps(from, to);
      })
    );
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, host, () => {
      const lanIps = getLocalIPs();
      resolve({
        server,
        io,
        port,
        urls: {
          local: `http://localhost:${port}`,
          lan: lanIps.map((ip) => `http://${ip}:${port}`),
        },
      });
    });
  });
}

module.exports = { createServer };

// Permite rodar `node server.js` diretamente (fora do Electron) para testes.
if (require.main === module) {
  const dev = process.env.NODE_ENV !== "production";
  const port = parseInt(process.env.PORT || "3210", 10);
  createServer({ dev, port, dir: path.join(__dirname) })
    .then(({ urls }) => {
      console.log(`> Painel disponível em ${urls.local}`);
      urls.lan.forEach((u) => console.log(`> Rede local: ${u}/projection`));
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
