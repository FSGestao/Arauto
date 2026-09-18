/* ═══════════════════════════════════════════════════════
   Arquivos de mentira para os testes de upload.

   São gerados na hora, numa pasta temporária: assim a verificação não
   depende de nenhum arquivo commitado no repositório nem toca no acervo
   de verdade da igreja.
   ═══════════════════════════════════════════════════════ */
const fs = require("fs");
const os = require("os");
const path = require("path");

function pasta() {
  const p = path.join(os.tmpdir(), "arauto-arquivos-de-teste");
  fs.mkdirSync(p, { recursive: true });
  return p;
}

/** PNG 2×2 válido, escrito byte a byte (não dá pra "gerar" imagem sem isso). */
function png() {
  const destino = path.join(pasta(), "teste.png");
  const crc = (buf) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (tipo, dados) => {
    const t = Buffer.from(tipo, "ascii");
    const tam = Buffer.alloc(4);
    tam.writeUInt32BE(dados.length);
    const soma = Buffer.alloc(4);
    soma.writeUInt32BE(crc(Buffer.concat([t, dados])));
    return Buffer.concat([tam, t, dados, soma]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(2, 0); // largura
  ihdr.writeUInt32BE(2, 4); // altura
  ihdr[8] = 8;              // bits por canal
  ihdr[9] = 2;              // RGB
  const zlib = require("zlib");
  // Cada linha começa com o byte de filtro (0 = nenhum).
  const linhas = Buffer.from([0, 200, 30, 60, 200, 30, 60, 0, 60, 200, 30, 60, 200, 30]);
  const idat = zlib.deflateSync(linhas);
  fs.writeFileSync(destino, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]));
  return destino;
}

/** WAV de 2 segundos com um tom baixinho — precisa ter duração de verdade
 *  para o teste da barra de posição fazer sentido. */
function wav(segundos = 2) {
  const destino = path.join(pasta(), "teste.wav");
  const taxa = 8000;
  const total = taxa * segundos;
  const dados = Buffer.alloc(total * 2);
  for (let i = 0; i < total; i++) {
    dados.writeInt16LE(Math.round(Math.sin((i / taxa) * 2 * Math.PI * 440) * 3000), i * 2);
  }
  const cab = Buffer.alloc(44);
  cab.write("RIFF", 0);
  cab.writeUInt32LE(36 + dados.length, 4);
  cab.write("WAVEfmt ", 8);
  cab.writeUInt32LE(16, 16);
  cab.writeUInt16LE(1, 20);   // PCM
  cab.writeUInt16LE(1, 22);   // mono
  cab.writeUInt32LE(taxa, 24);
  cab.writeUInt32LE(taxa * 2, 28);
  cab.writeUInt16LE(2, 32);
  cab.writeUInt16LE(16, 34);
  cab.write("data", 36);
  cab.writeUInt32LE(dados.length, 40);
  fs.writeFileSync(destino, Buffer.concat([cab, dados]));
  return destino;
}

/** Vídeo webm curto. Não dá pra montar um container de vídeo à mão de forma
 *  sensata, então quem grava é o próprio navegador: um canvas colorido
 *  passado pelo MediaRecorder. */
async function webm(page, segundos = 2) {
  const destino = path.join(pasta(), "teste.webm");
  if (fs.existsSync(destino) && fs.statSync(destino).size > 1000) return destino;
  const base64 = await page.ev(`
    const c = document.createElement('canvas');
    c.width = 320; c.height = 180;
    const ctx = c.getContext('2d');
    const fluxo = c.captureStream(25);
    const gravador = new MediaRecorder(fluxo, { mimeType: 'video/webm' });
    const pedacos = [];
    gravador.ondataavailable = (e) => pedacos.push(e.data);
    const pronto = new Promise(r => gravador.onstop = r);
    gravador.start();
    let quadro = 0;
    const timer = setInterval(() => {
      ctx.fillStyle = 'hsl(' + (quadro * 8 % 360) + ', 70%, 45%)';
      ctx.fillRect(0, 0, 320, 180);
      quadro++;
    }, 40);
    await new Promise(r => setTimeout(r, ${segundos * 1000}));
    clearInterval(timer);
    gravador.stop();
    await pronto;
    const blob = new Blob(pedacos, { type: 'video/webm' });
    const buf = await blob.arrayBuffer();
    let s = '';
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);`);
  fs.writeFileSync(destino, Buffer.from(base64, "base64"));
  return destino;
}

/** Um .zip que não é backup do Arauto — para o teste de importação inválida. */
function zipInvalido() {
  const destino = path.join(pasta(), "nao-e-backup.zip");
  const nome = Buffer.from("qualquer-coisa.txt", "ascii");
  const conteudo = Buffer.from("isto nao e um backup do Arauto", "ascii");
  const crc = require("zlib").crc32
    ? require("zlib").crc32(conteudo)
    : (() => { let c = ~0; for (const b of conteudo) { c ^= b; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; })();

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 8); // sem compressão
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(conteudo.length, 18);
  local.writeUInt32LE(conteudo.length, 22);
  local.writeUInt16LE(nome.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(conteudo.length, 20);
  central.writeUInt32LE(conteudo.length, 24);
  central.writeUInt16LE(nome.length, 28);

  const inicioCentral = local.length + nome.length + conteudo.length;
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(1, 8);
  fim.writeUInt16LE(1, 10);
  fim.writeUInt32LE(central.length + nome.length, 12);
  fim.writeUInt32LE(inicioCentral, 16);

  fs.writeFileSync(destino, Buffer.concat([local, nome, conteudo, central, nome, fim]));
  return destino;
}

function limpar() {
  try { fs.rmSync(pasta(), { recursive: true, force: true }); } catch {}
}

module.exports = { png, wav, webm, zipInvalido, limpar, pasta };
