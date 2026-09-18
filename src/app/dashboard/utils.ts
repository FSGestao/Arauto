/* ═══════════════════════════════════════════════════════
   Autenticação e formatação usadas em todo o painel.
   ═══════════════════════════════════════════════════════ */

export function getAuthHeaders(): HeadersInit {
  const match = document.cookie.match(/auth-token=([^;]+)/);
  const token = match ? match[1] : "";
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export function getAuthToken(): string {
  const match = document.cookie.match(/auth-token=([^;]+)/);
  return match ? match[1] : "";
}

/** Rótulo por tipo de item — o mesmo nome em todo o painel, pra o operador
 *  reconhecer o tipo de conteúdo sem precisar interpretar ícone. */
export const STEP_LABEL: Record<string, string> = {
  lyrics: "Música",
  announcement: "Aviso",
  media: "Mídia",
  countdown: "Contagem regressiva",
  idle: "Tela limpa",
};

/** Formata milissegundos restantes como mm:ss ou h:mm:ss — usado tanto no
 * painel do operador quanto (via a mesma lógica) na tela de projeção. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Formata segundos como m:ss (usado na barra de progresso da mídia). */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Marca de tempo de uma linha de letra, no formato h:mm:ss do painel. */
export function formatTimestamp(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
