import { NextResponse } from "next/server";
import { readPettyCash } from "../../_spring";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ requestKey: string }> }) {
  const { requestKey } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(requestKey)) return NextResponse.json({ code: "INVALID_REQUEST", message: "A valid request UUID is required.", requestId: crypto.randomUUID() }, { status: 400, headers: { "Cache-Control": "no-store" } });
  return readPettyCash(`requests/${requestKey}`);
}
