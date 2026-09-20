/**
 * Conjunto de dados de DEMONSTRAÇÃO usado só para gravar os GIFs do manual.
 *
 * Por que existe: os tutoriais são material que vai junto com o produto, e
 * gravá-los contra a instalação de quem está desenvolvendo faz vazar o que
 * estiver na biblioteca daquele computador (músicas "Teste", letras rascunho,
 * nomes de arquivo de captura de tela). Em vez de tentar recortar em volta
 * disso, o gerador sobe um segundo servidor apontando para um DATA_DIR
 * temporário semeado por aqui — a pasta data/ real nunca é lida nem escrita.
 *
 * Tudo aqui é texto de domínio público ou escrito para o exemplo.
 */
const fs = require("fs");
const path = require("path");

const AGORA = "2026-01-05T10:00:00.000Z";

function linhas(textos, segundosPorLinha = 4) {
  return textos.map((text, i) => ({
    startMs: i * segundosPorLinha * 1000,
    endMs: (i + 1) * segundosPorLinha * 1000 - 200,
    text,
    order: i,
  }));
}

function cancao(id, title, artist, textos) {
  return {
    id,
    title,
    artist,
    youtubeUrl: null,
    youtubeId: null,
    lyrics: linhas(textos),
    createdAt: AGORA,
    updatedAt: AGORA,
  };
}

const SONGS = [
  cancao(1, "Castelo Forte", "Martinho Lutero", [
    "Castelo forte é nosso Deus",
    "Espada e bom escudo",
    "Com seu poder defende os seus",
    "Em todo transe agudo",
  ]),
  cancao(2, "Sublime Graça", "John Newton", [
    "Sublime graça do Senhor",
    "Que um infeliz salvou",
    "Perdido, eu me encontro em ti",
    "Cego, mas hoje vejo eu",
  ]),
  cancao(3, "Santo, Santo, Santo", "Reginald Heber", [
    "Santo, Santo, Santo, Deus onipotente",
    "Cedo de manhã cantaremos teu louvor",
    "Santo, Santo, Santo, Deus três vezes santo",
    "Nosso Deus e Pai, cheio de amor",
  ]),
  cancao(4, "Firme nas Promessas", "Russell Kelso Carter", [
    "Firme nas promessas do meu Salvador",
    "Cantarei louvores ao meu Criador",
    "Ele é a rocha em que me firmarei",
    "Firme nas promessas de Jesus, meu Rei",
  ]),
];

const ANNOUNCEMENTS = [
  {
    id: 1,
    title: "Bem-vindos!",
    content:
      "Sejam muito bem-vindos ao culto de hoje. Que este seja um tempo especial de adoração e comunhão.",
    active: true,
    mediaType: "none",
    mediaFile: null,
    createdAt: AGORA,
    updatedAt: AGORA,
  },
  {
    id: 2,
    title: "Santa Ceia neste domingo",
    content: "Neste domingo celebraremos a Santa Ceia ao final do culto da noite.",
    active: true,
    mediaType: "none",
    mediaFile: null,
    createdAt: AGORA,
    updatedAt: AGORA,
  },
  {
    id: 3,
    title: "Reunião de oração",
    content: "Toda quarta-feira, às 19h30, no salão principal. Venha orar conosco.",
    active: true,
    mediaType: "none",
    mediaFile: null,
    createdAt: AGORA,
    updatedAt: AGORA,
  },
];

/* O último da lista é o que o painel seleciona sozinho ao abrir — por isso é
   ele que tem o roteiro completo: é o que aparece nas capturas. */
const SERVICES = [
  {
    id: 1,
    title: "Ensaio de quinta",
    date: "2026-01-08",
    items: [
      { id: "demo-1", type: "song", refId: 2 },
      { id: "demo-2", type: "song", refId: 4 },
    ],
    createdAt: AGORA,
    updatedAt: AGORA,
  },
  {
    id: 2,
    title: "Culto de domingo",
    date: "2026-01-11",
    items: [
      { id: "demo-3", type: "announcement", refId: 1 },
      { id: "demo-4", type: "song", refId: 1 },
      { id: "demo-5", type: "song", refId: 3 },
      { id: "demo-6", type: "song", refId: 2 },
      { id: "demo-7", type: "announcement", refId: 2 },
    ],
    createdAt: AGORA,
    updatedAt: AGORA,
  },
];

/** Traduções copiadas da instalação real (o texto bíblico não é dado da
 *  igreja — é o mesmo arquivo que o instalador distribui). Só duas, pra não
 *  copiar 18 MB à toa: o seletor já fica com opção de troca. */
const TRADUCOES_DEMO = ["alm1911", "tb1917"];

/**
 * Escreve o conjunto de demonstração em `destino` (uma pasta vazia/temporária)
 * e devolve o caminho. `origem` é a pasta data/ real — usada SOMENTE para
 * leitura, e só dos arquivos de Bíblia.
 */
function semearDemo(destino, origem, passwordHash) {
  fs.mkdirSync(destino, { recursive: true });
  fs.mkdirSync(path.join(destino, "media"), { recursive: true });
  fs.mkdirSync(path.join(destino, "bible"), { recursive: true });

  const gravar = (nome, conteudo) =>
    fs.writeFileSync(path.join(destino, nome), JSON.stringify(conteudo, null, 2), "utf8");

  gravar("users.json", {
    nextId: 2,
    items: [
      {
        id: 1,
        email: "demo@arauto.local",
        passwordHash,
        name: "Operador",
        role: "ADMIN",
        createdAt: AGORA,
      },
    ],
  });
  gravar("settings.json", {
    name: "Igreja Exemplo",
    primaryColor: "#6C3AED",
    secondaryColor: "#8B5CF6",
    bgColor: "#0f0a1e",
    textColor: "#FFFFFF",
    logoUrl: null,
    textPosition: "center",
    countdownTextPosition: "center",
    // Já "visto": evita o modal de novidades abrir sozinho por cima do tutorial.
    lastSeenVersion: "99.0.0",
  });
  gravar("songs.json", { nextId: SONGS.length + 1, items: SONGS });
  gravar("announcements.json", { nextId: ANNOUNCEMENTS.length + 1, items: ANNOUNCEMENTS });
  gravar("announcement-templates.json", { nextId: 1, items: [] });
  gravar("media-library.json", { nextId: 1, items: [] });
  gravar("services.json", { nextId: SERVICES.length + 1, items: SERVICES });

  const todas = JSON.parse(fs.readFileSync(path.join(origem, "bible-translations.json"), "utf8"));
  const escolhidas = todas.filter((t) => TRADUCOES_DEMO.includes(t.id));
  gravar("bible-translations.json", escolhidas);
  for (const t of escolhidas) {
    fs.copyFileSync(
      path.join(origem, "bible", `${t.id}.json`),
      path.join(destino, "bible", `${t.id}.json`)
    );
  }

  return destino;
}

module.exports = { semearDemo };
