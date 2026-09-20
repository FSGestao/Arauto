"use client";

import { useState } from "react";
import { Icon } from "./Icon";

/* ═══════════════════════════════════════════════════════
   Manual de Uso Operacional — orientado a tarefas, cobrindo só o que existe
   de fato no sistema hoje (conferido no código, não presumido). Separado do
   OnboardingModal (resumo de 1 minuto): este é o material de referência pra
   voltar quando surge uma dúvida específica no meio da semana.
   ═══════════════════════════════════════════════════════ */

interface ManualTask {
  title: string;
  when?: string;
  steps: string[];
  result?: string;
  tips?: string[];
  issues?: string[];
  /** Nome do arquivo em public/tutoriais/ — um GIF curto mostrando onde a
   *  função fica, sempre a partir da tela inicial do painel. Opcional: só as
   *  tarefas de "onde encontrar algo" têm um; passo a passo de formulário
   *  (preencher campos, etc.) não precisa. */
  gif?: string;
}

interface ManualSection {
  id: string;
  title: string;
  icon: string;
  intro?: string;
  tasks: ManualTask[];
}

const MANUAL: ManualSection[] = [
  {
    id: "inicio",
    title: "Primeiros passos",
    icon: "play",
    tasks: [
      {
        title: "Entrar pela primeira vez",
        when: "Você acabou de abrir o Arauto neste computador pela primeira vez.",
        steps: [
          "Abra o Arauto.",
          "Como ainda não existe conta neste computador, a tela mostra \"Crie a conta local de administração deste computador\" em vez de login.",
          "Preencha Seu nome, E-mail e Senha (mínimo 6 caracteres).",
          "Clique em \"Criar conta e entrar\".",
        ],
        result: "Você entra direto no painel. Hoje o Arauto tem apenas uma conta de administração por computador, sem perfis diferentes (operador, líder etc.) — quem tem a senha tem acesso completo.",
        tips: ["Guarde o e-mail e a senha em um lugar seguro: não existe recuperação de senha por e-mail. Ter um backup exportado (Configurações > Backup) ajuda se precisar trocar de computador."],
      },
      {
        title: "Entrar (login) nas vezes seguintes",
        steps: [
          "Abra o Arauto.",
          "Informe o E-mail e a Senha cadastrados.",
          "Clique em \"Entrar\".",
        ],
        result: "O painel abre. A sessão fica salva por 30 dias neste navegador/app — não pede login de novo até expirar ou você sair pela opção \"Sair da conta\".",
      },
      {
        title: "Reconhecer as áreas do painel",
        steps: [
          "Barra de cima: logo, busca global, as 5 abas da biblioteca (Letras, Avisos, Mídia, Bíblia, Cultos), indicador de telas conectadas (Painel/Projeção/Palco), e os botões de Roteiro, Stage View, Configurações e \"Abrir Projeção\".",
          "Coluna da esquerda: a biblioteca — o conteúdo da aba selecionada.",
          "Coluna da direita: o Roteiro do Culto em preparo ou em apresentação.",
          "Rodapé: o que está \"No ar\" agora, os botões Anterior/Próximo, volume e o timer (contagem regressiva ou timer de palco).",
        ],
        result: "Você identifica onde preparar conteúdo (esquerda), onde organizar a ordem (direita) e onde controlar o que está sendo exibido agora (rodapé).",
      },
    ],
  },
  {
    id: "conceitos",
    title: "Conhecendo o sistema",
    icon: "sliders",
    tasks: [
      {
        title: "Entender as três telas do Arauto",
        steps: [
          "Painel (/dashboard) — onde você prepara e opera; só quem tem a senha vê essa tela. Nunca é isso que vai pro telão.",
          "Projeção (/projection) — a tela que a congregação vê. Abra com \"Abrir Projeção\" no computador ligado ao telão, ou pelo endereço de rede em Configurações > Telas.",
          "Stage View (/stage) — o monitor de confiança para quem está no palco (letra atual + próxima linha, avisos, timer de palco). Abra pelo ícone de palco na barra de cima.",
        ],
        result: "Você sabe montar a estrutura física: um computador/monitor rodando o Painel (só você mexe), outro rodando a Projeção (ligado ao telão) e, se tiver, um tablet ou monitor no palco rodando a Stage View.",
      },
      {
        title: "Entender \"preparar\" x \"apresentar\"",
        steps: [
          "Preparar: cadastrar músicas, avisos, versículos e mídia, e organizar um roteiro — pode ser feito a qualquer momento, dias antes do culto, sem afetar a projeção.",
          "Apresentar: clicar \"Apresentar\" em um culto (ou \"Projetar\" em qualquer item da biblioteca) — isso é o que aparece de fato na tela de Projeção, ao vivo.",
        ],
        result: "Editar um roteiro guardado não muda nada na tela, mesmo com a Projeção aberta — só afeta o que está \"em preparo\". Only ao clicar Apresentar/Projetar é que algo vai ao ar.",
      },
    ],
  },
  {
    id: "preparar-culto",
    title: "Preparando um culto (do zero até o \"ao vivo\")",
    icon: "checklist",
    intro: "Fluxo completo, ponta a ponta — sequência recomendada para montar e rodar um culto.",
    tasks: [
      {
        title: "Preparar um culto do início ao fim",
        steps: [
          "Cadastre o conteúdo que ainda não existe: músicas (aba Letras), avisos (aba Avisos), mídia (aba Mídia) — a Bíblia já vem pronta, não precisa cadastrar versículo.",
          "Acesse a aba Cultos e clique em \"Novo Culto\". Informe o nome e, se quiser, a data. Clique em \"Criar Culto\".",
          "Selecione o culto criado e clique em \"Editar\".",
          "Use os botões \"+ Adicionar Música\", \"+ Adicionar Aviso\", \"+ Adicionar Mídia\" e \"+ Adicionar Versículo\" para montar o roteiro, um item de cada vez.",
          "Reordene os itens com as setas ↑/↓ ao lado de cada um.",
          "Clique em \"Salvar Roteiro\".",
          "No dia do culto, com a Stage View e a Projeção já abertas nos respectivos computadores, volte à aba Cultos, selecione o culto e clique em \"Apresentar\".",
        ],
        result: "O roteiro passa a rodar ao vivo: a coluna da direita mostra os passos com o item atual destacado, e os botões Anterior/Próximo do rodapé avançam a apresentação.",
        tips: [
          "Você também pode adicionar itens ao roteiro direto de dentro de cada aba (Letras, Avisos, Mídia, Bíblia), pelo botão \"Adicionar ao Roteiro\" — não precisa estar sempre dentro do editor do culto.",
          "Revise o roteiro pelo menos uma vez antes do culto: clique em cada música/versículo na aba Cultos para conferir se a letra e o texto estão corretos.",
        ],
      },
    ],
  },
  {
    id: "roteiros",
    title: "Roteiros (Cultos)",
    icon: "layers",
    intro: "Aba \"Cultos\" — onde você organiza a sequência de itens de um culto.",
    tasks: [
      {
        title: "Criar um roteiro",
        gif: "roteiro.gif",
        steps: ["Aba Cultos → \"Novo Culto\" → preencha nome (e data, opcional) → \"Criar Culto\"."],
        result: "O culto aparece na lista, com roteiro vazio.",
      },
      {
        title: "Adicionar itens ao roteiro",
        when: "Você já tem o culto criado e quer montar a ordem de apresentação.",
        steps: [
          "Selecione o culto na aba Cultos e clique em \"Editar\" (ou clique no botão \"⋯\" ao lado do nome do culto, na coluna do Roteiro).",
          "Clique em \"+ Adicionar Música\", \"+ Adicionar Aviso\", \"+ Adicionar Mídia\" ou \"+ Adicionar Versículo\".",
          "Escolha o item na lista que aparece (na Bíblia, digite uma referência como \"jo 3:16\" primeiro).",
          "Repita para todos os itens do culto.",
          "Clique em \"Salvar Roteiro\".",
        ],
        result: "Os itens aparecem numerados na ordem em que foram adicionados.",
      },
      {
        title: "Alterar a ordem dos itens",
        steps: [
          "Dentro do editor do roteiro: use os botões ↑ e ↓ ao lado de cada item.",
          "Ou, direto no painel (sem abrir o editor): na coluna Roteiro do Culto, arraste um item pela alça (⠿) para a posição desejada — a nova ordem é salva automaticamente.",
        ],
        result: "A ordem muda tanto no roteiro salvo quanto, se o culto já estiver ao vivo, na apresentação.",
      },
      {
        title: "Remover um item do roteiro",
        steps: [
          "No editor do roteiro (ou na coluna Roteiro do Culto, fora de apresentação), clique no ícone de lixeira/× do item.",
          "O botão muda para \"Remover?\" por 3 segundos — clique de novo para confirmar.",
        ],
        result: "O item some do roteiro. A música/aviso/mídia em si continua salvo na respectiva aba — só o vínculo com esse culto é desfeito.",
        tips: ["Se só quiser tirar o item desta apresentação sem excluir do roteiro salvo, desmarque a caixinha ao lado dele em vez de remover — ele fica pulado, mas continua lá para o próximo culto."],
      },
      {
        title: "Duplicar um roteiro",
        when: "Você quer reaproveitar a estrutura de um culto anterior (ex.: mesma sequência toda semana) sem editar o original.",
        steps: ["Aba Cultos → no culto desejado, clique em \"Duplicar\"."],
        result: "Uma cópia do culto (com todos os itens) é criada, pronta para ajustar as músicas/avisos específicos da nova semana.",
      },
      {
        title: "Excluir um culto",
        steps: ["Aba Cultos → no culto desejado, clique no ícone de lixeira → confirme na caixa de diálogo."],
        result: "O culto e seu roteiro são apagados. As músicas, avisos e mídias usados nele continuam existindo nas suas respectivas abas.",
        issues: ["Essa ação não tem confirmação dupla como a remoção de item — depois de confirmar a caixa de diálogo do navegador, não tem como desfazer."],
      },
      {
        title: "Iniciar a apresentação a partir de um roteiro",
        steps: ["Aba Cultos → no culto desejado, clique em \"Apresentar\" (ou, com o culto já selecionado na coluna da direita, no botão \"Apresentar culto\" abaixo do roteiro)."],
        result: "O culto entra no ar: o primeiro item é projetado e a coluna da direita passa a mostrar o roteiro \"ao vivo\", com o item atual destacado.",
      },
    ],
  },
  {
    id: "cancoes",
    title: "Canções (Letras)",
    icon: "lyrics",
    intro: "Aba \"Letras\".",
    tasks: [
      {
        title: "Criar uma nova canção",
        gif: "musica.gif",
        steps: [
          "Aba Letras → \"Nova Música\".",
          "Escolha \"Manual\" ou \"Do YouTube\".",
          "Preencha Título (obrigatório) e Artista (opcional).",
          "Se escolheu \"Do YouTube\", informe também a URL do vídeo.",
          "Clique em \"Adicionar Música\".",
        ],
        result: "A música é criada. Se veio do YouTube, a letra ainda não está importada — isso é um passo separado, feito em \"Letras\" (veja a próxima tarefa).",
      },
      {
        title: "Cadastrar ou importar a letra",
        when: "A música já existe mas ainda não tem letra, ou você quer trocar a letra atual.",
        steps: [
          "Na aba Letras, clique na música e depois em \"Letras\".",
          "Opção 1 — Importar do YouTube: informe/confirme a URL do vídeo e clique em \"Importar\" (funciona só se o vídeo tiver legendas ativadas).",
          "Opção 2 — Colar texto: clique em \"Colar Texto\", cole a letra completa (uma frase por linha) e clique em \"Importar Linhas\".",
          "Opção 3 — Linha por linha: clique em \"+ Adicionar Linha\" e digite o texto de cada linha manualmente.",
          "Ajuste o tempo de início/fim de cada linha (formato m:ss) se quiser que a letra avance sozinha no ritmo da música.",
          "Clique em \"Salvar Letras\".",
        ],
        result: "A letra fica disponível para projetar. Sem tempo definido, cada linha vale ~4 segundos por padrão até ser ajustada.",
        tips: ["O botão \"Buscar letra\" abre uma busca em letras.mus.br numa nova aba — útil quando o YouTube não tem legenda: copie de lá e cole em \"Colar Texto\"."],
      },
      {
        title: "Corrigir uma letra",
        steps: ["Aba Letras → selecione a música → \"Letras\" → edite o texto ou os tempos de qualquer linha → \"Salvar Letras\"."],
        result: "A correção vale para qualquer apresentação futura dessa música, inclusive se ela já estiver em roteiros salvos.",
      },
      {
        title: "Localizar uma canção",
        steps: ["Aba Letras → use o campo de busca no topo da lista (filtra por título/artista enquanto digita). Ou use a busca global (Ctrl+K) do topo do painel."],
        result: "A lista da esquerda mostra só as músicas que combinam com o texto digitado.",
      },
      {
        title: "Projetar uma canção agora",
        steps: ["Aba Letras → clique na música → \"Projetar\"."],
        result: "A letra vai ao ar imediatamente na tela de Projeção, independente de estar em algum roteiro.",
      },
      {
        title: "Adicionar uma canção a um roteiro",
        steps: ["Aba Letras → clique na música → \"Adicionar ao Roteiro\" (adiciona ao culto selecionado no momento na coluna da direita)."],
        result: "A música entra como último item do roteiro em preparo.",
      },
    ],
  },
  {
    id: "versiculos",
    title: "Versículos (Bíblia)",
    icon: "book",
    intro: "Aba \"Bíblia\". O Arauto já vem com uma tradução instalada (Almeida 1911, domínio público).",
    tasks: [
      {
        title: "Escolher a tradução em uso",
        steps: ["Aba Bíblia → use o seletor de tradução no topo (à direita da busca) para trocar entre as traduções instaladas."],
        result: "A busca e a navegação por livro/capítulo passam a usar a tradução escolhida.",
      },
      {
        title: "Importar outra tradução",
        when: "Você tem os direitos de uso de uma tradução diferente da que já vem instalada.",
        steps: [
          "Aba Bíblia → \"Importar Bíblia\".",
          "Preencha nome, idioma e informações de licença (a responsabilidade pelos direitos de uso do texto é de quem importa — o Arauto não valida isso).",
          "Escolha o formato do arquivo: JSON, XML (padrão Zefania) ou CSV (colunas book/livro, chapter/capitulo, verse/versiculo, text/texto).",
          "Selecione o arquivo e clique em \"Importar\".",
        ],
        result: "A nova tradução aparece no seletor, podendo ser usada e removida a qualquer momento (traduções importadas têm um botão de lixeira ao lado do seletor; a tradução padrão do sistema não pode ser removida).",
      },
      {
        title: "Localizar e projetar um versículo",
        gif: "biblia.gif",
        steps: [
          "Aba Bíblia → digite uma referência no campo de busca (ex.: \"jo 3:16\" ou \"salmos 23\") — ou navegue clicando em um livro e depois no capítulo, na lista da esquerda.",
          "Clique no versículo desejado para colocá-lo no ar imediatamente.",
        ],
        result: "O versículo vai ao ar na hora, com o texto da tradução escolhida.",
      },
      {
        title: "Adicionar um versículo a um roteiro",
        steps: [
          "Aba Bíblia → busque o versículo → clique no ícone \"+\" no canto do resultado (adiciona sem projetar).",
          "Ou, dentro do editor de um culto, use \"+ Adicionar Versículo\" e busque por lá.",
        ],
        result: "O versículo entra no roteiro com o texto da tradução atual gravado junto — mesmo que a tradução seja removida depois, o texto já adicionado ao roteiro continua íntegro.",
      },
    ],
  },
  {
    id: "avisos",
    title: "Avisos",
    icon: "bell",
    intro: "Aba \"Avisos\".",
    tasks: [
      {
        title: "Criar um aviso simples",
        gif: "aviso.gif",
        steps: [
          "Aba Avisos → \"Novo Aviso\".",
          "Preencha o Título.",
          "Preencha o Conteúdo (texto do aviso) — opcional se você for anexar imagem ou vídeo.",
          "Se quiser, envie uma Imagem ou vídeo.",
          "Clique em \"Criar Aviso\".",
        ],
        result: "O aviso aparece na lista da aba Avisos, pronto para projetar ou adicionar a um roteiro.",
      },
      {
        title: "Criar um modelo de aviso reutilizável",
        when: "Você repete o mesmo tipo de aviso toda semana, mudando só um detalhe (data, nome do pregador etc.).",
        steps: [
          "Aba Avisos → botão \"Modelo\" (\"+ Modelo\").",
          "No Título e/ou Conteúdo, use {{nome_da_variavel}} nos trechos que mudam (ex.: \"Culto de {{data}}\").",
          "Clique em \"Salvar Modelo\".",
        ],
        result: "O modelo fica salvo separado dos avisos comuns, para ser reaproveitado depois.",
      },
      {
        title: "Usar um modelo para criar um aviso",
        steps: [
          "Aba Avisos → na lista de modelos, escolha o modelo e clique em usá-lo.",
          "Preencha o valor de cada variável — a pré-visualização mostra o texto final em tempo real.",
          "Clique em \"Criar Aviso\".",
        ],
        result: "Um aviso novo é criado com as variáveis já substituídas; o modelo continua disponível para a próxima semana.",
      },
      {
        title: "Projetar um aviso ou adicioná-lo a um roteiro",
        steps: ["Aba Avisos → selecione o aviso → \"Projetar\" (vai ao ar agora) ou \"Adicionar ao Roteiro\"."],
        result: "Igual ao fluxo de músicas: projetar é imediato, adicionar ao roteiro só entra na fila do culto selecionado.",
      },
    ],
  },
  {
    id: "midia",
    title: "Mídia (imagens, áudio e vídeo)",
    icon: "media",
    intro: "Aba \"Mídia\" — arquivos enviados do computador ou vídeos do YouTube, usados como fundo, trilha ou conteúdo avulso.",
    tasks: [
      {
        title: "Enviar um arquivo local",
        gif: "midia.gif",
        steps: [
          "Aba Mídia → \"Enviar Áudio/Vídeo\" → aba \"Arquivo local\".",
          "Selecione o arquivo: áudio (mp3, wav, ogg, m4a — até 100 MB), vídeo (mp4, webm, ogv — até 300 MB) ou imagem (jpg, png, gif, webp — até 20 MB).",
          "Preencha o Nome.",
          "Marque \"Repetir em loop\" se for trilha de fundo ou vídeo de espera.",
          "Clique em \"Adicionar Mídia\".",
        ],
        result: "O arquivo aparece na biblioteca de Mídia, pronto para projetar ou entrar num roteiro/contagem regressiva.",
      },
      {
        title: "Adicionar um vídeo do YouTube",
        steps: [
          "Aba Mídia → \"Enviar Áudio/Vídeo\" → aba \"URL do YouTube\".",
          "Cole a URL do vídeo — uma miniatura confirma que foi reconhecido.",
          "Preencha o Nome e clique em \"Adicionar Mídia\".",
        ],
        result: "O vídeo toca embutido na Projeção com os mesmos controles de um vídeo enviado (pausar, avançar posição, volume) — precisa de internet no computador da Projeção.",
      },
      {
        title: "Usar um fundo pronto (sem enviar arquivo)",
        steps: ["Aba Mídia → \"Fundos prontos\" → escolha um dos fundos animados (poeira dourada, feixes de luz, galáxia etc.)."],
        result: "O fundo é aplicado à tela de Projeção na hora, sem precisar de upload.",
      },
      {
        title: "Projetar ou usar uma mídia",
        steps: ["Aba Mídia → selecione o item → \"Projetar\" (vai ao ar) ou \"Adicionar ao Roteiro\"."],
        result: "Vídeo/áudio projetado aparece com controles no rodapé do painel: barra de posição, pausar/retomar e volume.",
      },
      {
        title: "Excluir uma mídia",
        steps: ["Aba Mídia → selecione o item → use a opção de remover disponível na lista."],
        result: "O arquivo é removido da biblioteca. Se ele estiver em algum roteiro salvo, o item passa a aparecer como \"(mídia removida)\" — vale conferir os roteiros antes de excluir algo que já está em uso.",
      },
    ],
  },
  {
    id: "apresentacao",
    title: "Apresentação / Projeção (durante o culto)",
    icon: "projection",
    intro: "O que o operador usa enquanto o culto está acontecendo, sob pressão de tempo.",
    tasks: [
      {
        title: "Abrir a tela de Projeção",
        gif: "projecao.gif",
        steps: [
          "No computador ligado ao telão: clique em \"Abrir Projeção\" na barra de cima do painel (se for o mesmo computador), ou",
          "Abra o navegador nesse computador e digite o endereço de rede mostrado em Configurações > Telas.",
        ],
        result: "A tela fica limpa (sem menus), pronta para o telão — é exatamente o que a congregação vê.",
      },
      {
        title: "Avançar e voltar durante a apresentação",
        steps: [
          "Clique nos botões \"Anterior\" / \"Próximo\" no rodapé do painel, ou",
          "Use as setas do teclado: → ou barra de espaço avança, ← volta (funciona em qualquer lugar do painel, desde que você não esteja digitando em um campo de texto).",
        ],
        result: "O item seguinte/anterior do roteiro (ou a linha seguinte/anterior da letra, se for uma música) vai ao ar.",
      },
      {
        title: "Pular direto para um item específico do roteiro",
        steps: ["Com o culto ao vivo, clique diretamente em qualquer item da lista na coluna Roteiro do Culto (à direita)."],
        result: "A apresentação salta para aquele item, sem precisar avançar um por um.",
      },
      {
        title: "Reordenar o roteiro com o culto já ao vivo",
        steps: ["Arraste um item pela alça (⠿) na coluna Roteiro do Culto para a nova posição."],
        result: "A ordem muda na hora, inclusive dos itens ainda não apresentados.",
      },
      {
        title: "Ocultar um item sem tirá-lo do roteiro",
        steps: ["Desmarque a caixinha ao lado do item, na coluna Roteiro do Culto."],
        result: "O item fica marcado como \"pulado\" (aparece apagado) e a navegação Anterior/Próximo o ignora — sem precisar removê-lo. Marque a caixinha de novo para voltar a incluí-lo.",
      },
      {
        title: "Mostrar algo fora do roteiro, sem perder o lugar",
        when: "Surgiu a necessidade de exibir um texto rápido (ex.: um versículo citado de improviso) no meio do culto.",
        steps: [
          "Com o culto ao vivo, clique no botão \"+\" ao lado do título \"Roteiro do Culto\".",
          "Preencha Título e Texto no campo \"Texto rápido\".",
          "Clique em \"Mostrar agora\" (projeta na hora) ou \"Salvar como aviso\" (cria um aviso reaproveitável, sem projetar ainda).",
        ],
        result: "O roteiro pausa (aparece o aviso \"Exibindo item avulso — roteiro pausado\") e o texto digitado vai ao ar. Clique em \"Voltar ao roteiro\" para retomar exatamente de onde parou.",
      },
      {
        title: "Controlar um vídeo ou áudio em exibição",
        steps: [
          "Com uma mídia no ar, o rodapé mostra uma barra de posição — arraste para avançar/retroceder.",
          "Use o botão \"Pausar\"/\"Retomar\" no rodapé.",
          "Ajuste o volume pelo controle deslizante ao lado do timer, no canto direito do rodapé.",
        ],
        result: "O controle afeta a reprodução em tempo real na tela de Projeção.",
      },
      {
        title: "Limpar a tela (apagar tudo)",
        steps: ["Clique no botão \"Limpar\" (rodapé)."],
        result: "A Projeção volta para tela em branco. Use antes/depois do culto ou em qualquer pausa em que nada deva ficar exibido.",
      },
    ],
  },
  {
    id: "palco",
    title: "Stage View e Timer de palco",
    icon: "stage",
    tasks: [
      {
        title: "Abrir a Stage View",
        gif: "stage.gif",
        when: "Sempre que houver um culto ao vivo — quem está no palco precisa do monitor de confiança.",
        steps: ["Clique no ícone de palco na barra de cima do painel, ou abra o endereço de rede mostrado em Configurações > Telas > \"Stage View\" no tablet/monitor do palco."],
        result: "A Stage View mostra a letra atual, a próxima linha, avisos e o timer de palco — sem a identidade visual da Projeção pública.",
        tips: ["Se um culto começar sem a Stage View aberta, o painel mostra um aviso (\"Stage View não está aberta\") com um atalho para abri-la."],
      },
      {
        title: "Usar o Timer de palco",
        when: "Quer medir a duração de algo (um louvor, a pregação) sem alterar o que está sendo projetado.",
        steps: [
          "No rodapé do painel, clique no valor do Timer para abrir o painel de contagem.",
          "Selecione a aba \"Timer de palco\".",
          "Digite um rótulo (ex.: \"Pregação\") e clique em \"Iniciar\".",
        ],
        result: "Um cronômetro crescente aparece apenas na Stage View — a Projeção pública não é afetada. Clique em \"Parar\" para encerrar.",
      },
    ],
  },
  {
    id: "contagem",
    title: "Contagem regressiva",
    icon: "clock",
    tasks: [
      {
        title: "Iniciar uma contagem regressiva",
        gif: "timer.gif",
        when: "Antes do culto começar (\"entra em 5 minutos\") ou em qualquer intervalo.",
        steps: [
          "No rodapé do painel, clique no valor do Timer para abrir o painel.",
          "Na aba \"Contagem regressiva\", informe os minutos (1 a 180) e, se quiser, uma mensagem (ex.: \"O culto começa em breve\").",
          "Opcionalmente, escolha uma imagem ou vídeo (enviado ou do YouTube) como fundo — ou clique em \"Enviar novo\" para subir um arquivo na hora, sem sair do painel.",
          "Clique em \"Iniciar\".",
        ],
        result: "O relógio regressivo vai ao ar na tela de Projeção, com o cartaz escolhido atrás (se houver).",
      },
      {
        title: "Parar a contagem regressiva",
        steps: ["No painel de contagem já ativo, clique em \"✕ Parar\"."],
        result: "A contagem some da Projeção.",
      },
    ],
  },
  {
    id: "busca",
    title: "Busca e organização de conteúdo",
    icon: "search",
    tasks: [
      {
        title: "Usar a busca global (Ctrl+K)",
        when: "Você precisa achar e projetar algo o mais rápido possível, sem saber (ou lembrar) em qual aba está.",
        steps: [
          "Pressione Ctrl+K em qualquer lugar do painel, ou clique no campo de busca no topo.",
          "Digite parte do título (funciona para músicas, avisos e mídia).",
          "Use as setas do teclado para navegar nos resultados e Enter para colocar no ar.",
        ],
        result: "O item escolhido vai ao ar imediatamente.",
        tips: ["A busca global não inclui Bíblia nem Cultos — para versículo, use a aba Bíblia; para roteiros, a aba Cultos."],
      },
      {
        title: "Filtrar dentro de uma aba",
        steps: ["Em qualquer uma das 5 abas (Letras, Avisos, Mídia, Bíblia, Cultos), digite no campo de busca próprio daquela aba, no topo da lista."],
        result: "A lista da esquerda mostra só os itens que combinam com o texto — na Bíblia, aceita referências como \"jo 3:16\" além de busca por texto.",
      },
    ],
  },
  {
    id: "configuracoes",
    title: "Configurações, telas de rede e backup",
    icon: "settings",
    intro: "Acesse pelo ícone de engrenagem na barra de cima.",
    tasks: [
      {
        title: "Personalizar aparência e cores",
        gif: "aparencia.gif",
        steps: [
          "Configurações → aba \"Aparência\".",
          "Ajuste Nome da Igreja, URL do Logo, as 4 cores (primária, secundária, fundo e texto da projeção) e a posição do texto (letras/avisos e contagem regressiva).",
          "Acompanhe o resultado no \"Preview da Projeção\".",
          "Clique em \"Salvar\".",
        ],
        result: "A tela de Projeção passa a usar as novas cores/posições imediatamente.",
        tips: ["\"Restaurar padrão do sistema\" devolve as 4 cores originais do Arauto, sem mexer no nome/logo.", "O alternador de \"Tema do painel\" (claro/escuro) é só uma preferência de quem opera — não muda a tela de Projeção, que fica sempre escura."],
      },
      {
        title: "Descobrir o endereço para abrir a Projeção/Stage View em outro computador",
        steps: ["Configurações → aba \"Telas\" — os endereços de rede da Projeção e da Stage View aparecem prontos para copiar."],
        result: "Digite esse endereço no navegador do computador ligado ao telão (ou no tablet do palco), desde que estejam na mesma rede Wi-Fi/cabo do computador que roda o Arauto.",
      },
      {
        title: "Parear e usar o controle remoto pelo celular",
        when: "Quando quem está conduzindo o culto (ex. o pastor) precisa avançar o roteiro, mostrar um aviso/mídia ou projetar um versículo sem estar no computador.",
        gif: "remoto.gif",
        steps: [
          "Configurações → aba \"Telas\" → \"Controle remoto (celular)\" → \"Gerar código de pareamento\".",
          "No celular (na mesma Wi-Fi), abra o endereço /remote e digite o código de 6 dígitos, ou escaneie o QR code mostrado no painel.",
          "Use as abas Roteiro, Avisos, Mídia e Bíblia no celular para navegar e projetar.",
        ],
        result: "O celular passa a controlar o que está no telão, em tempo real, com as mesmas ações básicas do painel.",
        tips: [
          "O código expira em 10 minutos — gere um novo se demorar para parear.",
          "\"Encerrar sessões\" (no painel, depois de gerar um código) desconecta na hora qualquer celular pareado.",
        ],
        issues: ["O controle remoto nunca cria, edita ou apaga nada, e não acessa configurações, backup ou contas — só mostra e projeta o que já existe."],
      },
      {
        title: "Exportar um backup",
        when: "Antes de trocar de computador, atualizar o sistema, ou como rotina periódica de segurança.",
        steps: ["Configurações → aba \"Backup\" → \"⬇ Exportar Backup (.zip)\"."],
        result: "Um arquivo .zip é baixado com todas as músicas, letras, avisos, mídias e contas.",
      },
      {
        title: "Restaurar um backup",
        steps: [
          "Configurações → aba \"Backup\" → \"⬆ Importar Backup (.zip)\" → selecione o arquivo.",
          "Confirme o aviso — a importação substitui todos os dados atuais.",
        ],
        result: "Os dados do backup substituem os atuais. Um backup de segurança dos dados de antes é salvo automaticamente antes da troca, então dá para voltar atrás se precisar.",
        issues: ["A página recarrega sozinha alguns segundos depois de importar — é esperado."],
      },
      {
        title: "Sair da conta",
        steps: ["Configurações → aba \"Conta\" → \"Sair da conta\"."],
        result: "Volta para a tela de login. Gestão de múltiplas contas ainda não está disponível nesta versão.",
      },
    ],
  },
  {
    id: "atualizacoes",
    title: "Atualizações do sistema",
    icon: "upload",
    tasks: [
      {
        title: "Verificar e instalar uma atualização",
        steps: [
          "Configurações → aba \"Sobre\" — a versão instalada aparece ali, junto do botão \"Verificar atualizações agora\".",
          "Se houver uma versão nova, ela é baixada em segundo plano (o painel mostra o progresso).",
          "Quando o download terminar, clique em \"Reiniciar e instalar agora\".",
        ],
        result: "O Arauto reinicia já na versão nova. Nenhum dado (músicas, avisos, cultos, mídia) se perde — eles ficam salvos fora da pasta do programa.",
        issues: ["Isso só existe na versão instalada como aplicativo (Electron). Acessando o painel por um navegador comum, em outro computador da rede, essa opção não aparece."],
      },
    ],
  },
];

/** Texto completo de uma tarefa, para a busca do manual. */
function textoDaTarefa(t: ManualTask) {
  return [t.title, t.when, t.result, ...t.steps, ...(t.tips ?? []), ...(t.issues ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function TarefaCard({ task, numero }: { task: ManualTask; numero: number }) {
  return (
    <article className="manual-task">
      <header className="manual-task-head">
        <span className="manual-task-num">{numero}</span>
        <h4 className="manual-task-title">{task.title}</h4>
      </header>
      <div className="manual-task-body">
        {task.gif && (
          /* O recorte já vem enquadrado e num tamanho único pelo gerador
             (scripts/gerar-gifs-manual.js) — a moldura aqui só dá o
             acabamento de "tela", com a legenda explicando o que se vê. */
          <figure className="manual-figure">
            <div className="manual-figure-frame">
              <img
                className="manual-task-gif"
                src={`/tutoriais/${task.gif}`}
                alt={`Onde encontrar: ${task.title}`}
                loading="lazy"
              />
            </div>
            <figcaption>Onde fica — a partir da tela inicial do painel</figcaption>
          </figure>
        )}
        {task.when && (
          <div className="manual-block">
            <p className="manual-block-label">Quando usar</p>
            <p className="manual-block-text">{task.when}</p>
          </div>
        )}
        <div className="manual-block">
          <p className="manual-block-label">Passo a passo</p>
          <ol className="manual-steps">
            {task.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
        {task.result && (
          <div className="manual-block manual-block-result">
            <p className="manual-block-label">Resultado esperado</p>
            <p className="manual-block-text">{task.result}</p>
          </div>
        )}
        {task.tips && task.tips.length > 0 && (
          <div className="manual-task-note tip">
            <Icon name="checklist" size={15} />
            <span>{task.tips.join(" ")}</span>
          </div>
        )}
        {task.issues && task.issues.length > 0 && (
          <div className="manual-task-note issue">
            <Icon name="bell" size={15} />
            <span>{task.issues.join(" ")}</span>
          </div>
        )}
      </div>
    </article>
  );
}

export function ManualModal({ onClose }: { onClose: () => void }) {
  const [activeId, setActiveId] = useState(MANUAL[0].id);
  const [busca, setBusca] = useState("");
  const active = MANUAL.find((s) => s.id === activeId) ?? MANUAL[0];
  const indiceAtivo = MANUAL.findIndex((s) => s.id === active.id);

  /* Busca: com 60+ tarefas espalhadas em 13 seções, procurar "backup" ou
     "YouTube" abrindo seção por seção é o tipo de coisa que faz a pessoa
     desistir do manual. Quando há texto, o conteúdo vira uma lista de
     resultados agrupada por seção, e a navegação da esquerda passa a mostrar
     quantos resultados caem em cada uma. */
  const termo = busca.trim().toLowerCase();
  const resultados = termo
    ? MANUAL.map((s) => ({ ...s, tasks: s.tasks.filter((t) => textoDaTarefa(t).includes(termo)) })).filter(
        (s) => s.tasks.length > 0
      )
    : null;
  const totalResultados = resultados?.reduce((n, s) => n + s.tasks.length, 0) ?? 0;

  function contagemNaSecao(id: string) {
    if (!resultados) return null;
    return resultados.find((s) => s.id === id)?.tasks.length ?? 0;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="manual-modal" onClick={(e) => e.stopPropagation()}>
        <div className="manual-head">
          <div className="manual-head-icon">
            <Icon name="book" size={19} />
          </div>
          <div className="manual-head-text">
            <span className="manual-head-eyebrow">Arauto</span>
            <h2>Manual de uso</h2>
          </div>
          <label className="manual-search">
            <Icon name="search" size={15} />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar no manual…"
              aria-label="Buscar no manual"
            />
          </label>
          <button className="toolbar-icon-btn" onClick={onClose} title="Fechar" style={{ fontSize: "1.1rem" }}>
            ×
          </button>
        </div>

        <div className="manual-body">
          <nav className="manual-nav">
            <p className="manual-nav-label">Seções</p>
            {MANUAL.map((s) => {
              const n = contagemNaSecao(s.id);
              return (
                <button
                  key={s.id}
                  className={`manual-nav-btn ${!termo && activeId === s.id ? "active" : ""} ${
                    n === 0 ? "faded" : ""
                  }`}
                  onClick={() => {
                    setBusca("");
                    setActiveId(s.id);
                  }}
                >
                  <Icon name={s.icon} size={16} />
                  <span className="manual-nav-title">{s.title}</span>
                  <span className="manual-nav-count">{n ?? s.tasks.length}</span>
                </button>
              );
            })}
          </nav>

          <div className="manual-content">
            {resultados ? (
              <>
                <div className="manual-content-head">
                  <span className="manual-eyebrow">Busca</span>
                  <h3>
                    {totalResultados} {totalResultados === 1 ? "resultado" : "resultados"} para “{busca.trim()}”
                  </h3>
                </div>
                {totalResultados === 0 && (
                  <p className="manual-empty">
                    Nada encontrado. Tente uma palavra mais simples — “letra”, “roteiro”, “backup”, “celular”.
                  </p>
                )}
                {resultados.map((s) => (
                  <section key={s.id} className="manual-result-group">
                    <p className="manual-result-group-title">
                      <Icon name={s.icon} size={14} />
                      {s.title}
                    </p>
                    {s.tasks.map((task, idx) => (
                      <TarefaCard key={task.title} task={task} numero={idx + 1} />
                    ))}
                  </section>
                ))}
              </>
            ) : (
              <>
                <div className="manual-content-head">
                  <span className="manual-eyebrow">
                    Seção {indiceAtivo + 1} de {MANUAL.length} · {active.tasks.length}{" "}
                    {active.tasks.length === 1 ? "tarefa" : "tarefas"}
                  </span>
                  <h3>{active.title}</h3>
                  {active.intro && <p className="manual-content-intro">{active.intro}</p>}
                </div>
                {active.tasks.map((task, idx) => (
                  <TarefaCard key={task.title} task={task} numero={idx + 1} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
