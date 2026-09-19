"use client";

import { useEffect, useRef, useState } from "react";
import { formatCountdown } from "../utils";
import type { MediaItem } from "../types";
import { Icon } from "./Icon";

/**
 * Contagem regressiva — funciona independente de ter um culto em apresentação
 * (ex.: "entra em 5 minutos", antes de qualquer coisa começar). Quando ativa,
 * mostra o relógio rodando e um botão de parar; quando não, o formulário
 * pra escolher duração, uma mensagem opcional e uma imagem/vídeo opcional
 * (um cartaz do evento, por exemplo) pra acompanhar o relógio na tela.
 */
export function CountdownControl({
  active,
  endsAt,
  title,
  mediaLibrary,
  onStart,
  onStop,
  onUploadNew,
}: {
  active: boolean;
  endsAt: number | null;
  title: string | null;
  mediaLibrary: MediaItem[];
  onStart: (
    seconds: number,
    title: string,
    mediaFile: string | null,
    mediaKind: "image" | "video" | null,
    mediaSource: "upload" | "youtube" | null
  ) => void;
  onStop: () => void;
  /** Abre o envio de mídia sem precisar trocar pro filtro Mídia primeiro —
   *  o item enviado aparece automaticamente selecionado abaixo. */
  onUploadNew: () => void;
}) {
  const [minutes, setMinutes] = useState(5);
  const [label, setLabel] = useState("O culto começa em breve");
  const [mediaId, setMediaId] = useState<number | "">("");

  // Imagem e vídeo (enviado ou do YouTube) servem como cartaz atrás do
  // relógio — áudio não aparece na tela.
  const opcoesDeMidia = mediaLibrary.filter((m) => m.kind === "image" || m.kind === "video");

  // Depois de enviar pelo botão "+ Enviar novo" abaixo, seleciona o item
  // que acabou de entrar na lista — sem isso, o operador escolheria de
  // novo manualmente algo que ele já tinha acabado de escolher enviar.
  // Compara por ID (não por tamanho/posição): a API devolve a mídia mais
  // nova PRIMEIRO, então pegar "o último da lista" pegava o mais antigo.
  const knownIdsRef = useRef(new Set(opcoesDeMidia.map((m) => m.id)));
  useEffect(() => {
    if (mediaId === "") {
      const novo = opcoesDeMidia.find((m) => !knownIdsRef.current.has(m.id));
      if (novo) setMediaId(novo.id);
    }
    knownIdsRef.current = new Set(opcoesDeMidia.map((m) => m.id));
  }, [opcoesDeMidia, mediaId]);

  if (active && endsAt) {
    const remaining = formatCountdown(endsAt - Date.now());
    const done = endsAt - Date.now() <= 0;
    return (
      <div className="panel accent mb-lg">
        <div className="panel-head">
          <span className="panel-title">
            <span className="dot live" /> Contagem regressiva
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onStop}>
            ✕ Parar
          </button>
        </div>
        <div className="panel-body" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <p style={{ fontSize: "2.2rem", fontWeight: 800, fontVariantNumeric: "tabular-nums", color: done ? "var(--danger)" : "var(--text-primary)" }}>
            {remaining}
          </p>
          {title && <p style={{ color: "var(--text-secondary)" }}>{title}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-md mb-lg">
      <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase" }}>
        ⏱ Contagem regressiva
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input-field"
          type="number"
          min={1}
          max={180}
          value={minutes}
          onChange={(e) => setMinutes(Math.max(1, parseInt(e.target.value, 10) || 1))}
          style={{ width: 80 }}
        />
        <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>minutos</span>
        <input
          className="input-field"
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Mensagem (opcional)"
          style={{ flex: "1 1 200px", minWidth: 160 }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={() => {
            const escolhido = mediaId === "" ? null : opcoesDeMidia.find((m) => m.id === mediaId) || null;
            onStart(
              minutes * 60,
              label,
              escolhido?.file ?? null,
              escolhido?.kind === "image" || escolhido?.kind === "video" ? escolhido.kind : null,
              escolhido?.source ?? null
            );
          }}
        >
          ▶ Iniciar
        </button>
      </div>
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <label className="input-label" style={{ fontSize: "0.75rem", margin: 0 }}>Imagem ou vídeo (opcional)</label>
          <button
            type="button"
            className="act-btn ghost"
            style={{ fontSize: "0.72rem", padding: "4px 8px" }}
            onClick={onUploadNew}
          >
            <Icon name="upload" size={13} /> Enviar novo
          </button>
        </div>
        <select
          className="input-field"
          value={mediaId}
          onChange={(e) => setMediaId(e.target.value === "" ? "" : Number(e.target.value))}
        >
          <option value="">Nenhuma — só o relógio</option>
          {opcoesDeMidia.map((m) => (
            <option key={m.id} value={m.id}>
              {m.title} ({m.kind === "video" ? (m.source === "youtube" ? "vídeo do YouTube" : "vídeo") : "imagem"})
            </option>
          ))}
        </select>
        {opcoesDeMidia.length === 0 && (
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>
            Envie uma imagem ou vídeo no filtro Mídia pra ter opções aqui.
          </p>
        )}
      </div>
    </div>
  );
}
