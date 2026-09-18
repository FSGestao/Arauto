/* ═══════════════════════════════════════════════════════
   Tipos do painel — o formato dos dados COMO O CLIENTE OS RECEBE.
   Não são os mesmos de src/lib/types.ts (que descreve o que é gravado em
   disco): aqui faltam campos que as rotas de listagem não devolvem e sobram
   agregados como `_count`.
   ═══════════════════════════════════════════════════════ */

export type TextPosition = "top" | "center" | "bottom";

export interface Settings {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  textColor: string;
  logoUrl: string | null;
  textPosition: TextPosition;
  countdownTextPosition: TextPosition;
}

export interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: string;
}

export type MediaType = "none" | "image" | "video";

export interface Announcement {
  id: number;
  title: string;
  content: string;
  active: boolean;
  mediaType: MediaType;
  mediaFile: string | null;
  createdAt: string;
}

export interface AnnouncementTemplate {
  id: number;
  title: string;
  content: string;
}

export interface LyricLine {
  startMs: number;
  endMs: number;
  text: string;
  order: number;
}

export interface Song {
  id: number;
  title: string;
  artist: string | null;
  youtubeUrl: string | null;
  youtubeId: string | null;
  lyrics: LyricLine[];
  _count?: { lyrics: number };
}

export interface MediaItem {
  id: number;
  title: string;
  kind: "audio" | "video" | "image";
  file: string;
  loop: boolean;
  volume: number;
  source?: "upload" | "youtube";
}

export interface StepSummary {
  kind: "lyrics" | "announcement" | "media";
  label: string;
  sublabel: string;
  skip: boolean;
}

export interface ServiceProgress {
  id: number;
  title: string;
  stepIndex: number;
  totalSteps: number;
  steps: StepSummary[];
}

export interface LiveState {
  mode: "idle" | "lyrics" | "announcement" | "media" | "countdown";
  song: Song | null;
  lyricIndex: number;
  isPlaying: boolean;
  startedAt: number | null;
  announcement: Announcement | null;
  media: MediaItem | null;
  nextMedia: string | null;
  countdownEndsAt: number | null;
  countdownTitle: string | null;
  countdownMediaFile: string | null;
  countdownMediaKind: "image" | "video" | null;
  /** Cronômetro (contagem crescente) que só aparece na tela de Stage View —
   *  não interfere no que está sendo projetado publicamente. Serve pra medir
   *  a duração do louvor ou da pregação sem tirar a letra/aviso da tela. */
  stageTimer: { startedAt: number; label: string } | null;
  service: ServiceProgress | null;
  interjecting: boolean;
  volume: number;
  background: string | null;
  mediaPaused: boolean;
}

export type ServiceItemType = "song" | "announcement" | "media";

export interface ServiceItem {
  id: string;
  type: ServiceItemType;
  refId: number;
  /** Desmarcado no roteiro: continua salvo no culto, mas não entra na apresentação. */
  skip?: boolean;
}

export interface Service {
  id: number;
  title: string;
  date: string | null;
  items: ServiceItem[];
}

export type LibraryFilter = "songs" | "services" | "announcements" | "media";
