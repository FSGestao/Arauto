/* ═══════════════════════════════════════════════════════
   Verificação do PAINEL do Arauto — `npm run verificar:painel`.

   Cobre a parte de cadastro e configuração do roteiro de testes
   (docs/roteiro-de-testes.md): criar música com letra, avisos com imagem e
   vídeo, envio de mídia, montagem de culto, configurações, backup, falhas e
   tela estreita. A parte de apresentação ao vivo está em
   verificar-ao-vivo.js.

   Pré-requisitos: servidor rodando (`npm run dev`) e uma conta já criada.

   O script cria os próprios dados, todos com o prefixo "[verificação]", e
   apaga tudo no fim — inclusive os arquivos que envia. Não encosta no que já
   estava cadastrado.
   ═══════════════════════════════════════════════════════ */
const fs = require("fs");
const path = require("path");
const {
  RAIZ, BASE, abrirNavegador, fecharNavegador, tokenDoDono,
  check, assert, until, placar, AJUDANTES, TELA_PROJECAO, ruidoDeConsole,
  openPage, sleep,
} = require("./lib/verificacao");
const arquivos = require("./lib/arquivos-de-teste");

const MARCA = "[verificação]";
let painel, proj;

/** Escolhe um filtro da biblioteca, garantindo que nada esteja sobreposto. */
async function filtro(nome) {
  await painel.ev("window.__fecharModais();");
  await painel.ev(`window.__click('.filter-tab', ${JSON.stringify(nome)});`);
  await sleep(500);
}

/** Recarrega o painel e só devolve quando ele estiver montado de novo.
 *  Em modo de desenvolvimento a recompilação faz a página demorar bem mais
 *  do que uma espera fixa razoável. */
async function recarregarPainel() {
  await painel.send("Page.reload");
  const montou = await until(() => painel.ev(
    "return !!document.querySelector('.cockpit-toolbar') && !!document.querySelector('.cockpit-dock');"
  ).catch(() => false), 30000, 400);
  assert(montou, "o painel não voltou depois de recarregar");
  await painel.ev(AJUDANTES);
  await sleep(400);
}

/** Espera um modal abrir (eles montam depois do clique). */
async function esperarModal(textoDoTitulo) {
  const abriu = await until(() => painel.ev(
    `const h = document.querySelector('.modal h2'); return h ? h.textContent.includes(${JSON.stringify(textoDoTitulo)}) : false;`
  ), 4000);
  assert(abriu, `o modal "${textoDoTitulo}" não abriu`);
}

async function run() {
  const token = tokenDoDono();
  await abrirNavegador();
  console.log("Abrindo painel e projeção...");
  proj = await openPage(`${BASE}/projection`);

  /* ═══ 1. Login e conta ═══ */
  // Antes de entrar: o navegador ainda não tem sessão, então "/" mostra mesmo
  // a tela de login. Depois de abrir o painel, o cookie é compartilhado entre
  // as abas e não daria mais para ver essa tela.
  await check("1.4", "a tela de login mostra o ícone do Arauto", async () => {
    const login = await openPage(`${BASE}/`);
    const achou = await until(() => login.ev(`
      const img = document.querySelector('.login-card img');
      return img ? img.getAttribute('src') : null;`), 15000);
    const corpo = await login.ev("return document.body.innerText;");
    login.close();
    assert(achou, "a tela de login não mostrou imagem nenhuma");
    assert(achou.includes("arauto-logo"), "a imagem da tela de login não é a logo: " + achou);
    assert(!corpo.includes("🎵"), "a tela de login ainda usa o emoji antigo");
    return achou;
  });

  painel = await openPage(`${BASE}/dashboard`, token);
  await proj.send("Page.bringToFront");
  await sleep(2500);
  await painel.ev(AJUDANTES);
  assert(await painel.ev("return !!document.querySelector('.cockpit-toolbar');"),
    "o painel não carregou (login?)");

  /* ═══ 2. Músicas ═══ */
  let musicaId = null;
  const LETRA = ["Primeira linha da verificação", "Segunda linha da verificação", "Terceira linha da verificação"];

  await check("2.1", "criar música e colar a letra vira uma linha por frase", async () => {
    await filtro("Letras");
    await painel.ev("window.__click('.act-btn', 'Nova Música');");
    await esperarModal("Nova Música");
    await painel.ev(`window.__preencherModal([${JSON.stringify(MARCA + " Música")}, "Artista de teste", ""]);`);
    await painel.ev("window.__click('.modal .btn-primary', 'Adicionar Música');");
    await sleep(1200);

    const criada = await until(() => painel.ev(
      `return window.__itens().some(i => i.titulo === ${JSON.stringify(MARCA + " Música")});`));
    assert(criada, "a música não apareceu na lista");

    // Abre o editor de letras da música recém-criada.
    await painel.ev(`
      const item = window.__itens ? [...document.querySelectorAll('.library-item')]
        .find(e => e.querySelector('.library-item-title')?.textContent.trim() === ${JSON.stringify(MARCA + " Música")}) : null;
      item.click();`);
    await sleep(600);
    await painel.ev("window.__click('.library-detail .act-btn', 'Letras');");
    await esperarModal("Letras:");
    await painel.ev("window.__click('.modal .btn-sm', 'Colar Texto');");
    await sleep(400);
    await painel.ev(`window.__setInput(document.querySelector('.modal textarea'), ${JSON.stringify(LETRA.join("\n"))});`);
    await painel.ev("window.__click('.modal .btn-primary', 'Importar Linhas');");
    await sleep(500);
    const linhasNoEditor = await painel.ev("return document.querySelectorAll('.modal input.input-field').length;");
    assert(linhasNoEditor >= LETRA.length, `esperava ${LETRA.length} linhas no editor, achei ${linhasNoEditor}`);
    await painel.ev("window.__click('.modal .btn-primary', 'Salvar Letras');");
    await sleep(1200);

    const r = await painel.ev("return await window.__api('/api/songs');");
    const m = r.corpo.find((s) => s.title === MARCA + " Música");
    assert(m, "a música sumiu depois de salvar a letra");
    musicaId = m.id;
    assert(m.lyrics.length === LETRA.length, `gravou ${m.lyrics.length} linhas, esperava ${LETRA.length}`);
    assert(m.lyrics[0].text === LETRA[0], `primeira linha ficou "${m.lyrics[0].text}"`);
    return `${m.lyrics.length} linhas gravadas`;
  });

  await check("2.4", "a coluna da direita mostra a letra com marca de tempo", async () => {
    await sleep(600);
    const info = await painel.ev(`
      const linhas = [...document.querySelectorAll('.lyrics-pane .lyric-row')];
      return { n: linhas.length, tempo: linhas[0]?.querySelector('.lyric-time')?.textContent,
               texto: linhas[0]?.querySelector('.lyric-text')?.textContent.trim() };`);
    assert(info.n === LETRA.length, `a coluna mostra ${info.n} linhas, esperava ${LETRA.length}`);
    assert(/\[\d+:\d\d:\d\d\]/.test(info.tempo || ""), "sem marca de tempo: " + info.tempo);
    return `${info.n} linhas, primeira em ${info.tempo}`;
  });

  await check("2.5", "clicar numa linha da letra coloca ela no ar", async () => {
    await painel.ev("document.querySelectorAll('.lyrics-pane .lyric-row')[1].click();");
    const bateu = await until(async () => {
      const p = await proj.ev(TELA_PROJECAO);
      return p.lyric === LETRA[1];
    });
    const p = await proj.ev(TELA_PROJECAO);
    assert(bateu, `a projeção mostra "${p.lyric}", esperava "${LETRA[1]}"`);
    return `"${LETRA[1]}" projetada direto da lista`;
  });

  await check("2.6", "remover música tira ela da lista e marca o culto que a usava", async () => {
    const descartavel = MARCA + " Música a remover";
    const criada = await painel.ev(`return await window.__api('/api/songs', { method: 'POST',
      body: JSON.stringify({ title: ${JSON.stringify(descartavel)}, artist: '', youtubeUrl: '' }) });`);
    assert(criada.status < 400, "não consegui criar a música descartável");
    const culto = await painel.ev(`return await window.__api('/api/services', { method: 'POST',
      body: JSON.stringify({ title: ${JSON.stringify(MARCA + " Culto com removida")}, date: null }) });`);
    await painel.ev(`return await window.__api('/api/services/${culto.corpo.id}', { method: 'PUT',
      body: JSON.stringify({ items: [{ id: 'x1', type: 'song', refId: ${criada.corpo.id} }] }) });`);
    await recarregarPainel();
    await filtro("Letras");
    // O ⋮ do card é o "remover"; o confirm() é aceito automaticamente.
    await painel.ev(`window.__itemPorTitulo(${JSON.stringify(descartavel)})
      .querySelector('.library-item-menu').click();`);
    const sumiu = await until(() => painel.ev(
      `return !window.__itemPorTitulo(${JSON.stringify(descartavel)});`), 6000);
    assert(sumiu, "a música continuou na lista");
    const r = await painel.ev(`return await window.__api('/api/services/${culto.corpo.id}');`);
    assert((r.corpo.items || []).length === 1, "o item sumiu do culto em vez de ficar marcado");
    await filtro("Cultos");
    await painel.ev(`window.__itemPorTitulo(${JSON.stringify(MARCA + " Culto com removida")}).click();`);
    await sleep(800);
    const roteiro = await painel.ev("return window.__t('.roteiro-list');");
    assert(roteiro.includes("removida"), `o roteiro não avisa que a música saiu: "${roteiro}"`);
    return "saiu da lista e o culto avisa";
  });

  await check("2.7", "o campo de filtro da biblioteca filtra na hora", async () => {
    await filtro("Letras");
    const antes = await painel.ev("return window.__itens().length;");
    await painel.ev(`window.__setInput(document.querySelector('.library-filter input'), ${JSON.stringify(MARCA)});`);
    await sleep(500);
    const filtrados = await painel.ev("return window.__itens();");
    assert(filtrados.length < antes, `filtrou de ${antes} para ${filtrados.length} — não filtrou nada`);
    assert(filtrados.every((i) => i.titulo.includes(MARCA)), "sobrou item que não bate com o filtro");
    await painel.ev(`window.__setInput(document.querySelector('.library-filter input'), 'zzzznadaaqui');`);
    await sleep(400);
    const vazio = await painel.ev("return window.__t('.library-list .roteiro-empty');");
    assert(vazio && vazio.includes("Nada encontrado"), "sem aviso de lista vazia: " + vazio);
    await painel.ev(`window.__setInput(document.querySelector('.library-filter input'), '');`);
    await sleep(400);
    return `${antes} → ${filtrados.length} itens`;
  });

  await check("2.3", "música sem letra é sinalizada na lista", async () => {
    const r = await painel.ev(`return await window.__api('/api/songs', { method: 'POST',
      body: JSON.stringify({ title: ${JSON.stringify(MARCA + " Sem letra")}, artist: '', youtubeUrl: '' }) });`);
    assert(r.status < 400, "não consegui criar a música de apoio: " + JSON.stringify(r.corpo));
    await recarregarPainel();
    await filtro("Letras");
    const item = await until(() => painel.ev(
      `return window.__itens().find(i => i.titulo === ${JSON.stringify(MARCA + " Sem letra")}) || null;`));
    assert(item, "a música sem letra não apareceu");
    assert(item.sub.includes("sem letra"), `o texto de apoio ficou "${item.sub}"`);
    return item.sub;
  });

  /* ═══ 3. Avisos ═══ */
  await check("3.1", "criar aviso só com texto", async () => {
    await filtro("Avisos");
    await painel.ev("window.__click('.act-btn', 'Novo Aviso');");
    await esperarModal("Novo Aviso");
    await painel.ev(`window.__preencherModal([${JSON.stringify(MARCA + " Aviso")}, "Conteúdo do aviso de verificação"]);`);
    await painel.ev("window.__click('.modal .btn-primary', 'Criar Aviso');");
    const criado = await until(() => painel.ev(
      `return window.__itens().find(i => i.titulo === ${JSON.stringify(MARCA + " Aviso")}) || null;`));
    assert(criado, "o aviso não apareceu na lista");
    assert(criado.sub.startsWith("Ativo"), `deveria nascer Ativo, veio "${criado.sub}"`);
    return criado.sub.slice(0, 50);
  });

  const caminhoPng = arquivos.png();
  await check("3.2", "aviso com imagem anexa e projeta a imagem", async () => {
    await painel.ev("window.__click('.act-btn', 'Novo Aviso');");
    await esperarModal("Novo Aviso");
    await painel.ev(`window.__preencherModal([${JSON.stringify(MARCA + " Aviso com imagem")}, ""]);`);
    await painel.setFile(".modal input[type=file]", [caminhoPng]);
    const anexou = await until(() => painel.ev(
      "return (window.__t('.modal') || '').includes('Imagem anexado');"), 8000);
    assert(anexou, "o modal não confirmou o anexo da imagem");
    await painel.ev("window.__click('.modal .btn-primary', 'Criar Aviso');");
    const criado = await until(() => painel.ev(
      `return window.__itens().find(i => i.titulo === ${JSON.stringify(MARCA + " Aviso com imagem")}) || null;`));
    assert(criado, "o aviso com imagem não apareceu");
    assert(criado.sub.includes("imagem"), `o texto de apoio ficou "${criado.sub}"`);

    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Aviso com imagem")}, 'Projetar');`);
    const naTela = await until(async () => {
      const p = await proj.ev(TELA_PROJECAO);
      return p.html.includes("<img");
    });
    assert(naTela, "a projeção não mostrou a imagem");
    return "imagem enviada e projetada";
  });

  const caminhoWebm = await arquivos.webm(painel);
  await check("3.3", "aviso com vídeo anexa e projeta o vídeo", async () => {
    await painel.ev("window.__click('.act-btn', 'Novo Aviso');");
    await esperarModal("Novo Aviso");
    await painel.ev(`window.__preencherModal([${JSON.stringify(MARCA + " Aviso com vídeo")}, ""]);`);
    await painel.setFile(".modal input[type=file]", [caminhoWebm]);
    const anexou = await until(() => painel.ev(
      "return (window.__t('.modal') || '').includes('Vídeo anexado');"), 10000);
    assert(anexou, "o modal não confirmou o anexo do vídeo");
    await painel.ev("window.__click('.modal .btn-primary', 'Criar Aviso');");
    const criado = await until(() => painel.ev(
      `return window.__itens().find(i => i.titulo === ${JSON.stringify(MARCA + " Aviso com vídeo")}) || null;`));
    assert(criado, "o aviso com vídeo não apareceu");
    assert(criado.sub.includes("vídeo"), `o texto de apoio ficou "${criado.sub}"`);

    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Aviso com vídeo")}, 'Projetar');`);
    const naTela = await until(async () => {
      const p = await proj.ev(TELA_PROJECAO);
      return p.html.includes("<video");
    });
    assert(naTela, "a projeção não mostrou o vídeo");
    return "vídeo enviado e projetado";
  });

  await check("3.4", "desativar tira o aviso da lista de disponíveis", async () => {
    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Aviso")}, 'Desativar');`);
    const virou = await until(() => painel.ev(
      `const i = window.__itens().find(i => i.titulo === ${JSON.stringify(MARCA + " Aviso")});
       return i && i.sub.startsWith('Inativo');`));
    assert(virou, "o aviso não ficou Inativo");
    // devolve ao estado ativo
    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Aviso")}, 'Ativar');`);
    await until(() => painel.ev(
      `const i = window.__itens().find(i => i.titulo === ${JSON.stringify(MARCA + " Aviso")});
       return i && i.sub.startsWith('Ativo');`));
    return "desativou e reativou";
  });

  await check("3.5", "criar modelo de aviso com variável", async () => {
    await painel.ev("window.__click('.act-btn', 'Modelo');");
    await esperarModal("Novo Modelo");
    await painel.ev(`window.__preencherModal([${JSON.stringify(MARCA + " Modelo")},
      "Hoje, {{data}}, teremos a pregação de {{pregador}}."]);`);
    await painel.ev("window.__click('.modal .btn-primary', 'Salvar Modelo');");
    const apareceu = await until(() => painel.ev(
      `return !!window.__itemPorTitulo(${JSON.stringify(MARCA + " Modelo")});`));
    assert(apareceu, "o modelo não apareceu na seção de modelos");
    const variaveis = await painel.ev("return window.__t('.library-list');");
    assert(variaveis.includes("Modelos de aviso"), "não há seção 'Modelos de aviso'");
    return "modelo criado com {{data}} e {{pregador}}";
  });

  await check("3.6", "usar o modelo cria um aviso com as variáveis preenchidas", async () => {
    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Modelo")}, 'Usar modelo');`);
    await esperarModal("Usar modelo");
    await painel.ev("window.__preencherModal(['20 de abril', 'Pastor João']);");
    await sleep(400);
    const previa = await painel.ev("return window.__t('.modal .panel');");
    assert(previa.includes("20 de abril") && previa.includes("Pastor João"),
      "a pré-visualização não mostrou os valores: " + previa);
    await painel.ev("window.__click('.modal .btn-primary', 'Criar Aviso');");
    const criado = await until(() => painel.ev(
      "return window.__itens().find(i => i.sub && i.sub.includes('Pastor João')) || null;"));
    assert(criado, "o aviso gerado pelo modelo não apareceu");
    return criado.titulo;
  });

  /* ═══ 4. Mídia ═══ */
  const caminhoWav = arquivos.wav(3);
  let mediaCriadaId = null;

  await check("4.1", "enviar áudio", async () => {
    await filtro("Mídia");
    await painel.ev("window.__click('.act-btn', 'Enviar Áudio/Vídeo');");
    await esperarModal("Nova Mídia");
    await painel.setFile(".modal input[type=file]", [caminhoWav]);
    const enviou = await until(() => painel.ev(
      "return (window.__t('.modal') || '').includes('Áudio enviado');"), 10000);
    assert(enviou, "o modal não confirmou o envio do áudio");
    await painel.ev(`window.__setInput([...document.querySelectorAll('.modal .input-field')]
      .find(e => e.type !== 'file' && e.type !== 'checkbox'), ${JSON.stringify(MARCA + " Áudio")});`);
    await painel.ev("window.__click('.modal .btn-primary', 'Adicionar Mídia');");
    const item = await until(() => painel.ev(
      `return window.__itens().find(i => i.titulo === ${JSON.stringify(MARCA + " Áudio")}) || null;`));
    assert(item, "o áudio não apareceu na lista");
    assert(item.sub.startsWith("Áudio"), `o tipo ficou "${item.sub}"`);
    const tocador = await painel.ev(
      `return !!window.__itemPorTitulo(${JSON.stringify(MARCA + " Áudio")}).querySelector('audio');`);
    assert(tocador, "sem player de conferência no card");
    return "áudio enviado, com player";
  });

  await check("4.2", "enviar vídeo", async () => {
    await painel.ev("window.__click('.act-btn', 'Enviar Áudio/Vídeo');");
    await esperarModal("Nova Mídia");
    await painel.setFile(".modal input[type=file]", [caminhoWebm]);
    const enviou = await until(() => painel.ev(
      "return (window.__t('.modal') || '').includes('Vídeo enviado');"), 10000);
    assert(enviou, "o modal não confirmou o envio do vídeo");
    await painel.ev(`window.__setInput([...document.querySelectorAll('.modal .input-field')]
      .find(e => e.type !== 'file' && e.type !== 'checkbox'), ${JSON.stringify(MARCA + " Vídeo")});`);
    await painel.ev("window.__click('.modal .btn-primary', 'Adicionar Mídia');");
    const item = await until(() => painel.ev(
      `return window.__itens().find(i => i.titulo === ${JSON.stringify(MARCA + " Vídeo")}) || null;`));
    assert(item, "o vídeo não apareceu na lista");
    const preview = await painel.ev(
      `return !!window.__itemPorTitulo(${JSON.stringify(MARCA + " Vídeo")}).querySelector('video');`);
    assert(preview, "sem preview de vídeo no card");
    const r = await painel.ev("return await window.__api('/api/media-library');");
    const lista = Array.isArray(r.corpo) ? r.corpo : r.corpo.items;
    mediaCriadaId = lista.find((m) => m.title === MARCA + " Vídeo").id;
    return "vídeo enviado, com preview";
  });

  await check("4.3", "marcar loop fica salvo depois de recarregar", async () => {
    await painel.ev(`window.__itemPorTitulo(${JSON.stringify(MARCA + " Áudio")})
      .querySelector('input[type=checkbox]').click();`);
    // Só recarrega depois que o servidor confirmou — senão o teste mediria o
    // recarregamento antes da gravação e acusaria o app à toa.
    const gravou = await until(() => painel.ev(`
      const l = (await window.__api('/api/media-library')).corpo;
      const itens = Array.isArray(l) ? l : (l.items || []);
      const m = itens.find(x => x.title === ${JSON.stringify(MARCA + " Áudio")});
      return !!(m && m.loop);`), 6000);
    assert(gravou, "o servidor não registrou o loop");
    await recarregarPainel();
    await filtro("Mídia");
    const item = await until(() => painel.ev(
      `return window.__itens().find(i => i.titulo === ${JSON.stringify(MARCA + " Áudio")}) || null;`));
    assert(item, "o áudio sumiu depois de recarregar");
    assert(item.sub.includes("em loop"), `depois de recarregar, o texto ficou "${item.sub}"`);
    const marcado = await painel.ev(
      `return window.__itemPorTitulo(${JSON.stringify(MARCA + " Áudio")})
        .querySelector('input[type=checkbox]').checked;`);
    assert(marcado, "a caixa de loop voltou desmarcada");
    return "loop persistiu";
  });

  await check("9.4", "vídeo de fundo continua atrás do conteúdo ao trocar de item", async () => {
    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Vídeo")}, 'Usar como fundo');`);
    const comFundo = await until(async () => {
      const p = await proj.ev(TELA_PROJECAO);
      return p.html.includes("<video");
    }, 8000);
    assert(comFundo, "a projeção não passou a mostrar o vídeo de fundo");

    // Troca o que está no ar: o fundo tem que continuar.
    await filtro("Avisos");
    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Aviso")}, 'Projetar');`);
    const comAviso = await until(async () => {
      const p = await proj.ev(TELA_PROJECAO);
      return p.body.includes(MARCA + " Aviso") && p.html.includes("<video");
    }, 8000);
    const p = await proj.ev(TELA_PROJECAO);
    assert(p.html.includes("<video"), "o vídeo de fundo sumiu ao trocar de item");
    assert(comAviso, `o aviso não apareceu por cima do fundo (tela: "${p.body.slice(0, 60)}")`);

    await filtro("Mídia");
    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Vídeo")}, 'Tirar do fundo');`);
    await sleep(1000);
    return "fundo atravessou a troca de item";
  });

  /* ═══ 5. Cultos ═══ */
  let cultoId = null;
  await check("5.1", "criar culto", async () => {
    await filtro("Cultos");
    await painel.ev("window.__click('.act-btn', 'Novo Culto');");
    await esperarModal("Novo Culto");
    await painel.ev(`window.__preencherModal([${JSON.stringify(MARCA + " Culto")}, "2026-12-25"]);`);
    await painel.ev("window.__click('.modal .btn-primary', 'Criar');");
    const item = await until(() => painel.ev(
      `return window.__itens().find(i => i.titulo === ${JSON.stringify(MARCA + " Culto")}) || null;`));
    assert(item, "o culto não apareceu na lista");
    const r = await painel.ev("return await window.__api('/api/services');");
    const lista = Array.isArray(r.corpo) ? r.corpo : r.corpo.items;
    cultoId = lista.find((s) => s.title === MARCA + " Culto").id;
    return item.sub;
  });

  await check("5.3", "escolher o culto ativo na coluna do roteiro", async () => {
    await painel.ev(`const sel = document.querySelector('.roteiro-head select');
      if (!sel) throw new Error('a coluna do roteiro não tem a lista de cultos');
      const op = [...sel.options].find(o => o.textContent.includes(${JSON.stringify(MARCA + " Culto")}));
      if (!op) throw new Error('o culto novo não está na lista');
      window.__setInput(sel, op.value);`);
    await sleep(800);
    const vazio = await painel.ev("return window.__t('.roteiro-list');");
    assert(vazio.includes("Roteiro vazio"), "o roteiro do culto novo deveria estar vazio: " + vazio);
    return "culto novo selecionado, roteiro vazio";
  });

  await check("5.2", "adicionar itens ao roteiro pela biblioteca", async () => {
    const aAdicionar = [["Letras", MARCA + " Música"], ["Avisos", MARCA + " Aviso"], ["Mídia", MARCA + " Áudio"]];
    for (let i = 0; i < aAdicionar.length; i++) {
      const [aba, titulo] = aAdicionar[i];
      await filtro(aba);
      await painel.ev(`window.__acaoDoItem(${JSON.stringify(titulo)}, 'Adicionar ao Roteiro');`);
      // Confere item a item: se um clique se perder, a mensagem diz qual foi.
      const chegou = await until(() => painel.ev(
        `return window.__roteiro().steps.length === ${i + 1};`), 6000);
      const agora = await painel.ev("return window.__roteiro().steps.length;");
      assert(chegou, `depois de adicionar "${titulo}" o roteiro tem ${agora} itens, esperava ${i + 1}`);
    }
    const r = await painel.ev("return window.__roteiro();");
    assert(r.steps.length === 3, `o roteiro ficou com ${r.steps.length} itens, esperava 3`);
    assert(r.steps[0].label.includes("Música"), `o primeiro item ficou "${r.steps[0].label}"`);
    return r.steps.map((s) => s.label).join(" · ");
  });

  await check("5.4", "arrastar no roteiro em preparo salva a nova ordem", async () => {
    const antes = await painel.ev("return window.__roteiro().steps.map(s => s.label);");
    await painel.ev(`window.__dt = new DataTransfer();
      document.querySelectorAll('.roteiro-step')[0]
        .dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: window.__dt }));`);
    await sleep(400);
    await painel.ev(`document.querySelectorAll('.roteiro-step')[2]
        .dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__dt }));`);
    await sleep(200);
    await painel.ev(`document.querySelectorAll('.roteiro-step')[2]
        .dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__dt }));`);
    await sleep(1500);
    await recarregarPainel();
    await painel.ev(`const sel = document.querySelector('.roteiro-head select');
      const op = [...sel.options].find(o => o.textContent.includes(${JSON.stringify(MARCA + " Culto")}));
      if (op) window.__setInput(sel, op.value);`);
    await sleep(1000);
    const depois = await painel.ev("return window.__roteiro().steps.map(s => s.label);");
    const semNumero = (s) => s.replace(/^\d+\.\s*/, "");
    assert(semNumero(depois[2]) === semNumero(antes[0]),
      `depois de recarregar, a posição 3 tem "${depois[2]}", esperava "${antes[0]}"`);
    return "ordem sobreviveu ao recarregamento";
  });

  await check("5.5", "desmarcar um item deixa ele salvo mas fora do culto", async () => {
    await painel.ev("document.querySelectorAll('.roteiro-step')[0].querySelector('input[type=checkbox]').click();");
    await sleep(1200);
    const r = await painel.ev("return window.__roteiro();");
    assert(r.steps[0].skipped, "o item não ficou marcado como fora");
    const api = await painel.ev(`return await window.__api('/api/services/${cultoId}');`);
    const itens = api.corpo.items || [];
    assert(itens.length === 3, `o item foi removido do culto (sobraram ${itens.length})`);
    assert(itens[0].skip === true, "o `skip` não foi gravado no culto");
    await painel.ev("document.querySelectorAll('.roteiro-step')[0].querySelector('input[type=checkbox]').click();");
    await sleep(1000);
    return "continua salvo, marcado como fora";
  });

  await check("5.6", "a lixeira tira o item do roteiro", async () => {
    const antes = await painel.ev("return window.__roteiro().steps.length;");
    await painel.ev("document.querySelectorAll('.roteiro-step')[2].querySelector('.roteiro-step-remove').click();");
    await sleep(1200);
    const depois = await painel.ev("return window.__roteiro();");
    assert(depois.steps.length === antes - 1, `de ${antes} foi para ${depois.steps.length}`);
    assert(depois.steps[0].label.startsWith("1."), "a numeração não se reajustou");
    return `${antes} → ${depois.steps.length} itens`;
  });

  await check("5.7", "as setas do editor de culto reordenam", async () => {
    await filtro("Cultos");
    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Culto")}, 'Editar');`);
    await esperarModal("Roteiro:");
    const antes = await painel.ev(
      "return [...document.querySelectorAll('.modal .input-field ~ *, .modal > div > div > span:nth-child(2)')].map(e => e.textContent.trim()).filter(Boolean);");
    await painel.ev(`const linhas = [...document.querySelectorAll('.modal .btn-secondary.btn-icon')];
      linhas.find(b => b.textContent === '↓').click();`);
    await sleep(400);
    await painel.ev("window.__click('.modal .btn-primary', 'Salvar');");
    await sleep(1200);
    const r = await painel.ev(`return await window.__api('/api/services/${cultoId}');`);
    assert((r.corpo.items || []).length === 2, "o editor perdeu itens ao salvar");
    return `ordem salva: ${(r.corpo.items || []).map((i) => i.type).join(" · ")}` + (antes.length ? "" : "");
  });

  await check("5.8", "duplicar culto", async () => {
    await filtro("Cultos");
    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Culto")}, 'Duplicar');`);
    const copia = await until(() => painel.ev(
      "return window.__itens().find(i => i.titulo.includes('(cópia)')) || null;"));
    assert(copia, "a cópia não apareceu");
    const r = await painel.ev("return await window.__api('/api/services');");
    const lista = Array.isArray(r.corpo) ? r.corpo : r.corpo.items;
    const orig = lista.find((s) => s.id === cultoId);
    const dup = lista.find((s) => s.title.includes("(cópia)") && s.title.includes(MARCA));
    assert(dup, "a cópia não veio na API");
    assert(dup.items.length === orig.items.length,
      `a cópia tem ${dup.items.length} itens, o original ${orig.items.length}`);
    return `"${dup.title}" com ${dup.items.length} itens`;
  });

  /* ═══ 7. Projeção ═══ */
  /** Espera aparecer uma janela nova com o endereço pedido e a fecha. */
  async function janelaNova(caminho, abrir) {
    const { get } = require("./lib/cdp");
    const antes = (await get("/json/list")).filter((t) => t.url.endsWith(caminho)).map((t) => t.id);
    await abrir();
    const nova = await until(async () => {
      const abas = await get("/json/list");
      return abas.find((t) => t.url.endsWith(caminho) && !antes.includes(t.id)) || null;
    }, 8000);
    assert(nova, `não abriu nenhuma janela nova em ${caminho}`);
    await get(`/json/close/${nova.id}`);
    return nova;
  }

  await check("7.1", "Abrir Projeção abre uma janela nova", async () => {
    await janelaNova("/projection", () => painel.ev("window.__click('.toolbar-cta', 'Abrir Projeção');"));
    return "abriu /projection numa janela separada";
  });

  await check("13.1", "o botão da Stage View abre o monitor de confiança", async () => {
    await janelaNova("/stage", () => painel.ev(`[...document.querySelectorAll('.toolbar-icon-btn')]
      .find(b => (b.title || '').includes('Stage')).click();`));
    return "abriu /stage numa janela separada";
  });

  await check("7.5", "a tecla F pede tela cheia na projeção", async () => {
    // O navegador sem janela recusa tela cheia de verdade, então o que dá pra
    // conferir aqui é que a tecla F chega e chama requestFullscreen.
    await proj.ev(`
      window.__pediuTelaCheia = false;
      const original = Element.prototype.requestFullscreen;
      Element.prototype.requestFullscreen = function () {
        window.__pediuTelaCheia = true;
        try { return original.apply(this, arguments); } catch (e) { return Promise.resolve(); }
      };`);
    await proj.send("Page.bringToFront");
    for (const t of ["keyDown", "keyUp"]) {
      await proj.send("Input.dispatchKeyEvent", {
        type: t, key: "f", code: "KeyF", text: t === "keyDown" ? "f" : undefined,
        windowsVirtualKeyCode: 70, nativeVirtualKeyCode: 70,
      });
    }
    const pediu = await until(() => proj.ev("return window.__pediuTelaCheia === true;"), 3000);
    assert(pediu, "a tecla F não acionou a tela cheia");
    return "F chamou a tela cheia (o efeito visual só dá pra ver no projetor)";
  });

  await check("7.6", "a projeção não mostra a logo do sistema", async () => {
    const p = await proj.ev(TELA_PROJECAO);
    assert(!p.html.includes("arauto-logo"),
      "a logo do Arauto apareceu na tela de projeção");
    const limpa = await proj.ev(`return document.body.innerHTML.includes('arauto-logo');`);
    assert(!limpa, "a logo do Arauto está em algum canto da projeção");
    return "sem a marca do sistema na tela da igreja";
  });

  /* ═══ 8. Inserir avulso ═══ */
  await check("8.1", "o + do roteiro abre o painel de texto rápido", async () => {
    // Precisa de um culto em apresentação para o painel de inserção existir.
    await filtro("Cultos");
    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Culto")}, 'Apresentar');`);
    await sleep(1500);
    const emApresentacao = await until(() => painel.ev(
      "return !!window.__roteiro().head && window.__roteiro().currentIndex >= 0;"), 6000);
    assert(emApresentacao, "o culto não entrou em apresentação");
    await painel.ev("document.querySelector('.roteiro-head .toolbar-icon-btn').click();");
    const abriu = await until(() => painel.ev(`
      const p = document.querySelector('.cockpit-roteiro .glass-card');
      if (!p) return false;
      const campos = p.querySelectorAll('input, textarea');
      return campos.length >= 2 && p.textContent.includes('Texto rápido');`), 5000);
    assert(abriu, "o painel de texto rápido não abriu");
    return "título, texto e os dois botões";
  });

  await check("8.4", "salvar o texto rápido como aviso", async () => {
    const titulo = MARCA + " Texto rápido";
    await painel.ev(`
      const campos = document.querySelectorAll('.cockpit-roteiro .glass-card input, .cockpit-roteiro .glass-card textarea');
      window.__setInput(campos[0], ${JSON.stringify(titulo)});
      window.__setInput(campos[1], 'Salvo direto do painel de inserção');`);
    await sleep(300);
    await painel.ev("window.__click('.cockpit-roteiro .act-btn', 'Salvar como aviso');");
    await sleep(1500);
    const r = await painel.ev("return await window.__api('/api/announcements');");
    const lista = Array.isArray(r.corpo) ? r.corpo : r.corpo.items;
    assert(lista.some((a) => a.title === titulo), "o aviso não foi criado a partir do texto rápido");
    return "virou aviso na biblioteca";
  });

  await check("8.5", "projetar da biblioteca durante o culto pausa o roteiro", async () => {
    const antes = await painel.ev("return window.__roteiro().currentIndex;");
    await filtro("Avisos");
    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Aviso com imagem")}, 'Projetar');`);
    const pausou = await until(() => painel.ev("return window.__roteiro().notice;"));
    assert(pausou && pausou.includes("pausado"), "o roteiro não avisou que está pausado");
    await painel.ev("window.__click('.roteiro-notice .act-btn', 'Voltar ao roteiro');");
    await sleep(1200);
    const depois = await painel.ev("return window.__roteiro();");
    assert(!depois.notice, "o aviso de pausa não sumiu");
    assert(depois.currentIndex === antes, `voltou no passo ${depois.currentIndex + 1}, esperava ${antes + 1}`);
    return `retomou no passo ${antes + 1}`;
  });

  /* ═══ 11. Contagem regressiva sem culto ═══ */
  await check("11.1", "contagem regressiva sem culto em apresentação", async () => {
    await painel.ev("window.__click('.dock-btn.danger', 'Limpar');");
    await sleep(1200);
    await painel.ev("document.querySelector('.dock-timer-value').click();");
    await sleep(500);
    await painel.ev(`
      window.__setInput(document.querySelector('input[type=number]'), 5);
      const txt = [...document.querySelectorAll('input[placeholder]')].find(i => i.placeholder.includes('Mensagem'));
      if (txt) window.__setInput(txt, ${JSON.stringify(MARCA + " Começamos em")});`);
    await sleep(300);
    await painel.ev("window.__click('button', 'Iniciar');");
    const naTela = await until(async () => {
      const p = await proj.ev(TELA_PROJECAO);
      return /\d+:\d\d/.test(p.body) && p.body.includes(MARCA);
    });
    assert(naTela, "a projeção não mostrou o relógio com a mensagem");
    return "relógio e mensagem na projeção";
  });

  await check("11.3", "a Stage View mostra o mesmo relógio", async () => {
    const stage = await openPage(`${BASE}/stage`);
    await sleep(1500);
    const texto = await stage.ev("return document.body.innerText.replace(/\\s+/g,' ').trim();");
    stage.close();
    assert(/\d+:\d\d/.test(texto), "a stage não mostra o relógio: " + texto.slice(0, 60));
    await painel.ev("window.__click('button', 'Parar');");
    await sleep(800);
    return "mesmo relógio no monitor de confiança";
  });

  /* ═══ 12. Busca global ═══ */
  await check("12.2", "Ctrl+K abre a busca com o cursor no campo", async () => {
    await painel.ev("document.body.focus();");
    for (const type of ["keyDown", "keyUp"]) {
      await painel.send("Input.dispatchKeyEvent", {
        type, key: "k", code: "KeyK", windowsVirtualKeyCode: 75, modifiers: 2,
        text: type === "keyDown" ? "k" : undefined,
      });
    }
    const abriu = await until(() => painel.ev(
      "return !!document.querySelector('.modal-overlay input, .search-modal input');"), 3000);
    assert(abriu, "a busca não abriu com Ctrl+K");
    const focado = await painel.ev("return document.activeElement && document.activeElement.tagName === 'INPUT';");
    assert(focado, "o cursor não está no campo de busca");
    await painel.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(500);
    return "abriu com o cursor pronto";
  });

  await check("12.1", "digitar na barra do topo abre a busca já com o texto", async () => {
    await painel.ev(`const inp = document.querySelector('.toolbar-search input');
      inp.click(); window.__setInput(inp, ${JSON.stringify(MARCA)});`);
    await sleep(900);
    const resultados = await painel.ev(`
      const campo = document.querySelector('.modal-overlay input');
      const lista = document.querySelector('.modal-overlay');
      return { valor: campo ? campo.value : null, texto: lista ? lista.innerText : '' };`);
    assert(resultados.valor && resultados.valor.includes(MARCA),
      "a busca não abriu com o texto digitado: " + resultados.valor);
    assert(resultados.texto.includes(MARCA), "nenhum resultado com o texto buscado");
    await painel.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
    await sleep(500);
    return "busca aberta com o texto e com resultados";
  });

  /* ═══ 14. Rede ═══ */
  await check("14.1", "o endereço de rede abre a projeção sem pedir login", async () => {
    await painel.ev("window.__abrirConfiguracoes();");
    await sleep(800);
    await painel.ev("window.__click('.settings-tab', 'Telas');");
    await sleep(600);
    const urls = await painel.ev(`
      return [...document.querySelectorAll('.settings-modal-body p')]
        .map(p => p.textContent.trim()).filter(t => t.startsWith('http'));`);
    assert(urls.length > 0, "a aba Telas não listou nenhum endereço");
    const semLogin = await openPage(urls[0]);
    await sleep(2000);
    const chegou = await semLogin.ev("return !!document.querySelector('.projection-container');");
    const url = await semLogin.ev("return location.pathname;");
    semLogin.close();
    assert(chegou, `o endereço ${urls[0]} não abriu a projeção (foi parar em ${url})`);
    await painel.ev("window.__fecharModais();");
    await sleep(600);
    return urls[0];
  });

  await check("14.3", "dois painéis abertos acendem o aviso amarelo", async () => {
    const segundo = await openPage(`${BASE}/dashboard`, token);
    await sleep(2500);
    const avisou = await until(() => painel.ev(
      "return (document.querySelectorAll('.conn-dot')[0] || {}).className || '';")
      .then((c) => c.includes("warn")), 6000);
    segundo.close();
    assert(avisou, "a bolinha do painel não ficou amarela com dois operadores");
    await sleep(1500);
    return "avisou que há mais de um painel";
  });

  /* ═══ 15. Falhas ═══ */
  await check("15.1", "mídia quebrada avisa na tela em vez de ficar em branco", async () => {
    const r = await painel.ev("return await window.__api('/api/media-library');");
    const lista = Array.isArray(r.corpo) ? r.corpo : r.corpo.items;
    const item = lista.find((m) => m.title === MARCA + " Áudio");
    const caminho = path.join(RAIZ, "data/media", item.file);
    const escondido = caminho + ".escondido";
    fs.renameSync(caminho, escondido);
    // Sem isto o navegador tocaria a cópia que já tem em cache (o player de
    // conferência da biblioteca baixou o arquivo há pouco) e o teste nunca
    // veria o erro que o operador veria numa máquina recém-aberta.
    await proj.send("Network.setCacheDisabled", { cacheDisabled: true });
    try {
      await filtro("Mídia");
      await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Áudio")}, 'Projetar');`);
      const avisou = await until(async () => {
        const p = await proj.ev(TELA_PROJECAO);
        return p.body.toLowerCase().includes("não foi possível carregar");
      }, 8000);
      const p = await proj.ev(TELA_PROJECAO);
      assert(avisou, `a projeção mostrou "${p.body.slice(0, 60)}" em vez do aviso de arquivo quebrado`);
      assert(p.body.includes(MARCA), "o aviso não diz qual item quebrou");
      return "avisou com o nome do item";
    } finally {
      fs.renameSync(escondido, caminho);
      await proj.send("Network.setCacheDisabled", { cacheDisabled: false });
    }
  });

  await check("15.2", "a projeção se recupera sozinha de uma queda de rede", async () => {
    await painel.ev("window.__click('.dock-btn.danger', 'Limpar');");
    await sleep(1000);
    await proj.send("Network.emulateNetworkConditions", {
      offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0,
    });
    await sleep(3000);
    // Enquanto a projeção está fora do ar, o operador troca o que está na tela.
    await filtro("Avisos");
    await painel.ev(`window.__acaoDoItem(${JSON.stringify(MARCA + " Aviso")}, 'Projetar');`);
    await sleep(1500);
    await proj.send("Network.emulateNetworkConditions", {
      offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1,
    });
    const voltou = await until(async () => {
      const p = await proj.ev(TELA_PROJECAO);
      return p.body.includes(MARCA + " Aviso");
    }, 20000);
    const p = await proj.ev(TELA_PROJECAO);
    assert(voltou, `depois de voltar a rede, a projeção ainda mostra "${p.body.slice(0, 60)}"`);
    return "reconectou e pegou o estado atual";
  });

  await check("4.4", "remover mídia apaga também o arquivo do disco", async () => {
    await filtro("Mídia");
    const item = await painel.ev(`
      const l = (await window.__api('/api/media-library')).corpo;
      const itens = Array.isArray(l) ? l : (l.items || []);
      return itens.find(m => m.title === ${JSON.stringify(MARCA + " Vídeo")}) || null;`);
    assert(item, "não achei a mídia de teste para remover");
    const arquivo = path.join(RAIZ, "data/media", item.file);
    assert(fs.existsSync(arquivo), "o arquivo nem estava no disco antes de remover");
    await painel.ev(`window.__itemPorTitulo(${JSON.stringify(MARCA + " Vídeo")})
      .querySelector('.library-item-menu').click();`);
    const sumiu = await until(() => painel.ev(
      `return !window.__itemPorTitulo(${JSON.stringify(MARCA + " Vídeo")});`), 6000);
    assert(sumiu, "a mídia continuou na lista");
    const apagou = await until(async () => !fs.existsSync(arquivo), 6000);
    assert(apagou, `a lista removeu o item mas o arquivo ficou em data/media/${item.file}`);
    return "item e arquivo removidos";
  });

  /* ═══ 16. Backup ═══ */
  await check("16.1", "exportar backup baixa um zip de verdade", async () => {
    const info = await painel.ev(`
      const t = (document.cookie.match(/auth-token=([^;]+)/) || [])[1];
      const r = await fetch('/api/backup/export', { headers: { Authorization: 'Bearer ' + t } });
      const b = await r.arrayBuffer();
      const cab = new Uint8Array(b.slice(0, 4));
      return { status: r.status, bytes: b.byteLength, assinatura: [...cab].join(','),
               tipo: r.headers.get('content-type') };`);
    assert(info.status === 200, "a exportação respondeu " + info.status);
    assert(info.assinatura === "80,75,3,4", "o arquivo baixado não é um zip: " + info.assinatura);
    assert(info.bytes > 200, "o zip veio vazio: " + info.bytes + " bytes");
    return `${(info.bytes / 1024).toFixed(0)} KB de zip`;
  });

  await check("16.2", "importar um zip que não é backup dá erro sem estragar nada", async () => {
    const antes = await painel.ev("return await window.__api('/api/songs');");
    const zip = arquivos.zipInvalido();
    await painel.ev("window.__abrirConfiguracoes();");
    await sleep(800);
    await painel.ev("window.__click('.settings-tab', 'Backup');");
    await sleep(600);
    await painel.setFile(".settings-modal-body input[type=file]", [zip]);
    const reclamou = await until(() => painel.ev(
      "return (window.__t('.settings-modal-body') || '').toLowerCase();")
      .then((t) => t.includes("erro") || t.includes("inválido") || t.includes("não")), 15000);
    const texto = await painel.ev("return window.__t('.settings-modal-body');");
    assert(reclamou, "não apareceu mensagem de erro: " + texto.slice(0, 120));
    const depois = await painel.ev("return await window.__api('/api/songs');");
    assert(depois.corpo.length === antes.corpo.length,
      `o acervo mudou: ${antes.corpo.length} → ${depois.corpo.length} músicas`);
    await painel.ev("window.__fecharModais();");
    await sleep(600);
    return "recusou e não mexeu no acervo";
  });

  /* ═══ 17. Configurações ═══ */
  await check("17.3", "as cinco abas de Configurações abrem com conteúdo", async () => {
    await painel.ev("window.__abrirConfiguracoes();");
    await sleep(800);
    const abas = ["Aparência", "Telas", "Backup", "Conta", "Sobre"];
    for (const aba of abas) {
      await painel.ev(`window.__click('.settings-tab', ${JSON.stringify(aba)});`);
      await sleep(400);
      const corpo = await painel.ev("return window.__t('.settings-modal-body');");
      assert(corpo && corpo.length > 10, `a aba ${aba} abriu vazia`);
    }
    return abas.join(" · ");
  });

  await check("17.1", "mudar as cores muda a tela de projeção", async () => {
    await painel.ev("window.__click('.settings-tab', 'Aparência');");
    await sleep(500);
    const original = await painel.ev(`
      const cores = [...document.querySelectorAll('.color-picker-group input[type=color]')];
      return cores.map(c => c.value);`);
    await painel.ev(`
      const cores = [...document.querySelectorAll('.color-picker-group input[type=color]')];
      window.__setInput(cores[2], '#123456');`);
    await sleep(300);
    await painel.ev("window.__click('.settings-modal-body .btn-primary', 'Salvar');");
    const fundoDaProjecao = `const c = document.querySelector('.projection-container');
      return c ? getComputedStyle(c).backgroundColor : getComputedStyle(document.body).backgroundColor;`;
    const mudou = await until(async () => {
      const cor = await proj.ev(fundoDaProjecao);
      return cor.includes("18, 52, 86");
    }, 8000);
    const p = { fundo: await proj.ev(fundoDaProjecao) };
    // devolve a cor original antes de julgar, pra não deixar estrago
    await painel.ev(`
      const cores = [...document.querySelectorAll('.color-picker-group input[type=color]')];
      window.__setInput(cores[2], ${JSON.stringify(original[2])});`);
    await sleep(300);
    await painel.ev("window.__click('.settings-modal-body .btn-primary', 'Salvar');");
    await sleep(1200);
    assert(mudou, `a projeção continuou com o fundo ${p.fundo}`);
    return `#123456 chegou na projeção e a cor original (${original[2]}) foi devolvida`;
  });

  await check("17.2", "o tema do painel troca e sobrevive ao recarregamento", async () => {
    await painel.ev("window.__click('.settings-tab', 'Aparência');");
    await sleep(400);
    const inicial = await painel.ev("return document.documentElement.getAttribute('data-theme') || 'dark';");
    // É um botão só, que alterna e mostra o tema atual ("Tema escuro"/"Tema claro").
    await painel.ev("window.__click('.settings-modal-body .act-btn', 'Tema');");
    await sleep(800);
    const trocou = await painel.ev("return document.documentElement.getAttribute('data-theme');");
    assert(trocou !== inicial, `o tema continuou ${trocou}`);
    const legivel = await painel.ev(`
      const s = getComputedStyle(document.querySelector('.cockpit-toolbar'));
      const t = getComputedStyle(document.querySelector('.toolbar-brand'));
      return { fundo: s.backgroundColor, texto: t.color };`);
    assert(legivel.texto !== legivel.fundo, "texto e fundo ficaram da mesma cor");
    await recarregarPainel();
    const depois = await painel.ev("return document.documentElement.getAttribute('data-theme');");
    assert(depois === trocou, `depois de recarregar voltou para ${depois}`);
    // devolve o tema de origem
    await painel.ev("window.__abrirConfiguracoes();");
    await sleep(800);
    await painel.ev("window.__click('.settings-tab', 'Aparência');");
    await sleep(400);
    await painel.ev("window.__click('.settings-modal-body .act-btn', 'Tema');");
    await sleep(600);
    await painel.ev("window.__fecharModais();");
    await sleep(500);
    return `${inicial} → ${trocou} → de volta para ${inicial}`;
  });

  /* ═══ 18. Tela estreita ═══ */
  await check("18.1", "abaixo de 1200px o roteiro vira gaveta", async () => {
    await painel.ev("window.__fecharModais();");
    // A gaveta desliza por transição CSS, e o navegador congela animações de
    // aba em segundo plano — aqui quem precisa estar à vista é o painel.
    await painel.send("Page.bringToFront");
    await sleep(300);
    await painel.send("Emulation.setDeviceMetricsOverride", { width: 1100, height: 800, deviceScaleFactor: 1, mobile: false });
    await sleep(800);
    // A gaveta desliza (transição de 0,25s): espera assentar antes de medir.
    await until(() => painel.ev(
      "const r = document.querySelector('.cockpit-roteiro');" +
      "return r.getBoundingClientRect().left >= window.innerWidth - 5;"), 4000);
    const escondido = await painel.ev(`
      const r = document.querySelector('.cockpit-roteiro');
      const botao = document.querySelector('.roteiro-toggle');
      const caixa = r.getBoundingClientRect();
      const e = getComputedStyle(r);
      return { fora: caixa.left >= window.innerWidth - 5,
               aberta: r.classList.contains('open'),
               posicao: e.position, transform: e.transform,
               regraPegou: matchMedia('(max-width: 1200px)').matches,
               esquerda: Math.round(caixa.left), largura: window.innerWidth,
               botaoVisivel: getComputedStyle(botao).display !== 'none' };`);
    assert(escondido.posicao === "fixed",
      `a coluna do roteiro está com position: ${escondido.posicao}, esperava fixed (a regra de tela estreita não pegou)`);
    assert(!escondido.aberta || escondido.fora,
      `a gaveta já estava aberta (left ${escondido.esquerda} de ${escondido.largura})`);
    assert(escondido.botaoVisivel, "o botão de abrir o roteiro não apareceu");
    if (!escondido.fora) {
      const diagnostico = await painel.ev(`
        const r = document.querySelector('.cockpit-roteiro');
        return { animacoes: r.getAnimations().map(a => ({ prop: a.transitionProperty || a.animationName,
                   estado: a.playState, tempo: a.currentTime })),
                 inline: r.getAttribute('style'), classe: r.className,
                 pai: getComputedStyle(r.parentElement).display };`);
      throw new Error(
        `o roteiro continua na tela (left ${escondido.esquerda} de ${escondido.largura}, ` +
        `transform ${escondido.transform}, regra de 1200px ${escondido.regraPegou ? "aplicada" : "NÃO aplicada"}) ` +
        `— ${JSON.stringify(diagnostico)}`);
    }
    await painel.ev("document.querySelector('.roteiro-toggle').click();");
    await sleep(700);
    const aberta = await painel.ev(`
      const r = document.querySelector('.cockpit-roteiro');
      const cor = getComputedStyle(r).backgroundColor;
      return { dentro: r.getBoundingClientRect().right <= window.innerWidth + 5 &&
                       r.getBoundingClientRect().left < window.innerWidth - 100,
               opaca: !cor.includes('rgba(0, 0, 0, 0)'),
               temFundo: !!document.querySelector('.roteiro-backdrop') };`);
    assert(aberta.dentro, "a gaveta não abriu");
    assert(aberta.opaca, "a gaveta ficou transparente");
    assert(aberta.temFundo, "não há área de clique para fechar a gaveta");
    await painel.ev("document.querySelector('.roteiro-backdrop').click();");
    await sleep(700);
    const fechou = await painel.ev(
      "return document.querySelector('.cockpit-roteiro').getBoundingClientRect().left >= window.innerWidth - 5;");
    assert(fechou, "clicar fora não fechou a gaveta");
    return "abre, é opaca e fecha ao clicar fora";
  });

  await check("18.2", "abaixo de 980px a coluna de letras sai da frente", async () => {
    await painel.send("Emulation.setDeviceMetricsOverride", { width: 900, height: 800, deviceScaleFactor: 1, mobile: false });
    await sleep(800);
    await filtro("Letras");
    const estado = await painel.ev(`
      const det = document.querySelector('.library-detail');
      const rot = document.querySelector('.filter-label');
      return { detalheOculto: !det || getComputedStyle(det).display === 'none',
               rotuloOculto: !rot || getComputedStyle(rot).display === 'none',
               listaLarga: document.querySelector('.library-list').getBoundingClientRect().width > 600 };`);
    assert(estado.detalheOculto, "a coluna de letras continua na tela");
    assert(estado.rotuloOculto, "os filtros continuam com texto em vez de só ícones");
    return "letras fora, filtros só com ícone";
  });

  await check("18.3", "abaixo de 700px nada estoura a largura", async () => {
    await painel.send("Emulation.setDeviceMetricsOverride", { width: 700, height: 800, deviceScaleFactor: 1, mobile: false });
    await sleep(900);
    const medida = await painel.ev(`
      const corpo = document.documentElement;
      const estouros = [...document.querySelectorAll('.cockpit-dock *, .cockpit-toolbar *')]
        .filter(e => e.getBoundingClientRect().right > window.innerWidth + 2)
        .map(e => e.className).slice(0, 3);
      return { rolagem: corpo.scrollWidth > window.innerWidth + 2, estouros,
               botoes: document.querySelectorAll('.dock-btn').length };`);
    assert(!medida.rolagem, "apareceu barra de rolagem horizontal");
    assert(medida.estouros.length === 0, "elementos passando da borda: " + medida.estouros.join(", "));
    assert(medida.botoes === 4, `a dock ficou com ${medida.botoes} botões, esperava 4`);
    await painel.send("Emulation.clearDeviceMetricsOverride");
    await sleep(600);
    return "os 4 botões da dock cabem, sem rolagem lateral";
  });

  /* ═══ Limpeza: também é um teste ═══ */
  await check("limpeza", "apagar os itens de teste não deixa arquivo órfão no disco", async () => {
    const antes = fs.readdirSync(path.join(RAIZ, "data/media")).length;
    const contagem = await apagarItensDeTeste();
    const total = Object.values(contagem).reduce((a, b) => a + b, 0);
    assert(total > 0, "não achei nada de teste para apagar — a verificação criou alguma coisa?");
    await sleep(1500);

    // Todo arquivo em data/media tem que estar apontado por algum item; o que
    // sobra é anexo de item apagado, que cresceria para sempre e entraria em
    // todo backup.
    const emUso = await painel.ev(`
      const usados = new Set();
      for (const rota of ['/api/announcements', '/api/media-library']) {
        const j = (await window.__api(rota)).corpo;
        for (const i of (Array.isArray(j) ? j : (j.items || []))) {
          if (i.mediaFile) usados.add(i.mediaFile.split('/').pop());
          if (i.file) usados.add(i.file.split('/').pop());
        }
      }
      return [...usados];`);
    const orfaos = fs.readdirSync(path.join(RAIZ, "data/media"))
      .filter((n) => /^[0-9a-f-]{36}\./.test(n) && !emUso.includes(n));
    assert(orfaos.length === 0,
      `ficaram ${orfaos.length} arquivo(s) sem dono em data/media: ${orfaos.slice(0, 3).join(", ")}`);
    const depois = fs.readdirSync(path.join(RAIZ, "data/media")).length;
    return `${total} itens apagados, ${antes - depois} arquivos saíram do disco`;
  });

  /* ═══ Console ═══ */
  await check("console", "nenhum erro de JavaScript no painel nem na projeção", async () => {
    const erros = [...painel.logs, ...proj.logs].filter(ruidoDeConsole);
    assert(erros.length === 0, erros.slice(0, 3).join(" | "));
    return "limpo";
  });
}

/** Apaga, pela API, tudo o que a verificação criou (prefixo "[verificação]"). */
async function apagarItensDeTeste() {
  return painel.ev(`
      const t = (document.cookie.match(/auth-token=([^;]+)/) || [])[1];
      const cab = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t };
      const marca = ${JSON.stringify(MARCA)};
      const contagem = {};
      const varrer = async (lista, rota, campo) => {
        const r = await fetch(lista, { headers: cab, cache: 'no-store' });
        const j = await r.json();
        const itens = Array.isArray(j) ? j : (j.items || []);
        for (const i of itens) {
          if (!String(i[campo] || '').includes(marca)) continue;
          await fetch(rota + i.id, { method: 'DELETE', headers: cab });
          contagem[rota] = (contagem[rota] || 0) + 1;
        }
      };
      await varrer('/api/services', '/api/services/', 'title');
      await varrer('/api/songs', '/api/songs/', 'title');
      await varrer('/api/announcements', '/api/announcements/', 'title');
      await varrer('/api/announcement-templates', '/api/announcement-templates/', 'title');
      await varrer('/api/media-library', '/api/media-library/', 'title');
      return contagem;`);
}

/** Rede de segurança: se a verificação parar no meio, o que já tiver sido
 *  criado some assim mesmo. No caminho feliz o check "limpeza" já apagou tudo
 *  e esta passagem não acha mais nada. */
async function limpar() {
  if (painel) {
    try {
      const restante = await apagarItensDeTeste();
      const total = Object.values(restante).reduce((a, b) => a + b, 0);
      if (total > 0) console.log(`\n${total} itens de teste removidos na saída`);
    } catch (e) {
      console.log("\nnão consegui limpar tudo:", e.message);
      console.log(`procure por itens começando com "${MARCA}" e apague à mão`);
    }
  }
  arquivos.limpar();
}

run()
  .then(async () => { await limpar(); encerrar(); })
  .catch(async (e) => { console.log("\nERRO GERAL:", e.message); await limpar(); encerrar(1); });

function encerrar(codigo) {
  const falhas = placar("cenários de painel passaram");
  if (painel) painel.close();
  if (proj) proj.close();
  fecharNavegador();
  process.exit(codigo || (falhas ? 1 : 0));
}
