import { NextRequest, NextResponse } from "next/server";
import { proxySpring } from "../../adjusting-journal-entries/_spring";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const jeNo = request.nextUrl.searchParams.get("jeNo");
  if (!jeNo || jeNo.length > 255) return NextResponse.json({ message: "A valid journal number is required." }, { status: 400 });
  return proxySpring(`/api/journal-entry/drill-down?${new URLSearchParams({ jeNo })}`);
}
