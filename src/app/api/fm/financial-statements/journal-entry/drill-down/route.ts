import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getJournalEntryDrillDown } from "@/modules/financial-management/financial-statements/journal-entry/services/journal-entry.service";

/**
 * Proxy API route to the external drill-down API.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const jeNo = searchParams.get("jeNo");
  
  if (!jeNo) {
    return NextResponse.json({ error: "jeNo is required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;

  try {
    const data = await getJournalEntryDrillDown(jeNo, token);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("API Route Error (Journal Entry Drill Down):", error);
    return NextResponse.json(
      { error: "Failed to fetch journal entry drill down", details: error.message },
      { status: 500 }
    );
  }
}
