import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { deleteTranslation, getTranslationData } from "@/lib/bible";

export const dynamic = "force-dynamic";

// GET — texto completo de uma tradução (todos os livros/capítulos/versículos).
// Público como a listagem: o painel busca isso pra navegar/pesquisar, sem
// precisar reimplementar a busca no servidor.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const data = await getTranslationData(params.id);
  if (!data) return NextResponse.json({ error: "Tradução não encontrada" }, { status: 404 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  const existed = await deleteTranslation(params.id);
  if (!existed) return NextResponse.json({ error: "Tradução não encontrada" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
