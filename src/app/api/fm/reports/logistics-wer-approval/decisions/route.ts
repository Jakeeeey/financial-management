import { NextRequest, NextResponse } from "next/server";
import { hasDisbursementApprovalAccess } from "@/app/api/fm/treasury/disbursements/_approval-access";
import { requireSessionUserId } from "../../logistics-wer/_payables";
import { DecisionFailure, decideOneSubmission } from "../_decision";
import { parseDecision } from "../[submissionId]/decision/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BULK_DECISIONS = 50;

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export interface BulkDecisionItemResult {
  submissionId: number;
  ok: boolean;
  message: string | null;
  disbursementId: number | null;
  idempotent: boolean;
}

/**
 * Decide many submissions with one request. Each item runs through the same
 * per-submission core (per-plan lock, revalidation, idempotent conversion)
 * as single decisions; one item's failure never blocks the rest.
 */
export async function POST(request: NextRequest) {
  const approverId = await requireSessionUserId(request);
  if (!approverId) return error("Authentication is required to decide on submissions.", 401);
  if (!(await hasDisbursementApprovalAccess(approverId).catch(() => false))) {
    return error("Disbursement approval access is required to decide on submissions.", 403);
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
    return error("Decision remarks are required when returning or rejecting submissions.", 400);
  }
  const rawIds = Array.isArray(body.submissionIds) ? body.submissionIds : [];
  const submissionIds = Array.from(new Set(
    rawIds.map((value) => Number(value)).filter((id) => Number.isInteger(id) && id > 0),
  ));
  if (submissionIds.length === 0) {
    return error("submissionIds must be a non-empty array of submission ids.", 400);
  }
  if (submissionIds.length > MAX_BULK_DECISIONS) {
    return error(`Bulk decisions are limited to ${MAX_BULK_DECISIONS} submissions per request.`, 400);
  }

  const results: BulkDecisionItemResult[] = [];
  for (const submissionId of submissionIds) {
    try {
      const outcome = await decideOneSubmission({ submissionId, decision, remarks, approverId });
      results.push({
        submissionId,
        ok: true,
        message: null,
        disbursementId: outcome.disbursementId,
        idempotent: outcome.idempotent,
      });
    } catch (itemError) {
      results.push({
        submissionId,
        ok: false,
        message: itemError instanceof DecisionFailure
          ? itemError.message
          : itemError instanceof Error ? itemError.message : "Unable to record the decision.",
        disbursementId: null,
        idempotent: false,
      });
    }
  }

  const decided = results.filter((result) => result.ok).length;
  return NextResponse.json({ results, decided, failed: results.length - decided });
}
