"use client";

import { useState, useEffect, useRef } from "react";
import type { Settings } from "../types";
import { getAuthHeaders } from "../utils";
import { Icon } from "./Icon";
import type { ArautoUpdateStatus } from "../../../types/arauto-electron";

/**
 * Alterna o tema do painel Admin (claro/escuro) via `data-theme` no <html>,
 * guardado em localStorage — é preferência de quem está operando, não do
 * culto, e não afeta a tela de projeção (que fica sempre escura).
 */
function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("arauto-theme");
    const initial = stored === "light" ? "light" : "dark";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("arauto-theme", next);
  }

  return (
    <button className="act-btn ghost" onClick={toggle}>
      <Icon name={theme === "dark" ? "moon" : "sun"} />
      {theme === "dark" ? "Tema escuro" : "Tema claro"}
    </button>
  );
}

type SettingsTab = "appearance" | "screens" | "backup" | "account" | "about";

export function SettingsModal({
  settings,
  networkUrls,
  stageUrls,
  onClose,
  onLogout,
  onShowOnboarding,
  onShowReleaseNotes,
  onShowManual,
  onSaved,
}: {
  settings: Settings;
  networkUrls: string[];
  stageUrls: string[];
  onClose: () => void;
  onLogout: () => void;
  onShowOnboarding: () => void;
  onShowReleaseNotes: () => void;
  onShowManual: () => void;
  onSaved: (s: Settings) => void;
}) {
  const [subTab, setSubTab] = useState<SettingsTab>("appearance");
  const [name, setName] = useState(settings.name);
  const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(settings.secondaryColor);
  const [bgColor, setBgColor] = useState(settings.bgColor);
  const [textColor, setTextColor] = useState(settings.textColor);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl || "");
  const [textPosition, setTextPosition] = useState(settings.textPosition || "center");
  const [countdownTextPosition, setCountdownTextPosition] = useState(settings.countdownTextPosition || "center");
  const [saving, setSaving] = useState(false);

  // Espelha DEFAULT_SETTINGS de src/lib/types.ts — não importamos de lá de
  // propósito (ver o comentário no topo de dashboard/types.ts).
  function restaurarPadrao() {
    setPrimaryColor("#6C3AED");
    setSecondaryColor("#8B5CF6");
    setBgColor("#0F0A1E");
    setTextColor("#FFFFFF");
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        name,
        primaryColor,
        secondaryColor,
        bgColor,
        textColor,
        logoUrl: logoUrl || null,
        textPosition,
        countdownTextPosition,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      onSaved(data);
    }
    setSaving(false);
  }

  const tabs: { id: SettingsTab; label: string }[] = [
    { id: "appearance", label: "Aparência" },
    { id: "screens", label: "Telas" },
    { id: "backup", label: "Backup" },
    { id: "account", label: "Conta" },
    { id: "about", label: "Sobre" },
  ];

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-head">
          <h2>⚙️ Configurações</h2>
          <button className="toolbar-icon-btn" onClick={onClose} title="Fechar" style={{ fontSize: "1.1rem" }}>
            ×
          </button>
        </div>

        <div className="settings-tabs">
          {tabs.map((t) => (
            <button
              key={t.id}
              className={`settings-tab ${subTab === t.id ? "active" : ""}`}
              onClick={() => setSubTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="settings-modal-body">
          {subTab === "appearance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <label className="input-label">Nome da Igreja</label>
                <input className="input-field" value={name} onChange={(e) => setName(e.target.value)} />
              </div>

              <div>
                <label className="input-label">URL do Logo (aparece na tela de projeção)</label>
                <input className="input-field" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <label className="input-label" style={{ margin: 0 }}>Cores</label>
                <button type="button" className="act-btn ghost" onClick={restaurarPadrao} style={{ fontSize: "0.78rem" }}>
                  Restaurar padrão do sistema
                </button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="input-label">Cor Primária</label>
                  <div className="color-picker-group">
                    <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                    <input className="input-field" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
                <div>
                  <label className="input-label">Cor Secundária</label>
                  <div className="color-picker-group">
                    <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                    <input className="input-field" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
                <div>
                  <label className="input-label">Cor de Fundo (projeção)</label>
                  <div className="color-picker-group">
                    <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
                    <input className="input-field" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
                <div>
                  <label className="input-label">Cor do Texto (projeção)</label>
                  <div className="color-picker-group">
                    <input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} />
                    <input className="input-field" value={textColor} onChange={(e) => setTextColor(e.target.value)} style={{ flex: 1 }} />
                  </div>
                </div>
              </div>

              <div>
                <label className="input-label">Preview da Projeção</label>
                <div style={{ background: bgColor, color: textColor, padding: 24, borderRadius: "var(--radius-lg)", border: "1px solid var(--border-glass)", textAlign: "center" }}>
                  <p style={{ fontSize: "1.1rem", fontWeight: 700 }}>Texto de exemplo</p>
                  <p style={{ fontSize: "0.9rem", opacity: 0.7, marginTop: 8 }}>{name}</p>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div>
                  <label className="input-label">Posição do texto (letras e avisos)</label>
                  <select
                    className="input-field"
                    value={textPosition}
                    onChange={(e) => setTextPosition(e.target.value as typeof textPosition)}
                  >
                    <option value="top">Acima</option>
                    <option value="center">Centralizado</option>
                    <option value="bottom">Abaixo</option>
                  </select>
                </div>
                <div>
                  <label className="input-label">Posição do texto (contagem regressiva)</label>
                  <select
                    className="input-field"
                    value={countdownTextPosition}
                    onChange={(e) => setCountdownTextPosition(e.target.value as typeof countdownTextPosition)}
                  >
                    <option value="top">Acima</option>
                    <option value="center">Centralizado</option>
                    <option value="bottom">Abaixo</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="input-label">Tema do painel</label>
                <ThemeToggle />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          )}

          {subTab === "screens" && (
            <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              <p style={{ marginBottom: 8 }}>
                Projeção — abra este endereço no computador ligado ao projetor (mesma rede):
              </p>
              {networkUrls.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>Nenhum endereço de rede detectado.</p>
              ) : (
                networkUrls.map((url) => (
                  <p key={url} style={{ fontFamily: "monospace", color: "var(--primary-light)" }}>
                    {url}
                  </p>
                ))
              )}

              <p style={{ margin: "18px 0 8px" }}>
                Stage View — monitor de confiança, para um tablet ou monitor no palco:
              </p>
              {stageUrls.length === 0 ? (
                <p style={{ color: "var(--text-muted)" }}>Nenhum endereço de rede detectado.</p>
              ) : (
                stageUrls.map((url) => (
                  <p key={url} style={{ fontFamily: "monospace", color: "var(--primary-light)" }}>
                    {url}
                  </p>
                ))
              )}
            </div>
          )}

          {subTab === "backup" && <BackupCard />}

          {subTab === "account" && (
            <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              <p>Conta conectada ao painel administrativo do Arauto.</p>
              <p style={{ marginTop: 8, color: "var(--text-muted)", fontSize: "0.82rem" }}>
                Gestão de múltiplas contas ainda não está disponível nesta versão.
              </p>
              <button className="btn btn-danger" style={{ marginTop: 20 }} onClick={onLogout}>
                Sair da conta
              </button>
            </div>
          )}

          {subTab === "about" && (
            <div style={{ fontSize: "0.9rem", color: "var(--text-secondary)" }}>
              <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>Arauto</p>
              <p>Sistema de projeção para igrejas — letras, avisos, mídia e roteiro de culto em um só painel.</p>
              <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
                <button className="act-btn ghost" onClick={onShowOnboarding}>
                  <Icon name="book" /> Como usar o sistema
                </button>
                <button className="act-btn ghost" onClick={onShowManual}>
                  <Icon name="checklist" /> Manual completo
                </button>
                <button className="act-btn ghost" onClick={onShowReleaseNotes}>
                  <Icon name="bell" /> Novidades e notas de versão
                </button>
              </div>
              <UpdateCard />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BackupCard() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/backup/export", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = /filename="?([^"]+)"?/.exec(disposition);
      const filename = match ? match[1] : "arauto-backup.zip";
      // Sem <a download> aqui não funciona em todo navegador — cria o link,
      // clica sozinho e descarta, é o jeito padrão de baixar um blob gerado.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMessage({ type: "success", text: `Backup baixado: ${filename}` });
    } catch {
      setMessage({ type: "error", text: "Erro ao gerar o backup" });
    }
    setExporting(false);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite escolher o mesmo arquivo de novo depois
    if (!file) return;

    if (
      !confirm(
        "Isso vai SUBSTITUIR todas as músicas, avisos, mídias e contas atuais pelos dados do backup.\n\n" +
          "Um backup de segurança dos dados atuais é salvo automaticamente antes, então dá pra voltar atrás. Continuar?"
      )
    ) {
      return;
    }

    setImporting(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const token = document.cookie.match(/auth-token=([^;]+)/)?.[1] || "";
      const res = await fetch("/api/backup/import", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage({ type: "success", text: `${data.message} (backup de segurança: ${data.safetyBackup})` });
        setTimeout(() => window.location.reload(), 2500);
      } else {
        setMessage({ type: "error", text: data.error || "Erro ao importar o backup" });
      }
    } catch {
      setMessage({ type: "error", text: "Erro ao importar o backup" });
    }
    setImporting(false);
  }

  return (
    <div className="glass-card p-xl" style={{ maxWidth: 600, marginTop: 24 }}>
      <h3 style={{ marginBottom: 6 }}>Dados e Backup</h3>
      <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 20 }}>
        Todos os dados (músicas, letras, avisos, mídia, contas) ficam em arquivos locais — nenhuma nuvem envolvida.
        Exporte de vez em quando, principalmente antes de trocar de computador.
      </p>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <button className="btn btn-primary" onClick={handleExport} disabled={exporting}>
          {exporting ? "Gerando..." : "⬇ Exportar Backup (.zip)"}
        </button>
        <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()} disabled={importing}>
          {importing ? "Restaurando..." : "⬆ Importar Backup (.zip)"}
        </button>
        <input ref={fileInputRef} type="file" accept=".zip" hidden onChange={handleImportFile} />
      </div>
      {message && (
        <p style={{ fontSize: "0.85rem", marginTop: 12, color: message.type === "success" ? "var(--success)" : "var(--danger)" }}>
          {message.text}
        </p>
      )}
    </div>
  );
}

/**
 * Atualização do próprio app desktop — só existe dentro do Electron
 * (`window.arauto`, exposto por electron/preload.js). Quem abre o painel
 * pelo navegador em outro computador da rede não vê nada disso: não é ali
 * que o app é instalado, então não haveria o que atualizar.
 *
 * O app já confere sozinho ao abrir (silencioso, só aparece se houver
 * novidade) e baixa a atualização automaticamente assim que a encontra —
 * este cartão serve pra checar na hora e pra dar o "reiniciar e instalar",
 * que fica sempre manual de propósito: nunca reiniciar sozinho enquanto
 * pode haver um culto em andamento.
 */
function UpdateCard() {
  const [available, setAvailable] = useState(typeof window !== "undefined" && !!window.arauto);
  const [version, setVersion] = useState<string | null>(null);
  const [status, setStatus] = useState<ArautoUpdateStatus>({ state: "not-available" });
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!window.arauto) return;
    setAvailable(true);
    window.arauto.version().then(setVersion).catch(() => {});
    const unsubscribe = window.arauto.onUpdateStatus((s) => {
      setStatus(s);
      setHasChecked(true);
    });
    return unsubscribe;
  }, []);

  if (!available) {
    return (
      <p style={{ marginTop: 16, fontSize: "0.82rem", color: "var(--text-muted)" }}>
        Atualizações automáticas só aparecem no aplicativo instalado — você está acessando pelo navegador.
      </p>
    );
  }

  const checking = status.state === "checking" || status.state === "downloading";

  return (
    <div className="glass-card p-md" style={{ marginTop: 16 }}>
      <p style={{ fontSize: "0.85rem", color: "var(--text-primary)" }}>
        Versão instalada: <strong>{version ?? "..."}</strong>
      </p>

      {status.state === "downloaded" ? (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: "0.85rem", color: "var(--success)", marginBottom: 8 }}>
            Atualização {status.version} baixada e pronta. Instala ao reiniciar o app.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => window.arauto?.installUpdate()}>
            Reiniciar e instalar agora
          </button>
        </div>
      ) : (
        <>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={checking}
              onClick={() => window.arauto?.checkForUpdate()}
            >
              {checking ? "Verificando..." : "Verificar atualizações agora"}
            </button>
            {status.state === "downloading" && (
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Baixando... {status.percent ?? 0}%</span>
            )}
          </div>
          {hasChecked && status.state === "not-available" && (
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 8 }}>
              Você já está na versão mais recente.
            </p>
          )}
          {status.state === "available" && (
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: 8 }}>
              Versão {status.version} encontrada — baixando...
            </p>
          )}
          {status.state === "error" && (
            <p style={{ fontSize: "0.8rem", color: "var(--danger)", marginTop: 8 }}>{status.message}</p>
          )}
        </>
      )}
    </div>
  );
}
