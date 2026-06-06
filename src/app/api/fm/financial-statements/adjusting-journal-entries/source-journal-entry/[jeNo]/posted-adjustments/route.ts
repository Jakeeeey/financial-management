import { NextRequest } from "next/server";
import { buildSpringPostedAdjustmentHistoryPath, proxySpring } from "../../../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jeNo: string }> },
) {
  const { jeNo } = await params;
  return proxySpring(buildSpringPostedAdjustmentHistoryPath(jeNo, request.nextUrl.searchParams), {
    method: "GET",
  });
}
