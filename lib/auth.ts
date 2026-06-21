import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const COOKIE_NAME = "ops_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  return process.env.AUTH_SECRET || "dev-insecure-secret-change-me";
}

// ---- HMAC-signed token: base64url(payload).signature ----
type SessionPayload = {
  uid: string; // the real logged-in user
  act?: string; // admin acting-as (impersonation) subject user id
  iat: number;
};

function sign(data: string): string {
  return crypto.createHmac("sha256", secret()).update(data).digest("base64url");
}

function encodeToken(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decodeToken(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  // constant-time compare
  const expected = sign(body);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

// ---- password helpers ----
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export function randomPassword(len = 10): string {
  // human-friendly temporary password
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  const bytes = crypto.randomBytes(len);
  for (let i = 0; i < len; i++) out += chars[bytes[i] % chars.length];
  return out;
}

// ---- cookie session lifecycle ----
export function setSession(uid: string, actAs?: string) {
  const token = encodeToken({ uid, act: actAs, iat: Date.now() });
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function clearSession() {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

function readToken(): SessionPayload | null {
  return decodeToken(cookies().get(COOKIE_NAME)?.value);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  title: string | null;
};

export type SessionContext = {
  user: SessionUser; // the effective user (impersonated if acting-as)
  actor: SessionUser; // the real logged-in user
  impersonating: boolean;
};

// Returns the full session context, resolving impersonation.
export async function getSession(): Promise<SessionContext | null> {
  const payload = readToken();
  if (!payload) return null;

  const actor = await prisma.user.findUnique({ where: { id: payload.uid } });
  if (!actor) return null;

  let effective = actor;
  let impersonating = false;
  // Only admins can impersonate; ignore stale act tokens otherwise.
  if (payload.act && payload.act !== actor.id && actor.role === "admin") {
    const subject = await prisma.user.findUnique({ where: { id: payload.act } });
    if (subject) {
      effective = subject;
      impersonating = true;
    }
  }

  const shape = (u: typeof actor): SessionUser => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    title: u.title,
  });

  return {
    user: shape(effective),
    actor: shape(actor),
    impersonating,
  };
}

// Convenience: throws-style guard returning null when unauthenticated.
export async function requireSession(): Promise<SessionContext | null> {
  return getSession();
}

export function isAdmin(ctx: SessionContext | null): boolean {
  // Impersonation lowers the effective role to the subject; admin powers are
  // checked against the actor for safety-sensitive actions, but most read/UX
  // gating uses the effective user. We expose actor role for callers that care.
  return !!ctx && ctx.user.role === "admin";
}

export function actorIsAdmin(ctx: SessionContext | null): boolean {
  return !!ctx && ctx.actor.role === "admin";
}
