import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/auth";
import { getDoc, updateDoc } from "@/lib/store";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/types";

// Sem isso, o GET (sem NextRequest) seria pré-renderizado uma única vez no
// build e nunca refletiria alterações salvas depois pelo painel admin.
export const dynamic = "force-dynamic";

// GET — configurações de marca (público: usado também pela tela de projeção,
// que pode estar aberta em outro computador da rede sem login)
export async function GET() {
  const settings = await getDoc<Settings>("settings", DEFAULT_SETTINGS);
  return NextResponse.json(settings);
}

// PUT — atualizar configurações (requer login)
export async function PUT(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const updated = await updateDoc<Settings, Settings>(
    "settings",
    DEFAULT_SETTINGS,
    (doc) => {
      doc.name = body.name ?? doc.name;
      doc.primaryColor = body.primaryColor ?? doc.primaryColor;
      doc.secondaryColor = body.secondaryColor ?? doc.secondaryColor;
      doc.bgColor = body.bgColor ?? doc.bgColor;
      doc.textColor = body.textColor ?? doc.textColor;
      doc.logoUrl = body.logoUrl ?? doc.logoUrl;
      doc.textPosition = body.textPosition ?? doc.textPosition;
      doc.countdownTextPosition = body.countdownTextPosition ?? doc.countdownTextPosition;
      return doc;
    }
  );

  return NextResponse.json(updated);
}
