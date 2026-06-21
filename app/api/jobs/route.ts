import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { adzunaConfigured } from "@/lib/adzuna";

export const dynamic = "force-dynamic";

// List stored job listings with optional text search + pagination.
// GET /api/jobs?q=...&page=1&remote=1
export async function GET(req: Request) {
  const ctx = await getSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() || "";
  const remoteOnly = url.searchParams.get("remote") === "1";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const pageSize = 24;

  const where: any = {};
  if (remoteOnly) where.remote = true;
  if (q) {
    // Match each word separately (AND across words, OR across fields) so a
    // multi-word query like "medical coding remote" matches listings that
    // contain those words anywhere — not as one literal phrase.
    const terms = q.split(/\s+/).filter(Boolean).slice(0, 6);
    where.AND = terms.map((t) => ({
      OR: [
        { title: { contains: t, mode: "insensitive" } },
        { company: { contains: t, mode: "insensitive" } },
        { location: { contains: t, mode: "insensitive" } },
        { description: { contains: t, mode: "insensitive" } },
      ],
    }));
  }

  const [items, total] = await Promise.all([
    prisma.jobListing.findMany({
      where,
      orderBy: [{ postedAt: "desc" }, { fetchedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.jobListing.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    pageSize,
    pages: Math.ceil(total / pageSize),
    configured: adzunaConfigured(),
  });
}
