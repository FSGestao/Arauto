import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { updateCollection } from "@/lib/store";
import type { AnnouncementTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

// PUT — atualizar modelo
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

  const result = await updateCollection<AnnouncementTemplate, AnnouncementTemplate | null>(
    "announcement-templates",
    (col) => {
      const existing = col.items.find((t) => t.id === id);
      if (!existing) return null;
      existing.title = body.title ?? existing.title;
      existing.content = body.content ?? existing.content;
      existing.updatedAt = new Date().toISOString();
      return existing;
    }
  );

  if (!result) {
    return NextResponse.json({ error: "Modelo não encontrado" }, { status: 404 });
  }
  return NextResponse.json(result);
}

// DELETE — remover modelo
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  const removed = await updateCollection<AnnouncementTemplate, boolean>(
    "announcement-templates",
    (col) => {
      const before = col.items.length;
      col.items = col.items.filter((t) => t.id !== id);
      return col.items.length < before;
    }
  );

  if (!removed) {
    return NextResponse.json({ error: "Modelo não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ message: "Modelo removido" });
}
