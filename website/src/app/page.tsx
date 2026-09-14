"use client";

import { useState } from "react";

type Mode = "login" | "request";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [churchName, setChurchName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      window.location.href = data.user?.role === "SUPERADMIN" ? "/admin" : "/download";
    } catch (err: unknown) {
      setFeedback({ type: "error", text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  async function handleRequestAccess(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/auth/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, churchName, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao enviar solicitação");
      setFeedback({
        type: "success",
        text: "Solicitação enviada! Você receberá um e‑mail quando o acesso for aprovado.",
      });
      setEmail("");
      setChurchName("");
      setMessage("");
    } catch (err: unknown) {
      setFeedback({ type: "error", text: (err as Error).message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
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
            {mode === "login" ? "Faça login para acessar o download do aplicativo" : "Solicite acesso gratuito para sua igreja"}
          </p>
        </div>

        <div className="tabs" style={{ marginBottom: 24 }}>
          <button className={`tab ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setFeedback(null); }}>
            Entrar
          </button>
          <button className={`tab ${mode === "request" ? "active" : ""}`} onClick={() => { setMode("request"); setFeedback(null); }}>
            Solicitar Acesso
          </button>
        </div>

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

        {mode === "login" && (
          <form className="login-form" onSubmit={handleLogin}>
            <div>
              <label className="input-label" htmlFor="login-email">E‑mail</label>
              <input id="login-email" className="input-field" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="input-label" htmlFor="login-password">Senha</label>
              <input id="login-password" className="input-field" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        )}

        {mode === "request" && (
          <form className="login-form" onSubmit={handleRequestAccess}>
            <div>
              <label className="input-label" htmlFor="req-church">Nome da Igreja</label>
              <input id="req-church" className="input-field" type="text" placeholder="Ex: Igreja Batista Central" value={churchName} onChange={(e) => setChurchName(e.target.value)} required />
            </div>
            <div>
              <label className="input-label" htmlFor="req-email">E‑mail de contato</label>
              <input id="req-email" className="input-field" type="email" placeholder="pastor@igreja.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="input-label" htmlFor="req-message">Mensagem (opcional)</label>
              <textarea id="req-message" className="input-field" placeholder="Conte um pouco sobre sua igreja..." value={message} onChange={(e) => setMessage(e.target.value)} style={{ minHeight: 80 }} />
            </div>
            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? "Enviando..." : "Solicitar Acesso Gratuito"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
