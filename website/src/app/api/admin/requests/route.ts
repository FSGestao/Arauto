import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserFromRequest } from "@/lib/auth";
import { getCollection, updateCollection } from "@/lib/store";
import { sendEmail } from "@/lib/email";
import type { AccessRequest, User } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET — listar pedidos de acesso (somente SUPERADMIN)
export async function GET(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user || user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const col = await getCollection<AccessRequest>("access-requests");
  const requests = [...col.items].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return NextResponse.json(requests);
}

// POST — aprovar ou rejeitar pedido
export async function POST(req: NextRequest) {
  const user = getUserFromRequest(req);
  if (!user || user.role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { requestId, action } = await req.json();
  if (!requestId || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const requestCol = await getCollection<AccessRequest>("access-requests");
  const target = requestCol.items.find((r) => r.id === requestId);
  if (!target) {
    return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  }
  if (target.status !== "PENDING") {
    return NextResponse.json({ error: "Pedido já foi processado" }, { status: 400 });
  }

  if (action === "reject") {
    await updateCollection<AccessRequest, void>("access-requests", (c) => {
      const r = c.items.find((r) => r.id === requestId);
      if (r) {
        r.status = "REJECTED";
        r.updatedAt = new Date().toISOString();
      }
    });

    await sendEmail(
      target.email,
      "Solicitação de acesso — Arauto",
      `<p>Olá,</p><p>Infelizmente sua solicitação de acesso para <strong>${target.churchName}</strong> não foi aprovada neste momento.</p><p>Se tiver dúvidas, entre em contato conosco.</p>`
    );

    return NextResponse.json({ message: "Pedido rejeitado" });
  }

  // Aprovar: criar usuário com senha temporária
  const tempPassword = Math.random().toString(36).slice(-8) + "A1!";
  const hashedPassword = await bcrypt.hash(tempPassword, 10);

  await updateCollection<User, void>("users", (c) => {
    c.items.push({
      id: c.nextId++,
      email: target.email,
      passwordHash: hashedPassword,
      name: target.churchName,
      role: "USER",
      createdAt: new Date().toISOString(),
    });
  });

  await updateCollection<AccessRequest, void>("access-requests", (c) => {
    const r = c.items.find((r) => r.id === requestId);
    if (r) {
      r.status = "APPROVED";
      r.updatedAt = new Date().toISOString();
    }
  });

  await sendEmail(
    target.email,
    "🎉 Acesso aprovado — Arauto",
    `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #6C3AED;">Bem-vindo ao Arauto!</h2>
      <p>Seu acesso para <strong>${target.churchName}</strong> foi aprovado!</p>
      <div style="background: #f4f0ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p><strong>E‑mail:</strong> ${target.email}</p>
        <p><strong>Senha temporária:</strong> ${tempPassword}</p>
      </div>
      <p>Faça login no site para baixar o instalador do aplicativo.</p>
      <p style="color: #666; font-size: 0.85rem;">Equipe Arauto</p>
    </div>
    `
  );

  return NextResponse.json({
    message: "Pedido aprovado! Credenciais enviadas por e‑mail.",
    tempPassword, // exibido também na tela, útil quando o SMTP não está configurado
  });
}
