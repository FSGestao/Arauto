"use client";

import { useState } from "react";
import { formatCountdown } from "../utils";

/**
 * Contagem regressiva — funciona independente de ter um culto em apresentação
 * (ex.: "entra em 5 minutos", antes de qualquer coisa começar). Quando ativa,
 * mostra o relógio rodando e um botão de parar; quando não, o formulário
 * pra escolher duração e uma mensagem opcional.
 */
export function CountdownControl({
  active,
  endsAt,
  title,
  onStart,
  onStop,
}: {
  active: boolean;
  endsAt: number | null;
  title: string | null;
  onStart: (seconds: number, title: string) => void;
  onStop: () => void;
}) {
  const [minutes, setMinutes] = useState(5);
  const [label, setLabel] = useState("O culto começa em breve");

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
        <button className="btn btn-primary btn-sm" onClick={() => onStart(minutes * 60, label)}>
          ▶ Iniciar
        </button>
      </div>
    </div>
  );
}
