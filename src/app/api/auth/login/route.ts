import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getCollection } from "@/lib/store";
import { signToken } from "@/lib/auth";
import type { User } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "E‑mail e senha são obrigatórios" },
        { status: 400 }
      );
    }

    const col = await getCollection<User>("users");
    const user = col.items.find((u) => u.email === email);

    if (!user) {
      return NextResponse.json(
        { error: "E‑mail ou senha inválidos" },
        { status: 401 }
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "E‑mail ou senha inválidos" },
        { status: 401 }
      );
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
