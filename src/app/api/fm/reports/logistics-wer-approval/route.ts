import { NextRequest, NextResponse } from "next/server";
import { hasDisbursementApprovalAccess } from "@/app/api/fm/treasury/disbursements/_approval-access";
import {
  directusFetch,
  requireSessionUserId,
  type DraftSubmission,
} from "../logistics-wer/_payables";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QUEUE_STATUSES = ["submitted", "approved", "returned", "rejected", "withdrawn", "draft"] as const;
const QUEUE_FIELDS = "id,dispatch_plan_id,status,total_amount,submitted_by,submitted_at,decided_by,decided_at,decision_remarks,disbursement_id,idempotency_key";

interface QueueDraftRow extends Record<string, unknown> {
  id?: unknown;
  dispatch_plan_id?: unknown;
  status?: unknown;
  total_amount?: unknown;
  submitted_by?: unknown;
  submitted_at?: unknown;
  decided_by?: unknown;
  decided_at?: unknown;
  decision_remarks?: unknown;
  disbursement_id?: unknown;
  idempotency_key?: unknown;
}

interface DirectusList<T> {
  data?: T[];
  meta?: { filter_count?: number | string };
}

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

function asNumber(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function mapSubmission(row: QueueDraftRow): DraftSubmission {
  return {
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
  };
}

async function getPlanIdsMatchingDocNo(search: string): Promise<number[]> {
  const params = new URLSearchParams({
    "filter[doc_no][_icontains]": search,
    fields: "id",
    limit: "-1",
  });
  const result = await directusFetch<DirectusList<{ id?: unknown }>>(
    `/items/post_dispatch_plan?${params.toString()}`,
  );
  return Array.from(new Set((result.data ?? []).map((row) => asNumber(row.id)).filter((id) => id > 0)));
}

async function getStatusCounts(statuses: readonly string[]): Promise<Record<string, number>> {
  const params = new URLSearchParams({
    "filter[status][_in]": statuses.join(","),
    "aggregate[count]": "id",
    "groupBy[]": "status",
    limit: "-1",
  });
  try {
    const result = await directusFetch<DirectusList<{ status?: unknown; count?: unknown }>>(
      `/items/disbursement_logistics_draft?${params.toString()}`,
    );
    const counts: Record<string, number> = {};
    for (const row of result.data ?? []) {
      const countValue = typeof row.count === "object" && row.count !== null
        ? (row.count as Record<string, unknown>).id
        : row.count;
      const status = asString(row.status).toLowerCase() || "unknown";
      counts[status] = asNumber(countValue);
    }
    if ((result.data ?? []).length > 0 || statuses.length === 0) return counts;
  } catch (error) {
    console.warn("[Logistics WER] Status aggregation unavailable; falling back to count metadata.", error);
  }

  const entries = await Promise.all(statuses.map(async (status) => {
    const countParams = new URLSearchParams({
      "filter[status][_eq]": status,
      limit: "0",
      meta: "filter_count",
    });
    const result = await directusFetch<DirectusList<never>>(
      `/items/disbursement_logistics_draft?${countParams.toString()}`,
    );
    return [status, asNumber(result.meta?.filter_count)] as const;
  }));
  return Object.fromEntries(entries);
}

async function getPagePlanDetails(planIds: number[]) {
  const uniqueIds = Array.from(new Set(planIds.filter((id) => id > 0)));
  if (uniqueIds.length === 0) return new Map<number, { docNo: string; amount: number; status: string | null }>();
  const params = new URLSearchParams({
    "filter[id][_in]": uniqueIds.join(","),
    fields: "id,doc_no,amount,status",
    limit: String(uniqueIds.length),
  });
  const result = await directusFetch<DirectusList<{ id?: unknown; doc_no?: unknown; amount?: unknown; status?: unknown }>>(
    `/items/post_dispatch_plan?${params.toString()}`,
  );
  return new Map((result.data ?? []).map((row) => [asNumber(row.id), {
    docNo: asString(row.doc_no),
    amount: asNumber(row.amount),
    status: asString(row.status) || null,
  }]));
}

function toQueueItems(
  rows: QueueDraftRow[],
  plans: Map<number, { docNo: string; amount: number; status: string | null }>,
  disbursementDocNos: Map<number, string>,
): ApprovalQueueItem[] {
  return rows.map((row) => {
    const planId = asNumber(row.dispatch_plan_id);
    const plan = plans.get(planId);
    const disbursementId = asNullableNumber(row.disbursement_id);
    return {
      submission: mapSubmission(row),
      dispatchPlanId: planId,
      dispatchPlanDocNo: plan?.docNo || `Plan #${planId}`,
      dispatchPlanAmount: plan?.amount ?? 0,
      dispatchPlanStatus: plan?.status ?? null,
      disbursementDocNo: disbursementId !== null ? disbursementDocNos.get(disbursementId) ?? null : null,
    };
  });
}

async function getDisbursementDocNos(ids: number[]): Promise<Map<number, string>> {
  const uniqueIds = Array.from(new Set(ids.filter((id) => id > 0)));
  if (uniqueIds.length === 0) return new Map();
  const params = new URLSearchParams({
    "filter[id][_in]": uniqueIds.join(","),
    fields: "id,doc_no",
    limit: String(uniqueIds.length),
  });
  const result = await directusFetch<DirectusList<{ id?: unknown; doc_no?: unknown }>>(
    `/items/disbursement?${params.toString()}`,
  );
  return new Map((result.data ?? []).map((row) => [asNumber(row.id), asString(row.doc_no)]));
}

export interface ApprovalQueueItem {
  submission: DraftSubmission;
  dispatchPlanId: number;
  dispatchPlanDocNo: string;
  dispatchPlanAmount: number;
  dispatchPlanStatus: string | null;
  disbursementDocNo: string | null;
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
    const statusCounts = await getStatusCounts(statuses);
    const offset = page * size;
    let pageRows: QueueDraftRow[] = [];
    let totalElements = 0;

    if (search && /^\d+$/.test(search)) {
      // Keep legacy substring matching for numeric submission IDs, while
      // scanning only compact metadata instead of every payable line/receipt.
      const [planIds, candidates] = await Promise.all([
        getPlanIdsMatchingDocNo(search),
        directusFetch<DirectusList<QueueDraftRow>>(`/items/disbursement_logistics_draft?${new URLSearchParams({
          "filter[status][_in]": statuses.join(","),
          sort: "-id",
          limit: "-1",
          fields: "id,dispatch_plan_id,decision_remarks",
        }).toString()}`),
      ]);
      const matchingPlanIds = new Set(planIds);
      const matchedRows = (candidates.data ?? []).filter((row) =>
        String(asNumber(row.id)).includes(search)
        || asString(row.decision_remarks).toLowerCase().includes(search)
        || matchingPlanIds.has(asNumber(row.dispatch_plan_id)),
      );
      totalElements = matchedRows.length;
      const pageIds = matchedRows.slice(offset, offset + size).map((row) => asNumber(row.id));
      if (pageIds.length > 0) {
        const pageParams = new URLSearchParams({
          "filter[id][_in]": pageIds.join(","),
          sort: "-id",
          limit: String(pageIds.length),
          fields: QUEUE_FIELDS,
        });
        const pageResult = await directusFetch<DirectusList<QueueDraftRow>>(
          `/items/disbursement_logistics_draft?${pageParams.toString()}`,
        );
        pageRows = pageResult.data ?? [];
      }
    } else {
      const params = new URLSearchParams({
        "filter[status][_in]": statuses.join(","),
        sort: "-id",
        limit: String(size),
        offset: String(offset),
        meta: "filter_count",
        fields: QUEUE_FIELDS,
      });
      if (search) {
        const planIds = await getPlanIdsMatchingDocNo(search);
        params.set("filter[_or][0][decision_remarks][_icontains]", search);
        if (planIds.length > 0) {
          params.set("filter[_or][1][dispatch_plan_id][_in]", planIds.join(","));
        }
      }
      const drafts = await directusFetch<DirectusList<QueueDraftRow>>(
        `/items/disbursement_logistics_draft?${params.toString()}`,
      );
      pageRows = drafts.data ?? [];
      totalElements = asNumber(drafts.meta?.filter_count);
    }

    const plans = await getPagePlanDetails(pageRows.map((row) => asNumber(row.dispatch_plan_id)));
    const disbursementDocNos = await getDisbursementDocNos(
      pageRows.map((row) => asNullableNumber(row.disbursement_id) ?? 0),
    );
    const items = toQueueItems(pageRows, plans, disbursementDocNos);
    return NextResponse.json({
      content: items,
      number: page,
      size,
      totalElements,
      totalPages: totalElements === 0 ? 0 : Math.ceil(totalElements / size),
      statusCounts,
    });
  } catch (queueError) {
    console.error("[Logistics WER] Approval queue failed:", queueError);
    return error("Unable to load the approval queue.", 502);
  }
}
