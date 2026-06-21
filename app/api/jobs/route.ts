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
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
      { location: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
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
