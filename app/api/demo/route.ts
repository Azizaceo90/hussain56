import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { seedDemoData } from "@/lib/demo";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin: populate every section with realistic demo data. Pass { reset: true }
// to rebuild it from scratch.
export async function POST(req: Request) {
  const ctx = await getSession();
  if (!ctx || ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const result = await seedDemoData({ reset: !!body.reset });
  return NextResponse.json(result);
}
