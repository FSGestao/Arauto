"use client";

import { useState } from "react";
import type { BibleTranslationMeta } from "../types";

/**
 * Upload de uma tradução própria da Bíblia — JSON, XML (formato Zefania,
 * <XMLBIBLE>) ou CSV (colunas book/livro, chapter/capitulo, verse/versiculo,
 * text/texto). A tradução que já vem com o Arauto (Almeida 1911) é de
 * domínio público; a responsabilidade pelos direitos de uma enviada aqui é
 * de quem faz o upload — o Arauto não valida licença de arquivo enviado.
 */
export function BibleUploadModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (meta: BibleTranslationMeta) => void;
}) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("pt-BR");
  const [license, setLicense] = useState("");
  const [format, setFormat] = useState<"json" | "xml" | "csv">("json");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Escolha um arquivo");
      return;
    }
    setSaving(true);
    setError("");
    const form = new FormData();
    form.append("file", file);
    form.append("format", format);
    form.append("name", name);
    form.append("language", language);
    form.append("license", license);
    const token = document.cookie.match(/auth-token=([^;]+)/)?.[1] || "";
    const res = await fetch("/api/bible/translations", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json();
    if (res.ok) onSaved(data);
    else setError(data.error || "Erro ao processar o arquivo");
    setSaving(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Importar Bíblia</h2>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="input-label">Nome da tradução *</label>
            <input
              className="input-field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex: Nova Versão Internacional"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div>
              <label className="input-label">Idioma</label>
              <input className="input-field" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="pt-BR" />
            </div>
            <div>
              <label className="input-label">Formato do arquivo</label>
              <select className="input-field" value={format} onChange={(e) => setFormat(e.target.value as typeof format)}>
                <option value="json">JSON</option>
                <option value="xml">XML (Zefania)</option>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>
          <div>
            <label className="input-label">Licença / direitos de uso</label>
            <input
              className="input-field"
              value={license}
              onChange={(e) => setLicense(e.target.value)}
              placeholder="Ex: Uso autorizado pela editora, domínio público..."
            />
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
              A responsabilidade por ter os direitos de usar e projetar este texto é de quem envia —
              o Arauto não confere isso.
            </p>
          </div>
          <div>
            <label className="input-label">Arquivo *</label>
            <input
              className="input-field"
              type="file"
              accept=".json,.xml,.csv,application/json,text/xml,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 4 }}>
              JSON: <code>{"{ \"books\": [...] }"}</code> ou uma lista de <code>{"{ book, chapter, verse, text }"}</code>.
              {" "}XML: formato Zefania (<code>&lt;XMLBIBLE&gt;</code>). CSV: colunas book/livro, chapter/capitulo,
              verse/versiculo, text/texto.
            </p>
          </div>
          {error && <p style={{ fontSize: "0.85rem", color: "var(--danger)" }}>{error}</p>}
          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? "Processando..." : "Importar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
