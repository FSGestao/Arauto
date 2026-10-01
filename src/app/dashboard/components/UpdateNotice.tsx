"use client";

import React, { useEffect, useState } from "react";
import { Icon } from "./Icon";

/**
 * Aviso de "atualização pronta" na toolbar. O app baixa a versão nova
 * sozinho, mas nunca reinicia nem instala por conta própria — nem ao fechar —
 * porque isso derrubaria a projeção no meio de um culto. Então quem decide a
 * hora é o operador, por este botão, e sempre com confirmação.
 *
 * Só aparece dentro do app desktop: aberto pelo navegador de outro
 * computador da rede, `window.arauto` não existe e nada é mostrado.
 */
export function UpdateNotice() {
  const [readyVersion, setReadyVersion] = useState<string | null>(null);

  useEffect(() => {
    const bridge = window.arauto;
    if (!bridge) return;
    // O download pode ter terminado antes de o painel montar.
    bridge.lastUpdateStatus?.()
      .then((s) => { if (s?.state === "downloaded") setReadyVersion(s.version ?? ""); })
      .catch(() => {});
    return bridge.onUpdateStatus((s) => {
      if (s.state === "downloaded") setReadyVersion(s.version ?? "");
    });
  }, []);

  if (readyVersion === null) return null;

  const label = readyVersion ? `Versão ${readyVersion} pronta para instalar` : "Atualização pronta para instalar";

  function install() {
    const ok = window.confirm(
      `${label}.\n\n` +
        "O Arauto vai fechar e abrir de novo — a projeção some da tela por alguns segundos. " +
        "Se estiver no meio do culto, deixe para depois: o aviso continua aqui.\n\n" +
        "Reiniciar e instalar agora?"
    );
    if (ok) window.arauto?.installUpdate();
  }

  return (
    <button className="toolbar-update" onClick={install} title={`${label} — clique para reiniciar e instalar`}>
      <Icon name="download" />
      <span className="update-long">Atualização pronta</span>
      <span className="update-short">Atualizar</span>
    </button>
  );
}
