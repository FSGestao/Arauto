/** Ponte exposta por electron/preload.js — só existe quando o painel roda
 *  dentro do app desktop (Electron), não quando é aberto por outro
 *  computador da rede pelo navegador comum. */
export interface ArautoUpdateStatus {
  state: "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
  version?: string;
  percent?: number;
  message?: string;
}

export interface ArautoBridge {
  version: () => Promise<string>;
  checkForUpdate: () => Promise<void>;
  /** Último estado já emitido (null se nenhuma verificação rodou ainda).
   *  Opcional: instalações antigas do app não expõem. */
  lastUpdateStatus?: () => Promise<ArautoUpdateStatus | null>;
  installUpdate: () => void;
  onUpdateStatus: (callback: (status: ArautoUpdateStatus) => void) => () => void;
}

declare global {
  interface Window {
    arauto?: ArautoBridge;
  }
}
