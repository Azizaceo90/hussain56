import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Daily cron (Hobby-safe: "0 12 * * *"). Placeholder for optional mail/calendar
// sync. Vercel sets the Authorization header to `Bearer ${CRON_SECRET}` when
// CRON_SECRET is configured; we verify it when present.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // No-op for now. Future: sync job-application emails, send pending reminders.
  return NextResponse.json({ ok: true, ranAt: new Date().toISOString() });
}
