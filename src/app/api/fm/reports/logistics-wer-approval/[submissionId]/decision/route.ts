import { NextRequest, NextResponse } from "next/server";
import { hasDisbursementApprovalAccess } from "@/app/api/fm/treasury/disbursements/_approval-access";
import { requireSessionUserId } from "../../../logistics-wer/_payables";
import { DecisionFailure, decideOneSubmission, type WerApprovalDecision } from "../../_decision";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ message, ...extra }, { status });
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseDecision(value: unknown): WerApprovalDecision | null {
  const decision = asTrimmedString(value).toLowerCase();
  return decision === "approve" || decision === "return" || decision === "reject" ? decision : null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  const { submissionId } = await params;
  const id = Number(submissionId);
  if (!Number.isInteger(id) || id <= 0) {
    return error("submissionId must be a positive integer.", 400);
  }

  const approverId = await requireSessionUserId(request);
  if (!approverId) return error("Authentication is required to decide on a submission.", 401);
  if (!(await hasDisbursementApprovalAccess(approverId).catch(() => false))) {
    return error("Disbursement approval access is required to decide on a submission.", 403);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return error("Request body must be valid JSON.", 400);
  }
  const decision = parseDecision(body.decision);
  if (!decision) {
    return error('decision must be one of "approve", "return", or "reject".', 400);
  }
  const remarks = asTrimmedString(body.remarks);
  if ((decision === "return" || decision === "reject") && !remarks) {
    return error("Decision remarks are required when returning or rejecting a submission.", 400);
  }

  try {
    const outcome = await decideOneSubmission({ submissionId: id, decision, remarks, approverId });
    return NextResponse.json({
      draft: outcome.submission,
      disbursementId: outcome.disbursementId,
      idempotent: outcome.idempotent,
    });
  } catch (decisionError) {
    if (decisionError instanceof DecisionFailure) {
      return error(decisionError.message, decisionError.status, decisionError.extra);
    }
    console.error("[Logistics WER] Decision failed:", decisionError);
    return error(decisionError instanceof Error ? decisionError.message : "Unable to record the decision.", 502);
  }
}
