import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import os from "os";
import path from "path";
import crypto from "crypto";
import extractZip from "extract-zip";
import { getUserFromRequest } from "@/lib/auth";
import { zipDirectoryToFile, backupFilename, EXPECTED_DATA_FILES } from "@/lib/backup";
import { dataDir } from "../../../../../lib/shared";

export const dynamic = "force-dynamic";

// POST — restaura a pasta de dados a partir de um .zip exportado por
// /api/backup/export. Ação destrutiva (substitui músicas, avisos, contas e
// configurações atuais), por isso:
//   1. valida o .zip antes de tocar em qualquer coisa (rejeita se não parecer
//      um backup válido do Arauto);
//   2. faz um backup de segurança dos dados ATUAIS antes de sobrescrever,
//      salvo ao lado da pasta de dados — se o import for um engano, dá pra
//      voltar sem perder nada.
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".zip")) {
    return NextResponse.json({ error: "Envie um arquivo .zip exportado pelo próprio Arauto" }, { status: 400 });
  }

  const workDir = path.join(os.tmpdir(), `arauto-import-${crypto.randomUUID()}`);
  const zipPath = path.join(workDir, "upload.zip");
  const extractDir = path.join(workDir, "extracted");

  try {
    await fs.promises.mkdir(extractDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.promises.writeFile(zipPath, buffer);

    try {
      await extractZip(zipPath, { dir: extractDir });
    } catch {
      return NextResponse.json({ error: "Não foi possível abrir o arquivo — não parece ser um .zip válido" }, { status: 400 });
    }

    // Validação: precisa ter pelo menos os arquivos essenciais, e cada um
    // precisa ser um JSON de verdade — evita sobrescrever os dados reais com
    // lixo por causa de um .zip errado.
    const missing: string[] = [];
    for (const name of EXPECTED_DATA_FILES) {
      const fp = path.join(extractDir, name);
      if (!fs.existsSync(fp)) {
        missing.push(name);
        continue;
      }
      try {
        JSON.parse(await fs.promises.readFile(fp, "utf-8"));
      } catch {
        return NextResponse.json({ error: `O arquivo ${name} dentro do backup está corrompido` }, { status: 400 });
      }
    }
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Este .zip não parece um backup do Arauto — faltam: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    // Backup de segurança dos dados atuais, salvo ao lado da pasta de dados
    // (não dentro dela — senão seria apagado pela restauração a seguir).
    const target = dataDir();
    const safetyPath = path.join(path.dirname(target), backupFilename("antes-de-importar"));
    await zipDirectoryToFile(target, safetyPath);

    // Substitui: apaga o conteúdo atual e copia o que veio no backup.
    await fs.promises.rm(target, { recursive: true, force: true });
    await fs.promises.mkdir(target, { recursive: true });
    await fs.promises.cp(extractDir, target, { recursive: true });

    return NextResponse.json({
      ok: true,
      safetyBackup: path.basename(safetyPath),
      message: "Dados restaurados. Pode ser necessário entrar de novo, já que a conta e a sessão vieram do backup.",
    });
  } finally {
    await fs.promises.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
