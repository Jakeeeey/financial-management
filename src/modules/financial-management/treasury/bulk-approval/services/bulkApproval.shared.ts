// src/modules/financial-management/treasury/bulk-approval/services/bulkApproval.shared.ts
import type { NextRequest } from "next/server";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { directusFetch } from "./directus.service";
import type {
  ApprovalContextResponse,
  ApprovalVoteRow,
  ApproverRecord,
  AuthContextResult,
  DirectusApproverRow,
  DirectusCoaRow,
  DirectusDivisionRow,
  DirectusAggregateCountResponse,
  DirectusListResponse,
  DirectusSalesmanRow,
  DirectusSupplierRow,
  DirectusUserRow,
  DisbursementDraftRow,
  DisbursementPayableDraftRow,
  DirectusItemResponse,
  DraftLifecycleStatus,
  ExpenseDraftRow,
  FinalHeaderDecisionBody,
  FinalHeaderDecisionStatus,
  LogRoundResponse,
  VoteStatus,
} from "./bulkApproval.types";

const COOKIE_NAME = "vos_access_token";

export function decodeJwtSub(token: string): number | null {
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

export function toNumericId(val: unknown): number | null {
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

export function toNumber(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

export function toStringOrNull(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val);
  return s.trim() ? s : null;
}

export function resolveAttachmentId(val: unknown): string | null {
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

export function nowManila(): string {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Manila" })
    .replace(" ", "T");
}

export function parseTier(status: string): number {
  if (!status) return 1;

  const s = status.toUpperCase();

  if (s === "SUBMITTED") return 1;

  const m = s.match(/PENDING_L(\d+)/);
  if (m) return parseInt(m[1], 10);

  return 1;
}

export function tierStatus(tier: number): DraftLifecycleStatus {
  if (tier <= 1) return "Submitted";
  return `Pending_L${tier}`;
}

export function getWeekStart(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function getWeekEndFromStart(weekStart: string): string {
  const s = new Date(`${weekStart}T00:00:00`);
  return format(endOfWeek(s, { weekStartsOn: 1 }), "yyyy-MM-dd");
}

export function hashVirtualKey(key: string): number {
  const hash = key.split("").reduce((acc, char) => {
    const next = (acc << 5) - acc + char.charCodeAt(0);
    return next & next;
  }, 0);

  return Math.abs(hash) * -1;
}

export function getVirtualDraftKey(params: {
  encoder_id: number;
  division_id: number;
  week_start: string;
  tier: number;
}) {
  return `returned-${params.encoder_id}-${params.division_id}-${params.week_start}-${params.tier}`;
}

export function getVirtualDraftId(params: {
  encoder_id: number;
  division_id: number;
  week_start: string;
  tier: number;
}) {
  return hashVirtualKey(getVirtualDraftKey(params));
}

export function buildFilterQuery(filter: Record<string, unknown>, fields: string, extra?: Record<string, string>) {
  const query = new URLSearchParams({
    filter: JSON.stringify(filter),
    fields,
    limit: "-1",
    ...(extra ?? {}),
  });

  return query.toString();
}

export function getUserDisplayName(row?: DirectusUserRow | null, fallback?: string) {
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

export function getDivisionName(row?: DirectusDivisionRow | null, fallback?: string) {
  if (!row) return fallback ?? "N/A";

  const name = row.division_name?.trim();
  if (name) return name;

  const code = row.division_code?.trim();
  if (code) return code;

  return fallback || "N/A";
}

export function getCurrentUserIdFromRequest(req: NextRequest): number | null {
  const token = req.cookies.get(COOKIE_NAME)?.value ?? null;
  return token ? decodeJwtSub(token) : null;
}

type ApproverLookupStrategy = {
  label: string;
  path: string;
  filterInMemory: boolean;
};

function mapApproverRows(rows: DirectusApproverRow[], divisionNameMap?: Map<number, string>): ApproverRecord[] {
  return rows
    .map((r) => {
      const divisionId = toNumericId(r.division_id) ?? 0;
      const approverId = toNumericId(r.approver_id) ?? 0;

      const divisionNameFromRelation =
        typeof r.division_id === "object" && r.division_id !== null
          ? (r.division_id as DirectusDivisionRow).division_name ?? null
          : null;

      return {
        id: toNumber(r.id),
        approver_id: approverId,
        division_id: divisionId,
        division_name:
          divisionNameFromRelation ??
          divisionNameMap?.get(divisionId) ??
          `Division #${divisionId}`,
        approver_heirarchy: toNumber(r.approver_heirarchy, 1),
      };
    })
    .filter((r) => r.approver_id > 0 && r.division_id > 0);
}

function getApproverLookupStrategies(userId: number): ApproverLookupStrategy[] {
  const primitiveFields = "id,approver_id,approver_heirarchy,division_id";
  const relationFields =
    "id,approver_id,approver_id.user_id,approver_id.id,approver_heirarchy,division_id,division_id.division_id,division_id.division_name";

  return [
    {
      label: "approver_id primitive",
      path:
        `/items/disbursement_draft_approver` +
        `?filter[approver_id][_eq]=${encodeURIComponent(String(userId))}` +
        `&filter[is_deleted][_eq]=0` +
        `&fields=${encodeURIComponent(primitiveFields)}` +
        `&limit=-1&sort=-id`,
      filterInMemory: false,
    },
    {
      label: "approver_id.user_id relation",
      path:
        `/items/disbursement_draft_approver` +
        `?filter[approver_id][user_id][_eq]=${encodeURIComponent(String(userId))}` +
        `&filter[is_deleted][_eq]=0` +
        `&fields=${encodeURIComponent(relationFields)}` +
        `&limit=-1&sort=-id`,
      filterInMemory: false,
    },
    {
      label: "all active approvers primitive fallback",
      path:
        `/items/disbursement_draft_approver` +
        `?filter[is_deleted][_eq]=0` +
        `&fields=${encodeURIComponent(primitiveFields)}` +
        `&limit=-1&sort=-id`,
      filterInMemory: true,
    },
    {
      label: "all active approvers relation fallback",
      path:
        `/items/disbursement_draft_approver` +
        `?filter[is_deleted][_eq]=0` +
        `&fields=${encodeURIComponent(relationFields)}` +
        `&limit=-1&sort=-id`,
      filterInMemory: true,
    },
  ];
}

export async function getApproverRecords(userId: number): Promise<ApproverRecord[]> {
  for (const strategy of getApproverLookupStrategies(userId)) {
    const res = await directusFetch<DirectusListResponse<DirectusApproverRow>>(strategy.path);

    if (!res.ok) {
      console.error("[getApproverRecords] lookup failed", {
        strategy: strategy.label,
        status: res.status,
        details: res.data,
      });
      continue;
    }

    const rows = res.data.data ?? [];
    const mapped = mapApproverRows(rows).filter((record) =>
      strategy.filterInMemory ? record.approver_id === userId : true
    );

    if (mapped.length > 0) {
      const divisionMap = await fetchDivisionMap(mapped.map((record) => record.division_id));
      return mapped.map((record) => ({
        ...record,
        division_name: divisionMap.get(record.division_id) ?? record.division_name,
      }));
    }
  }

  return [];
}

export async function getAllApproversForDivisions(divisionIds: number[]) {
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

export function buildApproverStats(allApprovers: ApproverRecord[]) {
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

export function buildLevelsByDivision(approverRecords: ApproverRecord[]) {
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

export async function fetchUserMap(userIds: number[]) {
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

export async function fetchSupplierMap(supplierIds: number[]) {
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

export async function fetchDivisionMap(divisionIds: number[]) {
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

export async function fetchCoaMap(coaIds: number[]) {
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

export async function fetchMyVotes(draftIds: number[], userId: number) {
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

export function canUserVote(params: {
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

export async function recalcDraftTotal(draftId: number) {
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

export async function resolveVirtualItemsById(virtualId: number, allowedDivisionIds: number[]) {
  const res = await directusFetch(
    `/items/expense_draft?filter[status][_eq]=Approved&filter[return_to][_nnull]=true&filter[division_id][_in]=${allowedDivisionIds.join(
      ","
    )}&fields=id,amount,remarks,transaction_date,division_id,encoded_by,return_to,particulars,attachment_url,feedback,status,header_id&limit=-1`
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
    const encoderId = getExpenseEmployeeId(item);
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

export async function buildVoteHistory(params: {
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
    `/items/disbursement_draft_approvals?filter[draft_id][_eq]=${params.draftId}` +
      `&fields=id,draft_id,approver_id,status,remarks,version,created_at` +
      `&sort=version,created_at&limit=-1`
  );

  if (!votesRes.ok) {
    console.error("[buildVoteHistory] Failed to fetch votes", {
      draftId: params.draftId,
      status: votesRes.status,
      data: votesRes.data,
    });

    return [
      {
        version: params.currentVersion,
        is_current: true,
        outcome: "SUBMITTED",
        votes: [],
      },
    ];
  }

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
            level: levelByApprover.get(approverId) || 1,
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

export async function buildApproversByLevel(params: {
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

export async function createExpenseLog(params: {
  expenseId: number;
  action: string;
  changedBy: number;
  changedAt: string;
  amount?: number | string | null;
  remarks?: string | null;
  status: string | null;
}) {
  return await directusFetch(`/items/expense_draft_logs`, {
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

export async function insertExpenseIntoPayableDraft(params: {
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

  // Point 4: Prevent duplicate insertion
  const existingRes = await directusFetch(
    `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${params.draftId}&filter[expense_id][_eq]=${expenseId}&fields=id&limit=1`
  );
  const existing = (existingRes.data as DirectusListResponse<{ id: number }>)?.data?.[0];
  if (existing) {
    console.log(`[insertExpenseIntoPayableDraft] Expense ${expenseId} already exists in draft ${params.draftId}. Skipping insertion.`);
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

export async function fetchExpenseById(expenseId: number) {
  const res = await directusFetch(
    `/items/expense_draft?filter[id][_eq]=${expenseId}&fields=id,amount,remarks,transaction_date,division_id,encoded_by,return_to,particulars,attachment_url,feedback,status,header_id&limit=1`
  );

  if (!res.ok) return null;

  return ((res.data as DirectusListResponse<ExpenseDraftRow>).data ?? [])[0] ?? null;
}



export function getExpenseEmployeeId(row: ExpenseDraftRow): number {
  return toNumericId(row.encoded_by) ?? 0;
}

export function makeFinalGroupKey(params: {
  divisionId: number;
  periodFrom: string;
  periodTo: string;
}) {
  return `${params.divisionId}|${params.periodFrom}|${params.periodTo}`;
}

export function isDateWithinInclusive(date: string | null | undefined, from: string, to: string) {
  if (!date) return false;
  return date >= from && date <= to;
}

export function normalizeFinalDecisionStatus(value: unknown): FinalHeaderDecisionStatus | null {
  const normalized = String(value ?? "").trim().replace(/_/g, " ").toLowerCase();

  if (normalized === "approved") return "Approved";
  if (normalized === "rejected") return "Rejected";
  if (normalized === "with concern") return "With Concern";

  return null;
}

export function isFinalHeaderDecisionBody(value: Record<string, unknown>): value is FinalHeaderDecisionBody {
  return value.resource === "final-header-decision";
}

export async function getApprovalContextsForUser(params: {
  approverRecords: ApproverRecord[];
  allApprovers: ApproverRecord[];
}): Promise<ApprovalContextResponse[]> {
  const { maxLevelByDivision } = buildApproverStats(params.allApprovers);
  const divisionMap = await fetchDivisionMap(params.approverRecords.map((record) => record.division_id));

  return params.approverRecords
    .map((record) => {
      const maxLevel = maxLevelByDivision[record.division_id] ?? record.approver_heirarchy;

      return {
        division_id: record.division_id,
        division_name: divisionMap.get(record.division_id) ?? `Division #${record.division_id}`,
        approver_level: record.approver_heirarchy,
        is_final_approver: record.approver_heirarchy === maxLevel,
      };
    })
    .sort((a, b) => {
      if (a.division_name === b.division_name) return a.approver_level - b.approver_level;
      return String(a.division_name ?? "").localeCompare(String(b.division_name ?? ""));
    });
}

export async function fetchSalesmanMap(employeeIds: number[]) {
  const uniqueIds = [...new Set(employeeIds.filter((id) => id > 0))];
  const map = new Map<number, { salesman_id: number | null; salesman_code: string | null; salesman_name: string | null }>();

  if (!uniqueIds.length) return map;

  const res = await directusFetch(
    `/items/salesman?filter[employee_id][_in]=${uniqueIds.join(",")}&fields=id,employee_id,salesman_code,salesman_name&limit=-1`
  );

  if (!res.ok) return map;

  const rows = (res.data as DirectusListResponse<DirectusSalesmanRow>).data ?? [];

  for (const row of rows) {
    const employeeId = toNumericId(row.employee_id);
    if (!employeeId) continue;

    map.set(employeeId, {
      salesman_id: toNumericId(row.id),
      salesman_code: row.salesman_code ?? null,
      salesman_name: row.salesman_name ?? null,
    });
  }

  return map;
}

export async function fetchCoaDetailMap(coaIds: number[]) {
  const uniqueIds = [...new Set(coaIds.filter((id) => id > 0))];
  const map = new Map<number, { account_title: string; gl_code: string | null }>();

  if (!uniqueIds.length) return map;

  const res = await directusFetch(
    `/items/chart_of_accounts?filter[coa_id][_in]=${uniqueIds.join(",")}&fields=coa_id,gl_code,account_title&limit=-1`
  );

  if (!res.ok) return map;

  const rows = (res.data as DirectusListResponse<DirectusCoaRow>).data ?? [];

  for (const row of rows) {
    const coaId = toNumericId(row.coa_id);
    if (!coaId) continue;

    map.set(coaId, {
      account_title: row.account_title?.trim() || `COA #${coaId}`,
      gl_code: row.gl_code ?? null,
    });
  }

  return map;
}

export async function createBulkApprovalContext(req: NextRequest): Promise<AuthContextResult> {
  const currentUserId = getCurrentUserIdFromRequest(req);
  if (!currentUserId) {
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }

  const approverRecords = await getApproverRecords(currentUserId);
  if (!approverRecords.length) {
    return { ok: false, status: 403, body: { error: "Forbidden" } };
  }

  const myDivisionIds = [...new Set(approverRecords.map((record) => record.division_id))];
  const levelsByDivision = buildLevelsByDivision(approverRecords);
  const myLevel = approverRecords[0]?.approver_heirarchy ?? 0;
  const allApprovers = await getAllApproversForDivisions(myDivisionIds);
  const { maxLevelByDivision, approversPerLevelByDivision } = buildApproverStats(allApprovers);

  return {
    ok: true,
    context: {
      currentUserId,
      approverRecords,
      myDivisionIds,
      levelsByDivision,
      myLevel,
      allApprovers,
      maxLevelByDivision,
      approversPerLevelByDivision,
    },
  };
}


export async function finalizeDisbursementDraft(params: {
  draftId: number;
  draft: DisbursementDraftRow;
  currentUserId: number;
  currentVersion: number;
  finalTotal: number;
  finalRemarks: string | null;
  nowTs: string;
}) {
  const { draftId, draft, currentUserId, currentVersion, finalTotal, finalRemarks, nowTs } = params;

  const payDraftRes = await directusFetch(
    `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&fields=id,amount,coa_id,reference_no,date,remarks,expense_id.id,expense_id.status&limit=-1`
  );

  const payDraftRows = (payDraftRes.data as DirectusListResponse<DisbursementPayableDraftRow>).data ?? [];

  if (!payDraftRows.length) {
    await directusFetch(`/items/disbursement_draft/${draftId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: "With Concern",
        approval_version: currentVersion + 1,
      }),
    });

    return {
      ok: true,
      result: "WITH_CONCERN",
      message: "No payable items remained after verification.",
    };
  }

  const latestLiveRes = await directusFetch(`/items/disbursement?sort=-id&limit=1&fields=id,doc_no`);

  let nextDocNum = 1000;
  const last = (latestLiveRes.data as DirectusListResponse<{ doc_no?: string | null }>).data?.[0];

  if (last?.doc_no) {
    nextDocNum = (parseInt(last.doc_no.match(/\d+/)?.[0] || "0", 10) || 1000) + 1;
  }

  const liveDocNo = `NT-${nextDocNum}`;

  const liveRes = await directusFetch(`/items/disbursement`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      doc_no: liveDocNo,
      total_amount: finalTotal,
      division_id: toNumericId(draft.division_id),
      payee: toNumericId(draft.payee),
      encoder_id: toNumericId(draft.encoder_id),
      remarks: finalRemarks,
      status: "Draft",
      transaction_type: draft.transaction_type,
      transaction_date: draft.transaction_date,
    }),
  });

  if (!liveRes.ok) return { ok: false, status: liveRes.status, data: liveRes.data };

  const liveId = toNumericId((liveRes.data as DirectusItemResponse<{ id?: number | string }>).data?.id);

  if (!liveId) {
    return { ok: false, status: 500, data: { error: "Failed to create live disbursement." } };
  }

  const livePayablesPayload = payDraftRows
    .filter((p) => {
      if (!p.expense_id) return true;
      const exp = p.expense_id as { id?: number | string; status?: string | null } | null;
      const s = String(exp?.status || "").toLowerCase();
      return s === "approved";
    })
    .map((p) => ({
      disbursement_id: liveId,
      amount: p.amount,
      coa_id: toNumericId(p.coa_id),
      reference_no: liveDocNo,
      date: p.date,
      remarks: p.remarks ?? null,
    }));



  // --- Auto-Reject "With Concern" orphans ---
  // 1. Get all header IDs linked to this draft from the logs
  const draftLogLinksRes = await directusFetch<DirectusListResponse<{ expense_id?: { header_id?: number | string } | null }>>(
    `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&fields=expense_id.header_id&limit=-1`
  );
  const headerIds = [...new Set((draftLogLinksRes.ok ? draftLogLinksRes.data.data ?? [] : [])
    .map(p => toNumericId(p.expense_id?.header_id))
    .filter((id): id is number => Boolean(id)))];

  if (headerIds.length > 0) {
    const nonApprovedRes = await directusFetch<DirectusListResponse<ExpenseDraftRow>>(
      `/items/expense_draft?filter[header_id][_in]=${headerIds.join(",")}&filter[status][_nin]=Approved,Rejected&fields=id,amount,status&limit=-1`
    );
    const nonApprovedItems = (nonApprovedRes.ok ? nonApprovedRes.data.data ?? [] : []);
    for (const item of nonApprovedItems) {
      const expId = toNumericId(item.id);
      if (expId) {
        const currentStatus = item.status || "Draft";
        await directusFetch(`/items/expense_draft/${expId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ status: "Rejected", feedback: `[Auto-Rejected] Item remained in "${currentStatus}" status during final batch approval.` }),
        });
        await createExpenseLog({
          expenseId: expId,
          action: "Rejected",
          changedBy: currentUserId,
          changedAt: nowTs,
          amount: item.amount,
          remarks: `[Auto-Rejected] Item remained in "${currentStatus}" status during final batch approval.`,
          status: "Rejected",
        });
      }
    }
  }

  const approvedTotal = livePayablesPayload.reduce((sum, p) => sum + toNumber(p.amount), 0);

  const livePayablesRes = await directusFetch(`/items/disbursement_payables`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(livePayablesPayload),
  });

  if (!livePayablesRes.ok) return { ok: false, status: livePayablesRes.status, data: livePayablesRes.data };

  await directusFetch(`/items/disbursement_draft/${draftId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      status: "Approved",
      doc_no: liveDocNo,
      total_amount: approvedTotal,
      approval_version: currentVersion,
    }),
  });

  await directusFetch(`/items/disbursement/${liveId}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ total_amount: approvedTotal }),
  });

  return {
    ok: true,
    result: "APPROVED",
    message: "Disbursement created.",
    doc_no: liveDocNo,
  };
}

export async function processDraftApproval(params: {
  draftId: number;
  currentUserId: number;
  overallStatus: VoteStatus;
  remarks: string | null;
  item_decisions?: Record<string, { status: VoteStatus; remarks?: string }>;
  edited_payables?: { id: number; amount: number | string }[];
  nowTs: string;
  isVirtual: boolean;
  approverRecords: ApproverRecord[];
  myDivisionIds: number[];
}) {
  const {
    draftId,
    currentUserId,
    overallStatus,
    remarks,
    item_decisions,
    edited_payables,
    nowTs,
    isVirtual,
    approverRecords,
    myDivisionIds,
  } = params;

  let draft: DisbursementDraftRow | null = null;
  let currentVersion = 1;
  let currentTier = 1;

  const handledVirtualExpenseIds = new Set<number>();

  if (isVirtual) {
    const res = await resolveVirtualItemsById(draftId, myDivisionIds);
    if (!res.ok) return { ok: false, status: res.status, data: res.data };
    const items = res.items;
    if (!items.length) return { ok: false, status: 404, data: { error: "Virtual draft not found or empty" } };

    const first = items[0];
    const encoderId = getExpenseEmployeeId(first);
    const divisionId = toNumericId(first.division_id) ?? 0;
    const tier = parseInt(String(first.return_to ?? "").replace(/\D/g, ""), 10) || 1;

    draft = {
      id: draftId,
      division_id: divisionId,
      encoder_id: encoderId,
      transaction_date: first.transaction_date,
      status: `Returned L${tier}`,
      approval_version: 1,
    } as any;

    currentVersion = 1;
    currentTier = tier;
  } else {
    const draftRes = await directusFetch<DirectusItemResponse<DisbursementDraftRow>>(
      `/items/disbursement_draft/${draftId}?fields=id,status,approval_version,division_id,encoder_id,payee,transaction_type,transaction_date,doc_no`
    );
    draft = (draftRes.ok ? draftRes.data.data : null) ?? null;
    if (!draft) return { ok: false, status: 404, data: { error: "Draft not found" } };

    const divisionId = toNumericId(draft.division_id) ?? 0;
    if (!myDivisionIds.includes(divisionId)) {
      return { ok: false, status: 403, data: { error: "Forbidden" } };
    }

    currentVersion = toNumber(draft.approval_version, 1);
    currentTier = parseTier(draft.status ?? "Submitted");
  }
  
  if (!draft) return { ok: false, status: 404, data: { error: "Draft resolved to null" } };

  const draftDivisionId = toNumericId(draft.division_id) ?? 0;

  const authorizedLevels = approverRecords
    .filter((r) => {
      const rDivId = toNumericId(r.division_id);
      return rDivId !== null && rDivId === draftDivisionId;
    })
    .map((r) => toNumber(r.approver_heirarchy));

  if (!authorizedLevels.some((lvl) => lvl === currentTier)) {
    return {
      ok: false,
      status: 403,
      data: {
        error: "Unauthorized tier",
        detail: `You are authorized for levels [${authorizedLevels.join(",")}] in this division, but the draft is currently at Level ${currentTier}.`,
      },
    };
  }

  const existingVoteRes = await directusFetch<DirectusListResponse<ApprovalVoteRow>>(
    `/items/disbursement_draft_approvals?filter[draft_id][_eq]=${draftId}&filter[approver_id][_eq]=${currentUserId}&filter[version][_eq]=${currentVersion}&fields=id,status&limit=1`
  );

  const existingVote = (existingVoteRes.ok ? existingVoteRes.data.data ?? [] : [])[0];

  if (existingVote && existingVote.status && existingVote.status !== "DRAFT") {
    return {
      ok: false,
      status: 409,
      data: {
        error: "Already voted",
        detail: `A vote record already exists for this user on version ${currentVersion} of draft ${draftId}.`,
      },
    };
  }

  const finalRemarks = remarks?.trim() || null;

  if (overallStatus === "WITH_CONCERN" && (!finalRemarks || finalRemarks.length < 5)) {
    return { ok: false, status: 400, data: { error: "Remarks required for concerns" } };
  }

  if (item_decisions && Object.keys(item_decisions).length > 0) {
    const concernDecisions = Object.entries(item_decisions).filter(
      ([id]) => Number(id) < 0 && !handledVirtualExpenseIds.has(Math.abs(Number(id)))
    );

    let targetDraftId = draftId;
    if (isVirtual && concernDecisions.length > 0) {
      const weekStart = getWeekStart(draft.transaction_date ?? "");
      const weekEnd = getWeekEndFromStart(weekStart);
      const encoderId = toNumericId(draft.encoder_id);

      const realDraftRes = await directusFetch<DirectusListResponse<DisbursementDraftRow>>(
        `/items/disbursement_draft?filter[division_id][_eq]=${draft.division_id}&filter[encoder_id][_eq]=${encoderId}&filter[transaction_date][_between]=[${weekStart},${weekEnd}]&filter[status][_nin]=Approved,Rejected&limit=1`
      );

      const existingDraft = (realDraftRes.ok ? realDraftRes.data.data ?? [] : [])[0];

      if (existingDraft) {
        targetDraftId = toNumericId(existingDraft.id) ?? draftId;
      } else {
        const newDraftRes = await directusFetch<DirectusItemResponse<{ id: number }>>(`/items/disbursement_draft`, {
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
          return { ok: false, status: 500, data: { error: "Failed to create draft for re-approved items." } };
        }

        targetDraftId = toNumericId(newDraftRes.data.data?.id) ?? draftId;
      }
    }

    const payableDecisions = Object.entries(item_decisions).filter(([id]) => Number(id) > 0);

    for (const [idStr, decision] of concernDecisions) {
      const expenseId = Math.abs(Number(idStr));
      const expense = await fetchExpenseById(expenseId);
      if (!expense) continue;

      if (decision.status === "APPROVED") {
        const insertResult = await insertExpenseIntoPayableDraft({
          draftId: targetDraftId,
          expense,
          referenceNo: draft.doc_no ?? `REF-${targetDraftId}`,
        });

        if (!insertResult.ok) {
          return {
            ok: false,
            status: 500,
            data: {
              error: "Failed to insert approved concern item into payable draft.",
              detail: insertResult.error,
            },
          };
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

    const culledPayableIds = payableDecisions
      .filter(([, decision]) => {
        return decision.status === "REJECTED" || decision.status === "WITH_CONCERN";
      })
      .map(([id]) => Number(id))
      .filter((id) => Number.isFinite(id) && id > 0);

    if (culledPayableIds.length > 0) {
      const pCullRes = await directusFetch<DirectusListResponse<DisbursementPayableDraftRow>>(
        `/items/disbursement_payables_draft?filter[id][_in]=${culledPayableIds.join(",")}&fields=id,amount,expense_id,coa_id&limit=-1`
      );

      const culledPayables = (pCullRes.ok ? pCullRes.data.data ?? [] : []);

      await directusFetch(`/items/disbursement_payables_draft`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(culledPayableIds),
      });

      if (toNumber(draft.transaction_type) === 2) {
        for (const payable of culledPayables) {
          const payableId = toNumericId(payable.id);
          const expenseId = toNumericId(payable.expense_id);
          if (!payableId || !expenseId) continue;

          const decision = item_decisions[String(payableId)];
          if (!decision) continue;

          const targetStatus = decision.status === "WITH_CONCERN" ? "With Concern" : "Rejected";

          await directusFetch(`/items/expense_draft/${expenseId}`, {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              status: targetStatus,
              rejected_at: targetStatus === "Rejected" ? nowTs : undefined,
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
    }
  }

  if (edited_payables && edited_payables.length > 0) {
    for (const edited of edited_payables) {
      await directusFetch(`/items/disbursement_payables_draft/${edited.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ amount: Number(edited.amount) }),
      });

      const pRes = await directusFetch<DirectusListResponse<DisbursementPayableDraftRow>>(
        `/items/disbursement_payables_draft?filter[id][_eq]=${edited.id}&fields=expense_id&limit=1`
      );

      const payable = (pRes.ok ? pRes.data.data ?? [] : [])[0];
      const expenseId = toNumericId(payable?.expense_id);

      if (expenseId) {
        await directusFetch(`/items/expense_draft/${expenseId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ amount: Number(edited.amount) }),
        });
      }
    }
  }

  const finalTotal = await recalcDraftTotal(draftId);
  draft.total_amount = finalTotal;

  const remainingCountRes = await directusFetch<DirectusAggregateCountResponse>(
    `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&aggregate[count]=*`
  );

  const remainingCount = toNumber((remainingCountRes.ok ? remainingCountRes.data.data ?? [] : [])[0]?.count);

  let finalVoteStatus: VoteStatus = overallStatus;

  if (item_decisions && Object.keys(item_decisions).length > 0) {
    const positiveDecisions = Object.entries(item_decisions)
      .filter(([id]) => Number(id) > 0)
      .map(([, d]) => d);

    const hasConcern = positiveDecisions.some((d) => d.status === "WITH_CONCERN");
    const hasRejected = positiveDecisions.some((d) => d.status === "REJECTED");
    const allRejected = positiveDecisions.length > 0 && positiveDecisions.every((d) => d.status === "REJECTED");

    if (hasConcern) finalVoteStatus = "WITH_CONCERN";
    else if (allRejected) finalVoteStatus = "REJECTED";
    else if (hasRejected && remainingCount > 0) finalVoteStatus = "APPROVED";
    else if (remainingCount > 0) finalVoteStatus = "APPROVED";
    else finalVoteStatus = "REJECTED";
  }

  await directusFetch(`/items/disbursement_draft_approvals`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      draft_id: draftId,
      approver_id: currentUserId,
      approver_heirarchy: currentTier,
      status: finalVoteStatus,
      remarks: finalRemarks,
      version: currentVersion,
      created_at: nowTs,
    }),
  });

  const allItemsRes = await directusFetch<DirectusListResponse<DisbursementPayableDraftRow>>(
    `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&fields=id,coa_id,amount,reference_no,remarks,date&limit=-1`
  );
  const allItems = (allItemsRes.ok ? allItemsRes.data.data ?? [] : []);

  const draftLogRes = await directusFetch<DirectusItemResponse<{ id: number }>>(`/items/disbursement_draft_logs`, {
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

  const draftLogId = toNumericId(draftLogRes.ok ? draftLogRes.data.data?.id : null);

  if (draftLogId) {
    const payableLogs = allItems.map((p) => {
      const pId = toNumericId(p.id) ?? 0;
      const edited = edited_payables?.find((e) => e.id === pId);
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

  if (finalVoteStatus === "REJECTED" || remainingCount <= 0) {
    const draftStatus: DraftLifecycleStatus =
      remainingCount <= 0 ? "With Concern" : "Rejected";

    await directusFetch(`/items/disbursement_draft/${draftId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: draftStatus,
        approval_version: currentVersion + 1,
      }),
    });

    return { ok: true, result: finalVoteStatus, message: "Draft updated." };
  }

  const tierApproversRes = await directusFetch<DirectusListResponse<DirectusApproverRow>>(
    `/items/disbursement_draft_approver?filter[division_id][_eq]=${draftDivisionId}&filter[is_deleted][_eq]=0&filter[approver_heirarchy][_eq]=${currentTier}&fields=approver_id&limit=-1`
  );

  const totalInTier = (tierApproversRes.ok ? tierApproversRes.data.data ?? [] : []).length || 1;

  const votesInTierRes = await directusFetch<DirectusListResponse<ApprovalVoteRow>>(
    `/items/disbursement_draft_approvals?filter[draft_id][_eq]=${draftId}&filter[status][_in]=APPROVED,WITH_CONCERN&filter[version][_eq]=${currentVersion}&limit=-1`
  );

  const approvedInTier = (votesInTierRes.ok ? votesInTierRes.data.data ?? [] : []).length;

  if (approvedInTier >= totalInTier) {
    const allApproversRes = await directusFetch<DirectusListResponse<DirectusApproverRow>>(
      `/items/disbursement_draft_approver?filter[division_id][_eq]=${draftDivisionId}&filter[is_deleted][_eq]=0&sort=-approver_heirarchy&limit=1&fields=approver_heirarchy`
    );

    const maxLevel = toNumber((allApproversRes.ok ? allApproversRes.data.data ?? [] : [])[0]?.approver_heirarchy, 1) || 1;
    const nextLevel = currentTier + 1;

    if (nextLevel > maxLevel) {
      return await finalizeDisbursementDraft({
        draftId,
        draft,
        currentUserId,
        currentVersion,
        finalTotal,
        finalRemarks,
        nowTs,
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
  }

  return { ok: true, result: finalVoteStatus, message: "Vote recorded." };
}
