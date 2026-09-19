"use client";

import { useEffect, useState } from "react";
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
  lyrics: LyricLine[];
}

interface Announcement {
  id: number;
  title: string;
  content: string;
}

interface MediaItemLike {
  id: number;
  title: string;
}

interface BibleReference {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

interface ServiceProgress {
  stepIndex: number;
  totalSteps: number;
  steps: { kind: "lyrics" | "announcement" | "media" | "bible"; label: string; sublabel: string; skip: boolean }[];
}

interface LiveState {
  mode: "idle" | "lyrics" | "announcement" | "media" | "countdown" | "bible";
  song: Song | null;
  lyricIndex: number;
  isPlaying: boolean;
  startedAt: number | null;
  announcement: Announcement | null;
  media: MediaItemLike | null;
  bible: BibleReference | null;
  countdownEndsAt: number | null;
  countdownTitle: string | null;
  service: ServiceProgress | null;
  /** Cronômetro crescente que só a Stage View mostra — independente de
   *  `mode`, continua rodando mesmo se a letra/aviso em cima trocar. */
  stageTimer: { startedAt: number; label: string } | null;
}

const EMPTY_STATE: LiveState = {
  mode: "idle",
  song: null,
  lyricIndex: -1,
  isPlaying: false,
  startedAt: null,
  announcement: null,
  media: null,
  bible: null,
  countdownEndsAt: null,
  countdownTitle: null,
  service: null,
  stageTimer: null,
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

/**
 * Stage View — monitor de confiança pra quem está no palco (músico,
 * vocalista, pregador). Diferente da tela de projeção pública: sem logo, sem
 * cores/marca da igreja, sem controles — só a linha atual (grande) e a
 * próxima (menor), em alto contraste, pra ler de relance sem virar a cabeça
 * pra tela grande (o nome da igreja aparece bem discreto no rodapé, só pra
 * identificar de qual local é a tela). Acessível pela mesma rede local, sem
 * login, em `/stage`.
 */
export default function StagePage() {
  const [state, setState] = useState<LiveState>(EMPTY_STATE);
  const [churchName, setChurchName] = useState("");
  const [, setTick] = useState(0);

  useEffect(() => {
    const socket: Socket = io({ path: "/socket.io", query: { role: "stage" } });
    socket.on("state:update", (s: LiveState) => setState(s));
    return () => {
      socket.disconnect();
    };
  }, []);

  // Só o nome — sem logo nem cores, pra não virar a identidade visual que
  // essa tela intencionalmente não tem. Serve pra quem cuida de mais de um
  // local/tela saber de relance qual igreja é essa, sem afetar a leitura.
  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => setChurchName(s?.name || ""))
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "f" || e.key === "F") {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
        else document.exitFullscreen().catch(() => {});
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Reavalia a linha atual em avanço automático, igual à tela de projeção.
  useEffect(() => {
    if (!state.isPlaying || state.mode !== "lyrics") return;
    const interval = setInterval(() => setTick((t) => t + 1), 150);
    return () => clearInterval(interval);
  }, [state.isPlaying, state.mode]);

  useEffect(() => {
    if (state.mode !== "countdown" && !state.stageTimer) return;
    const interval = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(interval);
  }, [state.mode, state.stageTimer]);

  let currentLine: LyricLine | null = null;
  let nextLine: LyricLine | null = null;
  if (state.mode === "lyrics" && state.song) {
    const idx =
      state.isPlaying && state.startedAt
        ? state.song.lyrics.findIndex((l) => {
            const elapsed = Date.now() - state.startedAt!;
            return elapsed >= l.startMs && elapsed < l.endMs;
          })
        : state.lyricIndex;
    const i = idx >= 0 ? idx : state.lyricIndex;
    currentLine = state.song.lyrics[i] ?? null;
    nextLine = state.song.lyrics[i + 1] ?? null;
  }

  // Próximo EVENTO do roteiro — usado quando o item atual não é uma música
  // (aviso/mídia não têm "próxima linha" própria) ou quando a música atual
  // está na última linha.
  let nextEventLabel: string | null = null;
  if (state.service) {
    const upcoming = state.service.steps.slice(state.service.stepIndex + 1).find((s) => !s.skip);
    if (upcoming) nextEventLabel = `${upcoming.kind === "lyrics" ? "🎵" : upcoming.kind === "media" ? "🎬" : upcoming.kind === "bible" ? "📖" : "📢"} ${upcoming.label}`;
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#0A0A0A",
        color: "#FFFFFF",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "6vh 6vw",
        fontFamily: "system-ui, -apple-system, sans-serif",
        textAlign: "center",
        gap: "5vh",
      }}
    >
      {/* Linha atual — o bloco principal, o mais legível possível de longe. */}
      <div style={{ flex: "0 0 auto" }}>
        {state.mode === "lyrics" && currentLine && (
          <p style={{ fontSize: "clamp(2.2rem, 6.5vw, 6rem)", fontWeight: 800, lineHeight: 1.15 }}>{currentLine.text}</p>
        )}
        {state.mode === "lyrics" && !currentLine && state.song && (
          <p style={{ fontSize: "clamp(1.5rem, 4vw, 3rem)", fontWeight: 700, opacity: 0.6 }}>{state.song.title}</p>
        )}
        {state.mode === "announcement" && state.announcement && (
          <p style={{ fontSize: "clamp(2rem, 5.5vw, 5rem)", fontWeight: 800, lineHeight: 1.2 }}>{state.announcement.title}</p>
        )}
        {state.mode === "media" && state.media && (
          <p style={{ fontSize: "clamp(1.6rem, 4.5vw, 4rem)", fontWeight: 700, opacity: 0.75 }}>🎬 {state.media.title}</p>
        )}
        {state.mode === "bible" && state.bible && (
          <>
            <p style={{ fontSize: "clamp(2rem, 6vw, 5.5rem)", fontWeight: 800, lineHeight: 1.2 }}>{state.bible.text}</p>
            <p style={{ fontSize: "clamp(1rem, 2.5vw, 1.6rem)", opacity: 0.6, marginTop: "2vh" }}>
              {state.bible.book} {state.bible.chapter}:{state.bible.verse}
            </p>
          </>
        )}
        {state.mode === "countdown" && state.countdownEndsAt && (
          <>
            {state.countdownTitle && (
              <p style={{ fontSize: "clamp(1rem, 2.5vw, 1.6rem)", opacity: 0.7, marginBottom: "2vh" }}>{state.countdownTitle}</p>
            )}
            <p style={{ fontSize: "clamp(3rem, 10vw, 8rem)", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
              {formatCountdown(state.countdownEndsAt - Date.now())}
            </p>
          </>
        )}
        {state.mode === "idle" && <p style={{ fontSize: "1.4rem", opacity: 0.3 }}>Aguardando...</p>}
      </div>

      {/* Cronômetro de palco — fixo num canto, independente do que está em
          `mode` acima (letra/aviso continuam visíveis normalmente). */}
      {state.stageTimer && (
        <div
          style={{
            position: "fixed",
            top: "3vh",
            left: "3vw",
            display: "flex",
            alignItems: "baseline",
            gap: "1.2vw",
            opacity: 0.85,
          }}
        >
          <p style={{ fontSize: "clamp(1.4rem, 3.2vw, 2.6rem)", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {formatCountdown(Date.now() - state.stageTimer.startedAt)}
          </p>
          {state.stageTimer.label && (
            <p style={{ fontSize: "clamp(0.85rem, 1.6vw, 1.2rem)", opacity: 0.6 }}>{state.stageTimer.label}</p>
          )}
        </div>
      )}

      {/* Próxima linha (dentro da mesma música) ou próximo evento do roteiro. */}
      {(nextLine || nextEventLabel) && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "3vh", opacity: 0.5 }}>
          <p style={{ fontSize: "0.9rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1vh" }}>
            A seguir
          </p>
          <p style={{ fontSize: "clamp(1.3rem, 3vw, 2.4rem)", fontWeight: 600 }}>
            {nextLine ? nextLine.text : nextEventLabel}
          </p>
        </div>
      )}

      {churchName && (
        <p style={{ position: "fixed", bottom: "2vh", left: 0, right: 0, textAlign: "center", fontSize: "clamp(1rem, 2vw, 1.4rem)", opacity: 0.4 }}>
          {churchName}
        </p>
      )}
    </div>
  );
}
