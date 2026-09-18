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

export type ServiceItemType = "song" | "announcement" | "media";

export interface ServiceItem {
  id: string; // uuid — identidade estável do item dentro do roteiro (independente do refId)
  type: ServiceItemType;
  refId: number; // id da Song, Announcement ou MediaItem referenciada
  skip?: boolean; // desmarcado no roteiro: fica salvo no culto, mas não entra na apresentação
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
