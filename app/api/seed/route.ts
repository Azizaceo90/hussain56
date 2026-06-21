import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

// One-time first-admin bootstrap. Only works when there are NO users yet, so it
// can't be used to create extra admins later. Call it once after first deploy.
// Body: { name, email, password }
export async function POST(req: Request) {
  const count = await prisma.user.count();
  if (count > 0)
    return NextResponse.json(
      { error: "Already initialized" },
      { status: 409 }
    );

  const { name, email, password } = await req.json().catch(() => ({}));
  if (!name || !email || !password)
    return NextResponse.json(
      { error: "name, email, password required" },
      { status: 400 }
    );
  if (String(password).length < 6)
    return NextResponse.json({ error: "Password too short" }, { status: 400 });

  const admin = await prisma.user.create({
    data: {
      name,
      email: String(email).toLowerCase().trim(),
      role: "admin",
      passwordHash: await hashPassword(password),
      avatarColor: "#2563eb",
    },
  });

  return NextResponse.json({ ok: true, id: admin.id });
}
