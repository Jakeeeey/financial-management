import { NextRequest, NextResponse } from "next/server";
import { requireSessionUserId } from "../../_payables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  if (!(await requireSessionUserId(request))) {
    return NextResponse.json({ message: "Authentication is required." }, { status: 401 });
  }
  return NextResponse.json({ message: "Dispatch budget allocations are read-only in Logistics WER. Use the approved financial adjustment process." }, { status: 403 });
}
