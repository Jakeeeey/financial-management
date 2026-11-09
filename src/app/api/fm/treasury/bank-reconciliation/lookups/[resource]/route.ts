import type { NextRequest } from "next/server";
import { listReferences, referenceResponse } from "../../_references";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  return referenceResponse(async () => listReferences((await params).resource, request.nextUrl.searchParams));
}
