import fs from "fs";
import path from "path";
import { dataDir } from "../../lib/shared";
import { getDoc, updateDoc } from "./store";
import type { BibleTranslationData, BibleTranslationMeta } from "./types";

/* ═══════════════════════════════════════════════════════
   Bíblia — cada tradução é pesada (pode passar de 30 mil versículos),
   por isso vive em arquivo próprio em data/bible/<id>.json, fora do
   padrão de coleção genérica do store.ts (que guarda tudo num JSON só).
   `bible-translations` (via getDoc/updateDoc, arquivo pequeno) guarda só
   os metadados de cada uma, pra listar sem carregar o texto inteiro.
   ═══════════════════════════════════════════════════════ */

function bibleDir(): string {
  const dir = path.join(dataDir(), "bible");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function dataFilePath(id: string): string {
  // `id` sempre vem de slugify() abaixo (a-z0-9-), nunca direto do usuário
  // sem passar por ela — não dá pra escapar de bibleDir() com "../".
  return path.join(bibleDir(), `${id}.json`);
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "traducao"
  );
}

/** Lista os metadados das traduções instaladas. Semeia qualquer arquivo em
 *  seed/bible/ que ainda não esteja registrado — não só na primeira vez:
 *  se uma versão nova do Arauto trouxer uma tradução adicional (todas de
 *  domínio público ou licença livre, ver README de cada uma), ela entra
 *  sozinha sem apagar nem duplicar o que já estava instalado. Sem exigir
 *  internet — os arquivos já vêm junto com o Arauto. */
export async function listTranslations(): Promise<BibleTranslationMeta[]> {
  const metas = await getDoc<BibleTranslationMeta[]>("bible-translations", []);
  const seedDir = path.join(process.cwd(), "seed", "bible");
  if (!fs.existsSync(seedDir)) return metas;

  const seedFiles = await fs.promises.readdir(seedDir);
  for (const file of seedFiles) {
    if (!file.endsWith(".json")) continue;
    const id = file.replace(/\.json$/, "");
    if (metas.some((m) => m.id === id)) continue;
    const raw = await fs.promises.readFile(path.join(seedDir, file), "utf-8");
    const seed = JSON.parse(raw) as BibleTranslationData;
    const meta = await saveTranslation(seed, "seed");
    metas.push(meta);
  }
  return metas;
}

export async function getTranslationData(id: string): Promise<BibleTranslationData | null> {
  const fp = dataFilePath(id);
  if (!fs.existsSync(fp)) return null;
  try {
    const raw = await fs.promises.readFile(fp, "utf-8");
    return JSON.parse(raw) as BibleTranslationData;
  } catch {
    return null;
  }
}

/** Grava o arquivo pesado da tradução e registra os metadados. Reaproveita
 *  o `id` se já vier definido (caso do seed); senão gera um a partir do nome. */
export async function saveTranslation(
  data: BibleTranslationData,
  origin: "seed" | "upload"
): Promise<BibleTranslationMeta> {
  const id = data.id && data.id.trim() ? slugify(data.id) : slugify(data.name);
  const verseCount = data.books.reduce(
    (acc, b) => acc + b.chapters.reduce((a2, c) => a2 + c.verses.length, 0),
    0
  );
  const meta: BibleTranslationMeta = {
    id,
    name: data.name,
    language: data.language || "pt-BR",
    license: data.license || "Não informada — confira antes de projetar em público",
    source: data.source || "",
    origin,
    bookCount: data.books.length,
    verseCount,
    createdAt: new Date().toISOString(),
  };
  await fs.promises.writeFile(dataFilePath(id), JSON.stringify({ ...data, id }), "utf-8");
  await updateDoc<BibleTranslationMeta[], void>("bible-translations", [], (list) => {
    const idx = list.findIndex((m) => m.id === id);
    if (idx >= 0) list[idx] = meta;
    else list.push(meta);
  });
  return meta;
}

export async function deleteTranslation(id: string): Promise<boolean> {
  const fp = dataFilePath(id);
  let existed = false;
  if (fs.existsSync(fp)) {
    await fs.promises.unlink(fp);
    existed = true;
  }
  await updateDoc<BibleTranslationMeta[], void>("bible-translations", [], (list) => {
    const idx = list.findIndex((m) => m.id === id);
    if (idx >= 0) {
      list.splice(idx, 1);
      existed = true;
    }
  });
  return existed;
}
