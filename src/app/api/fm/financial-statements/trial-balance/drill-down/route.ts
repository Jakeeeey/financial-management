import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTrialBalanceDrillDown } from "@/modules/financial-management/financial-statements/trial-balance/services/trial-balance.service";
import { getCurrentTrialBalanceMonth } from "@/modules/financial-management/financial-statements/trial-balance/utils/periods";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Proxy API route for the Trial Balance drill-down endpoint.
 * Fetches detailed transaction lines for a specific GL account.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const glCode = searchParams.get("glCode");
  const defaultRange = getCurrentTrialBalanceMonth();
  const startDate = searchParams.get("startDate") || defaultRange.startDate;
  const endDate = searchParams.get("endDate") || defaultRange.endDate;
  const postedOnly = searchParams.get("postedOnly") === "true";
  const status = searchParams.get("status") || undefined;
  const division = searchParams.get("division") || undefined;
  const department = searchParams.get("department") || undefined;
  const accountType = searchParams.get("accountType") || undefined;
  const sourceModule = searchParams.getAll("sourceModule");

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
      { glCode, startDate, endDate, status, postedOnly, division, department, accountType, sourceModule },
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
