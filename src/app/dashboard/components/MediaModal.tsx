"use client";

import { useState } from "react";
import { getAuthHeaders } from "../utils";

/** Extrai o ID de uma URL do YouTube, só pra mostrar a miniatura antes de
 *  salvar — a validação de verdade é feita no servidor (ver
 *  src/app/api/media-library/route.ts). */
function extractYoutubeId(input: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const match = input.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

export function MediaModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [source, setSource] = useState<"upload" | "youtube">("upload");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<string | null>(null);
  const [kind, setKind] = useState<"audio" | "video" | "image" | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [loop, setLoop] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const youtubeId = source === "youtube" ? extractYoutubeId(youtubeUrl.trim()) : null;

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
    if (res.ok && (data.mediaType === "audio" || data.mediaType === "video" || data.mediaType === "image")) {
      setFile(data.filename);
      setKind(data.mediaType);
      // Sugere o nome do arquivo como título, se ainda estiver vazio.
      if (!title.trim()) setTitle(picked.name.replace(/\.[^.]+$/, ""));
    } else {
      setError(data.error || "Erro ao enviar arquivo");
    }
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (source === "youtube") {
      if (!youtubeId) {
        setError("Cole uma URL do YouTube válida");
        return;
      }
      setSaving(true);
      const res = await fetch("/api/media-library", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ title, source: "youtube", youtubeUrl: youtubeUrl.trim(), loop }),
      });
      if (res.ok) onSaved();
      else setError((await res.json().catch(() => null))?.error || "Erro ao salvar");
      setSaving(false);
      return;
    }
    if (!file || !kind) {
      setError("Envie um arquivo de áudio, vídeo ou imagem primeiro");
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
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            className={`btn btn-sm ${source === "upload" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSource("upload")}
          >
            Arquivo local
          </button>
          <button
            type="button"
            className={`btn btn-sm ${source === "youtube" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setSource("youtube")}
          >
            URL do YouTube
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {source === "youtube" ? (
            <div>
              <label className="input-label">URL do vídeo *</label>
              <input
                className="input-field"
                value={youtubeUrl}
                onChange={(e) => setYoutubeUrl(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                Toca embutido, com os mesmos controles (pausar, avançar posição, volume) de um
                vídeo enviado — só precisa de internet no computador da projeção.
              </p>
              {youtubeUrl.trim() && (
                youtubeId ? (
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
                    <img
                      src={`https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`}
                      alt=""
                      style={{ width: 100, borderRadius: "var(--radius-sm)" }}
                    />
                    <p style={{ fontSize: "0.8rem", color: "var(--success)" }}>✓ vídeo encontrado</p>
                  </div>
                ) : (
                  <p style={{ fontSize: "0.8rem", color: "var(--danger)", marginTop: 4 }}>
                    Não reconheci essa URL como um link do YouTube.
                  </p>
                )
              )}
            </div>
          ) : (
            <div>
              <label className="input-label">Arquivo de áudio, vídeo ou imagem *</label>
              <input
                className="input-field"
                type="file"
                accept="audio/*,video/*,image/*"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
                Áudio: mp3, wav, ogg, m4a (até 100 MB) · Vídeo: mp4, webm, ogv (até 300 MB) ·
                Imagem: jpg, png, gif, webp (até 20 MB) — imagens servem como fundo estático atrás da letra.
              </p>
              {uploading && <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 4 }}>Enviando...</p>}
              {file && !uploading && (
                <p style={{ fontSize: "0.8rem", color: "var(--success)", marginTop: 4 }}>
                  ✓ {kind === "audio" ? "Áudio" : kind === "video" ? "Vídeo" : "Imagem"} enviado
                </p>
              )}
            </div>
          )}
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
          {kind !== "image" && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.9rem" }}>
              <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
              Repetir em loop (útil pra fundo animado e trilha de espera)
            </label>
          )}
          {error && <p style={{ fontSize: "0.85rem", color: "var(--danger)" }}>{error}</p>}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || uploading || (source === "youtube" ? !youtubeId : !file)}
            >
              {saving ? "Salvando..." : "Adicionar Mídia"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
