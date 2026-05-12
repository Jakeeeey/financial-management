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
  insertExpenseIntoPayableDraft,
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

function getNestedExpenseId(value: DisbursementPayableDraftRow["expense_id"]): number | null {
  if (typeof value === "object" && value !== null) {
    return toNumericId(value.id);
  }

  return toNumericId(value);
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
      statuses.add(tierStatus(record.approver_heirarchy));
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
    statuses.add(tierStatus(record.approver_heirarchy));

    const maxLevel = params.context.maxLevelByDivision[params.divisionId] ?? record.approver_heirarchy;
    const isFinalApprover = record.approver_heirarchy === maxLevel;

    // Legacy/expense-only guard:
    // Older Final Top Sheet logic incorrectly moved disbursement_draft.status to "With Concern".
    // Since this tab now only updates expense_draft rows, the final approver must still be able
    // to act on those expense rows while the real draft is in this legacy concern state.
    if (isFinalApprover) {
      statuses.add("With Concern");
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

async function getActiveDraftIdsForDivision(params: {
  divisionId: number;
  context: BulkApprovalContext;
}) {
  const targetStatuses = getActionableStatusesForDivision(params);

  if (!targetStatuses.length) return [];

  const draftQuery = new URLSearchParams({
    filter: JSON.stringify({
      division_id: { _eq: params.divisionId },
      status: { _in: targetStatuses },
    }),
    fields: "id",
    limit: "-1",
  }).toString();

  const draftRes = await directusFetch<DirectusListResponse<{ id: number | string }>>(
    `/items/disbursement_draft?${draftQuery}`
  );

  return (draftRes.ok ? draftRes.data.data ?? [] : [])
    .map((draft) => toNumericId(draft.id))
    .filter((id): id is number => Boolean(id));
}

async function getHeaderIdsForPeriod(params: {
  divisionId: number;
  periodFrom: string;
  periodTo: string;
}) {
  const headerQuery = buildFilterQuery(
    {
      division_id: { _eq: params.divisionId },
      period_from: { _eq: params.periodFrom },
      period_to: { _eq: params.periodTo },
    },
    "id,division_id,period_from,period_to,created_by,created_at"
  );

  const headerRes = await directusFetch<DirectusListResponse<ExpenseDraftHeaderRow>>(
    `/items/expense_draft_header?${headerQuery}`
  );

  if (!headerRes.ok) {
    return { ok: false as const, status: headerRes.status, data: headerRes.data, headerIds: [] as number[], headers: [] as ExpenseDraftHeaderRow[] };
  }

  const headers = headerRes.data.data ?? [];
  const headerIds = headers
    .map((header) => toNumericId(header.id))
    .filter((id): id is number => Boolean(id));

  return { ok: true as const, status: 200, data: null, headerIds, headers };
}

export async function getExpenseHeaderGroups(params: {
  context: BulkApprovalContext;
}): Promise<FinalHeaderGroupResponse[]> {
  const { myDivisionIds, maxLevelByDivision } = params.context;
  if (!myDivisionIds.length) return [];

  const allVisibleDrafts: {
    id: number;
    division_id: number;
    status: string;
    can_act: boolean;
    current_tier: number;
  }[] = [];

  for (const divisionId of myDivisionIds) {
    const visible = await getVisibleDraftsForDivision({ divisionId, context: params.context });
    allVisibleDrafts.push(...visible.drafts);
  }

  if (!allVisibleDrafts.length) return [];

  const draftIds = allVisibleDrafts.map((draft) => draft.id);
  const draftById = new Map(allVisibleDrafts.map((draft) => [draft.id, draft]));
  const headerToDraftIds = new Map<number, Set<number>>();

  const payableQuery = new URLSearchParams({
    "filter[disbursement_id][_in]": draftIds.join(","),
    fields: "disbursement_id,expense_id.header_id",
    limit: "-1",
  }).toString();

  const payableRes = await directusFetch<
    DirectusListResponse<{
      disbursement_id?: number | string | { id?: number | string } | null;
      expense_id?: { header_id?: number | string | null } | number | null;
    }>
  >(`/items/disbursement_payables_draft?${payableQuery}`);

  const headerIds = [
    ...new Set(
      (payableRes.ok ? payableRes.data.data ?? [] : [])
        .map((payable) => {
          const draftId =
            typeof payable.disbursement_id === "object" && payable.disbursement_id !== null
              ? toNumericId(payable.disbursement_id.id)
              : toNumericId(payable.disbursement_id);

          const headerId =
            typeof payable.expense_id === "object" && payable.expense_id !== null
              ? toNumericId(payable.expense_id.header_id)
              : null;

          if (draftId && headerId) {
            const existing = headerToDraftIds.get(headerId) ?? new Set<number>();
            existing.add(draftId);
            headerToDraftIds.set(headerId, existing);
          }

          return headerId;
        })
        .filter((id): id is number => Boolean(id))
    ),
  ];

  if (!headerIds.length) return [];

  const headerQuery = buildFilterQuery(
    { id: { _in: headerIds } },
    "id,division_id,period_from,period_to,created_by,created_at",
    { sort: "-period_from,-period_to" }
  );

  const headerRes = await directusFetch<DirectusListResponse<ExpenseDraftHeaderRow>>(
    `/items/expense_draft_header?${headerQuery}`
  );
  if (!headerRes.ok) return [];

  const headers = headerRes.data.data ?? [];
  const normalizedHeaders = headers
    .map((header) => ({
      id: toNumericId(header.id) ?? 0,
      division_id: toNumericId(header.division_id) ?? 0,
      period_from: toStringOrNull(header.period_from) ?? "",
      period_to: toStringOrNull(header.period_to) ?? "",
    }))
    .filter(
      (header) =>
        header.id > 0 &&
        header.division_id > 0 &&
        Boolean(header.period_from) &&
        Boolean(header.period_to)
    );

  if (!normalizedHeaders.length) return [];

  const allHeaderIds = normalizedHeaders.map((header) => header.id);
  const expenseQuery = buildFilterQuery(
    { header_id: { _in: allHeaderIds } },
    "id,header_id,encoded_by,particulars,division_id,transaction_date,amount,status,remarks,payee,attachment_url"
  );

  const expenseRes = await directusFetch<DirectusListResponse<ExpenseDraftRow>>(
    `/items/expense_draft?${expenseQuery}`
  );
  const expenses = expenseRes.ok ? expenseRes.data.data ?? [] : [];

  const divisionMap = await fetchDivisionMap(myDivisionIds);
  const groupMap = new Map<
    string,
    FinalHeaderGroupResponse & {
      header_ids: number[];
      draft_ids: number[];
      draft_statuses: string[];
      can_act: boolean;
      is_waiting: boolean;
      current_tier: number;
      required_approver_level: number;
    }
  >();

  for (const header of normalizedHeaders) {
    const key = makeFinalGroupKey({
      divisionId: header.division_id,
      periodFrom: header.period_from,
      periodTo: header.period_to,
    });

    const relatedDraftIds = [...(headerToDraftIds.get(header.id) ?? new Set<number>())];
    const relatedDrafts = relatedDraftIds
      .map((draftId) => draftById.get(draftId))
      .filter((draft): draft is { id: number; division_id: number; status: string; can_act: boolean; current_tier: number } => Boolean(draft));

    const relatedStatuses = [...new Set(relatedDrafts.map((draft) => draft.status))];
    const canAct = relatedDrafts.some((draft) => draft.can_act);
    const currentTier = relatedDrafts.reduce((max, draft) => Math.max(max, draft.current_tier), 0);
    const requiredLevel = maxLevelByDivision[header.division_id] ?? currentTier;

    const existing = groupMap.get(key);

    if (existing) {
      existing.header_count += 1;
      existing.header_ids.push(header.id);
      existing.header_id = Math.min(existing.header_id, header.id);
      existing.draft_ids = [...new Set([...existing.draft_ids, ...relatedDraftIds])];
      existing.draft_statuses = [...new Set([...existing.draft_statuses, ...relatedStatuses])];
      existing.can_act = existing.can_act || canAct;
      existing.is_waiting = !existing.can_act;
      existing.current_tier = Math.max(existing.current_tier, currentTier);
      existing.required_approver_level = Math.max(existing.required_approver_level, requiredLevel);
      existing.is_final_ready = existing.can_act;
      continue;
    }

    groupMap.set(key, {
      group_key: key,
      division_id: header.division_id,
      division_name: divisionMap.get(header.division_id) ?? `Division #${header.division_id}`,
      period_from: header.period_from,
      period_to: header.period_to,
      header_id: header.id,
      header_count: 1,
      salesman_count: 0,
      coa_count: 0,
      expense_count: 0,
      total_amount: 0,
      is_final_ready: canAct,
      header_ids: [header.id],
      draft_ids: relatedDraftIds,
      draft_statuses: relatedStatuses,
      can_act: canAct,
      is_waiting: !canAct,
      current_tier: currentTier,
      required_approver_level: requiredLevel,
    });
  }

  for (const group of groupMap.values()) {
    const headerIdSet = new Set(group.header_ids);
    const groupExpenses = expenses.filter((expense) => {
      const headerId = toNumericId(expense.header_id) ?? 0;
      return headerIdSet.has(headerId);
    });

    group.expense_count = groupExpenses.length;
    group.salesman_count = new Set(
      groupExpenses.map(getExpenseEmployeeId).filter((id) => id > 0)
    ).size;
    group.coa_count = new Set(
      groupExpenses.map((expense) => toNumericId(expense.particulars) ?? 0).filter((id) => id > 0)
    ).size;
    group.total_amount = groupExpenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0);
  }

  return [...groupMap.values()]
    .map((group) => {
      const { header_ids: _headerIds, ...rest } = group;
      return rest;
    })
    .sort((a, b) => {
      if (a.can_act !== b.can_act) {
        return a.can_act ? -1 : 1;
      }
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
  const headerResult = await getHeaderIdsForPeriod({
    divisionId: params.divisionId,
    periodFrom: params.periodFrom,
    periodTo: params.periodTo,
  });

  if (!headerResult.ok) {
    return { ok: false as const, status: headerResult.status, data: headerResult.data };
  }

  const { headerIds, headers } = headerResult;

  if (!headerIds.length) {
    return {
      ok: true as const,
      status: 200,
      data: {
        group: {
          division_id: params.divisionId,
          division_name: `Division #${params.divisionId}`,
          period_from: params.periodFrom,
          period_to: params.periodTo,
          header_count: 0,
          total_amount: 0,
          draft_statuses: [],
          can_act: false,
          is_waiting: true,
          current_tier: 0,
          required_approver_level: params.context.maxLevelByDivision[params.divisionId] ?? 0,
        },
        salesmen: [],
        coa_rows: [],
        grand_total: 0,
        details: [],
        attachments: [],
      },
    };
  }

  const visibleDraftResult = await getVisibleDraftsForDivision({
    divisionId: params.divisionId,
    context: params.context,
  });

  const draftIdsForLevel = visibleDraftResult.drafts.map((draft) => draft.id);
  const draftStatuses = [...new Set(visibleDraftResult.drafts.map((draft) => draft.status))];
  const canAct = visibleDraftResult.drafts.some((draft) => draft.can_act);
  const currentTier = visibleDraftResult.drafts.reduce(
    (max, draft) => Math.max(max, draft.current_tier),
    0
  );
  const requiredApproverLevel = params.context.maxLevelByDivision[params.divisionId] ?? currentTier;

  if (!draftIdsForLevel.length) {
    return {
      ok: true as const,
      status: 200,
      data: {
        group: {
          division_id: params.divisionId,
          division_name: `Division #${params.divisionId}`,
          period_from: params.periodFrom,
          period_to: params.periodTo,
          header_count: 0,
          total_amount: 0,
          draft_statuses: draftStatuses,
          can_act: canAct,
          is_waiting: !canAct,
          current_tier: currentTier,
          required_approver_level: requiredApproverLevel,
        },
        salesmen: [],
        coa_rows: [],
        grand_total: 0,
        details: [],
        attachments: [],
      },
    };
  }

  const payableQuery = new URLSearchParams({
    "filter[disbursement_id][_in]": draftIdsForLevel.join(","),
    fields: "expense_id",
    limit: "-1",
  }).toString();

  const payableRes = await directusFetch<DirectusListResponse<Pick<DisbursementPayableDraftRow, "expense_id">>>(
    `/items/disbursement_payables_draft?${payableQuery}`
  );
  const initialAllowedIds = (payableRes.ok ? payableRes.data.data ?? [] : [])
    .map((p) => toNumericId(p.expense_id))
    .filter((id): id is number => Boolean(id));

  // --- Auto-Healing Logic: Find Approved orphans and re-link them ---
  const orphanQuery = buildFilterQuery(
    {
      header_id: { _in: headerIds },
      status: { _eq: "Approved" },
      id: { _nin: initialAllowedIds.length > 0 ? initialAllowedIds : [-1] },
    },
    "id,amount,remarks,transaction_date,division_id,particulars,header_id"
  );

  const orphanRes = await directusFetch<DirectusListResponse<ExpenseDraftRow>>(
    `/items/expense_draft?${orphanQuery}`
  );

  const orphans = (orphanRes.ok ? orphanRes.data.data ?? [] : []);
  
  if (orphans.length > 0 && draftIdsForLevel.length > 0) {
    const targetDraftId = draftIdsForLevel[0]; // Link to the first active draft in the batch
    for (const orphan of orphans) {
      await insertExpenseIntoPayableDraft({
        draftId: targetDraftId,
        expense: orphan,
      });
    }
    await recalcDraftTotal(targetDraftId);
    // Refresh allowed IDs
    const refreshedRes = await directusFetch<DirectusListResponse<Pick<DisbursementPayableDraftRow, "expense_id">>>(
      `/items/disbursement_payables_draft?${payableQuery}`
    );
    initialAllowedIds.splice(0, initialAllowedIds.length, ...(refreshedRes.ok ? refreshedRes.data.data ?? [] : [])
      .map((p) => toNumericId(p.expense_id))
      .filter((id): id is number => Boolean(id)));
  }

  const allowedExpenseIds = initialAllowedIds;

  if (!allowedExpenseIds.length) {
    return {
      ok: true as const,
      status: 200,
      data: {
        group: {
          division_id: params.divisionId,
          division_name: `Division #${params.divisionId}`,
          period_from: params.periodFrom,
          period_to: params.periodTo,
          header_count: headers.length,
          total_amount: 0,
          draft_statuses: draftStatuses,
          can_act: canAct,
          is_waiting: !canAct,
          current_tier: currentTier,
          required_approver_level: requiredApproverLevel,
        },
        salesmen: [],
        coa_rows: [],
        grand_total: 0,
        details: [],
        attachments: [],
      },
    };
  }

  const expenseQuery = buildFilterQuery(
    {
      header_id: { _in: headerIds },
      _or: [
        { id: { _in: allowedExpenseIds } },
        { status: { _eq: "With Concern" } },
        { status: { _eq: "Rejected" } },
      ],
    },
    "id,header_id,encoded_by,particulars,division_id,transaction_date,amount,status,remarks,payee,attachment_url",
    { sort: "particulars,encoded_by,transaction_date" }
  );

  const expenseRes = await directusFetch<DirectusListResponse<ExpenseDraftRow>>(
    `/items/expense_draft?${expenseQuery}`
  );
  if (!expenseRes.ok) return { ok: false as const, status: expenseRes.status, data: expenseRes.data };

  const expenses = expenseRes.data.data ?? [];
  const employeeIds = [...new Set(expenses.map(getExpenseEmployeeId).filter((id) => id > 0))];
  const coaIds = [
    ...new Set(expenses.map((expense) => toNumericId(expense.particulars) ?? 0).filter((id) => id > 0)),
  ];

  const [divisionMap, userMap, salesmanMap, coaMap] = await Promise.all([
    fetchDivisionMap([params.divisionId]),
    fetchUserMap(employeeIds),
    fetchSalesmanMap(employeeIds),
    fetchCoaDetailMap(coaIds),
  ]);

  const salesmen: FinalTopSheetSalesmanResponse[] = employeeIds
    .map((employeeId) => {
      const salesman = salesmanMap.get(employeeId);
      const name = salesman?.salesman_name?.trim() || userMap.get(employeeId) || `User #${employeeId}`;
      const total = expenses
        .filter((expense) => {
          const expenseId = toNumericId(expense.id);
          return getExpenseEmployeeId(expense) === employeeId && 
                 expenseId !== null && 
                 allowedExpenseIds.includes(expenseId);
        })
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
    `/items/expense_attachments?filter[header_id][_in]=${headerIds.join(",")}&fields=header_id,file_url,file_name&limit=-1`
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
            amount: cellDetails
              .filter(d => allowedExpenseIds.includes(d.expense_id))
              .reduce((sum, detail) => sum + detail.amount, 0),
            count: cellDetails.length,
            expense_ids: cellDetails.map((detail) => detail.expense_id).filter((id) => id > 0),
            has_concern: cellDetails.some(d => d.status.toLowerCase().includes("concern")),
            has_rejected: cellDetails.some(d => d.status.toLowerCase() === "rejected"),
          };
        })
        .filter((cell) => cell.count > 0 || cell.amount > 0);

      return {
        coa_id: coaId,
        account_title: coa?.account_title ?? `COA #${coaId}`,
        gl_code: coa?.gl_code ?? null,
        row_total: rowDetails
          .filter(d => allowedExpenseIds.includes(d.expense_id))
          .reduce((sum, detail) => sum + detail.amount, 0),
        cells,
      };
    })
    .sort((a, b) => a.account_title.localeCompare(b.account_title));

  const grandTotal = details
    .filter(d => allowedExpenseIds.includes(d.expense_id))
    .reduce((sum, detail) => sum + detail.amount, 0);

  return {
    ok: true as const,
    status: 200,
    data: {
      group: {
        division_id: params.divisionId,
        division_name: divisionMap.get(params.divisionId) ?? `Division #${params.divisionId}`,
        period_from: params.periodFrom,
        period_to: params.periodTo,
        header_count: headers.length,
        total_amount: grandTotal,
        draft_statuses: draftStatuses,
        can_act: canAct,
        is_waiting: !canAct,
        current_tier: currentTier,
        required_approver_level: requiredApproverLevel,
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

  const headerResult = await getHeaderIdsForPeriod({ divisionId, periodFrom, periodTo });
  if (!headerResult.ok) return jsonResponse(headerResult.data, { status: headerResult.status });
  if (!headerResult.headerIds.length) {
    return jsonResponse({ error: "No matching expense draft headers found" }, { status: 404 });
  }

  const filters: Record<string, unknown> = {
    header_id: { _in: headerResult.headerIds },
  };

  if (scope === "expense_ids") {
    if (!expenseIds.length) {
      return jsonResponse({ error: "expense_ids are required for expense_ids target scope" }, { status: 400 });
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

  const activeDraftIds = await getActiveDraftIdsForDivision({ divisionId, context: params.context });
  if (!activeDraftIds.length) {
    return jsonResponse({ error: "No active disbursement drafts found for your approval level" }, { status: 404 });
  }

  const targetPayablesRes = await directusFetch<DirectusListResponse<PayableDraftLookupRow>>(
    `/items/disbursement_payables_draft?filter[disbursement_id][_in]=${activeDraftIds.join(",")}&filter[expense_id][_in]=${targetExpenseIds.join(",")}&fields=id,disbursement_id,expense_id,amount&limit=-1`
  );

  if (!targetPayablesRes.ok) {
    return jsonResponse(targetPayablesRes.data, { status: targetPayablesRes.status });
  }

  const targetPayables = targetPayablesRes.data.data ?? [];
  const payableByExpenseId = new Map<number, PayableDraftLookupRow[]>();

  for (const payable of targetPayables) {
    const expenseId = getNestedExpenseId(payable.expense_id);
    if (!expenseId) continue;

    const existing = payableByExpenseId.get(expenseId) ?? [];
    existing.push(payable);
    payableByExpenseId.set(expenseId, existing);
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
  const finalizationResults: any[] = [];

  if (isFinalLevel && status === "Approved") {
    for (const draftId of linkedDraftIds) {
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
        finalizationResults.push({ draft_id: draftId, result: fRes.result, doc_no: (fRes as any).doc_no });
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
