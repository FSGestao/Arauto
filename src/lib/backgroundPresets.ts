/* ═══════════════════════════════════════════════════════
   Fundos prontos da projeção — escolhidos no painel sem precisar enviar
   arquivo. Compartilhado entre o painel (mostra os cartões pra escolher) e
   a projeção (aplica a classe CSS correspondente, definidas em globals.css).

   Guardados como "preset:<id>" no mesmo campo `background` que também
   guarda o nome de um arquivo enviado (vídeo/imagem) — pro servidor os dois
   são só uma string opaca que ele repassa por socket, sem saber o que
   significam.
   ═══════════════════════════════════════════════════════ */

export interface BackgroundPreset {
  id: string;
  label: string;
  /** Classe CSS aplicada na projeção (definida em globals.css). */
  className: string;
  /** Gradiente CSS usado só como miniatura no seletor do painel. */
  swatch: string;
}

export const BACKGROUND_PRESETS: BackgroundPreset[] = [
  { id: "meia-noite", label: "Meia-noite", className: "bg-preset-meia-noite", swatch: "linear-gradient(160deg, #0f0a1e, #1a1235)" },
  { id: "aurora", label: "Aurora", className: "bg-preset-aurora", swatch: "linear-gradient(120deg, #4c1d95, #7c3aed, #db2777)" },
  { id: "amanhecer", label: "Amanhecer", className: "bg-preset-amanhecer", swatch: "linear-gradient(160deg, #7c2d92, #db5b3d, #f2a65a)" },
  { id: "oceano", label: "Oceano", className: "bg-preset-oceano", swatch: "linear-gradient(140deg, #0c4a6e, #0891b2, #0f766e)" },
  { id: "estrelado", label: "Estrelado", className: "bg-preset-estrelado", swatch: "radial-gradient(circle, #1e1b4b, #0a0a1a)" },
  { id: "raios", label: "Raios de luz", className: "bg-preset-raios", swatch: "conic-gradient(from 0deg, #1e1b4b, #4c1d95, #1e1b4b)" },
];

export function findBackgroundPreset(id: string): BackgroundPreset | null {
  return BACKGROUND_PRESETS.find((p) => p.id === id) || null;
}

/** Prefixo usado no campo `background` pra distinguir um preset de um
 *  arquivo enviado (que é só o nome do arquivo, sem prefixo). */
export const PRESET_PREFIX = "preset:";
