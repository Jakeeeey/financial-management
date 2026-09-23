import { NextRequest, NextResponse } from "next/server";
import { hasDisbursementApprovalAccess } from "@/app/api/fm/treasury/disbursements/_approval-access";
import {
  directusFetch,
  getPlanBaseline,
  requireSessionUserId,
  type DraftSubmission,
} from "../logistics-wer/_payables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUEUE_STATUSES = ["submitted", "approved", "returned", "rejected", "withdrawn", "draft"] as const;

function error(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

function normalizePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
}

function normalizeSize(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 25;
  return Math.min(100, Math.floor(parsed));
}

export interface ApprovalQueueItem {
  submission: DraftSubmission;
  dispatchPlanId: number;
  dispatchPlanDocNo: string;
  dispatchPlanAmount: number;
  dispatchPlanStatus: string | null;
}

export async function GET(request: NextRequest) {
  const userId = await requireSessionUserId(request);
  if (!userId) return error("Authentication is required to view the approval queue.", 401);
  if (!(await hasDisbursementApprovalAccess(userId).catch(() => false))) {
    return error("Disbursement approval access is required to view the approval queue.", 403);
  }

  const searchParams = request.nextUrl.searchParams;
  const statusParam = (searchParams.get("status") || "all").trim().toLowerCase();
  const statuses = statusParam === "all"
    ? [...QUEUE_STATUSES]
    : QUEUE_STATUSES.filter((status) => status === statusParam);
  if (statuses.length === 0) {
    return error(`status must be one of ${[...QUEUE_STATUSES, "all"].join(", ")}.`, 400);
  }
  const search = (searchParams.get("search") || "").trim().toLowerCase();
  const page = normalizePage(searchParams.get("page"));
  const size = normalizeSize(searchParams.get("size"));

  try {
    const params = new URLSearchParams({
      "filter[status][_in]": statuses.join(","),
      sort: "-id",
      limit: "-1",
      fields: "id,dispatch_plan_id,status,total_amount,submitted_by,submitted_at,decided_by,decided_at,decision_remarks,disbursement_id,idempotency_key",
    });
    const drafts = await directusFetch<{ data?: Record<string, unknown>[] }>(
      `/items/disbursement_logistics_draft?${params.toString()}`,
    );

    const planIds = Array.from(new Set((drafts.data ?? []).map((row) => Number(row.dispatch_plan_id) || 0).filter(Boolean)));
    const plans = new Map<number, { docNo: string; amount: number; status: string | null }>();
    await Promise.all(planIds.map(async (planId) => {
      const baseline = await getPlanBaseline(planId).catch(() => null);
      if (baseline) plans.set(planId, { docNo: baseline.docNo, amount: baseline.amount, status: baseline.status });
    }));

    const asNumber = (value: unknown): number => {
      const result = Number(value ?? 0);
      return Number.isFinite(result) ? result : 0;
    };
    const asString = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
    const asNullableNumber = (value: unknown): number | null => {
      if (value === null || value === undefined || value === "") return null;
      const result = Number(value);
      return Number.isFinite(result) ? result : null;
    };

    let items: ApprovalQueueItem[] = (drafts.data ?? []).map((row: Record<string, unknown>) => {
      const planId = asNumber(row.dispatch_plan_id);
      const plan = plans.get(planId);
      return {
        submission: {
          id: asNumber(row.id),
          status: asString(row.status) || null,
          totalAmount: asNumber(row.total_amount),
          submittedBy: asNullableNumber(row.submitted_by),
          submittedAt: asString(row.submitted_at) || null,
          decidedBy: asNullableNumber(row.decided_by),
          decidedAt: asString(row.decided_at) || null,
          decisionRemarks: asString(row.decision_remarks) || null,
          disbursementId: asNullableNumber(row.disbursement_id),
          idempotencyKey: asString(row.idempotency_key) || null,
          lines: [],
        },
        dispatchPlanId: planId,
        dispatchPlanDocNo: plan?.docNo || `Plan #${planId}`,
        dispatchPlanAmount: plan?.amount ?? 0,
        dispatchPlanStatus: plan?.status ?? null,
      };
    });

    if (search) {
      items = items.filter((item) => [
        item.dispatchPlanDocNo,
        String(item.submission.id),
        item.submission.decisionRemarks,
      ].some((value) => (value || "").toLowerCase().includes(search)));
    }

    const offset = page * size;
    const statusCounts: Record<string, number> = {};
    for (const row of drafts.data ?? []) {
      const key = (typeof row.status === "string" ? row.status.trim().toLowerCase() : "") || "unknown";
      statusCounts[key] = (statusCounts[key] ?? 0) + 1;
    }
    return NextResponse.json({
      content: items.slice(offset, offset + size),
      number: page,
      size,
      totalElements: items.length,
      totalPages: items.length === 0 ? 0 : Math.ceil(items.length / size),
      statusCounts,
    });
  } catch (queueError) {
    console.error("[Logistics WER] Approval queue failed:", queueError);
    return error("Unable to load the approval queue.", 502);
  }
}
