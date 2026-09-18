/* ═══════════════════════════════════════════════════════
   Verificação da faixa AO VIVO do Arauto — `npm run verificar:ao-vivo`.

   Abre painel + projeção + stage em abas reais de um Chrome sem janela e
   dirige o PAINEL pela interface (os mesmos cliques que o operador daria),
   conferindo depois de cada ação que as três telas contam a mesma história.
   É a parte do roteiro de testes (docs/roteiro-de-testes.md) que dá pra
   conferir sozinho; upload de arquivo, rede e projetor de verdade continuam
   sendo teste de gente.

   Pré-requisitos: o servidor rodando (`npm run dev`) e uma conta já criada.
   O script não cria nem apaga nada: usa o que já está cadastrado e desfaz
   pela interface as alterações que precisa fazer (correção de letra, item
   desmarcado no roteiro). A única marca que fica é o `updatedAt` da música
   que ele corrige e desfaz — o conteúdo volta idêntico.
   ═══════════════════════════════════════════════════════ */
const {
  BASE, abrirNavegador, fecharNavegador, tokenDoDono,
  check, assert, until, placar, AJUDANTES, TELA_PROJECAO, ruidoDeConsole,
  openPage, sleep,
} = require('./lib/verificacao');

let painel, proj, stage;

/* ── Roteiro de verificação ──────────────────────────────── */
async function run() {
  const token = tokenDoDono();

  await abrirNavegador();
  console.log("Abrindo projeção, stage e painel...");
  proj = await openPage(`${BASE}/projection`);
  stage = await openPage(`${BASE}/stage`);
  painel = await openPage(`${BASE}/dashboard`, token);
  // O navegador sem tela não baixa áudio/vídeo de aba em segundo plano; no
  // uso real a projeção está sempre visível no projetor.
  await proj.send("Page.bringToFront");
  await sleep(2500);
  await painel.ev(AJUDANTES);

  const dashOk = await painel.ev("return !!document.querySelector('.cockpit-toolbar');");
  if (!dashOk) throw new Error("o painel não carregou (login?)");

  // ── 14.2 bolinhas de conexão ──
  await check("14.2", "bolinhas de conexão acendem com projeção e stage abertas", async () => {
    await sleep(800);
    const dots = await painel.ev("return [...document.querySelectorAll('.conn-dot')].map(d => d.className);");
    assert(dots.length === 3, "esperava 3 bolinhas, achei " + dots.length);
    assert(dots[1].includes("on"), "bolinha da projeção apagada: " + dots[1]);
    assert(dots[2].includes("on"), "bolinha da stage apagada: " + dots[2]);
    return "projeção e stage acesas";
  });

  // ── 5.9 apresentar o culto ──
  await check("5.9", "Apresentar coloca o primeiro item no ar", async () => {
    await painel.ev("window.__click('.filter-tab', 'Cultos');");
    await sleep(400);
    await painel.ev("window.__click('.library-item .act-btn', 'Apresentar');");
    await sleep(1200);
    const r = await painel.ev("return window.__roteiro();");
    assert(r.head && /·\s*1\//.test(r.head), "cabeça do roteiro não mostra 1/N: " + r.head);
    assert(r.currentIndex === 0, "passo atual não é o primeiro: " + r.currentIndex);
    return r.head;
  });

  // ── 9.x mídia ao vivo (o passo 1 do culto de exemplo é mídia) ──
  const step1 = await painel.ev("return window.__dock();");
  const isMedia = await painel.ev("return !!document.querySelector('.dock-seek');");

  if (isMedia) {
    await check("9.2", "barra de posição aparece na dock e a projeção toca a mídia", async () => {
      const p = await proj.ev(TELA_PROJECAO);
      assert(p.video, "projeção não tem <video>/<audio> no ar");
      assert(step1.hasSeek, "dock não mostrou a barra de posição");
      return `tocando ${p.video.src.split("/").pop()}`;
    });

    // Pausa e fica pausada: a trilha de exemplo tem 10s e acabaria no meio
    // dos testes de posição e volume, tirando o player do ar.
    await check("9.1", "Pausar para mesmo a mídia na projeção", async () => {
      await painel.ev("window.__click('.dock-btn', 'Pausar');");
      const pausou = await until(async () => {
        const p = await proj.ev(TELA_PROJECAO);
        return p.video && p.video.paused;
      });
      assert(pausou, "a mídia continuou tocando depois de Pausar");
      const virou = await until(() => painel.ev(
        "return (window.__t('.dock-btn.primary') || '').includes('Retomar');"), 5000);
      const label = await painel.ev("return window.__t('.dock-btn.primary');");
      assert(virou, "o botão não virou Retomar: " + label);
      return "pausou";
    });

    // Volume vem antes da busca de posição: a trilha de exemplo é curta e
    // termina se a deixarmos correr até o fim.
    await check("9.3", "volume do painel chega na projeção", async () => {
      // O slider da dock é o volume MESTRE; cada item tem o seu próprio nível
      // gravado. O que deve chegar na projeção é o produto dos dois.
      const nivelDoItem = await painel.ev(`
        const r = await fetch('/api/media-library', { headers: { Authorization: 'Bearer ' + (document.cookie.match(/auth-token=([^;]+)/)||[])[1] } });
        const j = await r.json();
        const itens = Array.isArray(j) ? j : (j.items || []);
        const t = window.__t('.dock-nowplaying');
        const m = itens.find(i => t.includes(i.title));
        return m ? (m.volume ?? 1) : 1;`);
      const esperado = 0.35 * nivelDoItem;
      await painel.ev("window.__setInput(document.querySelector('.dock-volume input[type=range]'), 0.35);");
      const ok = await until(async () => {
        const p = await proj.ev(TELA_PROJECAO);
        return p.video && Math.abs(p.video.vol - esperado) < 0.06 ? p.video.vol : null;
      });
      const p = await proj.ev(TELA_PROJECAO);
      assert(p.video, "a mídia saiu do ar antes de eu medir o volume");
      assert(ok !== null, `mestre 0.35 × item ${nivelDoItem} = ${esperado.toFixed(3)}, mas a projeção ficou em ${p.video.vol.toFixed(3)}`);
      await painel.ev("window.__setInput(document.querySelector('.dock-volume input[type=range]'), 1);");
      await until(async () => {
        const q = await proj.ev(TELA_PROJECAO);
        return q.video && q.video.vol > 0.95;
      });
      return "0.35 aplicado e devolvido a 1";
    });

    await check("9.2b", "arrastar a barra de posição move a mídia", async () => {
      // A duração vem do painel (o max do slider): a projeção pode ainda não
      // ter carregado os metadados do arquivo.
      // A duração chega pela projeção a cada meio segundo; no começo o painel
      // ainda não sabe e a barra fica sem escala.
      const dur = await until(() => painel.ev(
        "const s = document.querySelector('.dock-seek input[type=range]');" +
        "const m = s ? parseFloat(s.max) : 0; return m > 3 ? m : null;"), 8000);
      assert(dur, "o painel não recebeu a duração da mídia em 8s");
      const alvo = Math.round(dur * 0.5);
      await painel.ev(`window.__setInput(document.querySelector('.dock-seek input[type=range]'), ${alvo});`);
      const ok = await until(async () => {
        const p = await proj.ev(TELA_PROJECAO);
        return p.video && Math.abs(p.video.t - alvo) < 2.5 ? p.video.t : null;
      }, 4000);
      const p = await proj.ev(TELA_PROJECAO);
      assert(ok !== null, `pedi ${alvo}s, a projeção parou em ${p.video ? p.video.t.toFixed(1) + "s" : "nada no ar"}`);
      return `pulou para ${ok.toFixed(1)}s de ${dur.toFixed(1)}s`;
    });

    await check("9.1b", "Retomar volta a tocar", async () => {
      await painel.ev("window.__click('.dock-btn', 'Retomar');");
      const voltou = await until(async () => {
        const p = await proj.ev(TELA_PROJECAO);
        return p.video && !p.video.paused;
      });
      assert(voltou, "a mídia não voltou a tocar depois de Retomar");
      return "voltou a tocar";
    });
  }

  // ── avança até uma música ──
  // A coluna de letras só existe no filtro Músicas; é lá que o operador
  // acompanha a letra durante o culto.
  async function irParaMusica() {
    await painel.ev("window.__click('.filter-tab', 'Letras');");
    await sleep(500);
    for (let i = 0; i < 10; i++) {
      const tem = await painel.ev("return !!document.querySelector('.lyric-row.current');");
      if (tem) return true;
      await painel.ev("window.__click('.dock-btn', 'Próximo');");
      await sleep(900);
    }
    return false;
  }
  const achouMusica = await irParaMusica();

  await check("13.2", "painel, projeção e stage mostram a mesma linha", async () => {
    assert(achouMusica, "não cheguei a nenhuma música avançando o roteiro");
    await sleep(600);
    const linha = await painel.ev("return window.__currentLyric();");
    const p = await proj.ev(TELA_PROJECAO);
    const s = await stage.ev("return document.body.innerText.replace(/\\s+/g,' ').trim();");
    assert(p.lyric === linha, `projeção: "${p.lyric}" ≠ painel: "${linha}"`);
    assert(s.includes(linha), `stage não mostra a linha. Stage: "${s.slice(0, 80)}"`);
    return `"${linha}" nas três telas`;
  });

  await check("6.1", "Próximo anda linha a linha antes de trocar de item", async () => {
    const antes = await painel.ev("return { lyric: window.__currentLyric(), r: window.__roteiro() };");
    await painel.ev("window.__click('.dock-btn', 'Próximo');");
    await sleep(900);
    const depois = await painel.ev("return { lyric: window.__currentLyric(), r: window.__roteiro() };");
    assert(depois.lyric && depois.lyric !== antes.lyric, "a linha não mudou");
    assert(depois.r.currentIndex === antes.r.currentIndex,
      `trocou de item do roteiro (${antes.r.currentIndex} → ${depois.r.currentIndex}) em vez de andar na letra`);
    const p = await proj.ev(TELA_PROJECAO);
    assert(p.lyric === depois.lyric, "a projeção ficou para trás: " + p.lyric);
    return `"${antes.lyric}" → "${depois.lyric}", ainda no passo ${depois.r.currentIndex + 1}`;
  });

  await check("6.7", "o contador de passo acompanha a apresentação", async () => {
    const antes = await painel.ev("return window.__roteiro();");
    const casa = /·\s*(\d+)\/(\d+)/.exec(antes.head || "");
    assert(casa, `a cabeça do roteiro não mostra o passo: "${antes.head}"`);
    assert(Number(casa[1]) === antes.currentIndex + 1,
      `o contador diz ${casa[1]} mas o card destacado é o ${antes.currentIndex + 1}`);
    assert(Number(casa[2]) === antes.steps.length,
      `o total diz ${casa[2]} mas o roteiro tem ${antes.steps.length} itens`);
    return antes.head;
  });

  await check("6.8", "a dock anuncia a próxima linha", async () => {
    const d = await painel.ev("return window.__dock();");
    const atual = await painel.ev("return window.__currentLyric();");
    assert(d.subline && d.subline.startsWith("A seguir:"), "sem 'A seguir': " + d.subline);
    const seguinte = d.subline.replace("A seguir:", "").trim();
    assert(seguinte !== atual, "'A seguir' está repetindo a linha que já está no ar");
    return d.subline;
  });

  await check("6.2", "Anterior volta a linha", async () => {
    const antes = await painel.ev("return window.__currentLyric();");
    await painel.ev("window.__click('.dock-btn', 'Anterior');");
    await sleep(900);
    const depois = await painel.ev("return window.__currentLyric();");
    assert(depois !== antes, "a linha não voltou");
    const p = await proj.ev(TELA_PROJECAO);
    assert(p.lyric === depois, "projeção fora de sincronia: " + p.lyric);
    return `voltou para "${depois}"`;
  });

  await check("6.3", "Auto liga o avanço automático", async () => {
    await painel.ev("window.__click('.dock-btn.primary', 'Auto');");
    await sleep(600);
    const label = await painel.ev("return window.__t('.dock-btn.primary');");
    assert(label.includes("Pausar"), "o botão não virou Pausar: " + label);
    await painel.ev("window.__click('.dock-btn.primary', 'Pausar');");
    await sleep(500);
    return "ligou e desligou";
  });

  // O sinal certo aqui é o que a própria projeção passa a exibir somado ao
  // que o painel mostra — assim o teste pega tanto "não avançou" quanto
  // "avançou na projeção mas o painel não soube".
  const estado = async () => {
    const p = await proj.ev(TELA_PROJECAO);
    const d = await painel.ev("return window.__dock();");
    return p.body + " || " + d.nowplaying + " || " + d.subline;
  };

  await check("7.4", "clicar na tela de projeção avança, e o painel acompanha", async () => {
    const antes = await estado();
    await proj.send("Input.dispatchMouseEvent", { type: "mousePressed", x: 500, y: 400, button: "left", clickCount: 1 });
    await proj.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: 500, y: 400, button: "left", clickCount: 1 });
    const mudou = await until(async () => (await estado()) !== antes);
    assert(mudou, "o clique na projeção não mudou nada");
    const juntos = await until(async () => {
      const p = await proj.ev(TELA_PROJECAO);
      const linha = await painel.ev("return window.__currentLyric();");
      return !linha || p.lyric === linha;
    }, 4000);
    const p = await proj.ev(TELA_PROJECAO);
    const linha = await painel.ev("return window.__currentLyric();");
    assert(juntos, `depois de 4s ainda divergem — painel: "${linha}", projeção: "${p.lyric}"`);
    return "projeção avançou e o painel acompanhou";
  });

  await check("7.3", "setas do teclado na projeção", async () => {
    const antes = await estado();
    await proj.ev("window.focus(); document.body.focus();");
    for (const t of ["keyDown", "rawKeyDown", "keyUp"]) {
      await proj.send("Input.dispatchKeyEvent", {
        type: t === "rawKeyDown" ? "rawKeyDown" : t, key: "ArrowLeft", code: "ArrowLeft",
        windowsVirtualKeyCode: 37, nativeVirtualKeyCode: 37,
      });
    }
    const mudou = await until(async () => (await estado()) !== antes);
    assert(mudou, "a seta ← na projeção não voltou nada");
    return "← voltou um passo";
  });

  await check("7.2", "a prévia da dock é a projeção de verdade", async () => {
    // A prévia é um cliente de projeção completo, então o que vale é a tela
    // inteira — pode estar no ar uma letra, um aviso ou uma mídia.
    const lerPrevia = `
      const f = document.querySelector('.dock-preview iframe');
      const d = f && f.contentDocument;
      if (!d) return null;
      const c = d.querySelector('.projection-container') || d.body;
      return c.innerText.replace(/\\s+/g, ' ').trim();`;
    const bateu = await until(async () => {
      const dentro = await painel.ev(lerPrevia);
      const p = await proj.ev(TELA_PROJECAO);
      return dentro !== null && dentro === p.body;
    }, 6000);
    const dentro = await painel.ev(lerPrevia);
    const p = await proj.ev(TELA_PROJECAO);
    assert(dentro !== null, "não consegui ler a prévia da dock");
    assert(bateu, `depois de 6s a prévia mostra "${dentro.slice(0, 50)}" e a projeção "${p.body.slice(0, 50)}"`);
    return `prévia e projeção em "${dentro.slice(0, 40)}"`;
  });

  await check("6.6", "clicar num card do roteiro pula direto pra ele", async () => {
    const r0 = await painel.ev("return window.__roteiro();");
    const alvo = r0.steps.findIndex((s, i) => i !== r0.currentIndex && !s.skipped);
    await painel.ev(`document.querySelectorAll('.roteiro-step')[${alvo}].click();`);
    await sleep(1000);
    const r1 = await painel.ev("return window.__roteiro();");
    assert(r1.currentIndex === alvo, `pedi o passo ${alvo + 1}, fui parar no ${r1.currentIndex + 1}`);
    return `pulou para "${r1.steps[alvo].label}"`;
  });

  await check("6.5", "item desmarcado é pulado pelo Próximo", async () => {
    const r0 = await painel.ev("return window.__roteiro();");
    const atual = r0.currentIndex;
    const pular = atual + 1;
    assert(pular < r0.steps.length - 1, "não há passos suficientes à frente para testar o pulo");
    await painel.ev(`document.querySelectorAll('.roteiro-step')[${pular}].querySelector('input[type=checkbox]').click();`);
    await sleep(800);
    const marcado = await painel.ev("return window.__roteiro();");
    assert(marcado.steps[pular].skipped, "o item não ficou marcado como oculto");
    await painel.ev("window.__click('.dock-btn', 'Próximo');");
    await sleep(1000);
    const depois = await painel.ev("return window.__roteiro();");
    assert(depois.currentIndex !== pular, `caiu justamente no item oculto (passo ${pular + 1})`);
    // devolve o item ao roteiro
    await painel.ev(`document.querySelectorAll('.roteiro-step')[${pular}].querySelector('input[type=checkbox]').click();`);
    await sleep(600);
    return `pulou o passo ${pular + 1} e foi para o ${depois.currentIndex + 1}`;
  });

  await check("6.4", "arrastar um card reordena sem tirar o item do ar", async () => {
    const r0 = await painel.ev("return window.__roteiro();");
    const a = r0.steps.length - 2, b = r0.steps.length - 1;
    const atualAntes = r0.steps[r0.currentIndex].label.replace(/^\d+\.\s*/, "");
    // Um passo por vez: o dragstart precisa que o React já tenha guardado
    // qual card saiu antes de o drop chegar.
    await painel.ev(`window.__dt = new DataTransfer();
      document.querySelectorAll('.roteiro-step')[${a}]
        .dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: window.__dt }));`);
    await sleep(400);
    await painel.ev(`document.querySelectorAll('.roteiro-step')[${b}]
        .dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__dt }));`);
    await sleep(200);
    await painel.ev(`document.querySelectorAll('.roteiro-step')[${b}]
        .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__dt }));`);
    await sleep(1200);
    const r1 = await painel.ev("return window.__roteiro();");
    const nomeA = r0.steps[a].label.replace(/^\d+\.\s*/, "");
    const nomeB = r1.steps[b].label.replace(/^\d+\.\s*/, "");
    assert(nomeA === nomeB, `esperava "${nomeA}" na posição ${b + 1}, achei "${nomeB}"`);
    const atualDepois = r1.steps[r1.currentIndex].label.replace(/^\d+\.\s*/, "");
    assert(atualDepois === atualAntes, `o item no ar mudou sozinho: "${atualAntes}" → "${atualDepois}"`);
    return `"${nomeA}" foi para a posição ${b + 1}, "${atualAntes}" continuou no ar`;
  });

  // ── 10.1 / 10.2 edição de letra ao vivo ──
  await check("10.1", "corrigir a linha no ar atualiza a projeção na hora", async () => {
    assert(await irParaMusica(), "não consegui voltar a uma música");
    const original = await painel.ev("return window.__currentLyric();");
    await painel.ev("document.querySelector('.lyric-row.current .lyric-text p').click();");
    await sleep(400);
    const novo = original + " [teste]";
    await painel.ev(`
      const inp = document.querySelector('.lyric-row.current input');
      window.__setInput(inp, ${JSON.stringify(novo)});
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));`);
    await sleep(1200);
    const p = await proj.ev(TELA_PROJECAO);
    assert(p.lyric === novo, `projeção mostra "${p.lyric}", esperava "${novo}"`);
    painel.__linhaOriginal = original;
    painel.__linhaNova = novo;
    return `"${original}" → "${novo}" na projeção`;
  });

  await check("10.2", "a correção foi salva de verdade na biblioteca", async () => {
    const novo = painel.__linhaNova;
    assert(novo, "o teste anterior não chegou a corrigir nada");
    const achou = await until(() => painel.ev(`
      const r = await fetch('/api/songs?t=' + Date.now(), { cache: 'no-store',
        headers: { Authorization: 'Bearer ' + (document.cookie.match(/auth-token=([^;]+)/)||[])[1] } });
      const j = await r.json();
      const songs = Array.isArray(j) ? j : (j.items || j.songs || []);
      return songs.some(s => (s.lyrics||[]).some(l => l.text === ${JSON.stringify(novo)}));`), 6000);
    assert(achou, "a linha corrigida não apareceu na API de músicas depois de 6s");
    // desfaz a correção pela mesma via da interface
    await painel.ev("document.querySelector('.lyric-row.current .lyric-text p').click();");
    await sleep(400);
    await painel.ev(`
      const inp = document.querySelector('.lyric-row.current input');
      window.__setInput(inp, ${JSON.stringify(painel.__linhaOriginal)});
      inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));`);
    await sleep(1000);
    return "gravada na biblioteca e desfeita";
  });

  // ── 8.2 / 8.3 interjeição ──
  await check("8.2", "texto avulso vai ao ar e pausa o roteiro", async () => {
    await painel.ev("document.querySelector('.roteiro-head .toolbar-icon-btn').click();");
    await sleep(500);
    await painel.ev(`
      const ins = document.querySelectorAll('.cockpit-roteiro .glass-card input, .cockpit-roteiro .glass-card textarea');
      window.__setInput(ins[0], 'João 3:16');
      window.__setInput(ins[1], 'Porque Deus amou o mundo de tal maneira');`);
    await sleep(300);
    await painel.ev("window.__click('.cockpit-roteiro .act-btn', 'Mostrar agora');");
    await sleep(1200);
    const p = await proj.ev(TELA_PROJECAO);
    assert(p.body.includes("João 3:16") || p.body.includes("amou o mundo"), "a projeção não mostrou o texto avulso: " + p.body.slice(0, 80));
    const r = await painel.ev("return window.__roteiro();");
    assert(r.notice && r.notice.includes("pausado"), "não apareceu o aviso de roteiro pausado");
    return "texto no ar, roteiro pausado";
  });

  await check("8.3", "Voltar ao roteiro retoma o mesmo passo", async () => {
    const r0 = await painel.ev("return window.__roteiro();");
    const passoAntes = r0.currentIndex;
    await painel.ev("window.__click('.roteiro-notice .act-btn', 'Voltar ao roteiro');");
    await sleep(1200);
    const r1 = await painel.ev("return window.__roteiro();");
    assert(!r1.notice, "o aviso de roteiro pausado não sumiu");
    assert(r1.currentIndex === passoAntes, `voltou para o passo ${r1.currentIndex + 1}, esperava o ${passoAntes + 1}`);
    return `retomou no passo ${passoAntes + 1}`;
  });

  // ── 11.1 / 11.2 contagem regressiva ──
  await check("11.2", "contagem regressiva aparece nas três telas e devolve o roteiro", async () => {
    const r0 = await painel.ev("return window.__roteiro();");
    const passoAntes = r0.currentIndex;
    await painel.ev("document.querySelector('.dock-timer-value').click();");
    await sleep(500);
    await painel.ev(`
      const box = window.__byText('div', 'Contagem regressiva');
      const num = document.querySelector('input[type=number]');
      window.__setInput(num, 5);
      const txt = [...document.querySelectorAll('input[placeholder]')].find(i => i.placeholder.includes('Mensagem'));
      if (txt) window.__setInput(txt, 'Começamos em');`);
    await sleep(300);
    await painel.ev("window.__click('button', 'Iniciar');");
    await sleep(1500);
    const p = await proj.ev(TELA_PROJECAO);
    assert(/\d+:\d\d/.test(p.body), "a projeção não mostra um relógio: " + p.body.slice(0, 60));
    const s = await stage.ev("return document.body.innerText.replace(/\\s+/g,' ').trim();");
    assert(/\d+:\d\d/.test(s), "a stage não mostra o relógio: " + s.slice(0, 60));
    const d = await painel.ev("return window.__dock();");
    assert(/\d+:\d\d/.test(d.timer), "o Timer da dock não está contando: " + d.timer);
    await painel.ev("window.__click('button', 'Parar');");
    await sleep(1200);
    const r1 = await painel.ev("return window.__roteiro();");
    assert(r1.currentIndex === passoAntes, `depois de parar, voltou para o passo ${r1.currentIndex + 1} em vez do ${passoAntes + 1}`);
    return "relógio nas três telas, roteiro retomado";
  });

  // ── 15.3 recarregar no meio do culto ──
  await check("15.3", "recarregar o painel não interrompe o culto", async () => {
    const antes = await painel.ev("return window.__roteiro().currentIndex;");
    const projAntes = await proj.ev(TELA_PROJECAO);
    await painel.send("Page.reload");
    await sleep(3000);
    await painel.ev(AJUDANTES);
    const depois = await painel.ev("return window.__roteiro().currentIndex;");
    assert(depois === antes, `voltou no passo ${depois + 1}, esperava o ${antes + 1}`);
    const projDepois = await proj.ev(TELA_PROJECAO);
    assert(projDepois.body === projAntes.body, "a projeção piscou/mudou durante o recarregamento do painel");
    return `continuou no passo ${antes + 1}`;
  });

  // ── 6.9 limpar ──
  await check("6.9", "Limpar apaga a projeção", async () => {
    await painel.ev("window.__click('.dock-btn.danger', 'Limpar');");
    await sleep(1200);
    const d = await painel.ev("return window.__dock();");
    assert(d.nowplaying.includes("tela em branco"), "a dock não diz tela em branco: " + d.nowplaying);
    const p = await proj.ev(TELA_PROJECAO);
    assert(!p.lyric, "a projeção ainda mostra uma letra: " + p.lyric);
    return "projeção limpa";
  });

  // ── 12.3 busca global coloca no ar ──
  await check("12.3", "Enter na busca global coloca o item no ar", async () => {
    await painel.ev(`
      const inp = document.querySelector('.toolbar-search input');
      inp.click(); window.__setInput(inp, 'Grande');`);
    await sleep(900);
    await painel.ev(`
      const campo = document.querySelector('.search-modal input, .modal-overlay input');
      const alvo = campo || document.querySelector('.toolbar-search input');
      alvo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));`);
    await sleep(1400);
    const d = await painel.ev("return window.__dock();");
    assert(!d.nowplaying.includes("tela em branco"), "nada foi ao ar: " + d.nowplaying);
    return d.nowplaying.slice(0, 60);
  });

  // ── erros de console ──
  await check("console", "nenhum erro de JavaScript nas três telas", async () => {
    const erros = [...painel.logs, ...proj.logs, ...stage.logs].filter(ruidoDeConsole);
    assert(erros.length === 0, erros.slice(0, 3).join(" | "));
    return "limpo";
  });
}

run()
  .then(() => encerrar())
  .catch((e) => { console.log("\nERRO GERAL:", e.message); encerrar(1); });

function encerrar(codigo) {
  const falhas = placar("cenários ao vivo passaram");
  if (falhas === 0) {
    console.log("Continua sendo teste de gente: importação do YouTube, login,");
    console.log("rede de verdade e o projetor. Veja docs/roteiro-de-testes.md.");
  }
  for (const p of [painel, proj, stage]) if (p) p.close();
  fecharNavegador();
  process.exit(codigo || (falhas ? 1 : 0));
}
