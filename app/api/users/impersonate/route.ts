import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, setSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Admin: start/stop impersonating an employee. Re-issues the session cookie
// with the actor id unchanged and the acting-as id set (or cleared).
export async function POST(req: Request) {
  const ctx = await getSession();
  if (!ctx || ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { userId } = await req.json().catch(() => ({}));

  if (!userId) {
    // Stop impersonating.
    setSession(ctx.actor.id);
    return NextResponse.json({ ok: true, impersonating: false });
  }

  const subject = await prisma.user.findUnique({ where: { id: userId } });
  if (!subject) return NextResponse.json({ error: "User not found" }, { status: 404 });

  setSession(ctx.actor.id, subject.id);
  return NextResponse.json({ ok: true, impersonating: subject.id !== ctx.actor.id });
}
