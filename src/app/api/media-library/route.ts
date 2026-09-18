import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCollection, updateCollection } from "@/lib/store";
import type { MediaItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// Mesmo padrão usado em /api/songs pra letras — aceita link normal, link
// curto (youtu.be) ou de embed; se já vier só o ID (11 caracteres), usa
// direto.
function extractYoutubeId(input: string): string | null {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const match = input.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

// GET — lista os itens de mídia (áudio/vídeo) da biblioteca
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const col = await getCollection<MediaItem>("media-library");
  const items = [...col.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return NextResponse.json(items);
}

// POST — cadastra um arquivo já enviado por /api/media/upload como item de mídia
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { title, kind, file, loop, volume, source, youtubeUrl } = await req.json();

  // Vídeo do YouTube: `file` não vem do upload, vem de extrair o ID da URL
  // colada no painel. Tudo mais (loop, volume, "Usar como fundo" etc.)
  // funciona igual a um vídeo enviado.
  if (source === "youtube") {
    const videoId = extractYoutubeId(String(youtubeUrl || ""));
    if (!title || !videoId) {
      return NextResponse.json(
        { error: "Informe título e uma URL do YouTube válida" },
        { status: 400 }
      );
    }
    const now = new Date().toISOString();
    const created = await updateCollection<MediaItem, MediaItem>("media-library", (col) => {
      const item: MediaItem = {
        id: col.nextId++,
        title,
        kind: "video",
        file: videoId,
        source: "youtube",
        loop: !!loop,
        volume: typeof volume === "number" ? Math.min(1, Math.max(0, volume)) : 1,
        createdAt: now,
        updatedAt: now,
      };
      col.items.push(item);
      return item;
    });
    return NextResponse.json(created, { status: 201 });
  }

  if (!title || !file || (kind !== "audio" && kind !== "video" && kind !== "image")) {
    return NextResponse.json(
      { error: "Informe título, arquivo e tipo (audio, video ou image)" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const created = await updateCollection<MediaItem, MediaItem>("media-library", (col) => {
    const item: MediaItem = {
      id: col.nextId++,
      title,
      kind,
      file,
      source: "upload",
      loop: !!loop,
      volume: typeof volume === "number" ? Math.min(1, Math.max(0, volume)) : 1,
      createdAt: now,
      updatedAt: now,
    };
    col.items.push(item);
    return item;
  });

  return NextResponse.json(created, { status: 201 });
}
