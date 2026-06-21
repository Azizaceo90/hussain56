import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Admin: edit a user (name/email/title/role/payRate/projects).
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSession();
  if (!ctx || ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  if (body.name !== undefined) data.name = String(body.name);
  if (body.email !== undefined) data.email = String(body.email).toLowerCase().trim();
  if (body.title !== undefined) data.title = body.title || null;
  if (body.role !== undefined)
    data.role = body.role === "admin" ? "admin" : "employee";
  if (body.payRate !== undefined)
    data.payRate = body.payRate === null || body.payRate === "" ? null : Number(body.payRate);
  if (body.projects !== undefined) data.projects = body.projects || null;

  try {
    const user = await prisma.user.update({ where: { id: params.id }, data });
    const { passwordHash, ...safe } = user;
    return NextResponse.json({ item: safe });
  } catch (e: any) {
    if (e?.code === "P2002")
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    return NextResponse.json({ error: "Update failed" }, { status: 400 });
  }
}

// Admin: delete a user.
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const ctx = await getSession();
  if (!ctx || ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  if (params.id === ctx.actor.id)
    return NextResponse.json({ error: "You can't delete yourself" }, { status: 400 });
  await prisma.user.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
