import { NextRequest, NextResponse } from "next/server";
import { Readable } from "stream";
import archiver from "archiver";
import { getUserFromRequest } from "@/lib/auth";
import { backupFilename } from "@/lib/backup";
import { dataDir } from "../../../../../lib/shared";

export const dynamic = "force-dynamic";

// GET — baixa um .zip com toda a pasta de dados (músicas, avisos, mídia,
// configurações, contas e o segredo de login). É a resposta ao item
// "exportar/fazer backup com um clique" do roteiro de melhorias — os dados já
// são arquivos simples, então o backup também precisa ser simples: um clique,
// um arquivo, sem depender de nuvem nenhuma.
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("warning", () => {}); // arquivo sumiu entre o listar e o ler — ignora, não é fatal num backup
  archive.directory(dataDir(), false);
  archive.finalize();

  const webStream = Readable.toWeb(archive) as unknown as ReadableStream;
  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${backupFilename()}"`,
    },
  });
}
