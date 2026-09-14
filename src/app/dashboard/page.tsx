"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";

interface Settings {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  textColor: string;
  logoUrl: string | null;
}

interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: string;
}

type MediaType = "none" | "image" | "video";

interface Announcement {
  id: number;
  title: string;
  content: string;
  active: boolean;
  mediaType: MediaType;
  mediaFile: string | null;
  createdAt: string;
}

interface LyricLine {
  startMs: number;
  endMs: number;
  text: string;
  order: number;
}

interface Song {
  id: number;
  title: string;
  artist: string | null;
  youtubeUrl: string | null;
  youtubeId: string | null;
  lyrics: LyricLine[];
  _count?: { lyrics: number };
}

interface MediaItem {
  id: number;
  title: string;
  kind: "audio" | "video";
  file: string;
  loop: boolean;
  volume: number;
}

interface StepSummary {
  kind: "lyrics" | "announcement" | "media";
  label: string;
  sublabel: string;
  skip: boolean;
}

interface ServiceProgress {
  id: number;
  title: string;
  stepIndex: number;
  totalSteps: number;
  steps: StepSummary[];
}

interface LiveState {
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
  service: ServiceProgress | null;
  interjecting: boolean;
  volume: number;
  background: string | null;
  mediaPaused: boolean;
}

type ServiceItemType = "song" | "announcement" | "media";

interface ServiceItem {
  id: string;
  type: ServiceItemType;
  refId: number;
}

interface Service {
  id: number;
  title: string;
  date: string | null;
  items: ServiceItem[];
}

type Tab = "projecao" | "services" | "announcements" | "songs" | "media" | "settings";

/** Ícone e rótulo por tipo de item — mesmos símbolos em todo o painel, pra
 *  o operador reconhecer o tipo de conteúdo sem ler. */
const STEP_ICON: Record<string, string> = {
  lyrics: "🎵",
  announcement: "📢",
  media: "🎬",
};

const STEP_LABEL: Record<string, string> = {
  lyrics: "Música",
  announcement: "Aviso",
  media: "Mídia",
  countdown: "Contagem regressiva",
  idle: "Tela limpa",
};

/** Formata milissegundos restantes como mm:ss ou h:mm:ss — usado tanto no
 * painel do operador quanto (via a mesma lógica) na tela de projeção. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Formata segundos como m:ss (usado na barra de progresso da mídia). */
function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getAuthHeaders(): HeadersInit {
  const match = document.cookie.match(/auth-token=([^;]+)/);
  const token = match ? match[1] : "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

function getAuthToken(): string {
  const match = document.cookie.match(/auth-token=([^;]+)/);
  return match ? match[1] : "";
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("projecao");

  // Data
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [mediaLibrary, setMediaLibrary] = useState<MediaItem[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [networkUrls, setNetworkUrls] = useState<string[]>([]);
  const [stageUrls, setStageUrls] = useState<string[]>([]);

  // Roteiro (Culto) sendo editado ou apresentado
  const [services, setServices] = useState<Service[]>([]);
  const [editingService, setEditingService] = useState<Service | null>(null);

  // Live projection state (via WebSocket)
  const [live, setLive] = useState<LiveState>({
    mode: "idle",
    service: null,
    song: null,
    lyricIndex: -1,
    isPlaying: false,
    startedAt: null,
    announcement: null,
    media: null,
    nextMedia: null,
    countdownEndsAt: null,
    countdownTitle: null,
    interjecting: false,
    volume: 1,
    background: null,
    mediaPaused: false,
  });
  // Progresso do que está tocando, reportado pela tela de projeção. Fica
  // fora do liveState de propósito (chega a cada 500ms e não deve
  // re-renderizar o roteiro inteiro nem virar estado do servidor).
  const [mediaProgress, setMediaProgress] = useState({ currentTime: 0, duration: 0 });
  const [connections, setConnections] = useState({ admin: 0, projection: 0, stage: 0 });
  const socketRef = useRef<Socket | null>(null);

  // Modals
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showSongModal, setShowSongModal] = useState(false);
  const [showLyricsModal, setShowLyricsModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [editingSong, setEditingSong] = useState<Song | null>(null);
  // Painel "Inserir agora" (durante um roteiro em apresentação) e o texto
  // avulso digitado na hora (ex.: um versículo) — não é salvo na biblioteca.
  const [showInsertPanel, setShowInsertPanel] = useState(false);
  const [quickText, setQuickText] = useState({ title: "", content: "" });
  // Índice do card do roteiro sendo arrastado (kanban), enquanto o arraste dura.
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  // Busca global (Ctrl+K) — acessível de qualquer aba, sem tirar a mão do teclado.
  const [showSearch, setShowSearch] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4500);
  }

  // ─── Fetch user info ─────────────────────────────────
  useEffect(() => {
    fetch("/api/auth/me", { headers: getAuthHeaders() })
      .then((r) => {
        if (!r.ok) {
          window.location.href = "/";
          throw new Error("Not authenticated");
        }
        return r.json();
      })
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {
        window.location.href = "/";
      });

    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});

    fetch("/api/network-info")
      .then((r) => r.json())
      .then((data) => {
        setNetworkUrls(data.projectionUrls || []);
        setStageUrls(data.stageUrls || []);
      })
      .catch(() => {});
  }, []);

  // ─── Socket.IO — controla a projeção em tempo real ───
  useEffect(() => {
    if (!user) return;
    const socket = io({ path: "/socket.io", auth: { token: getAuthToken() }, query: { role: "admin" } });
    socketRef.current = socket;
    socket.on("state:update", (state: LiveState) => setLive(state));
    socket.on("media:progress", (p: { currentTime: number; duration: number }) => setMediaProgress(p));
    socket.on("connections:update", (c: { admin: number; projection: number; stage: number }) => setConnections(c));
    return () => {
      socket.disconnect();
    };
  }, [user]);

  // ─── Fetch data by tab ───────────────────────────────
  const fetchAnnouncements = useCallback(() => {
    fetch("/api/announcements", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setAnnouncements)
      .catch(console.error);
  }, []);

  const fetchSongs = useCallback(() => {
    fetch("/api/songs", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setSongs)
      .catch(console.error);
  }, []);

  const fetchServices = useCallback(() => {
    fetch("/api/services", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setServices)
      .catch(console.error);
  }, []);

  const fetchMedia = useCallback(() => {
    fetch("/api/media-library", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setMediaLibrary)
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!user) return;
    fetchAnnouncements();
    fetchSongs();
    fetchServices();
    fetchMedia();
  }, [user, fetchAnnouncements, fetchSongs, fetchServices, fetchMedia]);

  // ─── Busca global (Ctrl+K / Cmd+K) ────────────────────
  // Funciona de qualquer aba, sem precisar clicar em nada antes — é o "achar
  // e colocar no ar em segundos" que o operador precisa sob pressão.
  useEffect(() => {
    function handleGlobalKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowSearch(true);
      } else if (e.key === "Escape") {
        setShowSearch(false);
      }
    }
    window.addEventListener("keydown", handleGlobalKey);
    return () => window.removeEventListener("keydown", handleGlobalKey);
  }, []);

  // ─── Contagem regressiva: força re-render a cada segundo ──
  // O servidor só manda o instante em que termina (countdownEndsAt); cada
  // tela calcula "quanto falta" sozinha, sem depender de mensagens a cada
  // segundo vindas do servidor.
  const [, setCountdownTick] = useState(0);
  useEffect(() => {
    if (live.mode !== "countdown") return;
    const interval = setInterval(() => setCountdownTick((t) => t + 1), 250);
    return () => clearInterval(interval);
  }, [live.mode]);

  // ─── Apply brand theme ────────────────────────────────
  useEffect(() => {
    if (!settings) return;
    const root = document.documentElement;
    root.style.setProperty("--primary", settings.primaryColor);
    root.style.setProperty("--primary-light", settings.secondaryColor);
  }, [settings]);

  // ─── Live control handlers ───────────────────────────
  function selectSong(song: Song) {
    socketRef.current?.emit("admin:selectSong", song);
  }
  function play() {
    socketRef.current?.emit("admin:play");
  }
  function pause() {
    socketRef.current?.emit("admin:pause");
  }
  function goToLine(index: number) {
    socketRef.current?.emit("admin:goToLine", index);
  }
  function nextLine() {
    if (!live.song) return;
    goToLine(Math.min(live.lyricIndex + 1, live.song.lyrics.length - 1));
  }
  function prevLine() {
    if (!live.song) return;
    goToLine(Math.max(live.lyricIndex - 1, 0));
  }
  function showAnnouncementLive(a: Announcement) {
    socketRef.current?.emit("admin:showAnnouncement", a);
  }
  function stopAll() {
    socketRef.current?.emit("admin:stop");
  }

  // ─── Mídia (áudio/vídeo) ──────────────────────────────
  function showMediaLive(m: MediaItem) {
    socketRef.current?.emit("admin:showMedia", m);
  }
  function mediaToggle() {
    socketRef.current?.emit("admin:mediaToggle");
  }
  function mediaSeek(seconds: number) {
    setMediaProgress((p) => ({ ...p, currentTime: seconds })); // resposta imediata no slider
    socketRef.current?.emit("admin:mediaSeek", seconds);
  }
  function setVolume(value: number) {
    socketRef.current?.emit("admin:setVolume", value);
  }
  function setBackground(file: string | null) {
    socketRef.current?.emit("admin:setBackground", file);
  }

  // ─── Contagem regressiva ──────────────────────────────
  function startCountdown(seconds: number, title: string) {
    if (!(seconds > 0)) return;
    socketRef.current?.emit("admin:startCountdown", { seconds, title });
  }
  function stopCountdown() {
    socketRef.current?.emit("admin:stopCountdown");
  }

  // Corrige a linha que está no ar AGORA, sem sair da apresentação: atualiza
  // a tela na hora (socket) e grava na biblioteca pra não perder a correção
  // (PATCH só essa linha — evita reenviar a letra inteira).
  function editCurrentLine(text: string) {
    if (!live.song || live.lyricIndex < 0) return;
    socketRef.current?.emit("admin:editCurrentLine", text);
    fetch(`/api/songs/${live.song.id}/lyrics`, {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify({ lineIndex: live.lyricIndex, text }),
    })
      .then((r) => {
        if (r.ok) fetchSongs();
        else showToast("error", "Corrigido na tela, mas não salvou na biblioteca");
      })
      .catch(() => showToast("error", "Corrigido na tela, mas não salvou na biblioteca"));
  }

  function openProjectionWindow() {
    window.open("/projection", "_blank");
  }
  function openStageWindow() {
    window.open("/stage", "_blank");
  }

  // ─── Roteiro (Culto) ao vivo ──────────────────────────
  // Monta a sequência de EVENTOS do culto: cada música inteira é um passo
  // (não uma linha de letra — a letra avança por dentro do mesmo passo), e
  // cada aviso é um passo. É essa lista de eventos que aparece como cards no
  // roteiro e que dá pra reordenar arrastando.
  function buildSteps(service: Service) {
    const steps: Array<
      | { kind: "lyrics"; song: Song; lineIndex: number }
      | { kind: "announcement"; announcement: Announcement }
      | { kind: "media"; media: MediaItem }
    > = [];
    for (const item of service.items) {
      if (item.type === "song") {
        const song = songs.find((s) => s.id === item.refId);
        if (!song) continue;
        steps.push({ kind: "lyrics", song, lineIndex: song.lyrics.length > 0 ? 0 : -1 });
      } else if (item.type === "media") {
        const media = mediaLibrary.find((m) => m.id === item.refId);
        if (!media) continue;
        steps.push({ kind: "media", media });
      } else {
        const announcement = announcements.find((a) => a.id === item.refId);
        if (!announcement) continue;
        steps.push({ kind: "announcement", announcement });
      }
    }
    return steps;
  }

  function startService(service: Service) {
    const steps = buildSteps(service);
    if (steps.length === 0) {
      showToast("error", "Este culto ainda não tem músicas ou avisos adicionados");
      return;
    }
    socketRef.current?.emit("admin:startService", { id: service.id, title: service.title, steps });
    // Sem isso, quem clica "Apresentar" na aba Cultos não vê nenhuma mudança
    // na tela (o resultado só aparece na aba Projeção) — parece que "não fez nada".
    setTab("projecao");
  }
  function roteiroNext() {
    socketRef.current?.emit("roteiro:next");
  }
  function roteiroPrev() {
    socketRef.current?.emit("roteiro:prev");
  }
  function roteiroGoToStep(index: number) {
    socketRef.current?.emit("admin:goToStep", index);
  }
  function roteiroToggleSkip(index: number) {
    socketRef.current?.emit("admin:toggleStepSkip", index);
  }
  // Arrastar um card do roteiro pra outra posição (só muda a ordem desta
  // apresentação, não o culto salvo).
  function roteiroReorder(from: number, to: number) {
    socketRef.current?.emit("admin:reorderSteps", { from, to });
  }
  // Volta a exibir o passo atual do roteiro pausado (encerra a interjeição).
  function resumeService() {
    socketRef.current?.emit("admin:resumeService");
  }
  // Mostra um texto avulso na hora (ex.: um versículo bíblico) sem precisar
  // cadastrar um aviso na biblioteca — some do ar quando o roteiro retomar.
  function showQuickText() {
    if (!quickText.title.trim() && !quickText.content.trim()) return;
    showAnnouncementLive({
      id: 0,
      title: quickText.title.trim() || "Texto",
      content: quickText.content.trim(),
      active: true,
      mediaType: "none",
      mediaFile: null,
      createdAt: "",
    });
    setQuickText({ title: "", content: "" });
    setShowInsertPanel(false);
  }
  // Guarda o texto rápido como aviso de verdade — pra não ter que digitar de
  // novo da próxima vez (ex.: um recado que o pastor pede toda semana).
  async function saveQuickTextAsAnnouncement() {
    if (!quickText.title.trim() && !quickText.content.trim()) return;
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        title: quickText.title.trim() || "Texto",
        content: quickText.content.trim(),
        mediaType: "none",
        mediaFile: null,
      }),
    });
    if (res.ok) {
      showToast("success", "Salvo como aviso — já aparece na lista ao lado");
      fetchAnnouncements();
    } else {
      showToast("error", "Erro ao salvar aviso");
    }
  }

  // ─── CRUD handlers ────────────────────────────────────
  async function handleDeleteAnnouncement(id: number) {
    if (!confirm("Remover este aviso?")) return;
    const res = await fetch(`/api/announcements/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      showToast("success", "Aviso removido");
      fetchAnnouncements();
    } else {
      showToast("error", "Erro ao remover aviso");
    }
  }

  async function handleDeleteSong(id: number) {
    if (!confirm("Remover esta música e suas letras?")) return;
    const res = await fetch(`/api/songs/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      showToast("success", "Música removida");
      fetchSongs();
    } else {
      showToast("error", "Erro ao remover música");
    }
  }

  async function handleDeleteMedia(id: number) {
    if (!confirm("Remover esta mídia? O arquivo será apagado do disco.")) return;
    const res = await fetch(`/api/media-library/${id}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      showToast("success", "Mídia removida");
      fetchMedia();
    } else {
      showToast("error", "Erro ao remover mídia");
    }
  }

  function handleLogout() {
    document.cookie = "auth-token=; path=/; max-age=0";
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="pulse" style={{ fontSize: "1.2rem", color: "var(--text-secondary)" }}>
          Carregando...
        </div>
      </div>
    );
  }

  const sidebarLinks: { id: Tab; icon: string; label: string }[] = [
    { id: "projecao", icon: "📽️", label: "Projeção" },
    { id: "services", icon: "🗓️", label: "Cultos" },
    { id: "announcements", icon: "📢", label: "Avisos" },
    { id: "songs", icon: "🎵", label: "Músicas" },
    { id: "media", icon: "🎬", label: "Mídia" },
    { id: "settings", icon: "⚙️", label: "Configurações" },
  ];

  const currentLyricText =
    live.mode === "lyrics" && live.song && live.lyricIndex >= 0
      ? live.song.lyrics[live.lyricIndex]?.text
      : null;

  // Prévia da próxima linha da MESMA música (o card do roteiro é a música
  // inteira, não cada linha — então a "próxima linha" fica numa tarja
  // separada, dentro do próprio "No ar agora", em vez de ser outro card).
  const nextLyricLine =
    live.mode === "lyrics" && live.song && live.lyricIndex >= 0 && live.lyricIndex + 1 < live.song.lyrics.length
      ? live.song.lyrics[live.lyricIndex + 1].text
      : null;

  return (
    <>
      {/* ─── Sidebar ──────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          {settings?.logoUrl ? (
            <img src={settings.logoUrl} alt={settings.name} />
          ) : (
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-sm)",
                background: "linear-gradient(135deg, var(--primary), var(--secondary))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
              }}
            >
              🎵
            </div>
          )}
          <span>{settings?.name || "Arauto"}</span>
        </div>

        <button
          className="sidebar-link"
          onClick={() => setShowSearch(true)}
          style={{ border: "1px solid var(--border-glass)", marginBottom: 4 }}
        >
          <span className="icon">🔍</span>
          <span style={{ flex: 1, textAlign: "left" }}>Buscar</span>
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "monospace" }}>Ctrl+K</span>
        </button>

        <nav className="sidebar-nav">
          {sidebarLinks.map((link) => (
            <button
              key={link.id}
              className={`sidebar-link ${tab === link.id ? "active" : ""}`}
              onClick={() => setTab(link.id)}
            >
              <span className="icon">{link.icon}</span>
              {link.label}
            </button>
          ))}
        </nav>

        <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: 16, marginTop: "auto" }}>
          <button className="btn btn-primary w-full mb-sm" onClick={openProjectionWindow} style={{ gap: 8 }}>
            📽️ Abrir Projeção
          </button>
          <button className="sidebar-link" onClick={handleLogout} style={{ color: "var(--danger)", width: "100%" }}>
            <span className="icon">🚪</span>
            Sair
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─────────────────────────────── */}
      <main className="main-content">
        {/* ─── PROJEÇÃO (controle em tempo real) ────────── */}
        {tab === "projecao" && (
          <>
            <div className="topbar">
              <h1>📽️ Projeção</h1>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {/* Quantas telas de cada tipo estão conectadas agora — pra saber
                    ANTES do culto se o projetor está mesmo recebendo o sinal. */}
                <div
                  style={{ display: "flex", gap: 12, fontSize: "0.78rem", color: "var(--text-muted)", marginRight: 8 }}
                  title="Telas conectadas agora nesta rede"
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: connections.projection > 0 ? "var(--success)" : "var(--text-muted)",
                      }}
                    />
                    Projeção {connections.projection}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: connections.stage > 0 ? "var(--success)" : "var(--text-muted)",
                      }}
                    />
                    Stage {connections.stage}
                  </span>
                </div>
                <button className="btn btn-secondary" onClick={openProjectionWindow}>
                  Abrir janela de projeção
                </button>
                <button className="btn btn-secondary" onClick={openStageWindow} title="Monitor de confiança para quem está no palco">
                  🎤 Abrir Stage View
                </button>
                <button className="btn btn-danger" onClick={stopAll}>
                  ✕ Limpar tela
                </button>
              </div>
            </div>

            {networkUrls.length > 0 && (
              <div className="glass-card p-md mb-lg" style={{ fontSize: "0.85rem" }}>
                <p style={{ color: "var(--text-secondary)", marginBottom: 6 }}>
                  Projeção — para exibir em outro computador da mesma rede (ex.: o PC ligado ao projetor):
                </p>
                {networkUrls.map((u) => (
                  <p key={u} style={{ fontFamily: "monospace", color: "var(--primary-light)" }}>
                    {u}
                  </p>
                ))}
                <p style={{ color: "var(--text-secondary)", margin: "10px 0 6px" }}>
                  Stage View — monitor de confiança, pra abrir num tablet/monitor no palco:
                </p>
                {stageUrls.map((u) => (
                  <p key={u} style={{ fontFamily: "monospace", color: "var(--primary-light)" }}>
                    {u}
                  </p>
                ))}
              </div>
            )}

            {/* Contagem regressiva — funciona com ou sem um culto em
                apresentação (útil até antes do culto começar). */}
            <CountdownControl
              active={live.mode === "countdown"}
              endsAt={live.countdownEndsAt}
              title={live.countdownTitle}
              onStart={startCountdown}
              onStop={stopCountdown}
            />

            {live.service && (
              <div
                className="glass-card p-md mb-lg"
                style={{
                  fontSize: "0.85rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  ...(live.interjecting ? { borderLeft: "3px solid var(--warning)" } : {}),
                }}
              >
                {live.interjecting ? (
                  <p style={{ color: "var(--warning)" }}>
                    🔀 Exibindo item avulso — roteiro <strong>{live.service.title}</strong> pausado no passo{" "}
                    {live.service.stepIndex + 1} de {live.service.totalSteps}
                  </p>
                ) : (
                  <p style={{ color: "var(--text-secondary)" }}>
                    Roteiro em apresentação: <strong>{live.service.title}</strong> — passo {live.service.stepIndex + 1} de{" "}
                    {live.service.totalSteps}
                  </p>
                )}
                <div style={{ display: "flex", gap: 8 }}>
                  {live.interjecting && (
                    <button className="btn btn-primary btn-sm" onClick={resumeService}>
                      ↩ Voltar ao roteiro
                    </button>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowInsertPanel((v) => !v)}>
                    {showInsertPanel ? "✕ Fechar inserir" : "➕ Inserir agora"}
                  </button>
                </div>
              </div>
            )}

            {/* Inserir algo na hora sem sair do roteiro: aviso/música já
                cadastrados, ou um texto rápido (ex.: um versículo) que não
                precisa ser salvo na biblioteca. Some do ar ao voltar ao roteiro. */}
            {live.service && showInsertPanel && (
              <div className="glass-card p-md mb-lg">
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase" }}>
                  Inserir agora
                </p>
                <div className="grid-2">
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>📝 Texto rápido (ex.: versículo)</p>
                    <input
                      className="input-field"
                      type="text"
                      placeholder="Título (ex.: João 3:16)"
                      value={quickText.title}
                      onChange={(e) => setQuickText((q) => ({ ...q, title: e.target.value }))}
                      style={{ marginBottom: 6 }}
                    />
                    <textarea
                      className="input-field"
                      placeholder="Texto a exibir"
                      value={quickText.content}
                      onChange={(e) => setQuickText((q) => ({ ...q, content: e.target.value }))}
                      rows={3}
                      style={{ marginBottom: 6 }}
                    />

                    {/* Preview: como vai aparecer na projeção de verdade — mesma
                        cor de fundo/texto configurada nas Configurações — antes
                        de decidir se manda ao vivo. */}
                    {(quickText.title.trim() || quickText.content.trim()) && settings && (
                      <div
                        style={{
                          background: settings.bgColor,
                          color: settings.textColor,
                          borderRadius: "var(--radius-sm)",
                          padding: "14px 16px",
                          marginBottom: 8,
                          textAlign: "center",
                        }}
                      >
                        <p style={{ fontSize: "0.65rem", opacity: 0.5, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          Prévia da projeção
                        </p>
                        <p style={{ fontWeight: 700, fontSize: "1rem" }}>{quickText.title.trim() || "Texto"}</p>
                        {quickText.content.trim() && <p style={{ fontSize: "0.85rem", opacity: 0.85, marginTop: 4 }}>{quickText.content.trim()}</p>}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={showQuickText}>
                        Mostrar agora
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={saveQuickTextAsAnnouncement}>
                        💾 Salvar como aviso
                      </button>
                    </div>
                  </div>
                  <div>
                    <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 6 }}>Da biblioteca</p>
                    <div style={{ maxHeight: 160, overflowY: "auto" }}>
                      {announcements.filter((a) => a.active).map((a) => (
                        <button key={`a-${a.id}`} onClick={() => showAnnouncementLive(a)} className="sidebar-link">
                          <span>📢 {a.title}</span>
                        </button>
                      ))}
                      {mediaLibrary.map((m) => (
                        <button key={`m-${m.id}`} onClick={() => showMediaLive(m)} className="sidebar-link">
                          <span>🎬 {m.title}</span>
                        </button>
                      ))}
                      {songs.map((s) => (
                        <button key={`s-${s.id}`} onClick={() => selectSong(s)} className="sidebar-link">
                          <span>🎵 {s.title}</span>
                        </button>
                      ))}
                      {announcements.filter((a) => a.active).length === 0 &&
                        songs.length === 0 &&
                        mediaLibrary.length === 0 && (
                          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Nada cadastrado ainda</p>
                        )}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 10 }}>
                  Imagem ou vídeo avulso: cadastre como um aviso novo na aba{" "}
                  <span
                    onClick={() => setTab("announcements")}
                    style={{ color: "var(--primary-light)", cursor: "pointer", textDecoration: "underline" }}
                  >
                    Avisos
                  </span>{" "}
                  e depois clique nele aqui — o roteiro continua pausado até você voltar.
                </p>
              </div>
            )}

            {live.service ? (
              // ─── Modo apresentação: duas zonas, cada uma com cabeçalho
              // dizendo o que é. Coluna 1 = No ar agora / A seguir / Saída.
              // Coluna 2 = o roteiro inteiro. Flexbox explícito (não grid com
              // posicionamento automático): cada coluna é montada na mão. ───
              <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
                <div style={{ flex: "1 1 400px", display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
                  {/* ── ZONA 1: o que está no ar ── */}
                  <div className="panel accent">
                    <div className="panel-head">
                      <span className="panel-title">
                        <span className="dot live" /> No ar agora
                      </span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        {STEP_LABEL[live.mode] || "—"} · passo {live.service.stepIndex + 1} de {live.service.totalSteps}
                      </span>
                    </div>
                    <div className="panel-body">
                      <p style={{ fontWeight: 700, fontSize: "1.15rem", marginBottom: currentLyricText || live.mode !== "lyrics" ? 12 : 0 }}>
                        {live.mode === "lyrics" && (live.song?.title || "—")}
                        {live.mode === "announcement" && (live.announcement?.title || "—")}
                        {live.mode === "media" && (live.media?.title || "—")}
                        {live.mode === "countdown" && "⏱ Contagem regressiva"}
                        {live.mode === "idle" && "Tela em branco"}
                      </p>

                      {live.mode === "countdown" && live.countdownEndsAt && (
                        <div style={{ marginBottom: 12 }}>
                          <p style={{ fontSize: "2rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                            {formatCountdown(live.countdownEndsAt - Date.now())}
                          </p>
                          {live.countdownTitle && <p style={{ color: "var(--text-secondary)" }}>{live.countdownTitle}</p>}
                        </div>
                      )}

                      {currentLyricText && (
                        <>
                          <p className="field-label">Linha atual</p>
                          <EditableCurrentLine
                            text={currentLyricText}
                            onSave={editCurrentLine}
                            style={{ fontSize: "1.25rem", lineHeight: 1.4, marginBottom: 12 }}
                          />
                        </>
                      )}

                      {/* A música é UM card no roteiro, então a letra seguinte
                          não tem card próprio: fica aqui, logo abaixo da atual. */}
                      {nextLyricLine && (
                        <div style={{ borderTop: "1px solid var(--border-glass)", paddingTop: 10, marginBottom: 12 }}>
                          <p className="field-label">Próxima linha</p>
                          <p style={{ fontSize: "0.95rem", color: "var(--text-secondary)" }}>&ldquo;{nextLyricLine}&rdquo;</p>
                        </div>
                      )}

                      {live.mode === "announcement" && live.announcement && (
                        <p style={{ color: "var(--text-secondary)", marginBottom: 12 }}>
                          {live.announcement.mediaType === "none"
                            ? live.announcement.content
                            : live.announcement.mediaType === "image"
                            ? "🖼️ Imagem em tela cheia"
                            : "🎬 Vídeo em tela cheia"}
                        </p>
                      )}

                      {/* Controles de mídia: play/pause, posição e tempo. */}
                      {live.mode === "media" && live.media && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={mediaToggle}>
                              {live.mediaPaused ? "▶ Retomar" : "⏸ Pausar"}
                            </button>
                            <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                              {formatTime(mediaProgress.currentTime)} / {formatTime(mediaProgress.duration)}
                            </span>
                            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "auto" }}>
                              {live.media.kind === "audio" ? "🔊 Áudio" : "🎬 Vídeo"}
                              {live.media.loop && " · em loop"}
                            </span>
                          </div>
                          <input
                            id="media-seek"
                            className="slider"
                            type="range"
                            min={0}
                            max={Math.max(1, mediaProgress.duration)}
                            step={0.5}
                            value={Math.min(mediaProgress.currentTime, mediaProgress.duration || 1)}
                            onChange={(e) => mediaSeek(parseFloat(e.target.value))}
                            title="Arraste para buscar uma posição"
                          />
                        </div>
                      )}

                      {live.mode === "lyrics" && live.song && live.song.lyrics.length > 0 && (
                        <button className="btn btn-secondary btn-sm" style={{ marginBottom: 12 }} onClick={live.isPlaying ? pause : play}>
                          {live.isPlaying ? "⏸ Pausar avanço automático" : "▶ Avanço automático"}
                        </button>
                      )}

                      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <button className="btn btn-secondary" onClick={roteiroPrev}>
                          ⏮ Anterior
                        </button>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={roteiroNext}>
                          Próximo ⏭
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── ZONA 2: o que vem depois ── */}
                  {(() => {
                    const nextStep = live.service!.steps.slice(live.service!.stepIndex + 1).find((s) => !s.skip);
                    return (
                      <div className="panel">
                        <div className="panel-head">
                          <span className="panel-title">
                            <span className="dot next" /> A seguir
                          </span>
                        </div>
                        <div className="panel-body">
                          {nextStep ? (
                            <>
                              <p style={{ fontWeight: 600, fontSize: "1rem" }}>
                                {STEP_ICON[nextStep.kind]} {nextStep.label}
                              </p>
                              <p style={{ fontSize: "0.88rem", color: "var(--text-secondary)" }}>{nextStep.sublabel}</p>
                            </>
                          ) : (
                            <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>Este é o último item do culto</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── ZONA 3: saída (volume e fundo) ── */}
                  <div className="panel">
                    <div className="panel-head">
                      <span className="panel-title">
                        <span className="dot ok" /> Saída
                      </span>
                    </div>
                    <div className="panel-body" style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                      <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                        <label className="field-label" htmlFor="volume-slider">
                          Volume · {Math.round(live.volume * 100)}%
                        </label>
                        <input
                          id="volume-slider"
                          className="slider"
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={live.volume}
                          onChange={(e) => setVolume(parseFloat(e.target.value))}
                        />
                      </div>
                      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                        <label className="field-label" htmlFor="background-select">
                          Vídeo de fundo (atrás da letra)
                        </label>
                        <select
                          id="background-select"
                          className="input-field"
                          style={{ padding: "8px 12px", fontSize: "0.85rem" }}
                          value={live.background || ""}
                          onChange={(e) => setBackground(e.target.value || null)}
                        >
                          <option value="">Nenhum (cor sólida)</option>
                          {mediaLibrary
                            .filter((m) => m.kind === "video")
                            .map((m) => (
                              <option key={m.id} value={m.file}>
                                {m.title}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── ZONA 4: o roteiro inteiro (kanban) ──
                    Cada card é um EVENTO (música inteira, aviso ou mídia),
                    nunca uma linha de letra: dá pra arrastar pra outra
                    posição, pular direto pra ele (clique) ou ocultar sem
                    alterar o culto salvo (checkbox). */}
                <div className="panel" style={{ flex: "0 1 380px", minWidth: 280, maxHeight: 700 }}>
                  <div className="panel-head" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span className="panel-title">Roteiro · {live.service.title}</span>
                      <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
                        {live.service.stepIndex + 1}/{live.service.totalSteps}
                      </span>
                    </div>
                    {/* Indicador de posição: quanto do culto já passou. */}
                    <div className="progress-track">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${((live.service.stepIndex + 1) / Math.max(1, live.service.totalSteps)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="panel-body tight scroll">
                    {live.service.steps.map((step, i) => {
                      const isCurrent = i === live.service!.stepIndex;
                      const isDragOver = dragIndex !== null && dragIndex !== i;
                      return (
                        <div
                          key={i}
                          draggable
                          onClick={() => roteiroGoToStep(i)}
                          onDragStart={(e) => {
                            setDragIndex(i);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragIndex !== null && dragIndex !== i) roteiroReorder(dragIndex, i);
                            setDragIndex(null);
                          }}
                          onDragEnd={() => setDragIndex(null)}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: 8,
                            padding: "9px 10px",
                            borderRadius: 10,
                            cursor: "grab",
                            marginBottom: 4,
                            opacity: step.skip ? 0.4 : dragIndex === i ? 0.4 : 1,
                            background: isCurrent ? "rgba(108,58,237,0.18)" : "transparent",
                            border: isCurrent
                              ? "1px solid rgba(108,58,237,0.4)"
                              : isDragOver
                              ? "1px dashed var(--border-glass)"
                              : "1px solid transparent",
                            transition: "background 0.2s ease, opacity 0.2s ease",
                          }}
                          title="Arraste pra reordenar · clique pra ir direto pra este item"
                        >
                          <span style={{ color: "var(--text-muted)", marginTop: 3, fontSize: "0.8rem" }}>⠿</span>
                          <input
                            type="checkbox"
                            checked={!step.skip}
                            onClick={(e) => e.stopPropagation()}
                            onChange={() => roteiroToggleSkip(i)}
                            style={{ marginTop: 3 }}
                            title={step.skip ? "Voltar a exibir este item" : "Ocultar este item nesta apresentação (não apaga do culto salvo)"}
                          />
                          <div style={{ minWidth: 0 }}>
                            <p style={{ fontSize: "0.88rem", fontWeight: isCurrent ? 700 : 500, textDecoration: step.skip ? "line-through" : "none" }}>
                              {STEP_ICON[step.kind]} {step.label}
                            </p>
                            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {step.sublabel}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid-2">
                {/* Now playing */}
                <div className="glass-card p-lg">
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 4 }}>No ar agora</p>
                  <p style={{ fontWeight: 600, marginBottom: 12 }}>
                    {live.mode === "idle" && "Tela em branco"}
                    {live.mode === "lyrics" && (live.song?.title || "—")}
                    {live.mode === "announcement" && (live.announcement?.title || "—")}
                    {live.mode === "countdown" && "⏱ Contagem regressiva (veja o painel acima)"}
                  </p>
                  {currentLyricText && (
                    <EditableCurrentLine text={currentLyricText} onSave={editCurrentLine} style={{ marginBottom: 16 }} />
                  )}

                  {live.mode === "lyrics" && live.song && (
                    <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                      <button className="btn btn-secondary btn-sm" onClick={prevLine}>
                        ⏮ Anterior
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={live.isPlaying ? pause : play}>
                        {live.isPlaying ? "⏸ Pausar" : "▶ Play"}
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={nextLine}>
                        Próxima ⏭
                      </button>
                    </div>
                  )}

                  {live.mode === "lyrics" && live.song && (
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                      {live.song.lyrics.map((l, i) => (
                        <div
                          key={i}
                          onClick={() => goToLine(i)}
                          style={{
                            padding: "6px 10px",
                            borderRadius: 6,
                            cursor: "pointer",
                            fontSize: "0.85rem",
                            background: i === live.lyricIndex ? "rgba(108,58,237,0.18)" : "transparent",
                            color: i === live.lyricIndex ? "var(--text-primary)" : "var(--text-secondary)",
                            fontWeight: i === live.lyricIndex ? 600 : 400,
                          }}
                        >
                          {l.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Songs & announcements quick access */}
                <div className="glass-card p-lg">
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>
                    🎵 Músicas
                  </p>
                  {songs.length === 0 ? (
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>Nenhuma música cadastrada</p>
                  ) : (
                    <div style={{ marginBottom: 20 }}>
                      {songs.map((s) => {
                        const lineCount = s._count?.lyrics ?? s.lyrics.length;
                        return (
                          <button
                            key={s.id}
                            onClick={() => selectSong(s)}
                            className="sidebar-link"
                            style={{
                              background: live.song?.id === s.id ? "rgba(108,58,237,0.14)" : "transparent",
                            }}
                          >
                            <span>{s.title}</span>
                            {lineCount === 0 && (
                              <span style={{ fontSize: "0.75rem", color: "var(--warning)" }}>⚠ sem letra cadastrada</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" }}>
                    📢 Avisos ativos
                  </p>
                  {announcements.filter((a) => a.active).length === 0 ? (
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Nenhum aviso ativo</p>
                  ) : (
                    announcements
                      .filter((a) => a.active)
                      .map((a) => (
                        <button
                          key={a.id}
                          onClick={() => showAnnouncementLive(a)}
                          className="sidebar-link"
                          style={{
                            background: live.announcement?.id === a.id ? "rgba(108,58,237,0.14)" : "transparent",
                          }}
                        >
                          <span>{a.title}</span>
                        </button>
                      ))
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── CULTOS (roteiro) ──────────────────────────── */}
        {tab === "services" && (
          <>
            <div className="topbar">
              <h1>🗓️ Cultos</h1>
              <button className="btn btn-primary" onClick={() => setShowServiceModal(true)}>
                + Novo Culto
              </button>
            </div>

            {services.length === 0 ? (
              <div className="empty-state glass-card">
                <div className="icon">🗓️</div>
                <p>Nenhum culto cadastrado ainda</p>
                <button className="btn btn-primary" onClick={() => setShowServiceModal(true)}>
                  Criar Primeiro Culto
                </button>
              </div>
            ) : (
              <div className="grid-2">
                {services.map((sv) => (
                  <div key={sv.id} className="glass-card announcement-card">
                    <h3>{sv.title}</h3>
                    <p>
                      {sv.date ? new Date(sv.date).toLocaleDateString("pt-BR") : "Sem data"} · {sv.items.length}{" "}
                      {sv.items.length === 1 ? "item" : "itens"}
                    </p>
                    <div className="meta" style={{ flexWrap: "wrap", gap: 8 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => startService(sv)}>
                        ▶ Apresentar
                      </button>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingService(sv)}>
                          ✏️ Editar
                        </button>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={async () => {
                            const res = await fetch(`/api/services/${sv.id}/duplicate`, {
                              method: "POST",
                              headers: getAuthHeaders(),
                            });
                            if (res.ok) {
                              showToast("success", "Culto duplicado");
                              fetchServices();
                            }
                          }}
                        >
                          🗐 Duplicar
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={async () => {
                            if (!confirm("Remover este culto?")) return;
                            const res = await fetch(`/api/services/${sv.id}`, {
                              method: "DELETE",
                              headers: getAuthHeaders(),
                            });
                            if (res.ok) {
                              showToast("success", "Culto removido");
                              fetchServices();
                            }
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showServiceModal && (
              <ServiceModal
                onClose={() => setShowServiceModal(false)}
                onSaved={(created) => {
                  fetchServices();
                  setShowServiceModal(false);
                  showToast("success", "Culto criado! Agora adicione músicas e avisos.");
                  setEditingService(created);
                }}
              />
            )}

            {editingService && (
              <ServiceEditorModal
                service={editingService}
                songs={songs}
                announcements={announcements}
                mediaLibrary={mediaLibrary}
                onClose={() => setEditingService(null)}
                onSaved={() => {
                  fetchServices();
                  setEditingService(null);
                  showToast("success", "Roteiro salvo!");
                }}
              />
            )}
          </>
        )}

        {/* ─── AVISOS ──────────────────────────────────── */}
        {tab === "announcements" && (
          <>
            <div className="topbar">
              <h1>📢 Avisos</h1>
              <button className="btn btn-primary" onClick={() => setShowAnnouncementModal(true)}>
                + Novo Aviso
              </button>
            </div>

            {announcements.length === 0 ? (
              <div className="empty-state glass-card">
                <div className="icon">📢</div>
                <p>Nenhum aviso cadastrado ainda</p>
                <button className="btn btn-primary" onClick={() => setShowAnnouncementModal(true)}>
                  Criar Primeiro Aviso
                </button>
              </div>
            ) : (
              <div className="grid-2">
                {announcements.map((a) => (
                  <div key={a.id} className="glass-card announcement-card">
                    <h3>{a.title}</h3>
                    {a.mediaType === "image" && a.mediaFile && (
                      <img src={`/api/media/${a.mediaFile}`} alt={a.title} style={{ width: "100%", borderRadius: "var(--radius-sm)", marginBottom: 8, maxHeight: 140, objectFit: "cover" }} />
                    )}
                    {a.mediaType === "video" && a.mediaFile && (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 8 }}>🎬 Vídeo anexado</p>
                    )}
                    <p>{a.content}</p>
                    <div className="meta">
                      <span className={`badge ${a.active ? "badge-approved" : "badge-rejected"}`}>
                        {a.active ? "Ativo" : "Inativo"}
                      </span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={async () => {
                            await fetch(`/api/announcements/${a.id}`, {
                              method: "PUT",
                              headers: getAuthHeaders(),
                              body: JSON.stringify({ active: !a.active }),
                            });
                            fetchAnnouncements();
                          }}
                        >
                          {a.active ? "Desativar" : "Ativar"}
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteAnnouncement(a.id)}>
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showAnnouncementModal && (
              <AnnouncementModal
                onClose={() => setShowAnnouncementModal(false)}
                onSaved={() => {
                  fetchAnnouncements();
                  setShowAnnouncementModal(false);
                  showToast("success", "Aviso criado!");
                }}
              />
            )}
          </>
        )}

        {/* ─── MÚSICAS ─────────────────────────────────── */}
        {tab === "songs" && (
          <>
            <div className="topbar">
              <h1>🎵 Músicas</h1>
              <button className="btn btn-primary" onClick={() => setShowSongModal(true)}>
                + Nova Música
              </button>
            </div>

            {songs.length === 0 ? (
              <div className="empty-state glass-card">
                <div className="icon">🎵</div>
                <p>Nenhuma música cadastrada ainda</p>
                <button className="btn btn-primary" onClick={() => setShowSongModal(true)}>
                  Adicionar Primeira Música
                </button>
              </div>
            ) : (
              <div className="grid-2">
                {songs.map((s) => (
                  <div key={s.id} className="glass-card song-card">
                    <div className="song-card-header">
                      <div>
                        <h3>{s.title}</h3>
                        {s.artist && <p className="artist">{s.artist}</p>}
                        <p className="lyrics-count">{s._count?.lyrics || s.lyrics.length} linhas de letra</p>
                      </div>
                    </div>
                    {s.youtubeId && (
                      <div
                        style={{
                          width: "100%",
                          aspectRatio: "16/9",
                          borderRadius: "var(--radius-sm)",
                          overflow: "hidden",
                          background: "#000",
                        }}
                      >
                        <img
                          src={`https://img.youtube.com/vi/${s.youtubeId}/mqdefault.jpg`}
                          alt={s.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.8 }}
                        />
                      </div>
                    )}
                    <div className="actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingSong(s);
                          setShowLyricsModal(true);
                        }}
                      >
                        ✏️ Letras
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSong(s.id)}>
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showSongModal && (
              <SongModal
                onClose={() => setShowSongModal(false)}
                onSaved={() => {
                  fetchSongs();
                  setShowSongModal(false);
                  showToast("success", "Música adicionada!");
                }}
              />
            )}

            {showLyricsModal && editingSong && (
              <LyricsEditorModal
                song={editingSong}
                onClose={() => {
                  setShowLyricsModal(false);
                  setEditingSong(null);
                }}
                onSaved={() => {
                  fetchSongs();
                  setShowLyricsModal(false);
                  setEditingSong(null);
                  showToast("success", "Letras salvas!");
                }}
              />
            )}
          </>
        )}

        {/* ─── MÍDIA (áudio e vídeo) ───────────────────── */}
        {tab === "media" && (
          <>
            <div className="topbar">
              <h1>🎬 Mídia</h1>
              <button className="btn btn-primary" onClick={() => setShowMediaModal(true)}>
                + Enviar Áudio/Vídeo
              </button>
            </div>

            {mediaLibrary.length === 0 ? (
              <div className="empty-state glass-card">
                <div className="icon">🎬</div>
                <p>Nenhum áudio ou vídeo enviado ainda</p>
                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 16 }}>
                  Envie trilhas, playbacks e vídeos institucionais. Eles podem entrar no roteiro do culto,
                  tocar avulsos, ou servir de fundo animado atrás da letra.
                </p>
                <button className="btn btn-primary" onClick={() => setShowMediaModal(true)}>
                  Enviar Primeiro Arquivo
                </button>
              </div>
            ) : (
              <div className="grid-2">
                {mediaLibrary.map((m) => (
                  <div key={m.id} className="panel">
                    <div className="panel-head">
                      <span className="panel-title">
                        {m.kind === "audio" ? "🔊 Áudio" : "🎬 Vídeo"}
                      </span>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteMedia(m.id)}>
                        Remover
                      </button>
                    </div>
                    <div className="panel-body">
                      <p style={{ fontWeight: 600, marginBottom: 10 }}>{m.title}</p>

                      {m.kind === "video" ? (
                        <video
                          src={`/api/media/${m.file}`}
                          controls
                          preload="metadata"
                          style={{ width: "100%", borderRadius: "var(--radius-sm)", background: "#000", maxHeight: 180 }}
                        />
                      ) : (
                        <audio src={`/api/media/${m.file}`} controls preload="metadata" style={{ width: "100%" }} />
                      )}

                      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.85rem" }}>
                          <input
                            type="checkbox"
                            checked={m.loop}
                            onChange={async (e) => {
                              await fetch(`/api/media-library/${m.id}`, {
                                method: "PUT",
                                headers: getAuthHeaders(),
                                body: JSON.stringify({ loop: e.target.checked }),
                              });
                              fetchMedia();
                            }}
                          />
                          Repetir em loop
                        </label>
                        <button className="btn btn-secondary btn-sm" onClick={() => showMediaLive(m)}>
                          ▶ Colocar no ar
                        </button>
                        {m.kind === "video" && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setBackground(live.background === m.file ? null : m.file)}
                          >
                            {live.background === m.file ? "✕ Tirar do fundo" : "🖼 Usar como fundo"}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {showMediaModal && (
              <MediaModal
                onClose={() => setShowMediaModal(false)}
                onSaved={() => {
                  fetchMedia();
                  setShowMediaModal(false);
                  showToast("success", "Mídia adicionada!");
                }}
              />
            )}
          </>
        )}

        {/* ─── CONFIGURAÇÕES ──────────────────────────── */}
        {tab === "settings" && settings && (
          <SettingsPanel settings={settings} onSaved={(s) => { setSettings(s); showToast("success", "Configurações salvas!"); }} />
        )}
      </main>

      {/* ─── Toast ─────────────────────────────────────── */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.text}</div>}

      {/* ─── Busca global ──────────────────────────────── */}
      {showSearch && (
        <GlobalSearch
          songs={songs}
          announcements={announcements}
          mediaLibrary={mediaLibrary}
          onClose={() => setShowSearch(false)}
          onPick={(kind, item) => {
            if (kind === "song") selectSong(item as Song);
            else if (kind === "announcement") showAnnouncementLive(item as Announcement);
            else showMediaLive(item as MediaItem);
            setShowSearch(false);
            setTab("projecao");
          }}
        />
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════
   SUB-COMPONENTS (Modals)
   ════════════════════════════════════════════════════════ */

function AnnouncementModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mediaFile, setMediaFile] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>("none");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const token = document.cookie.match(/auth-token=([^;]+)/)?.[1] || "";
    const res = await fetch("/api/media/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json();
    if (res.ok) {
      setMediaFile(data.filename);
      setMediaType(data.mediaType);
    } else {
      alert(data.error || "Erro ao enviar arquivo");
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, content, mediaFile, mediaType }),
    });
    if (res.ok) onSaved();
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo Aviso</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="input-label">Título</label>
            <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex: Culto de Domingo" />
          </div>
          <div>
            <label className="input-label">Conteúdo (opcional se houver imagem/vídeo)</label>
            <textarea className="input-field" value={content} onChange={(e) => setContent(e.target.value)} placeholder="Descreva o aviso..." />
          </div>
          <div>
            <label className="input-label">Imagem ou vídeo (opcional)</label>
            <input className="input-field" type="file" accept="image/*,video/*" onChange={handleFileChange} disabled={uploading} />
            {uploading && <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>Enviando...</p>}
            {mediaFile && !uploading && (
              <p style={{ fontSize: "0.8rem", color: "var(--success)", marginTop: 4 }}>
                ✓ {mediaType === "video" ? "Vídeo" : "Imagem"} anexado
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving || uploading}>{saving ? "Salvando..." : "Criar Aviso"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Linha de letra que vira campo de texto ao clicar — corrige um erro de
 * digitação sem sair da apresentação. Enter salva, Esc cancela. O componente
 * não sabe onde salvar; só chama `onSave`, que cuida do socket + da API.
 */
function EditableCurrentLine({
  text,
  onSave,
  style,
}: {
  text: string;
  onSave: (text: string) => void;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  useEffect(() => {
    if (!editing) setDraft(text);
  }, [text, editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== text) onSave(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", ...style }}>
        <input
          className="input-field"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(text);
              setEditing(false);
            }
          }}
          onBlur={commit}
          style={{ flex: 1, fontSize: "inherit" }}
        />
      </div>
    );
  }

  return (
    <p
      onClick={() => setEditing(true)}
      style={{ color: "var(--text-secondary)", cursor: "pointer", ...style }}
      title="Clique para corrigir esta linha — atualiza a tela na hora"
    >
      &ldquo;{text}&rdquo; <span style={{ opacity: 0.4, fontSize: "0.8em" }}>✏️</span>
    </p>
  );
}

type SearchKind = "song" | "announcement" | "media";
interface SearchResult {
  kind: SearchKind;
  id: number;
  title: string;
  sublabel: string;
  item: Song | Announcement | MediaItem;
}

/**
 * Busca global (Ctrl+K): um campo só, cobrindo música/aviso/mídia, com
 * resultado a cada tecla (sem "Enter" pra filtrar), navegável por setas, e
 * Enter já coloca no ar. É a resposta direta ao "achar e colocar no ar em
 * menos de 3 segundos" — não dá pra fazer isso rolando três listas separadas.
 */
function GlobalSearch({
  songs,
  announcements,
  mediaLibrary,
  onClose,
  onPick,
}: {
  songs: Song[];
  announcements: Announcement[];
  mediaLibrary: MediaItem[];
  onClose: () => void;
  onPick: (kind: SearchKind, item: Song | Announcement | MediaItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results: SearchResult[] = (() => {
    const q = query.trim().toLowerCase();
    const songResults: SearchResult[] = songs
      .filter((s) => !q || s.title.toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q))
      .map((s) => ({ kind: "song" as const, id: s.id, title: s.title, sublabel: s.artist || "Música", item: s }));
    const annResults: SearchResult[] = announcements
      .filter((a) => !q || a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q))
      .map((a) => ({ kind: "announcement" as const, id: a.id, title: a.title, sublabel: "Aviso", item: a }));
    const mediaResults: SearchResult[] = mediaLibrary
      .filter((m) => !q || m.title.toLowerCase().includes(q))
      .map((m) => ({ kind: "media" as const, id: m.id, title: m.title, sublabel: m.kind === "audio" ? "Áudio" : "Vídeo", item: m }));
    return [...songResults, ...annResults, ...mediaResults].slice(0, 30);
  })();

  useEffect(() => {
    setSelected(0);
  }, [query]);

  function pick(r: SearchResult) {
    onPick(r.kind, r.item);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selected]) pick(results[selected]);
    }
  }

  const iconFor: Record<SearchKind, string> = { song: "🎵", announcement: "📢", media: "🎬" };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ alignItems: "flex-start", paddingTop: "12vh" }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, padding: 0, overflow: "hidden" }}>
        <input
          ref={inputRef}
          className="input-field"
          style={{ border: "none", borderRadius: 0, borderBottom: "1px solid var(--border-glass)", fontSize: "1.05rem", padding: "16px 20px" }}
          placeholder="Buscar música, aviso ou mídia..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div style={{ maxHeight: "50vh", overflowY: "auto", padding: "6px" }}>
          {results.length === 0 ? (
            <p style={{ padding: "20px", textAlign: "center", color: "var(--text-muted)", fontSize: "0.9rem" }}>
              Nada encontrado
            </p>
          ) : (
            results.map((r, i) => (
              <div
                key={`${r.kind}-${r.id}`}
                onClick={() => pick(r)}
                onMouseEnter={() => setSelected(i)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: i === selected ? "rgba(108,58,237,0.18)" : "transparent",
                }}
              >
                <span style={{ fontSize: "1rem" }}>{iconFor[r.kind]}</span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <p style={{ fontSize: "0.9rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.title}
                  </p>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{r.sublabel}</p>
                </div>
                {i === selected && (
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", fontFamily: "monospace" }}>Enter ↵</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Contagem regressiva — funciona independente de ter um culto em apresentação
 * (ex.: "entra em 5 minutos", antes de qualquer coisa começar). Quando ativa,
 * mostra o relógio rodando e um botão de parar; quando não, o formulário
 * pra escolher duração e uma mensagem opcional.
 */
function CountdownControl({
  active,
  endsAt,
  title,
  onStart,
  onStop,
}: {
  active: boolean;
  endsAt: number | null;
  title: string | null;
  onStart: (seconds: number, title: string) => void;
  onStop: () => void;
}) {
  const [minutes, setMinutes] = useState(5);
  const [label, setLabel] = useState("O culto começa em breve");

  if (active && endsAt) {
    const remaining = formatCountdown(endsAt - Date.now());
    const done = endsAt - Date.now() <= 0;
    return (
      <div className="panel accent mb-lg">
        <div className="panel-head">
          <span className="panel-title">
            <span className="dot live" /> Contagem regressiva
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onStop}>
            ✕ Parar
          </button>
        </div>
        <div className="panel-body" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <p style={{ fontSize: "2.2rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: done ? "var(--danger)" : "var(--text-primary)" }}>
            {remaining}
          </p>
          {title && <p style={{ color: "var(--text-secondary)" }}>{title}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-md mb-lg">
      <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase" }}>
        ⏱ Contagem regressiva
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input-field"
          type="number"
          min={1}
          max={180}
          value={minutes}
          onChange={(e) => setMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
          style={{ width: 80 }}
        />
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>minutos</span>
        <input
          className="input-field"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Mensagem (opcional)"
          style={{ flex: "1 1 200px", minWidth: 160 }}
        />
        <button className="btn btn-primary btn-sm" onClick={() => onStart(minutes * 60, label)}>
          ▶ Iniciar
        </button>
      </div>
    </div>
  );
}

function MediaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const [kind, setKind] = useState<"audio" | "video" | null>(null);
  const [loop, setLoop] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setError("");
    setUploading(true);
    const form = new FormData();
    form.append("file", picked);
    const token = document.cookie.match(/auth-token=([^;]+)/)?.[1] || "";
    const res = await fetch("/api/media/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json();
    if (res.ok && (data.mediaType === "audio" || data.mediaType === "video")) {
      setFile(data.filename);
      setKind(data.mediaType);
      // Sugere o nome do arquivo como título, se ainda estiver vazio.
      if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, ""));
    } else if (res.ok) {
      setError("Este arquivo é uma imagem. Imagens entram como Aviso, na aba Avisos.");
    } else {
      setError(data.error || "Erro ao enviar arquivo");
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !kind) {
      setError("Envie um arquivo de áudio ou vídeo primeiro");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/media-library", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, kind, file, loop }),
    });
    if (res.ok) onSaved();
    else setError("Erro ao salvar");
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nova Mídia</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="input-label">Arquivo de áudio ou vídeo *</label>
            <input
              className="input-field"
              type="file"
              accept="audio/*,video/*"
              onChange={handleFileChange}
              disabled={uploading}
            />
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
              Áudio: mp3, wav, ogg, m4a (até 100 MB) · Vídeo: mp4, webm, ogv (até 300 MB)
            </p>
            {uploading && <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>Enviando...</p>}
            {file && !uploading && (
              <p style={{ fontSize: "0.8rem", color: "var(--success)", marginTop: 4 }}>
                ✓ {kind === "audio" ? "Áudio" : "Vídeo"} enviado
              </p>
            )}
          </div>
          <div>
            <label className="input-label">Nome</label>
            <input
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Ex: Trilha de abertura"
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
            <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
            Repetir em loop (útil pra fundo animado e trilha de espera)
          </label>
          {error && <p style={{ fontSize: "0.85rem", color: "var(--danger)" }}>{error}</p>}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving || uploading || !file}>
              {saving ? "Salvando..." : "Adicionar Mídia"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SongModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/songs", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, artist, youtubeUrl }),
    });
    if (res.ok) onSaved();
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nova Música</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="input-label">Título da Música *</label>
            <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex: Grande é o Senhor" />
          </div>
          <div>
            <label className="input-label">Artista</label>
            <input className="input-field" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Ex: Adhemar de Campos" />
          </div>
          <div>
            <label className="input-label">URL do YouTube</label>
            <input className="input-field" value={youtubeUrl} onChange={(e) => setYoutubeUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=..." />
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
              Cole a URL para importar legendas automaticamente.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Salvando..." : "Adicionar Música"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LyricsEditorModal({ song, onClose, onSaved }: { song: Song; onClose: () => void; onSaved: () => void }) {
  const [lyrics, setLyrics] = useState<LyricLine[]>(song.lyrics || []);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [mode, setMode] = useState<"editor" | "bulk">("editor");

  async function fetchFromYoutube() {
    if (!song.youtubeUrl) return alert("Esta música não tem URL do YouTube");
    setFetching(true);
    try {
      const res = await fetch("/api/songs/fetch-lyrics", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ youtubeUrl: song.youtubeUrl }),
      });
      const data = await res.json();
      if (res.ok && data.lyrics) {
        setLyrics(data.lyrics);
      } else {
        alert(data.error || "Não foi possível extrair legendas");
      }
    } catch {
      alert("Erro ao buscar legendas do YouTube");
    }
    setFetching(false);
  }

  function addLine() {
    const lastEnd = lyrics.length > 0 ? lyrics[lyrics.length - 1].endMs : 0;
    setLyrics([...lyrics, { startMs: lastEnd, endMs: lastEnd + 4000, text: "", order: lyrics.length }]);
  }

  function removeLine(index: number) {
    setLyrics(lyrics.filter((_, i) => i !== index));
  }

  function updateLine(index: number, field: keyof LyricLine, value: string | number) {
    const updated = lyrics.map((line, i) => (i !== index ? line : { ...line, [field]: value }));
    setLyrics(updated);
  }

  function importBulkText() {
    const lines = bulkText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
    const newLyrics = lines.map((text, i) => ({ startMs: i * 4000, endMs: (i + 1) * 4000, text, order: i }));
    setLyrics(newLyrics);
    setMode("editor");
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/songs/${song.id}/lyrics`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        lyrics: lyrics.map((l, i) => ({ startMs: l.startMs, endMs: l.endMs, text: l.text, order: i })),
      }),
    });
    if (res.ok) onSaved();
    setSaving(false);
  }

  function formatMs(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <h2>Letras: {song.title}</h2>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {song.youtubeUrl && (
            <button className="btn btn-secondary btn-sm" onClick={fetchFromYoutube} disabled={fetching}>
              {fetching ? "Buscando..." : "🔍 Importar do YouTube"}
            </button>
          )}
          <a
            className="btn btn-secondary btn-sm"
            href={`https://www.letras.mus.br/?q=${encodeURIComponent(`${song.title} ${song.artist || ""}`.trim())}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Abre a busca em letras.mus.br numa nova aba, pra você copiar e colar a letra abaixo"
          >
            🔍 Buscar letra
          </a>
          <button className="btn btn-secondary btn-sm" onClick={() => setMode(mode === "editor" ? "bulk" : "editor")}>
            {mode === "editor" ? "📝 Colar Texto" : "✏️ Editor"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={addLine}>
            + Adicionar Linha
          </button>
        </div>

        {mode === "bulk" && (
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">Cole a letra completa (uma frase por linha)</label>
            <textarea
              className="input-field"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              style={{ minHeight: 200 }}
              placeholder={"Grande é o Senhor\ne mui digno de louvor\nNa cidade do nosso Deus\n..."}
            />
            <button className="btn btn-primary btn-sm mt-sm" onClick={importBulkText}>
              Importar Linhas
            </button>
          </div>
        )}

        {mode === "editor" && (
          <div style={{ maxHeight: 400, overflowY: "auto", marginBottom: 16 }}>
            {lyrics.length === 0 ? (
              <div className="empty-state" style={{ padding: 24 }}>
                <p>Nenhuma letra adicionada. Use os botões acima para importar ou adicionar.</p>
              </div>
            ) : (
              lyrics.map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: 24 }}>{i + 1}</span>
                  <input
                    className="input-field"
                    style={{ flex: 1, padding: "8px 12px", fontSize: "0.85rem" }}
                    value={line.text}
                    onChange={(e) => updateLine(i, "text", e.target.value)}
                    placeholder="Texto da linha..."
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    {formatMs(line.startMs)} → {formatMs(line.endMs)}
                  </span>
                  <button className="btn btn-danger btn-sm btn-icon" style={{ width: 32, height: 32, fontSize: "0.8rem" }} onClick={() => removeLine(i)}>
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Letras"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onSaved }: { settings: Settings; onSaved: (s: Settings) => void }) {
  const [name, setName] = useState(settings.name);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor);
  const [bgColor, setBgColor] = useState(settings.bgColor);
  const [textColor, setTextColor] = useState(settings.textColor);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ name, primaryColor, secondaryColor, bgColor, textColor, logoUrl: logoUrl || null }),
    });
    if (res.ok) {
      const data = await res.json();
      onSaved(data);
    }
    setSaving(false);
  }

  return (
    <>
      <div className="topbar">
        <h1>⚙️ Configurações</h1>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>

      <div className="glass-card p-xl" style={{ maxWidth: 600 }}>
        <h3 style={{ marginBottom: 20 }}>Identidade Visual</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <label className="input-label">Nome da Igreja</label>
            <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <label className="input-label">URL do Logo</label>
            <input className="input-field" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="input-label">Cor Primária</label>
              <div className="color-picker-group">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                <input className="input-field" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
            <div>
              <label className="input-label">Cor Secundária</label>
              <div className="color-picker-group">
                <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                <input className="input-field" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
            <div>
              <label className="input-label">Cor de Fundo (projeção)</label>
              <div className="color-picker-group">
                <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
                <input className="input-field" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
            <div>
              <label className="input-label">Cor do Texto (projeção)</label>
              <div className="color-picker-group">
                <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
                <input className="input-field" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
          </div>

          <div>
            <label className="input-label">Preview da Projeção</label>
            <div style={{ background: bgColor, color: textColor, padding: 24, borderRadius: "var(--radius-lg)", border: "1px solid var(--border-glass)", textAlign: "center" }}>
              <p style={{ fontSize: "1.1rem", fontWeight: 700 }}>Texto de exemplo</p>
              <p style={{ fontSize: "0.9rem", opacity: 0.7, marginTop: 8 }}>{name}</p>
            </div>
          </div>
        </div>
      </div>

      <BackupCard />
    </>
  );
}

function BackupCard() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backup/export", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match ? match[1] : "arauto-backup.zip";
      // Sem <a download> aqui não funciona em todo navegador — cria o link,
      // clica sozinho e descarta, é o jeito padrão de baixar um blob gerado.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: `Backup baixado: ${filename}` });
    } catch {
      setMessage({ type: "error", text: "Erro ao gerar o backup" });
    }
    setExporting(false);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;

    if (
      !confirm(
        "Isso vai SUBSTITUIR todas as músicas, avisos, mídias e contas atuais pelos dados do backup.\n\n" +
          "Um backup de segurança dos dados atuais é salvo automaticamente antes, então dá pra voltar atrás. Continuar?"
      )
    ) {
      return;
    }

    setImporting(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = document.cookie.match(/auth-token=([^;]+)/)?.[1] || "";
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `${data.message} (backup de segurança: ${data.safetyBackup})` });
        setTimeout(() => window.location.reload(), 2500);
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao importar o backup" });
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao importar o backup" });
    }
    setImporting(false);
  }

  return (
    <div className="glass-card p-xl" style={{ maxWidth: 600, marginTop: 24 }}>
      <h3 style={{ marginBottom: 6 }}>Dados e Backup</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 20 }}>
        Todos os dados (músicas, letras, avisos, mídia, contas) ficam em arquivos locais — nenhuma nuvem envolvida.
        Exporte de vez em quando, principalmente antes de trocar de computador.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
          {exporting ? "Gerando..." : "⬇ Exportar Backup (.zip)"}
        </button>
        <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          {importing ? "Restaurando..." : "⬆ Importar Backup (.zip)"}
        </button>
        <input ref={fileInputRef} type="file" accept=".zip" hidden onChange={handleImportFile} />
      </div>
      {message && (
        <p style={{ fontSize: "0.85rem", marginTop: 12, color: message.type === "success" ? "var(--success)" : "var(--danger)" }}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function ServiceModal({ onClose, onSaved }: { onClose: () => void; onSaved: (service: Service) => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/services", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, date: date || null }),
    });
    const data = await res.json();
    if (res.ok) onSaved(data);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo Culto</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="input-label">Nome do culto</label>
            <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex: Culto de Oração" />
          </div>
          <div>
            <label className="input-label">Data (opcional)</label>
            <input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Criando..." : "Criar Culto"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ServiceEditorModal({
  service,
  songs,
  announcements,
  mediaLibrary,
  onClose,
  onSaved,
}: {
  service: Service;
  songs: Song[];
  announcements: Announcement[];
  mediaLibrary: MediaItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<ServiceItem[]>(service.items);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<ServiceItemType | null>(null);

  function addItem(type: ServiceItemType, refId: number) {
    setItems([...items, { id: crypto.randomUUID(), type, refId }]);
    setPicker(null);
  }
  function removeItem(id: string) {
    setItems(items.filter((i) => i.id !== id));
  }
  function moveItem(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/services/${service.id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ items }),
    });
    if (res.ok) onSaved();
    setSaving(false);
  }

  function labelFor(item: ServiceItem): string {
    if (item.type === "song") {
      const s = songs.find((x) => x.id === item.refId);
      return s ? `🎵 ${s.title}` : "🎵 (música removida)";
    }
    if (item.type === "media") {
      const m = mediaLibrary.find((x) => x.id === item.refId);
      return m ? `🎬 ${m.title}` : "🎬 (mídia removida)";
    }
    const a = announcements.find((x) => x.id === item.refId);
    return a ? `📢 ${a.title}` : "📢 (aviso removido)";
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <h2>Roteiro: {service.title}</h2>

        <div style={{ maxHeight: 340, overflowY: "auto", marginBottom: 16 }}>
          {items.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <p>Nenhum item ainda. Adicione músicas e avisos abaixo, na ordem que serão apresentados.</p>
            </div>
          ) : (
            items.map((item, i) => (
              <div key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: 24 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: "0.9rem" }}>{labelFor(item)}</span>
                <button className="btn btn-secondary btn-sm btn-icon" style={{ width: 32, height: 32 }} onClick={() => moveItem(i, -1)} disabled={i === 0}>↑</button>
                <button className="btn btn-secondary btn-sm btn-icon" style={{ width: 32, height: 32 }} onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}>↓</button>
                <button className="btn btn-danger btn-sm btn-icon" style={{ width: 32, height: 32 }} onClick={() => removeItem(item.id)}>×</button>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setPicker(picker === "song" ? null : "song")}>
            + Adicionar Música
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setPicker(picker === "announcement" ? null : "announcement")}>
            + Adicionar Aviso
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setPicker(picker === "media" ? null : "media")}>
            + Adicionar Mídia
          </button>
        </div>

        {picker === "media" && (
          <div className="glass-card p-md mb-lg" style={{ maxHeight: 220, overflowY: "auto" }}>
            {mediaLibrary.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Nenhum áudio/vídeo enviado ainda — envie um na aba Mídia.
              </p>
            ) : (
              mediaLibrary.map((m) => (
                <button key={m.id} className="sidebar-link" onClick={() => addItem("media", m.id)}>
                  <span>
                    {m.kind === "audio" ? "🔊" : "🎬"} {m.title}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {picker === "song" && (
          <div className="glass-card p-md mb-lg" style={{ maxHeight: 220, overflowY: "auto" }}>
            {songs.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Nenhuma música salva ainda — crie uma na aba Músicas.</p>
            ) : (
              songs.map((s) => (
                <button key={s.id} className="sidebar-link" onClick={() => addItem("song", s.id)}>
                  <span>🎵 {s.title}</span>
                </button>
              ))
            )}
          </div>
        )}

        {picker === "announcement" && (
          <div className="glass-card p-md mb-lg" style={{ maxHeight: 220, overflowY: "auto" }}>
            {announcements.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Nenhum aviso salvo ainda — crie um na aba Avisos.</p>
            ) : (
              announcements.map((a) => (
                <button key={a.id} className="sidebar-link" onClick={() => addItem("announcement", a.id)}>
                  <span>📢 {a.title}</span>
                </button>
              ))
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Roteiro"}
          </button>
        </div>
      </div>
    </div>
  );
}
