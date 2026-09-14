import fs from "fs";
import path from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { NextRequest } from "next/server";
import { getCollection, updateCollection } from "@/lib/store";
import type { User } from "@/lib/types";

export interface JWTPayload {
  userId: number;
  email: string;
  role: string;
}

let cachedSecret: string | null = null;

/**
 * Segredo dos tokens JWT. Se JWT_SECRET não estiver definido, gera um
 * segredo aleatório e persiste em data/secret.key para sobreviver a
 * reinícios do servidor.
 */
function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  if (process.env.JWT_SECRET) {
    cachedSecret = process.env.JWT_SECRET;
    return cachedSecret;
  }
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, "secret.key");
  if (fs.existsSync(fp)) {
    cachedSecret = fs.readFileSync(fp, "utf-8").trim();
    return cachedSecret;
  }
  const secret = crypto.randomBytes(48).toString("hex");
  fs.writeFileSync(fp, secret, "utf-8");
  cachedSecret = secret;
  return cachedSecret;
}

export function signToken(payload: JWTPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: "30d" });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, getSecret()) as JWTPayload;
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  const cookie = req.cookies.get("auth-token");
  return cookie?.value || null;
}

export function getUserFromRequest(req: NextRequest): JWTPayload | null {
  const token = getTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Garante que existe uma conta SUPERADMIN. Se ainda não houver nenhuma e as
 * variáveis SUPERADMIN_EMAIL/SUPERADMIN_PASSWORD estiverem definidas, cria a
 * conta automaticamente — evita a necessidade de um script de seed manual.
 */
export async function ensureSuperAdmin(): Promise<void> {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email || !password) return;

  const col = await getCollection<User>("users");
  const hasSuperAdmin = col.items.some((u) => u.role === "SUPERADMIN");
  if (hasSuperAdmin) return;

  const passwordHash = await bcrypt.hash(password, 10);
  await updateCollection<User, void>("users", (c) => {
    if (c.items.some((u) => u.role === "SUPERADMIN")) return;
    c.items.push({
      id: c.nextId++,
      email,
      passwordHash,
      name: "Super Admin",
      role: "SUPERADMIN",
      createdAt: new Date().toISOString(),
    });
  });
}
