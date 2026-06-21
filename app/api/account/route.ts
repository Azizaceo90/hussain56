import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const PROFILE_FIELDS = [
  "name",
  "fullLegalName",
  "dateOfBirth",
  "address",
  "phone",
  "emergencyName",
  "emergencyPhone",
  "emergencyRelation",
  "paymentMethod",
  "paymentAccount",
  "signature", // reusable saved e-signature PNG data URL
];

// Update the effective (possibly impersonated) user's own onboarding profile
// and saved signature. Optionally change password.
export async function PATCH(req: Request) {
  const ctx = await getSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: any = {};
  for (const f of PROFILE_FIELDS) {
    if (body[f] !== undefined) data[f] = body[f] === "" ? null : body[f];
  }

  // Password change requires the current password.
  if (body.newPassword) {
    const user = await prisma.user.findUnique({ where: { id: ctx.user.id } });
    const ok =
      !user?.passwordHash || (await verifyPassword(body.currentPassword || "", user.passwordHash));
    if (!ok)
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    if (String(body.newPassword).length < 6)
      return NextResponse.json({ error: "Password too short" }, { status: 400 });
    data.passwordHash = await hashPassword(body.newPassword);
  }

  const user = await prisma.user.update({ where: { id: ctx.user.id }, data });
  const { passwordHash, ...safe } = user;
  return NextResponse.json({ item: safe });
}
