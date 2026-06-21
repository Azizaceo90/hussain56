import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { RESOURCES, coerceDates, type ResourceName } from "@/lib/resources";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Generic update: PATCH /api/[resource]/[id]
export async function PATCH(
  req: Request,
  { params }: { params: { resource: string; id: string } }
) {
  const ctx = await getSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const name = params.resource as ResourceName;
  const def = RESOURCES[name];
  if (!def || !def.update)
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const existing = await def.model.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const policy = def.update(ctx, existing, body);
  if (!policy.ok)
    return NextResponse.json({ error: policy.error }, { status: policy.status ?? 400 });

  const updated = await def.model.update({
    where: { id: params.id },
    data: coerceDates(def, policy.data),
  });

  // Notify submitter when an admin changes their expense status.
  if (name === "expenses" && body.status && body.status !== existing.status) {
    await notify({
      userId: existing.userId,
      type: "expense",
      title: `Expense ${body.status}`,
      body: `Your ${existing.category ?? "expense"} for $${existing.amount.toFixed(2)} was marked ${body.status}.`,
      link: "/payroll",
    });
  }
  // Notify employee when their payroll entry is marked paid.
  if (name === "payroll" && body.status === "paid" && existing.status !== "paid") {
    await notify({
      userId: existing.userId,
      type: "payroll",
      title: "You've been paid",
      body: `Payroll of $${existing.gross.toFixed(2)} was marked paid.`,
      link: "/payroll",
    });
  }

  return NextResponse.json({ item: updated });
}

// Generic delete: DELETE /api/[resource]/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: { resource: string; id: string } }
) {
  const ctx = await getSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const name = params.resource as ResourceName;
  const def = RESOURCES[name];
  if (!def || !def.remove)
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const existing = await def.model.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const policy = def.remove(ctx, existing);
  if (!policy.ok)
    return NextResponse.json({ error: policy.error }, { status: policy.status ?? 400 });

  await def.model.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
