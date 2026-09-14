import { NextRequest, NextResponse } from "next/server";
import { getCollection, updateCollection } from "@/lib/store";
import { sendEmail } from "@/lib/email";
import type { AccessRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, churchName, message } = await req.json();

    if (!email || !churchName) {
      return NextResponse.json(
        { error: "E‑mail e nome da igreja são obrigatórios" },
        { status: 400 }
      );
    }

    const col = await getCollection<AccessRequest>("access-requests");
    const existing = col.items.find((r) => r.email === email && r.status === "PENDING");
    if (existing) {
      return NextResponse.json(
        { error: "Já existe uma solicitação pendente para este e‑mail" },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const request = await updateCollection<AccessRequest, AccessRequest>(
      "access-requests",
      (c) => {
        const created: AccessRequest = {
          id: c.nextId++,
          email,
          churchName,
          message: message || null,
          status: "PENDING",
          createdAt: now,
          updatedAt: now,
        };
        c.items.push(created);
        return created;
      }
    );

    const adminEmail = process.env.ADMIN_NOTIFY_EMAIL;
    if (adminEmail) {
      await sendEmail(
        adminEmail,
        `Nova solicitação de acesso: ${churchName}`,
        `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #6C3AED;">Nova Solicitação de Acesso</h2>
          <p><strong>Igreja:</strong> ${churchName}</p>
          <p><strong>E‑mail:</strong> ${email}</p>
          ${message ? `<p><strong>Mensagem:</strong> ${message}</p>` : ""}
          <p><strong>ID do pedido:</strong> #${request.id}</p>
          <hr />
          <p style="color: #666;">Acesse o painel de administração para aprovar ou rejeitar.</p>
        </div>
        `
      );
    }

    return NextResponse.json({
      message: "Solicitação enviada com sucesso!",
      requestId: request.id,
    });
  } catch (error) {
    console.error("Request access error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
