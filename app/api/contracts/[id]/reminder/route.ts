import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Admin: send a reminder for a pending contract. Emails the assignee, records
// remindedAt, and creates an in-app notification.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSession();
  if (!ctx || ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const contract = await prisma.contract.findUnique({ where: { id: params.id } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (contract.status !== "pending")
    return NextResponse.json({ error: "Contract is not pending" }, { status: 400 });
  if (!contract.assignedToId)
    return NextResponse.json({ error: "No assignee" }, { status: 400 });

  const assignee = await prisma.user.findUnique({
    where: { id: contract.assignedToId },
  });
  if (!assignee) return NextResponse.json({ error: "Assignee not found" }, { status: 404 });

  const origin = process.env.APP_URL || new URL(req.url).origin;
  await sendEmail({
    to: assignee.email,
    subject: `Reminder: please sign "${contract.title}"`,
    text: `Hi ${assignee.name},\n\nThis is a reminder to sign "${contract.title}".\nSign here: ${origin}/contracts`,
  });

  await notify({
    userId: assignee.id,
    type: "contract",
    title: "Reminder: contract awaiting signature",
    body: `Please sign "${contract.title}".`,
    link: "/contracts",
  });

  const updated = await prisma.contract.update({
    where: { id: params.id },
    data: { remindedAt: new Date() },
  });

  return NextResponse.json({ item: updated });
}
