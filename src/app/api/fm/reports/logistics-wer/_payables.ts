import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { decodeJwtPayload } from "@/lib/auth-utils";

const DIRECTUS_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
const DIRECTUS_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";

export const DRAFT_COLLECTION = "disbursement_logistics_draft";
export const DRAFT_LINE_COLLECTION = "disbursement_logistics_draft_lines";
export const DRAFT_RECEIPT_COLLECTION = "disbursement_logistics_line_receipts";

export type LogisticsDraftStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "returned"
  | "rejected"
  | "withdrawn"
  | "converted";

/** Drafts in these statuses hold an active reservation against the plan. */
export const ACTIVE_RESERVATION_STATUSES: LogisticsDraftStatus[] = ["submitted", "approved"];

export interface DraftRow {
  id: number;
  dispatch_plan_id: number | null;
  status: string | null;
  total_amount: number | null;
  submitted_by: number | null;
  submitted_at: string | null;
  decided_by: number | null;
  decided_at: string | null;
  decision_remarks: string | null;
  disbursement_id: number | null;
  idempotency_key: string | null;
  date_created: string | null;
  date_updated: string | null;
}

export interface DraftLineRow {
  id: number;
  draft_id: number | null;
  line_no: number | null;
  amount: number | null;
  reference_no: string | null;
  remarks: string | null;
  date: string | null;
  coa_id: number | null;
  date_created: string | null;
}

export interface DraftReceiptRow {
  id: number;
  line_id: number | null;
  file_id: string | null;
  uploaded_by: number | null;
  date_created: string | null;
}

export interface SupplierEligibility {
  eligible: boolean;
  driverId: number | null;
  supplierId: number | null;
  supplierName: string | null;
  reason: string | null;
}

export interface PlanRemaining {
  baseline: number;
  reserved: number;
  remaining: number;
}

interface DirectusList<T> {
  data?: T[];
}

function asNumber(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function directusFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!DIRECTUS_URL) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  if (!DIRECTUS_TOKEN) throw new Error("DIRECTUS_STATIC_TOKEN is not configured");

  const response = await fetch(`${DIRECTUS_URL}${path.startsWith("/") ? "" : "/"}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${DIRECTUS_TOKEN}`,
      Accept: "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Directus request failed (${response.status}): ${body || response.statusText}`);
  }
  if (!body.trim()) return {} as T;
  return JSON.parse(body) as T;
}

export async function directusWrite<T>(method: "POST" | "PATCH" | "DELETE", path: string, payload?: unknown): Promise<T> {
  return directusFetch<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

/**
 * Resolve the caller's custom user-table user_id from the session cookie.
 * Returns null when no session maps to a user (caller is unauthenticated).
 */
export async function requireSessionUserId(request: NextRequest): Promise<number | null> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get("vos_access_token")?.value ||
    cookieStore.get("springboot_token")?.value ||
    request.cookies.get("vos_access_token")?.value ||
    request.cookies.get("springboot_token")?.value;
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const numericSub = Number(payload.sub);
  if (Number.isInteger(numericSub) && numericSub > 0) return numericSub;

  const email = asString(payload.email);
  if (!email) return null;
  try {
    const params = new URLSearchParams({
      "filter[user_email][_eq]": email,
      fields: "user_id",
      limit: "1",
    });
    const result = await directusFetch<DirectusList<{ user_id?: unknown }>>(`/items/user?${params.toString()}`);
    return asNullableNumber(result.data?.[0]?.user_id);
  } catch {
    return null;
  }
}

/** Resolve the assigned driver to one active supplier account via suppliers.user_id. */
export async function resolveDriverSupplier(driverId: number | null): Promise<SupplierEligibility> {
  const base: SupplierEligibility = {
    eligible: false,
    driverId,
    supplierId: null,
    supplierName: null,
    reason: null,
  };
  if (!driverId || driverId <= 0) {
    return { ...base, reason: "No driver is assigned to this dispatch plan." };
  }

  const params = new URLSearchParams({
    "filter[user_id][_eq]": String(driverId),
    "filter[isActive][_eq]": "1",
    fields: "id,supplier_name",
    limit: "-1",
  });
  const result = await directusFetch<DirectusList<{ id?: unknown; supplier_name?: unknown }>>(
    `/items/suppliers?${params.toString()}`,
  );
  const matches = result.data ?? [];
  if (matches.length === 0) {
    return { ...base, reason: "The assigned driver has no active linked supplier account." };
  }
  if (matches.length > 1) {
    return { ...base, reason: "The assigned driver links to more than one active supplier account; resolve the data before submitting." };
  }
  return {
    ...base,
    eligible: true,
    supplierId: asNullableNumber(matches[0]?.id),
    supplierName: asString(matches[0]?.supplier_name) || null,
  };
}

export interface PlanBaseline {
  id: number;
  docNo: string;
  driverId: number | null;
  status: string | null;
  amount: number;
}

export async function getPlanBaseline(planId: number): Promise<PlanBaseline | null> {
  const params = new URLSearchParams({
    fields: "id,doc_no,driver_id,status,amount",
    "filter[id][_eq]": String(planId),
    limit: "1",
  });
  const result = await directusFetch<DirectusList<Record<string, unknown>>>(
    `/items/post_dispatch_plan?${params.toString()}`,
  );
  const row = result.data?.[0];
  if (!row) return null;
  const driverValue = row.driver_id;
  const driverId =
    driverValue !== null && typeof driverValue === "object"
      ? asNullableNumber((driverValue as Record<string, unknown>).user_id)
      : asNullableNumber(driverValue);
  return {
    id: asNumber(row.id),
    docNo: asString(row.doc_no),
    driverId,
    status: asString(row.status) || null,
    amount: asNumber(row.amount),
  };
}

export interface DraftSubmission {
  id: number;
  status: string | null;
  totalAmount: number;
  submittedBy: number | null;
  submittedAt: string | null;
  decidedBy: number | null;
  decidedAt: string | null;
  decisionRemarks: string | null;
  disbursementId: number | null;
  idempotencyKey: string | null;
  lines: Array<{
    id: number;
    lineNo: number | null;
    amount: number;
    referenceNo: string | null;
    remarks: string | null;
    date: string | null;
    coaId: number | null;
    receipts: Array<{ id: number; fileId: string | null }>;
  }>;
}

/** All drafts ever recorded for a plan (newest first). */
export async function getPlanDrafts(planId: number): Promise<DraftSubmission[]> {
  const params = new URLSearchParams({
    "filter[dispatch_plan_id][_eq]": String(planId),
    sort: "-id",
    limit: "-1",
    fields: "id,status,total_amount,submitted_by,submitted_at,decided_by,decided_at,decision_remarks,disbursement_id,idempotency_key",
  });
  const drafts = await directusFetch<DirectusList<DraftRow>>(`items/${DRAFT_COLLECTION}?${params.toString()}`);
  const rows = drafts.data ?? [];
  if (rows.length === 0) return [];

  const lineParams = new URLSearchParams({
    "filter[draft_id][_in]": rows.map((row) => String(asNumber(row.id))).join(","),
    sort: "draft_id,line_no,id",
    limit: "-1",
    fields: "id,draft_id,line_no,amount,reference_no,remarks,date,coa_id",
  });
  const lines = await directusFetch<DirectusList<DraftLineRow>>(`items/${DRAFT_LINE_COLLECTION}?${lineParams.toString()}`);
  const lineRows = lines.data ?? [];

  let receiptRows: DraftReceiptRow[] = [];
  if (lineRows.length > 0) {
    const receiptParams = new URLSearchParams({
      "filter[line_id][_in]": lineRows.map((line) => String(asNumber(line.id))).join(","),
      sort: "line_id,id",
      limit: "-1",
      fields: "id,line_id,file_id,uploaded_by,date_created",
    });
    const receipts = await directusFetch<DirectusList<DraftReceiptRow>>(
      `items/${DRAFT_RECEIPT_COLLECTION}?${receiptParams.toString()}`,
    );
    receiptRows = receipts.data ?? [];
  }
  const receiptsByLine = new Map<number, Array<{ id: number; fileId: string | null }>>();
  for (const receipt of receiptRows) {
    const lineId = asNumber(receipt.line_id);
    const list = receiptsByLine.get(lineId) ?? [];
    list.push({ id: asNumber(receipt.id), fileId: asString(receipt.file_id) || null });
    receiptsByLine.set(lineId, list);
  }

  return rows.map((row) => {
    const draftId = asNumber(row.id);
    return {
      id: draftId,
      status: asString(row.status) || null,
      totalAmount: asNumber(row.total_amount),
      submittedBy: asNullableNumber(row.submitted_by),
      submittedAt: asString(row.submitted_at) || null,
      decidedBy: asNullableNumber(row.decided_by),
      decidedAt: asString(row.decided_at) || null,
      decisionRemarks: asString(row.decision_remarks) || null,
      disbursementId: asNullableNumber(row.disbursement_id),
      idempotencyKey: asString(row.idempotency_key) || null,
      lines: lineRows
        .filter((line) => asNumber(line.draft_id) === draftId)
        .map((line) => {
          const lineId = asNumber(line.id);
          return {
            id: lineId,
            lineNo: asNullableNumber(line.line_no),
            amount: asNumber(line.amount),
            referenceNo: asString(line.reference_no) || null,
            remarks: asString(line.remarks) || null,
            date: asString(line.date) || null,
            coaId: asNullableNumber(line.coa_id),
            receipts: receiptsByLine.get(lineId) ?? [],
          };
        }),
    };
  });
}

async function convertedDisbursementTotal(disbursementId: number): Promise<number> {
  const params = new URLSearchParams({
    "filter[disbursement_id][_eq]": String(disbursementId),
    limit: "-1",
    fields: "amount",
  });
  const result = await directusFetch<DirectusList<{ amount?: unknown }>>(
    `/items/disbursement_payables?${params.toString()}`,
  );
  return (result.data ?? []).reduce((sum, row) => sum + asNumber(row.amount), 0);
}

/**
 * Remaining payable amount for a plan. The baseline is never overwritten;
 * active submitted/approved drafts reserve, and a converted draft counts once
 * via its resulting disbursement instead of its draft total.
 */
export async function getPlanRemaining(planId: number): Promise<PlanRemaining & { submissions: DraftSubmission[] }> {
  const baselineRow = await getPlanBaseline(planId);
  const baseline = baselineRow?.amount ?? 0;
  const submissions = await getPlanDrafts(planId);

  let reserved = 0;
  for (const submission of submissions) {
    const status = (submission.status || "").toLowerCase();
    if (status === "converted" && submission.disbursementId) {
      reserved += await convertedDisbursementTotal(submission.disbursementId);
    } else if (ACTIVE_RESERVATION_STATUSES.includes(status as (typeof ACTIVE_RESERVATION_STATUSES)[number])) {
      reserved += submission.totalAmount;
    }
  }

  return { baseline, reserved, remaining: baseline - reserved, submissions };
}

/** In-process per-plan mutex. Single-instance dev guard, not a distributed lock. */
const planLocks = new Map<number, Promise<unknown>>();

export async function withPlanLock<T>(planId: number, task: () => Promise<T>): Promise<T> {
  const previous = planLocks.get(planId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  planLocks.set(planId, previous.then(() => current));
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (planLocks.get(planId) === current) planLocks.delete(planId);
  }
}

export function manilaTimestamp(date: Date = new Date()): string {
  return date.toISOString();
}
