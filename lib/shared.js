/**
 * Utilidades compartilhadas entre o servidor customizado (server.js, processo
 * Electron) e as rotas de API do Next.js — mantidas em CommonJS puro para que
 * ambos os lados possam usar exatamente o mesmo módulo (mesmo cache do Node).
 */
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

let cachedSecret = null;

/** Diretório onde os arquivos JSON de dados são lidos/gravados. */
function dataDir() {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Segredo usado para assinar os tokens JWT. Se JWT_SECRET não estiver
 * definido, gera um segredo aleatório e persiste em disco (data/secret.key)
 * para que ele sobreviva a reinícios do app.
 */
function getSecret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.JWT_SECRET) {
    cachedSecret = process.env.JWT_SECRET;
    return cachedSecret;
  }
  const fp = path.join(dataDir(), "secret.key");
  if (fs.existsSync(fp)) {
    cachedSecret = fs.readFileSync(fp, "utf-8").trim();
    return cachedSecret;
  }
  const secret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(fp, secret, "utf-8");
  cachedSecret = secret;
  return cachedSecret;
}

/** Endereços IPv4 locais (para exibir a URL de acesso via rede/LAN). */
function getLocalIPs() {
  const ifaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) ips.push(iface.address);
    }
  }
  return ips;
}

module.exports = { dataDir, getSecret, getLocalIPs };
