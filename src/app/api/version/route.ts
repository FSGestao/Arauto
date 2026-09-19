import { NextResponse } from "next/server";
import packageJson from "../../../../package.json";

export const dynamic = "force-dynamic";

// GET — versão instalada do app (mesma fonte que o electron-builder usa pra
// gerar o instalador). Público: é só pro painel decidir se mostra "Como
// usar" (primeira vez) ou as notas da versão (depois de uma atualização).
export async function GET() {
  return NextResponse.json({ version: packageJson.version });
}
