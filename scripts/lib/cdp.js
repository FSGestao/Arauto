/* Driver CDP mínimo: abre páginas reais e avalia expressões nelas. */
const WebSocket = require("ws");
const http = require("http");

function get(path, method = "GET") {
  return new Promise((resolve, reject) => {
    http.request({ host: "127.0.0.1", port: 9222, path, method }, (res) => {
      let b = "";
      res.on("data", (d) => (b += d));
      res.on("end", () => {
        try { resolve(JSON.parse(b)); } catch (e) { resolve(b); }
      });
    }).on("error", reject).end();
  });
}

class Page {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.logs = [];
    ws.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === "Page.javascriptDialogOpening") {
        // confirm()/alert() travariam a página: ninguém vai clicar em OK.
        // O padrão é confirmar, que é o caminho que os testes exercitam.
        this.send("Page.handleJavaScriptDialog", { accept: this.dialogAccept !== false }).catch(() => {});
      } else if (msg.method === "Runtime.consoleAPICalled" && msg.params.type === "error") {
        this.logs.push(msg.params.args.map((a) => a.value ?? a.description).join(" "));
      } else if (msg.method === "Runtime.exceptionThrown") {
        this.logs.push(msg.params.exceptionDetails.text + " " +
          (msg.params.exceptionDetails.exception?.description || ""));
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error("timeout " + method)); }
      }, 20000);
    });
  }
  async ev(expr) {
    const r = await this.send("Runtime.evaluate", {
      expression: `(async () => { ${expr} })()`,
      awaitPromise: true, returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " :: " +
      (r.exceptionDetails.exception?.description || ""));
    return r.result.value;
  }
  /** Escolhe arquivos num <input type="file"> como se fosse a janela do
   *  Windows — é o único jeito de testar upload sem um humano. */
  async setFile(selector, files) {
    const r = await this.send("Runtime.evaluate", {
      expression: `document.querySelector(${JSON.stringify(selector)})`,
    });
    if (!r.result || !r.result.objectId) throw new Error("não achei o campo de arquivo: " + selector);
    await this.send("DOM.setFileInputFiles", { files, objectId: r.result.objectId });
  }
  close() { try { this.ws.close(); } catch {} }
}

async function openPage(url, cookie) {
  const t = await get("/json/new?about:blank", "PUT");
  if (!t.webSocketDebuggerUrl) throw new Error("não consegui abrir uma aba: " + JSON.stringify(t).slice(0, 200));
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise((res, rej) => { ws.once("open", res); ws.once("error", rej); });
  const page = new Page(ws);
  page.targetId = t.id;
  await page.send("Runtime.enable");
  await page.send("Page.enable");
  await page.send("Network.enable");
  await page.send("DOM.enable");
  if (cookie) {
    await page.send("Network.setCookie", {
      name: "auth-token", value: cookie, domain: "localhost", path: "/",
    });
  }
  await page.send("Page.navigate", { url });
  await page.ev("await new Promise(r => { if (document.readyState === 'complete') r(); else addEventListener('load', r); });");
  return page;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = { get, openPage, sleep };
