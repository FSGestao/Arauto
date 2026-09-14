import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { updateCollection } from "@/lib/store";
import type { Song, LyricLine } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST — salvar/atualizar letras sincronizadas de uma música
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const songId = parseInt(params.id, 10);
  const { lyrics } = await req.json();
  // lyrics: Array<{ startMs: number, endMs: number, text: string, order: number }>

  if (!Array.isArray(lyrics)) {
    return NextResponse.json({ error: "Formato de letras inválido" }, { status: 400 });
  }

  const result = await updateCollection<Song, Song | null>("songs", (col) => {
    const song = col.items.find((s) => s.id === songId);
    if (!song) return null;

    song.lyrics = (lyrics as LyricLine[])
      .map((l, i) => ({ startMs: l.startMs, endMs: l.endMs, text: l.text, order: i }))
      .sort((a, b) => a.order - b.order);
    song.updatedAt = new Date().toISOString();
    return song;
  });

  if (!result) {
    return NextResponse.json({ error: "Música não encontrada" }, { status: 404 });
  }
  return NextResponse.json(result);
}

// PATCH — corrige o texto de UMA linha, sem reenviar a letra inteira. Usado
// pela edição ao vivo (corrigir uma linha errada sem sair da apresentação).
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const songId = parseInt(params.id, 10);
  const { lineIndex, text } = await req.json();

  if (typeof lineIndex !== "number" || typeof text !== "string") {
    return NextResponse.json({ error: "Informe lineIndex e text" }, { status: 400 });
  }

  const result = await updateCollection<Song, Song | null>("songs", (col) => {
    const song = col.items.find((s) => s.id === songId);
    if (!song || !song.lyrics[lineIndex]) return null;
    song.lyrics[lineIndex].text = text;
    song.updatedAt = new Date().toISOString();
    return song;
  });

  if (!result) {
    return NextResponse.json({ error: "Música ou linha não encontrada" }, { status: 404 });
  }
  return NextResponse.json(result);
}
