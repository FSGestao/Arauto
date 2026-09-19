import fs from "fs";
import path from "path";
import { dataDir } from "../../lib/shared";

export interface Collection<T> {
  nextId: number;
  items: T[];
}

/* ─── Fila de escrita por arquivo ─────────────────────────
   Serializa leituras/escritas do mesmo arquivo para evitar
   corrupção quando duas requisições chegam ao mesmo tempo. */
const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = queues.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  queues.set(key, run);
  return run;
}

function filePath(name: string): string {
  return path.join(dataDir(), `${name}.json`);
}

async function readJson<T>(name: string, fallback: T): Promise<T> {
  const fp = filePath(name);
  if (!fs.existsSync(fp)) {
    await fs.promises.writeFile(fp, JSON.stringify(fallback, null, 2), "utf-8");
    return fallback;
  }
  try {
    const raw = await fs.promises.readFile(fp, "utf-8");
    return JSON.parse(raw) as T;
  } catch (e) {
    // Arquivo corrompido (ex.: queda de energia no meio de uma escrita antiga,
    // antes do padrão atômico tmp+rename abaixo existir) — NÃO pode voltar
    // fallback em silêncio: a próxima escrita gravaria por cima e destruiria
    // de vez o que ainda pudesse estar recuperável ali dentro. Guarda uma
    // cópia do arquivo quebrado ao lado, loga bem alto, e só então segue com
    // a coleção vazia — dá pra perceber e tentar recuperar manualmente.
    console.error(`[store] "${name}.json" está corrompido/ilegível — mantendo cópia e usando dados vazios.`, e);
    try {
      await fs.promises.copyFile(fp, `${fp}.corrompido-${Date.now()}`);
    } catch (copyErr) {
      console.error(`[store] Não deu pra salvar cópia de "${name}.json" corrompido:`, copyErr);
    }
    return fallback;
  }
}

async function writeJson<T>(name: string, data: T): Promise<void> {
  const fp = filePath(name);
  const tmp = `${fp}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await fs.promises.rename(tmp, fp);
}

/** Lê uma coleção (lista com auto-incremento de id). */
export function getCollection<T>(name: string): Promise<Collection<T>> {
  return enqueue(name, () => readJson<Collection<T>>(name, { nextId: 1, items: [] }));
}

/**
 * Lê, permite mutar `col.items`/`col.nextId` dentro de `fn` e grava o
 * resultado — tudo dentro da fila do arquivo, para leitura+escrita atômica.
 */
export function updateCollection<T, R>(
  name: string,
  fn: (col: Collection<T>) => R | Promise<R>
): Promise<R> {
  return enqueue(name, async () => {
    const col = await readJson<Collection<T>>(name, { nextId: 1, items: [] });
    const result = await fn(col);
    await writeJson(name, col);
    return result;
  });
}

/** Lê um documento único (ex.: configurações de marca). */
export function getDoc<T>(name: string, fallback: T): Promise<T> {
  return enqueue(name, () => readJson<T>(name, fallback));
}

/** Lê, muta e grava um documento único. */
export function updateDoc<T, R>(
  name: string,
  fallback: T,
  fn: (doc: T) => R | Promise<R>
): Promise<R> {
  return enqueue(name, async () => {
    const doc = await readJson<T>(name, fallback);
    const result = await fn(doc);
    await writeJson(name, doc);
    return result;
  });
}
