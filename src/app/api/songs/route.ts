import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCollection, updateCollection } from "@/lib/store";
import type { Song } from "@/lib/types";

export const dynamic = "force-dynamic";

function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

// GET — listar músicas
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const col = await getCollection<Song>("songs");
  const songs = [...col.items]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((s) => ({ ...s, _count: { lyrics: s.lyrics.length } }));

  return NextResponse.json(songs);
}

// POST — criar música (com ou sem YouTube)
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { title, artist, youtubeUrl } = await req.json();
  if (!title) {
    return NextResponse.json(
      { error: "Título é obrigatório" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const song = await updateCollection<Song, Song>("songs", (col) => {
    const created: Song = {
      id: col.nextId++,
      title,
      artist: artist || null,
      youtubeUrl: youtubeUrl || null,
      youtubeId: extractYoutubeId(youtubeUrl),
      lyrics: [],
      createdAt: now,
      updatedAt: now,
    };
    col.items.push(created);
    return created;
  });

  return NextResponse.json(song, { status: 201 });
}
