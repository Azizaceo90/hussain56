import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { sendEmail } from "@/lib/email";
import { stampPdf, type Stamp } from "@/lib/pdf";
import type { ContractField } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin issues a contract: upload PDF, assign to an employee, optionally place
// fillable fields. The issuer's own saved-signature drops are stamped into the
// PDF NOW and removed from the employee's field set. Also optionally sets the
// assignee's pay rate.
export async function POST(req: Request) {
  const ctx = await getSession();
  if (!ctx || ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { title, assignedToId, fileName, dataUrl, payRate } = body;
  const fields: ContractField[] = Array.isArray(body.fields) ? body.fields : [];

  if (!title || !dataUrl)
    return NextResponse.json({ error: "Title and PDF required" }, { status: 400 });

  const assignee = assignedToId
    ? await prisma.user.findUnique({ where: { id: assignedToId } })
    : null;

  // Optionally persist the assignee's pay rate from the issue form.
  if (assignee && payRate != null && payRate !== "") {
    await prisma.user.update({
      where: { id: assignee.id },
      data: { payRate: Number(payRate) },
    });
  }

  // Stamp the issuer's own signature drops immediately, then drop them from the
  // employee-facing field set.
  const issuerStamps: Stamp[] = [];
  const employeeFields: ContractField[] = [];
  let issuerSignature: string | null = null;
  if (fields.some((f) => f.owner === "issuer" && f.type === "signature")) {
    const me = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    issuerSignature = me?.signature ?? null;
  }

  for (const f of fields) {
    if (f.owner === "issuer" && f.type === "signature" && issuerSignature) {
      issuerStamps.push({
        kind: "image",
        page: f.page,
        x: f.x,
        y: f.y,
        w: f.w,
        h: f.h,
        dataUrl: issuerSignature,
      });
    } else {
      employeeFields.push(f);
    }
  }

  let finalDataUrl = dataUrl;
  if (issuerStamps.length > 0) {
    finalDataUrl = await stampPdf(dataUrl, issuerStamps);
  }

  const contract = await prisma.contract.create({
    data: {
      title,
      assignedToId: assignee?.id ?? null,
      assignedToName: assignee?.name ?? null,
      status: "pending",
      fileName: fileName ?? null,
      dataUrl: finalDataUrl,
      originalDataUrl: finalDataUrl,
      fields: employeeFields as any,
    },
  });

  if (assignee) {
    await notify({
      userId: assignee.id,
      type: "contract",
      title: "New contract to sign",
      body: `"${title}" is awaiting your signature.`,
      link: "/contracts",
    });
    const origin = process.env.APP_URL || new URL(req.url).origin;
    await sendEmail({
      to: assignee.email,
      subject: `Contract to sign: ${title}`,
      text: `Hi ${assignee.name},\n\nA contract "${title}" is awaiting your signature.\nSign in to review and sign: ${origin}/contracts`,
    });
  }

  return NextResponse.json({ item: contract }, { status: 201 });
}
