"use client";

/* ═══════════════════════════════════════════════════════
   Controle remoto — versão mobile enxuta do painel, pra quem precisa
   avançar o roteiro (ou mostrar um aviso/mídia/versículo) sem estar na
   frente do computador. Deliberadamente independente do resto do painel
   (mesma convenção de /stage): tipos próprios, sem importar nada que
   dependa de login de admin — a sessão daqui é outra, mais fraca de
   propósito (ver server.js).
   ═══════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { parseBibleReference } from "../dashboard/utils";
import { Icon } from "../dashboard/components/Icon";

/* Mesma chave do alternador do painel (ver o script de pré-pintura em
   layout.tsx): quem já escolheu claro/escuro no computador encontra o
   controle remoto do mesmo jeito, e a escolha aqui sobrevive a recarregar. */
const THEME_KEY = "arauto-theme";
type Tema = "dark" | "light";

function BotaoTema({ tema, onTrocar }: { tema: Tema; onTrocar: () => void }) {
  return (
    <button
      className="remote-theme-btn"
      onClick={onTrocar}
      title={tema === "dark" ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      aria-label={tema === "dark" ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
    >
      <Icon name={tema === "dark" ? "sun" : "moon"} size={18} />
    </button>
  );
}

interface StepSummary {
  kind: "lyrics" | "announcement" | "media" | "bible";
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
  mode: string;
  service: ServiceProgress | null;
}
interface Announcement {
  id: number;
  title: string;
  content: string;
  active: boolean;
  mediaType: string;
  mediaFile: string | null;
}
interface MediaItem {
  id: number;
  title: string;
  kind: "audio" | "video" | "image";
  file: string;
  loop: boolean;
  volume: number;
  source?: "upload" | "youtube";
}
interface BibleVerse {
  number: number;
  text: string;
}
interface BibleBook {
  name: string;
  abbrev: string;
  chapters: { number: number; verses: BibleVerse[] }[];
}
interface BibleTranslationMeta {
  id: string;
  name: string;
}
interface BibleTranslationData extends BibleTranslationMeta {
  books: BibleBook[];
}

const SESSION_KEY = "arauto-remote-session";
type Tab = "roteiro" | "avisos" | "midia" | "biblia";

export default function RemotePage() {
  const [phase, setPhase] = useState<"checking" | "pin" | "connecting" | "ready" | "error">("checking");
  const [pin, setPin] = useState("");
  const [pairError, setPairError] = useState("");
  const [tema, setTema] = useState<Tema>("dark");
  const [tab, setTab] = useState<Tab>("roteiro");
  const [live, setLive] = useState<LiveState>({ mode: "idle", service: null });
  const [library, setLibrary] = useState<{ announcements: Announcement[]; media: MediaItem[] }>({
    announcements: [],
    media: [],
  });
  const socketRef = useRef<Socket | null>(null);

  const connectPaired = useCallback((sessionToken: string) => {
    setPhase("connecting");
    const socket = io({ path: "/socket.io", auth: { token: sessionToken }, query: { role: "remote" } });
    socketRef.current = socket;
    let gotState = false;
    socket.on("state:update", (s: LiveState) => {
      gotState = true;
      setLive(s);
      setPhase("ready");
    });
    socket.on("remote:library", (lib: { announcements: Announcement[]; media: MediaItem[] }) => setLibrary(lib));
    // Token inválido/expirado ou "Encerrar sessões" no painel — o servidor
    // derruba a conexão na hora (ver server.js). Se isso acontecer antes de
    // qualquer state:update chegar, o pareamento nunca foi válido de fato.
    socket.on("disconnect", () => {
      sessionStorage.removeItem(SESSION_KEY);
      if (!gotState) {
        setPairError("Código expirado ou sessão encerrada. Peça um novo código no computador.");
      } else {
        setPairError("Conexão encerrada. Peça um novo código no computador.");
      }
      setPhase("pin");
    });
  }, []);

  // Ao abrir: link com ?t=<token> redime sozinho; senão, sessão salva desta
  // aba tenta reconectar; senão, pede o PIN.
  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("t");

    if (urlToken) {
      window.history.replaceState({}, "", "/remote");
      redeem({ token: urlToken });
      return;
    }
    if (stored) {
      connectPaired(stored);
      return;
    }
    setPhase("pin");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function redeem(data: { pin?: string; token?: string }) {
    setPhase("connecting");
    setPairError("");
    const pending = io({ path: "/socket.io", query: { role: "remote-pending" } });
    pending.on("connect", () => {
      pending.emit("remote:redeem", data, (res: { ok: boolean; sessionToken?: string; error?: string }) => {
        pending.disconnect();
        if (res.ok && res.sessionToken) {
          sessionStorage.setItem(SESSION_KEY, res.sessionToken);
          connectPaired(res.sessionToken);
        } else {
          setPairError(res.error || "Código incorreto.");
          setPhase("pin");
        }
      });
    });
    pending.on("connect_error", () => {
      setPairError("Não foi possível conectar ao Arauto. Confira se está na mesma Wi-Fi.");
      setPhase("pin");
    });
  }

  useEffect(() => {
    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // O tema já foi aplicado no <html> antes da primeira pintura (layout.tsx);
  // aqui só sincronizamos o estado do botão com o que está valendo.
  useEffect(() => {
    try {
      if (localStorage.getItem(THEME_KEY) === "light") setTema("light");
    } catch {
      /* armazenamento bloqueado — segue no escuro */
    }
  }, []);

  function submitPin(e: React.FormEvent) {
    e.preventDefault();
    if (pin.trim().length !== 6) {
      setPairError("Digite os 6 dígitos do código.");
      return;
    }
    redeem({ pin: pin.trim() });
  }

  function trocarTema() {
    const novo: Tema = tema === "dark" ? "light" : "dark";
    setTema(novo);
    document.documentElement.dataset.theme = novo;
    try {
      localStorage.setItem(THEME_KEY, novo);
    } catch {
      /* modo privado: o tema vale só enquanto a aba estiver aberta */
    }
  }

  function sair() {
    sessionStorage.removeItem(SESSION_KEY);
    socketRef.current?.disconnect();
    setPhase("pin");
    setPin("");
  }

  if (phase === "checking" || phase === "connecting") {
    return (
      <div className="remote-shell remote-center">
        <div className="remote-spinner" />
        <p>Conectando…</p>
      </div>
    );
  }

  if (phase === "pin") {
    return (
      <div className="remote-shell remote-center">
        <div className="remote-theme-float">
          <BotaoTema tema={tema} onTrocar={trocarTema} />
        </div>
        {/* Mesma abertura da tela de login do painel: logo, "Arauto" com o
            degradê da marca e uma linha de contexto — é a primeira tela que
            alguém vê no celular, e ela precisa parecer o mesmo sistema. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {/* 32 pontos, igual à tela de login e à barra do painel — em tela de
            celular (densidade 2x ou 3x) o logo continua sendo reduzido a
            partir do arquivo de 124px, e não ampliado, que era o que o
            deixava borrado. */}
        <img className="remote-logo" src="/arauto-logo.png" alt="" width={32} height={32} />
        <h1 className="remote-brand">Arauto</h1>
        <p className="remote-sub">Controle remoto</p>
        <form className="remote-pin-form" onSubmit={submitPin}>
          <label className="remote-pin-label">Digite o código mostrado no computador</label>
          <input
            className="remote-pin-input"
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="000000"
          />
          {pairError && <p className="remote-error">{pairError}</p>}
          <button type="submit" className="remote-btn-primary">
            Entrar
          </button>
        </form>
        <p className="remote-hint">
          Em Configurações → Telas → Controle remoto, no computador, gere um código de pareamento.
        </p>
      </div>
    );
  }

  return (
    <div className="remote-shell">
      <header className="remote-header">
        <span className="remote-brand-sm">Arauto remoto</span>
        <div className="remote-header-actions">
          <BotaoTema tema={tema} onTrocar={trocarTema} />
          <button className="remote-logout" onClick={sair}>
            Sair
          </button>
        </div>
      </header>

      <main className="remote-content">
        {tab === "roteiro" && <RoteiroTab live={live} socket={socketRef.current} />}
        {tab === "avisos" && <AvisosTab items={library.announcements} socket={socketRef.current} />}
        {tab === "midia" && <MidiaTab items={library.media} socket={socketRef.current} />}
        {tab === "biblia" && <BibliaTab socket={socketRef.current} />}
      </main>

      <nav className="remote-tabs">
        <button className={`remote-tab ${tab === "roteiro" ? "active" : ""}`} onClick={() => setTab("roteiro")}>
          Roteiro
        </button>
        <button className={`remote-tab ${tab === "avisos" ? "active" : ""}`} onClick={() => setTab("avisos")}>
          Avisos
        </button>
        <button className={`remote-tab ${tab === "midia" ? "active" : ""}`} onClick={() => setTab("midia")}>
          Mídia
        </button>
        <button className={`remote-tab ${tab === "biblia" ? "active" : ""}`} onClick={() => setTab("biblia")}>
          Bíblia
        </button>
      </nav>
    </div>
  );
}

function RoteiroTab({ live, socket }: { live: LiveState; socket: Socket | null }) {
  const service = live.service;
  if (!service) {
    return (
      <div className="remote-empty">
        <p>Nenhum roteiro em apresentação agora.</p>
        <p className="remote-hint">Inicie um culto no painel — ele aparece aqui assim que estiver no ar.</p>
      </div>
    );
  }
  const current = service.steps[service.stepIndex];
  return (
    <div className="remote-roteiro">
      <div className="remote-now-card">
        <p className="remote-now-label">No ar agora</p>
        <p className="remote-now-title">{current?.label ?? "—"}</p>
        {current?.sublabel && <p className="remote-now-sub">{current.sublabel}</p>}
        <p className="remote-now-progress">
          Passo {service.stepIndex + 1} de {service.totalSteps} — {service.title}
        </p>
      </div>

      <div className="remote-nav-buttons">
        <button className="remote-nav-btn" onClick={() => socket?.emit("roteiro:prev")}>
          ← Anterior
        </button>
        <button className="remote-nav-btn primary" onClick={() => socket?.emit("roteiro:next")}>
          Próximo →
        </button>
      </div>

      <ul className="remote-step-list">
        {service.steps.map((step, i) => (
          <li key={i}>
            <button
              className={`remote-step-item ${i === service.stepIndex ? "active" : ""} ${step.skip ? "skip" : ""}`}
              onClick={() => socket?.emit("admin:goToStep", i)}
            >
              <span className="remote-step-index">{i + 1}</span>
              <span className="remote-step-text">
                <strong>{step.label}</strong>
                {step.sublabel && <em>{step.sublabel}</em>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AvisosTab({ items, socket }: { items: Announcement[]; socket: Socket | null }) {
  if (items.length === 0) {
    return (
      <div className="remote-empty">
        <p>Nenhum aviso cadastrado.</p>
      </div>
    );
  }
  return (
    <ul className="remote-list">
      {items.map((a) => (
        <li key={a.id}>
          <button className="remote-list-item" onClick={() => socket?.emit("admin:showAnnouncement", a)}>
            <strong>{a.title}</strong>
            <span>{a.content}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function MidiaTab({ items, socket }: { items: MediaItem[]; socket: Socket | null }) {
  if (items.length === 0) {
    return (
      <div className="remote-empty">
        <p>Nenhuma mídia na biblioteca.</p>
      </div>
    );
  }
  const KIND_LABEL: Record<string, string> = { audio: "Áudio", video: "Vídeo", image: "Imagem" };
  return (
    <ul className="remote-list">
      {items.map((m) => (
        <li key={m.id}>
          <button className="remote-list-item" onClick={() => socket?.emit("admin:showMedia", m)}>
            <strong>{m.title}</strong>
            <span>{KIND_LABEL[m.kind] ?? m.kind}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function BibliaTab({ socket }: { socket: Socket | null }) {
  const [translations, setTranslations] = useState<BibleTranslationMeta[]>([]);
  const [translationId, setTranslationId] = useState<string | null>(null);
  const [data, setData] = useState<BibleTranslationData | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/bible/translations")
      .then((r) => r.json())
      .then((list: BibleTranslationMeta[]) => {
        setTranslations(list);
        if (list.length > 0) setTranslationId(list[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!translationId) return;
    setLoading(true);
    fetch(`/api/bible/translations/${translationId}`)
      .then((r) => r.json())
      .then((d: BibleTranslationData) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [translationId]);

  const parsed = data ? parseBibleReference(query, data.books) : null;
  const chapterVerses = parsed ? parsed.book.chapters.find((c) => c.number === parsed.chapter)?.verses ?? [] : [];

  function select(book: BibleBook, chapter: number, verse: BibleVerse) {
    if (!translationId || !data) return;
    socket?.emit("admin:selectBibleVerse", {
      translationId,
      translationName: data.name,
      book: book.name,
      bookAbbrev: book.abbrev,
      chapter,
      verse: verse.number,
      text: verse.text,
    });
  }

  return (
    <div className="remote-bible">
      {translations.length > 1 && (
        <select className="remote-select" value={translationId ?? ""} onChange={(e) => setTranslationId(e.target.value)}>
          {translations.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      )}
      <input
        className="remote-search"
        placeholder='Ex: jo 3:16, salmos 23'
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading && <p className="remote-hint">Carregando…</p>}

      {!loading && query && !parsed && (
        <p className="remote-hint">Não encontrei essa referência. Tente algo como &quot;jo 3:16&quot;.</p>
      )}

      {parsed && (
        <ul className="remote-list">
          {(parsed.verse ? chapterVerses.filter((v) => v.number === parsed.verse) : chapterVerses).map((v) => (
            <li key={v.number}>
              <button className="remote-list-item" onClick={() => select(parsed.book, parsed.chapter, v)}>
                <strong>
                  {parsed.book.name} {parsed.chapter}:{v.number}
                </strong>
                <span>{v.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
