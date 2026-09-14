import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getUserFromRequest } from "@/lib/auth";
import { getCollection, updateCollection } from "@/lib/store";
import type { Service } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST — duplica um culto existente (mesmas músicas/avisos referenciados,
// itens com nova identidade) para usar como modelo de um novo roteiro.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  const col = await getCollection<Service>("services");
  const original = col.items.find((s) => s.id === id);
  if (!original) {
    return NextResponse.json({ error: "Culto não encontrado" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const duplicated = await updateCollection<Service, Service>("services", (c) => {
    const created: Service = {
      id: c.nextId++,
      title: `${original.title} (cópia)`,
      date: null,
      items: original.items.map((item) => ({ ...item, id: crypto.randomUUID() })),
      createdAt: now,
      updatedAt: now,
    };
    c.items.push(created);
    return created;
  });

  return NextResponse.json(duplicated, { status: 201 });
}
