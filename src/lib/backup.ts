import fs from "fs";
import archiver from "archiver";

/**
 * Compacta um diretório inteiro num arquivo .zip em disco. Usado tanto para
 * o backup de segurança automático (antes de um import) quanto, se preciso,
 * fora de uma requisição HTTP (onde não há um `NextResponse` para streamar).
 */
export function zipDirectoryToFile(sourceDir: string, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", () => resolve());
    output.on("error", reject);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

/** Nome de arquivo com timestamp legível — evita conflito e ajuda a achar o
 * backup certo numa pasta de Downloads cheia de arquivos. */
export function backupFilename(prefix = "arauto-backup"): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  return `${prefix}-${stamp}.zip`;
}

/** Arquivos que uma pasta de dados válida do Arauto deve conter — usado para
 * rejeitar um .zip qualquer antes de sobrescrever os dados de verdade. */
export const EXPECTED_DATA_FILES = ["users.json", "songs.json", "announcements.json", "services.json", "settings.json"];
