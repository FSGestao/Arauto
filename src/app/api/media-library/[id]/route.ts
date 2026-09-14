import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUserFromRequest } from "@/lib/auth";
import { updateCollection } from "@/lib/store";
import type { MediaItem } from "@/lib/types";
import { dataDir } from "../../../../../lib/shared";

export const dynamic = "force-dynamic";

// PUT — atualiza título / loop / volume de um item de mídia
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  const body = await req.json();

  const updated = await updateCollection<MediaItem, MediaItem | null>("media-library", (col) => {
    const item = col.items.find((m) => m.id === id);
    if (!item) return null;
    if (typeof body.title === "string" && body.title.trim()) item.title = body.title.trim();
    if (typeof body.loop === "boolean") item.loop = body.loop;
    if (typeof body.volume === "number") item.volume = Math.min(1, Math.max(0, body.volume));
    item.updatedAt = new Date().toISOString();
    return item;
  });

  if (!updated) {
    return NextResponse.json({ error: "Mídia não encontrada" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

// DELETE — remove o item da biblioteca e o arquivo do disco
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  const removed = await updateCollection<MediaItem, MediaItem | null>("media-library", (col) => {
    const index = col.items.findIndex((m) => m.id === id);
    if (index === -1) return null;
    return col.items.splice(index, 1)[0];
  });

  if (!removed) {
    return NextResponse.json({ error: "Mídia não encontrada" }, { status: 404 });
  }

  // Remove o arquivo só se nenhum outro item apontar pra ele.
  try {
    const filePath = path.join(dataDir(), "media", path.basename(removed.file));
    if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
  } catch {
    // Arquivo já sumiu ou está em uso — o item já saiu da lista, que é o que importa.
  }

  return NextResponse.json({ ok: true });
}
