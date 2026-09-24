import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { ManagedRole } from "@/lib/managedUsers";

const COOKIE_NAME = "leadflow_session";

export type SessionData = {
  username: string;
  displayName: string;
  role: ManagedRole;
  source: "master" | "managed";
  exp: number;
};

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not configured.");
  return value;
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSessionToken(
  session: Omit<SessionData, "exp">
) {
  const payload = Buffer.from(
    JSON.stringify({
      ...session,
      exp: Date.now() + 1000 * 60 * 60 * 12,
    })
  ).toString("base64url");

  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(token?: string | null): SessionData | null {
  try {
    if (!token) return null;
    const [payload, signature] = token.split(".");
    if (!payload || !signature) return null;

    const expected = sign(payload);
    if (signature.length !== expected.length) return null;

    const valid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected)
    );
    if (!valid) return null;

    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.username || !data?.exp || data.exp < Date.now()) return null;

    const isLegacyMaster =
      !data.role &&
      String(data.username) === String(process.env.ADMIN_USERNAME || "").trim();

    return {
      username: String(data.username),
      displayName: String(data.displayName || data.username),
      role:
        data.role === "admin" || isLegacyMaster
          ? "admin"
          : "user",
      source:
        data.source === "master" || isLegacyMaster
          ? "master"
          : "managed",
      exp: Number(data.exp),
    };
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  return verifySessionToken(store.get(COOKIE_NAME)?.value);
}

export async function requireApiAuth() {
  return getSession();
}

export async function requireAdminApiAuth() {
  const session = await getSession();
  return session?.role === "admin" ? session : null;
}

export const sessionCookie = {
  name: COOKIE_NAME,
  options: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  },
};
