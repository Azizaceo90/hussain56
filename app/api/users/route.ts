import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword, randomPassword } from "@/lib/auth";
import { sendEmail, emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#059669", "#d97706", "#0891b2"];

// Admin: invite an employee. Generates a temporary password, emails it (or
// returns it when email is unconfigured so the admin can share it manually).
export async function POST(req: Request) {
  const ctx = await getSession();
  if (!ctx || ctx.actor.role !== "admin")
    return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = String(body.email || "").toLowerCase().trim();
  const name = String(body.name || "").trim();
  if (!email || !name)
    return NextResponse.json({ error: "Name and email required" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing)
    return NextResponse.json({ error: "A user with that email exists" }, { status: 409 });

  const tempPassword = randomPassword();
  const user = await prisma.user.create({
    data: {
      name,
      email,
      role: body.role === "admin" ? "admin" : "employee",
      title: body.title || null,
      payRate: body.payRate != null ? Number(body.payRate) : null,
      passwordHash: await hashPassword(tempPassword),
      avatarColor: COLORS[Math.floor(Math.random() * COLORS.length)],
    },
  });

  const origin = process.env.APP_URL || new URL(req.url).origin;
  const { sent } = await sendEmail({
    to: email,
    subject: "Your Ops Hub account",
    text: `Hi ${name},\n\nAn account was created for you on Ops Hub.\n\nLogin: ${origin}\nEmail: ${email}\nTemporary password: ${tempPassword}\n\nPlease sign in and update your account details.`,
  });

  const { passwordHash, ...safe } = user;
  return NextResponse.json({
    item: safe,
    // Surface the temp password only when email couldn't be sent.
    tempPassword: sent && emailConfigured() ? undefined : tempPassword,
    emailSent: sent,
  });
}
