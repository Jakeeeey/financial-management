import { NextRequest } from "next/server";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import { analyticsQuery } from "../_query";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = analyticsQuery(new URL(request.url).searchParams);
  return proxySpring(`/api/view-general-ledger-master/analytics?${params.toString()}`);
}
