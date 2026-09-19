const { contextBridge, ipcRenderer } = require("electron");

/**
 * Ponte segura entre o painel (roda como página web comum, sem acesso a
 * Node) e o processo principal do Electron, só para o que a UI de
 * atualização precisa. A mesma página também é aberta por outros
 * computadores da rede local via navegador comum — lá `window.arauto`
 * simplesmente não existe, e a UI de atualização se esconde sozinha.
 */
contextBridge.exposeInMainWorld("arauto", {
  version: () => ipcRenderer.invoke("update:version"),
  checkForUpdate: () => ipcRenderer.invoke("update:check"),
  installUpdate: () => ipcRenderer.send("update:install"),
  onUpdateStatus: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on("update:status", handler);
    return () => ipcRenderer.removeListener("update:status", handler);
  },
});
