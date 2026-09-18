"use client";

import { useState } from "react";
import type { LyricLine, Song } from "../types";
import { getAuthHeaders } from "../utils";

export function SongModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  // Mesmo formato de abas do "Nova Mídia" (Arquivo local / URL do YouTube):
  // separa visualmente o caminho manual do caminho com importação, em vez de
  // misturar os três campos numa lista só (o que fazia o YouTube parecer
  // obrigatório mesmo já sendo opcional).
  const [source, setSource] = useState<"manual" | "youtube">("manual");
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
      body: JSON.stringify({ title, artist, youtubeUrl: source === "youtube" ? youtubeUrl : "" }),
    });
    if (res.ok) onSaved();
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Nova Música</h2>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            className={`btn btn-sm ${source === "manual" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSource("manual")}
          >
            Manual
          </button>
          <button
            type="button"
            className={`btn btn-sm ${source === "youtube" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSource("youtube")}
          >
            Do YouTube
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="input-label">Título da Música *</label>
            <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex: Grande é o Senhor" />
          </div>
          <div>
            <label className="input-label">Artista</label>
            <input className="input-field" value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Ex: Adhemar de Campos" />
          </div>
          {source === "youtube" ? (
            <div>
              <label className="input-label">URL do YouTube *</label>
              <input
                className="input-field"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                required
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>
                Importa a letra automaticamente das legendas do vídeo, depois de criar a música.
              </p>
            </div>
          ) : (
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Depois de criar, adicione a letra em Letras — colando o texto completo ou linha por linha.
            </p>
          )}
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
  // Começa fechado mesmo pra música nova: a edição manual (Colar Texto /
  // Adicionar Linha, sempre visíveis abaixo) é o caminho padrão — o YouTube
  // é uma opção a mais, não o primeiro campo que aparece na tela.
  const [showYoutubeField, setShowYoutubeField] = useState(false);

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

  /** Inverso de formatMs — "1:05" -> 65000. `null` se não for um "m:ss" válido. */
  function parseMmSs(text: string): number | null {
    const m = text.trim().match(/^(\d+):([0-5]?\d)$/);
    if (!m) return null;
    return (parseInt(m[1], 10) * 60 + parseInt(m[2], 10)) * 1000;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 700 }}>
        <h2>Letras: {song.title}</h2>

        {/* Uma única fileira, alinhada — antes o(s) botão(ões) do YouTube
            ficavam numa linha separada dos outros três, sem alinhar com
            eles. Só o campo de URL (quando aberto) continua em bloco próprio
            abaixo, porque é um input, não um botão. */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
          {!showYoutubeField && (
            song.youtubeUrl ? (
              <>
                <button className="btn btn-secondary btn-sm" onClick={fetchFromYoutube} disabled={fetching}>
                  {fetching ? "Buscando..." : "🔍 Importar do YouTube de novo"}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowYoutubeField(true)}>
                  Trocar URL
                </button>
              </>
            ) : (
              // Sem URL salva ainda: um botão só, que abre o campo (não tenta
              // buscar direto — senão cai no alerta pedindo uma URL vazia).
              <button className="btn btn-secondary btn-sm" onClick={() => setShowYoutubeField(true)}>
                🔍 Importar do YouTube
              </button>
            )
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

        {showYoutubeField && (
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
        )}

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
                  {/* Tempo editável — pra músicas sem legenda do YouTube (importadas
                      manualmente ou coladas em bloco) o valor aqui é só um
                      placeholder de 4s por linha; sem isso não tinha como corrigir
                      pra bater com o andamento real da música. */}
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.75rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    <input
                      key={`start-${i}-${line.startMs}`}
                      defaultValue={formatMs(line.startMs)}
                      title="Início (m:ss)"
                      onBlur={(e) => {
                        const parsed = parseMmSs(e.target.value);
                        if (parsed !== null) updateLine(i, "startMs", parsed);
                        else e.target.value = formatMs(line.startMs);
                      }}
                      style={{
                        width: 40, padding: "3px 4px", background: "var(--overlay-3)",
                        border: "1px solid var(--border-glass)", borderRadius: "var(--radius-sm)",
                        color: "var(--text-secondary)", fontSize: "0.75rem", textAlign: "center",
                      }}
                    />
                    →
                    <input
                      key={`end-${i}-${line.endMs}`}
                      defaultValue={formatMs(line.endMs)}
                      title="Fim (m:ss)"
                      onBlur={(e) => {
                        const parsed = parseMmSs(e.target.value);
                        if (parsed !== null) updateLine(i, "endMs", parsed);
                        else e.target.value = formatMs(line.endMs);
                      }}
                      style={{
                        width: 40, padding: "3px 4px", background: "var(--overlay-3)",
                        border: "1px solid var(--border-glass)", borderRadius: "var(--radius-sm)",
                        color: "var(--text-secondary)", fontSize: "0.75rem", textAlign: "center",
                      }}
                    />
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
