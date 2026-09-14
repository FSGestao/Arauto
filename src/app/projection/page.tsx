"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

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
  lyrics: LyricLine[];
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  mediaType: "none" | "image" | "video";
  mediaFile: string | null;
}

interface MediaItem {
  id: number;
  title: string;
  kind: "audio" | "video";
  file: string;
  loop: boolean;
  volume: number;
}

interface Settings {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  textColor: string;
  logoUrl: string | null;
}

interface ServiceProgress {
  id: number;
  title: string;
  stepIndex: number;
  totalSteps: number;
}

interface LiveState {
  mode: "idle" | "lyrics" | "announcement" | "media";
  song: Song | null;
  lyricIndex: number;
  isPlaying: boolean;
  startedAt: number | null;
  announcement: Announcement | null;
  media: MediaItem | null;
  nextMedia: string | null;
  service: ServiceProgress | null;
  volume: number;
  background: string | null;
  mediaPaused: boolean;
}

const EMPTY_STATE: LiveState = {
  mode: "idle",
  song: null,
  lyricIndex: -1,
  isPlaying: false,
  startedAt: null,
  announcement: null,
  media: null,
  nextMedia: null,
  service: null,
  volume: 1,
  background: null,
  mediaPaused: false,
};

const FADE_MS = 450;

/**
 * Tela de projeção — puramente exibição, sem controles. Recebe o estado ao
 * vivo via WebSocket (transmitido pelo painel Admin) e apenas renderiza.
 * Pode ser aberta em uma segunda janela do mesmo computador ou, através da
 * rede local, em outro computador ligado ao projetor.
 */
export default function ProjectionPage() {
  const [state, setState] = useState<LiveState>(EMPTY_STATE);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [, setTick] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Configurações de marca (público, sem login) ────
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

  // ─── Conexão WebSocket ────────────────────────────────
  useEffect(() => {
    const socket: Socket = io({ path: "/socket.io", query: { role: "projection" } });
    socketRef.current = socket;
    socket.on("state:update", (s: LiveState) => setState(s));
    socket.on("media:seek", (seconds: number) => {
      const el = mediaRef.current;
      if (el && Number.isFinite(seconds)) el.currentTime = seconds;
    });
    return () => {
      socket.disconnect();
    };
  }, []);

  // ─── Timer para avançar a linha automaticamente ──────
  useEffect(() => {
    if (!state.isPlaying || state.mode !== "lyrics") return;
    const interval = setInterval(() => setTick((t) => t + 1), 150);
    return () => clearInterval(interval);
  }, [state.isPlaying, state.mode]);

  // ─── Navegação do roteiro (Culto) pelo teclado/mouse ──
  // Setas ←/→ e clique avançam/voltam no culto em apresentação. "F" alterna
  // tela cheia. Funciona mesmo sem login: é só "próximo/anterior passo" de
  // uma apresentação que um admin já iniciou.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "f" || e.key === "F") {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
        return;
      }
      if (!state.service) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        socketRef.current?.emit("roteiro:next");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        socketRef.current?.emit("roteiro:prev");
      }
    }
    function handleClick() {
      if (!state.service) return;
      socketRef.current?.emit("roteiro:next");
    }
    window.addEventListener("keydown", handleKey);
    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("click", handleClick);
    };
  }, [state.service]);

  // ─── Volume com rampa (fade) ──────────────────────────
  // Sobe/desce o volume aos poucos em vez de cortar seco — corte seco na
  // caixa de som da igreja soa amador.
  const rampVolume = useCallback((target: number, ms: number) => {
    const el = mediaRef.current;
    if (!el) return;
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
    const stepMs = 30;
    const steps = Math.max(1, Math.round(ms / stepMs));
    const from = el.volume;
    let i = 0;
    fadeTimerRef.current = setInterval(() => {
      i++;
      const current = mediaRef.current;
      if (!current) {
        if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
        return;
      }
      current.volume = Math.min(1, Math.max(0, from + (target - from) * (i / steps)));
      if (i >= steps && fadeTimerRef.current) clearInterval(fadeTimerRef.current);
    }, stepMs);
  }, []);

  const mediaId = state.media?.id ?? null;
  const targetVolume = (state.media?.volume ?? 1) * state.volume;

  // Ao trocar de item de mídia: começa mudo e sobe (fade-in).
  useEffect(() => {
    const el = mediaRef.current;
    if (!el || mediaId === null) return;
    el.volume = 0;
    rampVolume(targetVolume, FADE_MS);
    // `targetVolume` fica fora das dependências de propósito: mudanças de
    // volume durante a reprodução são tratadas no efeito abaixo, sem refazer
    // o fade-in do início.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId, rampVolume]);

  // Ajuste de volume durante a reprodução (operador mexendo no slider).
  useEffect(() => {
    if (mediaId === null) return;
    rampVolume(targetVolume, 150);
  }, [targetVolume, mediaId, rampVolume]);

  // Pausa/retoma conforme o painel manda.
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (state.mediaPaused) el.pause();
    else el.play().catch(() => {});
  }, [state.mediaPaused, mediaId]);

  // ─── Relata progresso pro painel do operador ──────────
  useEffect(() => {
    if (state.mode !== "media") return;
    const interval = setInterval(() => {
      const el = mediaRef.current;
      if (!el || !socketRef.current) return;
      socketRef.current.emit("media:progress", {
        currentTime: el.currentTime,
        duration: Number.isFinite(el.duration) ? el.duration : 0,
      });
    }, 500);
    return () => clearInterval(interval);
  }, [state.mode, mediaId]);

  const bgColor = settings?.bgColor || "#000";
  const textColor = settings?.textColor || "#fff";

  let currentLine: LyricLine | null = null;
  if (state.mode === "lyrics" && state.song) {
    if (state.isPlaying && state.startedAt) {
      const elapsed = Date.now() - state.startedAt;
      currentLine =
        state.song.lyrics.find((l) => elapsed >= l.startMs && elapsed < l.endMs) ||
        state.song.lyrics[state.lyricIndex] ||
        null;
    } else {
      currentLine = state.song.lyrics[state.lyricIndex] ?? null;
    }
  }

  function onMediaEnded() {
    if (state.media?.loop) return; // o próprio loop cuida disso
    if (state.service) socketRef.current?.emit("roteiro:next");
  }

  // Sombra no texto só quando há vídeo de fundo — sem isso a letra some
  // sobre trechos claros do vídeo.
  const textShadow = state.background ? "0 2px 18px rgba(0,0,0,0.85)" : undefined;

  const brandBlock = (
    <div style={{ textAlign: "center", opacity: 0.3 }}>
      {settings?.logoUrl && (
        <img src={settings.logoUrl} alt={settings.name} style={{ height: "10vh", marginBottom: 24, opacity: 0.6 }} />
      )}
      <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1rem, 3vw, 2rem)" }}>
        {settings?.name || "Arauto"}
      </p>
    </div>
  );

  return (
    <div className="projection-container" style={{ background: bgColor, color: textColor }}>
      {/* ── Camada de fundo: vídeo que segue tocando por trás dos passos ── */}
      {state.background && (
        <video
          key={`bg-${state.background}`}
          src={`/api/media/${state.background}`}
          autoPlay
          loop
          muted
          playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
        />
      )}

      {/* ── Conteúdo, sempre acima do fundo ────────────── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {state.mode === "idle" && !state.background && brandBlock}

        {state.mode === "lyrics" && currentLine && (
          <div key={state.lyricIndex} className="projection-lyric" style={{ textShadow }}>
            {currentLine.text}
          </div>
        )}

        {/* Música selecionada mas sem nenhuma linha de letra carregada —
            mostra pelo menos o título em vez de deixar a tela em branco. */}
        {state.mode === "lyrics" && !currentLine && state.song && (
          <div style={{ textAlign: "center", opacity: 0.6, textShadow }}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "clamp(1.2rem, 3.5vw, 2.5rem)", fontWeight: 700 }}>
              {state.song.title}
            </p>
            <p style={{ fontSize: "clamp(0.8rem, 1.8vw, 1.1rem)", marginTop: 8, opacity: 0.7 }}>
              Esta música ainda não tem letra cadastrada
            </p>
          </div>
        )}

        {/* ── Item de mídia (áudio/vídeo) ──────────────── */}
        {state.mode === "media" && state.media && state.media.kind === "video" && (
          <video
            key={`media-${state.media.id}`}
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={`/api/media/${state.media.file}`}
            autoPlay
            playsInline
            loop={state.media.loop}
            controls={false}
            onEnded={onMediaEnded}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
          />
        )}

        {state.mode === "media" && state.media && state.media.kind === "audio" && (
          <>
            <audio
              key={`media-${state.media.id}`}
              ref={mediaRef as React.RefObject<HTMLAudioElement>}
              src={`/api/media/${state.media.file}`}
              autoPlay
              loop={state.media.loop}
              onEnded={onMediaEnded}
            />
            {/* Áudio não tem imagem: mantém a marca da igreja na tela em vez
                de deixar preto — a não ser que haja vídeo de fundo tocando. */}
            {!state.background && brandBlock}
          </>
        )}

        {state.mode === "announcement" && state.announcement && state.announcement.mediaType === "image" && state.announcement.mediaFile && (
          <div key={state.announcement.id} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", animation: "lyricFade 0.5s ease" }}>
            <img
              src={`/api/media/${state.announcement.mediaFile}`}
              alt={state.announcement.title}
              style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
            />
          </div>
        )}

        {state.mode === "announcement" && state.announcement && state.announcement.mediaType === "video" && state.announcement.mediaFile && (
          <video
            key={state.announcement.id}
            ref={mediaRef as React.RefObject<HTMLVideoElement>}
            src={`/api/media/${state.announcement.mediaFile}`}
            autoPlay
            playsInline
            controls={false}
            onEnded={() => socketRef.current?.emit("roteiro:next")}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
          />
        )}

        {state.mode === "announcement" && state.announcement && state.announcement.mediaType === "none" && (
          <div style={{ textAlign: "center", padding: "5vh 8vw", maxWidth: "80vw" }}>
            <div key={state.announcement.id} style={{ animation: "lyricFade 0.5s ease" }}>
              <h1
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(2rem, 5vw, 5rem)",
                  fontWeight: 800,
                  marginBottom: "3vh",
                  textShadow: "0 4px 20px rgba(0,0,0,0.8)",
                }}
              >
                {state.announcement.title}
              </h1>
              <p
                style={{
                  fontSize: "clamp(1rem, 3vw, 3rem)",
                  opacity: 0.85,
                  lineHeight: 1.4,
                  textShadow: "0 2px 10px rgba(0,0,0,0.6)",
                }}
              >
                {state.announcement.content}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Pré-carrega a mídia do próximo passo, pra troca não engasgar. */}
      {state.nextMedia && (
        <video
          key={`preload-${state.nextMedia}`}
          src={`/api/media/${state.nextMedia}`}
          preload="auto"
          muted
          style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
        />
      )}

      {state.service && (
        <div
          style={{
            position: "fixed",
            bottom: "2vh",
            right: "2vw",
            fontSize: "0.75rem",
            opacity: 0.35,
            fontFamily: "var(--font-body)",
            zIndex: 2,
          }}
        >
          {state.service.stepIndex + 1} / {state.service.totalSteps}
        </div>
      )}

      {state.mode !== "idle" && settings?.logoUrl && (
        <div className="projection-footer" style={{ zIndex: 2 }}>
          <img src={settings.logoUrl} alt={settings.name} />
          <span>{settings.name}</span>
        </div>
      )}
    </div>
  );
}
