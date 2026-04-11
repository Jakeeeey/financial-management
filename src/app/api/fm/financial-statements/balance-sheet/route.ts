import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBalanceSheet } from "@/modules/financial-management/financial-statements/statement-of-financial-position/services/balance-sheet.service";

/**
 * Proxy API route for the Balance Sheet external endpoint.
 * Secures the external API by injecting the VOS access token from cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const startDate = searchParams.get("startDate") || "2026-01-01";
  const endDate = searchParams.get("endDate") || "2026-12-31";
  const status = searchParams.get("status") || undefined;
  const includeComparison = searchParams.get("includeComparison") === "true";
  const divisionName = searchParams.get("divisionName") || undefined;
  const departmentName = searchParams.get("departmentName") || undefined;
  const comparisonStartDate = searchParams.get("comparisonStartDate") || undefined;
  const comparisonEndDate = searchParams.get("comparisonEndDate") || undefined;

  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;

  try {
    const data = await getBalanceSheet(
      {
        startDate,
        endDate,
        status,
        includeComparison,
        divisionName,
        departmentName,
        comparisonStartDate,
        comparisonEndDate,
      },
      token
    );
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("API Route Error (Balance Sheet):", message);
    return NextResponse.json(
      { error: "Failed to fetch balance sheet data", details: message },
      { status: 500 }
    );
  }
}
