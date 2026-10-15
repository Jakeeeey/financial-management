import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.toString();
  return proxySpring(`/api/consignment/access/roles${query ? `?${query}` : ""}`);
}

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as { userId?: unknown; role?: unknown } | null;
  const roles = new Set(["CREATOR", "APPROVER", "CONTROLLER"]);
  if (!body || !Number.isInteger(body.userId) || !roles.has(String(body.role))) {
    return NextResponse.json({ message: "A valid userId and consignment role are required." }, { status: 400 });
  }

  return proxySpring(`/api/consignment/access/roles/${body.userId}`, {
    method: "PUT",
    body: JSON.stringify({ role: body.role }),
  });
}
