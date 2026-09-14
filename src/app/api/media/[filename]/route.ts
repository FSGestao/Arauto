import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { dataDir } from "../../../../../lib/shared";

export const dynamic = "force-dynamic";

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".m4a": "audio/mp4",
  ".weba": "audio/webm",
};

// GET — entrega um arquivo de mídia (imagem/áudio/vídeo). Sem autenticação de
// propósito: a tela de projeção pode estar aberta em outro computador da rede,
// sem login, e precisa carregar esses arquivos.
//
// Responde a "Range" (HTTP 206) porque sem isso o <video>/<audio> do navegador
// não consegue buscar posição (arrastar a barra de progresso) — e alguns
// navegadores nem começam a tocar arquivos grandes.
export async function GET(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  // Impede path traversal (ex.: "../../secret.key")
  const filename = path.basename(params.filename);
  const filePath = path.join(dataDir(), "media", filename);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext] || "application/octet-stream";
  const stat = fs.statSync(filePath);
  const size = stat.size;

  const commonHeaders = {
    "Content-Type": contentType,
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, max-age=31536000, immutable",
  };

  const range = req.headers.get("range");
  if (range) {
    // Formato: "bytes=INÍCIO-FIM" (FIM opcional)
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (match) {
      const startRaw = match[1];
      const endRaw = match[2];
      let start = startRaw ? parseInt(startRaw, 10) : 0;
      let end = endRaw ? parseInt(endRaw, 10) : size - 1;

      // "bytes=-500" = os últimos 500 bytes
      if (!startRaw && endRaw) {
        start = Math.max(0, size - parseInt(endRaw, 10));
        end = size - 1;
      }

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}` },
        });
      }
      end = Math.min(end, size - 1);

      const nodeStream = fs.createReadStream(filePath, { start, end });
      const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
      return new NextResponse(webStream, {
        status: 206,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
        },
      });
    }
  }

  const nodeStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;
  return new NextResponse(webStream, {
    headers: { ...commonHeaders, "Content-Length": String(size) },
  });
}
