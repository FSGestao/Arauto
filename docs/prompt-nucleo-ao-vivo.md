# Prompt — Núcleo de Compartilhamento de Informação ao Vivo do Arauto

> Documento de trabalho. Cole isto inteiro numa sessão (deste ou de outro assistente) como
> instrução de implementação, ou use como checklist de revisão de escopo.

## Status (atualizado — ver seção 2 pra detalhe de cada item)

✅ Feito: 2.1 busca instantânea (Ctrl+K) + edição de linha ao vivo, sem sair da apresentação
(corrige na tela na hora e grava na biblioteca) · 2.2 preview da projeção real antes de ir ao
ar + "salvar como aviso permanente" a partir do texto rápido · 2.3 Áudio/vídeo (player
dedicado, fundo de vídeo, fade, pré-carga) · 2.4 Roteiro kanban (indicador de posição,
"ocultar" em vez de "excluir", card de mídia) · 2.5 Stage View (`/stage`) · 2.6 Busca global
(Ctrl+K, cobre música/aviso/mídia) · 2.7 Indicador de telas conectadas (Projeção/Stage, tempo
real) · 2.9 Backup (exportar/importar `.zip` com um clique, validação + backup de segurança
automático) e fallback visual pra mídia quebrada/não encontrada (título + aviso, avança
sozinho depois de alguns segundos se fizer parte de um roteiro).

🎉 Todos os itens do núcleo de compartilhamento de informação ao vivo (seção 2) estão
implementados. Próximo passo natural: rodar o roteiro de validação da seção 4 com um
operador de verdade.

## 0. Contexto

O **Arauto** é um sistema de projeção para igrejas: um app desktop (Electron + Next.js,
dados em JSON local, sem nuvem) com um painel de operação e uma tela de projeção
sincronizadas por WebSocket, mais um site separado que só libera o download por
aprovação manual. Já existe: biblioteca de músicas/letras, avisos (texto/imagem/vídeo),
roteiro de culto reordenável em estilo kanban, inserção de conteúdo avulso durante a
apresentação, e um modo de apresentação com "no ar agora + a seguir".

O **Holyrics** (Lima Giran, ~10 anos de mercado, 2M+ downloads, grátis, Java/Swing) é o
concorrente direto real — mesmo público (igrejas brasileiras), mesmo idioma, mesmo preço
(zero). Ele ganha por **amplitude de recursos**, não por design: é uma interface acumulada
desde 2016. É a régua de funcionalidade; **não** é a régua de experiência.

**Esta rodada de trabalho tem um recorte deliberado:** o foco é exclusivamente o **núcleo
de compartilhamento de informação durante o culto** — o que precisa aparecer na tela
(visual) e o que precisa ser ouvido/assistido (áudio/vídeo) para o culto acontecer. Gestão
de equipe/escalas, atas, relatórios administrativos e módulos de planejamento **estão fora
de escopo aqui** — mesmo que o Holyrics os tenha, não entram nesta fase.

**O que "ser referência nessa área" significa, concretamente:** qualquer voluntário que já
usou Holyrics consegue abrir o Arauto pela primeira vez e, em menos de 5 minutos sem
tutorial, colocar uma letra e um aviso no ar — e a experiência de fazer isso parece de
2026, não de 2016.

---

## 1. Personas

Use estas personas para julgar toda decisão de UX deste núcleo. Quando um requisito
conflitar entre personas, a prioridade de desempate é: **Operador(a) > Congregação >
Organizador(a) > Músico(a) > Liderança**, porque é quem sustenta o culto ao vivo sob
pressão, na frente de todo mundo, sem poder travar.

### Ana — Operadora de mídia (persona primária; painel Admin, ao vivo)
Voluntária, escala roda toda semana, às vezes é a primeira vez dela operando. Não é de TI.
Durante o culto ela está sob pressão real: o pastor muda a ordem na hora, alguém pede pra
repetir uma música, um vídeo trava. Ela precisa fazer tudo **sem tirar o olho da tela nem
duas vezes seguidas** — cada ação a mais é um risco de atraso visível pra igreja inteira.
Medo dela: "branco na tela" — silêncio visual enquanto ela procura algo.

### Marcos — Organizador do roteiro (painel Admin, preparação durante a semana)
Monta o culto com antecedência: escolhe músicas, escreve/edita avisos, sobe imagens e
vídeos, monta a ordem. Trabalha sem pressa, mas se cansa de repetir trabalho — quer
reaproveitar letras e avisos já cadastrados, importar em lote, testar antes de aprovar.

### Rafael — Músico/vocalista no palco (consumidor da Stage View, ainda não existe no Arauto)
Está tocando ou cantando, de costas pra tela de projeção. Precisa saber a letra atual e a
próxima **sem virar o pescoço nem perder o contato visual com a igreja**. Não quer ver
menus, controles ou qualquer coisa que não seja "o que cantar agora e depois".

### Pastor João — Liderança (interjeição pontual, ad hoc)
Não opera o sistema no dia a dia, mas às vezes precisa que *algo* apareça na hora — um
versículo que citou de improviso, um recado urgente. Zero tolerância a esperar a Ana
navegar por menus; se demorar mais que alguns segundos, ele desiste e fala sem apoio visual.

### Congregação — Audiência (persona passiva, mas é quem julga o resultado)
Não usa o sistema, só vê o resultado na tela e ouve o áudio/vídeo. É intolerante a: texto
ilegível, corte abrupto de áudio, tela piscando, vídeo com aspecto errado, silêncio morto
entre um item e outro. Toda decisão visual final se valida contra esta persona.

---

## 2. Especificação por área funcional

Cada área lista: **persona dona**, **base (Holyrics)**, **o que fazer melhor no Arauto**,
**requisitos específicos**, **critério de pronto**.

### 2.1 Biblioteca de letras + exibição ao vivo
**Dona:** Ana (ao vivo) e Marcos (preparação).

**Base:** Holyrics guarda letras com tema por música, promete busca de conteúdo em ~3s,
permite editar em tempo real durante a apresentação.

**Fazer melhor:**
- Busca **instantânea** (filtro por título/artista/trecho de letra, sem "Enter", resultado
  a cada tecla) em vez de uma lista rolável — hoje o Arauto só tem lista.
- Edição da letra **ao vivo, sem interromper a projeção**: corrigir uma linha errada não
  pode exigir sair do modo apresentação.
- Fonte/tamanho de letra **legível a distância por padrão** (não depender do operador
  saber ajustar CSS) — definir uma régua de contraste e tamanho mínimo testada a 8-10
  metros de distância de uma TV/projetor comum.
- Transição entre linhas **sem flash de tela preta** (crossfade curto, já parcialmente
  implementado — garantir que nunca há 1 frame de fundo sozinho sem texto).

**Requisitos:**
- Campo de busca fixo e sempre visível na aba Músicas e no seletor de "inserir agora".
- Atalho de teclado pra focar a busca sem usar o mouse (ex.: `/` ou `Ctrl+K`).
- Edição inline de uma linha da letra a partir da própria lista do roteiro ao vivo (não só
  no editor de músicas da biblioteca).
- Aviso visual (já existe, manter) quando uma música está no roteiro sem letra cadastrada.

**Pronto quando:** Ana acha e coloca no ar qualquer música da biblioteca em menos de 3
segundos digitando, sem usar o mouse.

---

### 2.2 Avisos e mensagens (texto, imagem, vídeo)
**Dona:** Ana (ao vivo) e Pastor João (interjeição).

**Base:** Holyrics tem "Custom Messages" (mensagem avulsa em tela cheia) e fundo
animado atrás do texto.

**Fazer melhor:** já temos o essencial (painel "Inserir agora", upload de imagem/vídeo,
texto rápido tipo versículo). Faltam dois refinamentos de fluidez:
- **Modelos/rascunhos reaproveitáveis**: um aviso "avulso" digitado na hora (ex.: um
  recado do pastor) deveria poder ser salvo como aviso permanente com 1 clique, em vez
  de só existir naquele momento.
- **Pré-visualização antes de ir ao ar**: Ana deveria conseguir ver como o aviso vai
  aparecer (fonte, contraste, enquadramento de imagem) antes de clicar em mostrar —
  hoje ela só descobre olhando a tela de projeção depois.

**Requisitos:**
- Botão "Salvar como aviso" dentro do fluxo de texto rápido do painel "Inserir agora".
- Miniatura de preview (mesmo fundo/cor/fonte da projeção real) ao lado de cada aviso
  antes de colocá-lo no ar, tanto na lista quanto no modal de criação.
- Tempo entre clique e imagem/vídeo aparecer na tela: **sob 300ms** (perceptível como
  instantâneo).

**Pronto quando:** Pastor João pede um versículo de improviso e Ana consegue colocá-lo
na tela, digitado, em menos de 10 segundos, sem sair do modo apresentação.

---

### 2.3 Áudio e vídeo (mídia sonora e visual)
**Dona:** Ana (ao vivo).

**Base:** Holyrics tem player embutido compatível com VLC, plano de fundo animado em
vídeo atrás da letra, controle de volume.

**Fazer melhor:** esta é a maior lacuna real de hoje — o Arauto trata vídeo/imagem só como
"aviso", sem um player de mídia dedicado. Precisa de:
- **Player de áudio/vídeo com controles completos** na projeção: play/pause, volume,
  barra de progresso, e a capacidade de tocar um vídeo **por trás** da letra de uma música
  (background de vídeo), não só como aviso de tela cheia.
- **Fila de reprodução** simples: próximo áudio/vídeo já carregado e pronto, sem esperar
  o arquivo carregar na hora de trocar.
- **Fade de áudio** ao trocar de item (evitar corte seco que soa amador na caixa de som).
- Suporte confirmado aos formatos mais comuns que uma igreja vai ter à mão: mp4/webm
  (vídeo), mp3/wav/ogg (áudio) — hoje só mp4/webm/ogv de vídeo estão cobertos.

**Requisitos:**
- Novo tipo de item no roteiro: "Mídia" (áudio ou vídeo), distinto de "Aviso com mídia" —
  com controles de volume/loop/autoplay próprios, não emprestados do fluxo de aviso.
- Controle de volume acessível do painel Admin sem precisar mexer no sistema
  operacional.
- Pré-carregamento (`preload`) do próximo item de mídia da fila enquanto o atual ainda
  toca, pra troca instantânea.
- Indicador de progresso (barra de tempo) visível pra Ana no painel, não só na projeção.

**Pronto quando:** Ana troca de um vídeo de fundo tocando pra uma música com letra sem
nenhum corte de áudio perceptível nem tela preta entre os dois.

---

### 2.4 Roteiro (kanban) e navegação ao vivo
**Dona:** Ana (ao vivo) e Marcos (preparação).

**Base:** Holyrics tem playlist/agenda de culto linear, sem reordenar por
arrastar-e-soltar durante a apresentação.

**Já é ponto forte do Arauto** (implementado): cards kanban reordenáveis ao vivo, música
como card único (não uma letra por linha), pular/incluir sem apagar do culto salvo,
"a seguir" visível. Refinamentos que faltam:
- **Indicador de posição tipo "playhead"**: hoje só o card atual fica destacado; falta uma
  barra/linha de progresso ao lado da lista mostrando visualmente "quanto falta do culto"
  — importante quando o pastor pergunta "quanto tempo ainda temos".
- **Renomear "excluir passo" para "ocultar/pular passo"** — reduz a hesitação de clicar
  achando que vai apagar de verdade.
- Adicionar item de **mídia** (ver 2.3) como terceiro tipo de card no roteiro, ao lado de
  música e aviso.

**Requisitos:**
- Barra de progresso lateral (proporcional a passos concluídos/restantes) no painel de
  roteiro em apresentação.
- Trocar o texto/ícone do checkbox de "excluir" para "ocultar" em toda a UI.
- Cards de mídia seguem o mesmo padrão visual e de arrastar dos cards de música/aviso.

**Pronto quando:** um novo operador olha o roteiro em apresentação e entende, sem
explicação, quanto do culto já passou e quanto falta.

---

### 2.5 Tela de palco (Stage View) — módulo novo
**Dona:** Rafael (músico/vocalista).

**Base:** Holyrics tem "Painel de comunicação para monitores de retorno"; ProPresenter
tem Stage Display como tela física separada.

**Fazer melhor:** o Arauto já tem a arquitetura certa pra isso (WebSocket + rota própria),
só falta a terceira view. Ela deve ser radicalmente mais simples que a projeção pública:
- Fundo neutro de alto contraste (não precisa seguir a identidade visual da igreja).
- Só dois blocos: **linha atual** (grande) e **próxima linha** (menor, abaixo) — sem logo,
  sem "X de Y", sem qualquer controle.
- Acessível pela mesma URL de rede local que a projeção (ex.: `/stage`), pra abrir num
  tablet ou monitor no palco sem precisar instalar nada.
- Fonte ainda maior que a projeção pública (vista de mais perto, mas por cima do ombro/de
  lado, muitas vezes com luz de palco forte).

**Requisitos:**
- Nova rota `/stage`, sem autenticação (mesmo padrão da `/projection`), assinando o mesmo
  `state:update`.
- Reaproveita `currentLine`/`nextLyricLine` já calculados no servidor — não precisa de
  lógica nova no back-end, só uma nova página de exibição.
- Deve funcionar mesmo se a tela de projeção pública estiver mostrando outra coisa (ex.:
  um vídeo de fundo) — a Stage View sempre mostra letra/próxima linha quando há uma
  música tocando.

**Pronto quando:** Rafael abre `/stage` num tablet, apoia do lado do microfone, e consegue
ler a letra e a próxima linha sem virar a cabeça pra tela grande.

---

### 2.6 Busca global
**Dona:** Ana e Marcos.

**Base:** Holyrics promete achar qualquer conteúdo em ~3 segundos.

**Fazer melhor:** unificar num único campo de busca (não uma busca por aba) que cobre
música, aviso e (quando existir) texto bíblico — com atalho de teclado global,
acionável de qualquer tela do painel, não só dentro da aba onde o item mora.

**Requisitos:**
- Atalho global (`Ctrl+K` ou similar) abre um campo de busca sobreposto, de qualquer aba.
- Resultado tipado por categoria (🎵 música / 📢 aviso / 🎬 mídia), navegável por teclado
  (setas + Enter), com ação imediata: Enter no resultado já pergunta "colocar no ar?" ou
  "adicionar ao roteiro?" dependendo do contexto (ao vivo vs. editando um culto).

**Pronto quando:** de qualquer tela do painel, sem tirar a mão do teclado, Ana acha e
coloca uma música ou aviso específico no ar em menos de 5 segundos.

---

### 2.7 Distribuição em rede / múltiplas telas
**Dona:** Ana (setup) e Congregação (resultado).

**Já é ponto forte do Arauto**: acesso por navegador em qualquer PC da rede local sem
instalar app (diferencial real sobre o "Holyrics App" que exige instalação), múltiplos
monitores detectados automaticamente pelo Electron.

**Fazer melhor:**
- **Reconexão automática e silenciosa** se a tela de projeção perder o WebSocket
  (Wi-Fi cair um instante) — hoje precisa confirmar que reconecta sozinha sem deixar a
  tela congelada mostrando o último estado como se estivesse atualizado.
- Indicador discreto no painel Admin de **quantas telas estão conectadas agora** (projeção,
  stage, remoto) — Ana precisa saber se a tela do projetor realmente está recebendo antes
  de começar o culto.

**Requisitos:**
- Indicador de status de conexão (bolinha verde/cinza) por tipo de tela conectada, visível
  no painel Admin.
- Reconexão do socket com backoff automático; ao reconectar, a tela de projeção deve
  pedir o estado atual imediatamente (já existe: emite `state:update` na conexão —
  garantir que isso cobre reconexão, não só conexão inicial).

**Pronto quando:** Ana olha o painel antes do culto começar e sabe, sem perguntar a
ninguém, se o projetor está realmente recebendo o sinal.

---

### 2.8 Qualidade visual e de interação (o "mais moderno" pedido)
**Dona:** todas — este é o padrão transversal que diferencia o Arauto do Holyrics.

**Base (o que NÃO copiar):** Holyrics é Java Swing — janelas com chrome do sistema
operacional, sem animação, densidade de menu alta, curva de aprendizado real (daí o
tutorial extenso do site deles).

**Padrão a seguir no Arauto:**
- **Toda ação de estado muda com uma transição suave** (150-250ms), nunca um corte seco
  — já vale pra troca de linha de letra; estender pra troca de aba, abertura de modal,
  toggle de card no roteiro.
- **Nenhuma ação crítica exige mais de 2 cliques** a partir da tela de projeção/Ao vivo.
- **Feedback imediato de toda ação** — todo clique tem uma resposta visual em menos de
  100ms, mesmo que a ação de verdade (ex.: salvar) demore mais (usar estado otimista).
- **Densidade de informação controlada**: nunca mais de 2 zonas de tela simultâneas no
  modo apresentação (já decidido e documentado no Painel de Regência) — resistir à
  tentação de adicionar uma terceira coluna/menu conforme os recursos crescem.
- **Tudo arrastável que faz sentido ser arrastável** (roteiro já é; considerar mídia da
  fila também).

**Requisitos:**
- Auditoria de toda transição de estado do painel Admin e da projeção: nenhuma troca de
  conteúdo pode ser um corte instantâneo sem fade/transição.
- Toda ação destrutiva (remover, parar) pede confirmação; toda ação reversível (ocultar,
  pausar) não pede.
- Manter o tema escuro atual como padrão, mas não é bloqueante nesta fase adicionar
  alternância clara/escura — só não piorar o contraste em nenhum dos dois.

**Pronto quando:** alguém que usa Holyrics há anos abre o Arauto pela primeira vez e
comenta espontaneamente que "parece mais rápido" ou "mais bonito" sem que ninguém
precise apontar.

---

### 2.9 Confiabilidade e dados (a base que sustenta tudo acima)
**Dona:** Ana (nunca deve perceber isso acontecendo) e Marcos (backup).

**Base:** Holyrics oferece backup manual e sincronização opcional por Google Drive.

**Fazer melhor / garantir:**
- **Nunca uma tela em branco por erro** — todo estado que falta dado (música sem letra,
  aviso sem conteúdo, mídia que não carregou) cai num fallback visível (já existe pro caso
  de letra vazia — estender a mídia quebrada/não encontrada).
- **Exportar/importar a pasta de dados com um clique** nas Configurações (identificado
  no Painel de Regência como item barato e importante — implementar nesta rodada).
- **Funciona 100% offline** — nenhuma chamada de rede externa pode ser obrigatória
  durante o culto (já é o caso pela arquitetura local-first; validar que nada foi
  introduzido que quebre isso, ex. nenhuma fonte/imagem carregada de CDN externo na
  tela de projeção).

**Requisitos:**
- Botão "Exportar backup" (zip da pasta de dados) e "Importar backup" nas Configurações.
- Teste manual: desligar o Wi-Fi/rede externa do PC e confirmar que login local, roteiro,
  projeção e mídia local continuam funcionando normalmente.
- Todo `<img>`/`<video>`/fonte usado na tela de projeção e na Stage View precisa vir de
  arquivo local ou de fonte já embutida no build — nunca de URL externa carregada em
  tempo real.

**Pronto quando:** um teste de "arrancar o cabo de rede no meio do culto" não muda nada
que a congregação perceba.

---

## 3. Fora de escopo nesta rodada (não implementar agora)

- Escala de equipe/voluntários, quem serve em qual culto.
- Relatórios administrativos (músicas mais tocadas, frequência, atas).
- Módulo de Bíblia com traduções licenciadas (decisão já tomada: fase futura, começa por
  parceria de licenciamento, não por código — ver Painel de Regência).
- Automação avançada (API/JavaScript, MIDI, integrações com Telegram/OBS/NDI) — recurso
  de igreja grande com equipe técnica; fora do público-alvo (igrejas pequenas) por ora.
- Edição colaborativa em tempo real por múltiplas pessoas.

## 4. Como validar o resultado

Rodar este roteiro de teste manual, cronometrado, do início ao fim, com alguém que nunca
usou o Arauto antes (idealmente alguém que já usa Holyrics, pra comparação honesta):

1. Achar e colocar uma música no ar (meta: < 3s de busca).
2. Avançar pelas linhas da letra até o fim, depois pro próximo item do roteiro.
3. Interromper com um aviso avulso digitado na hora (meta: < 10s) e voltar ao roteiro.
4. Tocar um vídeo de fundo atrás de uma letra sem corte de áudio perceptível.
5. Arrastar dois cards do roteiro pra trocar a ordem, ao vivo, sem perder o passo atual.
6. Abrir a Stage View num segundo dispositivo e conferir que letra atual/próxima batem
   com o que está na tela de projeção.
7. Desconectar a rede externa e confirmar que nada quebra.
8. Exportar um backup e restaurá-lo num diretório de dados vazio.

Se as 8 etapas passam sem travar, sem tela em branco e sem precisar de ajuda, o núcleo
de compartilhamento de informação ao vivo do Arauto está pronto pra ser chamado de
referência nesta área.
