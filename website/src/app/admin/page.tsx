"use client";

import { useState, useEffect, useCallback } from "react";

interface UserInfo {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface AccessRequest {
  id: number;
  email: string;
  churchName: string;
  message: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

function getAuthHeaders(): HeadersInit {
  const match = document.cookie.match(/auth-token=([^;]+)/);
  const token = match ? match[1] : "";
  return { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
}

export default function AdminPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function showToast(type: "success" | "error", text: string) {
    setToast({ type, text });
    setTimeout(() => setToast(null), 5000);
  }

  const fetchRequests = useCallback(() => {
    fetch("/api/admin/requests", { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then(setRequests)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { headers: getAuthHeaders() })
      .then((r) => {
        if (!r.ok) throw new Error("not authenticated");
        return r.json();
      })
      .then((data) => {
        if (data.role !== "SUPERADMIN") {
          window.location.href = "/download";
          return;
        }
        setUser(data);
        setLoading(false);
        fetchRequests();
      })
      .catch(() => {
        window.location.href = "/";
      });
  }, [fetchRequests]);

  async function handleAction(requestId: number, action: "approve" | "reject") {
    const res = await fetch("/api/admin/requests", {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ requestId, action }),
    });
    const data = await res.json();
    if (res.ok) {
      showToast("success", data.message);
      if (data.tempPassword) {
        alert(`Senha temporária gerada: ${data.tempPassword}\n\n(Também é enviada por e‑mail se o SMTP estiver configurado)`);
      }
      fetchRequests();
    } else {
      showToast("error", data.error || "Erro ao processar pedido");
    }
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

  const pending = requests.filter((r) => r.status === "PENDING");
  const resolved = requests.filter((r) => r.status !== "PENDING");

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 40 }}>
      <div className="topbar">
        <div>
          <h1>🔑 Pedidos de Acesso</h1>
          <p style={{ color: "var(--text-secondary)" }}>Logado como {user?.email}</p>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout}>Sair</button>
      </div>

      <h3 style={{ marginBottom: 16 }}>Pendentes ({pending.length})</h3>
      {pending.length === 0 ? (
        <div className="empty-state glass-card mb-lg">
          <div className="icon">📬</div>
          <p>Nenhum pedido pendente</p>
        </div>
      ) : (
        <div className="table-wrapper glass-card mb-lg">
          <table>
            <thead>
              <tr>
                <th>Igreja</th>
                <th>E‑mail</th>
                <th>Mensagem</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pending.map((r) => (
                <tr key={r.id}>
                  <td>{r.churchName}</td>
                  <td>{r.email}</td>
                  <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis" }}>{r.message || "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button className="btn btn-success btn-sm" onClick={() => handleAction(r.id, "approve")}>✅ Aprovar</button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleAction(r.id, "reject")}>❌ Rejeitar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 style={{ marginBottom: 16 }}>Histórico</h3>
      {resolved.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Nenhum pedido resolvido ainda</p>
      ) : (
        <div className="table-wrapper glass-card">
          <table>
            <thead>
              <tr>
                <th>Igreja</th>
                <th>E‑mail</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {resolved.map((r) => (
                <tr key={r.id}>
                  <td>{r.churchName}</td>
                  <td>{r.email}</td>
                  <td>
                    <span className={`badge badge-${r.status === "APPROVED" ? "approved" : "rejected"}`}>
                      {r.status === "APPROVED" ? "Aprovado" : "Rejeitado"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.text}</div>}
    </div>
  );
}
