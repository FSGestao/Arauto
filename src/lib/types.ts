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

/* ─── Mídia (áudio/vídeo) ────────────────────────────────
   Diferente de `Announcement` com mediaFile: um item de mídia é uma peça
   de áudio ou vídeo com controles próprios (volume, loop, progresso) —
   uma trilha, um vídeo institucional, um playback. */
export type MediaKind = "audio" | "video";

export interface MediaItem {
  id: number;
  title: string;
  kind: MediaKind;
  file: string; // nome do arquivo em data/media/
  loop: boolean;
  volume: number; // 0..1 — volume padrão deste item
  createdAt: string;
  updatedAt: string;
}

export type ServiceItemType = "song" | "announcement" | "media";

export interface ServiceItem {
  id: string; // uuid — identidade estável do item dentro do roteiro (independente do refId)
  type: ServiceItemType;
  refId: number; // id da Song, Announcement ou MediaItem referenciada
}

export interface Service {
  id: number;
  title: string;
  date: string | null; // data do culto (opcional)
  items: ServiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  textColor: string;
  logoUrl: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  name: "Minha Igreja",
  primaryColor: "#6C3AED",
  secondaryColor: "#8B5CF6",
  bgColor: "#0F0A1E",
  textColor: "#FFFFFF",
  logoUrl: null,
};
