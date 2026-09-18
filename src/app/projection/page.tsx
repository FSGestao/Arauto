"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { findBackgroundPreset, PRESET_PREFIX } from "../../lib/backgroundPresets";

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
  kind: "audio" | "video" | "image";
  file: string;
  loop: boolean;
  volume: number;
  /** "youtube": `file` é o ID do vídeo (11 caracteres), não um nome de
   *  arquivo em data/media — tocado com o player embutido do YouTube. */
  source?: "upload" | "youtube";
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => YTPlayer;
      PlayerState: { ENDED: number; PLAYING: number; PAUSED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  setVolume(v: number): void;
  getVolume(): number;
  getCurrentTime(): number;
  getDuration(): number;
  destroy(): void;
}

/** Carrega o script do IFrame Player API do YouTube uma única vez — várias
 *  chamadas (uma por vídeo trocado) reaproveitam a mesma tag/promessa. */
let ytApiPromise: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      anterior?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return ytApiPromise;
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
  countdownEndsAt: null,
  countdownTitle: null,
  countdownMediaFile: null,
  countdownMediaKind: null,
  service: null,
  volume: 1,
  background: null,
  mediaPaused: false,
};

/** Formata milissegundos restantes como mm:ss ou h:mm:ss. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

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
  // Vídeo do YouTube: o player embutido controla tudo (play/pausa/posição/
  // volume) por uma API própria, não por um <video> comum — por isso vive
  // num ref separado do `mediaRef` de arquivos locais.
  const ytPlayerRef = useRef<YTPlayer | null>(null);
  const ytContainerRef = useRef<HTMLDivElement | null>(null);
  const fadeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Chave do item de mídia que falhou ao carregar (arquivo corrompido/sumiu
  // do disco). Sem isso, um arquivo quebrado deixava a tela em branco sem
  // explicação — exatamente o "branco na tela" que mais assusta o operador.
  const [brokenKey, setBrokenKey] = useState<string | null>(null);

  // ─── Configurações de marca (público, sem login) ────
  const carregarSettings = useCallback(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => {});
  }, []);

  useEffect(() => {
    carregarSettings();
  }, [carregarSettings]);

  // ─── Conexão WebSocket ────────────────────────────────
  useEffect(() => {
    const socket: Socket = io({ path: "/socket.io", query: { role: "projection" } });
    socketRef.current = socket;
    socket.on("state:update", (s: LiveState) => setState(s));
    // Cores/nome/logo mudaram no painel: recarrega sem precisar de F5 aqui.
    socket.on("settings:update", () => carregarSettings());
    socket.on("media:seek", (seconds: number) => {
      if (!Number.isFinite(seconds)) return;
      if (ytPlayerRef.current) ytPlayerRef.current.seekTo(seconds, true);
      else if (mediaRef.current) mediaRef.current.currentTime = seconds;
    });
    return () => {
      socket.disconnect();
    };
  }, [carregarSettings]);

  // ─── Timer para avançar a linha automaticamente ──────
  useEffect(() => {
    if (!state.isPlaying || state.mode !== "lyrics") return;
    const interval = setInterval(() => setTick((t) => t + 1), 150);
    return () => clearInterval(interval);
  }, [state.isPlaying, state.mode]);

  // ─── Contagem regressiva: re-renderiza a cada segundo ──
  useEffect(() => {
    if (state.mode !== "countdown") return;
    const interval = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(interval);
  }, [state.mode]);

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
  // caixa de som da igreja soa amador. Funciona tanto pro <video>/<audio>
  // local quanto pro player do YouTube (escalas diferentes: 0–1 vs 0–100),
  // por isso ler/escrever o volume passa pelas duas funções abaixo em vez
  // de tocar direto em `mediaRef.current.volume`.
  const getCurrentVolume = useCallback(() => {
    if (ytPlayerRef.current) return ytPlayerRef.current.getVolume() / 100;
    return mediaRef.current?.volume ?? 1;
  }, []);
  const applyVolume = useCallback((v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    if (ytPlayerRef.current) ytPlayerRef.current.setVolume(clamped * 100);
    if (mediaRef.current) mediaRef.current.volume = clamped;
  }, []);

  const rampVolume = useCallback((target: number, ms: number) => {
    if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
    const stepMs = 30;
    const steps = Math.max(1, Math.round(ms / stepMs));
    const from = getCurrentVolume();
    let i = 0;
    fadeTimerRef.current = setInterval(() => {
      i++;
      if (!mediaRef.current && !ytPlayerRef.current) {
        if (fadeTimerRef.current) clearInterval(fadeTimerRef.current);
        return;
      }
      applyVolume(from + (target - from) * (i / steps));
      if (i >= steps && fadeTimerRef.current) clearInterval(fadeTimerRef.current);
    }, stepMs);
  }, [getCurrentVolume, applyVolume]);

  const mediaId = state.media?.id ?? null;
  const isYoutube = state.media?.source === "youtube";
  const targetVolume = (state.media?.volume ?? 1) * state.volume;

  // ─── Player do YouTube: cria quando o item é do YouTube, destrói ao
  //     trocar de item ou saír do modo mídia. Um <video>/<audio> comum
  //     nasce e morre com o próprio elemento HTML (via `key`); o player do
  //     YouTube precisa desse ciclo de vida explícito porque é uma API.
  useEffect(() => {
    if (!isYoutube || !state.media) return;
    let destruido = false;
    let player: YTPlayer | null = null;
    loadYouTubeApi().then(() => {
      if (destruido || !ytContainerRef.current || !window.YT) return;
      player = new window.YT.Player(ytContainerRef.current, {
        videoId: state.media!.file,
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1, modestbranding: 1,
          rel: 0, playsinline: 1, mute: 0,
          loop: state.media!.loop ? 1 : 0,
          playlist: state.media!.loop ? state.media!.file : undefined,
        },
        events: {
          onReady: () => { player!.setVolume(0); },
          onStateChange: (e: { data: number }) => {
            if (e.data === window.YT!.PlayerState.ENDED) onMediaEnded();
          },
          onError: () => setBrokenKey(`media-${state.media!.id}`),
        },
      });
      ytPlayerRef.current = player;
    });
    return () => {
      destruido = true;
      try { player?.destroy(); } catch {}
      ytPlayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId, isYoutube]);

  // Ao trocar de item de mídia: começa mudo e sobe (fade-in).
  useEffect(() => {
    if (mediaId === null) return;
    // O player do YouTube demora um instante extra pra existir (carrega o
    // script + monta o iframe) — sem essa espera, o fade-in começaria
    // "no vazio" antes do player estar pronto pra receber setVolume.
    const atraso = isYoutube ? 300 : 0;
    const t = setTimeout(() => {
      applyVolume(0);
      rampVolume(targetVolume, FADE_MS);
    }, atraso);
    return () => clearTimeout(t);
    // `targetVolume` fica fora das dependências de propósito: mudanças de
    // volume durante a reprodução são tratadas no efeito abaixo, sem refazer
    // o fade-in do início.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaId, isYoutube, rampVolume, applyVolume]);

  // Ajuste de volume durante a reprodução (operador mexendo no slider).
  useEffect(() => {
    if (mediaId === null) return;
    rampVolume(targetVolume, 150);
  }, [targetVolume, mediaId, rampVolume]);

  // Pausa/retoma conforme o painel manda.
  useEffect(() => {
    if (ytPlayerRef.current) {
      if (state.mediaPaused) ytPlayerRef.current.pauseVideo();
      else ytPlayerRef.current.playVideo();
      return;
    }
    const el = mediaRef.current;
    if (!el) return;
    if (state.mediaPaused) el.pause();
    else el.play().catch(() => {});
  }, [state.mediaPaused, mediaId]);

  // ─── Relata progresso pro painel do operador ──────────
  useEffect(() => {
    if (state.mode !== "media") return;
    const interval = setInterval(() => {
      if (!socketRef.current) return;
      if (ytPlayerRef.current) {
        socketRef.current.emit("media:progress", {
          currentTime: ytPlayerRef.current.getCurrentTime(),
          duration: ytPlayerRef.current.getDuration() || 0,
        });
        return;
      }
      const el = mediaRef.current;
      if (!el) return;
      socketRef.current.emit("media:progress", {
        currentTime: el.currentTime,
        duration: Number.isFinite(el.duration) ? el.duration : 0,
      });
    }, 500);
    return () => clearInterval(interval);
  }, [state.mode, mediaId]);

  // Reseta o erro sempre que o item mostrado muda — senão um arquivo quebrado
  // de um passo anterior continuaria marcado como quebrado pra sempre.
  const currentMediaKey =
    state.mode === "media" && state.media
      ? `media-${state.media.id}`
      : state.mode === "announcement" && state.announcement
      ? `ann-${state.announcement.id}`
      : null;
  useEffect(() => {
    setBrokenKey(null);
  }, [currentMediaKey]);

  // Se o item quebrado fazia parte de um roteiro em apresentação, segue em
  // frente sozinho depois de alguns segundos — em vez de travar o culto
  // esperando alguém notar e clicar em "próximo" manualmente.
  useEffect(() => {
    if (!brokenKey || !state.service) return;
    const timer = setTimeout(() => socketRef.current?.emit("roteiro:next"), 4000);
    return () => clearTimeout(timer);
  }, [brokenKey, state.service]);

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

  // Mostra o que estava previsto (o título, pelo menos) em vez de deixar a
  // tela muda quando um arquivo não carrega — silêncio visual sem explicação
  // é o pior cenário durante um culto ao vivo.
  const brokenBlock = (title: string) => (
    <div style={{ textAlign: "center", opacity: 0.7, maxWidth: "70vw" }}>
      <p style={{ fontSize: "clamp(1.3rem, 3.5vw, 2.5rem)", fontWeight: 700, marginBottom: 12 }}>{title}</p>
      <p style={{ fontSize: "clamp(0.85rem, 2vw, 1.2rem)", opacity: 0.75 }}>
        ⚠ Não foi possível carregar este arquivo
        {state.service ? " — avançando em instantes..." : ""}
      </p>
    </div>
  );

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
      {/* ── Camada de fundo: imagem, vídeo ou um dos fundos prontos, sempre
          por trás dos passos. Falha "quieta" de propósito — é decorativo,
          então um arquivo quebrado só volta pra cor sólida, sem aviso nem
          interromper nada. */}
      {state.background && state.background.startsWith(PRESET_PREFIX) && (
        <div
          className={findBackgroundPreset(state.background.slice(PRESET_PREFIX.length))?.className}
          style={{ position: "absolute", inset: 0, zIndex: 0 }}
        />
      )}
      {state.background && !state.background.startsWith(PRESET_PREFIX) && brokenKey !== `bg-${state.background}` && (
        /\.(jpe?g|png|gif|webp)$/i.test(state.background) ? (
          <img
            key={`bg-${state.background}`}
            src={`/api/media/${state.background}`}
            alt=""
            onError={() => setBrokenKey(`bg-${state.background}`)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
          />
        ) : (
          <video
            key={`bg-${state.background}`}
            src={`/api/media/${state.background}`}
            autoPlay
            loop
            muted
            playsInline
            onError={() => setBrokenKey(`bg-${state.background}`)}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
          />
        )
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

        {state.mode === "countdown" && state.countdownEndsAt && state.countdownMediaFile && (
          /* Cartaz/vídeo do evento atrás do relógio — mesma ideia do vídeo de
             fundo, mas específico da contagem (não fica quando ela termina). */
          brokenKey === `countdown-${state.countdownMediaFile}` ? null : state.countdownMediaKind === "video" ? (
            <video
              key={`countdown-${state.countdownMediaFile}`}
              src={`/api/media/${state.countdownMediaFile}`}
              autoPlay
              loop
              muted
              playsInline
              onError={() => setBrokenKey(`countdown-${state.countdownMediaFile}`)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
            />
          ) : (
            <img
              key={`countdown-${state.countdownMediaFile}`}
              src={`/api/media/${state.countdownMediaFile}`}
              alt=""
              onError={() => setBrokenKey(`countdown-${state.countdownMediaFile}`)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0 }}
            />
          )
        )}

        {state.mode === "countdown" && state.countdownEndsAt && (
          <div style={{ textAlign: "center", textShadow: state.countdownMediaFile ? "0 2px 18px rgba(0,0,0,0.85)" : textShadow, position: "relative", zIndex: 1 }}>
            {state.countdownTitle && (
              <p style={{ fontSize: "clamp(1.1rem, 3vw, 2.2rem)", opacity: 0.85, marginBottom: "3vh" }}>{state.countdownTitle}</p>
            )}
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(3rem, 14vw, 12rem)",
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {formatCountdown(state.countdownEndsAt - Date.now())}
            </p>
          </div>
        )}

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
        {state.mode === "media" && state.media && state.media.kind === "video" && state.media.source === "youtube" && (
          brokenKey === `media-${state.media.id}` ? (
            brokenBlock(state.media.title)
          ) : (
            // O player do YouTube monta o próprio <iframe> dentro deste div
            // (ver o efeito que cria window.YT.Player) — por isso não tem
            // `src` aqui, diferente do <video> de arquivo local abaixo.
            <div
              key={`media-${state.media.id}`}
              ref={ytContainerRef}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "#000" }}
            />
          )
        )}

        {state.mode === "media" && state.media && state.media.kind === "video" && state.media.source !== "youtube" && (
          brokenKey === `media-${state.media.id}` ? (
            brokenBlock(state.media.title)
          ) : (
            <video
              key={`media-${state.media.id}`}
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={`/api/media/${state.media.file}`}
              autoPlay
              playsInline
              loop={state.media.loop}
              controls={false}
              onEnded={onMediaEnded}
              onError={() => setBrokenKey(`media-${state.media!.id}`)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
            />
          )
        )}

        {state.mode === "media" && state.media && state.media.kind === "audio" && (
          brokenKey === `media-${state.media.id}` ? (
            brokenBlock(state.media.title)
          ) : (
            <>
              <audio
                key={`media-${state.media.id}`}
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                src={`/api/media/${state.media.file}`}
                autoPlay
                loop={state.media.loop}
                onEnded={onMediaEnded}
                onError={() => setBrokenKey(`media-${state.media!.id}`)}
              />
              {/* Áudio não tem imagem: mantém a marca da igreja na tela em vez
                  de deixar preto — a não ser que haja vídeo de fundo tocando. */}
              {!state.background && brandBlock}
            </>
          )
        )}

        {state.mode === "media" && state.media && state.media.kind === "image" && (
          brokenKey === `media-${state.media.id}` ? (
            brokenBlock(state.media.title)
          ) : (
            <img
              key={`media-${state.media.id}`}
              src={`/api/media/${state.media.file}`}
              alt={state.media.title}
              onError={() => setBrokenKey(`media-${state.media!.id}`)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
            />
          )
        )}

        {state.mode === "announcement" && state.announcement && state.announcement.mediaType === "image" && state.announcement.mediaFile && (
          brokenKey === `ann-${state.announcement.id}` ? (
            brokenBlock(state.announcement.title)
          ) : (
            <div key={state.announcement.id} style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", animation: "lyricFade 0.5s ease" }}>
              <img
                src={`/api/media/${state.announcement.mediaFile}`}
                alt={state.announcement.title}
                onError={() => setBrokenKey(`ann-${state.announcement!.id}`)}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            </div>
          )
        )}

        {state.mode === "announcement" && state.announcement && state.announcement.mediaType === "video" && state.announcement.mediaFile && (
          brokenKey === `ann-${state.announcement.id}` ? (
            brokenBlock(state.announcement.title)
          ) : (
            <video
              key={state.announcement.id}
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              src={`/api/media/${state.announcement.mediaFile}`}
              autoPlay
              playsInline
              controls={false}
              onEnded={() => socketRef.current?.emit("roteiro:next")}
              onError={() => setBrokenKey(`ann-${state.announcement!.id}`)}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
            />
          )
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
