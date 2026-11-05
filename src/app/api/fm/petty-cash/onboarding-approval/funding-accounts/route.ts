import { NextRequest } from "next/server";
import { readPettyCash } from "../../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return readPettyCash(`onboarding-approval/funding-accounts?${request.nextUrl.searchParams}`);
}
