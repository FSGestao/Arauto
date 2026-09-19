"use client";

import { useEffect, useState } from "react";

/**
 * Rede de segurança pra qualquer erro de renderização não tratado — sem isto,
 * o Next.js mostra uma tela em branco (ou o overlay de erro do navegador) sem
 * jeito de voltar sozinho. Como /projection e /stage rodam sem ninguém
 * olhando o teclado durante o culto, a recuperação não pode depender de
 * alguém clicar em nada: tenta `reset()` (sem recarregar a página) e, se
 * continuar quebrado, recarrega a página inteira sozinho pouco depois.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [secondsLeft, setSecondsLeft] = useState(5);

  useEffect(() => {
    console.error("[Arauto] Erro de renderização:", error);
    // Primeira tentativa: reconstrói só esta parte da árvore, sem perder o
    // resto do estado do navegador (mais rápido, e não pisca a tela toda).
    const retry = setTimeout(() => reset(), 1200);
    return () => clearTimeout(retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);

  useEffect(() => {
    if (secondsLeft <= 0) {
      window.location.reload();
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        background: "#0F0A1E",
        color: "#F8FAFC",
        fontFamily: "Inter, system-ui, sans-serif",
        textAlign: "center",
        padding: 24,
      }}
    >
      <p style={{ fontSize: "1.1rem", fontWeight: 700 }}>Algo deu errado nesta tela</p>
      <p style={{ fontSize: "0.9rem", color: "#94A3B8", maxWidth: 420 }}>
        O Arauto vai se recuperar sozinho em instantes. Se isto acontecer de novo,
        avise quem administra o sistema.
      </p>
      <p style={{ fontSize: "0.8rem", color: "#64748B" }}>Recarregando em {secondsLeft}s…</p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: 6,
          padding: "10px 20px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "#6C3AED",
          color: "#fff",
          fontWeight: 600,
          fontSize: "0.85rem",
          cursor: "pointer",
        }}
      >
        Recarregar agora
      </button>
    </div>
  );
}
