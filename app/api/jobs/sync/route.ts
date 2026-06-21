import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { adzunaConfigured, syncJobs } from "@/lib/adzuna";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin: pull fresh medical-coding-remote roles from Adzuna and upsert them.
export async function POST(req: Request) {
  const ctx = await getSession();
  if (!ctx || ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  if (!adzunaConfigured())
    return NextResponse.json(
      { error: "Adzuna is not configured. Set ADZUNA_APP_ID and ADZUNA_APP_KEY." },
      { status: 400 }
    );

  const body = await req.json().catch(() => ({}));
  try {
    const result = await syncJobs({
      query: body.query,
      target: body.target ?? 1000,
      // Only "new" roles: posted within the last 30 days.
      maxDaysOld: body.maxDaysOld ?? 30,
    });
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Sync failed" }, { status: 502 });
  }
}
