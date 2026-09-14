import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCollection, updateCollection } from "@/lib/store";
import type { Service } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET — lista cultos (mais recentes primeiro)
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const col = await getCollection<Service>("services");
  const services = [...col.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return NextResponse.json(services);
}

// POST — cria um novo culto (roteiro vazio, itens são adicionados depois)
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { title, date } = await req.json();
  if (!title) {
    return NextResponse.json({ error: "Título é obrigatório" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const service = await updateCollection<Service, Service>("services", (col) => {
    const created: Service = {
      id: col.nextId++,
      title,
      date: date || null,
      items: [],
      createdAt: now,
      updatedAt: now,
    };
    col.items.push(created);
    return created;
  });

  return NextResponse.json(service, { status: 201 });
}
