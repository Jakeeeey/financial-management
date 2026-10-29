import { NextRequest, NextResponse } from "next/server";
import { readConsignment } from "../../../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[1-9]\d*$/.test(id)) return NextResponse.json({ message: "Invalid agreement ID." }, { status: 400 });
  return readConsignment(`/api/consignment/agreements/${encodeURIComponent(id)}/reject`, { method: "POST", body: await request.text() });
}
