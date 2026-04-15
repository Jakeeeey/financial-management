import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTrialBalanceDrillDown } from "@/modules/financial-management/financial-statements/trial-balance/services/trial-balance.service";

/**
 * Proxy API route for the Trial Balance drill-down endpoint.
 * Fetches detailed transaction lines for a specific GL account.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const glCode = searchParams.get("glCode");
  const startDate = searchParams.get("startDate") || "2025-01-01";
  const endDate = searchParams.get("endDate") || "2025-12-30";

  if (!glCode) {
    return NextResponse.json(
      { error: "glCode is required" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;

  try {
    const data = await getTrialBalanceDrillDown(
      { glCode, startDate, endDate },
      token
    );
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("API Route Error (Trial Balance Drill-Down):", message);
    return NextResponse.json(
      { error: "Failed to fetch drill-down data", details: message },
      { status: 500 }
    );
  }
}
