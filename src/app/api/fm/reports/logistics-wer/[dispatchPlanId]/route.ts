import { NextRequest, NextResponse } from "next/server";
import { proxySpring } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import {
  getPlanBaseline,
  getPlanRemaining,
  resolveDriverSupplier,
} from "../_payables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function springDetail(id: number): Promise<Response> {
  const singularResponse = await proxySpring(`/api/v1/dispatch-approval/${encodeURIComponent(String(id))}`);
  if (singularResponse.status !== 404) return singularResponse;

  // The current Spring deployment exposes the legacy plural resource. Keep the
  // requested singular resource as the primary contract, but support that
  // deployed route until the backend is migrated.
  return proxySpring(`/api/v1/dispatch-approvals/${encodeURIComponent(String(id))}`);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ dispatchPlanId: string }> },
) {
  const { dispatchPlanId } = await params;
  const id = Number(dispatchPlanId);

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ message: "dispatchPlanId must be a positive integer." }, { status: 400 });
  }

  const springResponse = await springDetail(id);
  if (!springResponse.ok) return springResponse;

  // Merge Logistics WER payables context (Directus-side) into the Spring detail.
  // A merge failure must not break the existing details sheet.
  try {
    const springPayload = (await springResponse.json()) as Record<string, unknown>;
    const baseline = await getPlanBaseline(id);
    const driverId = baseline?.driverId ?? null;
    const [eligibility, remaining] = await Promise.all([
      resolveDriverSupplier(driverId),
      getPlanRemaining(id),
    ]);
    return NextResponse.json({
      ...springPayload,
      werPayables: {
        plannedAmount: remaining.baseline,
        reservedAmount: remaining.reserved,
        remainingAmount: remaining.remaining,
        isLiquidated: baseline?.isLiquidated ?? false,
        supplierEligibility: eligibility,
        submissions: remaining.submissions,
      },
    });
  } catch (mergeError) {
    console.error("[Logistics WER] Failed to merge payables context:", mergeError);
    return springDetail(id);
  }
}
