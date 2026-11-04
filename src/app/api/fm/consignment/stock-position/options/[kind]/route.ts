import { NextRequest, NextResponse } from "next/server";
import { readConsignment } from "../../../_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  return params.then(({ kind }) => {
    if (kind !== "agreements" && kind !== "products") {
      return NextResponse.json({ message: "Unknown stock position option type." }, { status: 400 });
    }
    return readConsignment(`/api/consignment/stock-position/options/${kind}?${request.nextUrl.searchParams.toString()}`);
  });
}
