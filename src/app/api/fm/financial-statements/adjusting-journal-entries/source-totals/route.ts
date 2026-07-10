import { NextRequest } from "next/server";
import { buildSpringSourceTotalsPath, proxySpring } from "../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const body = await request.text();
  return proxySpring(buildSpringSourceTotalsPath(), {
    method: "POST",
    body,
  });
}
