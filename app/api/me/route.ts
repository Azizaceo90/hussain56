import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSession();
  if (!ctx) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: ctx.user,
    actor: ctx.actor,
    impersonating: ctx.impersonating,
  });
}
