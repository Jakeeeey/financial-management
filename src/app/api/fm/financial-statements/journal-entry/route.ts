import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getJournalEntries } from "@/modules/financial-management/financial-statements/journal-entry/services/journal-entry.service";

/**
 * Proxy API route to the external general ledger master database.
 * This route secures the external endpoint and provides a consistent interface for the client.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") || "2025-01-01";
  const endDate = searchParams.get("endDate") || "2025-12-30";

  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;

  try {
    const data = await getJournalEntries(startDate, endDate, token);
    return NextResponse.json(data);
  } catch (error: any) {
    console.error("API Route Error (Journal Entry):", error);
    return NextResponse.json(
      { error: "Failed to fetch journal entries from the master database", details: error.message },
      { status: 500 }
    );
  }
}
