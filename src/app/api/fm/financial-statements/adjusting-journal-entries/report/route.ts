import { NextRequest } from "next/server";
import { proxySpring } from "../_spring";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("format") === "pdf") {
    return (await import("../_print")).ajePdfResponse({ query: request.nextUrl.searchParams });
  }
  return proxySpring("/api/financial-statements/adjusting-journal-entries/report?" + request.nextUrl.searchParams.toString());
}

