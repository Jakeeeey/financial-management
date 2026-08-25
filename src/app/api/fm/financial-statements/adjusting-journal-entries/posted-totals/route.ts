import { NextRequest } from "next/server";
import { buildSpringPostedTotalsPath, proxySpring } from "../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxySpring(buildSpringPostedTotalsPath(), {
    method: "POST",
    body,
  });
}
