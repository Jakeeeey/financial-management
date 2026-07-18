// src/app/api/fm/treasury/bulk-approval/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { format, startOfWeek, endOfWeek } from "date-fns";

export const runtime = "nodejs";

const DIRECTUS_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") || "";
const STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN || "";
const COOKIE_NAME = "vos_access_token";

type VoteStatus = "APPROVED" | "REJECTED" | "WITH_CONCERN";
type DraftLifecycleStatus =
  | "Submitted"
  | `Pending_L${number}`
  | "With Concern"
  | "Rejected"
  | "Approved";

type DirectusListResponse<T> = {
  data?: T[];
};

type DirectusItemResponse<T> = {
  data?: T;
};

type DirectusAggregateCountResponse = {
  data?: {
    count?: string | number;
  }[];
};

type DirectusUserRow = {
  user_id?: number | string;
  user_fname?: string | null;
  user_mname?: string | null;
  user_lname?: string | null;
  suffix_name?: string | null;
  nickname?: string | null;
  user_email?: string | null;
};

type DirectusSupplierRow = {
  id?: number | string;
  user_id?: number | string | null;
  division_id?: number | string | null;
  supplier_name?: string | null;
  supplier_shortcut?: string | null;
  contact_person?: string | null;
  email_address?: string | null;
  phone_number?: string | null;
  isActive?: number | string | boolean | null;
};

type DirectusDivisionRow = {
  division_id?: number | string;
  division_name?: string | null;
  division_description?: string | null;
  division_code?: string | null;
};

type DirectusCoaRow = {
  coa_id?: number | string;
  gl_code?: string | null;
  account_title?: string | null;
};

type ApproverRecord = {
  id: number;
  approver_id: number;
  division_id: number;
  approver_heirarchy: number;
};

type DirectusApproverRow = {
  id?: number | string;
  approver_id?: number | string | DirectusUserRow | null;
  division_id?: number | string | DirectusDivisionRow | null;
  approver_heirarchy?: number | string | null;
};

type DisbursementDraftRow = {
  id: number | string;
  doc_no?: string | null;
  payee?: number | string | DirectusSupplierRow | null;
  total_amount?: number | string | null;
  remarks?: string | null;
  status?: string | null;
  approval_version?: number | string | null;
  version?: number | string | null;
  transaction_date?: string | null;
  division_id?: number | string | DirectusDivisionRow | null;
  department_id?: number | string | null;
  encoder_id?: number | string | DirectusUserRow | null;
  transaction_type?: number | string | null;
  supporting_documents_url?: string | null;
  date_created?: string | null;
  date_updated?: string | null;
};

type DisbursementPayableDraftRow = {
  id: number | string;
  disbursement_id?: number | string | null;
  division_id?: number | string | null;
  coa_id?: number | string | DirectusCoaRow | null;
  amount?: number | string | null;
  reference_no?: string | null;
  remarks?: string | null;
  date?: string | null;
  expense_id?:
  | number
  | string
  | {
    id?: number | string;
    status?: string | null;
    feedback?: string | null;
    header_id?: number | string | null;
    amount?: number | string | null;
    attachment_url?: string | number | { id?: string; uuid?: string; directus_files_id?: string } | null;
  }
  | null;
};

type ExpenseDraftRow = {
  id: number | string;
  amount?: number | string | null;
  remarks?: string | null;
  transaction_date?: string | null;
  division_id?: number | string | null;
  encoder_id?: number | string | null;
  return_to?: string | null;
  particulars?: number | string | DirectusCoaRow | null;
  attachment_url?: string | number | { id?: string; uuid?: string; directus_files_id?: string } | null;
  feedback?: string | null;
  status?: string | null;
  header_id?: number | string | null;
};

type ApprovalVoteRow = {
  id?: number | string;
  draft_id?: number | string | null;
  approver_id?: number | string | DirectusUserRow | null;
  approver_heirarchy?: number | string | null;
  status?: string | null;
  remarks?: string | null;
  version?: number | string | null;
  created_at?: string | null;
};

type DraftRowResponse = {
  id: number;
  doc_no: string;
  payee_user_id: number;
  payee_name: string;
  encoder_user_id?: number;
  encoder_name: string;
  total_amount: number;
  remarks: string | null;
  status: string;
  division_name?: string;
  approval_version: number;
  transaction_date: string | null;
  date_created: string;
  current_tier: number;
  max_level: number;
  approvers_per_level: Record<number, number>;
  my_vote: {
    status: string;
    created_at: string;
    version: number;
  } | null;
  can_vote: boolean;
  has_concern?: boolean;
};

type PayableResponse = {
  id: number;
  coa_id: number;
  coa_name: string;
  amount: number;
  remarks: string | null;
  date: string | null;
  reference_no: string | null;
  attachment_url: string | null;
  is_concern?: boolean;
  is_rejected?: boolean;
  feedback?: string | null;
  expense_id?: number;
};

type ConcernItemResponse = {
  expense_id: number;
  status: string;
  feedback: string | null;
  return_to: string | null;
  amount: number;
  coa_id: number;
  coa_name: string;
  remarks: string | null;
  transaction_date: string | null;
  attachment_url: string | null;
  reference_no?: string | null;
};

type LogVoteResponse = {
  approver_id: number;
  name: string;
  level: number;
  status: string;
  remarks: string | null;
  created_at: string;
};

type LogRoundResponse = {
  version: number;
  is_current: boolean;
  outcome: string;
  votes: LogVoteResponse[];
};

type ActivityLogDetailResponse = {
  id: number;
  coa_name: string;
  amount: number;
  remarks: string | null;
  date: string | null;
};

type DraftRevisionLogResponse = {
  id: number;
  editor_name: string;
  edit_reason: string | null;
  total_amount: number;
  status: string | null;
  remarks: string | null;
  version: number;
  created_at: string;
  item_count: number;
};

type ExpenseRevisionLogResponse = {
  log_id: number;
  expense_id: number;
  action: string;
  editor_name: string;
  changed_at: string;
  amount: number;
  remarks: string | null;
  particulars: string | null;
  status: string;
  version: number;
};

type DisbursementDraftLogRow = {
  id?: number | string;
  disbursement_id?: number | string | null;
  updated_by?: number | string | DirectusUserRow | null;
  edit_reason?: string | null;
  payload_snapshot?: unknown;
  log_date?: string | null;
  total_amount?: number | string | null;
  status?: string | null;
  remarks?: string | null;
  version?: number | string | null;
};

type ExpenseDraftLogRow = {
  log_id?: number | string;
  expense_id?: number | string | null;
  action?: string | null;
  changed_by?: number | string | DirectusUserRow | null;
  changed_at?: string | null;
  amount?: number | string | null;
  remarks?: string | null;
  particulars?: number | string | DirectusCoaRow | null;
  status?: string | null;
  version?: number | string | null;
};



type ItemDecision = {
  status: VoteStatus;
  remarks: string;
};

type PostBody = {
  draft_id: number;
  status: VoteStatus;
  remarks?: string;
  edited_payables?: {
    id: number;
    amount: string | number;
  }[];
  item_decisions?: Record<string, ItemDecision>;
};

function json(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const h: Record<string, string> = { Accept: "application/json" };
  if (STATIC_TOKEN) h.Authorization = `Bearer ${STATIC_TOKEN}`;
  return { ...h, ...extra };
}

async function directusFetch(path: string, init?: RequestInit) {
  if (!DIRECTUS_BASE) {
    return {
      ok: false,
      status: 500,
      data: { error: "NEXT_PUBLIC_API_BASE_URL not set" },
    };
  }

  const cookieStore = await cookies();
  const userToken = cookieStore.get(COOKIE_NAME)?.value;

  const initHeaders = (init?.headers ?? {}) as Record<string, string | boolean | undefined>;

  const computedHeaders: Record<string, string> = {
    ...authHeaders(),
  };

  for (const [key, value] of Object.entries(initHeaders)) {
    if (typeof value === "string") computedHeaders[key] = value;
  }

  if (initHeaders["X-Force-User-Token"] || (!computedHeaders.Authorization && userToken)) {
    if (userToken) computedHeaders.Authorization = `Bearer ${userToken}`;
    delete computedHeaders["X-Force-User-Token"];
  }

  const url = `${DIRECTUS_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

  let res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: computedHeaders,
  });

  if (!res.ok && res.status === 403 && userToken && !initHeaders["X-Force-User-Token"]) {
    res = await fetch(url, {
      cache: "no-store",
      ...init,
      headers: {
        ...computedHeaders,
        Authorization: `Bearer ${userToken}`,
      },
    });
  }

  let data: unknown = null;
  const ct = res.headers.get("content-type") || "";

  if (ct.includes("application/json")) data = await res.json();
  else data = await res.text();

  return {
    ok: res.ok,
    status: res.status,
    data,
  };
}

function decodeJwtSub(token: string): number | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const p = parts[1];
    const b64 = p.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

    const payload = JSON.parse(
      Buffer.from(padded, "base64").toString("utf8")
    ) as Record<string, unknown>;

    const sub = payload.sub ?? payload.user_id ?? payload.id;
    const n = Number(sub);

    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function toNumericId(val: unknown): number | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val === "string") {
    const n = parseInt(val, 10);
    return isNaN(n) ? null : n;
  }
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const raw =
      obj.division_id ??
      obj.coa_id ??
      obj.expense_id ??
      obj.user_id ??
      obj.id ??
      obj.value;

    if (raw === null || raw === undefined || raw === "" || typeof raw === "object") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toNumber(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function toStringOrNull(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val);
  return s.trim() ? s : null;
}

function resolveAttachmentId(val: unknown): string | null {
  if (val === null || val === undefined) return null;

  if (typeof val === "string") return val.trim() || null;
  if (typeof val === "number") return String(val);

  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const id = obj.id ?? obj.uuid ?? obj.directus_files_id;
    return typeof id === "string" ? id : null;
  }

  return null;
}

function nowManila(): string {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Manila" })
    .replace(" ", "T");
}

function parseTier(status: string): number {
  if (!status) return 1;

  const s = status.toUpperCase();

  if (s === "SUBMITTED") return 1;

  const m = s.match(/PENDING_L(\d+)/);
  if (m) return parseInt(m[1], 10);

  return 1;
}

function tierStatus(tier: number): DraftLifecycleStatus {
  if (tier <= 1) return "Submitted";
  return `Pending_L${tier}`;
}

function getWeekStart(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function getWeekEndFromStart(weekStart: string): string {
  const s = new Date(`${weekStart}T00:00:00`);
  return format(endOfWeek(s, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

function hashVirtualKey(key: string): number {
  const hash = key.split("").reduce((acc, char) => {
    const next = (acc << 5) - acc + char.charCodeAt(0);
    return next & next;
  }, 0);

  return Math.abs(hash) * -1;
}

function getVirtualDraftKey(params: {
  encoder_id: number;
  division_id: number;
  week_start: string;
  tier: number;
}) {
  return `returned-${params.encoder_id}-${params.division_id}-${params.week_start}-${params.tier}`;
}

function getVirtualDraftId(params: {
  encoder_id: number;
  division_id: number;
  week_start: string;
  tier: number;
}) {
  return hashVirtualKey(getVirtualDraftKey(params));
}

function buildFilterQuery(filter: Record<string, unknown>, fields: string, extra?: Record<string, string>) {
  const query = new URLSearchParams({
    filter: JSON.stringify(filter),
    fields,
    limit: "-1",
    ...(extra ?? {}),
  });

  return query.toString();
}

function getUserDisplayName(row?: DirectusUserRow | null, fallback?: string) {
  if (!row) return fallback ?? "Unknown";

  const first = row.user_fname?.trim() ?? "";
  const middle = row.user_mname?.trim() ?? "";
  const last = row.user_lname?.trim() ?? "";
  const suffix = row.suffix_name?.trim() ?? "";

  const fullName = [first, middle, last, suffix]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (fullName) return fullName;
  if (row.nickname?.trim()) return row.nickname.trim();
  if (row.user_email?.trim()) return row.user_email.trim();

  return fallback || "Unknown";
}

function getDivisionName(row?: DirectusDivisionRow | null, fallback?: string) {
  if (!row) return fallback ?? "N/A";

  const name = row.division_name?.trim();
  if (name) return name;

  const code = row.division_code?.trim();
  if (code) return code;

  return fallback || "N/A";
}

async function getCurrentUserId(): Promise<number | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? null;
  return token ? decodeJwtSub(token) : null;
}

async function getApproverRecords(userId: number): Promise<ApproverRecord[]> {
  const res = await directusFetch(
    `/items/disbursement_draft_approver?filter[approver_id][_eq]=${userId}&filter[is_deleted][_eq]=0&fields=id,approver_id,approver_heirarchy,division_id.division_id,division_id.division_name&limit=-1&sort=-id`
  );

  if (!res.ok) return [];

  const rows =
    (res.data as DirectusListResponse<DirectusApproverRow>)?.data ?? [];

  return rows
    .map((r) => ({
      id: toNumber(r.id),
      approver_id: toNumericId(r.approver_id) ?? 0,
      division_id: toNumericId(r.division_id) ?? 0,
      division_name: typeof r.division_id === "object" && r.division_id !== null ? (r.division_id as DirectusDivisionRow).division_name : `Division #${r.division_id}`,
      approver_heirarchy: toNumber(r.approver_heirarchy, 1),
    }))
    .filter((r) => r.approver_id > 0 && r.division_id > 0);
}

async function getAllApproversForDivisions(divisionIds: number[]) {
  if (!divisionIds.length) return [];

  const res = await directusFetch(
    `/items/disbursement_draft_approver?filter[division_id][_in]=${divisionIds.join(
      ","
    )}&filter[is_deleted][_eq]=0&fields=id,approver_id,division_id,approver_heirarchy&limit=-1`
  );

  if (!res.ok) return [];

  const rows =
    (res.data as DirectusListResponse<DirectusApproverRow>)?.data ?? [];

  return rows
    .map((r) => ({
      id: toNumber(r.id),
      approver_id: toNumericId(r.approver_id) ?? 0,
      division_id: toNumericId(r.division_id) ?? 0,
      approver_heirarchy: toNumber(r.approver_heirarchy, 1),
    }))
    .filter((r) => r.approver_id > 0 && r.division_id > 0);
}

function buildApproverStats(allApprovers: ApproverRecord[]) {
  const maxLevelByDivision: Record<number, number> = {};
  const approversPerLevelByDivision: Record<number, Record<number, number>> = {};

  for (const row of allApprovers) {
    maxLevelByDivision[row.division_id] = Math.max(
      maxLevelByDivision[row.division_id] ?? 1,
      row.approver_heirarchy
    );

    if (!approversPerLevelByDivision[row.division_id]) {
      approversPerLevelByDivision[row.division_id] = {};
    }

    approversPerLevelByDivision[row.division_id][row.approver_heirarchy] =
      (approversPerLevelByDivision[row.division_id][row.approver_heirarchy] ??
        0) + 1;
  }

  return {
    maxLevelByDivision,
    approversPerLevelByDivision,
  };
}

function buildLevelsByDivision(approverRecords: ApproverRecord[]) {
  const levelsByDivision: Record<number, number[]> = {};

  for (const record of approverRecords) {
    if (!levelsByDivision[record.division_id]) levelsByDivision[record.division_id] = [];
    if (!levelsByDivision[record.division_id].includes(record.approver_heirarchy)) {
      levelsByDivision[record.division_id].push(record.approver_heirarchy);
    }
  }

  for (const divisionId of Object.keys(levelsByDivision)) {
    levelsByDivision[Number(divisionId)].sort((a, b) => a - b);
  }

  return levelsByDivision;
}

async function fetchUserMap(userIds: number[]) {
  const uniqueIds = [
    ...new Set(userIds.filter((id) => Number.isFinite(id) && id > 0)),
  ];

  const map = new Map<number, string>();

  if (!uniqueIds.length) return map;

  const res = await directusFetch(
    `/items/user?filter[user_id][_in]=${uniqueIds.join(
      ","
    )}&fields=user_id,user_fname,user_mname,user_lname,suffix_name,nickname,user_email&limit=-1`
  );

  if (!res.ok) {
    console.error("[fetchUserMap] Directus lookup failed:", res.status, res.data);
    return map;
  }

  const rows = (res.data as DirectusListResponse<DirectusUserRow>).data ?? [];

  for (const row of rows) {
    const userId = toNumericId(row.user_id);
    if (!userId) continue;
    map.set(userId, getUserDisplayName(row, `User #${userId}`));
  }

  return map;
}

async function fetchSupplierMap(supplierIds: number[]) {
  const uniqueIds = [
    ...new Set(supplierIds.filter((id) => Number.isFinite(id) && id > 0)),
  ];

  const map = new Map<number, string>();

  if (!uniqueIds.length) return map;

  const res = await directusFetch(
    `/items/suppliers?filter[id][_in]=${uniqueIds.join(
      ","
    )}&fields=id,supplier_name,supplier_shortcut,contact_person,email_address,phone_number,isActive&limit=-1`
  );

  if (!res.ok) {
    console.error("[fetchSupplierMap] Directus lookup failed:", res.status, res.data);
    return map;
  }

  const rows = (res.data as DirectusListResponse<DirectusSupplierRow>).data ?? [];

  for (const row of rows) {
    const supplierId = toNumericId(row.id);
    if (!supplierId) continue;

    const supplierName =
      row.supplier_name?.trim() ||
      row.supplier_shortcut?.trim() ||
      row.contact_person?.trim() ||
      row.email_address?.trim() ||
      `Supplier #${supplierId}`;

    map.set(supplierId, supplierName);
  }

  return map;
}

async function fetchDivisionMap(divisionIds: number[]) {
  const uniqueIds = [
    ...new Set(divisionIds.filter((id) => Number.isFinite(id) && id > 0)),
  ];

  const map = new Map<number, string>();

  if (!uniqueIds.length) return map;

  const res = await directusFetch(
    `/items/division?filter[division_id][_in]=${uniqueIds.join(
      ","
    )}&fields=division_id,division_name,division_code,division_description&limit=-1`
  );

  if (!res.ok) {
    console.error("[fetchDivisionMap] Directus lookup failed:", res.status, res.data);
    return map;
  }

  const rows = (res.data as DirectusListResponse<DirectusDivisionRow>).data ?? [];

  for (const row of rows) {
    const divisionId = toNumericId(row.division_id);
    if (!divisionId) continue;
    map.set(divisionId, getDivisionName(row, `Division #${divisionId}`));
  }

  return map;
}

async function fetchCoaMap(coaIds: number[]) {
  const uniqueIds = [
    ...new Set(coaIds.filter((id) => Number.isFinite(id) && id > 0)),
  ];

  const map = new Map<number, string>();

  if (!uniqueIds.length) return map;

  const res = await directusFetch(
    `/items/chart_of_accounts?filter[coa_id][_in]=${uniqueIds.join(
      ","
    )}&fields=coa_id,gl_code,account_title&limit=-1`
  );

  if (!res.ok) {
    console.error("[fetchCoaMap] Directus lookup failed:", res.status, res.data);
    return map;
  }

  const rows = (res.data as DirectusListResponse<DirectusCoaRow>).data ?? [];

  for (const row of rows) {
    const coaId = toNumericId(row.coa_id);
    if (!coaId) continue;
    const title = row.account_title?.trim();
    map.set(coaId, title || `COA #${coaId}`);
  }

  return map;
}

async function fetchMyVotes(draftIds: number[], userId: number) {
  const uniqueIds = [...new Set(draftIds.filter((id) => id > 0))];
  const map = new Map<string, { status: string; created_at: string; version: number }>();

  if (!uniqueIds.length) return map;

  const res = await directusFetch(
    `/items/disbursement_draft_approvals?filter[draft_id][_in]=${uniqueIds.join(
      ","
    )}&filter[approver_id][_eq]=${userId}&fields=draft_id,status,created_at,version&limit=-1`
  );

  if (!res.ok) return map;

  const rows = (res.data as DirectusListResponse<ApprovalVoteRow>).data ?? [];

  for (const row of rows) {
    const draftId = toNumericId(row.draft_id);
    const version = toNumber(row.version, 1);

    if (!draftId) continue;

    map.set(`${draftId}:${version}`, {
      status: row.status ?? "",
      created_at: row.created_at ?? "",
      version,
    });
  }

  return map;
}

function canUserVote(params: {
  approverRecords: ApproverRecord[];
  divisionId: number;
  currentTier: number;
  myVote: { status: string; created_at: string; version: number } | null;
}) {
  if (params.myVote) return false;

  return params.approverRecords.some(
    (r) => {
      const rDivId = toNumericId(r.division_id);
      return rDivId === params.divisionId && 
             toNumber(r.approver_heirarchy) === params.currentTier;
    }
  );
}

async function recalcDraftTotal(draftId: number) {
  const res = await directusFetch(
    `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&fields=amount&limit=-1`
  );

  const rows =
    (res.data as DirectusListResponse<{ amount?: number | string | null }>)
      .data ?? [];

  const total = rows.reduce((sum, row) => sum + toNumber(row.amount), 0);

  await directusFetch(`/items/disbursement_draft/${draftId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ total_amount: total }),
  });

  return total;
}

async function resolveVirtualItemsById(virtualId: number, allowedDivisionIds: number[]) {
  const res = await directusFetch(
    `/items/expense_draft?filter[status][_eq]=Approved&filter[return_to][_nnull]=true&filter[division_id][_in]=${allowedDivisionIds.join(
      ","
    )}&fields=id,amount,remarks,transaction_date,division_id,encoder_id,return_to,particulars,attachment_url,feedback,status&limit=-1`
  );

  if (!res.ok) {
    return {
      ok: false as const,
      status: res.status,
      data: res.data,
      items: [] as ExpenseDraftRow[],
    };
  }

  const allReturned = (res.data as DirectusListResponse<ExpenseDraftRow>).data ?? [];

  const items = allReturned.filter((item) => {
    const encoderId = toNumericId(item.encoder_id);
    const divisionId = toNumericId(item.division_id);
    const transactionDate = toStringOrNull(item.transaction_date);
    const tier = parseInt(String(item.return_to ?? "").replace(/\D/g, ""), 10) || 1;

    if (!encoderId || !divisionId || !transactionDate) return false;

    const weekStart = getWeekStart(transactionDate);

    return (
      getVirtualDraftId({
        encoder_id: encoderId,
        division_id: divisionId,
        week_start: weekStart,
        tier,
      }) === virtualId
    );
  });

  return {
    ok: true as const,
    status: 200,
    data: null,
    items,
  };
}

async function buildVoteHistory(params: {
  draftId: number;
  currentVersion: number;
  draftStatus: string;
  divisionId: number;
}) {
  const approversRes = await directusFetch(
    `/items/disbursement_draft_approver?filter[division_id][_eq]=${params.divisionId}&filter[is_deleted][_eq]=0&fields=approver_id,approver_heirarchy&limit=-1`
  );

  const approverRows =
    (approversRes.data as DirectusListResponse<DirectusApproverRow>)?.data ?? [];

  const approvers = approverRows.map((r) => ({
    approver_id: toNumericId(r.approver_id) ?? 0,
    level: toNumber(r.approver_heirarchy, 1),
  }));

  const levelByApprover = new Map<number, number>();
  for (const a of approvers) levelByApprover.set(a.approver_id, a.level);

  const votesRes = await directusFetch(
    `/items/disbursement_draft_approvals?filter[draft_id][_eq]=${params.draftId}&fields=approver_id,status,remarks,version,created_at,approver_heirarchy&sort=version,created_at&limit=-1`
  );

  const votes =
    (votesRes.data as DirectusListResponse<ApprovalVoteRow>)?.data ?? [];

  // Collect ALL relevant IDs for user resolution (approvers + voters)
  const allUserIds = new Set<number>();
  approvers.forEach(a => allUserIds.add(a.approver_id));
  votes.forEach(v => {
    const vid = toNumericId(v.approver_id);
    if (vid) allUserIds.add(vid);
  });

  const userMap = await fetchUserMap([...allUserIds]);

  const versionSet = new Set<number>();
  versionSet.add(params.currentVersion);
  for (const v of votes) {
    versionSet.add(toNumber(v.version, 1));
  }

  const rounds: LogRoundResponse[] = [...versionSet]
    .sort((a, b) => a - b)
    .map((version) => {
      const roundVotes = votes
        .filter((v) => toNumber(v.version, 1) === version)
        .map((v) => {
          const approverId = toNumericId(v.approver_id) ?? 0;
          return {
            approver_id: approverId,
            name: userMap.get(approverId) ?? `User #${approverId}`,
            level: toNumber(v.approver_heirarchy) || levelByApprover.get(approverId) || 1,
            status: v.status ?? "",
            remarks: v.remarks ?? null,
            created_at: v.created_at ?? "",
          };
        });

      const isCurrent = version === params.currentVersion;

      let outcome = "IN_PROGRESS";
      if (!isCurrent) {
        if (roundVotes.some(v => v.status === "REJECTED")) outcome = "REJECTED";
        else if (roundVotes.some(v => v.status === "WITH_CONCERN")) outcome = "WITH_CONCERN";
        else outcome = "SUPERSEDED";
      } else {
        if (params.draftStatus === "Approved") outcome = "FINAL_APPROVED";
        else if (params.draftStatus === "Rejected") outcome = "REJECTED";
        else if (params.draftStatus === "With Concern") outcome = "WITH_CONCERN";
        else if (params.draftStatus.startsWith("Pending_")) outcome = "IN_PROGRESS";
        else outcome = "SUBMITTED";
      }

      return {
        version,
        is_current: isCurrent,
        outcome,
        votes: roundVotes,
      };
    });

  return rounds;
}

async function buildApproversByLevel(params: {
  divisionId: number;
  draftId: number;
  currentVersion: number;
}) {
  const approversRes = await directusFetch(
    `/items/disbursement_draft_approver?filter[division_id][_eq]=${params.divisionId}&filter[is_deleted][_eq]=0&fields=approver_id,approver_heirarchy&limit=-1`
  );

  const approvers =
    (approversRes.data as DirectusListResponse<DirectusApproverRow>)?.data ?? [];

  const approverIds = approvers
    .map((r) => toNumericId(r.approver_id))
    .filter((id): id is number => Boolean(id));

  const userMap = await fetchUserMap(approverIds);

  const votesRes = await directusFetch(
    `/items/disbursement_draft_approvals?filter[draft_id][_eq]=${params.draftId}&filter[version][_eq]=${params.currentVersion}&fields=approver_id,status,remarks,created_at,version&limit=-1`
  );

  const votes =
    (votesRes.data as DirectusListResponse<ApprovalVoteRow>)?.data ?? [];

  const voteMap = new Map<number, ApprovalVoteRow>();

  for (const vote of votes) {
    const approverId = toNumericId(vote.approver_id);
    if (approverId) voteMap.set(approverId, vote);
  }

  const grouped: Record<
    number,
    {
      approver_id: number;
      name: string;
      level: number;
      vote: {
        status: string;
        remarks: string | null;
        created_at: string;
        version: number;
      } | null;
    }[]
  > = {};

  for (const row of approvers) {
    const approverId = toNumericId(row.approver_id) ?? 0;
    const level = toNumber(row.approver_heirarchy, 1);
    const vote = voteMap.get(approverId);

    if (!grouped[level]) grouped[level] = [];

    grouped[level].push({
      approver_id: approverId,
      name: userMap.get(approverId) ?? `User #${approverId}`,
      level,
      vote: vote
        ? {
          status: vote.status ?? "",
          remarks: vote.remarks ?? null,
          created_at: vote.created_at ?? "",
          version: toNumber(vote.version, params.currentVersion),
        }
        : null,
    });
  }

  return grouped;
}

async function createExpenseLog(params: {
  expenseId: number;
  action: string;
  changedBy: number;
  changedAt: string;
  amount?: number | string | null;
  remarks?: string | null;
  status: string;
}) {
  await directusFetch(`/items/expense_draft_logs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      expense_id: params.expenseId,
      action: params.action,
      changed_by: params.changedBy,
      changed_at: params.changedAt,
      amount: params.amount ?? 0,
      remarks: params.remarks ?? null,
      status: params.status,
    }),
  });
}

async function insertExpenseIntoPayableDraft(params: {
  draftId: number;
  expense: ExpenseDraftRow;
  referenceNo?: string | null;
}) {
  const expenseId = toNumericId(params.expense.id);
  const divisionId = toNumericId(params.expense.division_id);
  const coaId = toNumericId(params.expense.particulars);

  if (!expenseId || !divisionId || !coaId) {
    return {
      ok: false,
      error: "Invalid expense data for payable draft insertion.",
    };
  }

  // If a payable already exists for this expense (e.g. from a previous submission before
  // a With Concern correction), update its amount/remarks from the current expense_draft
  // instead of inserting a duplicate.
  const existingRes = await directusFetch(
    `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${params.draftId}&filter[expense_id][_eq]=${expenseId}&fields=id&limit=1`
  );
  const existing = (existingRes.data as DirectusListResponse<{ id: number }>)?.data?.[0];
  if (existing) {
    const newAmount = params.expense.amount ?? 0;
    await directusFetch(`/items/disbursement_payables_draft/${existing.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amount: newAmount,
        remarks: params.expense.remarks ?? null,
        date: params.expense.transaction_date ?? null,
      }),
    });
    console.log(`[insertExpenseIntoPayableDraft] Updated existing payable ${existing.id} for expense ${expenseId} with new amount ${newAmount}.`);
    return { ok: true, error: null };
  }

  const res = await directusFetch(`/items/disbursement_payables_draft`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      disbursement_id: params.draftId,
      division_id: divisionId,
      coa_id: coaId,
      amount: params.expense.amount ?? 0,
      remarks: params.expense.remarks ?? null,
      date: params.expense.transaction_date ?? null,
      expense_id: expenseId,
      reference_no: params.referenceNo ?? null,
    }),
  });

  if (!res.ok) {
    console.error(`[insertExpenseIntoPayableDraft] FAILED for expense ${expenseId} into draft ${params.draftId}:`, res.data);
    return {
      ok: false,
      error: res.data,
    };
  }

  console.log(`[insertExpenseIntoPayableDraft] SUCCESS for expense ${expenseId} into draft ${params.draftId}`);
  return {
    ok: true,
    error: null,
  };
}

async function fetchExpenseById(expenseId: number) {
  const res = await directusFetch(
    `/items/expense_draft?filter[id][_eq]=${expenseId}&fields=id,amount,remarks,transaction_date,division_id,encoder_id,return_to,particulars,attachment_url,feedback,status&limit=1`
  );

  if (!res.ok) return null;

  return ((res.data as DirectusListResponse<ExpenseDraftRow>).data ?? [])[0] ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return json({ error: "Unauthorized" }, { status: 401 });

    const approverRecords = await getApproverRecords(currentUserId);
    if (!approverRecords.length) return json({ error: "Forbidden" }, { status: 403 });

    const myDivisionIds = [...new Set(approverRecords.map((r) => r.division_id))];
    const levelsByDivision = buildLevelsByDivision(approverRecords);
    const myLevel = approverRecords[0]?.approver_heirarchy ?? 0;

    const allApprovers = await getAllApproversForDivisions(myDivisionIds);
    const { maxLevelByDivision, approversPerLevelByDivision } =
      buildApproverStats(allApprovers);

    const sp = req.nextUrl.searchParams;
    const resource = sp.get("resource") || "drafts";

    if (resource === "my-access") {
      return json({
        data: approverRecords,
      });
    }


    if (resource === "drafts") {
      const filterDivId = toNumericId(sp.get("divisionId"));

      // Build the draft list URL using explicit Directus bracket-notation for
      // array filters. JSON.stringify passes an array as a single string value
      // which Directus does not interpret as a _nin array — bracket params are
      // the correct serialization.
      const divisionFilter = filterDivId
        ? `filter[division_id][_eq]=${filterDivId}`
        : myDivisionIds.map((id) => `filter[division_id][_in][]=${id}`).join("&");

      const excludedStatuses = ["Approved", "Rejected", "With Concern"];
      const statusFilter = excludedStatuses
        .map((s) => `filter[status][_nin][]=${encodeURIComponent(s)}`)
        .join("&");

      const draftFields =
        "id,doc_no,payee,total_amount,remarks,status,approval_version,version,transaction_date,division_id,department_id,encoder_id,transaction_type,supporting_documents_url,date_created,date_updated";

      const draftRes = await directusFetch(
        `/items/disbursement_draft?${divisionFilter}&${statusFilter}&fields=${draftFields}&limit=-1&sort=-id`
      );
      if (!draftRes.ok) return json(draftRes.data, { status: draftRes.status });

      const allFetchedDrafts =
        (draftRes.data as DirectusListResponse<DisbursementDraftRow>).data ?? [];

      // Safety net: strip any records the DB filter may have missed (e.g. existing
      // malformed data where status was incorrectly set before the bug fix).
      const EXCLUDED_STATUSES = new Set(["Approved", "Rejected", "With Concern"]);
      const realDrafts = allFetchedDrafts.filter(
        (d) => !EXCLUDED_STATUSES.has(d.status ?? "")
      );

      const returnedFilter: Record<string, unknown> = {
        status: {
          _eq: "Approved",
        },
        return_to: {
          _nnull: true,
        },
        division_id: {
          _in: myDivisionIds,
        },
      };

      const returnedQuery = buildFilterQuery(
        returnedFilter,
        "id,amount,remarks,transaction_date,division_id,encoder_id,return_to,particulars,attachment_url,feedback,status"
      );

      const returnedRes = await directusFetch(`/items/expense_draft?${returnedQuery}`);

      const returnedRows =
        (returnedRes.data as DirectusListResponse<ExpenseDraftRow>).data ?? [];

      const supplierIds = new Set<number>();
      const userIds = new Set<number>();
      const divisionIds = new Set<number>();

      for (const draft of realDrafts) {
        const supplierId = toNumericId(draft.payee);
        const encoderId = toNumericId(draft.encoder_id);
        const divisionId = toNumericId(draft.division_id);

        if (supplierId) supplierIds.add(supplierId);
        if (encoderId) userIds.add(encoderId);
        if (divisionId) divisionIds.add(divisionId);
      }

      for (const item of returnedRows) {
        const encoderId = toNumericId(item.encoder_id);
        const divisionId = toNumericId(item.division_id);

        if (encoderId) userIds.add(encoderId);
        if (divisionId) divisionIds.add(divisionId);
      }

      const [supplierMap, userMap, divisionMap, myVotes] = await Promise.all([
        fetchSupplierMap([...supplierIds]),
        fetchUserMap([...userIds]),
        fetchDivisionMap([...divisionIds]),
        fetchMyVotes(
          realDrafts
            .map((d) => toNumericId(d.id))
            .filter((id): id is number => Boolean(id)),
          currentUserId
        ),
      ]);

      const realRows: DraftRowResponse[] = realDrafts.map((draft) => {
        const draftId = toNumericId(draft.id) ?? 0;
        const divisionId = toNumericId(draft.division_id) ?? 0;
        const payeeId = toNumericId(draft.payee) ?? 0;
        const encoderId = toNumericId(draft.encoder_id) ?? 0;
        const approvalVersion = toNumber(draft.approval_version, 1);
        const status = draft.status ?? "Submitted";
        const currentTier = parseTier(status);
        const myVote = myVotes.get(`${draftId}:${approvalVersion}`) ?? null;

        return {
          id: draftId,
          doc_no: draft.doc_no ?? `DRAFT-${draftId}`,
          payee_user_id: payeeId,
          payee_name: supplierMap.get(payeeId) ?? `Supplier #${payeeId}`,
          encoder_name: userMap.get(encoderId) ?? `User #${encoderId}`,
          total_amount: toNumber(draft.total_amount),
          remarks: draft.remarks ?? null,
          status,
          division_name: divisionMap.get(divisionId) ?? `Division #${divisionId}`,
          approval_version: approvalVersion,
          transaction_date: draft.transaction_date ?? null,
          date_created: draft.date_created ?? draft.transaction_date ?? "",
          current_tier: currentTier,
          max_level: maxLevelByDivision[divisionId] ?? currentTier,
          approvers_per_level: approversPerLevelByDivision[divisionId] ?? {},
          my_vote: myVote,
          can_vote: canUserVote({
            approverRecords,
            divisionId,
            currentTier,
            myVote,
          }),
          has_concern:
            status.toLowerCase() === "with concern" ||
            Boolean(draft.remarks?.includes("[Contains Returned Items]")),
        };
      });

      type VirtualGroup = {
        id: number;
        encoder_id: number;
        division_id: number;
        week_start: string;
        tier: number;
        total_amount: number;
        item_count: number;
        transaction_date: string;
      };

      const virtualMap = new Map<string, VirtualGroup>();

      for (const item of returnedRows) {
        const encoderId = toNumericId(item.encoder_id);
        const divisionId = toNumericId(item.division_id);
        const transactionDate = toStringOrNull(item.transaction_date);
        const tier = parseInt(String(item.return_to ?? "").replace(/\D/g, ""), 10) || 1;

        if (!encoderId || !divisionId || !transactionDate) continue;

        const weekStart = getWeekStart(transactionDate);
        const key = getVirtualDraftKey({
          encoder_id: encoderId,
          division_id: divisionId,
          week_start: weekStart,
          tier,
        });

        const existing = virtualMap.get(key);

        if (existing) {
          existing.total_amount += toNumber(item.amount);
          existing.item_count += 1;
        } else {
          virtualMap.set(key, {
            id: hashVirtualKey(key),
            encoder_id: encoderId,
            division_id: divisionId,
            week_start: weekStart,
            tier,
            total_amount: toNumber(item.amount),
            item_count: 1,
            transaction_date: transactionDate,
          });
        }
      }

      const virtualRows: DraftRowResponse[] = Array.from(virtualMap.values()).map(
        (v) => ({
          id: v.id,
          doc_no: `RETURNED-${Math.abs(v.id)}`,
          payee_user_id: v.encoder_id,
          payee_name: userMap.get(v.encoder_id) ?? `User #${v.encoder_id}`,
          encoder_name: userMap.get(v.encoder_id) ?? `User #${v.encoder_id}`,
          total_amount: v.total_amount,
          remarks: `[Contains Returned Items] ${v.item_count} returned item(s) for re-verification.`,
          status: tierStatus(v.tier),
          division_name:
            divisionMap.get(v.division_id) ?? `Division #${v.division_id}`,
          approval_version: 1,
          transaction_date: v.transaction_date,
          date_created: v.transaction_date,
          current_tier: v.tier,
          max_level: maxLevelByDivision[v.division_id] ?? v.tier,
          approvers_per_level: approversPerLevelByDivision[v.division_id] ?? {},
          my_vote: null,
          can_vote: approverRecords.some(
            (r) =>
              r.division_id === v.division_id &&
              r.approver_heirarchy === v.tier
          ),
          has_concern: status.toLowerCase() === "with concern",
        })
      );

      const data = [...realRows, ...virtualRows].sort((a, b) => {
        const aDate = a.transaction_date ?? "";
        const bDate = b.transaction_date ?? "";
        return bDate.localeCompare(aDate);
      });

      return json({
        data,
        myLevel,
        levelsByDivision,
      });
    }

    if (resource === "draft-detail") {
      const draftIdRaw = sp.get("id") || sp.get("draft_id");
      if (!draftIdRaw) {
        return json({ error: "id or draft_id is required" }, { status: 400 });
      }

      const draftId = Number(draftIdRaw);
      const isVirtual = draftId < 0;

      if (isVirtual) {
        const resolved = await resolveVirtualItemsById(draftId, myDivisionIds);

        if (!resolved.ok) return json(resolved.data, { status: resolved.status });
        if (!resolved.items.length) {
          return json({ error: "Virtual draft not found" }, { status: 404 });
        }

        const first = resolved.items[0];
        const encoderId = toNumericId(first.encoder_id) ?? 0;
        const divisionId = toNumericId(first.division_id) ?? 0;
        const tier = parseInt(String(first.return_to ?? "").replace(/\D/g, ""), 10) || 1;
        const total = resolved.items.reduce(
          (sum, item) => sum + toNumber(item.amount),
          0
        );

        if (!myDivisionIds.includes(divisionId)) {
          return json({ error: "Forbidden" }, { status: 403 });
        }

        const coaIds = resolved.items
          .map((item) => toNumericId(item.particulars))
          .filter((id): id is number => Boolean(id));

        const [coaMap, userMap, divisionMap] = await Promise.all([
          fetchCoaMap(coaIds),
          fetchUserMap([encoderId]),
          fetchDivisionMap([divisionId]),
        ]);

        const payables: PayableResponse[] = resolved.items.map((item) => {
          const expenseId = toNumericId(item.id) ?? 0;
          const coaId = toNumericId(item.particulars) ?? 0;

          return {
            id: -expenseId,
            coa_id: coaId,
            coa_name: coaMap.get(coaId) ?? `COA #${coaId}`,
            amount: toNumber(item.amount),
            remarks: item.remarks ?? null,
            date: item.transaction_date ?? null,
            reference_no: null,
            attachment_url: resolveAttachmentId(item.attachment_url),
            is_concern: item.status === "With Concern",
            is_rejected: item.status === "Rejected",
            feedback: item.feedback ?? null,
            expense_id: expenseId,
          };
        });

        return json({
          draft: {
            id: draftId,
            doc_no: `RETURNED-${Math.abs(draftId)}`,
            payee_user_id: encoderId,
            payee_name: userMap.get(encoderId) ?? `User #${encoderId}`,
            encoder_user_id: encoderId,
            encoder_name: userMap.get(encoderId) ?? `User #${encoderId}`,
            total_amount: total,
            remarks: `[Virtual Returned Batch] ${resolved.items.length} item(s) for re-verification.`,
            status: tierStatus(tier),
            approval_version: 1,
            transaction_date: first.transaction_date ?? null,
            date_created: first.transaction_date ?? "",
            current_tier: tier,
            max_level: maxLevelByDivision[divisionId] ?? tier,
            transaction_type: 2,
            division_name: divisionMap.get(divisionId) ?? `Division #${divisionId}`,
          },
          payables,
          concern_items: [],
          approvers_by_level: {},
          vote_history: [],
          logs: [],
          expense_logs: [],
          my_level: tier,
          my_vote: null,
          can_vote: approverRecords.some(
            (r) =>
              r.division_id === divisionId &&
              r.approver_heirarchy === tier
          ),
        });
      }

      const draftRes = await directusFetch(
        `/items/disbursement_draft?filter[id][_eq]=${draftId}&fields=id,doc_no,payee,total_amount,remarks,status,approval_version,version,transaction_date,division_id,department_id,encoder_id,transaction_type,supporting_documents_url,date_created,date_updated&limit=1`
      );

      if (!draftRes.ok) return json(draftRes.data, { status: draftRes.status });

      const draft =
        ((draftRes.data as DirectusListResponse<DisbursementDraftRow>).data ??
          [])[0];

      if (!draft) return json({ error: "Draft not found" }, { status: 404 });

      const divisionId = toNumericId(draft.division_id) ?? 0;

      if (!myDivisionIds.includes(divisionId)) {
        return json({ error: "Forbidden" }, { status: 403 });
      }

      const pRes = await directusFetch(
        `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&fields=id,coa_id,amount,reference_no,remarks,date,expense_id.id,expense_id.status,expense_id.feedback,expense_id.attachment_url,expense_id.return_to,expense_id.header_id&limit=-1`
      );

      const payablesRaw =
        (pRes.data as DirectusListResponse<DisbursementPayableDraftRow>).data ??
        [];

      const coaIds = payablesRaw
        .map((p) => toNumericId(p.coa_id))
        .filter((id): id is number => Boolean(id));



      const headerIds = [
        ...new Set([
          ...payablesRaw.map(p => typeof p.expense_id === "object" ? toNumericId(p.expense_id?.header_id) : null),
        ].filter((id): id is number => Boolean(id)))
      ];

      // Fetch ALL expenses for these headers to include Rejected/Concern items
      const allExpensesRes = headerIds.length > 0 
        ? await directusFetch(`/items/expense_draft?filter[header_id][_in]=${headerIds.join(",")}&fields=id,amount,remarks,transaction_date,particulars,attachment_url,feedback,return_to,status,header_id&limit=-1`)
        : { ok: true, data: { data: [] } };
      
      const allExpenses = (allExpensesRes.data as DirectusListResponse<ExpenseDraftRow>).data ?? [];
      const payableExpenseIds = new Set(payablesRaw.map(p => typeof p.expense_id === "object" ? toNumericId(p.expense_id?.id) : toNumericId(p.expense_id)).filter(id => !!id));

      const rawConcerns = allExpenses.filter(e => !payableExpenseIds.has(toNumericId(e.id)));

      const concernCoaIds = rawConcerns
        .map((c) => toNumericId(c.particulars))
        .filter((id): id is number => Boolean(id));

      const payeeId = toNumericId(draft.payee) ?? 0;
      const encoderId = toNumericId(draft.encoder_id) ?? 0;

      const [coaMap, supplierMap, userMap, divisionMap, voteHistory, approversByLevel] =
        await Promise.all([
          fetchCoaMap([...coaIds, ...concernCoaIds]),
          fetchSupplierMap([payeeId]),
          fetchUserMap([encoderId]),
          fetchDivisionMap([divisionId]),
          buildVoteHistory({
            draftId,
            currentVersion: toNumber(draft.approval_version, 1),
            draftStatus: draft.status ?? "Submitted",
            divisionId,
          }),
          buildApproversByLevel({
            divisionId,
            draftId,
            currentVersion: toNumber(draft.approval_version, 1),
          }),
        ]);

      const currentTier = parseTier(draft.status ?? "Submitted");
      const approvalVersion = toNumber(draft.approval_version, 1);
      const myVotes = await fetchMyVotes([draftId], currentUserId);
      const myVote = myVotes.get(`${draftId}:${approvalVersion}`) ?? null;

      const payables: PayableResponse[] = payablesRaw.map((p) => {
        const coaId = toNumericId(p.coa_id) ?? 0;
        const expenseObj =
          typeof p.expense_id === "object" && p.expense_id !== null
            ? p.expense_id
            : null;

        return {
          id: toNumericId(p.id) ?? 0,
          coa_id: coaId,
          coa_name: coaMap.get(coaId) ?? `COA #${coaId}`,
          amount: toNumber(p.amount),
          remarks: p.remarks ?? null,
          date: p.date ?? null,
          reference_no: p.reference_no ?? null,
          attachment_url: resolveAttachmentId(expenseObj?.attachment_url),
          is_concern: expenseObj?.status === "With Concern",
          is_rejected: expenseObj?.status === "Rejected",
          feedback: expenseObj?.feedback ?? null,
          expense_id: expenseObj ? (toNumericId(expenseObj.id) ?? 0) : (toNumericId(p.expense_id) ?? 0),
        };
      });

      const concernItems: ConcernItemResponse[] = rawConcerns.map((c) => {
        const expenseId = toNumericId(c.id) ?? 0;
        const coaId = toNumericId(c.particulars) ?? 0;

        return {
          expense_id: expenseId,
          status: c.status ?? "With Concern",
          feedback: c.feedback ?? null,
          return_to: c.return_to ?? null,
          amount: toNumber(c.amount),
          coa_id: coaId,
          coa_name: coaMap.get(coaId) ?? `COA #${coaId}`,
          remarks: c.remarks ?? null,
          transaction_date: c.transaction_date ?? null,
          attachment_url: resolveAttachmentId(c.attachment_url),
          reference_no: `EXP-${expenseId}`,
        };
      });

      const attachments = [...payables, ...concernItems].flatMap((item) =>
        item.attachment_url
          ? [{
              file_url: item.attachment_url,
              file_name: `Expense #${item.expense_id}`,
            }]
          : []
      );

      return json({
        draft: {
          id: draftId,
          doc_no: draft.doc_no ?? `DRAFT-${draftId}`,
          payee_user_id: payeeId,
          payee_name: supplierMap.get(payeeId) ?? `Supplier #${payeeId}`,
          encoder_user_id: encoderId,
          encoder_name: userMap.get(encoderId) ?? `User #${encoderId}`,
          total_amount: toNumber(draft.total_amount),
          remarks: draft.remarks ?? null,
          status: draft.status ?? "Submitted",
          approval_version: approvalVersion,
          transaction_date: draft.transaction_date ?? null,
          date_created: draft.date_created ?? draft.transaction_date ?? "",
          current_tier: currentTier,
          max_level: maxLevelByDivision[divisionId] ?? currentTier,
          transaction_type: toNumber(draft.transaction_type),
          division_name: divisionMap.get(divisionId) ?? `Division #${divisionId}`,
        },
        payables,
        concern_items: concernItems,
        approvers_by_level: approversByLevel,
        vote_history: voteHistory,
        logs: [],
        expense_logs: [],
        my_level: currentTier,
        my_vote: myVote,
        can_vote: canUserVote({
          approverRecords,
          divisionId,
          currentTier,
          myVote,
        }),
        attachments,
      });
    }

    if (resource === "logs") {
      const res = await directusFetch(
        `/items/disbursement_draft?filter[division_id][_in]=${myDivisionIds.join(
          ","
        )}&filter[status][_nin]=Submitted&fields=id,doc_no,payee,total_amount,remarks,status,approval_version,transaction_date,date_created,date_updated,division_id,encoder_id&sort=-date_updated&limit=100`
      );

      if (!res.ok) return json(res.data, { status: res.status });

      const drafts =
        (res.data as DirectusListResponse<DisbursementDraftRow>).data ?? [];

      const draftIds = drafts
        .map((draft) => toNumericId(draft.id))
        .filter((id): id is number => Boolean(id));

      const supplierIds = new Set<number>();
      const userIds = new Set<number>();
      const divisionIds = new Set<number>();

      for (const draft of drafts) {
        const supplierId = toNumericId(draft.payee);
        const encoderId = toNumericId(draft.encoder_id);
        const divisionId = toNumericId(draft.division_id);

        if (supplierId) supplierIds.add(supplierId);
        if (encoderId) userIds.add(encoderId);
        if (divisionId) divisionIds.add(divisionId);
      }

      const [draftLogsRes, payablesForLogsRes] = await Promise.all([
        draftIds.length > 0
          ? directusFetch(
              `/items/disbursement_draft_logs?filter[disbursement_id][_in]=${draftIds.join(
                ","
              )}&fields=id,disbursement_id,updated_by,edit_reason,payload_snapshot,log_date,total_amount,status,remarks,version&sort=-log_date&limit=-1`
            )
          : Promise.resolve({ ok: true, status: 200, data: { data: [] } }),
        draftIds.length > 0
          ? directusFetch(
              `/items/disbursement_payables_draft?filter[disbursement_id][_in]=${draftIds.join(
                ","
              )}&fields=disbursement_id,expense_id,expense_id.id&limit=-1`
            )
          : Promise.resolve({ ok: true, status: 200, data: { data: [] } }),
      ]);

      const draftLogs =
        (draftLogsRes.data as DirectusListResponse<DisbursementDraftLogRow>).data ??
        [];

      const payableLogLinks =
        (payablesForLogsRes.data as DirectusListResponse<DisbursementPayableDraftRow>)
          .data ?? [];

      for (const draftLog of draftLogs) {
        const updatedBy = toNumericId(draftLog.updated_by);
        if (updatedBy) userIds.add(updatedBy);
      }

      const expenseIdsByDraft = new Map<number, number[]>();
      const allExpenseIds = new Set<number>();

      for (const link of payableLogLinks) {
        const draftId = toNumericId(link.disbursement_id);
        const expenseId = toNumericId(link.expense_id);

        if (!draftId || !expenseId) continue;

        const existing = expenseIdsByDraft.get(draftId) ?? [];
        existing.push(expenseId);
        expenseIdsByDraft.set(draftId, existing);
        allExpenseIds.add(expenseId);
      }

      const expenseLogsRes =
        allExpenseIds.size > 0
          ? await directusFetch(
              `/items/expense_draft_logs?filter[expense_id][_in]=${[...allExpenseIds].join(
                ","
              )}&fields=log_id,expense_id,action,changed_by,changed_at,amount,remarks,particulars,status,version&sort=-changed_at&limit=-1`
            )
          : { ok: true, status: 200, data: { data: [] } };

      const expenseLogs =
        (expenseLogsRes.data as DirectusListResponse<ExpenseDraftLogRow>).data ??
        [];

      const coaIds = new Set<number>();

      for (const expenseLog of expenseLogs) {
        const changedBy = toNumericId(expenseLog.changed_by);
        const coaId = toNumericId(expenseLog.particulars);

        if (changedBy) userIds.add(changedBy);
        if (coaId) coaIds.add(coaId);
      }

      const [supplierMap, userMap, divisionMap, coaMap] = await Promise.all([
        fetchSupplierMap([...supplierIds]),
        fetchUserMap([...userIds]),
        fetchDivisionMap([...divisionIds]),
        fetchCoaMap([...coaIds]),
      ]);

      function getPayloadItemCount(payload: unknown): number {
        if (Array.isArray(payload)) return payload.length;

        if (typeof payload === "string") {
          try {
            const parsed = JSON.parse(payload) as unknown;
            return Array.isArray(parsed) ? parsed.length : 0;
          } catch {
            return 0;
          }
        }

        return 0;
      }

      const rows = await Promise.all(
        drafts.map(async (draft) => {
          const draftId = toNumericId(draft.id) ?? 0;
          const payeeId = toNumericId(draft.payee) ?? 0;
          const encoderId = toNumericId(draft.encoder_id) ?? 0;
          const divisionId = toNumericId(draft.division_id) ?? 0;
          const approvalVersion = toNumber(draft.approval_version, 1);

          const rounds = await buildVoteHistory({
            draftId,
            currentVersion: approvalVersion,
            draftStatus: draft.status ?? "",
            divisionId,
          });

          const revisionLogs: DraftRevisionLogResponse[] = draftLogs
            .filter((logRow) => toNumericId(logRow.disbursement_id) === draftId)
            .map((logRow) => {
              const editorId = toNumericId(logRow.updated_by) ?? 0;

              return {
                id: toNumericId(logRow.id) ?? 0,
                editor_name: userMap.get(editorId) ?? `User #${editorId}`,
                edit_reason: logRow.edit_reason ?? null,
                total_amount: toNumber(logRow.total_amount),
                status: logRow.status ?? null,
                remarks: logRow.remarks ?? null,
                version: toNumber(logRow.version, 1),
                created_at: logRow.log_date ?? "",
                item_count: getPayloadItemCount(logRow.payload_snapshot),
              };
            });

          const linkedExpenseIds = new Set(expenseIdsByDraft.get(draftId) ?? []);

          const expenseRevisionLogs: ExpenseRevisionLogResponse[] = expenseLogs
            .filter((logRow) => linkedExpenseIds.has(toNumericId(logRow.expense_id) ?? 0))
            .map((logRow) => {
              const editorId = toNumericId(logRow.changed_by) ?? 0;
              const coaId = toNumericId(logRow.particulars) ?? 0;

              return {
                log_id: toNumericId(logRow.log_id) ?? 0,
                expense_id: toNumericId(logRow.expense_id) ?? 0,
                action: logRow.action ?? "",
                editor_name: userMap.get(editorId) ?? `User #${editorId}`,
                changed_at: logRow.changed_at ?? "",
                amount: toNumber(logRow.amount),
                remarks: logRow.remarks ?? null,
                particulars: coaId > 0 ? coaMap.get(coaId) ?? `COA #${coaId}` : null,
                status: logRow.status ?? logRow.action ?? "",
                version: toNumber(logRow.version, 1),
              };
            });

          return {
            id: draftId,
            doc_no: draft.doc_no ?? `DRAFT-${draftId}`,
            payee_user_id: payeeId,
            payee_name: supplierMap.get(payeeId) ?? `Supplier #${payeeId}`,
            encoder_name: userMap.get(encoderId) ?? `User #${encoderId}`,
            total_amount: toNumber(draft.total_amount),
            remarks: draft.remarks ?? null,
            status: draft.status ?? "",
            division_name: divisionMap.get(divisionId) ?? `Division #${divisionId}`,
            approval_version: approvalVersion,
            transaction_date: draft.transaction_date ?? null,
            date_created: draft.date_created ?? draft.transaction_date ?? "",
            rounds,
            logs: revisionLogs,
            expense_logs: expenseRevisionLogs,
          };
        })
      );

      return json({ data: rows });
    }

    if (resource === "log-detail") {
      const draftIdRaw = sp.get("draft_id") || sp.get("id");
      console.log(`[log-detail] Received draftIdRaw:`, draftIdRaw);
      if (!draftIdRaw) return json({ error: "draft_id is required" }, { status: 400 });

      const draftId = Number(draftIdRaw);
      console.log(`[log-detail] Parsed draftId:`, draftId);

      const draftRes = await directusFetch(
        `/items/disbursement_draft?filter[id][_eq]=${draftId}&fields=id,division_id&limit=1`
      );
      console.log(`[log-detail] draftRes ok:`, draftRes.ok, `status:`, draftRes.status, `data:`, JSON.stringify(draftRes.data));

      const draft =
        ((draftRes.data as DirectusListResponse<DisbursementDraftRow>).data ??
          [])[0];

      if (!draft) {
        console.warn(`[log-detail] Draft with ID ${draftId} not found in DB!`);
        return json({ error: "Draft not found" }, { status: 404 });
      }

      const divisionId = toNumericId(draft.division_id) ?? 0;
      if (!myDivisionIds.includes(divisionId)) {
        return json({ error: "Forbidden" }, { status: 403 });
      }

      const pRes = await directusFetch(
        `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&fields=id,coa_id,amount,remarks,date&limit=-1`
      );

      const payables =
        (pRes.data as DirectusListResponse<DisbursementPayableDraftRow>).data ??
        [];

      const coaIds = payables
        .map((p) => toNumericId(p.coa_id))
        .filter((id): id is number => Boolean(id));

      const coaMap = await fetchCoaMap(coaIds);

      const data: ActivityLogDetailResponse[] = payables.map((p) => {
        const coaId = toNumericId(p.coa_id) ?? 0;

        return {
          id: toNumericId(p.id) ?? 0,
          coa_name: coaMap.get(coaId) ?? `COA #${coaId}`,
          amount: toNumber(p.amount),
          remarks: p.remarks ?? null,
          date: p.date ?? null,
        };
      });

      return json({ data });
    }

    return json({ error: "Unknown resource" }, { status: 400 });
  } catch (e: unknown) {
    return json(
      {
        error: "Server error",
        message: e instanceof Error ? e.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as PostBody;

    const {
      draft_id: incomingId,
      status: overallStatus,
      remarks,
      edited_payables,
      item_decisions,
    } = body;

    if (!incomingId || !overallStatus) {
      return json({ error: "draft_id and status are required" }, { status: 400 });
    }

    const currentUserId = await getCurrentUserId();
    if (!currentUserId) return json({ error: "Unauthorized" }, { status: 401 });

    const approverRecords = await getApproverRecords(currentUserId);
    if (!approverRecords.length) {
      return json(
        { error: "Forbidden: Not an authorized approver" },
        { status: 403 }
      );
    }

    const myDivisionIds = [...new Set(approverRecords.map((r) => r.division_id))];
    const nowTs = nowManila();

    let draftId = Number(incomingId);
    const isVirtual = draftId < 0;

    let draft: DisbursementDraftRow | null = null;
    let currentTier = 1;
    let currentVersion = 1;

    if (isVirtual) {
      const resolved = await resolveVirtualItemsById(draftId, myDivisionIds);

      if (!resolved.ok) return json(resolved.data, { status: resolved.status });
      if (!resolved.items.length) {
        return json({ error: "Virtual draft items not found" }, { status: 404 });
      }

      const first = resolved.items[0];
      const divisionId = toNumericId(first.division_id) ?? 0;
      const encoderId = toNumericId(first.encoder_id) ?? 0;
      const tier = parseInt(String(first.return_to ?? "").replace(/\D/g, ""), 10) || 1;

      if (!myDivisionIds.includes(divisionId)) {
        return json({ error: "Forbidden" }, { status: 403 });
      }

      // RBAC: Verify user has authority for THIS division AND at least THIS tier (Virtual Drafts)
      const authorizedLevels = approverRecords
        .filter((r) => {
          const rDivId = toNumericId(r.division_id);
          return rDivId !== null && rDivId === divisionId;
        })
        .map((r) => toNumber(r.approver_heirarchy));

      if (!authorizedLevels.some(lvl => lvl >= tier)) {
        console.warn(`[POST] RBAC Failure (Virtual): User ${currentUserId} attempted to vote on Tier ${tier} for Division ${divisionId}. Authorized tiers:`, authorizedLevels);
        return json({ 
          error: "Unauthorized tier",
          detail: `You are authorized for levels [${authorizedLevels.join(",")}] in this division, but these items require at least Level ${tier} approval.`
        }, { status: 403 });
      }

      const initialTotal = resolved.items.reduce((sum, item) => {
        const decision = item_decisions?.[`-${toNumericId(item.id) ?? 0}`];
        if (decision?.status === "APPROVED") return sum + toNumber(item.amount);
        return sum;
      }, 0);

      const createDraftRes = await directusFetch(`/items/disbursement_draft`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          doc_no: `RESUB-${Math.abs(draftId)}`,
          status: tierStatus(tier),
          approval_version: 1,
          version: 1,
          total_amount: initialTotal,
          division_id: divisionId,
          encoder_id: encoderId,
          transaction_date: first.transaction_date,
          transaction_type: 2,
          remarks: `[Virtual Resubmission Round] Created from returned items at Level ${tier}.`,
        }),
      });

      if (!createDraftRes.ok) {
        return json(createDraftRes.data, { status: createDraftRes.status });
      }

      const createdDraft =
        (createDraftRes.data as DirectusItemResponse<DisbursementDraftRow>).data;

      if (!createdDraft) {
        return json({ error: "Failed to create draft." }, { status: 500 });
      }

      draft = createdDraft;
      draftId = toNumericId(createdDraft.id) ?? 0;
      currentTier = tier;
      currentVersion = 1;

      for (const expense of resolved.items) {
        const expenseId = toNumericId(expense.id);
        if (!expenseId) continue;

        const decision = item_decisions?.[`-${expenseId}`] ?? {
          status: overallStatus,
          remarks: remarks ?? "",
        };

        if (decision.status === "APPROVED") {
          const insertResult = await insertExpenseIntoPayableDraft({
            draftId,
            expense,
          });

          if (!insertResult.ok) {
            return json(
              {
                error: "Failed to insert approved returned item into payable draft.",
                detail: insertResult.error,
              },
              { status: 500 }
            );
          }

          await directusFetch(`/items/expense_draft/${expenseId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              status: "Approved",
              return_to: null,
              feedback: null,
            }),
          });

          await createExpenseLog({
            expenseId,
            action: "Approved",
            changedBy: currentUserId,
            changedAt: nowTs,
            amount: expense.amount,
            remarks: decision.remarks || "Returned item approved.",
            status: "Approved",
          });
        }

        if (decision.status === "REJECTED") {
          await directusFetch(`/items/expense_draft/${expenseId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              status: "Rejected",
              rejected_at: nowTs,
              return_to: null,
              feedback: decision.remarks || "Item rejected.",
            }),
          });

          await createExpenseLog({
            expenseId,
            action: "Rejected",
            changedBy: currentUserId,
            changedAt: nowTs,
            amount: expense.amount,
            remarks: decision.remarks || "Item rejected.",
            status: "Rejected",
          });
        }

        if (decision.status === "WITH_CONCERN") {
          await directusFetch(`/items/expense_draft/${expenseId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              status: "With Concern",
              return_to: `L${currentTier}`,
              feedback: decision.remarks || "Concern raised.",
            }),
          });

          await createExpenseLog({
            expenseId,
            action: "With Concern",
            changedBy: currentUserId,
            changedAt: nowTs,
            amount: expense.amount,
            remarks: decision.remarks || "Concern raised.",
            status: "With Concern",
          });
        }
      }

      const recalculatedTotal = await recalcDraftTotal(draftId);
      draft.total_amount = recalculatedTotal;
    } else {
      const draftRes = await directusFetch(
        `/items/disbursement_draft?filter[id][_eq]=${draftId}&fields=id,doc_no,payee,total_amount,remarks,status,approval_version,version,transaction_date,division_id,department_id,encoder_id,transaction_type,supporting_documents_url,date_created,date_updated&limit=1`
      );

      if (!draftRes.ok) return json(draftRes.data, { status: draftRes.status });

      draft =
        ((draftRes.data as DirectusListResponse<DisbursementDraftRow>).data ??
          [])[0] ?? null;

      if (!draft) return json({ error: "Draft not found" }, { status: 404 });

      const divisionId = toNumericId(draft.division_id) ?? 0;
      if (!myDivisionIds.includes(divisionId)) {
        return json({ error: "Forbidden" }, { status: 403 });
      }

      currentVersion = toNumber(draft.approval_version, 1);
      currentTier = parseTier(draft.status ?? "Submitted");
    }

    if (!draft) return json({ error: "Draft not found." }, { status: 404 });

    const draftDivisionId = toNumericId(draft.division_id) ?? 0;

    // RBAC: Verify user has authority for THIS division AND at least THIS tier
    const authorizedLevels = approverRecords
      .filter((r) => {
        const rDivId = toNumericId(r.division_id);
        return rDivId !== null && rDivId === draftDivisionId;
      })
      .map((r) => toNumber(r.approver_heirarchy));

    if (!authorizedLevels.some(lvl => lvl === currentTier)) {
      console.warn(`[POST] RBAC Failure: User ${currentUserId} attempted to vote on Tier ${currentTier} for Division ${draftDivisionId}. Authorized tiers:`, authorizedLevels);
      return json({ 
        error: "Unauthorized tier",
        detail: `You are authorized for levels [${authorizedLevels.join(",")}] in this division, but the draft is currently at Level ${currentTier}.`
      }, { status: 403 });
    }

    const existingVoteRes = await directusFetch(
      `/items/disbursement_draft_approvals?filter[draft_id][_eq]=${draftId}&filter[approver_id][_eq]=${currentUserId}&filter[version][_eq]=${currentVersion}&fields=id,status&limit=1`
    );

    const existingVote =
      ((existingVoteRes.data as DirectusListResponse<ApprovalVoteRow>).data ??
        [])[0];

    console.log(`[POST] Check Existing Vote: Draft=${draftId}, User=${currentUserId}, Version=${currentVersion}. Found:`, existingVote?.id || "None");

    if (existingVote && existingVote.status && existingVote.status !== "DRAFT") {
      return json({ 
        error: "Already voted",
        detail: `A vote record already exists for this user on version ${currentVersion} of draft ${draftId}.`
      }, { status: 409 });
    }

    const finalRemarks = remarks?.trim() || null;

    if (overallStatus === "WITH_CONCERN" && !finalRemarks) {
      return json({ error: "Remarks required for concerns" }, { status: 400 });
    }

    if (item_decisions && Object.keys(item_decisions).length > 0) {
      console.log(`[POST] Processing ${Object.keys(item_decisions).length} item decisions. isVirtual: ${isVirtual}`);
      const concernDecisions = Object.entries(item_decisions).filter(
        ([id]) => Number(id) < 0
      );

      // If we are in a virtual draft, we might need to find/create a real draft to host these items
      let targetDraftId = draftId;
      if (isVirtual) {
        // Find an existing "Submitted" draft for the same week/division/encoder
        const weekStart = getWeekStart(draft.transaction_date ?? "");
        const weekEnd = getWeekEndFromStart(weekStart);
        const encoderId = toNumericId(draft.encoder_id);

        console.log(`[POST] Virtual draft detected. Looking for real draft in week ${weekStart} for division ${draft.division_id} / encoder ${encoderId}`);

        const realDraftRes = await directusFetch(
          `/items/disbursement_draft?filter[division_id][_eq]=${draft.division_id}&filter[encoder_id][_eq]=${encoderId}&filter[transaction_date][_between]=[${weekStart},${weekEnd}]&filter[status][_nin]=Approved,Rejected&limit=1`
        );

        const existingDraft = ((realDraftRes.data as DirectusListResponse<DisbursementDraftRow>).data ?? [])[0];

        if (existingDraft) {
          targetDraftId = toNumericId(existingDraft.id) ?? draftId;
          console.log(`[POST] Found existing real draft: ${targetDraftId}`);
        } else {
          console.log(`[POST] No existing draft found. Creating new host draft...`);
          // Create a new draft if none exists
          const newDraftRes = await directusFetch(`/items/disbursement_draft`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              division_id: draft.division_id,
              encoder_id: encoderId,
              transaction_date: draft.transaction_date,
              status: "Submitted",
              remarks: `Auto-generated from re-approved items. [Contains Returned Items]`,
              total_amount: 0,
              approval_version: 1,
            }),
          });

          if (!newDraftRes.ok) {
            console.error(`[POST] Failed to create auto-draft:`, newDraftRes.data);
            return json({ error: "Failed to create draft for re-approved items." }, { status: 500 });
          }

          targetDraftId = toNumericId((newDraftRes.data as DirectusItemResponse<{ id: number }>).data?.id) ?? draftId;
          console.log(`[POST] Created new draft: ${targetDraftId}`);
        }
      }

      console.log(`[POST] Target draft ID for item re-insertion: ${targetDraftId}`);
      const payableDecisions = Object.entries(item_decisions).filter(
        ([id]) => Number(id) > 0
      );

      for (const [idStr, decision] of concernDecisions) {
        const expenseId = Math.abs(Number(idStr));
        console.log(`[POST] Processing concern decision for expense ${expenseId}: ${decision.status}`);
        const expense = await fetchExpenseById(expenseId);
        if (!expense) {
          console.warn(`[POST] Expense ${expenseId} not found in DB.`);
          continue;
        }

        if (decision.status === "APPROVED") {
          console.log(`[POST] Attempting to re-insert expense ${expenseId} into draft ${targetDraftId}`);
          const insertResult = await insertExpenseIntoPayableDraft({
            draftId: targetDraftId,
            expense,
            referenceNo: draft.doc_no ?? `REF-${targetDraftId}`,
          });

          if (!insertResult.ok) {
            return json(
              {
                error: "Failed to insert approved concern item into payable draft.",
                detail: insertResult.error,
              },
              { status: 500 }
            );
          }

          await directusFetch(`/items/expense_draft/${expenseId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              status: "Approved",
              return_to: null,
              feedback: null,
            }),
          });

          await createExpenseLog({
            expenseId,
            action: "Approved",
            changedBy: currentUserId,
            changedAt: nowTs,
            amount: expense.amount,
            remarks: decision.remarks || "Concern item approved.",
            status: "Approved",
          });
        }

        if (decision.status === "REJECTED") {
          await directusFetch(`/items/expense_draft/${expenseId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              status: "Rejected",
              rejected_at: nowTs,
              return_to: null,
              feedback: decision.remarks || "Item rejected.",
            }),
          });

          await createExpenseLog({
            expenseId,
            action: "Rejected",
            changedBy: currentUserId,
            changedAt: nowTs,
            amount: expense.amount,
            remarks: decision.remarks || "Item rejected.",
            status: "Rejected",
          });
        }

        if (decision.status === "WITH_CONCERN") {
          await directusFetch(`/items/expense_draft/${expenseId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              status: "With Concern",
              return_to: `L${currentTier}`,
              feedback: decision.remarks || "Concern raised.",
            }),
          });

          await createExpenseLog({
            expenseId,
            action: "With Concern",
            changedBy: currentUserId,
            changedAt: nowTs,
            amount: expense.amount,
            remarks: decision.remarks || "Concern raised.",
            status: "With Concern",
          });
        }
      }


      // Instead of deleting payable records, just update the underlying expense_draft status.
      // Deleting disbursement_payables_draft would orphan the payable from the draft,
      // preventing the salesman from correcting and resubmitting. The payable row stays intact.
      for (const [idStr, decision] of payableDecisions) {
        const payableId = Number(idStr);
        if (!Number.isFinite(payableId) || payableId <= 0) continue;

        if (decision.status !== "WITH_CONCERN" && decision.status !== "REJECTED") continue;

        // Fetch the expense_id linked to this payable
        const pRes = await directusFetch(
          `/items/disbursement_payables_draft?filter[id][_eq]=${payableId}&fields=id,amount,expense_id&limit=1`
        );
        const payable = ((pRes.data as DirectusListResponse<DisbursementPayableDraftRow>).data ?? [])[0];
        if (!payable) continue;

        const expenseId = toNumericId(payable.expense_id);
        if (!expenseId) continue;

        const targetStatus = decision.status === "WITH_CONCERN" ? "With Concern" : "Rejected";

        await directusFetch(`/items/expense_draft/${expenseId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: targetStatus,
            ...(targetStatus === "Rejected" ? { rejected_at: nowTs } : {}),
            return_to: targetStatus === "With Concern" ? `L${currentTier}` : null,
            feedback: decision.remarks || (targetStatus === "Rejected" ? "Item rejected." : "Concern raised."),
          }),
        });

        await createExpenseLog({
          expenseId,
          action: targetStatus,
          changedBy: currentUserId,
          changedAt: nowTs,
          amount: payable.amount,
          remarks: decision.remarks || (targetStatus === "Rejected" ? "Item rejected." : "Concern raised."),
          status: targetStatus,
        });
      }
    }


    if (edited_payables && edited_payables.length > 0) {
      for (const edited of edited_payables) {
        await directusFetch(`/items/disbursement_payables_draft/${edited.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            amount: Number(edited.amount),
          }),
        });

        const pRes = await directusFetch(
          `/items/disbursement_payables_draft?filter[id][_eq]=${edited.id}&fields=expense_id&limit=1`
        );

        const payable =
          ((pRes.data as DirectusListResponse<DisbursementPayableDraftRow>)
            .data ?? [])[0];

        const expenseId = toNumericId(payable?.expense_id);

        if (expenseId) {
          await directusFetch(`/items/expense_draft/${expenseId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              amount: Number(edited.amount),
            }),
          });
        }
      }
    }

    const finalTotal = await recalcDraftTotal(draftId);
    draft.total_amount = finalTotal;

    const remainingCountRes = await directusFetch(
      `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&aggregate[count]=*`
    );

    const remainingCount = toNumber(
      (remainingCountRes.data as DirectusAggregateCountResponse).data?.[0]?.count
    );

    let finalVoteStatus: VoteStatus = overallStatus;

    if (item_decisions && Object.keys(item_decisions).length > 0) {
      const positiveDecisions = Object.entries(item_decisions)
        .filter(([id]) => Number(id) > 0) // only real payable decisions, not concern-items (negative ids)
        .map(([, d]) => d);

      const hasConcern = positiveDecisions.some((d) => d.status === "WITH_CONCERN");
      const hasRejected = positiveDecisions.some((d) => d.status === "REJECTED");
      const allRejected = positiveDecisions.length > 0 && positiveDecisions.every((d) => d.status === "REJECTED");

      // Priority: WITH_CONCERN > REJECTED > (remaining items = APPROVED)
      // This prevents the bug where remainingCount > 0 blindly overrides
      // concern/rejection decisions and marks the batch as APPROVED.
      if (hasConcern) finalVoteStatus = "WITH_CONCERN";
      else if (allRejected) finalVoteStatus = "REJECTED";
      else if (hasRejected && remainingCount > 0) finalVoteStatus = "APPROVED"; // partial reject = still approved
      else if (remainingCount > 0) finalVoteStatus = "APPROVED";
      else finalVoteStatus = "REJECTED";
    }

    const myHierarchy = Math.max(
      ...approverRecords
        .filter(r => toNumericId(r.division_id) === draftDivisionId)
        .map(r => toNumber(r.approver_heirarchy))
    );

    await directusFetch(`/items/disbursement_draft_approvals`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        draft_id: draftId,
        approver_id: currentUserId,
        approver_heirarchy: myHierarchy,
        status: finalVoteStatus,
        remarks: finalRemarks,
        version: currentVersion,
        created_at: nowTs,
      }),
    });

    // --- Audit Logging (disbursement_draft_logs) ---
    const allItemsRes = await directusFetch(
      `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&fields=id,coa_id,amount,reference_no,remarks,date&limit=-1`
    );
    const allItems = (allItemsRes.data as DirectusListResponse<DisbursementPayableDraftRow>).data ?? [];

    const draftLogRes = await directusFetch(`/items/disbursement_draft_logs`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        disbursement_id: draftId,
        doc_no: draft.doc_no,
        total_amount: finalTotal,
        status: finalVoteStatus,
        remarks: finalRemarks,
        version: currentVersion,
        updated_by: currentUserId,
        payload_snapshot: allItems,
      }),
    });

    const draftLogId = toNumericId((draftLogRes.data as DirectusItemResponse<{ id: number }>)?.data?.id);

    if (draftLogId) {
      const payableLogs = allItems.map(p => {
        const pId = toNumericId(p.id) ?? 0;
        const edited = edited_payables?.find(e => e.id === pId);
        const newAmt = edited ? toNumber(edited.amount) : toNumber(p.amount);

        return {
          log_id: draftLogId,
          payable_draft_id: pId,
          disbursement_id: draftId,
          coa_id: toNumericId(p.coa_id),
          reference_no: p.reference_no,
          amount: newAmt,
          original_amount: toNumber(p.amount),
          new_amount: newAmt,
          remarks: p.remarks,
          date: p.date,
          version: currentVersion,
          updated_by: currentUserId,
        };
      });

      if (payableLogs.length > 0) {
        await directusFetch(`/items/disbursement_payables_draft_logs`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payableLogs),
        });
      }
    }

    if (finalVoteStatus === "REJECTED" || finalVoteStatus === "WITH_CONCERN" || remainingCount <= 0) {
      const draftStatus: DraftLifecycleStatus =
        finalVoteStatus === "WITH_CONCERN"
          ? "With Concern"
          : finalVoteStatus === "REJECTED"
            ? "Rejected"
            : remainingCount <= 0
              ? "With Concern"
              : "Rejected";

      await directusFetch(`/items/disbursement_draft/${draftId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: draftStatus,
          approval_version: currentVersion + 1,
        }),
      });

      return json({
        ok: true,
        result: finalVoteStatus,
        message: "Draft updated.",
      });
    }

    const tierApproversRes = await directusFetch(
      `/items/disbursement_draft_approver?filter[division_id][_eq]=${draftDivisionId}&filter[is_deleted][_eq]=0&filter[approver_heirarchy][_eq]=${currentTier}&fields=approver_id&limit=-1`
    );

    const totalInTier =
      ((tierApproversRes.data as DirectusListResponse<DirectusApproverRow>)
        .data ?? []).length || 1;

    const votesInTierRes = await directusFetch(
      `/items/disbursement_draft_approvals?filter[draft_id][_eq]=${draftId}&filter[status][_eq]=APPROVED&filter[version][_eq]=${currentVersion}&limit=-1`
    );

    const approvedInTier =
      ((votesInTierRes.data as DirectusListResponse<ApprovalVoteRow>).data ?? [])
        .length;

    if (approvedInTier >= totalInTier) {
      const allApproversRes = await directusFetch(
        `/items/disbursement_draft_approver?filter[division_id][_eq]=${draftDivisionId}&filter[is_deleted][_eq]=0&sort=-approver_heirarchy&limit=1&fields=approver_heirarchy`
      );

      const maxLevel =
        toNumber(
          (allApproversRes.data as DirectusListResponse<DirectusApproverRow>)
            .data?.[0]?.approver_heirarchy,
          1
        ) || 1;

      const nextLevel = currentTier + 1;

      if (nextLevel > maxLevel) {
        const payDraftRes = await directusFetch(
          `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&fields=id,division_id,amount,coa_id,reference_no,date,remarks,expense_id.id,expense_id.status&limit=-1`
        );

        const payDraftRows =
          (payDraftRes.data as DirectusListResponse<DisbursementPayableDraftRow>)
            .data ?? [];

        if (!payDraftRows.length) {
          // No payable items remain. Determine the correct terminal status:
          // if every item was rejected, the draft should be "Rejected";
          // if items were flagged with concern, keep "With Concern".
          const terminalStatus: DraftLifecycleStatus =
            (finalVoteStatus as string) === "REJECTED" ? "Rejected" : "With Concern";

          await directusFetch(`/items/disbursement_draft/${draftId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              status: terminalStatus,
              approval_version: currentVersion + 1,
            }),
          });

          return json({
            ok: true,
            result: finalVoteStatus,
            message: "No payable items remained after verification.",
          });
        }

        const latestLiveRes = await directusFetch(
          `/items/disbursement?sort=-id&limit=1&fields=id,doc_no`
        );

        let nextDocNum = 1000;
        const last =
          (latestLiveRes.data as DirectusListResponse<{ doc_no?: string | null }>)
            .data?.[0];

        if (last?.doc_no) {
          nextDocNum =
            (parseInt(last.doc_no.match(/\d+/)?.[0] || "0", 10) || 1000) + 1;
        }

        const liveDocNo = `NT-${nextDocNum}`;

        const livePayablesPayload = payDraftRows
          .filter(p => {
            const exp = p.expense_id as { id?: number | string; status?: string | null } | null;
            return exp?.status === "Approved" || exp?.status === "APPROVED";
          })
          .map((p) => ({
            disbursement_id: 0, // Placeholder, updated below
            division_id: toNumericId(p.division_id),
            amount: p.amount,
            coa_id: toNumericId(p.coa_id),
            reference_no: liveDocNo,
            date: p.date,
            remarks: p.remarks ?? null,
          }));

        const approvedTotal = livePayablesPayload.reduce((sum, p) => sum + toNumber(p.amount), 0);

        const liveRes = await directusFetch(`/items/disbursement`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            doc_no: liveDocNo,
            total_amount: approvedTotal,
            division_id: toNumericId(draft.division_id),
            payee: toNumericId(draft.payee),
            encoder_id: toNumericId(draft.encoder_id),
            remarks: finalRemarks,
            status: "Submitted",
            transaction_type: draft.transaction_type,
            transaction_date: draft.transaction_date,
          }),
        });

        if (!liveRes.ok) return json(liveRes.data, { status: liveRes.status });

        const liveId = toNumericId(
          (liveRes.data as DirectusItemResponse<{ id?: number | string }>).data
            ?.id
        );

        if (!liveId) {
          return json({ error: "Failed to create live disbursement." }, { status: 500 });
        }

        const actualPayablesPayload = livePayablesPayload.map(p => ({
          ...p,
          disbursement_id: liveId
        }));

        // Auto-Reject Logic: Any items that are NOT explicitly "Approved" 
        // (including Draft, With Concern, or already Rejected) are automatically 
        // marked as REJECTED in the expense system when the final approver says "Go".
        for (const p of payDraftRows) {
          const exp = p.expense_id as { id?: number | string; status?: string | null } | null;
          const currentStatus = exp?.status || "Draft";
          
          if (currentStatus !== "Approved" && currentStatus !== "APPROVED") {
            const expId = toNumericId(exp?.id);
            if (expId) {
              await directusFetch(`/items/expense_draft/${expId}`, {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ status: "Rejected" }),
              });

              await createExpenseLog({
                expenseId: expId,
                action: "Rejected",
                changedBy: currentUserId,
                changedAt: nowTs,
                amount: p.amount,
                remarks: `[Auto-Rejected] Item was in "${currentStatus}" status during final batch approval.`,
                status: "Rejected",
              });
            }
          }
        }

        const orphanPayableIds = payDraftRows
          .filter((p) => {
            const exp = p.expense_id as { status?: string | null } | null;
            const s = String(exp?.status || "").toLowerCase();
            return s === "rejected";
          })
          .map((p) => toNumericId(p.id))
          .filter((id): id is number => Boolean(id));

        if (orphanPayableIds.length > 0) {
          await directusFetch(`/items/disbursement_payables_draft`, {
            method: "DELETE",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(orphanPayableIds),
          });
        }

        const livePayablesRes = await directusFetch(`/items/disbursement_payables`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(actualPayablesPayload),
        });

        if (!livePayablesRes.ok) {
          return json(livePayablesRes.data, { status: livePayablesRes.status });
        }

        await directusFetch(`/items/disbursement_draft/${draftId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status: "Approved",
            isPosted: 1,
            doc_no: liveDocNo,
            total_amount: approvedTotal,
            approval_version: currentVersion,
          }),
        });

        return json({
          ok: true,
          result: "APPROVED",
          message: "Disbursement created.",
          doc_no: liveDocNo,
        });
      }

      await directusFetch(`/items/disbursement_draft/${draftId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status: tierStatus(nextLevel),
          approval_version: currentVersion + 1,
        }),
      });

      return json({
        ok: true,
        result: "TIER_ADVANCED",
        next_tier: nextLevel,
        message: `Advanced to Level ${nextLevel}.`,
      });
    }

    return json({
      ok: true,
      result: "VOTE_RECORDED",
      message: "Vote recorded.",
    });
  } catch (e: unknown) {
    return json(
      {
        error: "Server error",
        message: e instanceof Error ? e.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}
