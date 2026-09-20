/* Gera os GIFs "onde fica X" do manual — cada um começa na tela inicial do
   painel (recém-carregada, sem filtro/modal algum), aponta um círculo roxo
   pro caminho até a função e termina apontando pra ação principal daquele
   lugar. `node scripts/gerar-gifs-manual.js [id...]` gera só os IDs pedidos;
   sem argumento, gera todos. Salva em public/tutoriais/<id>.gif.

   Não precisa de servidor rodando nem de conta criada: o script sobe o seu
   próprio servidor, numa porta separada, apontando pra um DATA_DIR temporário
   com o conjunto de demonstração (scripts/lib/demo-data.js). A pasta data/
   real é usada só pra copiar os arquivos de Bíblia, em modo leitura. */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { openPage, sleep, get } = require("./lib/cdp");
const { buildGif } = require("./lib/gif");
const { semearDemo } = require("./lib/demo-data");

const RAIZ = path.join(__dirname, "..");
const PORTA = Number(process.env.GIF_PORT || 3311);
const BASE = `http://localhost:${PORTA}`;
const OUT_DIR = path.join(RAIZ, "public", "tutoriais");
const SEGREDO = "gifs-de-demonstracao-nao-usado-em-producao";
const HASH_DEMO = "$2a$10$rb8UG2AMx0E2neHbs6BzZOFwItxN2YZd8nX/KolLeAOQbsS.h6eXy"; // "demo1234"

/* Janela do navegador e recorte padrão. TODO GIF sai exatamente com este
   tamanho: no manual eles aparecem empilhados um embaixo do outro, e recorte
   "sob medida" pra cada função fazia cada tutorial ter uma proporção
   diferente (de 118x160 a 908x160), o que deixava a página desalinhada. */
const JANELA = { w: 1600, h: 900 };
const QUADRO = { width: 1160, height: 520 };
/** Onde a área de conteúdo do painel começa — o quadro encosta aqui sempre
 *  que couber, em vez de centralizar, pra não cortar um painel no meio. */
const BORDA = { x: 12, y: 0 };

function acharNavegador() {
  return [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean).find((c) => fs.existsSync(c));
}

function tokenDoDono() {
  const jwt = require("jsonwebtoken");
  return jwt.sign(
    { userId: 1, email: "demo@arauto.local", role: "ADMIN" },
    SEGREDO,
    { expiresIn: "30m" }
  );
}

/** Sobe o servidor de demonstração e espera ele responder. */
async function subirServidorDemo(dataDir) {
  const proc = spawn(process.execPath, ["server.js"], {
    cwd: RAIZ,
    stdio: "ignore",
    env: { ...process.env, NODE_ENV: "production", PORT: String(PORTA), DATA_DIR: dataDir, JWT_SECRET: SEGREDO },
  });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      const r = await new Promise((resolve, reject) => {
        require("http").get(`${BASE}/api/version`, (res) => { res.resume(); resolve(res.statusCode); }).on("error", reject);
      });
      if (r && r < 500) return proc;
    } catch {}
  }
  try { proc.kill(); } catch {}
  throw new Error("servidor de demonstração não respondeu");
}

async function apontarPara(page, seletor) {
  await page.ev(`
    const el = document.querySelector(${JSON.stringify(seletor)});
    if (!el) return;
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let ring = document.getElementById("__tutorial-cursor");
    if (!ring) {
      ring = document.createElement("div");
      ring.id = "__tutorial-cursor";
      Object.assign(ring.style, {
        position: "fixed", zIndex: "999999", pointerEvents: "none",
        border: "3px solid #8B5CF6", borderRadius: "999px",
        boxShadow: "0 0 0 7px rgba(139,92,246,0.28), 0 0 22px rgba(139,92,246,0.65)",
        transition: "none",
      });
      document.body.appendChild(ring);
    }
    const w = Math.max(r.width + 18, 46), h = Math.max(r.height + 18, 46);
    ring.style.width = w + "px";
    ring.style.height = h + "px";
    ring.style.left = (cx - w / 2) + "px";
    ring.style.top = (cy - h / 2) + "px";
  `);
}
async function removerApontador(page) {
  await page.ev(`document.getElementById("__tutorial-cursor")?.remove();`);
}
async function clicar(page, seletor) {
  await page.ev(`document.querySelector(${JSON.stringify(seletor)})?.click();`);
}

/** Fecha na marra qualquer modal que abra sozinho ao carregar: clicar no
 *  overlay dispara o onClose, igual a clicar fora do popup. Em loop porque
 *  pode haver mais de um encadeado. */
async function fecharModais(page) {
  for (let i = 0; i < 4; i++) {
    const tinhaModal = await page.ev(`
      const overlay = document.querySelector(".modal-overlay");
      if (overlay) { overlay.click(); return true; }
      return false;
    `);
    if (!tinhaModal) break;
    await sleep(400);
  }
}

async function abrirPaginaFresca(token) {
  const page = await openPage(`${BASE}/dashboard`, token);
  await sleep(2500); // carregamento inicial completo (settings, songs, etc.)
  await fecharModais(page);
  return page;
}

/** Mede o retângulo de um elemento na tela (ou null se ele ainda não existe
 *  — alguns waypoints só aparecem DEPOIS de um clique anterior). */
async function medir(page, seletor) {
  return page.ev(`
    const el = document.querySelector(${JSON.stringify(seletor)});
    if (!el) return null;
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null; // fora da tela/oculto
    return { x: r.left, y: r.top, width: r.width, height: r.height };
  `);
}

/**
 * Posiciona o QUADRO padrão (tamanho fixo) de forma a conter os waypoints.
 * O tamanho nunca muda — é isso que dá o alinhamento dos tutoriais no manual.
 *
 * A regra de posição é: encostar na borda do conteúdo sempre que os waypoints
 * couberem a partir dali, e só centralizar neles quando não couberem. Isso
 * evita o efeito de "recorte flutuando no meio da tela", que cortava o painel
 * da biblioteca e o do roteiro pela metade em quase todos os tutoriais.
 */
function enquadrar(rects, viewport, centralizar = false) {
  const maxX = Math.max(...rects.map((r) => r.x + r.width));
  const maxY = Math.max(...rects.map((r) => r.y + r.height));
  const cx = (Math.min(...rects.map((r) => r.x)) + maxX) / 2;
  const cy = (Math.min(...rects.map((r) => r.y)) + maxY) / 2;
  /** Encosta na borda se tudo couber a partir dela; senão centraliza no
   *  conjunto de waypoints, sem sair da viewport. */
  const eixo = (borda, fim, centro, tamanho, tela) => {
    if (!centralizar && fim <= borda + tamanho) return borda;
    return Math.max(0, Math.min(Math.round(centro - tamanho / 2), Math.max(0, tela - tamanho)));
  };
  // No modo "foco" (um bloco inteiro, tipicamente o modal de Configurações)
  // o quadro centraliza na horizontal mas encosta no TOPO do bloco: o modal é
  // mais alto que o quadro, e centralizar na vertical corta justamente o
  // cabeçalho, que é o que identifica onde a pessoa está.
  const topoFoco = Math.min(...rects.map((r) => r.y)) - 24;
  return {
    x: eixo(BORDA.x, maxX, cx, QUADRO.width, viewport.w),
    y: centralizar
      ? Math.max(0, Math.min(Math.round(topoFoco), Math.max(0, viewport.h - QUADRO.height)))
      : eixo(BORDA.y, maxY, cy, QUADRO.height, viewport.h),
    width: QUADRO.width,
    height: QUADRO.height,
  };
}

/**
 * Roda uma sequência de waypoints e monta o GIF. Cada waypoint:
 * { seletor, clicar?: bool, esperaMs?: number, apontar?: bool (default true) }.
 *
 * `preClicks` (opcional): seletores clicados ANTES de tudo, em silêncio —
 * nem medidos, nem fotografados. Existe pra casos como "abrir Configurações"
 * antes de mostrar uma aba: a engrenagem fica no canto da barra e o conteúdo
 * do modal no centro da tela; começar a sequência já com o modal aberto
 * mantém o enquadramento no que interessa.
 *
 * Faz DUAS passadas, cada uma numa página recém-aberta (nunca reaproveita a
 * mesma página entre elas): a 1ª só mede onde cada waypoint cai na tela, pra
 * posicionar o quadro. A 2ª passada, com o recorte já calculado, é a que vira
 * de fato os frames — "sempre partindo da tela inicial" vale pras duas.
 */
async function gerarSequencia(token, waypoints, outFile, opcoes = {}) {
  const { preClicks = [], foco = null, prepararJs = null } = opcoes;
  const preparar = async (page) => {
    for (const sel of preClicks) {
      await clicar(page, sel);
      await sleep(500);
    }
    if (prepararJs) {
      await page.ev(prepararJs);
      await sleep(150);
    }
  };

  const medindo = await abrirPaginaFresca(token);
  await preparar(medindo);
  const rects = [];
  for (const wp of waypoints) {
    const r = await medir(medindo, wp.seletor);
    if (r) rects.push(r);
    if (wp.clicar) {
      await clicar(medindo, wp.seletor);
      await sleep(wp.esperaMs || 500);
      const r2 = await medir(medindo, wp.seletor);
      if (r2) rects.push(r2);
    }
  }
  if (rects.length === 0) throw new Error(`nenhum waypoint encontrado: ${outFile}`);
  // `foco` sobrepõe os waypoints no cálculo do enquadramento: usado quando o
  // que precisa estar bem centralizado é um bloco inteiro (o modal de
  // Configurações), não só os pontinhos que o anel visita dentro dele.
  const alvo = foco ? [await medir(medindo, foco)].filter(Boolean) : rects;
  const viewport = await medindo.ev(`return { w: window.innerWidth, h: window.innerHeight };`);
  medindo.close();
  const clip = enquadrar(alvo.length ? alvo : rects, viewport, !!foco);

  const page = await abrirPaginaFresca(token);
  await preparar(page);
  const frames = [];
  await removerApontador(page);
  frames.push(await page.screenshot(clip)); // estado inicial da sequência, limpo

  for (const wp of waypoints) {
    if (wp.apontar !== false) {
      await apontarPara(page, wp.seletor);
      frames.push(await page.screenshot(clip));
    }
    if (wp.clicar) {
      await removerApontador(page);
      await clicar(page, wp.seletor);
      await sleep(wp.esperaMs || 500);
      // Quadro limpo logo depois do clique: sem ele, a tela já mudou (outra
      // aba, outro botão de ação) ao mesmo tempo em que o anel pula pro
      // próximo alvo, e quem assiste não percebe o que o clique fez.
      frames.push(await page.screenshot(clip));
    }
  }
  await removerApontador(page);
  frames.push(await page.screenshot(clip)); // estado final, limpo
  page.close();

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { frames: n } = buildGif(frames, outFile, { delayCs: 105, holdLastCs: 280 });
  const kb = Math.round(fs.statSync(outFile).size / 1024);
  console.log(`  → ${path.basename(outFile)} (${n} quadros, ${clip.width}x${clip.height}, ${kb} KB)`);
}

const ABRIR_CONFIG = '.toolbar-icon-btn[title="Configurações"]';

/* A aba "Telas" mostra o IP real da máquina e a porta em que o servidor está
   rodando — aqui, a porta do servidor de demonstração (3311), que não é a que
   o usuário vai ver. Troca por um endereço de exemplo antes de fotografar:
   o tutorial mostra o formato do endereço, não o endereço deste computador. */
const MASCARAR_ENDERECOS = `
  const RE = /https?:\\/\\/[\\d.]+:\\d+/g;
  const mascarar = () => {
    const raiz = document.querySelector(".settings-modal");
    if (!raiz) return;
    const it = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = it.nextNode())) {
      const novo = n.nodeValue.replace(RE, "http://192.168.0.10:3210");
      if (novo !== n.nodeValue) n.nodeValue = novo;
    }
  };
  mascarar();
  // O endereço só aparece depois que a aba "Telas" é aberta, o que acontece
  // no meio da sequência — por isso fica um observador reaplicando.
  new MutationObserver(mascarar).observe(document.body, { childList: true, subtree: true, characterData: true });
`;

/** Cada sequência parte da tela inicial de verdade (dashboard recém-aberto,
 *  filtro padrão "Letras", nenhum modal). */
const SEQUENCIAS = {
  "aparencia": (token) => gerarSequencia(token, [
    { seletor: ".settings-modal-body .input-field" },
  ], path.join(OUT_DIR, "aparencia.gif"), {
    preClicks: [ABRIR_CONFIG],
    foco: ".settings-modal",
  }),

  "musica": (token) => gerarSequencia(token, [
    { seletor: '.toolbar-filters .filter-tab:nth-of-type(1)', clicar: true, esperaMs: 400 },
    { seletor: '.act-btn.primary' },
  ], path.join(OUT_DIR, "musica.gif")),

  "aviso": (token) => gerarSequencia(token, [
    { seletor: '.toolbar-filters .filter-tab:nth-of-type(2)', clicar: true, esperaMs: 400 },
    { seletor: '.act-btn.primary' },
  ], path.join(OUT_DIR, "aviso.gif")),

  "midia": (token) => gerarSequencia(token, [
    { seletor: '.toolbar-filters .filter-tab:nth-of-type(3)', clicar: true, esperaMs: 400 },
    { seletor: '.act-btn.primary' },
  ], path.join(OUT_DIR, "midia.gif")),

  "biblia": (token) => gerarSequencia(token, [
    { seletor: '.toolbar-filters .filter-tab:nth-of-type(4)', clicar: true, esperaMs: 400 },
    { seletor: '.library-filter input' },
  ], path.join(OUT_DIR, "biblia.gif")),

  "roteiro": (token) => gerarSequencia(token, [
    { seletor: '.toolbar-filters .filter-tab:nth-of-type(5)', clicar: true, esperaMs: 400 },
    { seletor: '.act-btn.primary' },
  ], path.join(OUT_DIR, "roteiro.gif")),

  "projecao": (token) => gerarSequencia(token, [
    { seletor: '.toolbar-cta' },
  ], path.join(OUT_DIR, "projecao.gif")),

  "stage": (token) => gerarSequencia(token, [
    { seletor: '.toolbar-icon-btn[title*="Stage View"]' },
  ], path.join(OUT_DIR, "stage.gif")),

  "timer": (token) => gerarSequencia(token, [
    { seletor: '.dock-timer-value', clicar: true, esperaMs: 600 },
  ], path.join(OUT_DIR, "timer.gif")),

  "remoto": (token) => gerarSequencia(token, [
    { seletor: '.settings-tab:nth-of-type(2)', clicar: true, esperaMs: 400 },
    // Prefixado com .settings-modal-body de propósito: a aba "Letras" (por
    // trás do modal) também tem um .act-btn.primary ("Nova Música") — sem o
    // escopo, document.querySelector pega esse primeiro, por vir antes no
    // DOM (o resto da página não desmonta quando um modal abre por cima).
    { seletor: '.settings-modal-body .act-btn.primary' },
  ], path.join(OUT_DIR, "remoto.gif"), {
    preClicks: [ABRIR_CONFIG],
    foco: ".settings-modal",
    prepararJs: MASCARAR_ENDERECOS,
  }),
};

(async () => {
  const pedidos = process.argv.slice(2);
  const alvos = pedidos.length > 0 ? pedidos : Object.keys(SEQUENCIAS);
  for (const id of alvos) {
    if (!SEQUENCIAS[id]) throw new Error(`sequência desconhecida: ${id}`);
  }

  const exe = acharNavegador();
  if (!exe) throw new Error("Chrome/Edge não encontrado");

  const demoDir = path.join(os.tmpdir(), "arauto-demo-" + Date.now());
  console.log(`Semeando dados de demonstração em ${demoDir}…`);
  semearDemo(demoDir, path.join(RAIZ, "data"), HASH_DEMO);
  console.log(`Subindo servidor de demonstração em ${BASE}…`);
  const servidor = await subirServidorDemo(demoDir);

  const perfil = path.join(os.tmpdir(), "arauto-gifs-" + Date.now());
  const nav = spawn(exe, [
    "--headless=new", "--remote-debugging-port=9222", `--user-data-dir=${perfil}`,
    "--no-first-run", "--disable-gpu", `--window-size=${JANELA.w},${JANELA.h}`,
    "--force-device-scale-factor=1", "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 40; i++) { await sleep(300); try { await get("/json/version"); break; } catch {} }

  try {
    const token = tokenDoDono();
    for (const id of alvos) {
      console.log(`Gerando "${id}"…`);
      await SEQUENCIAS[id](token);
    }
  } finally {
    try { nav.kill(); } catch {}
    try { servidor.kill(); } catch {}
    try { fs.rmSync(demoDir, { recursive: true, force: true }); } catch {}
  }
  console.log("\nPronto.");
})().catch((e) => { console.error("ERRO:", e); process.exit(1); });
