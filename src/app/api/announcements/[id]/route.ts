import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { updateCollection } from "@/lib/store";
import type { Announcement } from "@/lib/types";

export const dynamic = "force-dynamic";

// PUT — atualizar/ativar/desativar aviso
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

  const result = await updateCollection<Announcement, Announcement | null>(
    "announcements",
    (col) => {
      const existing = col.items.find((a) => a.id === id);
      if (!existing) return null;
      existing.title = body.title ?? existing.title;
      existing.content = body.content ?? existing.content;
      existing.active = body.active ?? existing.active;
      if (body.mediaFile !== undefined) {
        existing.mediaFile = body.mediaFile;
        existing.mediaType = body.mediaFile ? body.mediaType || "image" : "none";
      }
      existing.updatedAt = new Date().toISOString();
      return existing;
    }
  );

  if (!result) {
    return NextResponse.json({ error: "Aviso não encontrado" }, { status: 404 });
  }
  return NextResponse.json(result);
}

// DELETE — remover aviso
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  const removed = await updateCollection<Announcement, boolean>(
    "announcements",
    (col) => {
      const before = col.items.length;
      col.items = col.items.filter((a) => a.id !== id);
      return col.items.length < before;
    }
  );

  if (!removed) {
    return NextResponse.json({ error: "Aviso não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ message: "Aviso removido" });
}
