import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCollection, updateCollection } from "@/lib/store";
import type { AnnouncementTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET — lista modelos de aviso
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const col = await getCollection<AnnouncementTemplate>("announcement-templates");
  const templates = [...col.items].sort((a, b) => (a.title < b.title ? -1 : 1));
  return NextResponse.json(templates);
}

// POST — criar novo modelo
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { title, content } = await req.json();
  if (!title || !content) {
    return NextResponse.json({ error: "Título e conteúdo são obrigatórios" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const template = await updateCollection<AnnouncementTemplate, AnnouncementTemplate>(
    "announcement-templates",
    (col) => {
      const created: AnnouncementTemplate = {
        id: col.nextId++,
        title,
        content,
        createdAt: now,
        updatedAt: now,
      };
      col.items.push(created);
      return created;
    }
  );

  return NextResponse.json(template, { status: 201 });
}
