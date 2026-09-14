import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserFromRequest } from "@/lib/auth";
import { updateCollection } from "@/lib/store";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST — troca a senha da conta local logada
export async function POST(req: NextRequest) {
  const payload = getUserFromRequest(req);
  if (!payload) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { currentPassword, newPassword } = await req.json();
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return NextResponse.json(
      { error: "Informe a senha atual e uma nova senha com ao menos 6 caracteres" },
      { status: 400 }
    );
  }

  const result = await updateCollection<User, { ok: boolean; error?: string }>(
    "users",
    async (col) => {
      const user = col.items.find((u) => u.id === payload.userId);
      if (!user) return { ok: false, error: "Usuário não encontrado" };

      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) return { ok: false, error: "Senha atual incorreta" };

      user.passwordHash = await bcrypt.hash(newPassword, 10);
      return { ok: true };
    }
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ message: "Senha atualizada com sucesso" });
}
