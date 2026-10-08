import { NextRequest, NextResponse } from "next/server";
import { hasDisbursementApprovalAccess } from "@/app/api/fm/treasury/disbursements/_approval-access";
import {
  getPlanFinancialContext,
  getPlanSubmission,
  requireSessionUserId,
  resolveDriverSupplier,
  directusFetch,
} from "../../logistics-wer/_payables";
import {
  addCoaLabelsToLines,
  buildSubmissionBudgetByCoa,
  type ReviewCoaAccountRow,
} from "../_review";

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
    const coaIds = Array.from(new Set(
      submission.lines
        .map((line) => line.coaId)
        .filter((coaId): coaId is number => coaId !== null && coaId > 0),
    ));
    const coaRows = coaIds.length > 0
      ? (await directusFetch<{ data?: ReviewCoaAccountRow[] }>(
          `/items/chart_of_accounts?${new URLSearchParams({
            "filter[coa_id][_in]": coaIds.join(","),
            fields: "coa_id,gl_code,account_title",
            limit: "-1",
          }).toString()}`,
        )).data ?? []
      : [];
    const reviewSubmission = {
      ...submission,
      lines: addCoaLabelsToLines(submission.lines, coaRows),
    };
    const context = await getPlanFinancialContext(planId, false);
    const disbursement = submission.disbursementId
      ? await directusFetch<{ data?: { doc_no?: unknown } }>(
          `/items/disbursement/${submission.disbursementId}?fields=doc_no`,
        ).catch(() => null)
      : null;
    const disbursementDocNo = typeof disbursement?.data?.doc_no === "string"
      ? disbursement.data.doc_no.trim() || null
      : null;

    const eligibility = await resolveDriverSupplier(context.plan?.driverId ?? null);
    return NextResponse.json({
      submission: reviewSubmission,
      dispatchPlanId: planId,
      dispatchPlanDocNo: context.plan?.docNo ?? `Plan #${planId}`,
      dispatchPlanStatus: context.plan?.status ?? null,
      budgetByCoa: buildSubmissionBudgetByCoa(reviewSubmission.lines, context.budgetBalancesByCoa),
      disbursementDocNo,
      supplierEligibility: eligibility,
    });
  } catch (detailError) {
    console.error("[Logistics WER] Submission detail failed:", detailError);
    return error("Unable to load the submission.", 502);
  }
}
