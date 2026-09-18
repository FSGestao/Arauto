"use client";

import { useEffect, useState } from "react";

/** Formata milissegundos decorridos como mm:ss ou h:mm:ss. */
function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Cronômetro (contagem crescente) que só aparece na tela de Stage View —
 * pensado pra medir a duração do louvor ou da pregação sem tirar a letra ou
 * o aviso da tela pública. Diferente da Contagem regressiva: não tem cartaz
 * (imagem/vídeo), porque a Stage View é de propósito uma tela sem identidade
 * visual — só o monitor de confiança de quem está no palco.
 */
export function StageTimerControl({
  active,
  startedAt,
  label,
  onStart,
  onStop,
}: {
  active: boolean;
  startedAt: number | null;
  label: string | null;
  onStart: (label: string) => void;
  onStop: () => void;
}) {
  const [inputLabel, setInputLabel] = useState("Pregação");
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [active]);

  if (active && startedAt) {
    return (
      <div className="panel accent mb-lg">
        <div className="panel-head">
          <span className="panel-title">
            <span className="dot live" /> Timer de palco
          </span>
          <button className="btn btn-secondary btn-sm" onClick={onStop}>
            ✕ Parar
          </button>
        </div>
        <div className="panel-body" style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <p style={{ fontSize: "2.2rem", fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
            {formatElapsed(Date.now() - startedAt)}
          </p>
          {label && <p style={{ color: "var(--text-secondary)" }}>{label}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-md mb-lg">
      <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, textTransform: "uppercase" }}>
        ⏱ Timer de palco
      </p>
      <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: 10 }}>
        Cronômetro crescente, visível só em /stage — mede a duração de algo (louvor, pregação) sem
        mudar o que está sendo projetado.
      </p>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input
          className="input-field"
          type="text"
          value={inputLabel}
          onChange={(e) => setInputLabel(e.target.value)}
          placeholder="Ex: Pregação"
          style={{ flex: "1 1 200px", minWidth: 160 }}
        />
        <button className="btn btn-primary btn-sm" onClick={() => onStart(inputLabel)}>
          ▶ Iniciar
        </button>
      </div>
    </div>
  );
}
