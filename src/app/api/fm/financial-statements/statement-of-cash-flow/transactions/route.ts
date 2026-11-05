import { NextRequest, NextResponse } from "next/server";
import { proxySpring } from "../../adjusting-journal-entries/_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const journalEntryId = request.nextUrl.searchParams.get("journalEntryId")?.trim();
  const sourceModule = request.nextUrl.searchParams.get("sourceModule")?.trim();

  if (!journalEntryId || !sourceModule) {
    return NextResponse.json(
      { message: "Both journalEntryId and sourceModule are required." },
      { status: 400 },
    );
  }

  const query = new URLSearchParams({ journalEntryId, sourceModule });
  return proxySpring(`/api/view-fs-report-statement-cash-flow/transactions?${query.toString()}`);
}
