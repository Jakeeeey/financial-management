import { NextRequest, NextResponse } from "next/server";
import { hasDisbursementApprovalAccess } from "@/app/api/fm/treasury/disbursements/_approval-access";
import {
  getPlanFinancialContext,
  getPlanSubmission,
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
    const record = await getPlanSubmission(id);
    if (!record) return error("Submission not found.", 404);
    const { planId, submission } = record;
    const context = await getPlanFinancialContext(planId, false);

    const eligibility = await resolveDriverSupplier(context.plan?.driverId ?? null);
    return NextResponse.json({
      submission,
      dispatchPlanId: planId,
      dispatchPlanDocNo: context.plan?.docNo ?? `Plan #${planId}`,
      dispatchPlanStatus: context.plan?.status ?? null,
      plannedAmount: context.baseline,
      reservedAmount: context.reserved,
      remainingAmount: context.remaining,
      supplierEligibility: eligibility,
    });
  } catch (detailError) {
    console.error("[Logistics WER] Submission detail failed:", detailError);
    return error("Unable to load the submission.", 502);
  }
}
