import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { listTranslations, saveTranslation } from "@/lib/bible";
import { parseBibleUpload } from "@/lib/bibleParsers";

export const dynamic = "force-dynamic";

const MAX_BYTES = 40 * 1024 * 1024; // 40 MB — uma bíblia completa em texto não passa disso

// GET — metadados das traduções instaladas (sem o texto inteiro). Público:
// a tela de projeção não precisa disso, mas a busca no painel sim, e não
// há motivo pra exigir login só pra listar o que já está instalado.
export async function GET() {
  const metas = await listTranslations();
  return NextResponse.json(metas);
}

// POST — upload de uma tradução própria (JSON, XML ou CSV). Formato
// multipart (como /api/media/upload) pra não bater no limite de corpo de
// requisições JSON — um arquivo de bíblia completa passa fácil de alguns MB.
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  const format = String(formData.get("format") || "");
  const name = String(formData.get("name") || "").trim();
  const language = String(formData.get("language") || "").trim();
  const license = String(formData.get("license") || "").trim();

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }
  if (format !== "json" && format !== "xml" && format !== "csv") {
    return NextResponse.json({ error: "Formato inválido — use json, xml ou csv" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Dê um nome pra essa tradução" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `Arquivo muito grande (máximo ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 400 });
  }

  const content = await file.text();
  try {
    const parsed = parseBibleUpload(format, content, { name, language, license });
    if (parsed.books.length === 0) {
      return NextResponse.json({ error: "Nenhum livro foi reconhecido nesse arquivo" }, { status: 400 });
    }
    const meta = await saveTranslation({ id: name, ...parsed }, "upload");
    return NextResponse.json(meta);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro ao processar o arquivo" }, { status: 400 });
  }
}
