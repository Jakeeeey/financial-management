import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBalanceSheetDrillDown } from "@/modules/financial-management/financial-statements/statement-of-financial-position/services/balance-sheet.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const rawCoaId = searchParams.get("coaId");
  const coaId = rawCoaId === null ? NaN : Number(rawCoaId);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const status = searchParams.get("status") || undefined;
  const divisionName = searchParams.get("divisionName") || undefined;
  const departmentName = searchParams.get("departmentName") || undefined;

  if (!Number.isInteger(coaId) || !startDate || !endDate) {
    return NextResponse.json(
      { error: "coaId, startDate, and endDate are required" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;

  try {
    const data = await getBalanceSheetDrillDown(
      {
        coaId,
        startDate,
        endDate,
        status,
        divisionName,
        departmentName,
      },
      token
    );
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("API Route Error (Balance Sheet Drill-Down):", message);
    return NextResponse.json(
      { error: "Failed to fetch drill-down data", details: message },
      { status: 500 }
    );
  }
}
