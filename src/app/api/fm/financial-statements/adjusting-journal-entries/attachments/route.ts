import { NextRequest } from "next/server";
import { proxySpring } from "../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return proxySpring("/api/financial-statements/adjusting-journal-entries/attachments?" + request.nextUrl.searchParams.toString());
}
