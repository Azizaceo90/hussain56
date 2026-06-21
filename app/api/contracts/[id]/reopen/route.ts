import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

// Admin: re-open a signed contract — restore the original (pre-signature) PDF
// and set it back to pending.
export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSession();
  if (!ctx || ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const contract = await prisma.contract.findUnique({ where: { id: params.id } });
  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.contract.update({
    where: { id: params.id },
    data: {
      status: "pending",
      dataUrl: contract.originalDataUrl ?? contract.dataUrl,
      signedAt: null,
      signatureDataUrl: null,
      signerName: null,
    },
  });

  if (contract.assignedToId) {
    await notify({
      userId: contract.assignedToId,
      type: "contract",
      title: "Contract re-opened",
      body: `"${contract.title}" was re-opened and needs signing again.`,
      link: "/contracts",
    });
  }

  return NextResponse.json({ item: updated });
}
