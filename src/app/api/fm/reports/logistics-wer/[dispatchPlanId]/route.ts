import { NextRequest, NextResponse } from "next/server";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dispatchPlanId: string }> },
) {
  const { dispatchPlanId } = await params;
  const id = Number(dispatchPlanId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ message: "dispatchPlanId must be a positive integer." }, { status: 400 });
  }

  const singularResponse = await proxySpring(`/api/v1/dispatch-approval/${encodeURIComponent(String(id))}`);
  if (singularResponse.status !== 404) return singularResponse;

  // The current Spring deployment exposes the legacy plural resource. Keep the
  // requested singular resource as the primary contract, but support that
  // deployed route until the backend is migrated.
  return proxySpring(`/api/v1/dispatch-approvals/${encodeURIComponent(String(id))}`);
}
