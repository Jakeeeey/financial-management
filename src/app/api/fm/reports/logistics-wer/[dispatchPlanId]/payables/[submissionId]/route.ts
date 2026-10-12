import { NextRequest, NextResponse } from "next/server";
import { getSpringDispatchPlanDetail } from "../../../_spring";
import { getPlanSubmission, requireSessionUserId } from "../../../_payables";
import { toPayableSubmissionDetails } from "../../../_submission-details";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ dispatchPlanId: string; submissionId: string }> },
) {
  const { dispatchPlanId, submissionId } = await params;
  const planId = Number(dispatchPlanId);
  const id = Number(submissionId);
  if (!Number.isInteger(planId) || planId <= 0 || !Number.isInteger(id) || id <= 0) {
    return error("dispatchPlanId and submissionId must be positive integers.", 400);
  }

  const userId = await requireSessionUserId(request);
  if (!userId) {
    return error("Authentication is required to view payable details.", 401);
  }

  const planResponse = await getSpringDispatchPlanDetail(planId);
  if (!planResponse.ok) return planResponse;

  try {
    const record = await getPlanSubmission(id);
    const details = toPayableSubmissionDetails(record, planId, userId);
    if (!details) return error("Submission not found for this dispatch plan.", 404);
    return NextResponse.json(details);
  } catch (detailError) {
    console.error("[Logistics WER] Payable line details failed:", detailError);
    return error("Unable to load payable line details.", 502);
  }
}
