import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getUserFromRequest } from "@/lib/auth";
import { dataDir } from "../../../../../lib/shared";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_AUDIO_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_VIDEO_BYTES = 300 * 1024 * 1024; // 300 MB

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "audio/aac": ".m4a",
  "audio/webm": ".weba",
};

// POST — recebe um arquivo (imagem/vídeo) para usar em avisos, salva em
// data/media/ (mesma pasta dos dados locais) e devolve o nome gerado.
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }

  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  const isAudio = file.type.startsWith("audio/");
  if (!isImage && !isVideo && !isAudio) {
    return NextResponse.json(
      {
        error:
          "Formato não suportado. Envie imagem (jpg/png/gif/webp), vídeo (mp4/webm/ogv) ou áudio (mp3/wav/ogg/m4a).",
      },
      { status: 400 }
    );
  }

  const maxBytes = isVideo ? MAX_VIDEO_BYTES : isAudio ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `Arquivo muito grande (máximo ${Math.round(maxBytes / 1024 / 1024)} MB)` },
      { status: 400 }
    );
  }

  const ext = EXT_BY_MIME[file.type] || path.extname(file.name) || "";
  const filename = `${crypto.randomUUID()}${ext}`;

  const mediaDir = path.join(dataDir(), "media");
  if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.promises.writeFile(path.join(mediaDir, filename), buffer);

  return NextResponse.json({
    filename,
    mediaType: isVideo ? "video" : isAudio ? "audio" : "image",
  });
}
