"use client";

import { useState } from "react";
import type { Announcement, Song, MediaItem, ServiceItemType, ServiceItem, Service } from "../types";
import { getAuthHeaders } from "../utils";

export function ServiceModal({ onClose, onSaved }: { onClose: () => void; onSaved: (service: Service) => void }) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/services", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ title, date: date || null }),
    });
    const data = await res.json();
    if (res.ok) onSaved(data);
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Novo Culto</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="input-label">Nome do culto</label>
            <input className="input-field" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Ex: Culto de Oração" />
          </div>
          <div>
            <label className="input-label">Data (opcional)</label>
            <input className="input-field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Criando..." : "Criar Culto"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ServiceEditorModal({
  service,
  songs,
  announcements,
  mediaLibrary,
  onClose,
  onSaved,
}: {
  service: Service;
  songs: Song[];
  announcements: Announcement[];
  mediaLibrary: MediaItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<ServiceItem[]>(service.items);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<ServiceItemType | null>(null);

  function addItem(type: ServiceItemType, refId: number) {
    setItems([...items, { id: crypto.randomUUID(), type, refId }]);
    setPicker(null);
  }
  function removeItem(id: string) {
    setItems(items.filter((i) => i.id !== id));
  }
  function moveItem(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/services/${service.id}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ items }),
    });
    if (res.ok) onSaved();
    setSaving(false);
  }

  function labelFor(item: ServiceItem): string {
    if (item.type === "song") {
      const s = songs.find((x) => x.id === item.refId);
      return s ? `🎵 ${s.title}` : "🎵 (música removida)";
    }
    if (item.type === "media") {
      const m = mediaLibrary.find((x) => x.id === item.refId);
      return m ? `🎬 ${m.title}` : "🎬 (mídia removida)";
    }
    const a = announcements.find((x) => x.id === item.refId);
    return a ? `📢 ${a.title}` : "📢 (aviso removido)";
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <h2>Roteiro: {service.title}</h2>

        <div style={{ maxHeight: 340, overflowY: "auto", marginBottom: 16 }}>
          {items.length === 0 ? (
            <div className="empty-state" style={{ padding: 24 }}>
              <p>Nenhum item ainda. Adicione músicas e avisos abaixo, na ordem que serão apresentados.</p>
            </div>
          ) : (
            items.map((item, i) => (
              <div key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", width: 24 }}>{i + 1}</span>
                <span style={{ flex: 1, fontSize: "0.9rem" }}>{labelFor(item)}</span>
                <button className="btn btn-secondary btn-sm btn-icon" style={{ width: 32, height: 32 }} onClick={() => moveItem(i, -1)} disabled={i === 0}>↑</button>
                <button className="btn btn-secondary btn-sm btn-icon" style={{ width: 32, height: 32 }} onClick={() => moveItem(i, 1)} disabled={i === items.length - 1}>↓</button>
                <button className="btn btn-danger btn-sm btn-icon" style={{ width: 32, height: 32 }} onClick={() => removeItem(item.id)}>×</button>
              </div>
            ))
          )}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setPicker(picker === "song" ? null : "song")}>
            + Adicionar Música
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setPicker(picker === "announcement" ? null : "announcement")}>
            + Adicionar Aviso
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => setPicker(picker === "media" ? null : "media")}>
            + Adicionar Mídia
          </button>
        </div>

        {picker === "media" && (
          <div className="glass-card p-md mb-lg" style={{ maxHeight: 220, overflowY: "auto" }}>
            {mediaLibrary.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Nenhum áudio/vídeo enviado ainda — envie um na aba Mídia.
              </p>
            ) : (
              mediaLibrary.map((m) => (
                <button key={m.id} className="sidebar-link" onClick={() => addItem("media", m.id)}>
                  <span>
                    {m.kind === "audio" ? "🔊" : "🎬"} {m.title}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {picker === "song" && (
          <div className="glass-card p-md mb-lg" style={{ maxHeight: 220, overflowY: "auto" }}>
            {songs.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Nenhuma música salva ainda — crie uma no filtro Músicas.</p>
            ) : (
              songs.map((s) => (
                <button key={s.id} className="sidebar-link" onClick={() => addItem("song", s.id)}>
                  <span>🎵 {s.title}</span>
                </button>
              ))
            )}
          </div>
        )}

        {picker === "announcement" && (
          <div className="glass-card p-md mb-lg" style={{ maxHeight: 220, overflowY: "auto" }}>
            {announcements.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Nenhum aviso salvo ainda — crie um no filtro Avisos.</p>
            ) : (
              announcements.map((a) => (
                <button key={a.id} className="sidebar-link" onClick={() => addItem("announcement", a.id)}>
                  <span>📢 {a.title}</span>
                </button>
              ))
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Roteiro"}
          </button>
        </div>
      </div>
    </div>
  );
}
