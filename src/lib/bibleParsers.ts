import { XMLParser } from "fast-xml-parser";
import type { BibleBook, BibleTranslationData } from "./types";

/* ═══════════════════════════════════════════════════════
   Bíblia — upload de traduções próprias do usuário, em JSON, XML ou CSV.
   Como não dá pra saber de antemão o formato exato de cada arquivo (não
   existe um padrão único), cada parser aceita algumas variações comuns em
   vez de exigir uma estrutura rígida.
   ═══════════════════════════════════════════════════════ */

export interface UploadMeta {
  name: string;
  language?: string;
  license?: string;
}

interface FlatRow {
  book: string;
  bookAbbrev?: string;
  chapter: number;
  verse: number;
  text: string;
}

function normalizeKey(k: string): string {
  return k
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function groupFlatRows(rows: FlatRow[]): BibleBook[] {
  const books: BibleBook[] = [];
  const byBook = new Map<string, BibleBook>();
  for (const row of rows) {
    let book = byBook.get(row.book);
    if (!book) {
      book = { name: row.book, abbrev: row.bookAbbrev || row.book.slice(0, 3).toLowerCase(), chapters: [] };
      byBook.set(row.book, book);
      books.push(book);
    }
    let chapter = book.chapters.find((c) => c.number === row.chapter);
    if (!chapter) {
      chapter = { number: row.chapter, verses: [] };
      book.chapters.push(chapter);
    }
    chapter.verses.push({ number: row.verse, text: row.text });
  }
  return books;
}

function normalizeBook(raw: unknown): BibleBook {
  const b = raw as Record<string, unknown>;
  const name = String(b.name ?? b.nome ?? b.book ?? "Livro");
  const abbrev = String(b.abbrev ?? b.abbreviation ?? b.abrev ?? name.slice(0, 3)).toLowerCase();
  const chaptersRaw = (b.chapters ?? b.capitulos ?? []) as unknown[];
  const chapters = chaptersRaw.map((c) => {
    const ch = c as Record<string, unknown>;
    const versesRaw = (ch.verses ?? ch.versiculos ?? []) as unknown[];
    return {
      number: Number(ch.number ?? ch.numero ?? ch.chapter ?? 0),
      verses: versesRaw.map((v) => {
        const vv = v as Record<string, unknown>;
        return {
          number: Number(vv.number ?? vv.numero ?? vv.verse ?? 0),
          text: String(vv.text ?? vv.texto ?? ""),
        };
      }),
    };
  });
  return { name, abbrev, chapters };
}

/** Aceita `{ books: [...] }` (nosso formato nativo, com pequenas variações
 *  de nome de campo) ou uma lista plana de `{ book/livro, chapter/capitulo,
 *  verse/versiculo, text/texto }` — o jeito mais comum de exportar em JSON
 *  quando não há uma estrutura de livros/capítulos aninhada. */
export function parseBibleJson(content: string, meta: UploadMeta): Omit<BibleTranslationData, "id"> {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    throw new Error("Arquivo não é um JSON válido.");
  }

  if (Array.isArray(data)) {
    if (data.length === 0) throw new Error("A lista está vazia.");
    const rows = data.map((r) => {
      const row = r as Record<string, unknown>;
      return {
        book: String(row.book ?? row.livro ?? ""),
        bookAbbrev: row.abbrev ? String(row.abbrev) : undefined,
        chapter: Number(row.chapter ?? row.capitulo ?? 0),
        verse: Number(row.verse ?? row.versiculo ?? 0),
        text: String(row.text ?? row.texto ?? ""),
      };
    });
    if (rows.some((r) => !r.book)) {
      throw new Error("Cada item da lista precisa de um campo \"book\" (ou \"livro\").");
    }
    return {
      name: meta.name,
      language: meta.language || "pt-BR",
      license: meta.license || "Definida pelo usuário no upload",
      source: "Upload manual",
      books: groupFlatRows(rows),
    };
  }

  const obj = data as Record<string, unknown>;
  const booksRaw = obj.books ?? obj.livros;
  if (!Array.isArray(booksRaw)) {
    throw new Error(
      'JSON não reconhecido — use { "books": [...] } (livros com capítulos e versículos) ou uma lista de { book, chapter, verse, text }.'
    );
  }
  return {
    name: meta.name || String(obj.name ?? obj.nome ?? "Tradução importada"),
    language: meta.language || String(obj.language ?? "pt-BR"),
    license: meta.license || String(obj.license ?? "Definida pelo usuário no upload"),
    source: String(obj.source ?? "Upload manual"),
    books: booksRaw.map(normalizeBook),
  };
}

/** Parser CSV simples (RFC4180: aspas, vírgulas e quebras de linha dentro
 *  de campos entre aspas). Cabeçalho esperado: book/livro, chapter/capitulo,
 *  verse/versiculo, text/texto (em qualquer ordem, sem acentuação ou com). */
function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (inQuotes) {
      if (c === '"') {
        if (content[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignora — a quebra de linha real é tratada no \n
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

export function parseBibleCsv(content: string, meta: UploadMeta): Omit<BibleTranslationData, "id"> {
  const rows = parseCsvRows(content);
  if (rows.length < 2) throw new Error("CSV vazio ou sem linhas de dados.");
  const header = rows[0].map(normalizeKey);
  const colBook = header.findIndex((h) => h === "book" || h === "livro");
  const colChapter = header.findIndex((h) => h === "chapter" || h === "capitulo");
  const colVerse = header.findIndex((h) => h === "verse" || h === "versiculo");
  const colText = header.findIndex((h) => h === "text" || h === "texto" || h === "conteudo");
  if (colBook < 0 || colChapter < 0 || colVerse < 0 || colText < 0) {
    throw new Error(
      "Cabeçalho do CSV precisa ter as colunas book/livro, chapter/capitulo, verse/versiculo e text/texto."
    );
  }
  const flat: FlatRow[] = rows.slice(1).map((r) => ({
    book: r[colBook] ?? "",
    chapter: Number(r[colChapter] ?? 0),
    verse: Number(r[colVerse] ?? 0),
    text: r[colText] ?? "",
  }));
  return {
    name: meta.name,
    language: meta.language || "pt-BR",
    license: meta.license || "Definida pelo usuário no upload",
    source: "Upload manual (CSV)",
    books: groupFlatRows(flat),
  };
}

/** XML no formato Zefania (<XMLBIBLE><BIBLEBOOK><CHAPTER><VERS>) — o mais
 *  comum entre módulos de Bíblia trocados entre apps (e-Sword, MyBible,
 *  etc. costumam exportar/aceitar esse formato). */
export function parseBibleXml(content: string, meta: UploadMeta): Omit<BibleTranslationData, "id"> {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "", textNodeName: "text" });
  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(content);
  } catch {
    throw new Error("Arquivo não é um XML válido.");
  }
  const root = (doc.XMLBIBLE ?? doc.xmlbible) as Record<string, unknown> | undefined;
  if (!root) {
    throw new Error('XML não reconhecido — use o formato Zefania (raiz "<XMLBIBLE>").');
  }
  const booksRaw = Array.isArray(root.BIBLEBOOK) ? root.BIBLEBOOK : [root.BIBLEBOOK];
  const books: BibleBook[] = (booksRaw as Record<string, unknown>[]).filter(Boolean).map((b) => {
    const chaptersRaw = Array.isArray(b.CHAPTER) ? b.CHAPTER : [b.CHAPTER];
    const name = String(b.bname ?? b.bsname ?? "Livro");
    return {
      name,
      abbrev: String(b.bsname ?? name).toLowerCase().slice(0, 3),
      chapters: (chaptersRaw as Record<string, unknown>[]).filter(Boolean).map((c) => {
        const versesRaw = Array.isArray(c.VERS) ? c.VERS : [c.VERS];
        return {
          number: parseInt(String(c.cnumber ?? "0"), 10),
          verses: (versesRaw as unknown[]).filter(Boolean).map((v) => {
            const vv = v as Record<string, unknown> | string;
            const text = typeof vv === "string" ? vv : String((vv as Record<string, unknown>).text ?? "");
            const vnumber = typeof vv === "string" ? "0" : String((vv as Record<string, unknown>).vnumber ?? "0");
            return { number: parseInt(vnumber, 10), text };
          }),
        };
      }),
    };
  });
  return {
    name: meta.name,
    language: meta.language || "pt-BR",
    license: meta.license || "Definida pelo usuário no upload",
    source: "Upload manual (XML Zefania)",
    books,
  };
}

export function parseBibleUpload(
  format: "json" | "xml" | "csv",
  content: string,
  meta: UploadMeta
): Omit<BibleTranslationData, "id"> {
  if (format === "json") return parseBibleJson(content, meta);
  if (format === "csv") return parseBibleCsv(content, meta);
  return parseBibleXml(content, meta);
}
