const path = require("path");
const { app, BrowserWindow, screen, Menu, shell } = require("electron");

let mainWindow = null;
let projectionWindow = null;
let baseUrl = null;

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
    webPreferences: { contextIsolation: true, nodeIntegration: false },
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

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
