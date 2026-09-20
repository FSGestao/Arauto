/* Monta GIFs animados a partir de screenshots PNG (capturados via CDP) —
   pura JS, sem `canvas` nem qualquer binding nativo (não builda no Windows
   sem toolchain de C++). Usa `pngjs` pra decodificar os PNGs e `omggif` pra
   escrever o GIF; a quantização de cor (paleta global de até 256 cores) é
   feita aqui com um median cut simples — suficiente pra capturas de tela de
   interface (áreas grandes de cor lisa + texto), que não são fotografia. */
const fs = require("fs");
const { PNG } = require("pngjs");
const { GifWriter } = require("omggif");

/** Decodifica um PNG (buffer) pra {width, height, data} RGBA. */
function decodePng(buffer) {
  const png = PNG.sync.read(buffer);
  return { width: png.width, height: png.height, data: png.data };
}

/** Median cut: recebe uma lista de pixels [r,g,b] e devolve até `maxColors`
 *  cores representativas. Implementação direta (sem otimização de
 *  performance) — roda uma vez por conjunto de frames, não em tempo real. */
function medianCutPalette(pixels, maxColors) {
  function boxOf(pxs) {
    let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
    for (const [r, g, b] of pxs) {
      if (r < rMin) rMin = r; if (r > rMax) rMax = r;
      if (g < gMin) gMin = g; if (g > gMax) gMax = g;
      if (b < bMin) bMin = b; if (b > bMax) bMax = b;
    }
    return { pxs, rMin, rMax, gMin, gMax, bMin, bMax };
  }

  let boxes = [boxOf(pixels)];
  while (boxes.length < maxColors) {
    // Divide a caixa com maior volume de variação (maior faixa num canal).
    let idx = -1, bestRange = -1, axis = "r";
    boxes.forEach((box, i) => {
      const rr = box.rMax - box.rMin, gr = box.gMax - box.gMin, br = box.bMax - box.bMin;
      const m = Math.max(rr, gr, br);
      if (box.pxs.length > 1 && m > bestRange) {
        bestRange = m; idx = i; axis = m === rr ? "r" : m === gr ? "g" : "b";
      }
    });
    if (idx === -1) break; // nada mais divisível
    const box = boxes[idx];
    const sorted = [...box.pxs].sort((a, b) => {
      const ai = axis === "r" ? a[0] : axis === "g" ? a[1] : a[2];
      const bi = axis === "r" ? b[0] : axis === "g" ? b[1] : b[2];
      return ai - bi;
    });
    const mid = Math.floor(sorted.length / 2);
    boxes.splice(idx, 1, boxOf(sorted.slice(0, mid)), boxOf(sorted.slice(mid)));
  }

  return boxes.map((box) => {
    let r = 0, g = 0, b = 0;
    for (const p of box.pxs) { r += p[0]; g += p[1]; b += p[2]; }
    const n = box.pxs.length || 1;
    return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
  });
}

function nearestColorIndex(palette, r, g, b) {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < palette.length; i++) {
    const [pr, pg, pb] = palette[i];
    const d = (pr - r) ** 2 + (pg - g) ** 2 + (pb - b) ** 2;
    if (d < bestDist) { bestDist = d; best = i; }
  }
  return best;
}

/**
 * Monta um GIF animado a partir de uma lista de buffers PNG (mesma
 * dimensão). `delayCs` é o atraso de cada frame em centésimos de segundo.
 * `holdLastCs` opcionalmente segura mais tempo no último frame (bom pra dar
 * tempo de ler o resultado antes do GIF reiniciar o loop).
 */
function buildGif(pngBuffers, outPath, { delayCs = 90, holdLastCs = 220, maxColors = 220, sampleEvery = 4 } = {}) {
  const frames = pngBuffers.map(decodePng);
  const { width, height } = frames[0];

  // Amostra pixels de TODOS os frames pra montar uma paleta única (global) —
  // sem isso, cada frame teria sua própria paleta e a animação "piscaria"
  // de cor a cada troca.
  const sample = [];
  for (const f of frames) {
    for (let i = 0; i < f.data.length; i += 4 * sampleEvery) {
      sample.push([f.data[i], f.data[i + 1], f.data[i + 2]]);
    }
  }
  const palette = medianCutPalette(sample, maxColors);
  // omggif exige potência de 2 entre 2 e 256, com cada cor como um inteiro
  // 0xRRGGBB — não uma lista achatada de R,G,B (esse era o bug: mandar o
  // array achatado fazia parecer 3x mais cores do que existem de verdade).
  let palSize = 2;
  while (palSize < palette.length) palSize *= 2;
  while (palette.length < palSize) palette.push([0, 0, 0]);
  const packedPalette = palette.map(([r, g, b]) => (r << 16) | (g << 8) | b);

  const buf = Buffer.alloc(width * height * frames.length + 1024 * 1024);
  const gw = new GifWriter(buf, width, height, { palette: packedPalette, loop: 0 });

  frames.forEach((f, frameIdx) => {
    const indexed = new Uint8Array(width * height);
    for (let p = 0; p < width * height; p++) {
      const o = p * 4;
      indexed[p] = nearestColorIndex(palette, f.data[o], f.data[o + 1], f.data[o + 2]);
    }
    const isLast = frameIdx === frames.length - 1;
    gw.addFrame(0, 0, width, height, indexed, {
      delay: isLast ? holdLastCs : delayCs,
      disposal: 2,
    });
  });

  const end = gw.end();
  fs.writeFileSync(outPath, buf.slice(0, end));
  return { width, height, frames: frames.length };
}

module.exports = { buildGif, decodePng };
