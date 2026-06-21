import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { loadBootstrap } from "@/lib/bootstrap";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await getSession();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const data = await loadBootstrap(ctx);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
