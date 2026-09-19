/* Roda automaticamente antes de "npm run electron:publish" (hook
 * "preelectron:publish" no package.json). Existe pra garantir que NENHUMA
 * versão suba sem alguém ter revisado e aprovado o texto que a igreja vai
 * ver — sem isso, seria fácil publicar sem lembrar de escrever (ou aprovar)
 * as notas daquela versão. */
const fs = require("fs");
const path = require("path");

const pkg = require("../package.json");
const version = pkg.version;
const file = path.join(__dirname, "..", "release-notes", `${version}.json`);

if (!fs.existsSync(file)) {
  console.error(
    `\nFaltam as notas de versão pra ${version}.\n` +
      `Crie release-notes/${version}.json (veja outro arquivo da pasta como modelo) antes de publicar.\n`
  );
  process.exit(1);
}

let note;
try {
  note = JSON.parse(fs.readFileSync(file, "utf-8"));
} catch (e) {
  console.error(`\nrelease-notes/${version}.json não é um JSON válido: ${e.message}\n`);
  process.exit(1);
}

if (note.status !== "approved") {
  console.error(
    `\nAs notas de versão de ${version} ainda não foram aprovadas ` +
      `(status atual: "${note.status || "ausente"}").\n` +
      `Revise o texto em release-notes/${version}.json e mude "status" para "approved" antes de publicar.\n`
  );
  process.exit(1);
}

if (!note.title || !Array.isArray(note.items) || note.items.length === 0) {
  console.error(`\nrelease-notes/${version}.json está aprovado mas incompleto (falta título ou itens).\n`);
  process.exit(1);
}

console.log(`Notas de versão de ${version} aprovadas — publicando.`);
