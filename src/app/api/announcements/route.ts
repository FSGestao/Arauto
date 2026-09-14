import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCollection, updateCollection } from "@/lib/store";
import type { Announcement } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET — lista avisos
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const col = await getCollection<Announcement>("announcements");
  const announcements = [...col.items].sort((a, b) =>
    a.createdAt < b.createdAt ? 1 : -1
  );
  return NextResponse.json(announcements);
}

// POST — criar novo aviso
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { title, content, mediaType, mediaFile } = await req.json();
  if (!title || (!content && !mediaFile)) {
    return NextResponse.json(
      { error: "Título é obrigatório, e é preciso ter um texto ou uma imagem/vídeo" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const announcement = await updateCollection<Announcement, Announcement>(
    "announcements",
    (col) => {
      const created: Announcement = {
        id: col.nextId++,
        title,
        content: content || "",
        active: true,
        mediaType: mediaFile ? mediaType || "image" : "none",
        mediaFile: mediaFile || null,
        createdAt: now,
        updatedAt: now,
      };
      col.items.push(created);
      return created;
    }
  );

  return NextResponse.json(announcement, { status: 201 });
}
