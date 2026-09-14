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

// GET — detalhes da música com letras
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  const col = await getCollection<Song>("songs");
  const song = col.items.find((s) => s.id === id);

  if (!song) {
    return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });
  }

  return NextResponse.json(song);
}

// PUT — atualizar música
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  const body = await req.json();

  const result = await updateCollection<Song, Song | null>("songs", (col) => {
    const song = col.items.find((s) => s.id === id);
    if (!song) return null;
    song.title = body.title ?? song.title;
    song.artist = body.artist || null;
    song.youtubeUrl = body.youtubeUrl || null;
    song.youtubeId = extractYoutubeId(body.youtubeUrl);
    song.updatedAt = new Date().toISOString();
    return song;
  });

  if (!result) {
    return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });
  }
  return NextResponse.json(result);
}

// DELETE — remover música e suas letras
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  const removed = await updateCollection<Song, boolean>("songs", (col) => {
    const before = col.items.length;
    col.items = col.items.filter((s) => s.id !== id);
    return col.items.length < before;
  });

  if (!removed) {
    return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ message: "Música removida" });
}
