"use client";

import { useState, useEffect, useRef } from "react";
import type { Announcement, Song, MediaItem } from "../types";

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
export function GlobalSearch({
  songs,
  announcements,
  mediaLibrary,
  initialQuery = "",
  onClose,
  onPick,
}: {
  songs: Song[];
  announcements: Announcement[];
  mediaLibrary: MediaItem[];
  initialQuery?: string;
  onClose: () => void;
  onPick: (kind: SearchKind, item: Song | Announcement | MediaItem) => void;
}) {
  const [query, setQuery] = useState(initialQuery);
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
