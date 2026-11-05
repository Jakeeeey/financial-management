import { NextRequest, NextResponse } from "next/server";
import { proxySpring } from "../../../adjusting-journal-entries/_spring";
import { sourcePaths } from "@/modules/financial-management/financial-statements/journal-entry/utils/source-reference";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") || "";
  const id = request.nextUrl.searchParams.get("id") || "";
  if (!Object.hasOwn(sourcePaths, type) || !/^[1-9]\d*$/.test(id) || Number(id) > 2147483647) return NextResponse.json({ message: "Invalid source record." }, { status: 400 });
  return proxySpring(`/api/journal-entry/drill-down/source-record?${new URLSearchParams({ type, id })}`);
}
