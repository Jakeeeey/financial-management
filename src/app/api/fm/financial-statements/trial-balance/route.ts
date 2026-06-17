import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTrialBalance } from "@/modules/financial-management/financial-statements/trial-balance/services/trial-balance.service";

/**
 * Proxy API route for the Trial Balance external endpoint.
 * Secures the external API by injecting the VOS access token from cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const startDate = searchParams.get("startDate") || "2025-01-01";
  const endDate = searchParams.get("endDate") || "2025-12-30";
  const status = searchParams.get("status") || undefined;
  const accountCategory = searchParams.get("accountCategory") || undefined;
  const reviewFlag = searchParams.get("reviewFlag") || undefined;
  const search = searchParams.get("search") || undefined;
  const divisionName = searchParams.get("divisionName") || undefined;
  const departmentName = searchParams.get("departmentName") || undefined;
  const postedOnly = searchParams.get("postedOnly") === "true";

  // sourceModule can appear multiple times in the query string
  const sourceModule = searchParams.getAll("sourceModule").filter(Boolean);

  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;

  try {
    const data = await getTrialBalance(
      {
        startDate,
        endDate,
        status,
        accountCategory,
        reviewFlag,
        sourceModule,
        search,
        divisionName,
        departmentName,
        postedOnly,
      },
      token
    );
    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("API Route Error (Trial Balance):", message);
    return NextResponse.json(
      { error: "Failed to fetch trial balance data", details: message },
      { status: 500 }
    );
  }
}
