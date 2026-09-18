"use client";

import { useState } from "react";
import type { LyricLine, Song } from "../types";
import { getAuthHeaders } from "../utils";

export function SongModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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

export function LyricsEditorModal({ song, onClose, onSaved }: { song: Song; onClose: () => void; onSaved: () => void }) {
  const [lyrics, setLyrics] = useState<LyricLine[]>(song.lyrics || []);
  const [saving, setSaving] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [mode, setMode] = useState<"editor" | "bulk">("editor");
  // Editável aqui: antes só dava pra definir a URL do YouTube na criação da
  // música — se ela já existisse sem URL, não tinha como voltar e importar
  // depois. Salva junto com a primeira importação, sem passo separado.
  const [youtubeUrl, setYoutubeUrl] = useState(song.youtubeUrl || "");
  const [showYoutubeField, setShowYoutubeField] = useState(!song.youtubeUrl);

  async function fetchFromYoutube() {
    const url = youtubeUrl.trim();
    if (!url) return alert("Cole a URL do YouTube desta música primeiro");
    setFetching(true);
    try {
      // Se a URL mudou (ou é nova), salva na música antes de importar — assim
      // a próxima vez que abrir Letras o botão já vem com ela pronta.
      if (url !== (song.youtubeUrl || "")) {
        await fetch(`/api/songs/${song.id}`, {
          method: "PUT",
          headers: getAuthHeaders(),
          body: JSON.stringify({ title: song.title, artist: song.artist, youtubeUrl: url }),
        });
      }
      const res = await fetch("/api/songs/fetch-lyrics", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ youtubeUrl: url }),
      });
      const data = await res.json();
      if (res.ok && data.lyrics) {
        setLyrics(data.lyrics);
        setShowYoutubeField(false);
      } else {
        alert(data.error || "Não foi possível extrair legendas — confira se o vídeo tem legendas ativadas");
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

        {showYoutubeField ? (
          <div style={{ marginBottom: 16 }}>
            <label className="input-label">URL do YouTube</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input-field"
                style={{ flex: 1 }}
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <button className="btn btn-primary btn-sm" onClick={fetchFromYoutube} disabled={fetching || !youtubeUrl.trim()}>
                {fetching ? "Buscando..." : "🔍 Importar"}
              </button>
            </div>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
              Precisa de um vídeo com legendas ativadas — funciona melhor com o clipe oficial ou um cover que já tenha CC.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
            <button className="btn btn-secondary btn-sm" onClick={fetchFromYoutube} disabled={fetching}>
              {fetching ? "Buscando..." : "🔍 Importar do YouTube de novo"}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowYoutubeField(true)}>
              Trocar URL
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
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
