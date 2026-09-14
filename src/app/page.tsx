"use client";

import { useState, useEffect } from "react";

export default function LoginPage() {
  const [checking, setChecking] = useState(true);
  const [hasUsers, setHasUsers] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/setup")
      .then((r) => r.json())
      .then((data) => setHasUsers(!!data.hasUsers))
      .catch(() => setHasUsers(true))
      .finally(() => setChecking(false));
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao fazer login");
      document.cookie = `auth-token=${data.token}; path=/; max-age=${30 * 24 * 60 * 60}`;
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      setFeedback({ type: "error", text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleSetup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/auth/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar conta");
      document.cookie = `auth-token=${data.token}; path=/; max-age=${30 * 24 * 60 * 60}`;
      window.location.href = "/dashboard";
    } catch (err: unknown) {
      setFeedback({ type: "error", text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="login-page">
        <p className="pulse" style={{ color: "var(--text-secondary)" }}>
          Carregando...
        </p>
      </div>
    );
  }

  return (
    <div className="login-page">
      {/* Floating particles decoration */}
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              width: `${60 + i * 40}px`,
              height: `${60 + i * 40}px`,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${i % 2 === 0 ? "rgba(108,58,237,0.1)" : "rgba(236,72,153,0.08)"}, transparent)`,
              left: `${10 + i * 15}%`,
              top: `${15 + (i % 3) * 25}%`,
              animation: `float${i % 3} ${8 + i * 2}s ease-in-out infinite`,
            }}
          />
        ))}
        <style>{`
          @keyframes float0 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-30px)} }
          @keyframes float1 { 0%,100%{transform:translateY(0) translateX(0)} 50%{transform:translateY(-20px) translateX(15px)} }
          @keyframes float2 { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-40px)} }
        `}</style>
      </div>

      <div className="login-card glass-card">
        {/* Logo / Title */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            style={{
              width: 64,
              height: 64,
              margin: "0 auto 16px",
              background: "linear-gradient(135deg, var(--primary), var(--secondary))",
              borderRadius: "var(--radius-lg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.8rem",
              boxShadow: "0 8px 30px rgba(108,58,237,0.3)",
            }}
          >
            🎵
          </div>
          <h1 className="login-title">Arauto</h1>
          <p className="login-subtitle">
            {hasUsers ? "Faça login para acessar o painel" : "Crie a conta local de administração deste computador"}
          </p>
        </div>

        {/* Feedback */}
        {feedback && (
          <div
            style={{
              padding: "12px 16px",
              borderRadius: "var(--radius-md)",
              marginBottom: 16,
              fontSize: "0.875rem",
              fontWeight: 500,
              background: feedback.type === "success" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)",
              color: feedback.type === "success" ? "var(--success)" : "var(--danger)",
              border: `1px solid ${feedback.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
            }}
          >
            {feedback.text}
          </div>
        )}

        {hasUsers ? (
          <form className="login-form" onSubmit={handleLogin}>
            <div>
              <label className="input-label" htmlFor="login-email">
                E‑mail
              </label>
              <input
                id="login-email"
                className="input-field"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="input-label" htmlFor="login-password">
                Senha
              </label>
              <input
                id="login-password"
                className="input-field"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleSetup}>
            <div>
              <label className="input-label" htmlFor="setup-name">
                Seu nome
              </label>
              <input
                id="setup-name"
                className="input-field"
                type="text"
                placeholder="Ex: Pastor João"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="input-label" htmlFor="setup-email">
                E‑mail
              </label>
              <input
                id="setup-email"
                className="input-field"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="input-label" htmlFor="setup-password">
                Senha
              </label>
              <input
                id="setup-password"
                className="input-field"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? "Criando..." : "Criar conta e entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
