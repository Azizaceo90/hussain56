import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { adzunaConfigured } from "@/lib/adzuna";

export const dynamic = "force-dynamic";

// Admin diagnostic: DB count + sample, and a single live Adzuna probe so we can
// see exactly what the API returns (status / count / error).
export async function GET() {
  const ctx = await getSession();
  if (!ctx || ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const count = await prisma.jobListing.count();
  const sample = await prisma.jobListing.findMany({
    take: 8,
    orderBy: { fetchedAt: "desc" },
    select: { title: true, company: true, location: true, remote: true },
  });

  // Live probe: one simple search so we can read Adzuna's real response.
  let probe: any = { configured: adzunaConfigured() };
  if (adzunaConfigured()) {
    const params = new URLSearchParams({
      app_id: process.env.ADZUNA_APP_ID!,
      app_key: process.env.ADZUNA_APP_KEY!,
      results_per_page: "5",
      what: "payroll",
      "content-type": "application/json",
    });
    const url = `https://api.adzuna.com/v1/api/jobs/us/search/1?${params.toString()}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const text = await res.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* non-JSON error body */
      }
      probe = {
        configured: true,
        httpStatus: res.status,
        ok: res.ok,
        resultCount: json?.count ?? null,
        returned: Array.isArray(json?.results) ? json.results.length : 0,
        firstTitle: json?.results?.[0]?.title ?? null,
        errorBody: res.ok ? undefined : text.slice(0, 300),
      };
    } catch (e: any) {
      probe = { configured: true, fetchError: String(e?.message || e) };
    }
  }

  return NextResponse.json({ dbCount: count, sample, probe });
}
