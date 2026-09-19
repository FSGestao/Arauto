import { NextResponse } from "next/server";
import { listApprovedReleaseNotes } from "@/lib/releaseNotes";

export const dynamic = "force-dynamic";

// GET — notas de versão já aprovadas, mais recente primeiro. Público: só
// texto informativo, sem dado da igreja envolvido.
export async function GET() {
  return NextResponse.json(listApprovedReleaseNotes());
}
