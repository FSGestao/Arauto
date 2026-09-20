/* Servidor estático só pra conferir a landing page antes de publicar.
   `node scripts/servir-landing.js [porta]` — abre em http://localhost:4321
   e também responde na rede local, pra testar no celular.

   A landing é publicada na Vercel a partir da pasta landing/; isto aqui é
   apenas pré-visualização local, não faz parte do build do aplicativo. */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { getLocalIPs } = require("../lib/shared");

const RAIZ = path.join(__dirname, "..", "landing");
const PORTA = Number(process.argv[2] || process.env.PORT || 4321);

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

http
  .createServer((req, res) => {
    const pedido = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const relativo = pedido === "/" ? "index.html" : pedido.replace(/^\/+/, "");
    const arquivo = path.join(RAIZ, relativo);

    // Nunca servir nada fora de landing/ (um "../" no caminho pedido).
    if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Não encontrado");
      return;
    }
    res.writeHead(200, {
      "Content-Type": TIPOS[path.extname(arquivo).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store", // conferindo mudanças: nunca servir cache
    });
    fs.createReadStream(arquivo).pipe(res);
  })
  .listen(PORTA, "0.0.0.0", () => {
    console.log(`Landing em http://localhost:${PORTA}`);
    for (const ip of getLocalIPs()) console.log(`           http://${ip}:${PORTA}  (celular, mesma Wi-Fi)`);
  });
