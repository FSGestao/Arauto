import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getCollection, updateCollection } from "@/lib/store";
import type { Service, ServiceItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET — detalhes de um culto
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  const col = await getCollection<Service>("services");
  const service = col.items.find((s) => s.id === id);
  if (!service) {
    return NextResponse.json({ error: "Culto não encontrado" }, { status: 404 });
  }
  return NextResponse.json(service);
}

// PUT — atualizar título/data/itens (a lista de itens é sempre enviada
// completa, na ordem final desejada — mesmo padrão usado para letras)
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

  const result = await updateCollection<Service, Service | null>("services", (col) => {
    const service = col.items.find((s) => s.id === id);
    if (!service) return null;
    service.title = body.title ?? service.title;
    service.date = body.date !== undefined ? body.date : service.date;
    if (Array.isArray(body.items)) {
      service.items = (body.items as ServiceItem[]).map((item) => ({
        id: item.id,
        type: item.type,
        refId: item.refId,
        ...(item.skip ? { skip: true } : {}),
        // Versículo não tem um id numérico numa coleção pra referenciar por
        // `refId` (é 0) — o conteúdo vem embutido aqui, então precisa ser
        // preservado ao salvar, senão toda reordenação/edição do roteiro
        // perde o texto do versículo (virava "📖 (versículo)").
        ...(item.type === "bible" && item.bible ? { bible: item.bible } : {}),
      }));
    }
    service.updatedAt = new Date().toISOString();
    return service;
  });

  if (!result) {
    return NextResponse.json({ error: "Culto não encontrado" }, { status: 404 });
  }
  return NextResponse.json(result);
}

// DELETE — remove o culto
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const id = parseInt(params.id, 10);
  const removed = await updateCollection<Service, boolean>("services", (col) => {
    const before = col.items.length;
    col.items = col.items.filter((s) => s.id !== id);
    return col.items.length < before;
  });

  if (!removed) {
    return NextResponse.json({ error: "Culto não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ message: "Culto removido" });
}
