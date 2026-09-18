import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCollection, updateCollection } from "@/lib/store";
import type { MediaItem } from "@/lib/types";

export const dynamic = "force-dynamic";

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

  const { title, kind, file, loop, volume } = await req.json();
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
