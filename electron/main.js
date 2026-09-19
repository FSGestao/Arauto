const path = require("path");
const { app, BrowserWindow, screen, Menu, shell, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

let mainWindow = null;
let projectionWindow = null;
let baseUrl = null;

// Sem isso, o electron-updater verificaria a cada execução mesmo em
// desenvolvimento (sem instalador, sem feed de update) e só geraria erro.
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;

function sendUpdateStatus(status) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("update:status", status);
  }
}

autoUpdater.on("checking-for-update", () => sendUpdateStatus({ state: "checking" }));
autoUpdater.on("update-available", (info) => {
  sendUpdateStatus({ state: "available", version: info.version });
  // Baixa sozinho assim que sabe que existe — o operador só precisa agir na
  // hora de instalar (reiniciar), que é o único passo que não pode acontecer
  // sozinho no meio de um culto.
  autoUpdater.downloadUpdate().catch((e) => sendUpdateStatus({ state: "error", message: e?.message || String(e) }));
});
autoUpdater.on("update-not-available", () => sendUpdateStatus({ state: "not-available" }));
autoUpdater.on("download-progress", (p) =>
  sendUpdateStatus({ state: "downloading", percent: Math.round(p.percent) })
);
autoUpdater.on("update-downloaded", (info) =>
  sendUpdateStatus({ state: "downloaded", version: info.version })
);
autoUpdater.on("error", (err) => sendUpdateStatus({ state: "error", message: err?.message || String(err) }));

function wireUpdateIpc() {
  ipcMain.handle("update:version", () => app.getVersion());
  ipcMain.handle("update:check", async () => {
    if (!app.isPackaged) {
      // Em desenvolvimento não há instalador nem feed de update — avisa em
      // vez de deixar o electron-updater estourar um erro confuso.
      sendUpdateStatus({ state: "error", message: "Verificação de atualização só funciona no app instalado." });
      return;
    }
    try {
      await autoUpdater.checkForUpdates();
    } catch (e) {
      sendUpdateStatus({ state: "error", message: e?.message || String(e) });
    }
  });
  ipcMain.on("update:install", () => {
    autoUpdater.quitAndInstall();
  });
}

async function startLocalServer() {
  // Dados locais (musics.json, announcements.json, users.json, ...) ficam
  // fora da pasta instalada, na pasta de dados do usuário do Windows.
  process.env.DATA_DIR = path.join(app.getPath("userData"), "data");

  const appRoot = path.join(__dirname, "..");
  const { createServer } = require(path.join(appRoot, "server.js"));

  const port = parseInt(process.env.PORT || "3210", 10);
  const info = await createServer({
    dev: !app.isPackaged,
    port,
    host: "0.0.0.0",
    dir: appRoot,
  });
  return info;
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    title: "Arauto — Painel",
    icon: path.join(__dirname, "..", "public", "arauto-logo.png"),
    autoHideMenuBar: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });
  mainWindow.loadURL(`${baseUrl}/`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function openProjectionWindow() {
  if (projectionWindow && !projectionWindow.isDestroyed()) {
    projectionWindow.focus();
    return;
  }

  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  const secondary = displays.find((d) => d.id !== primary.id);
  const target = secondary || primary;

  projectionWindow = new BrowserWindow({
    x: target.bounds.x,
    y: target.bounds.y,
    width: target.bounds.width,
    height: target.bounds.height,
    fullscreen: !!secondary,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  projectionWindow.loadURL(`${baseUrl}/projection`);
  projectionWindow.on("closed", () => {
    projectionWindow = null;
  });
}

function buildMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: "Projeção",
      submenu: [
        {
          label: "Abrir Janela de Projeção",
          click: () => openProjectionWindow(),
        },
        {
          label: "Ver URL de rede (outro computador)",
          click: () => shell.openExternal(`${baseUrl}/dashboard`),
        },
        { type: "separator" },
        { label: "Sair", role: "quit" },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  const info = await startLocalServer();
  baseUrl = info.urls.local;

  createMainWindow();
  buildMenu();
  wireUpdateIpc();

  // Checagem automática e silenciosa ao abrir — só aparece algo na tela se
  // realmente houver uma versão nova (o handler de "update-available" já
  // dispara o download sozinho). Sem isso, cada igreja precisaria lembrar de
  // clicar em "verificar" de vez em quando, o que não acontece na prática.
  if (app.isPackaged) {
    autoUpdater.checkForUpdates().catch((e) => sendUpdateStatus({ state: "error", message: e?.message || String(e) }));
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
