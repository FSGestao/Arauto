import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { getUserFromRequest } from "@/lib/auth";

export const dynamic = "force-dynamic";

// O instalador NÃO fica em /public (que é servido sem autenticação). Ele
// fica em /private, fora do alcance de arquivos estáticos, e só chega ao
// navegador através desta rota, depois de validar o login.
const INSTALLER_NAME = "Arauto-Setup.exe";
const INSTALLER_PATH = path.join(process.cwd(), "private", "downloads", INSTALLER_NAME);

// GET — baixa o instalador do app (requer login aprovado)
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  if (!fs.existsSync(INSTALLER_PATH)) {
    return NextResponse.json(
      { error: "O instalador ainda não foi publicado. Tente novamente em breve." },
      { status: 404 }
    );
  }

  const stat = fs.statSync(INSTALLER_PATH);
  const nodeStream = fs.createReadStream(INSTALLER_PATH);
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream;

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${INSTALLER_NAME}"`,
      "Content-Length": String(stat.size),
    },
  });
}
