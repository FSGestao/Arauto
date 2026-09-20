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
const fs = require("fs");
const crypto = require("crypto");
const next = require("next");
const { Server: SocketIOServer } = require("socket.io");
const { getSecret, getLocalIPs, dataDir } = require("./lib/shared");
const jwt = require("jsonwebtoken");

// Rede de segurança de último recurso: um erro que escape dos try/catch dos
// handlers (ex.: dentro de um timer) não pode derrubar o processo e travar
// a projeção pra todo mundo — melhor logar e continuar rodando.
process.on("uncaughtException", (e) => console.error("Erro não tratado:", e));
process.on("unhandledRejection", (e) => console.error("Promessa rejeitada sem tratamento:", e));

function verifyToken(token) {
  try {
    return jwt.verify(token, getSecret());
  } catch {
    return null;
  }
}

function emptyState() {
  return {
    mode: "idle", // "idle" | "lyrics" | "announcement" | "media" | "countdown" | "bible"
    song: null,
    lyricIndex: -1,
    isPlaying: false,
    startedAt: null,
    announcement: null,
    // Item de mídia (áudio/vídeo) no ar, quando mode === "media".
    media: null,
    // Versículo no ar, quando mode === "bible" — o painel já manda o
    // texto resolvido (ver admin:selectBibleVerse), o servidor só repassa.
    bible: null,
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
    countdownMediaSource: null,
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
  if (step.kind === "bible") {
    // Defensivo: um passo "bible" sem o versículo embutido (dado antigo, de
    // antes da correção que preservava esse campo ao salvar o roteiro) não
    // pode derrubar o servidor pra todo mundo conectado — melhor mostrar um
    // rótulo genérico do que travar a apresentação inteira.
    if (!step.bible) {
      return { kind: "bible", label: "(versículo)", sublabel: "", skip: !!step.skip };
    }
    return {
      kind: "bible",
      label: `${step.bible.book} ${step.bible.chapter}:${step.bible.verse}`,
      sublabel: step.bible.text,
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
  if (step.kind === "bible") {
    return { ...base, mode: "bible", bible: step.bible };
  }
  return { ...base, mode: "announcement", announcement: step.announcement };
}

async function createServer({ dev = false, port = 3210, host = "0.0.0.0", dir = process.cwd() } = {}) {
  // Código que lê arquivo com caminho relativo à raiz do app (seed da Bíblia,
  // notas de versão) usa `process.cwd()` — sem isto, dentro do Electron
  // empacotado o diretório de trabalho do processo nem sempre é a pasta do
  // app (pode ser de onde o atalho foi aberto), e essas leituras falhariam
  // silenciosamente só no instalador, nunca em desenvolvimento.
  process.chdir(dir);
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
  // Cronômetro (contagem crescente) só pra tela de Stage View — igual aos
  // acima, fica fora do liveState de propósito: ligar/desligar não deve
  // depender de nem interferir no que está sendo projetado publicamente
  // (o operador pode trocar de música/aviso com o cronômetro correndo).
  let stageTimer = null; // { startedAt, label } | null

  function broadcast() {
    io.emit("state:update", { ...liveState, volume, background, mediaPaused, stageTimer });
  }

  // Quantas telas de cada tipo estão conectadas agora — pra quem está
  // operando saber, ANTES do culto começar, se o projetor está mesmo
  // recebendo o sinal (em vez de descobrir só quando já está tarde).
  const connections = { admin: 0, projection: 0, stage: 0, remote: 0 };
  function broadcastConnections() {
    io.emit("connections:update", connections);
  }

  /* ─── Controle remoto (celular) ──────────────────────────
     Sessão própria, deliberadamente mais fraca que a de admin: um token de
     sessão remota NUNCA deve valer como login de admin, então ele carrega
     `role: "remote"` e é conferido à parte (ver isAdmin/isRemote abaixo).
     `remoteEpoch` é o interruptor geral — incrementar invalida TODOS os
     tokens remotos já emitidos na hora (usado por "Encerrar sessões"), sem
     precisar de uma lista de tokens revogados. */
  let remoteEpoch = 0;
  // Um único código de pareamento ativo por vez — gerar um novo substitui
  // (não acumula) o anterior. TTL curto: é pra parear no início do culto,
  // não uma porta permanentemente aberta.
  let pendingPairing = null; // { pin, token, expiresAt } | null
  const REMOTE_PAIRING_TTL_MS = 10 * 60 * 1000;
  const REMOTE_SESSION_TTL = "12h";

  function signRemoteToken() {
    return jwt.sign({ role: "remote", epoch: remoteEpoch }, getSecret(), { expiresIn: REMOTE_SESSION_TTL });
  }
  function isValidRemotePayload(payload) {
    return !!payload && payload.role === "remote" && payload.epoch === remoteEpoch;
  }

  /** Leitura direta de uma coleção (fora do ciclo de requisição do Next.js —
   * server.js é um processo Node simples, não importa as rotas da API).
   * Usado só pra montar o catálogo que o controle remoto recebe ao conectar. */
  function readCollectionSync(name) {
    try {
      const fp = path.join(dataDir(), `${name}.json`);
      const raw = fs.readFileSync(fp, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed.items) ? parsed.items : [];
    } catch {
      return [];
    }
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
    socket.emit("state:update", { ...liveState, volume, background, mediaPaused, stageTimer });
    socket.emit("connections:update", connections);

    const token = socket.handshake.auth && socket.handshake.auth.token;
    const payload = token ? verifyToken(token) : null;
    // Um token de sessão remota é válido (assinado com o mesmo segredo), mas
    // NUNCA vira admin — só o payload sem `role: "remote"` conta. Sem essa
    // exclusão, qualquer celular pareado herdaria login completo do painel.
    const isAdmin = !!payload && payload.role !== "remote";
    const isRemote = isValidRemotePayload(payload);

    // O tipo de tela (admin/projeção/palco/remoto) vem do próprio cliente na
    // conexão — só serve pra contar quem está conectado, não afeta permissão
    // (essa continua vindo exclusivamente do token acima). "remote-pending" é
    // a conexão transitória de um celular ainda digitando o PIN: não é
    // ninguém "conectado" de verdade ainda, então não entra na contagem.
    const declaredRole = socket.handshake.query.role;
    const role = ["admin", "projection", "stage", "remote"].includes(declaredRole)
      ? declaredRole
      : declaredRole === "remote-pending"
        ? "remote-pending"
        : "projection";
    socket.data.isRemote = isRemote;
    if (role !== "remote-pending") {
      connections[role]++;
      broadcastConnections();
    }
    socket.on("disconnect", () => {
      if (role !== "remote-pending") {
        connections[role]--;
        broadcastConnections();
      }
    });

    // Um celular que ACHA que está pareado (declarou role "remote") mas cujo
    // token não é mais válido — expirou, ou um "Encerrar sessões" mudou o
    // epoch — precisa descobrir isso na hora, não ficar com uma tela viva
    // que não manda mais nada pra lugar nenhum. state:update/connections:update
    // já foram mandados acima (inofensivo), mas nenhum handler é registrado:
    // a conexão é encerrada aqui mesmo, e o cliente trata isso como "peça
    // pareamento de novo".
    if (role === "remote" && !isRemote) {
      socket.disconnect(true);
      return;
    }

    // Catálogo que o controle remoto usa pras abas de Avisos/Mídia — lido do
    // disco na conexão (não fica guardado em memória o tempo todo: avisos e
    // mídia mudam raramente perto da frequência de conexão de um celular).
    if (isRemote) {
      socket.emit("remote:library", {
        announcements: readCollectionSync("announcements"),
        media: readCollectionSync("media-library"),
      });
    }

    function onlyAdmin(fn) {
      return (...args) => {
        if (!isAdmin) return;
        // Um erro inesperado aqui (ex.: dado antigo/corrompido vindo de um
        // roteiro salvo antes de alguma correção) não pode derrubar o
        // processo inteiro — isso travaria a projeção pra TODAS as telas
        // conectadas (admin, projeção, palco), não só pra quem clicou.
        try {
          fn(...args);
        } catch (e) {
          console.error("Erro tratando evento do painel:", e);
        }
      };
    }

    // Subconjunto de eventos que o controle remoto também pode disparar —
    // navegar o roteiro, mostrar um aviso/mídia já existente, exibir um
    // versículo. Nunca criar/editar/excluir nada, nunca configurações,
    // nunca backup — só "pôr no ar algo que já existe".
    function onlyRemoteAllowed(fn) {
      return (...args) => {
        if (!isAdmin && !isRemote) return;
        try {
          fn(...args);
        } catch (e) {
          console.error("Erro tratando evento do controle remoto:", e);
        }
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
      onlyRemoteAllowed((announcement) => {
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

    // Versículo avulso — mesma lógica de interjeição do aviso/música. O
    // painel já resolveu o texto (buscou na tradução escolhida), o
    // servidor só guarda e repassa, igual a admin:showAnnouncement.
    socket.on(
      "admin:selectBibleVerse",
      onlyRemoteAllowed((bible) => {
        if (!bible || typeof bible.text !== "string") return;
        liveState = {
          ...emptyState(),
          mode: "bible",
          bible,
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
      onlyRemoteAllowed((media) => {
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

    // Cronômetro de palco: só a tela de Stage View mostra (ver stage/page.tsx)
    // — não muda `mode` nem passa por emptyState(), então liga/desliga sem
    // afetar o que está no telão público.
    socket.on(
      "admin:startStageTimer",
      onlyAdmin((label) => {
        stageTimer = { startedAt: Date.now(), label: typeof label === "string" ? label : "" };
        broadcast();
      })
    );
    socket.on(
      "admin:stopStageTimer",
      onlyAdmin(() => {
        stageTimer = null;
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
      onlyAdmin(({ seconds, title, mediaFile, mediaKind, mediaSource }) => {
        if (typeof seconds !== "number" || !(seconds > 0)) return;
        liveState = {
          ...emptyState(),
          mode: "countdown",
          countdownEndsAt: Date.now() + seconds * 1000,
          countdownTitle: typeof title === "string" ? title : "",
          countdownMediaFile: typeof mediaFile === "string" && mediaFile ? mediaFile : null,
          countdownMediaKind: mediaKind === "image" || mediaKind === "video" ? mediaKind : null,
          countdownMediaSource: mediaSource === "youtube" ? "youtube" : "upload",
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

    // Pula direto para um passo específico (clique num card da lista lateral,
    // ou toque num passo no controle remoto)
    socket.on(
      "admin:goToStep",
      onlyRemoteAllowed((index) => {
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
    socket.on("roteiro:next", () => { try { advance(1); } catch (e) { console.error("Erro ao avançar roteiro:", e); } });
    socket.on("roteiro:prev", () => { try { advance(-1); } catch (e) { console.error("Erro ao voltar roteiro:", e); } });

    // Arrastar um card do roteiro pra outra posição (kanban).
    socket.on(
      "admin:reorderSteps",
      onlyAdmin(({ from, to }) => {
        reorderSteps(from, to);
      })
    );

    // "Adicionar ao Roteiro" na biblioteca, quando esse culto já está em
    // apresentação: só acrescenta um passo no fim (o painel já manda o
    // passo pronto, igual ao admin:startService) — não toca na posição
    // atual nem no que está no ar, diferente de reconstruir tudo de novo.
    socket.on(
      "admin:appendStep",
      onlyAdmin((step) => {
        if (!activeService || !step || !step.kind) return;
        activeService.steps.push(step);
        const { steps } = activeService;
        let n = activeService.stepIndex + 1;
        while (n < steps.length && steps[n].skip) n++;
        liveState = {
          ...liveState,
          service: serviceInfoOf(activeService),
          nextMedia: mediaFileOfStep(steps[n]),
        };
        broadcast();
      })
    );

    // ─── Pareamento do controle remoto ────────────────────
    // Gerado pelo painel (admin), consumido pelo celular. PIN pra digitar de
    // cabeça, token pra ir embutido no link do QR — as duas portas pro mesmo
    // código, com o mesmo prazo de validade.
    socket.on(
      "admin:remoteCreatePairing",
      onlyAdmin((_payload, callback) => {
        const pin = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
        const token = crypto.randomBytes(20).toString("hex");
        const expiresAt = Date.now() + REMOTE_PAIRING_TTL_MS;
        pendingPairing = { pin, token, expiresAt };
        const ips = getLocalIPs();
        const urls = ips.map((ip) => `http://${ip}:${port}/remote?t=${token}`);
        if (typeof callback === "function") callback({ pin, token, urls, expiresAt });
      })
    );

    // Derruba toda sessão remota já emitida (troca a "chave" de validação) e
    // desconecta na hora quem já estava pareado — não é só parar de aceitar
    // tokens novos, é encerrar as conexões abertas agora mesmo.
    socket.on(
      "admin:remoteRevokeAll",
      onlyAdmin(() => {
        remoteEpoch++;
        pendingPairing = null;
        for (const [, s] of io.of("/").sockets) {
          if (s.data.isRemote) s.disconnect(true);
        }
        connections.remote = 0;
        broadcastConnections();
      })
    );

    // Troca PIN/token por uma sessão de verdade. Roda numa conexão ainda sem
    // login nenhum (role "remote-pending") — por isso não passa por
    // onlyAdmin/onlyRemoteAllowed: a validação aqui É o próprio PIN.
    // Limite de tentativas por conexão evita um script tentando adivinhar
    // os 6 dígitos.
    let redeemAttempts = 0;
    socket.on("remote:redeem", (data, callback) => {
      const reply = typeof callback === "function" ? callback : () => {};
      if (redeemAttempts++ >= 8) {
        socket.disconnect(true);
        return;
      }
      if (!pendingPairing || Date.now() > pendingPairing.expiresAt) {
        reply({ ok: false, error: "Nenhum código ativo — gere um novo no computador." });
        return;
      }
      const pin = data && typeof data.pin === "string" ? data.pin.trim() : "";
      const tok = data && typeof data.token === "string" ? data.token : "";
      const matches = (tok && tok === pendingPairing.token) || (pin && pin === pendingPairing.pin);
      if (!matches) {
        reply({ ok: false, error: "Código incorreto." });
        return;
      }
      reply({ ok: true, sessionToken: signRemoteToken() });
    });
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
