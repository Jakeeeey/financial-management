import { NextResponse } from "next/server";

import { listFindings } from "@/modules/financial-management/treasury/bank-management-v2/bank-masterlist-audit-logs/services/masterlist.service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listFindings();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("[bank-management-v2] masterlist arf findings failed", error);
    return NextResponse.json({ success: false, error: "Failed to load ARF findings" }, { status: 500 });
  }
}
