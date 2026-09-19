import fs from "fs";
import path from "path";

/**
 * Notas de versão — um arquivo por versão em `release-notes/<versão>.json`,
 * versionado no git junto do código (não editável pelo painel). O texto só
 * chega a quem usa o app depois de eu revisar e marcar `status: "approved"`
 * — um arquivo em `status: "draft"` nunca aparece pra ninguém, mesmo que já
 * esteja no repositório. Isso é a validação que foi pedida: nada é liberado
 * sem alguém ter marcado como aprovado de propósito.
 */
export interface ReleaseNote {
  version: string;
  date: string;
  title: string;
  items: string[];
  status: "draft" | "approved";
}

function releaseNotesDir(): string {
  return path.join(process.cwd(), "release-notes");
}

/** Todas as notas aprovadas, mais recente primeiro. */
export function listApprovedReleaseNotes(): Omit<ReleaseNote, "status">[] {
  const dir = releaseNotesDir();
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
  const notes: ReleaseNote[] = [];
  for (const file of files) {
    try {
      const raw = fs.readFileSync(path.join(dir, file), "utf-8");
      const note = JSON.parse(raw) as ReleaseNote;
      if (note.status === "approved") notes.push(note);
    } catch {
      // Um arquivo malformado não pode derrubar a rota inteira.
    }
  }
  notes.sort((a, b) => compareVersions(b.version, a.version));
  return notes.map(({ status: _status, ...rest }) => rest);
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
