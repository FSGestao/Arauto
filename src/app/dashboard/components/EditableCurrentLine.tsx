"use client";

import { useState, useEffect } from "react";

/**
 * Linha de letra que vira campo de texto ao clicar — corrige um erro de
 * digitação sem sair da apresentação. Enter salva, Esc cancela. O componente
 * não sabe onde salvar; só chama `onSave`, que cuida do socket + da API.
 */
export function EditableCurrentLine({
  text,
  onSave,
  style,
}: {
  text: string;
  onSave: (text: string) => void;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  useEffect(() => {
    if (!editing) setDraft(text);
  }, [text, editing]);

  function commit() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== text) onSave(trimmed);
    setEditing(false);
  }

  if (editing) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", ...style }}>
        <input
          className="input-field"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setDraft(text);
              setEditing(false);
            }
          }}
          onBlur={commit}
          style={{ flex: 1, fontSize: "inherit" }}
        />
      </div>
    );
  }

  return (
    <p
      onClick={() => setEditing(true)}
      style={{ color: "var(--text-secondary)", cursor: "pointer", ...style }}
      title="Clique para corrigir esta linha — atualiza a tela na hora"
    >
      &ldquo;{text}&rdquo; <span style={{ opacity: 0.4, fontSize: "0.8em" }}>✏️</span>
    </p>
  );
}
