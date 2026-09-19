/* ═══════════════════════════════════════════════════════
   Tipos compartilhados — persistidos como JSON simples
   ═══════════════════════════════════════════════════════ */

export interface User {
  id: number;
  email: string;
  passwordHash: string;
  name: string;
  role: "ADMIN";
  createdAt: string;
}

export interface LyricLine {
  startMs: number; // milissegundos do início
  endMs: number; // milissegundos do fim
  text: string;
  order: number; // ordem de exibição
}

export interface Song {
  id: number;
  title: string;
  artist: string | null;
  youtubeUrl: string | null;
  youtubeId: string | null;
  lyrics: LyricLine[];
  createdAt: string;
  updatedAt: string;
}

export type MediaType = "none" | "image" | "video";

export interface Announcement {
  id: number;
  title: string;
  content: string;
  active: boolean;
  mediaType: MediaType;
  mediaFile: string | null; // nome do arquivo em data/media/
  createdAt: string;
  updatedAt: string;
}

/* ─── Modelos de aviso ───────────────────────────────────
   Um rascunho reaproveitável de aviso com variáveis tipo {{data}} ou
   {{pregador}} no título/conteúdo. Ao usar o modelo, o operador preenche as
   variáveis encontradas e um Announcement normal é criado com o texto já
   substituído — o modelo em si nunca vai pro roteiro/projeção. */
export interface AnnouncementTemplate {
  id: number;
  title: string; // pode conter {{variavel}}
  content: string; // pode conter {{variavel}}
  createdAt: string;
  updatedAt: string;
}

/* ─── Mídia (áudio/vídeo) ────────────────────────────────
   Diferente de `Announcement` com mediaFile: um item de mídia é uma peça
   de áudio ou vídeo com controles próprios (volume, loop, progresso) —
   uma trilha, um vídeo institucional, um playback. */
export type MediaKind = "audio" | "video" | "image";

export interface MediaItem {
  id: number;
  title: string;
  kind: MediaKind;
  file: string; // nome do arquivo em data/media/ — ou, se source === "youtube", o ID do vídeo
  loop: boolean;
  volume: number; // 0..1 — volume padrão deste item
  /** Ausente ou "upload": arquivo em data/media. "youtube": `file` é o ID
   *  do vídeo, tocado pelo player embutido do YouTube — só faz sentido com
   *  kind === "video". */
  source?: "upload" | "youtube";
  createdAt: string;
  updatedAt: string;
}

export type ServiceItemType = "song" | "announcement" | "media" | "bible";

export interface ServiceItem {
  id: string; // uuid — identidade estável do item dentro do roteiro (independente do refId)
  type: ServiceItemType;
  refId: number; // id da Song, Announcement ou MediaItem referenciada — 0 quando type === "bible"
  skip?: boolean; // desmarcado no roteiro: fica salvo no culto, mas não entra na apresentação
  /** Só quando type === "bible": o versículo não tem um id numérico numa
   *  coleção pra referenciar por `refId` (não é salvo em lugar nenhum além
   *  do próprio roteiro) — por isso vem embutido, já resolvido, aqui. */
  bible?: BibleReference;
}

export interface Service {
  id: number;
  title: string;
  date: string | null; // data do culto (opcional)
  items: ServiceItem[];
  createdAt: string;
  updatedAt: string;
}

/* ─── Bíblia ─────────────────────────────────────────────
   Cada tradução é um arquivo próprio em data/bible/<id>.json (pesado —
   pode passar de 30 mil versículos — por isso fora do padrão de coleção
   genérica). `bible-translations.json` guarda só os metadados de cada
   uma (pra listar sem carregar o texto inteiro). */
export interface BibleVerse {
  number: number;
  text: string;
}

export interface BibleChapter {
  number: number;
  verses: BibleVerse[];
}

export interface BibleBook {
  name: string;
  abbrev: string;
  chapters: BibleChapter[];
}

export interface BibleTranslationData {
  id: string;
  name: string;
  language: string;
  license: string;
  source: string;
  books: BibleBook[];
}

/** O que vai pro liveState/projeção quando um versículo é colocado no ar —
 *  autocontido (texto já embutido), pra projeção não precisar buscar a
 *  tradução inteira só pra mostrar uma referência. */
export interface BibleReference {
  translationId: string;
  translationName: string;
  book: string;
  bookAbbrev: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleTranslationMeta {
  id: string;
  name: string;
  language: string;
  license: string;
  source: string;
  /** "seed": veio junto com o Arauto (domínio público). "upload": o
   *  próprio usuário enviou um arquivo (responsabilidade dele ter os
   *  direitos de uso — o app não valida licença de upload). */
  origin: "seed" | "upload";
  bookCount: number;
  verseCount: number;
  createdAt: string;
}

/** Posição vertical do texto na tela de projeção. */
export type TextPosition = "top" | "center" | "bottom";

export interface Settings {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  textColor: string;
  logoUrl: string | null;
  /** Letras de música e avisos (texto puro) — configurados juntos. */
  textPosition: TextPosition;
  /** Separado do acima: só a contagem regressiva. */
  countdownTextPosition: TextPosition;
  /** Última versão do app que essa instalação já viu — decide se mostra o
   *  "Como usar" (nunca visto nenhuma versão ainda) ou as notas da versão
   *  (viu uma versão diferente da atual) ao abrir o painel. `undefined`
   *  significa "primeira vez", de propósito — não dá pra confundir com uma
   *  string vazia por engano. */
  lastSeenVersion?: string;
}

export const DEFAULT_SETTINGS: Settings = {
  name: "Minha Igreja",
  primaryColor: "#6C3AED",
  secondaryColor: "#8B5CF6",
  bgColor: "#0F0A1E",
  textColor: "#FFFFFF",
  logoUrl: null,
  textPosition: "center",
  countdownTextPosition: "center",
};
