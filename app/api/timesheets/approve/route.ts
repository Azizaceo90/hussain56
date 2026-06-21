import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { weekStart, weekEnd } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Admin approves a user's submitted week. Stamps approvedAt and notifies the
// employee.
export async function POST(req: Request) {
  const ctx = await getSession();
  if (!ctx || ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const { userId, weekOf } = await req.json().catch(() => ({}));
  if (!userId || !weekOf)
    return NextResponse.json({ error: "userId and weekOf required" }, { status: 400 });

  const start = weekStart(new Date(weekOf));
  const end = weekEnd(new Date(weekOf));
  const now = new Date();

  const result = await prisma.timeEntry.updateMany({
    where: {
      userId,
      clockIn: { gte: start, lte: end },
      submittedAt: { not: null },
    },
    data: { approvedAt: now },
  });

  if (result.count === 0)
    return NextResponse.json(
      { error: "No submitted entries to approve for that week" },
      { status: 400 }
    );

  await notify({
    userId,
    type: "timesheet",
    title: "Timesheet approved",
    body: `Your timesheet for the week of ${start.toISOString().slice(0, 10)} was approved.`,
    link: "/time",
  });

  return NextResponse.json({ ok: true, count: result.count, approvedAt: now });
}
