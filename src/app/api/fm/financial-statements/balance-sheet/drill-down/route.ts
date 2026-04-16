import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getBalanceSheetDrillDown } from "@/modules/financial-management/financial-statements/statement-of-financial-position/services/balance-sheet.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const glCode = searchParams.get("glCode");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!glCode || !startDate || !endDate) {
    return NextResponse.json(
      { error: "glCode, startDate, and endDate are required" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;

  try {
    const data = await getBalanceSheetDrillDown(
      {
        glCode,
        startDate,
        endDate,
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
