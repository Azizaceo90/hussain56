import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { RESOURCES, coerceDates, type ResourceName } from "@/lib/resources";
import { notify, notifyAdmins } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Generic create: POST /api/[resource]
export async function POST(
  req: Request,
  { params }: { params: { resource: string } }
) {
  const ctx = await getSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const name = params.resource as ResourceName;
  const def = RESOURCES[name];
  if (!def || !def.create)
    return NextResponse.json({ error: "Unknown resource" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const policy = def.create(ctx, body);
  if (!policy.ok)
    return NextResponse.json({ error: policy.error }, { status: policy.status ?? 400 });

  const created = await def.model.create({ data: coerceDates(def, policy.data) });

  // Side-effect notifications for "money" events.
  if (name === "expenses") {
    await notifyAdmins({
      type: "expense",
      title: "New expense submitted",
      body: `${ctx.user.name} submitted ${created.category ?? "an expense"} for $${created.amount.toFixed(2)}`,
      link: "/payroll",
      exceptUserId: ctx.user.id,
    });
  }
  if (name === "payroll") {
    await notify({
      userId: created.userId,
      type: "payroll",
      title: "Payroll entry created",
      body: `A payroll entry for $${created.gross.toFixed(2)} is pending.`,
      link: "/payroll",
    });
  }

  return NextResponse.json({ item: created }, { status: 201 });
}
