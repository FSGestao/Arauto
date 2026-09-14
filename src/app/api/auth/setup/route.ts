import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCollection, updateCollection } from "@/lib/store";
import { signToken } from "@/lib/auth";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

// GET — indica se já existe alguma conta local cadastrada
export async function GET() {
  const col = await getCollection<User>("users");
  return NextResponse.json({ hasUsers: col.items.length > 0 });
}

// POST — cria a primeira conta local de administração (só funciona uma vez)
export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json();

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Nome, e‑mail e senha são obrigatórios" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "A senha deve ter ao menos 6 caracteres" },
      { status: 400 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const result = await updateCollection<User, { ok: boolean; user?: User }>(
    "users",
    (col) => {
      if (col.items.length > 0) return { ok: false };
      const user: User = {
        id: col.nextId++,
        email,
        passwordHash,
        name,
        role: "ADMIN",
        createdAt: new Date().toISOString(),
      };
      col.items.push(user);
      return { ok: true, user };
    }
  );

  if (!result.ok || !result.user) {
    return NextResponse.json(
      { error: "Já existe uma conta local configurada neste computador" },
      { status: 409 }
    );
  }

  const token = signToken({
    userId: result.user.id,
    email: result.user.email,
    role: result.user.role,
  });

  return NextResponse.json({
    token,
    user: {
      id: result.user.id,
      name: result.user.name,
      email: result.user.email,
      role: result.user.role,
    },
  });
}
