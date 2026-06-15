import { NextRequest } from "next/server";
import { buildSpringSummaryPath, proxySpring } from "../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxySpring(buildSpringSummaryPath(request.nextUrl.searchParams), {
    method: "GET",
  });
}
