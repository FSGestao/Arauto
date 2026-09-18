/* ═══════════════════════════════════════════════════════
   Peças comuns às verificações automáticas: subir o navegador, entrar no
   painel, esperar o que viaja por socket e contar o placar.
   ═══════════════════════════════════════════════════════ */
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const { openPage, sleep, get } = require("./cdp");

const RAIZ = path.join(__dirname, "..", "..");
const PORTA = process.env.PORT || 3210;
const BASE = `http://localhost:${PORTA}`;

/** Onde o Chrome costuma estar instalado no Windows. */
function acharNavegador() {
  return [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean).find((c) => fs.existsSync(c));
}

let navegador = null;
async function abrirNavegador() {
  const exe = acharNavegador();
  if (!exe) throw new Error("não encontrei o Chrome — informe o caminho em CHROME_PATH");
  const perfil = path.join(os.tmpdir(), "arauto-verificacao-" + Date.now());
  navegador = spawn(exe, [
    "--headless=new",
    "--remote-debugging-port=9222",
    `--user-data-dir=${perfil}`,
    "--no-first-run",
    "--disable-gpu",
    // Sem gesto do usuário não haveria reprodução automática; no culto a
    // projeção é aberta de propósito pelo operador.
    "--autoplay-policy=no-user-gesture-required",
    // "Abrir Projeção" e "Stage View" usam window.open — sem isto o navegador
    // trata como pop-up e bloqueia.
    "--disable-popup-blocking",
    "--window-size=1600,1000",
    "about:blank",
  ], { stdio: "ignore" });
  for (let i = 0; i < 40; i++) {
    await sleep(300);
    try { await get("/json/version"); return; } catch {}
  }
  throw new Error("o navegador não respondeu na porta 9222");
}

function fecharNavegador() {
  if (navegador) try { navegador.kill(); } catch {}
  navegador = null;
}

/** Entra como a conta já existente, sem passar pela tela de login: assina um
 *  token curto com o mesmo segredo do servidor. */
function tokenDoDono() {
  const jwt = require("jsonwebtoken");
  const env = fs.readFileSync(path.join(RAIZ, ".env"), "utf8");
  const achado = env.match(/JWT_SECRET=(.+)/);
  if (!achado) throw new Error("não achei JWT_SECRET no .env");
  const usuarios = JSON.parse(fs.readFileSync(path.join(RAIZ, "data/users.json"), "utf8")).items;
  if (!usuarios || usuarios.length === 0) {
    throw new Error("nenhuma conta criada ainda — crie a primeira no painel");
  }
  const dono = usuarios[0];
  return jwt.sign(
    { userId: dono.id, email: dono.email, role: dono.role || "admin" },
    achado[1].trim(),
    { expiresIn: "1h" }
  );
}

/* ── Placar ──────────────────────────────────────────────── */
const resultados = [];

async function check(id, nome, fn) {
  try {
    const detalhe = await fn();
    resultados.push({ id, nome, ok: true, detalhe: detalhe || "" });
    console.log(`  OK   ${id} ${nome}${detalhe ? " — " + detalhe : ""}`);
  } catch (e) {
    resultados.push({ id, nome, ok: false, detalhe: e.message });
    console.log(`  FALHA ${id} ${nome} — ${e.message}`);
  }
}

function assert(cond, msg) { if (!cond) throw new Error(msg); }

/** Espera até a condição valer — estado que viaja por socket ou passa por
 *  gravação em disco não chega num prazo fixo, então medir uma vez só
 *  produziria falso negativo. */
async function until(fn, ms = 5000, passo = 200) {
  const fim = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > fim) return null;
    await sleep(passo);
  }
}

function placar(titulo) {
  const ok = resultados.filter((r) => r.ok).length;
  const falhas = resultados.filter((r) => !r.ok);
  console.log(`\n=== ${ok}/${resultados.length} ${titulo} ===`);
  for (const r of falhas) console.log(`  ✗ ${r.id} ${r.nome}: ${r.detalhe}`);
  return falhas.length;
}

/* ── Ajudantes injetados na página do painel ─────────────── */
const AJUDANTES = `
  window.__t = (sel) => { const e = document.querySelector(sel); return e ? e.textContent.trim() : null; };
  window.__byText = (sel, txt) => [...document.querySelectorAll(sel)]
    .find(e => e.textContent.replace(/\\s+/g,' ').trim().includes(txt));
  window.__click = (sel, txt) => {
    const e = txt ? window.__byText(sel, txt) : document.querySelector(sel);
    if (!e) throw new Error('não achei: ' + sel + (txt ? ' / ' + txt : ''));
    e.click(); return true;
  };
  window.__setInput = (el, value) => {
    if (!el) throw new Error('campo inexistente');
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement
      : el instanceof HTMLSelectElement ? HTMLSelectElement : HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
    setter.call(el, String(value));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  /** Preenche os campos de um modal na ordem em que aparecem. */
  window.__preencherModal = (valores) => {
    const campos = [...document.querySelectorAll('.modal .input-field')]
      .filter(e => e.type !== 'file' && e.type !== 'checkbox');
    valores.forEach((v, i) => { if (v !== null && campos[i]) window.__setInput(campos[i], v); });
    return campos.length;
  };
  window.__itens = () => [...document.querySelectorAll('.library-list .library-item')].map(e => ({
    titulo: e.querySelector('.library-item-title')?.textContent.trim(),
    sub: e.querySelector('.library-item-sub')?.textContent.trim(),
    ativo: e.classList.contains('active'),
  }));
  window.__dock = () => ({
    nowplaying: window.__t('.dock-nowplaying'),
    subline: window.__t('.dock-subline'),
    hasSeek: !!document.querySelector('.dock-seek'),
    timer: window.__t('.dock-timer-value'),
  });
  window.__roteiro = () => ({
    head: window.__t('.roteiro-head p') || window.__t('.roteiro-head select'),
    steps: [...document.querySelectorAll('.roteiro-step')].map(s => ({
      label: s.querySelector('.roteiro-step-label').textContent.trim(),
      current: s.classList.contains('current'),
      skipped: s.classList.contains('skipped'),
    })),
    currentIndex: [...document.querySelectorAll('.roteiro-step')].findIndex(s => s.classList.contains('current')),
    notice: window.__t('.roteiro-notice'),
  });
  window.__currentLyric = () => {
    const e = document.querySelector('.lyric-row.current .lyric-text');
    if (!e) return null;
    return e.textContent.replace(/[“”✏️]/g, '').trim();
  };
  /** Fecha qualquer janela sobreposta. Um modal esquecido aberto engole os
   *  cliques do teste seguinte e faz falhar o que está certo. */
  window.__fecharModais = () => {
    const fechar = document.querySelector('.settings-modal-head .toolbar-icon-btn');
    if (fechar) fechar.click();
    const sobreposto = document.querySelector('.modal-overlay, .settings-modal-overlay');
    if (sobreposto) sobreposto.click();
    return !document.querySelector('.modal-overlay, .settings-modal-overlay');
  };
  window.__abrirConfiguracoes = () => {
    window.__fecharModais();
    const b = [...document.querySelectorAll('.toolbar-icon-btn')]
      .find(x => (x.title || '').includes('Config'));
    if (!b) throw new Error('não achei o botão de Configurações');
    b.click();
  };
  /** Acha um item da biblioteca pelo título EXATO. Casar por "contém" pegaria
   *  "Aviso com imagem" quando o teste pediu "Aviso". */
  window.__itemPorTitulo = (titulo) => [...document.querySelectorAll('.library-item')]
    .find(e => e.querySelector('.library-item-title')?.textContent.trim() === titulo);

  /** Clica um botão de ação de um item da biblioteca pelo texto do botão. */
  window.__acaoDoItem = (titulo, textoDoBotao) => {
    const card = window.__itemPorTitulo(titulo);
    if (!card) throw new Error('não achei o item: ' + titulo);
    const b = [...card.querySelectorAll('.act-btn')].find(x => x.textContent.includes(textoDoBotao));
    if (!b) throw new Error(\`o item "\${titulo}" não tem o botão "\${textoDoBotao}"\`);
    b.click();
  };
  window.__api = async (caminho, opcoes) => {
    const t = (document.cookie.match(/auth-token=([^;]+)/) || [])[1];
    const r = await fetch(caminho, Object.assign({ cache: 'no-store' }, opcoes || {}, {
      headers: Object.assign({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        (opcoes || {}).headers || {}),
    }));
    const texto = await r.text();
    try { return { status: r.status, corpo: JSON.parse(texto) }; }
    catch { return { status: r.status, corpo: texto }; }
  };
  true;
`;

/** O que a tela de projeção está mostrando neste instante. */
const TELA_PROJECAO = `
  const c = document.querySelector('.projection-container');
  return { lyric: document.querySelector('.projection-lyric')?.textContent.trim() || null,
           body: c ? c.innerText.replace(/\\s+/g,' ').trim() : document.body.innerText.trim(),
           html: c ? c.innerHTML : '',
           fundo: getComputedStyle(document.body).backgroundColor,
           video: (() => { const v = document.querySelector('video, audio');
             return v ? { paused: v.paused, t: v.currentTime, vol: v.volume, src: v.currentSrc } : null; })() };
`;

/** Erros de console que não interessam (extensões, favicon, avisos do React). */
const ruidoDeConsole = (l) => !/favicon|ERR_|Download the React DevTools|Warning: /i.test(l);

module.exports = {
  RAIZ, BASE, PORTA,
  abrirNavegador, fecharNavegador, tokenDoDono,
  check, assert, until, placar, resultados,
  AJUDANTES, TELA_PROJECAO, ruidoDeConsole,
  openPage, sleep,
};
