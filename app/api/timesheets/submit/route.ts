import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notify";
import { weekStart, weekEnd } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Employee submits a week (Mon–Sun). Stamps submittedAt on that week's entries
// and notifies admins.
export async function POST(req: Request) {
  const ctx = await getSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { weekOf } = await req.json().catch(() => ({}));
  if (!weekOf) return NextResponse.json({ error: "weekOf required" }, { status: 400 });

  const start = weekStart(new Date(weekOf));
  const end = weekEnd(new Date(weekOf));

  const now = new Date();
  const result = await prisma.timeEntry.updateMany({
    where: {
      userId: ctx.user.id,
      clockIn: { gte: start, lte: end },
      clockOut: { not: null },
    },
    data: { submittedAt: now },
  });

  if (result.count === 0)
    return NextResponse.json(
      { error: "No completed entries to submit for that week" },
      { status: 400 }
    );

  await notifyAdmins({
    type: "timesheet",
    title: "Timesheet submitted",
    body: `${ctx.user.name} submitted their timesheet for the week of ${start
      .toISOString()
      .slice(0, 10)} (${result.count} entries).`,
    link: "/time",
    exceptUserId: ctx.user.id,
  });

  return NextResponse.json({ ok: true, count: result.count, submittedAt: now });
}
