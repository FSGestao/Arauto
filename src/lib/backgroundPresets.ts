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
  { id: "aurora", label: "Aurora", className: "bg-preset-aurora", swatch: "linear-gradient(120deg, #6d28d9, #db2777, #2563eb, #6d28d9)" },
  { id: "por-do-sol", label: "Pôr do sol", className: "bg-preset-por-do-sol", swatch: "linear-gradient(160deg, #7c2d92, #db5b3d, #f2a65a, #fde68a)" },
  { id: "oceano", label: "Oceano", className: "bg-preset-oceano", swatch: "linear-gradient(140deg, #0c4a6e, #0891b2, #0f766e, #34d399)" },
  { id: "esmeralda", label: "Esmeralda", className: "bg-preset-esmeralda", swatch: "linear-gradient(150deg, #052e16, #047857, #10b981)" },
  { id: "estrelado", label: "Estrelado", className: "bg-preset-estrelado", swatch: "radial-gradient(circle, #1e1b4b, #0a0a1a)" },
  { id: "raios-dourados", label: "Raios dourados", className: "bg-preset-raios-dourados", swatch: "conic-gradient(from 0deg, #78350f, #d97706, #fbbf24, #78350f)" },
  { id: "bokeh", label: "Luzes (bokeh)", className: "bg-preset-bokeh", swatch: "radial-gradient(circle at 30% 30%, #fbbf24, transparent 30%), radial-gradient(circle at 70% 60%, #db2777, transparent 30%), #1e1033" },
  { id: "vitral", label: "Vitral", className: "bg-preset-vitral", swatch: "linear-gradient(135deg, #7c3aed, #db2777, #f59e0b, #0891b2)" },
  { id: "poeira-dourada", label: "Poeira dourada", className: "bg-preset-poeira-dourada", swatch: "radial-gradient(circle at 30% 70%, #fbbf24, transparent 8%), radial-gradient(circle at 70% 40%, #f59e0b, transparent 8%), #060402" },
  { id: "brilho-suspenso", label: "Brilho suspenso", className: "bg-preset-brilho-suspenso", swatch: "radial-gradient(circle at 40% 30%, #fff, transparent 4%), radial-gradient(circle at 70% 60%, #fde68a, transparent 4%), #14121a" },
  { id: "ondas-serenas", label: "Ondas serenas", className: "bg-preset-ondas-serenas", swatch: "linear-gradient(100deg, #0f2027, #203a43, #2c5364)" },
  { id: "fitas-de-luz", label: "Fitas de luz", className: "bg-preset-fitas-de-luz", swatch: "radial-gradient(ellipse at 40% 50%, #7c3aed, transparent 60%), #0b0620" },
  { id: "feixes-de-luz", label: "Feixes de luz", className: "bg-preset-feixes-de-luz", swatch: "repeating-linear-gradient(75deg, rgba(255,255,255,0.25) 0px, rgba(255,255,255,0.25) 2px, transparent 2px, transparent 12px), #14161a" },
  { id: "raios-celestiais", label: "Raios celestiais", className: "bg-preset-raios-celestiais", swatch: "repeating-linear-gradient(12deg, rgba(200,220,255,0.35) 0px, rgba(200,220,255,0.35) 2px, transparent 2px, transparent 14px), #05070a" },
  { id: "galaxia", label: "Galáxia", className: "bg-preset-galaxia", swatch: "conic-gradient(from 90deg, #05040a, #2e1065, #4c1d95, #05040a)" },
  { id: "nuvens-poente", label: "Nuvens do poente", className: "bg-preset-nuvens-poente", swatch: "linear-gradient(160deg, #2d1b2e, #7c2d12, #c2410c, #78350f)" },
  { id: "nuvens-alva", label: "Nuvens da alva", className: "bg-preset-nuvens-alva", swatch: "linear-gradient(160deg, #1e1b3a, #4c1d95, #a21caf, #db2777)" },
];

export function findBackgroundPreset(id: string): BackgroundPreset | null {
  return BACKGROUND_PRESETS.find((p) => p.id === id) || null;
}

/** Prefixo usado no campo `background` pra distinguir um preset de um
 *  arquivo enviado (que é só o nome do arquivo, sem prefixo). */
export const PRESET_PREFIX = "preset:";
