import { NextResponse } from "next/server";
import { getLocalIPs } from "../../../../lib/shared";

// Sem isso, o Next.js pré-renderiza esta rota (sem NextRequest, ele acha que
// pode gerar a resposta uma única vez durante o build) e a porta/IP ficam
// congelados no valor do momento do build em vez do valor real em runtime.
export const dynamic = "force-dynamic";

// GET — endereços da rede local onde a tela de projeção pode ser aberta
// a partir de outro computador (ex.: o PC ligado ao projetor).
export async function GET() {
  // globalThis.__PROJECAO_PORT__ (setado pelo server.js em runtime) é a fonte
  // confiável da porta real; process.env.PORT pode estar "congelado" no valor
  // que existia em .env quando o build de produção foi gerado.
  const globalPort = (globalThis as unknown as { __PROJECAO_PORT__?: number }).__PROJECAO_PORT__;
  const port = globalPort || Number(process.env.PORT) || 3210;
  const ips = getLocalIPs();
  return NextResponse.json({
    port,
    projectionUrls: ips.map((ip) => `http://${ip}:${port}/projection`),
  });
}
