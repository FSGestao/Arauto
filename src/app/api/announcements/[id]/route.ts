import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getUserFromRequest } from "@/lib/auth";
import { updateCollection, getCollection } from "@/lib/store";
import type { Announcement } from "@/lib/types";
import { dataDir } from "../../../../../lib/shared";

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
  const removed = await updateCollection<Announcement, Announcement | null>(
    "announcements",
    (col) => {
      const index = col.items.findIndex((a) => a.id === id);
      if (index === -1) return null;
      return col.items.splice(index, 1)[0];
    }
  );

  if (!removed) {
    return NextResponse.json({ error: "Aviso não encontrado" }, { status: 404 });
  }

  // Leva junto a imagem/vídeo anexado. Sem isso, cada aviso apagado deixava o
  // arquivo para sempre em data/media — engordando a pasta e todo backup.
  if (removed.mediaFile) {
    try {
      const nome = path.basename(removed.mediaFile);
      // Só apaga se mais ninguém usar o mesmo arquivo (ex.: um aviso duplicado).
      const col = await getCollection<Announcement>("announcements");
      const emUso = col.items.some((a) => a.mediaFile && path.basename(a.mediaFile) === nome);
      if (!emUso) {
        const filePath = path.join(dataDir(), "media", nome);
        if (fs.existsSync(filePath)) await fs.promises.unlink(filePath);
      }
    } catch {
      // Arquivo já sumiu ou está travado — o aviso já saiu da lista, que é o
      // que o operador pediu.
    }
  }

  return NextResponse.json({ message: "Aviso removido" });
}
