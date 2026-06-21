import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notifyAdmins } from "@/lib/notify";
import { stampPdf, type Stamp } from "@/lib/pdf";
import type { ContractField } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Employee signs: fill placed fields (or fallback form values) + a signature.
// Values are stamped into the PDF here, status -> signed.
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contract = await prisma.contract.findUnique({ where: { id: params.id } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the assignee (or an admin) may sign.
  if (contract.assignedToId !== ctx.user.id && ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (contract.status === "signed")
    return NextResponse.json({ error: "Already signed" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const signatureDataUrl: string | undefined = body.signatureDataUrl;
  const signerName: string = body.signerName || ctx.user.name;
  // values: map of fieldId -> string value entered by the signer.
  const values: Record<string, string> = body.values || {};

  if (!signatureDataUrl)
    return NextResponse.json({ error: "Signature required" }, { status: 400 });

  const fields: ContractField[] = Array.isArray(contract.fields)
    ? (contract.fields as any)
    : [];

  const stamps: Stamp[] = [];
  for (const f of fields) {
    if (f.type === "signature") {
      stamps.push({ kind: "image", ...box(f), dataUrl: signatureDataUrl });
    } else {
      const val = values[f.id] ?? defaultFor(f.type, signerName, ctx.user.email);
      if (val) stamps.push({ kind: "text", ...box(f), value: val });
    }
  }

  // Fallback: if no fields were placed, stamp signature at bottom of page 0.
  if (fields.length === 0) {
    stamps.push({
      kind: "image",
      page: 0,
      x: 0.1,
      y: 0.88,
      w: 0.3,
      h: 0.08,
      dataUrl: signatureDataUrl,
    });
  }

  const signedDataUrl = await stampPdf(contract.dataUrl, stamps);

  const updated = await prisma.contract.update({
    where: { id: params.id },
    data: {
      status: "signed",
      signedAt: new Date(),
      dataUrl: signedDataUrl,
      signatureDataUrl,
      signerName,
    },
  });

  await notifyAdmins({
    type: "contract",
    title: "Contract signed",
    body: `${signerName} signed "${contract.title}".`,
    link: "/contracts",
  });

  return NextResponse.json({ item: updated });
}

function box(f: ContractField) {
  return { page: f.page, x: f.x, y: f.y, w: f.w, h: f.h };
}

function defaultFor(type: string, name: string, email: string): string {
  if (type === "name") return name;
  if (type === "email") return email;
  if (type === "date") return new Date().toLocaleDateString("en-US");
  return "";
}
