// src/modules/financial-management/treasury/bulk-approval/services/finalTopSheets.service.ts
import type { NextResponse } from "next/server";
import { directusFetch } from "./directus.service";
import { jsonResponse } from "./http";
import type {
  BulkApprovalContext,
  DirectusItemResponse,
  DirectusListResponse,
  DisbursementDraftRow,
  DisbursementPayableDraftRow,
  ExpenseDraftHeaderRow,
  ExpenseDraftRow,
  FinalHeaderDecisionBody,
  FinalHeaderDecisionStatus,
  FinalHeaderGroupResponse,
  FinalTopSheetCellResponse,
  FinalTopSheetCoaRowResponse,
  FinalTopSheetDetailResponse,
  FinalTopSheetSalesmanResponse,
} from "./bulkApproval.types";
import {
  buildFilterQuery,
  createExpenseLog,
  fetchCoaDetailMap,
  fetchDivisionMap,
  fetchSalesmanMap,
  fetchUserMap,
  finalizeDisbursementDraft,
  getApprovalContextsForUser,
  getExpenseEmployeeId,
  isFinalHeaderDecisionBody,
  makeFinalGroupKey,
  normalizeFinalDecisionStatus,
  nowManila,
  recalcDraftTotal,
  resolveAttachmentId,
  tierStatus,
  toNumber,
  toNumericId,
  toStringOrNull,
} from "./bulkApproval.shared";

type FinalDecisionScope = "all" | "encoder" | "coa" | "cell" | "expense_ids";

type ExpenseAttachmentRow = {
  header_id?: number | string | null;
  file_url?: string | null;
  file_name?: string | null;
};

function normalizeDecisionScope(value: unknown): FinalDecisionScope | null {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "all" || normalized === "whole" || normalized === "header") return "all";
  if (normalized === "encoder" || normalized === "employee") return "encoder";
  if (normalized === "coa") return "coa";
  if (normalized === "cell") return "cell";
  if (
    normalized === "expense_ids" ||
    normalized === "expense_id" ||
    normalized === "expense" ||
    normalized === "item" ||
    normalized === "items"
  ) {
    return "expense_ids";
  }

  return null;
}

function getNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value.map((item) => toNumber(item)).filter((item) => item > 0))];
}


type PayableDraftLookupRow = Pick<
  DisbursementPayableDraftRow,
  "id" | "disbursement_id" | "expense_id" | "amount"
>;

type PayableDraftExpenseLinkRow = {
  id?: number | string | null;
  disbursement_id?: number | string | { id?: number | string | null } | null;
  expense_id?:
    | number
    | string
    | {
        id?: number | string | null;
        header_id?: number | string | { id?: number | string | null } | null;
      }
    | null;
  amount?: number | string | null;
};

function getNestedExpenseId(value: DisbursementPayableDraftRow["expense_id"] | PayableDraftExpenseLinkRow["expense_id"]): number | null {
  if (typeof value === "object" && value !== null) {
    return toNumericId(value.id);
  }

  return toNumericId(value);
}

function getPayableExpenseHeaderId(value: PayableDraftExpenseLinkRow["expense_id"]): number | null {
  if (typeof value === "object" && value !== null) {
    return toNumericId(value.header_id);
  }

  return null;
}

function getPipelineStatuses(maxLevel: number): string[] {
  const safeMax = Math.max(1, Math.floor(maxLevel));
  return Array.from({ length: safeMax }, (_, index) => tierStatus(index + 1));
}

function getReadableStatusesForDivision(params: {
  divisionId: number;
  context: BulkApprovalContext;
}): string[] {
  const records = params.context.approverRecords.filter(
    (record) => record.division_id === params.divisionId
  );

  const statuses = new Set<string>();

  for (const record of records) {
    const maxLevel = params.context.maxLevelByDivision[params.divisionId] ?? record.approver_heirarchy;
    const isFinalApprover = record.approver_heirarchy === maxLevel;

    if (isFinalApprover) {
      for (const status of getPipelineStatuses(maxLevel)) statuses.add(status);
      statuses.add("With Concern");
      statuses.add("Rejected");
      statuses.add("Approved");
    } else {
      // Non-final approvers in a Top Sheet context see nothing.
      // They should use the "My Level Approval" tab instead.
    }
  }

  return [...statuses];
}

function getActionableStatusesForDivision(params: {
  divisionId: number;
  context: BulkApprovalContext;
}): string[] {
  const statuses = new Set<string>();

  const records = params.context.approverRecords.filter(
    (record) => record.division_id === params.divisionId
  );

  for (const record of records) {
    const maxLevel = params.context.maxLevelByDivision[params.divisionId] ?? record.approver_heirarchy;
    const isFinalApprover = record.approver_heirarchy === maxLevel;

    // In the Final Top Sheet matrix, "Actionable" strictly means the draft is at the final tier level.
    // If the user also holds a non-final level for this division, those non-final actions
    // should be handled via the "My Level Approvals" tab, not the Final Matrix.
    if (isFinalApprover) {
      statuses.add(tierStatus(record.approver_heirarchy));
      statuses.add("With Concern");
      statuses.add("Approved");
    }
  }

  return [...statuses];
}

async function getVisibleDraftsForDivision(params: {
  divisionId: number;
  context: BulkApprovalContext;
}) {
  const readableStatuses = getReadableStatusesForDivision(params);
  const actionableStatuses = getActionableStatusesForDivision(params);

  if (!readableStatuses.length) {
    return {
      drafts: [] as { id: number; division_id: number; status: string; can_act: boolean; current_tier: number }[],
      readableStatuses,
      actionableStatuses,
    };
  }

  const draftQuery = new URLSearchParams({
    filter: JSON.stringify({
      division_id: { _eq: params.divisionId },
      status: { _in: readableStatuses },
    }),
    fields: "id,division_id,status",
    limit: "-1",
  }).toString();

  const draftRes = await directusFetch<
    DirectusListResponse<{ id: number | string; division_id: number | string; status?: string | null }>
  >(`/items/disbursement_draft?${draftQuery}`);

  const actionableStatusSet = new Set(actionableStatuses);

  return {
    drafts: (draftRes.ok ? draftRes.data.data ?? [] : [])
      .map((draft) => {
        const id = toNumericId(draft.id);
        const divisionId = toNumericId(draft.division_id);
        const status = toStringOrNull(draft.status) ?? "";

        if (!id || !divisionId || !status) return null;

        return {
          id,
          division_id: divisionId,
          status,
          can_act: actionableStatusSet.has(status),
          current_tier: parseDraftTier(status),
        };
      })
      .filter((draft): draft is { id: number; division_id: number; status: string; can_act: boolean; current_tier: number } => Boolean(draft)),
    readableStatuses,
    actionableStatuses,
  };
}

function parseDraftTier(status: string): number {
  const normalized = status.trim();
  if (normalized.toLowerCase() === "submitted") return 1;

  const match = normalized.match(/^Pending_L(\d+)$/i);
  if (match) return Number(match[1]);

  return 0;
}





type LinkedTopSheetPayable = {
  payable_id: number;
  draft_id: number;
  expense_id: number;
  header_id: number;
};

type LinkedTopSheetData = {
  visibleDrafts: { id: number; division_id: number; status: string; can_act: boolean; current_tier: number }[];
  draftStatuses: string[];
  canAct: boolean;
  currentTier: number;
  requiredApproverLevel: number;
  headers: ExpenseDraftHeaderRow[];
  headerIds: number[];
  payables: LinkedTopSheetPayable[];
  expenseIds: number[];
  isApprovedHistory: boolean;
};

async function resolveLinkedTopSheetData(params: {
  divisionId: number;
  periodFrom?: string;
  periodTo?: string;
  context: BulkApprovalContext;
  actionableOnly?: boolean;
}): Promise<LinkedTopSheetData> {
  const visibleDraftResult = await getVisibleDraftsForDivision({
    divisionId: params.divisionId,
    context: params.context,
  });

  const visibleDrafts = params.actionableOnly
    ? visibleDraftResult.drafts.filter((draft) => draft.can_act)
    : visibleDraftResult.drafts;

  const draftIds = visibleDrafts.map((draft) => draft.id);
  const draftStatuses = [...new Set(visibleDrafts.map((draft) => draft.status))];
  const canAct = visibleDrafts.some((draft) => draft.can_act);
  const currentTier = visibleDrafts.reduce((max, draft) => Math.max(max, draft.current_tier), 0);
  const requiredApproverLevel = params.context.maxLevelByDivision[params.divisionId] ?? currentTier;

  if (!draftIds.length) {
    return {
      visibleDrafts,
      draftStatuses,
      canAct,
      currentTier,
      requiredApproverLevel,
      headers: [],
      headerIds: [],
      payables: [],
      expenseIds: [],
      isApprovedHistory: false,
    };
  }

  const payableQuery = buildFilterQuery(
    { disbursement_id: { _in: draftIds } },
    "id,disbursement_id,expense_id,expense_id.id,expense_id.header_id",
    { limit: "-1" }
  );

  const payableRes = await directusFetch<DirectusListResponse<PayableDraftExpenseLinkRow>>(
    `/items/disbursement_payables_draft?${payableQuery}`
  );

  if (!payableRes.ok) {
    return {
      visibleDrafts,
      draftStatuses,
      canAct,
      currentTier,
      requiredApproverLevel,
      headers: [],
      headerIds: [],
      payables: [],
      expenseIds: [],
      isApprovedHistory: false,
    };
  }

  const rawPayables = payableRes.data.data ?? [];
  const expenseIds = [
    ...new Set(
      rawPayables
        .map((payable) => getNestedExpenseId(payable.expense_id))
        .filter((id): id is number => Boolean(id))
    ),
  ];

  if (!expenseIds.length) {
    return {
      visibleDrafts,
      draftStatuses,
      canAct,
      currentTier,
      requiredApproverLevel,
      headers: [],
      headerIds: [],
      payables: [],
      expenseIds: [],
      isApprovedHistory: false,
    };
  }

  const expenseHeaderMap = new Map<number, number>();

  for (const payable of rawPayables) {
    const expenseId = getNestedExpenseId(payable.expense_id);
    const headerId = getPayableExpenseHeaderId(payable.expense_id);
    if (expenseId && headerId) expenseHeaderMap.set(expenseId, headerId);
  }

  const missingHeaderExpenseIds = expenseIds.filter((expenseId) => !expenseHeaderMap.has(expenseId));

  if (missingHeaderExpenseIds.length > 0) {
    const fallbackExpenseQuery = buildFilterQuery(
      { id: { _in: missingHeaderExpenseIds } },
      "id,header_id",
      { limit: "-1" }
    );

    const fallbackExpenseRes = await directusFetch<DirectusListResponse<ExpenseDraftRow>>(
      `/items/expense_draft?${fallbackExpenseQuery}`
    );

    if (fallbackExpenseRes.ok) {
      for (const expense of fallbackExpenseRes.data.data ?? []) {
        const expenseId = toNumericId(expense.id);
        const headerId = toNumericId(expense.header_id);
        if (expenseId && headerId) expenseHeaderMap.set(expenseId, headerId);
      }
    }
  }

  const linkedHeaderIds = [...new Set([...expenseHeaderMap.values()].filter((id) => id > 0))];

  if (!linkedHeaderIds.length) {
    return {
      visibleDrafts,
      draftStatuses,
      canAct,
      currentTier,
      requiredApproverLevel,
      headers: [],
      headerIds: [],
      payables: [],
      expenseIds: [],
      isApprovedHistory: false,
    };
  }

  const headerFilter: Record<string, unknown> = {
    id: { _in: linkedHeaderIds },
  };

  if (params.periodFrom) headerFilter.period_from = { _eq: params.periodFrom };
  if (params.periodTo) headerFilter.period_to = { _eq: params.periodTo };

  const headerQuery = buildFilterQuery(
    headerFilter,
    "id,division_id,period_from,period_to,created_by,created_at",
    { limit: "-1" }
  );

  const headerRes = await directusFetch<DirectusListResponse<ExpenseDraftHeaderRow>>(
    `/items/expense_draft_header?${headerQuery}`
  );

  if (!headerRes.ok) {
    return {
      visibleDrafts,
      draftStatuses,
      canAct,
      currentTier,
      requiredApproverLevel,
      headers: [],
      headerIds: [],
      payables: [],
      expenseIds: [],
      isApprovedHistory: false,
    };
  }

  const headers = headerRes.data.data ?? [];
  const headerIds = headers
    .map((header) => toNumericId(header.id))
    .filter((id): id is number => Boolean(id));
  const headerIdSet = new Set(headerIds);

  const payables: LinkedTopSheetPayable[] = rawPayables
    .map((payable) => {
      const payableId = toNumericId(payable.id) ?? 0;
      const draftId = toNumericId(payable.disbursement_id) ?? 0;
      const expenseId = getNestedExpenseId(payable.expense_id) ?? 0;
      const headerId = expenseHeaderMap.get(expenseId) ?? 0;

      return { payable_id: payableId, draft_id: draftId, expense_id: expenseId, header_id: headerId };
    })
    .filter(
      (payable) =>
        payable.payable_id > 0 &&
        payable.draft_id > 0 &&
        payable.expense_id > 0 &&
        payable.header_id > 0 &&
        headerIdSet.has(payable.header_id)
    );

  const scopedExpenseIds = [...new Set(payables.map((payable) => payable.expense_id))];

  const scopedDraftIds = new Set(payables.map((p) => p.draft_id));
  const scopedDrafts = visibleDrafts.filter((d) => scopedDraftIds.has(d.id));
  const scopedStatuses = [...new Set(scopedDrafts.map((d) => d.status))];
  const scopedCanAct = scopedDrafts.some((d) => d.can_act);
  const isApprovedHistory = scopedStatuses.every((s) => s === "Approved") && !scopedCanAct;
  const scopedTier = scopedDrafts.reduce((max, d) => Math.max(max, d.current_tier), 0);
  const scopedRequired = params.context.maxLevelByDivision[params.divisionId] ?? scopedTier;

  return {
    visibleDrafts: scopedDrafts,
    draftStatuses: scopedStatuses,
    canAct: scopedCanAct,
    currentTier: scopedTier,
    requiredApproverLevel: scopedRequired,
    headers,
    headerIds,
    payables,
    expenseIds: scopedExpenseIds,
    isApprovedHistory,
  };
}

export async function getExpenseHeaderGroups(params: {
  context: BulkApprovalContext;
}): Promise<FinalHeaderGroupResponse[]> {
  const { approverRecords, maxLevelByDivision } = params.context;
  const finalDivisionIds = [...new Set(
    approverRecords
      .filter(r => r.approver_heirarchy === (maxLevelByDivision[r.division_id] ?? r.approver_heirarchy))
      .map(r => r.division_id)
  )];

  if (!finalDivisionIds.length) return [];

  const divisionMap = await fetchDivisionMap(finalDivisionIds);
  const groupMap = new Map<
    string,
    FinalHeaderGroupResponse & {
      header_ids: number[];
      draft_ids: number[];
      expense_ids: number[];
    }
  >();

  for (const approvalDivisionId of finalDivisionIds) {
    const linked = await resolveLinkedTopSheetData({
      divisionId: approvalDivisionId,
      context: params.context,
    });

    if (!linked.payables.length || !linked.headers.length || !linked.expenseIds.length) continue;

    const headerById = new Map(
      linked.headers
        .map((header) => {
          const id = toNumericId(header.id);
          return id ? [id, header] as const : null;
        })
        .filter((entry): entry is readonly [number, ExpenseDraftHeaderRow] => Boolean(entry))
    );



    for (const header of linked.headers) {
      const headerId = toNumericId(header.id) ?? 0;
      const periodFrom = toStringOrNull(header.period_from) ?? "";
      const periodTo = toStringOrNull(header.period_to) ?? "";

      if (!headerId || !periodFrom || !periodTo) continue;

      const payablesForHeader = linked.payables.filter((payable) => payable.header_id === headerId);
      if (!payablesForHeader.length) continue;

      const relatedDraftIds = [...new Set(payablesForHeader.map((payable) => payable.draft_id))];
      const relatedDrafts = relatedDraftIds
        .map((draftId) => linked.visibleDrafts.find((draft) => draft.id === draftId))
        .filter((draft): draft is { id: number; division_id: number; status: string; can_act: boolean; current_tier: number } => Boolean(draft));

      if (!relatedDrafts.length) continue;

      const key = makeFinalGroupKey({
        divisionId: approvalDivisionId,
        periodFrom,
        periodTo,
      });

      const relatedStatuses = [...new Set(relatedDrafts.map((draft) => draft.status))];
      const canAct = relatedDrafts.some((draft) => draft.can_act);
      const currentTier = relatedDrafts.reduce((max, draft) => Math.max(max, draft.current_tier), 0);
      const requiredLevel = maxLevelByDivision[approvalDivisionId] ?? currentTier;
      const linkedExpenseIds = [...new Set(payablesForHeader.map((payable) => payable.expense_id))];

      const existing = groupMap.get(key);

      if (existing) {
        existing.header_count += headerById.has(headerId) ? 1 : 0;
        existing.header_ids = [...new Set([...existing.header_ids, headerId])];
        existing.header_id = Math.min(existing.header_id, headerId);
        existing.draft_ids = [...new Set([...existing.draft_ids, ...relatedDraftIds])];
        existing.draft_statuses = [...new Set([...(existing.draft_statuses || []), ...relatedStatuses])];
        existing.can_act = existing.can_act || canAct;
        existing.is_waiting = !existing.can_act;
        existing.current_tier = Math.max(existing.current_tier || 0, currentTier);
        existing.required_approver_level = Math.max(existing.required_approver_level || 0, requiredLevel);
        existing.is_final_ready = existing.can_act;
        existing.expense_ids = [...new Set([...existing.expense_ids, ...linkedExpenseIds])];
        continue;
      }

      groupMap.set(key, {
        group_key: key,
        division_id: approvalDivisionId,
        division_name: divisionMap.get(approvalDivisionId) ?? `Division #${approvalDivisionId}`,
        period_from: periodFrom,
        period_to: periodTo,
        header_id: headerId,
        header_count: 1,
        salesman_count: 0,
        coa_count: 0,
        expense_count: 0,
        total_amount: 0,
        is_final_ready: canAct,
        header_ids: [headerId],
        draft_ids: relatedDraftIds,
        draft_statuses: relatedStatuses,
        can_act: canAct,
        is_waiting: !canAct,
        current_tier: currentTier,
        required_approver_level: requiredLevel,
        expense_ids: linkedExpenseIds,
      });
    }
  }

  for (const group of groupMap.values()) {
    if (!group.expense_ids.length) continue;

    const expenseQuery = buildFilterQuery(
      { id: { _in: group.expense_ids } },
      "id,header_id,encoded_by,particulars,amount",
      { limit: "-1" }
    );

    const expenseRes = await directusFetch<DirectusListResponse<ExpenseDraftRow>>(
      `/items/expense_draft?${expenseQuery}`
    );

    const groupExpenses = expenseRes.ok ? expenseRes.data.data ?? [] : [];

    group.expense_count = groupExpenses.length;
    group.salesman_count = new Set(groupExpenses.map(getExpenseEmployeeId).filter((id) => id > 0)).size;
    group.coa_count = new Set(
      groupExpenses.map((expense) => toNumericId(expense.particulars) ?? 0).filter((id) => id > 0)
    ).size;
    group.total_amount = groupExpenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
  }

  return [...groupMap.values()]
    .filter((group) => group.expense_count > 0 && group.draft_ids.length > 0)
    .map((group) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { header_ids, expense_ids, ...rest } = group;
      return rest;
    })
    .sort((a, b) => {
      if (a.can_act !== b.can_act) return a.can_act ? -1 : 1;
      if (a.period_from === b.period_from) {
        return String(a.division_name ?? "").localeCompare(String(b.division_name ?? ""));
      }
      return b.period_from.localeCompare(a.period_from);
    });
}

export async function buildFinalTopSheet(params: {
  divisionId: number;
  periodFrom: string;
  periodTo: string;
  context: BulkApprovalContext;
}) {
  const linked = await resolveLinkedTopSheetData({
    divisionId: params.divisionId,
    periodFrom: params.periodFrom,
    periodTo: params.periodTo,
    context: params.context,
  });

  const emptyData = {
    group: {
      division_id: params.divisionId,
      division_name: `Division #${params.divisionId}`,
      period_from: params.periodFrom,
      period_to: params.periodTo,
      header_count: linked.headers.length,
      total_amount: 0,
      draft_statuses: linked.draftStatuses,
      can_act: linked.canAct,
      is_waiting: !linked.canAct,
      current_tier: linked.currentTier,
      required_approver_level: linked.requiredApproverLevel,
      current_tier_approvers: [] as { approver_id: number; name: string; voted: boolean }[],
    },
    salesmen: [],
    coa_rows: [],
    grand_total: 0,
    details: [],
    attachments: [],
  };

  if (!linked.visibleDrafts.length || !linked.payables.length || !linked.expenseIds.length || !linked.headerIds.length) {
    return { ok: true as const, status: 200, data: emptyData };
  }

  const expenseQuery = buildFilterQuery(
    { header_id: { _in: linked.headerIds } },
    "id,header_id,encoded_by,particulars,division_id,transaction_date,amount,status,remarks,payee,attachment_url",
    { sort: "particulars,encoded_by,transaction_date", limit: "-1" }
  );

  const expenseRes = await directusFetch<DirectusListResponse<ExpenseDraftRow>>(
    `/items/expense_draft?${expenseQuery}`
  );
  if (!expenseRes.ok) return { ok: false as const, status: expenseRes.status, data: expenseRes.data };

  const allowedExpenseIdSet = new Set(linked.expenseIds);
  const expenses = (expenseRes.data.data ?? []).filter((expense) => {
    const expenseId = toNumericId(expense.id);
    const status = (expense.status ?? "").toLowerCase();
    const isCulledButRelevant = status === "with concern" || status === "rejected";
    
    return Boolean(expenseId && (allowedExpenseIdSet.has(expenseId) || isCulledButRelevant));
  });

  if (!expenses.length) {
    return { ok: true as const, status: 200, data: emptyData };
  }

  const employeeIds = [...new Set(expenses.map(getExpenseEmployeeId).filter((id) => id > 0))];
  const coaIds = [
    ...new Set(expenses.map((expense) => toNumericId(expense.particulars) ?? 0).filter((id) => id > 0)),
  ];

  const draftIds = linked.visibleDrafts.map((d) => d.id);

  const [divisionMap, userMap, salesmanMap, coaMap, approversRes, votesRes] = await Promise.all([
    fetchDivisionMap([params.divisionId]),
    fetchUserMap(employeeIds),
    fetchSalesmanMap(employeeIds),
    fetchCoaDetailMap(coaIds),
    directusFetch(
      `/items/disbursement_draft_approver?filter[division_id][_eq]=${params.divisionId}&filter[is_deleted][_eq]=0&fields=approver_id,approver_heirarchy&limit=-1`
    ),
    draftIds.length > 0
      ? directusFetch(
          `/items/disbursement_draft_approvals?filter[draft_id][_in]=${draftIds.join(",")}&fields=approver_id,status,draft_id&limit=-1`
        )
      : Promise.resolve({ ok: true, data: { data: [] } }),
  ]);

  // Build current-tier approver list with voted/pending status
  type ApproverRow = { approver_id?: number | string | null; approver_heirarchy?: number | string | null };
  type VoteRow = { approver_id?: number | string | null; status?: string | null };
  const allApproverRows: ApproverRow[] = (approversRes.ok ? (approversRes.data as { data?: ApproverRow[] }).data ?? [] : []);
  const allVoteRows: VoteRow[] = (votesRes.ok ? (votesRes.data as { data?: VoteRow[] }).data ?? [] : []);
  const votedApproverIds = new Set(allVoteRows.map((v) => toNumericId(v.approver_id)).filter((id): id is number => Boolean(id)));
  const tierApproverIds = Array.from(
    new Set(
      allApproverRows
        .filter((r) => toNumber(r.approver_heirarchy) === linked.currentTier)
        .map((r) => toNumericId(r.approver_id))
        .filter((id): id is number => Boolean(id))
    )
  );
  const tierApproverUserMap = tierApproverIds.length > 0 ? await fetchUserMap(tierApproverIds) : new Map<number, string>();
  const currentTierApprovers = tierApproverIds.map((id) => ({
    approver_id: id,
    name: tierApproverUserMap.get(id) ?? `User #${id}`,
    voted: votedApproverIds.has(id),
  }));

  const salesmen: FinalTopSheetSalesmanResponse[] = employeeIds
    .map((employeeId) => {
      const salesman = salesmanMap.get(employeeId);
      const name = salesman?.salesman_name?.trim() || userMap.get(employeeId) || `User #${employeeId}`;
      const total = expenses
        .filter((expense) => getExpenseEmployeeId(expense) === employeeId)
        .reduce((sum, expense) => sum + toNumber(expense.amount), 0);

      return {
        employee_id: employeeId,
        salesman_id: salesman?.salesman_id ?? null,
        salesman_code: salesman?.salesman_code ?? null,
        salesman_name: name,
        total_amount: total,
      };
    })
    .sort((a, b) => a.salesman_name.localeCompare(b.salesman_name));

  const details: FinalTopSheetDetailResponse[] = expenses.map((expense) => {
    const employeeId = getExpenseEmployeeId(expense);
    const salesman = salesmanMap.get(employeeId);
    const coaId = toNumericId(expense.particulars) ?? 0;
    const coa = coaMap.get(coaId);

    return {
      expense_id: toNumericId(expense.id) ?? 0,
      header_id: toNumericId(expense.header_id) ?? 0,
      employee_id: employeeId,
      salesman_name: salesman?.salesman_name?.trim() || userMap.get(employeeId) || `User #${employeeId}`,
      coa_id: coaId,
      account_title: coa?.account_title ?? `COA #${coaId}`,
      transaction_date: toStringOrNull(expense.transaction_date) ?? "",
      amount: toNumber(expense.amount),
      payee: expense.payee ?? null,
      remarks: expense.remarks ?? null,
      status: expense.status ?? "",
      attachment_url: resolveAttachmentId(expense.attachment_url),
    };
  });

  const attachmentsRes = await directusFetch<DirectusListResponse<ExpenseAttachmentRow>>(
    `/items/expense_attachments?filter[header_id][_in]=${linked.headerIds.join(",")}&fields=header_id,file_url,file_name&limit=-1`
  );

  const attachments = attachmentsRes.ok ? attachmentsRes.data.data ?? [] : [];

  const coaRows: FinalTopSheetCoaRowResponse[] = coaIds
    .map((coaId) => {
      const coa = coaMap.get(coaId);
      const rowDetails = details.filter((detail) => detail.coa_id === coaId);
      const cells: FinalTopSheetCellResponse[] = salesmen
        .map((salesman) => {
          const cellDetails = rowDetails.filter((detail) => detail.employee_id === salesman.employee_id);
          return {
            employee_id: salesman.employee_id,
            amount: cellDetails.reduce((sum, detail) => sum + detail.amount, 0),
            count: cellDetails.length,
            expense_ids: cellDetails.map((detail) => detail.expense_id).filter((id) => id > 0),
            has_concern: cellDetails.some((detail) => detail.status.toLowerCase().includes("concern")),
            has_rejected: cellDetails.some((detail) => detail.status.toLowerCase() === "rejected"),
          };
        })
        .filter((cell) => cell.count > 0 || cell.amount > 0);

      return {
        coa_id: coaId,
        account_title: coa?.account_title ?? `COA #${coaId}`,
        gl_code: coa?.gl_code ?? null,
        row_total: rowDetails.reduce((sum, detail) => sum + detail.amount, 0),
        cells,
      };
    })
    .sort((a, b) => a.account_title.localeCompare(b.account_title));

  const grandTotal = details.reduce((sum, detail) => sum + detail.amount, 0);

  return {
    ok: true as const,
    status: 200,
    data: {
      group: {
        division_id: params.divisionId,
        division_name: divisionMap.get(params.divisionId) ?? `Division #${params.divisionId}`,
        period_from: params.periodFrom,
        period_to: params.periodTo,
        header_count: linked.headers.length,
        total_amount: grandTotal,
        draft_statuses: linked.draftStatuses,
        can_act: linked.canAct,
        is_waiting: !linked.canAct,
        is_finalized: linked.isApprovedHistory,
        current_tier: linked.currentTier,
        required_approver_level: linked.requiredApproverLevel,
        current_tier_approvers: currentTierApprovers,
      },
      salesmen,
      coa_rows: coaRows,
      grand_total: grandTotal,
      details,
      attachments: attachments.map((attachment) => ({
        header_id: toNumericId(attachment.header_id) ?? 0,
        file_url: attachment.file_url ?? "",
        file_name: attachment.file_name ?? "Attachment",
      })),
    },
  };
}

export async function handleFinalTopSheetsGetResource(params: {
  resource: string;
  searchParams: URLSearchParams;
  context: BulkApprovalContext;
}): Promise<NextResponse | null> {
  if (params.resource === "final-header-groups") {
    const groups = await getExpenseHeaderGroups({ context: params.context });
    return jsonResponse({ data: groups });
  }

  if (params.resource === "final-topsheet") {
    const divisionId = toNumber(params.searchParams.get("division_id"));
    const periodFrom = toStringOrNull(params.searchParams.get("period_from"));
    const periodTo = toStringOrNull(params.searchParams.get("period_to"));

    if (!divisionId || !periodFrom || !periodTo) {
      return jsonResponse(
        { error: "division_id, period_from, and period_to are required" },
        { status: 400 }
      );
    }

    const contexts = await getApprovalContextsForUser({
      approverRecords: params.context.approverRecords,
      allApprovers: params.context.allApprovers,
    });

    const isAllowed = contexts.some((context) => context.division_id === divisionId);

    if (!isAllowed) {
      return jsonResponse({ error: "Forbidden" }, { status: 403 });
    }

    const topSheet = await buildFinalTopSheet({
      divisionId,
      periodFrom,
      periodTo,
      context: params.context,
    });

    if (!topSheet.ok) return jsonResponse(topSheet.data, { status: topSheet.status });
    return jsonResponse(topSheet.data);
  }

  return null;
}

export async function handleFinalHeaderDecision(params: {
  body: Record<string, unknown>;
  context: BulkApprovalContext;
}) {
  if (!isFinalHeaderDecisionBody(params.body)) {
    return jsonResponse({ error: "Invalid final decision payload" }, { status: 400 });
  }

  const body: FinalHeaderDecisionBody = params.body;
  const divisionId = toNumber(body.division_id);
  const periodFrom = toStringOrNull(body.period_from);
  const periodTo = toStringOrNull(body.period_to);
  const status = normalizeFinalDecisionStatus(body.status) as FinalHeaderDecisionStatus | null;
  const remarks = toStringOrNull(body.remarks) ?? "";

  let scope = normalizeDecisionScope(body.target_scope);
  const employeeId = toNumber(body.employee_id);
  const coaId = toNumber(body.coa_id);
  let expenseIds = getNumberArray(body.expense_ids);
  const legacyConcernExpenseIds = getNumberArray(body.concern_expense_ids);

  if (legacyConcernExpenseIds.length > 0 && expenseIds.length === 0) {
    expenseIds = legacyConcernExpenseIds;
  }

  if (expenseIds.length > 0) {
    scope = "expense_ids";
  }

  if (!scope) {
    return jsonResponse(
      {
        error: "Invalid target_scope",
        allowed_scopes: ["all", "encoder", "coa", "cell", "expense_ids"],
      },
      { status: 400 }
    );
  }

  if (!divisionId || !periodFrom || !periodTo || !status) {
    return jsonResponse(
      { error: "division_id, period_from, period_to, and valid status are required" },
      { status: 400 }
    );
  }

  const contexts = await getApprovalContextsForUser({
    approverRecords: params.context.approverRecords,
    allApprovers: params.context.allApprovers,
  });

  const userContext = contexts.find((context) => context.division_id === divisionId);

  if (!userContext) {
    return jsonResponse({ error: "Forbidden: No approval authority for this division" }, { status: 403 });
  }


  const actionableStatuses = getActionableStatusesForDivision({ divisionId, context: params.context });
  const visibleDraftResult = await getVisibleDraftsForDivision({ divisionId, context: params.context });
  const hasActionableDraftForPeriod = visibleDraftResult.drafts.some((draft) =>
    actionableStatuses.includes(draft.status)
  );

  if (!hasActionableDraftForPeriod) {
    return jsonResponse(
      {
        error: "Final Top Sheet is visible but not yet actionable for your approval level.",
        message: "Please wait until the disbursement draft reaches your approval level.",
        current_statuses: [...new Set(visibleDraftResult.drafts.map((draft) => draft.status))],
        actionable_statuses: actionableStatuses,
      },
      { status: 409 }
    );
  }

  if ((status === "Rejected" || status === "With Concern") && !remarks.trim()) {
    return jsonResponse({ error: "Remarks are required for rejected or concern decisions" }, { status: 400 });
  }

  const linked = await resolveLinkedTopSheetData({
    divisionId,
    periodFrom,
    periodTo,
    context: params.context,
    actionableOnly: true,
  });

  if (!linked.headerIds.length || !linked.expenseIds.length || !linked.payables.length) {
    return jsonResponse(
      { error: "No linked payable draft expenses found for this final top sheet period" },
      { status: 404 }
    );
  }

  const filters: Record<string, unknown> = {
    id: { _in: linked.expenseIds },
  };

  if (scope === "expense_ids") {
    if (!expenseIds.length) {
      return jsonResponse({ error: "expense_ids are required for expense_ids target scope" }, { status: 400 });
    }

    const linkedExpenseIdSet = new Set(linked.expenseIds);
    const outsideLinkedScope = expenseIds.some((expenseId) => !linkedExpenseIdSet.has(expenseId));

    if (outsideLinkedScope) {
      return jsonResponse(
        { error: "Scope mismatch: selected expense_ids are not linked to this final top sheet" },
        { status: 409 }
      );
    }

    filters.id = { _in: expenseIds };
  } else if (scope === "encoder") {
    if (!employeeId) return jsonResponse({ error: "employee_id is required for encoder target scope" }, { status: 400 });
    filters.encoded_by = { _eq: employeeId };
  } else if (scope === "coa") {
    if (!coaId) return jsonResponse({ error: "coa_id is required for coa target scope" }, { status: 400 });
    filters.particulars = { _eq: coaId };
  } else if (scope === "cell") {
    if (!employeeId || !coaId) {
      return jsonResponse({ error: "employee_id and coa_id are required for cell target scope" }, { status: 400 });
    }
    filters.encoded_by = { _eq: employeeId };
    filters.particulars = { _eq: coaId };
  }

  const expenseQuery = buildFilterQuery(
    filters,
    "id,division_id,transaction_date,amount,status,header_id,encoded_by,particulars"
  );

  const expenseRes = await directusFetch<DirectusListResponse<ExpenseDraftRow>>(
    `/items/expense_draft?${expenseQuery}`
  );
  if (!expenseRes.ok) return jsonResponse(expenseRes.data, { status: expenseRes.status });

  const rawTargetExpenses = expenseRes.data.data ?? [];

  if (!rawTargetExpenses.length) {
    return jsonResponse({ error: "No matching expense rows found in the selected scope" }, { status: 404 });
  }

  if (scope === "expense_ids") {
    const requestedIdSet = new Set(expenseIds);
    const outsideRequest = rawTargetExpenses.some((expense) => {
      const expenseId = toNumericId(expense.id);
      return !expenseId || !requestedIdSet.has(expenseId);
    });

    if (outsideRequest) {
      return jsonResponse(
        { error: "Scope mismatch: fetched expenses outside requested expense_ids" },
        { status: 409 }
      );
    }
  }

  const targetExpenseIds = rawTargetExpenses
    .map((expense) => toNumericId(expense.id))
    .filter((id): id is number => Boolean(id));

  const targetExpenseIdSet = new Set(targetExpenseIds);
  const payableByExpenseId = new Map<number, PayableDraftLookupRow[]>();

  for (const payable of linked.payables) {
    if (!targetExpenseIdSet.has(payable.expense_id)) continue;

    const row: PayableDraftLookupRow = {
      id: payable.payable_id,
      disbursement_id: payable.draft_id,
      expense_id: payable.expense_id,
      amount: null,
    };

    const existing = payableByExpenseId.get(payable.expense_id) ?? [];
    existing.push(row);
    payableByExpenseId.set(payable.expense_id, existing);
  }

  const targetExpenses = rawTargetExpenses.filter((expense) => {
    const expenseId = toNumericId(expense.id);
    return Boolean(expenseId && payableByExpenseId.has(expenseId));
  });

  if (!targetExpenses.length) {
    return jsonResponse(
      { error: "No selected expense rows are linked to active payable drafts for your approval level" },
      { status: 404 }
    );
  }

  const nowTs = nowManila();
  const patchPayload: Record<string, unknown> = {
    status,
    feedback: status === "Approved" ? null : remarks,
    return_to: status === "With Concern" ? `L${userContext.approver_level}` : null,
    date_updated: nowTs,
  };

  if (status === "Approved") {
    patchPayload.approved_at = nowTs;
    patchPayload.rejected_at = null;
  } else if (status === "Rejected") {
    patchPayload.approved_at = null;
    patchPayload.rejected_at = nowTs;
  } else {
    patchPayload.approved_at = null;
    patchPayload.rejected_at = null;
  }

  const results: { id: number; ok: boolean; error?: unknown }[] = [];
  const affectedEncoderIds = new Set<number>();
  for (const expense of targetExpenses) {
    const expenseId = toNumericId(expense.id);
    if (!expenseId) continue;

    const encoderId = getExpenseEmployeeId(expense);
    if (encoderId > 0) affectedEncoderIds.add(encoderId);

    const patchRes = await directusFetch(`/items/expense_draft/${expenseId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patchPayload),
    });

    if (!patchRes.ok) {
      results.push({ id: expenseId, ok: false, error: patchRes.data });
      continue;
    }

    // --- NEW: Cull from payables draft if rejected/concern ---
    if (status === "Rejected" || status === "With Concern") {
      const payablesToCull = payableByExpenseId.get(expenseId) ?? [];
      const cullIds = payablesToCull.map(p => toNumericId(p.id)).filter((id): id is number => id !== null);
      if (cullIds.length > 0) {
        await directusFetch(`/items/disbursement_payables_draft`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(cullIds),
        });
        // Also recalc the draft totals for each affected draft
        for (const p of payablesToCull) {
          const dId = toNumericId(p.disbursement_id);
          if (dId) await recalcDraftTotal(dId);
        }
      }
    }

    await createExpenseLog({
      expenseId,
      action: `Final Top Sheet ${status}`,
      changedBy: params.context.currentUserId,
      changedAt: nowTs,
      amount: expense.amount,
      remarks: remarks || `Final Top Sheet staged ${status}`,
      status,
    });

    results.push({ id: expenseId, ok: true });
  }

  const successIds = results.filter((result) => result.ok).map((result) => result.id);
  const failCount = results.length - successIds.length;
  const affectedEncoderIdList = [...affectedEncoderIds];
  const linkedDraftIds = [
    ...new Set(
      successIds
        .flatMap((expenseId) => payableByExpenseId.get(expenseId) ?? [])
        .map((payable) => toNumericId(payable.disbursement_id))
        .filter((id): id is number => Boolean(id))
    ),
  ];


  if (failCount > 0) {
    return jsonResponse(
      {
        ok: false,
        message: `Processed with partial success. ${successIds.length} updated, ${failCount} failed.`,
        updated_count: successIds.length,
        affected_encoder_count: affectedEncoderIdList.length,
        affected_encoder_ids: affectedEncoderIdList,
        linked_draft_ids: linkedDraftIds,
        disbursement_draft_status_updated: false,
        results,
      },
      { status: 207 }
    );
  }

  const maxLevel = params.context.maxLevelByDivision[divisionId] ?? userContext.approver_level;
  const isFinalLevel = userContext.approver_level >= maxLevel;

  let disbursement_draft_status_updated = false;
  const finalizationResults: Array<{ draft_id: number; result: string; doc_no?: string }> = [];

  if (isFinalLevel && status === "Approved") {
    for (const draftId of linkedDraftIds) {
      // Safety Check: Verify that ALL items remaining in the staging table are actually "Approved".
      // This prevents premature finalization during a bulk batch submission where subsequent
      // requests haven't processed yet, which would otherwise auto-reject the remaining pending items.
      const pRes = await directusFetch<DirectusListResponse<{ expense_id?: { status?: string } | null }>>(
        `/items/disbursement_payables_draft?filter[disbursement_id][_eq]=${draftId}&fields=expense_id.status&limit=-1`
      );

      const payables = pRes.ok ? pRes.data.data ?? [] : [];
      const allApproved = payables.length > 0 && payables.every(p => {
        const s = String(p.expense_id?.status || "").toLowerCase();
        return s === "approved";
      });

      if (!allApproved) {
        continue;
      }

      const draftRes = await directusFetch<DirectusItemResponse<DisbursementDraftRow>>(
        `/items/disbursement_draft/${draftId}?fields=id,status,approval_version,division_id,encoder_id,payee,transaction_type,transaction_date,doc_no`
      );
      const draft = draftRes.ok ? draftRes.data.data : null;
      if (!draft) continue;

      const currentVersion = toNumber(draft.approval_version, 1);

      const fRes = await finalizeDisbursementDraft({
        draftId,
        draft,
        currentUserId: params.context.currentUserId,
        currentVersion,
        finalTotal: toNumber(draft.total_amount), // Will be recalculated inside finalizer if needed
        finalRemarks: remarks || "Approved via Final Top-Sheet Matrix",
        nowTs,
      });

      if (fRes.ok) {
        disbursement_draft_status_updated = true;
        finalizationResults.push({ draft_id: draftId, result: "result" in fRes ? String(fRes.result) : "UNKNOWN", doc_no: (fRes as { doc_no?: string }).doc_no });
      }
    }
  }

  return jsonResponse({
    ok: true,
    message: isFinalLevel && status === "Approved" 
      ? `Successfully finalized and posted ${successIds.length} line(s).` 
      : `Successfully staged ${successIds.length} line(s) as ${status}.`,
    updated_count: successIds.length,
    affected_encoder_count: affectedEncoderIdList.length,
    affected_encoder_ids: affectedEncoderIdList,
    linked_draft_ids: linkedDraftIds,
    disbursement_draft_status_updated,
    finalization_results: finalizationResults.length > 0 ? finalizationResults : undefined,
    scope,
  });
}
