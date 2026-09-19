"use client";

import { useMemo, useRef, useState } from "react";
import type { Announcement, Song, MediaItem, ServiceItemType, ServiceItem, Service, BibleTranslationData, BibleReference } from "../types";
import { getAuthHeaders, parseBibleReference } from "../utils";

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
  bibleData,
  bibleTranslationId,
  onClose,
  onSaved,
}: {
  service: Service;
  songs: Song[];
  announcements: Announcement[];
  mediaLibrary: MediaItem[];
  bibleData: BibleTranslationData | null;
  bibleTranslationId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<ServiceItem[]>(service.items);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<ServiceItemType | null>(null);
  const [bibleQuery, setBibleQuery] = useState("");
  // Tirar um item exige clicar duas vezes (o botão vira "Remover?" por 3s) —
  // um "×" pequeno sozinho ao lado de "↑"/"↓" é fácil de acertar sem querer.
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function addItem(type: ServiceItemType, refId: number, bible?: BibleReference) {
    setItems([...items, bible ? { id: crypto.randomUUID(), type, refId, bible } : { id: crypto.randomUUID(), type, refId }]);
    setPicker(null);
    setBibleQuery("");
  }

  function handleRemoveClick(id: string) {
    if (confirmRemoveId === id) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      setConfirmRemoveId(null);
      removeItem(id);
      return;
    }
    setConfirmRemoveId(id);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = setTimeout(() => setConfirmRemoveId(null), 3000);
  }

  const bibleResults = useMemo(() => {
    if (!bibleData || !bibleTranslationId || bibleQuery.trim().length < 2) return [];
    const ref = parseBibleReference(bibleQuery, bibleData.books);
    if (!ref) return [];
    const chapter = ref.book.chapters.find((c) => c.number === ref.chapter);
    const verses = ref.verse ? chapter?.verses.filter((v) => v.number === ref.verse) ?? [] : chapter?.verses ?? [];
    return verses.map((verse) => ({ book: ref.book, chapter: ref.chapter, verse })).slice(0, 60);
  }, [bibleQuery, bibleData, bibleTranslationId]);

  function addBibleVerse(book: { name: string; abbrev: string }, chapterNumber: number, verse: { number: number; text: string }) {
    if (!bibleData || !bibleTranslationId) return;
    const ref: BibleReference = {
      translationId: bibleTranslationId,
      translationName: bibleData.name,
      book: book.name,
      bookAbbrev: book.abbrev,
      chapter: chapterNumber,
      verse: verse.number,
      text: verse.text,
    };
    addItem("bible", 0, ref);
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
    if (item.type === "bible") {
      return item.bible ? `📖 ${item.bible.book} ${item.bible.chapter}:${item.bible.verse}` : "📖 (versículo)";
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
                <button
                  className="btn btn-danger btn-sm btn-icon"
                  style={confirmRemoveId === item.id ? { width: "auto", height: 32, padding: "0 8px", fontSize: "0.72rem" } : { width: 32, height: 32 }}
                  title={confirmRemoveId === item.id ? "Clique de novo para confirmar" : "Tirar do roteiro"}
                  onClick={() => handleRemoveClick(item.id)}
                >
                  {confirmRemoveId === item.id ? "Remover?" : "×"}
                </button>
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
          <button className="btn btn-secondary btn-sm" onClick={() => setPicker(picker === "bible" ? null : "bible")}>
            + Adicionar Versículo
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

        {picker === "bible" && (
          <div className="glass-card p-md mb-lg">
            {!bibleData || !bibleTranslationId ? (
              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                Escolha uma tradução no filtro Bíblia primeiro.
              </p>
            ) : (
              <>
                <input
                  className="input-field"
                  autoFocus
                  value={bibleQuery}
                  onChange={(e) => setBibleQuery(e.target.value)}
                  placeholder="Ex: jo 3:16, salmos 23..."
                  style={{ marginBottom: 10 }}
                />
                <div style={{ maxHeight: 220, overflowY: "auto" }}>
                  {bibleQuery.trim().length >= 2 && bibleResults.length === 0 && (
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Nenhum versículo encontrado.</p>
                  )}
                  {bibleResults.map((r) => (
                    <button
                      key={`${r.book.abbrev}-${r.chapter}-${r.verse.number}`}
                      className="sidebar-link"
                      style={{ textAlign: "left", alignItems: "flex-start" }}
                      onClick={() => addBibleVerse(r.book, r.chapter, r.verse)}
                    >
                      <span>
                        📖 <strong>{r.book.name} {r.chapter}:{r.verse.number}</strong> — {r.verse.text}
                      </span>
                    </button>
                  ))}
                </div>
              </>
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
