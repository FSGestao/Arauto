"use client";

import { useState } from "react";
import type { MediaType, AnnouncementTemplate } from "../types";
import { getAuthHeaders } from "../utils";

export function AnnouncementModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
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

/** Extrai os nomes únicos de variáveis {{assim}} de um ou mais textos, na ordem em que aparecem. */
function extractTemplateVars(...texts: string[]): string[] {
  const seen: string[] = [];
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  for (const text of texts) {
    let m;
    while ((m = re.exec(text))) {
      if (!seen.includes(m[1])) seen.push(m[1]);
    }
  }
  return seen;
}

/** Substitui {{variavel}} pelo valor informado; variáveis sem valor preenchido viram string vazia. */
function fillTemplate(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name) => values[name] ?? "");
}

export function TemplateModal({
  template,
  onClose,
  onSaved,
}: {
  template: AnnouncementTemplate | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(template?.title ?? "");
  const [content, setContent] = useState(template?.content ?? "");
  const [saving, setSaving] = useState(false);
  const vars = extractTemplateVars(title, content);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url = template ? `/api/announcement-templates/${template.id}` : "/api/announcement-templates";
    const res = await fetch(url, {
      method: template ? "PUT" : "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, content }),
    });
    if (res.ok) onSaved();
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{template ? "Editar Modelo" : "Novo Modelo"}</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="input-label">Título</label>
            <input
              className="input-field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Ex: Culto de {{data}}"
            />
          </div>
          <div>
            <label className="input-label">Conteúdo</label>
            <textarea
              className="input-field"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              placeholder="Ex: Hoje, {{data}}, teremos a pregação de {{pregador}}."
            />
          </div>
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Use <code>{"{{nome}}"}</code> pra marcar um trecho que muda a cada culto.
            {vars.length > 0 && <> Variáveis encontradas: {vars.map((v) => `{{${v}}}`).join(", ")}</>}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Salvando..." : "Salvar Modelo"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function UseTemplateModal({
  template,
  onClose,
  onCreated,
}: {
  template: AnnouncementTemplate;
  onClose: () => void;
  onCreated: () => void;
}) {
  const vars = extractTemplateVars(template.title, template.content);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const finalTitle = fillTemplate(template.title, values);
  const finalContent = fillTemplate(template.content, values);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title: finalTitle, content: finalContent, mediaType: "none", mediaFile: null }),
    });
    if (res.ok) onCreated();
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Usar modelo: {template.title.replace(/\{\{[^}]+\}\}/g, "…")}</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {vars.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Este modelo não tem variáveis — o aviso será criado exatamente como o modelo.</p>
          ) : (
            vars.map((v) => (
              <div key={v}>
                <label className="input-label">{v}</label>
                <input
                  className="input-field"
                  autoFocus={v === vars[0]}
                  value={values[v] ?? ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                  placeholder={`Valor de {{${v}}}`}
                />
              </div>
            ))
          )}
          <div className="panel" style={{ padding: 12 }}>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: 4 }}>Pré-visualização</p>
            <p style={{ fontWeight: 700 }}>{finalTitle || "(sem título)"}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{finalContent}</p>
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Criando..." : "Criar Aviso"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
