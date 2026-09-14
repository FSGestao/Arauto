"use client";

import { useState, useEffect } from "react";

interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: string;
}

function getAuthHeaders(): HeadersInit {
  const match = document.cookie.match(/auth-token=([^;]+)/);
  const token = match ? match[1] : "";
  return { Authorization: `Bearer ${token}` };
}

export default function DownloadPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { headers: getAuthHeaders() })
      .then((r) => {
        if (!r.ok) {
          window.location.href = "/";
          throw new Error("Not authenticated");
        }
        return r.json();
      })
      .then((data) => {
        setUser(data);
        setLoading(false);
      })
      .catch(() => {});
  }, []);

  async function handleDownload() {
    setError(null);
    const res = await fetch("/api/download", { headers: getAuthHeaders() });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Não foi possível baixar o instalador");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Arauto-Setup.exe";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function handleLogout() {
    document.cookie = "auth-token=; path=/; max-age=0";
    window.location.href = "/";
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <p className="pulse" style={{ color: "var(--text-secondary)" }}>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card glass-card" style={{ maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 64, height: 64, margin: "0 auto 16px",
              background: "linear-gradient(135deg, var(--primary), var(--secondary))",
              borderRadius: "var(--radius-lg)", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.8rem", boxShadow: "0 8px 30px rgba(108,58,237,0.3)",
            }}
          >
            📥
          </div>
          <h1 className="login-title">Baixar o aplicativo</h1>
          <p className="login-subtitle">Olá, {user?.name}! Seu acesso está aprovado.</p>
        </div>

        {error && (
          <div style={{ padding: "12px 16px", borderRadius: "var(--radius-md)", marginBottom: 16, fontSize: "0.875rem", background: "rgba(239,68,68,0.12)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.3)" }}>
            {error}
          </div>
        )}

        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginBottom: 20, textAlign: "center" }}>
          Instale no computador que ficará ligado ao projetor ou à TV. Depois de instalado, o app funciona
          totalmente offline — os dados ficam salvos no próprio computador.
        </p>

        <button className="btn btn-primary btn-lg w-full" onClick={handleDownload}>
          ⬇ Baixar para Windows
        </button>

        <button className="sidebar-link" style={{ width: "100%", justifyContent: "center", marginTop: 16, color: "var(--danger)" }} onClick={handleLogout}>
          Sair
        </button>
      </div>
    </div>
  );
}
