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
  bible: "Versículo",
  countdown: "Contagem regressiva",
  idle: "Tela limpa",
};

/** Remove só o acento (mantém caixa/trim de fora). */
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Reconhece uma referência bíblica digitada ("jo 3:16", "salmos 23",
 *  "1co 13.4", "Apocalipse 21 4") e devolve o livro/capítulo/versículo —
 *  ou `null` se o texto não for uma referência (cai pra busca por palavra).
 *  Casa pela abreviação interna, pelo nome completo (com ou sem acento) ou
 *  por um prefixo do nome, pra não depender de digitar a forma exata. */
export function parseBibleReference<T extends { name: string; abbrev: string; chapters: { number: number }[] }>(
  query: string,
  books: T[]
): { book: T; chapter: number; verse: number | null } | null {
  const m = query.trim().match(/^([1-3]?\s*[a-zà-úA-ZÀ-Ú]+)\.?\s+(\d+)(?:[:.,\s]+(\d+))?\s*$/);
  if (!m) return null;
  const rawKey = m[1].toLowerCase().replace(/\s+/g, "");
  const plainKey = stripAccents(rawKey);
  const chapter = parseInt(m[2], 10);
  const verse = m[3] ? parseInt(m[3], 10) : null;
  if (!rawKey || !(chapter > 0)) return null;

  // Abreviação é sensível a acento de propósito: sem isso, "jó" (o livro)
  // e "jo" (abreviação de João) colidem depois de tirar o acento.
  const book =
    books.find((b) => b.abbrev.toLowerCase() === rawKey) ||
    books.find((b) => stripAccents(b.name.toLowerCase()).replace(/\s+/g, "") === plainKey) ||
    books.find((b) => stripAccents(b.name.toLowerCase()).replace(/\s+/g, "").startsWith(plainKey));
  if (!book || chapter > book.chapters.length) return null;

  return { book, chapter, verse };
}

/** Compara duas versões "x.y.z" — negativo se `a` for mais antiga que `b`,
 *  positivo se mais nova, 0 se iguais. Usado pra saber quais notas de
 *  versão o operador ainda não viu. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

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

/**
 * Data de um culto (guardada como "AAAA-MM-DD") no formato dd/mm/aaaa.
 *
 * Feito na mão de propósito: `new Date("2026-01-11")` é interpretado como
 * meia-noite em UTC e, em qualquer fuso a oeste de Greenwich (o Brasil
 * inteiro), volta um dia — um culto marcado para domingo aparecia no painel
 * com a data de sábado.
 */
export function formatServiceDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return new Date(iso).toLocaleDateString("pt-BR");
  return `${m[3]}/${m[2]}/${m[1]}`;
}
