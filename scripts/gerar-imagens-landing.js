/* Gera as imagens de produto da landing page (landing/img/*.png) a partir do
   sistema rodando de verdade — não são mockups desenhados à mão, é o Arauto
   em funcionamento, com o mesmo conjunto de demonstração dos GIFs do manual
   (scripts/lib/demo-data.js). Nada da instalação real de quem gera aparece.

   `node scripts/gerar-imagens-landing.js` */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { openPage, sleep, get } = require("./lib/cdp");
const { semearDemo } = require("./lib/demo-data");

const RAIZ = path.join(__dirname, "..");
const PORTA = Number(process.env.GIF_PORT || 3311);
const BASE = `http://localhost:${PORTA}`;
const OUT_DIR = path.join(RAIZ, "landing", "img");
const SEGREDO = "gifs-de-demonstracao-nao-usado-em-producao";
const HASH_DEMO = "$2a$10$rb8UG2AMx0E2neHbs6BzZOFwItxN2YZd8nX/KolLeAOQbsS.h6eXy";

function acharNavegador() {
  return [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean).find((c) => fs.existsSync(c));
}

function token() {
  return require("jsonwebtoken").sign(
    { userId: 1, email: "demo@arauto.local", role: "ADMIN" },
    SEGREDO,
    { expiresIn: "30m" }
  );
}

async function subirServidorDemo(dataDir) {
  const proc = spawn(process.execPath, ["server.js"], {
    cwd: RAIZ,
    stdio: "ignore",
    env: { ...process.env, NODE_ENV: "production", PORT: String(PORTA), DATA_DIR: dataDir, JWT_SECRET: SEGREDO },
  });
  for (let i = 0; i < 60; i++) {
    await sleep(500);
    try {
      await new Promise((res, rej) =>
        require("http").get(`${BASE}/api/version`, (r) => { r.resume(); res(); }).on("error", rej)
      );
      return proc;
    } catch {}
  }
  try { proc.kill(); } catch {}
  throw new Error("servidor de demonstração não respondeu");
}

async function fecharModais(page) {
  for (let i = 0; i < 4; i++) {
    const tinha = await page.ev(`
      const o = document.querySelector(".modal-overlay");
      if (o) { o.click(); return true; }
      return false;
    `);
    if (!tinha) break;
    await sleep(400);
  }
}

/** React ignora `input.value = x` seguido de um Event("input") comum — o
 *  onChange não dispara. Tem que passar pelo setter nativo do prototype. */
const DIGITAR = (seletor, valor) => `
  const el = document.querySelector(${JSON.stringify(seletor)});
  if (!el) return false;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
  setter.call(el, ${JSON.stringify(valor)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
`;

function salvar(nome, buffer) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const fp = path.join(OUT_DIR, nome);
  fs.writeFileSync(fp, buffer);
  console.log(`  → landing/img/${nome} (${Math.round(buffer.length / 1024)} KB)`);
}

(async () => {
  const exe = acharNavegador();
  if (!exe) throw new Error("Chrome/Edge não encontrado");

  const demoDir = path.join(os.tmpdir(), "arauto-demo-landing-" + Date.now());
  semearDemo(demoDir, path.join(RAIZ, "data"), HASH_DEMO);
  console.log(`Subindo servidor de demonstração em ${BASE}…`);
  const servidor = await subirServidorDemo(demoDir);

  const perfil = path.join(os.tmpdir(), "arauto-landing-" + Date.now());
  const nav = spawn(exe, [
    "--headless=new", "--remote-debugging-port=9222", `--user-data-dir=${perfil}`,
    "--no-first-run", "--disable-gpu", "--window-size=1600,900", "--force-device-scale-factor=1",
    "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 40; i++) { await sleep(300); try { await get("/json/version"); break; } catch {} }

  try {
    const t = token();

    // ── Painel, com uma música no ar ───────────────────
    const painel = await openPage(`${BASE}/dashboard`, t);
    await sleep(3000);
    await fecharModais(painel);
    // Coloca o culto no ar: o painel "vazio" não mostra o que o sistema faz —
    // o interessante é o estado em operação (letra no ar, roteiro ao vivo à
    // direita, rodapé ativo), que é também o que o celular precisa mostrar.
    await painel.ev(`
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent.includes("Apresentar culto"))?.click();
    `);
    await sleep(1500);
    // Avança um passo pra sair do primeiro item (um aviso) e cair numa
    // música — é o estado mais representativo do culto acontecendo.
    await painel.ev(`
      [...document.querySelectorAll("button")]
        .find((b) => b.textContent.trim() === "Próximo")?.click();
    `);
    await sleep(1200);
    salvar("painel.png", await painel.screenshot());

    // ── Projeção (o que a congregação vê) ──────────────
    const projecao = await openPage(`${BASE}/projection`, t);
    await sleep(2500);
    salvar("projecao.png", await projecao.screenshot());
    projecao.close();

    // ── Stage View (monitor de palco) ──────────────────
    const stage = await openPage(`${BASE}/stage`, t);
    await sleep(2500);
    salvar("stage.png", await stage.screenshot());
    stage.close();

    // ── Controle remoto, num viewport de celular ───────
    // Pareia de verdade: gera o código no painel, lê o PIN da tela e digita
    // no /remote. É a única forma de fotografar a tela conectada.
    await painel.ev(`document.querySelector('.toolbar-icon-btn[title="Configurações"]')?.click();`);
    await sleep(700);
    await painel.ev(`document.querySelector(".settings-tab:nth-of-type(2)")?.click();`);
    await sleep(500);
    await painel.ev(`document.querySelector(".settings-modal-body .act-btn.primary")?.click();`);
    await sleep(900);
    const pin = (await painel.ev(`return document.querySelector(".share-screen-title")?.textContent || "";`))
      .replace(/\D/g, "");
    if (pin.length !== 6) throw new Error(`não consegui ler o PIN de pareamento (li "${pin}")`);

    const celular = await openPage(`${BASE}/remote`, t);
    await celular.send("Emulation.setDeviceMetricsOverride", {
      width: 390, height: 844, deviceScaleFactor: 2, mobile: true,
    });
    await celular.send("Emulation.setTouchEmulationEnabled", { enabled: true });
    await sleep(2000);
    const digitou = await celular.ev(DIGITAR(".remote-pin-input", pin));
    if (!digitou) throw new Error("campo de PIN não encontrado em /remote");
    await sleep(300);
    await celular.ev(`document.querySelector(".remote-pin-form")?.requestSubmit();`);
    await sleep(2500);
    salvar("celular.png", await celular.screenshot());
    celular.close();
    painel.close();
  } finally {
    try { nav.kill(); } catch {}
    try { servidor.kill(); } catch {}
    try { fs.rmSync(demoDir, { recursive: true, force: true }); } catch {}
  }
  console.log("\nPronto.");
})().catch((e) => { console.error("ERRO:", e); process.exit(1); });
