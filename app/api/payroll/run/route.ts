import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Admin: bulk-create pending payroll entries for a period.
// Body: { periodStart, periodEnd, entries: [{ userId, userName, hours, rate }] }
export async function POST(req: Request) {
  const ctx = await getSession();
  if (!ctx || ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { periodStart, periodEnd } = body;
  const entries: any[] = Array.isArray(body.entries) ? body.entries : [];
  if (!periodStart || !periodEnd || entries.length === 0)
    return NextResponse.json({ error: "period and entries required" }, { status: 400 });

  const created = [];
  for (const e of entries) {
    const hours = Number(e.hours);
    const rate = Number(e.rate);
    if (!e.userId || !isFinite(hours) || !isFinite(rate)) continue;
    const gross = Math.round(hours * rate * 100) / 100;
    const entry = await prisma.payrollEntry.create({
      data: {
        userId: e.userId,
        userName: e.userName ?? null,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        hours,
        rate,
        gross,
        status: "pending",
      },
    });
    // Persist rate back to the user for future prefill.
    await prisma.user.update({ where: { id: e.userId }, data: { payRate: rate } });
    await notify({
      userId: e.userId,
      type: "payroll",
      title: "Payroll entry created",
      body: `A payroll entry for $${gross.toFixed(2)} is pending.`,
      link: "/payroll",
    });
    created.push(entry);
  }

  return NextResponse.json({ items: created, count: created.length }, { status: 201 });
}
