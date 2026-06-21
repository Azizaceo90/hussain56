import { NextResponse } from "next/server";
import { adzunaConfigured, syncJobs } from "@/lib/adzuna";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Daily cron (Hobby-safe: "0 12 * * *"). Refreshes the job board from Adzuna.
// Vercel sets the Authorization header to `Bearer ${CRON_SECRET}` when
// CRON_SECRET is configured; we verify it when present.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let jobs: any = { configured: false };
  if (adzunaConfigured()) {
    try {
      jobs = await syncJobs({ target: 1000, maxDaysOld: 30 });
    } catch (e: any) {
      jobs = { configured: true, error: e?.message || "sync failed" };
    }
  }

  return NextResponse.json({ ok: true, ranAt: new Date().toISOString(), jobs });
}
