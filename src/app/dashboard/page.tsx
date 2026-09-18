"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import type {
  Settings,
  UserInfo,
  Announcement,
  AnnouncementTemplate,
  Song,
  MediaItem,
  LiveState,
  ServiceItemType,
  ServiceItem,
  Service,
  LibraryFilter,
} from "./types";
import { getAuthHeaders, getAuthToken, formatCountdown, formatTime, formatTimestamp, STEP_LABEL } from "./utils";
import { Icon } from "./components/Icon";
import { EditableCurrentLine } from "./components/EditableCurrentLine";
import { GlobalSearch } from "./components/GlobalSearch";
import { CountdownControl } from "./components/CountdownControl";
import { MediaModal } from "./components/MediaModal";
import { SongModal, LyricsEditorModal } from "./components/SongModals";
import { AnnouncementModal, TemplateModal, UseTemplateModal } from "./components/AnnouncementModals";
import { ServiceModal, ServiceEditorModal } from "./components/ServiceModals";
import { SettingsModal } from "./components/SettingsModal";

export default function DashboardPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LibraryFilter>("songs");
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // Data
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [templates, setTemplates] = useState<AnnouncementTemplate[]>([]);
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
  const [editingTemplate, setEditingTemplate] = useState<AnnouncementTemplate | "new" | null>(null);
  const [templateToUse, setTemplateToUse] = useState<AnnouncementTemplate | null>(null);
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
  // Popover da contagem regressiva, aberto a partir do Timer na dock.
  const [showCountdownPanel, setShowCountdownPanel] = useState(false);
  // Filtro de texto da biblioteca (campo no topo da coluna da esquerda).
  const [librarySearch, setLibrarySearch] = useState("");
  // Texto digitado na busca da toolbar — abre a busca global já preenchida.
  const [globalQuery, setGlobalQuery] = useState("");
  // Culto que a coluna do roteiro está mostrando quando nada está no ar.
  const [activeServiceId, setActiveServiceId] = useState<number | null>(null);
  // Em telas estreitas o roteiro vira uma gaveta; isto diz se ela está aberta.
  const [roteiroOpen, setRoteiroOpen] = useState(false);
  // Música aberta na coluna de detalhe — é a que se está PREPARANDO, que nem
  // sempre é a que está no ar (live.song).
  const [detailSongId, setDetailSongId] = useState<number | null>(null);

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

  const fetchTemplates = useCallback(() => {
    fetch("/api/announcement-templates", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setTemplates)
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
    fetchTemplates();
    fetchSongs();
    fetchServices();
    fetchMedia();
  }, [user, fetchAnnouncements, fetchTemplates, fetchSongs, fetchServices, fetchMedia]);

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
      if (item.skip) continue; // desmarcado no roteiro: não entra nesta apresentação
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
  }
  // ─── Roteiro em preparo (culto ainda não apresentado) ──
  // Edita os itens do culto salvo — é o que a coluna da direita mostra
  // enquanto nada está no ar.
  async function saveServiceItems(service: Service, items: ServiceItem[], okMessage?: string) {
    const res = await fetch(`/api/services/${service.id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ items }),
    });
    if (res.ok) {
      fetchServices();
      if (okMessage) showToast("success", okMessage);
    } else {
      showToast("error", "Erro ao salvar o roteiro");
    }
  }

  function addToRoteiro(service: Service | null, type: ServiceItemType, refId: number, label: string) {
    if (!service) {
      showToast("error", "Crie um culto primeiro (filtro Cultos)");
      return;
    }
    saveServiceItems(service, [...service.items, { id: crypto.randomUUID(), type, refId }], `"${label}" foi para ${service.title}`);
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

  const filters: { id: LibraryFilter; icon: string; label: string }[] = [
    { id: "songs", icon: "lyrics", label: "Letras" },
    { id: "announcements", icon: "bell", label: "Avisos" },
    { id: "media", icon: "media", label: "Mídia" },
    { id: "services", icon: "layers", label: "Cultos" },
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

  // Culto que a coluna da direita mostra enquanto nada está no ar.
  const activeService = services.find((s) => s.id === activeServiceId) ?? services[0] ?? null;
  // Música aberta na coluna de detalhe: a escolhida na lista, senão a do ar.
  const detailSong = songs.find((s) => s.id === detailSongId) ?? live.song ?? songs[0] ?? null;

  const q = librarySearch.trim().toLowerCase();
  const visibleSongs = songs.filter((s) => !q || s.title.toLowerCase().includes(q) || (s.artist || "").toLowerCase().includes(q));
  const visibleAnnouncements = announcements.filter((a) => !q || a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q));
  const visibleMedia = mediaLibrary.filter((m) => !q || m.title.toLowerCase().includes(q));
  const visibleServices = services.filter((sv) => !q || sv.title.toLowerCase().includes(q));

  // Rótulo de um item do roteiro em preparo (o culto salvo, sem estar no ar).
  function serviceItemLabel(item: ServiceItem): { label: string; icon: string } {
    if (item.type === "song") {
      const s = songs.find((x) => x.id === item.refId);
      return { label: s ? s.title : "(música removida)", icon: "lyrics" };
    }
    if (item.type === "media") {
      const m = mediaLibrary.find((x) => x.id === item.refId);
      return { label: m ? m.title : "(mídia removida)", icon: "media" };
    }
    const a = announcements.find((x) => x.id === item.refId);
    return { label: a ? a.title : "(aviso removido)", icon: "bell" };
  }

  // O relógio da dock: o que falta da contagem regressiva, senão a posição
  // da mídia no ar, senão zerado.
  const dockTimer =
    live.mode === "countdown" && live.countdownEndsAt
      ? formatCountdown(live.countdownEndsAt - Date.now())
      : live.mode === "media"
      ? formatTime(mediaProgress.currentTime)
      : "00:00";

  return (
    <>
      <div className="cockpit">
        {/* ─── Toolbar ──────────────────────────────────── */}
        <header className="cockpit-toolbar">
          <img src="/arauto-logo.png" alt="" className="toolbar-logo" width={31} height={31} />
          <span className="toolbar-brand">Arauto</span>

          {/* Busca global: digitar aqui abre o modal já com o texto. */}
          <div className="toolbar-search">
            <Icon name="search" />
            <input
              type="text"
              placeholder="Buscar música, aviso ou mídia — Ctrl+K"
              value={globalQuery}
              onChange={(e) => {
                setGlobalQuery(e.target.value);
                if (e.target.value) setShowSearch(true);
              }}
              onClick={() => setShowSearch(true)}
            />
          </div>

          <nav className="toolbar-filters">
            {filters.map((f) => (
              <button
                key={f.id}
                className={`filter-tab ${filter === f.id ? "active" : ""}`}
                onClick={() => setFilter(f.id)}
              >
                <Icon name={f.icon} />
                <span className="filter-label">{f.label}</span>
              </button>
            ))}
          </nav>

          <div className="toolbar-spacer" />

          {/* Quantas telas de cada tipo estão conectadas agora — pra saber
              ANTES do culto se o projetor está mesmo recebendo o sinal. */}
          <div
            className="toolbar-connections"
            title={`Telas conectadas: ${connections.admin} painel(is), ${connections.projection} projeção, ${connections.stage} stage`}
          >
            <span className={`conn-dot ${connections.admin > 1 ? "warn" : "on"}`} />
            <span className={`conn-dot ${connections.projection > 0 ? "on" : "off"}`} />
            <span className={`conn-dot ${connections.stage > 0 ? "on" : "off"}`} />
          </div>

          <div className="toolbar-actions">
            <button
              className="toolbar-icon-btn roteiro-toggle"
              onClick={() => setRoteiroOpen((v) => !v)}
              title="Roteiro do culto"
            >
              <Icon name="checklist" />
            </button>
            <button className="toolbar-icon-btn" onClick={openStageWindow} title="Abrir Stage View (monitor de confiança)">
              <Icon name="stage" />
            </button>
            <button className="toolbar-icon-btn" onClick={() => setShowSettingsModal(true)} title="Configurações">
              <Icon name="settings" />
            </button>
            <button className="toolbar-cta" onClick={openProjectionWindow}>
              <Icon name="projection" />
              Abrir Projeção
            </button>
          </div>
        </header>

        {/* ─── Corpo: biblioteca + roteiro ───────────────── */}
        <div className="cockpit-body">
          <section className="cockpit-card cockpit-library">
            <div className={`library-split ${filter === "songs" ? "" : "single"}`}>
              <div className="library-header">
                <div className="library-filter">
                <Icon name="search" />
                <input
                  type="text"
                  placeholder="Buscar ou filtrar..."
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                />
              </div>
              {filter === "songs" && (
                <button className="act-btn primary" onClick={() => setShowSongModal(true)}>
                  <Icon name="plus" /> Nova Música
                </button>
              )}
              {filter === "announcements" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="act-btn ghost" onClick={() => setEditingTemplate("new")}>
                    <Icon name="plus" /> Modelo
                  </button>
                  <button className="act-btn primary" onClick={() => setShowAnnouncementModal(true)}>
                    <Icon name="plus" /> Novo Aviso
                  </button>
                </div>
              )}
              {filter === "media" && (
                <button className="act-btn primary" onClick={() => setShowMediaModal(true)}>
                  <Icon name="plus" /> Enviar Áudio/Vídeo
                </button>
              )}
              {filter === "services" && (
                <button className="act-btn primary" onClick={() => setShowServiceModal(true)}>
                  <Icon name="plus" /> Novo Culto
                </button>
              )}
                </div>

              {/* ── Lista (coluna 1) ── */}
              <div className="library-list">
                {/* ─── LETRAS ─────────────────────────── */}
                {filter === "songs" &&
                  (visibleSongs.length === 0 ? (
                    <div className="roteiro-empty">
                      {songs.length === 0 ? "Nenhuma música cadastrada ainda." : "Nada encontrado com esse filtro."}
                    </div>
                  ) : (
                    visibleSongs.map((s) => {
                      const lineCount = s._count?.lyrics ?? s.lyrics.length;
                      return (
                        <div
                          key={s.id}
                          className={`library-item ${detailSong?.id === s.id ? "active" : ""}`}
                          onClick={() => setDetailSongId(s.id)}
                        >
                          <button
                            className="library-item-menu"
                            title="Remover música"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSong(s.id);
                            }}
                          >
                            <Icon name="more" />
                          </button>
                          <p className="library-item-title">{s.title}</p>
                          <p className="library-item-sub">
                            {s.artist || "Sem artista"} · {lineCount} {lineCount === 1 ? "linha" : "linhas"}
                            {lineCount === 0 && " · sem letra"}
                          </p>
                          <div className="library-item-actions">
                            <button
                              className="act-btn primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectSong(s);
                              }}
                            >
                              <Icon name="play" /> Projetar
                            </button>
                            <button
                              className="act-btn ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                addToRoteiro(activeService, "song", s.id, s.title);
                              }}
                            >
                              <Icon name="plus" /> Adicionar ao Roteiro
                            </button>
                            <button
                              className="act-btn ghost"
                              title="Editar letras"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingSong(s);
                                setShowLyricsModal(true);
                              }}
                            >
                              <Icon name="pencil" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ))}

                {/* ─── AVISOS ─────────────────────────── */}
                {filter === "announcements" && (
                  <>
                    {/* Modelos reaproveitáveis: um rascunho com {{variáveis}}
                        (ex.: {{data}}) que vira um aviso de verdade ao ser usado. */}
                    {templates.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <p className="field-label">Modelos de aviso</p>
                        {templates.map((t) => (
                          <div key={t.id} className="library-item">
                            <p className="library-item-title">{t.title}</p>
                            <p className="library-item-sub">{t.content}</p>
                            <div className="library-item-actions">
                              <button className="act-btn primary" onClick={() => setTemplateToUse(t)}>
                                Usar modelo
                              </button>
                              <button className="act-btn ghost" onClick={() => setEditingTemplate(t)}>
                                <Icon name="pencil" /> Editar
                              </button>
                              <button
                                className="act-btn ghost danger"
                                onClick={async () => {
                                  if (!confirm(`Remover o modelo "${t.title}"?`)) return;
                                  await fetch(`/api/announcement-templates/${t.id}`, { method: "DELETE", headers: getAuthHeaders() });
                                  fetchTemplates();
                                }}
                              >
                                <Icon name="trash" />
                              </button>
                            </div>
                          </div>
                        ))}
                        <p className="field-label" style={{ marginTop: 18 }}>
                          Avisos
                        </p>
                      </div>
                    )}

                    {visibleAnnouncements.length === 0 ? (
                      <div className="roteiro-empty">
                        {announcements.length === 0 ? "Nenhum aviso cadastrado ainda." : "Nada encontrado com esse filtro."}
                      </div>
                    ) : (
                      visibleAnnouncements.map((a) => (
                        <div key={a.id} className={`library-item ${live.announcement?.id === a.id ? "active" : ""}`}>
                          <button className="library-item-menu" title="Remover aviso" onClick={() => handleDeleteAnnouncement(a.id)}>
                            <Icon name="more" />
                          </button>
                          <p className="library-item-title">{a.title}</p>
                          <p className="library-item-sub">
                            {a.active ? "Ativo" : "Inativo"}
                            {a.mediaType === "image" && " · imagem"}
                            {a.mediaType === "video" && " · vídeo"}
                            {a.mediaType === "none" && ` · ${a.content}`}
                          </p>
                          <div className="library-item-actions">
                            <button className="act-btn primary" onClick={() => showAnnouncementLive(a)}>
                              <Icon name="play" /> Projetar
                            </button>
                            <button className="act-btn ghost" onClick={() => addToRoteiro(activeService, "announcement", a.id, a.title)}>
                              <Icon name="plus" /> Adicionar ao Roteiro
                            </button>
                            <button
                              className="act-btn ghost"
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
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* ─── MÍDIA ──────────────────────────── */}
                {filter === "media" &&
                  (visibleMedia.length === 0 ? (
                    <div className="roteiro-empty">
                      {mediaLibrary.length === 0
                        ? "Nenhum áudio ou vídeo enviado ainda. Envie trilhas, playbacks e vídeos — eles entram no roteiro, tocam avulsos ou viram fundo animado atrás da letra."
                        : "Nada encontrado com esse filtro."}
                    </div>
                  ) : (
                    visibleMedia.map((m) => (
                      <div key={m.id} className={`library-item ${live.media?.id === m.id ? "active" : ""}`}>
                        <button className="library-item-menu" title="Remover mídia" onClick={() => handleDeleteMedia(m.id)}>
                          <Icon name="more" />
                        </button>
                        <p className="library-item-title">{m.title}</p>
                        <p className="library-item-sub">
                          {m.kind === "audio" ? "Áudio" : "Vídeo"}
                          {m.loop && " · em loop"}
                        </p>
                        {m.kind === "video" ? (
                          <video
                            src={`/api/media/${m.file}`}
                            controls
                            preload="metadata"
                            style={{ width: "100%", borderRadius: "var(--radius-sm)", background: "#000", maxHeight: 160, marginTop: 10 }}
                          />
                        ) : (
                          <audio src={`/api/media/${m.file}`} controls preload="metadata" style={{ width: "100%", marginTop: 10 }} />
                        )}
                        <div className="library-item-actions">
                          <button className="act-btn primary" onClick={() => showMediaLive(m)}>
                            <Icon name="play" /> Projetar
                          </button>
                          <button className="act-btn ghost" onClick={() => addToRoteiro(activeService, "media", m.id, m.title)}>
                            <Icon name="plus" /> Adicionar ao Roteiro
                          </button>
                          {m.kind === "video" && (
                            <button
                              className="act-btn ghost"
                              onClick={() => setBackground(live.background === m.file ? null : m.file)}
                            >
                              {live.background === m.file ? "Tirar do fundo" : "Usar como fundo"}
                            </button>
                          )}
                          <label className="act-btn ghost" style={{ cursor: "pointer" }}>
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
                            Loop
                          </label>
                        </div>
                      </div>
                    ))
                  ))}

                {/* ─── CULTOS ─────────────────────────── */}
                {filter === "services" &&
                  (visibleServices.length === 0 ? (
                    <div className="roteiro-empty">
                      {services.length === 0 ? "Nenhum culto cadastrado ainda." : "Nada encontrado com esse filtro."}
                    </div>
                  ) : (
                    visibleServices.map((sv) => (
                      <div
                        key={sv.id}
                        className={`library-item ${activeService?.id === sv.id ? "active" : ""}`}
                        onClick={() => setActiveServiceId(sv.id)}
                      >
                        <p className="library-item-title">{sv.title}</p>
                        <p className="library-item-sub">
                          {sv.date ? new Date(sv.date).toLocaleDateString("pt-BR") : "Sem data"} · {sv.items.length}{" "}
                          {sv.items.length === 1 ? "item" : "itens"}
                        </p>
                        <div className="library-item-actions">
                          <button
                            className="act-btn primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              startService(sv);
                            }}
                          >
                            <Icon name="play" /> Apresentar
                          </button>
                          <button
                            className="act-btn ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingService(sv);
                            }}
                          >
                            <Icon name="pencil" /> Editar
                          </button>
                          <button
                            className="act-btn ghost"
                            onClick={async (e) => {
                              e.stopPropagation();
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
                            <Icon name="copy" /> Duplicar
                          </button>
                          <button
                            className="act-btn ghost danger"
                            onClick={async (e) => {
                              e.stopPropagation();
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
                            <Icon name="trash" />
                          </button>
                        </div>
                      </div>
                    ))
                  ))}
              </div>

              {/* ── Detalhe da música: letra com marca de tempo (coluna 2) ── */}
              {filter === "songs" && (
                <div className="library-detail">
                  {!detailSong ? (
                    <div className="roteiro-empty">Escolha uma música na lista para ver a letra.</div>
                  ) : (
                    <>
                      <div className="library-item" style={{ cursor: "default" }}>
                        <p className="library-item-title">{detailSong.title}</p>
                        <p className="library-item-sub">{detailSong.artist || settings?.name || "Arauto"}</p>
                        <div className="library-item-actions">
                          <button className="act-btn primary" onClick={() => selectSong(detailSong)}>
                            <Icon name="play" /> Projetar
                          </button>
                          <button
                            className="act-btn ghost"
                            onClick={() => addToRoteiro(activeService, "song", detailSong.id, detailSong.title)}
                          >
                            <Icon name="plus" /> Adicionar ao Roteiro
                          </button>
                          <button
                            className="act-btn ghost"
                            onClick={() => {
                              setEditingSong(detailSong);
                              setShowLyricsModal(true);
                            }}
                          >
                            <Icon name="pencil" /> Letras
                          </button>
                        </div>
                      </div>

                      <div className="lyrics-pane">
                        {detailSong.lyrics.length === 0 ? (
                          <div className="roteiro-empty">
                            Esta música ainda não tem letra.
                            <br />
                            Use &ldquo;Letras&rdquo; para escrever ou importar do YouTube.
                          </div>
                        ) : (
                          detailSong.lyrics.map((l, i) => {
                          const isLive = live.mode === "lyrics" && live.song?.id === detailSong.id && live.lyricIndex === i;
                          return (
                            <div
                              key={i}
                              className={`lyric-row ${isLive ? "current" : ""}`}
                              onClick={() => {
                                if (live.song?.id !== detailSong.id) selectSong(detailSong);
                                goToLine(i);
                              }}
                              title="Clique para colocar esta linha no ar"
                            >
                              <span className="lyric-time">[{formatTimestamp(l.startMs)}]</span>
                              {/* A linha que está no ar pode ser corrigida aqui
                                  mesmo: corrige na tela e salva na biblioteca. */}
                              {isLive ? (
                                <span className="lyric-text" onClick={(e) => e.stopPropagation()}>
                                  <EditableCurrentLine text={l.text} onSave={editCurrentLine} />
                                </span>
                              ) : (
                                <span className="lyric-text">{l.text}</span>
                              )}
                            </div>
                          );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Fecha a gaveta do roteiro ao clicar fora (só existe em tela
              estreita, onde o roteiro é sobreposto). */}
          {roteiroOpen && <div className="roteiro-backdrop" onClick={() => setRoteiroOpen(false)} />}

          {/* ── Coluna direita: Roteiro do Culto ── */}
          <aside className={`cockpit-card cockpit-roteiro ${roteiroOpen ? "open" : ""}`}>
            <div className="roteiro-head">
              <div style={{ minWidth: 0 }}>
                <h2>Roteiro do Culto</h2>
                {live.service ? (
                  <p>
                    {live.service.title} · {live.service.stepIndex + 1}/{live.service.totalSteps}
                  </p>
                ) : services.length > 0 ? (
                  <select
                    className="input-field"
                    style={{ padding: "2px 0", border: "none", background: "none", color: "var(--text-muted)", fontSize: "1.02rem" }}
                    value={activeService?.id ?? ""}
                    onChange={(e) => setActiveServiceId(Number(e.target.value))}
                  >
                    {services.map((sv) => (
                      <option key={sv.id} value={sv.id}>
                        {sv.title}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p>Nenhum culto ainda</p>
                )}
              </div>
              {live.service ? (
                <button className="toolbar-icon-btn" onClick={() => setShowInsertPanel((v) => !v)} title="Inserir algo agora">
                  <Icon name={showInsertPanel ? "chevronRight" : "plus"} />
                </button>
              ) : (
                activeService && (
                  <button className="toolbar-icon-btn" onClick={() => setEditingService(activeService)} title="Editar roteiro">
                    <Icon name="more" />
                  </button>
                )
              )}
            </div>

            {live.service && live.interjecting && (
              <div className="roteiro-notice">
                <p>Exibindo item avulso — roteiro pausado</p>
                <button className="act-btn ghost" onClick={resumeService}>
                  Voltar ao roteiro
                </button>
              </div>
            )}

            {/* Inserir algo na hora sem sair do roteiro (ex.: um versículo),
                sem precisar cadastrar na biblioteca. Some ao retomar. */}
            {live.service && showInsertPanel && (
              <div className="glass-card p-md mb-md" style={{ flexShrink: 0 }}>
                <p className="field-label">Texto rápido</p>
                <input
                  className="input-field"
                  type="text"
                  placeholder="Título (ex.: João 3:16)"
                  value={quickText.title}
                  onChange={(e) => setQuickText((qt) => ({ ...qt, title: e.target.value }))}
                  style={{ marginBottom: 6 }}
                />
                <textarea
                  className="input-field"
                  placeholder="Texto a exibir"
                  value={quickText.content}
                  onChange={(e) => setQuickText((qt) => ({ ...qt, content: e.target.value }))}
                  rows={2}
                  style={{ marginBottom: 8 }}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="act-btn primary" onClick={showQuickText}>
                    Mostrar agora
                  </button>
                  <button className="act-btn ghost" onClick={saveQuickTextAsAnnouncement}>
                    Salvar como aviso
                  </button>
                </div>
              </div>
            )}

            <div className="roteiro-list">
              {live.service ? (
                // ── Roteiro NO AR: arraste pra reordenar, clique pra pular
                // direto pro item, caixa marcada = vai ao ar. ──
                live.service.steps.map((step, i) => {
                  const isCurrent = i === live.service!.stepIndex;
                  const isDragOver = dragIndex !== null && dragIndex !== i;
                  return (
                    <div
                      key={i}
                      draggable
                      className={`roteiro-step ${isCurrent ? "current" : ""} ${step.skip ? "skipped" : ""} ${
                        dragIndex === i ? "dragging" : isDragOver ? "drag-over" : ""
                      }`}
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
                      title="Arraste pra reordenar · clique pra ir direto pra este item"
                    >
                      <span className="roteiro-grip">⠿</span>
                      <input
                        type="checkbox"
                        checked={!step.skip}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => roteiroToggleSkip(i)}
                        title={step.skip ? "Voltar a exibir este item" : "Ocultar este item nesta apresentação"}
                      />
                      <span className="roteiro-step-label">
                        {i + 1}. {step.label}
                      </span>
                      <span className="roteiro-step-kind" title={step.sublabel}>
                        <Icon name={step.kind === "lyrics" ? "lyrics" : step.kind === "media" ? "media" : "bell"} />
                      </span>
                    </div>
                  );
                })
              ) : !activeService ? (
                <div className="roteiro-empty">
                  Nenhum culto cadastrado.
                  <br />
                  Crie um no filtro Cultos.
                </div>
              ) : activeService.items.length === 0 ? (
                <div className="roteiro-empty">
                  Roteiro vazio.
                  <br />
                  Use &ldquo;Adicionar ao Roteiro&rdquo; nos itens da biblioteca.
                </div>
              ) : (
                // ── Roteiro EM PREPARO: arrastar salva a nova ordem no culto. ──
                activeService.items.map((item, i) => {
                  const info = serviceItemLabel(item);
                  const isDragOver = dragIndex !== null && dragIndex !== i;
                  return (
                    <div
                      key={item.id}
                      draggable
                      className={`roteiro-step ${item.skip ? "skipped" : ""} ${
                        dragIndex === i ? "dragging" : isDragOver ? "drag-over" : ""
                      }`}
                      onDragStart={(e) => {
                        setDragIndex(i);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex !== null && dragIndex !== i) {
                          const next = [...activeService.items];
                          const [moved] = next.splice(dragIndex, 1);
                          next.splice(i, 0, moved);
                          saveServiceItems(activeService, next);
                        }
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      title="Arraste pra reordenar"
                    >
                      <span className="roteiro-grip">⠿</span>
                      <input
                        type="checkbox"
                        checked={!item.skip}
                        onChange={() =>
                          saveServiceItems(
                            activeService,
                            activeService.items.map((x) => (x.id === item.id ? { ...x, skip: !x.skip } : x))
                          )
                        }
                        title={item.skip ? "Incluir neste culto" : "Deixar salvo, mas fora deste culto"}
                      />
                      <span className="roteiro-step-label">
                        {i + 1}. {info.label}
                      </span>
                      <span className="roteiro-step-kind">
                        <Icon name={info.icon} />
                      </span>
                      <button
                        className="roteiro-step-remove"
                        title="Tirar do roteiro"
                        onClick={() =>
                          saveServiceItems(
                            activeService,
                            activeService.items.filter((x) => x.id !== item.id)
                          )
                        }
                      >
                        <Icon name="trash" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {!live.service && activeService && activeService.items.length > 0 && (
              <button className="act-btn primary" style={{ marginTop: 14, justifyContent: "center" }} onClick={() => startService(activeService)}>
                <Icon name="play" /> Apresentar culto
              </button>
            )}
          </aside>
        </div>

        {/* ─── Dock ─────────────────────────────────────── */}
        <footer className="cockpit-dock">
          {/* Miniatura ao vivo: é a tela de projeção de verdade, em escala. */}
          <div className="dock-preview">
            <iframe src="/projection" title="Prévia da projeção" />
          </div>

          <div className="dock-center">
            <p className="dock-nowplaying">
              No ar:{" "}
              {live.mode === "idle" && "tela em branco"}
              {live.mode === "lyrics" && (live.song?.title || "—")}
              {live.mode === "announcement" && (live.announcement?.title || "—")}
              {live.mode === "media" && (live.media?.title || "—")}
              {live.mode === "countdown" && (live.countdownTitle || "contagem regressiva")}
              {currentLyricText && ` — ${currentLyricText}`}
            </p>
            {/* Com mídia no ar, a linha de apoio vira a barra de posição —
                é o controle que o operador precisa nesse momento. */}
            {live.mode === "media" && live.media ? (
              <div className="dock-seek">
                <span>{formatTime(mediaProgress.currentTime)}</span>
                <input
                  className="slider"
                  type="range"
                  min={0}
                  max={Math.max(1, mediaProgress.duration)}
                  step={0.5}
                  value={Math.min(mediaProgress.currentTime, mediaProgress.duration || 1)}
                  onChange={(e) => mediaSeek(parseFloat(e.target.value))}
                  title="Arraste para buscar uma posição"
                  aria-label="Posição da mídia"
                />
                <span>{formatTime(mediaProgress.duration)}</span>
              </div>
            ) : (
              <p className="dock-subline">
                {nextLyricLine
                  ? `A seguir: ${nextLyricLine}`
                  : live.service
                  ? `${live.service.title} · passo ${live.service.stepIndex + 1} de ${live.service.totalSteps}`
                  : STEP_LABEL[live.mode] || ""}
              </p>
            )}

            <div className="dock-controls">
              <button
                className="dock-btn"
                onClick={live.service ? roteiroPrev : prevLine}
                disabled={!live.service && live.mode !== "lyrics"}
              >
                <Icon name="chevronLeft" /> Anterior
              </button>
              <button
                className="dock-btn"
                onClick={live.service ? roteiroNext : nextLine}
                disabled={!live.service && live.mode !== "lyrics"}
              >
                <Icon name="chevronRight" /> Próximo
              </button>
              {live.mode === "media" ? (
                <button className="dock-btn primary" onClick={mediaToggle}>
                  <Icon name={live.mediaPaused ? "play" : "pause"} /> {live.mediaPaused ? "Retomar" : "Pausar"}
                </button>
              ) : (
                <button
                  className="dock-btn primary"
                  onClick={live.isPlaying ? pause : play}
                  disabled={live.mode !== "lyrics" || !live.song}
                  title="Avanço automático da letra"
                >
                  <Icon name={live.isPlaying ? "pause" : "play"} /> {live.isPlaying ? "Pausar" : "Auto"}
                </button>
              )}
              <button className="dock-btn danger" onClick={stopAll}>
                <Icon name="trash" /> Limpar
              </button>
            </div>
          </div>

          <div className="dock-right">
            <div className="dock-volume">
              <Icon name="volume" />
              <input
                className="slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={live.volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                title={`Volume ${Math.round(live.volume * 100)}%`}
                aria-label="Volume"
              />
            </div>
            <div className="dock-timer">
              <span>Timer</span>
              <button
                className={`dock-timer-value ${live.mode === "countdown" ? "running" : ""}`}
                onClick={() => setShowCountdownPanel((v) => !v)}
                title="Contagem regressiva"
              >
                {dockTimer}
              </button>
            </div>
          </div>
        </footer>

        {/* Contagem regressiva, aberta pelo Timer da dock */}
        {showCountdownPanel && (
          <div style={{ position: "absolute", bottom: 150, right: 24, width: 380, zIndex: 150 }}>
            <CountdownControl
              active={live.mode === "countdown"}
              endsAt={live.countdownEndsAt}
              title={live.countdownTitle}
              onStart={startCountdown}
              onStop={stopCountdown}
            />
          </div>
        )}
      </div>

      {/* ─── Toast ─────────────────────────────────────── */}
      {toast && <div className={`toast toast-${toast.type}`}>{toast.text}</div>}

      {/* ─── Modais ────────────────────────────────────── */}
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

      {editingTemplate && (
        <TemplateModal
          template={editingTemplate === "new" ? null : editingTemplate}
          onClose={() => setEditingTemplate(null)}
          onSaved={() => {
            fetchTemplates();
            setEditingTemplate(null);
            showToast("success", "Modelo salvo!");
          }}
        />
      )}

      {templateToUse && (
        <UseTemplateModal
          template={templateToUse}
          onClose={() => setTemplateToUse(null)}
          onCreated={() => {
            fetchAnnouncements();
            setTemplateToUse(null);
            showToast("success", "Aviso criado a partir do modelo!");
          }}
        />
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

      {showServiceModal && (
        <ServiceModal
          onClose={() => setShowServiceModal(false)}
          onSaved={(created) => {
            fetchServices();
            setShowServiceModal(false);
            showToast("success", "Culto criado! Agora adicione músicas e avisos.");
            setActiveServiceId(created.id);
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

      {/* ─── Busca global ──────────────────────────────── */}
      {showSearch && (
        <GlobalSearch
          songs={songs}
          announcements={announcements}
          mediaLibrary={mediaLibrary}
          initialQuery={globalQuery}
          onClose={() => {
            setShowSearch(false);
            setGlobalQuery("");
          }}
          onPick={(kind, item) => {
            if (kind === "song") selectSong(item as Song);
            else if (kind === "announcement") showAnnouncementLive(item as Announcement);
            else showMediaLive(item as MediaItem);
            setShowSearch(false);
            setGlobalQuery("");
          }}
        />
      )}

      {/* ─── Configurações (modal com sub-abas) ─────────── */}
      {showSettingsModal && settings && (
        <SettingsModal
          settings={settings}
          networkUrls={networkUrls}
          stageUrls={stageUrls}
          onClose={() => setShowSettingsModal(false)}
          onLogout={handleLogout}
          onSaved={(s) => {
            setSettings(s);
            // Avisa as telas já abertas (projeção, stage): elas carregaram as
            // cores na abertura e não teriam como saber que mudaram.
            socketRef.current?.emit("admin:settingsChanged");
            showToast("success", "Configurações salvas!");
          }}
        />
      )}
    </>
  );
}
