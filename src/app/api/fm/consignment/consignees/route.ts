import { NextRequest } from "next/server";
import { readConsignment } from "../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return readConsignment(`/api/consignment/consignees?${request.nextUrl.searchParams.toString()}`);
}
