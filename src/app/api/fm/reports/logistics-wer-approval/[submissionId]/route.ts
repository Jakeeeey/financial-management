import { NextRequest, NextResponse } from "next/server";
import { hasDisbursementApprovalAccess } from "@/app/api/fm/treasury/disbursements/_approval-access";
import {
  DRAFT_COLLECTION,
  directusFetch,
  getPlanBaseline,
  getPlanDrafts,
  getPlanRemaining,
  requireSessionUserId,
  resolveDriverSupplier,
} from "../../logistics-wer/_payables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;
  const id = Number(submissionId);
  if (!Number.isInteger(id) || id <= 0) {
    return error("submissionId must be a positive integer.", 400);
  }

  const userId = await requireSessionUserId(request);
  if (!userId) return error("Authentication is required to review the submission.", 401);
  if (!(await hasDisbursementApprovalAccess(userId).catch(() => false))) {
    return error("Disbursement approval access is required to review the submission.", 403);
  }

  try {
    const header = await directusFetch<{ data?: Record<string, unknown> }>(
      `/items/${DRAFT_COLLECTION}/${id}?fields=id,dispatch_plan_id,status`,
    ).catch(() => null);
    const planId = Number(header?.data?.dispatch_plan_id) || 0;
    if (!planId) return error("Submission not found.", 404);

    const [submissions, baseline, remaining] = await Promise.all([
      getPlanDrafts(planId),
      getPlanBaseline(planId),
      getPlanRemaining(planId),
    ]);
    const submission = submissions.find((item) => item.id === id);
    if (!submission) return error("Submission not found.", 404);

    const eligibility = await resolveDriverSupplier(baseline?.driverId ?? null);
    return NextResponse.json({
      submission,
      dispatchPlanId: planId,
      dispatchPlanDocNo: baseline?.docNo ?? `Plan #${planId}`,
      dispatchPlanStatus: baseline?.status ?? null,
      plannedAmount: remaining.baseline,
      reservedAmount: remaining.reserved,
      remainingAmount: remaining.remaining,
      supplierEligibility: eligibility,
    });
  } catch (detailError) {
    console.error("[Logistics WER] Submission detail failed:", detailError);
    return error("Unable to load the submission.", 502);
  }
}
