// src/modules/financial-management/treasury/bulk-approval/services/myLevelApproval.service.ts
import type { NextResponse } from "next/server";
import { directusFetch } from "./directus.service";
import { jsonResponse } from "./http";
import type {
  BulkApprovalContext,
  ConcernItemResponse,
  DirectusItemResponse,
  DirectusListResponse,
  DisbursementDraftRow,
  DisbursementPayableDraftLogRow,
  DisbursementPayableDraftRow,
  DraftRevisionLogResponse,
  DraftRowResponse,
  ExpenseDraftLogRow,
  ExpenseDraftRow,
  ExpenseRevisionLogResponse,
  PayableResponse,
  PostBody,
  ActivityLogDetailResponse,
} from "./bulkApproval.types";
import {
  buildApproversByLevel,
  buildFilterQuery,
  buildVoteHistory,
  buildVoteHistoryBulk,
  canUserVote,
  createExpenseLog,
  fetchCoaMap,
  fetchDivisionMap,
  fetchMyVotes,
  fetchSupplierMap,
  fetchUserMap,
  getExpenseEmployeeId,
  getWeekEndFromStart,
  getWeekStart,
  insertExpenseIntoPayableDraft,
  nowManila,
  parseTier,
  processDraftApproval,
  recalcDraftTotal,
  resolveAttachmentId,
  resolveVirtualItemsById,
  tierStatus,
  toNumber,
  toNumericId,
  toStringOrNull,
} from "./bulkApproval.shared";

export async function handleMyLevelApprovalGetResource(params: {
  resource: string;
  searchParams: URLSearchParams;
  context: BulkApprovalContext;
}): Promise<NextResponse | null> {
  const { context } = params;
  const sp = params.searchParams;
  const resource = params.resource;
  const {
    currentUserId,
    approverRecords,
    myDivisionIds,
    levelsByDivision,
    myLevel,
    maxLevelByDivision,
    approversPerLevelByDivision,
  } = context;

  try {
    if (resource === "drafts") {
      const filterDivId = toNumericId(sp.get("divisionId"));

      const filter: Record<string, unknown> = {
        division_id: filterDivId ? { _eq: filterDivId } : { _in: myDivisionIds },
        status: {
          _nin: ["Approved", "Rejected"],
        },
      };

      const query = buildFilterQuery(
        filter,
        "id,doc_no,payee,total_amount,remarks,status,approval_version,version,transaction_date,division_id,department_id,encoder_id,transaction_type,supporting_documents_url,date_created,date_updated",
        { sort: "-id" }
      );

      const draftRes = await directusFetch(`/items/disbursement_draft?${query}`);
      if (!draftRes.ok) return jsonResponse(draftRes.data, { status: draftRes.status });

      const realDrafts =
        (draftRes.data as DirectusListResponse<DisbursementDraftRow>).data ?? [];

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
        "id,amount,remarks,transaction_date,division_id,encoded_by,return_to,particulars,attachment_url,feedback,status"
      );

      const returnedRes = await directusFetch(`/items/expense_draft?${returnedQuery}`);
      if (!returnedRes.ok) {
        return jsonResponse(returnedRes.data, { status: returnedRes.status });
      }

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
        const encoderId = getExpenseEmployeeId(item);
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
          division_id: divisionId,
          division_name: divisionMap.get(divisionId) ?? `Division #${divisionId}`,
          requires_final_top_sheet:
            currentTier >= (maxLevelByDivision[divisionId] ?? currentTier) &&
            approverRecords.some(
              (r) =>
                toNumericId(r.division_id) === divisionId &&
                toNumber(r.approver_heirarchy) ===
                  (maxLevelByDivision[divisionId] ?? currentTier)
            ),
          approval_version: approvalVersion,
          transaction_date: draft.transaction_date ?? null,
          date_created: draft.date_created ?? draft.transaction_date ?? "",
          current_tier: currentTier,
          max_level: maxLevelByDivision[divisionId] ?? currentTier,
          approvers_per_level: approversPerLevelByDivision[divisionId] ?? {},
          my_vote: myVote,
          can_vote:
            !(
              currentTier >= (maxLevelByDivision[divisionId] ?? currentTier) &&
              approverRecords.some(
                (r) =>
                  toNumericId(r.division_id) === divisionId &&
                  toNumber(r.approver_heirarchy) ===
                    (maxLevelByDivision[divisionId] ?? currentTier)
              )
            ) &&
            canUserVote({
              approverRecords,
              divisionId,
              currentTier,
              status,
              myVote,
            }),
          has_concern:
            status.toLowerCase() === "with concern" ||
            Boolean(draft.remarks?.includes("[Contains Returned Items]")),
        };
      });

      type ReturnedGroupSummary = {
        amount: number;
        count: number;
        tier: number;
      };

      const returnedSummaryByRealDraftKey = new Map<string, ReturnedGroupSummary>();

      for (const item of returnedRows) {
        const encoderId = getExpenseEmployeeId(item);
        const divisionId = toNumericId(item.division_id);
        const transactionDate = toStringOrNull(item.transaction_date);
        const tier = parseInt(String(item.return_to ?? "").replace(/\D/g, ""), 10) || 1;

        if (!encoderId || !divisionId || !transactionDate) continue;

        const weekStart = getWeekStart(transactionDate);
        const key = `${encoderId}|${divisionId}|${weekStart}|${tier}`;
        const existing = returnedSummaryByRealDraftKey.get(key);

        if (existing) {
          existing.amount += toNumber(item.amount);
          existing.count += 1;
        } else {
          returnedSummaryByRealDraftKey.set(key, {
            amount: toNumber(item.amount),
            count: 1,
            tier,
          });
        }
      }

      const data = realRows
        .map((row) => {
          const sourceDraft = realDrafts.find(
            (draft) => toNumericId(draft.id) === row.id
          );
          const encoderId = toNumericId(sourceDraft?.encoder_id) ?? 0;
          const divisionId = toNumericId(sourceDraft?.division_id) ?? 0;
          const transactionDate = row.transaction_date ?? row.date_created ?? "";
          const weekStart = getWeekStart(transactionDate);
          const currentTier = row.current_tier || 1;
          const key = `${encoderId}|${divisionId}|${weekStart}|${currentTier}`;
          const returnedSummary = returnedSummaryByRealDraftKey.get(key);

          if (!returnedSummary) return row;

          const returnedText = `${returnedSummary.count} returned item(s) for re-verification.`;
          const baseRemarks = row.remarks?.trim();

          return {
            ...row,
            remarks: baseRemarks
              ? `${baseRemarks}\n[Contains Returned Items] ${returnedText}`
              : `[Contains Returned Items] ${returnedText}`,
            has_concern: true,
          };
        })
        .filter(() => true)
        .sort((a, b) => {
          const aDate = a.transaction_date ?? "";
          const bDate = b.transaction_date ?? "";
          return bDate.localeCompare(aDate);
        });

      return jsonResponse({
        data,
        myLevel,
        levelsByDivision,
      });
    }

    if (resource === "draft-detail") {
      const draftIdRaw = sp.get("id") || sp.get("draft_id");
      if (!draftIdRaw) {
        return jsonResponse({ error: "id or draft_id is required" }, { status: 400 });
      }

      const draftId = Number(draftIdRaw);
      const isVirtual = draftId < 0;

      if (isVirtual) {
        const resolved = await resolveVirtualItemsById(draftId, myDivisionIds);

        if (!resolved.ok) return jsonResponse(resolved.data, { status: resolved.status });
        if (!resolved.items.length) {
          return jsonResponse({ error: "Virtual draft not found" }, { status: 404 });
        }

        const first = resolved.items[0];
        const encoderId = getExpenseEmployeeId(first);
        const divisionId = toNumericId(first.division_id) ?? 0;
        const tier = parseInt(String(first.return_to ?? "").replace(/\D/g, ""), 10) || 1;
        const total = resolved.items.reduce(
          (sum, item) => sum + toNumber(item.amount),
          0
        );

        if (!myDivisionIds.includes(divisionId)) {
          return jsonResponse({ error: "Forbidden" }, { status: 403 });
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

        return jsonResponse({
          draft: {
            id: draftId,
            doc_no: `RETURNED-${Math.abs(draftId)}`,
            payee_user_id: encoderId,
            payee_name: userMap.get(encoderId) ?? `User #${encoderId}`,
            encoder_name: userMap.get(encoderId) ?? `User #${encoderId}`,
            total_amount: total,
            remarks: `[Virtual Returned Batch] ${resolved.items.length} item(s) for re-verification.`,
            status: tierStatus(tier),
            division_id: divisionId,
            requires_final_top_sheet:
              tier >= (maxLevelByDivision[divisionId] ?? tier) &&
              approverRecords.some(
                (r) =>
                  r.division_id === divisionId &&
                  r.approver_heirarchy === (maxLevelByDivision[divisionId] ?? tier)
              ),
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
        `/items/disbursement_draft?filter[id][_eq]=${draftId}&fields=id,doc_no,payee,total_amount,remarks,status,approval_version,version,transaction_date,division_id,department_id,encoder_id,transaction_type,supporting_documents_url,date_created,date_updated,is_supervisor&limit=1`
      );

      if (!draftRes.ok) return jsonResponse(draftRes.data, { status: draftRes.status });

      const draft =
        ((draftRes.data as DirectusListResponse<DisbursementDraftRow>).data ??
          [])[0];

      if (!draft) return jsonResponse({ error: "Draft not found" }, { status: 404 });

      const divisionId = toNumericId(draft.division_id) ?? 0;

      if (!myDivisionIds.includes(divisionId)) {
        return jsonResponse({ error: "Forbidden" }, { status: 403 });
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

      const weekStart = getWeekStart(draft.transaction_date ?? "");
      const weekEnd = getWeekEndFromStart(weekStart);

      const payeeId = toNumericId(draft.payee) ?? 0;
      const encoderId = toNumericId(draft.encoder_id) ?? 0;

      const concernRes = await directusFetch(
        `/items/expense_draft?filter[division_id][_eq]=${divisionId}&filter[encoded_by][_eq]=${encoderId}&filter[status][_in]=With Concern,Approved&filter[return_to][_starts_with]=L&filter[transaction_date][_between]=[${weekStart},${weekEnd}]&fields=id,amount,remarks,transaction_date,particulars,attachment_url,feedback,return_to,status,header_id&limit=-1`
      );

      const rawConcerns =
        (concernRes.data as DirectusListResponse<ExpenseDraftRow>).data ?? [];

      const concernCoaIds = rawConcerns
        .map((c) => toNumericId(c.particulars))
        .filter((id): id is number => Boolean(id));

      const headerIds = [
        ...new Set([
          ...payablesRaw.map(p => typeof p.expense_id === "object" ? toNumericId(p.expense_id?.header_id) : null),
          ...rawConcerns.map(c => typeof c === "object" ? toNumericId(c.header_id) : null)
        ].filter((id): id is number => Boolean(id)))
      ];

      const [coaMap, supplierMap, userMap, divisionMap, voteHistory, approversByLevel, attachmentsRes] =
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
          headerIds.length > 0 
            ? directusFetch(`/items/expense_attachments?filter[header_id][_in]=${headerIds.join(",")}&fields=id,file_url,file_name&limit=-1`)
            : Promise.resolve({ ok: true, data: { data: [] } })
        ]);

      const attachments = (attachmentsRes.data as DirectusListResponse<{ file_url?: string | null; file_name?: string | null }>)?.data ?? [];

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

      return jsonResponse({
        draft: {
          id: draftId,
          doc_no: draft.doc_no ?? `DRAFT-${draftId}`,
          payee_user_id: payeeId,
          payee_name: supplierMap.get(payeeId) ?? `Supplier #${payeeId}`,
          encoder_name: userMap.get(encoderId) ?? `User #${encoderId}`,
          total_amount: toNumber(draft.total_amount),
          remarks: draft.remarks ?? null,
          status: draft.status ?? "Submitted",
          division_id: divisionId,
          requires_final_top_sheet:
            currentTier >= (maxLevelByDivision[divisionId] ?? currentTier) &&
            approverRecords.some(
              (r) =>
                toNumericId(r.division_id) === divisionId &&
                toNumber(r.approver_heirarchy) ===
                  (maxLevelByDivision[divisionId] ?? currentTier)
            ),
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
        can_vote:
          !(
            currentTier >= (maxLevelByDivision[divisionId] ?? currentTier) &&
            approverRecords.some(
              (r) =>
                toNumericId(r.division_id) === divisionId &&
                toNumber(r.approver_heirarchy) ===
                  (maxLevelByDivision[divisionId] ?? currentTier)
            )
          ) &&
          canUserVote({
            approverRecords,
            divisionId,
            currentTier,
            status: draft.status ?? "Submitted",
            myVote,
          }),
        attachments: attachments.map((a) => ({
          file_url: a.file_url ?? "",
          file_name: a.file_name ?? "Attachment",
        })),
      });
    }

    if (resource === "logs") {
      const res = await directusFetch(
        `/items/disbursement_draft?filter[division_id][_in]=${myDivisionIds.join(
          ","
        )}&filter[status][_nin]=Submitted&fields=id,doc_no,payee,total_amount,remarks,status,approval_version,transaction_date,date_created,date_updated,division_id,encoder_id&sort=-date_updated&limit=100`
      );

      if (!res.ok) return jsonResponse(res.data, { status: res.status });

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

      const [payableDraftLogsRes, payablesForLogsRes] = await Promise.all([
        draftIds.length > 0
          ? directusFetch(
              `/items/disbursement_payables_draft_logs?filter[disbursement_id][_in]=${draftIds.join(
                ","
              )}&fields=id,log_id,payable_draft_id,disbursement_id,coa_id,reference_no,amount,original_amount,new_amount,remarks,date,version,updated_by,log_date&sort=-log_date&limit=-1`
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

      if (!payableDraftLogsRes.ok) {
        console.error("[logs] Failed to fetch payable draft logs", {
          status: payableDraftLogsRes.status,
          data: payableDraftLogsRes.data,
        });
      }

      const draftLogs =
        (payableDraftLogsRes.data as DirectusListResponse<DisbursementPayableDraftLogRow>).data ??
        [];

      const payableLogLinks =
        (payablesForLogsRes.data as DirectusListResponse<DisbursementPayableDraftRow>)
          .data ?? [];

      const coaIds = new Set<number>();

      for (const draftLog of draftLogs) {
        const updatedBy = toNumericId(draftLog.updated_by);
        const coaId = toNumericId(draftLog.coa_id);
        if (updatedBy) userIds.add(updatedBy);
        if (coaId) coaIds.add(coaId);
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

      const bulkVoteHistories = await buildVoteHistoryBulk({
        drafts: drafts.map((d) => ({
          draftId: toNumericId(d.id) ?? 0,
          currentVersion: toNumber(d.approval_version, 1),
          draftStatus: d.status ?? "",
          divisionId: toNumericId(d.division_id) ?? 0,
        })),
        divisionIds: [...divisionIds],
      });

      const rows = drafts.map((draft) => {
          const draftId = toNumericId(draft.id) ?? 0;
          const payeeId = toNumericId(draft.payee) ?? 0;
          const encoderId = toNumericId(draft.encoder_id) ?? 0;
          const divisionId = toNumericId(draft.division_id) ?? 0;
          const approvalVersion = toNumber(draft.approval_version, 1);

          const rounds = bulkVoteHistories.get(draftId) ?? [];

          const revisionLogs: DraftRevisionLogResponse[] = draftLogs
            .filter((logRow) => toNumericId(logRow.disbursement_id) === draftId)
            .map((logRow) => {
              const editorId = toNumericId(logRow.updated_by) ?? 0;
              const coaId = toNumericId(logRow.coa_id) ?? 0;

              return {
                id: toNumericId(logRow.id) ?? 0,
                payable_draft_id: toNumericId(logRow.payable_draft_id) ?? 0,
                coa_name: coaId > 0 ? coaMap.get(coaId) ?? `COA #${coaId}` : null,
                editor_name: userMap.get(editorId) ?? `User #${editorId}`,
                original_amount: logRow.original_amount === null || logRow.original_amount === undefined
                  ? null
                  : toNumber(logRow.original_amount),
                new_amount: logRow.new_amount === null || logRow.new_amount === undefined
                  ? null
                  : toNumber(logRow.new_amount),
                amount: toNumber(logRow.amount),
                remarks: logRow.remarks ?? null,
                version: toNumber(logRow.version, 1),
                created_at: logRow.log_date ?? "",
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
        });

      return jsonResponse({ data: rows });
    }

    if (resource === "log-detail") {
      const draftIdRaw = sp.get("draft_id") || sp.get("id");
      if (!draftIdRaw) return jsonResponse({ error: "draft_id is required" }, { status: 400 });

      const draftId = Number(draftIdRaw);

      const draftRes = await directusFetch(
        `/items/disbursement_draft?filter[id][_eq]=${draftId}&fields=id,division_id&limit=1`
      );

      const draft =
        ((draftRes.data as DirectusListResponse<DisbursementDraftRow>).data ??
          [])[0];

      if (!draft) return jsonResponse({ error: "Draft not found" }, { status: 404 });

      const divisionId = toNumericId(draft.division_id) ?? 0;
      if (!myDivisionIds.includes(divisionId)) {
        return jsonResponse({ error: "Forbidden" }, { status: 403 });
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

      return jsonResponse({ data });
    }



    return null;
  } catch (err) {
    console.error("[GET] Global Failure:", err);
    return jsonResponse({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function submitMyLevelApprovalVote(params: {
  body: Record<string, unknown>;
  context: BulkApprovalContext;
}) {
  const rawBody = params.body;
  const { currentUserId, approverRecords, myDivisionIds } = params.context;

  try {
    const body = rawBody as PostBody;

    const {
      draft_id: incomingId,
      status: overallStatus,
      remarks,
      edited_payables,
      item_decisions,
    } = body;

    const finalRemarks = typeof remarks === "string" && remarks.trim().length > 0 ? remarks.trim() : null;

    if (!incomingId || !overallStatus) {
      return jsonResponse({ error: "draft_id and status are required" }, { status: 400 });
    }

    const nowTs = nowManila();

    let draftId = Number(incomingId);
    const isVirtual = draftId < 0;
    const handledVirtualExpenseIds = new Set<number>();

    let draft: DisbursementDraftRow | null = null;
    let currentTier = 1;

    if (isVirtual) {
      const resolved = await resolveVirtualItemsById(draftId, myDivisionIds);

      if (!resolved.ok) return jsonResponse(resolved.data, { status: resolved.status });
      if (!resolved.items.length) {
        return jsonResponse({ error: "Virtual draft items not found" }, { status: 404 });
      }

      const first = resolved.items[0];
      const divisionId = toNumericId(first.division_id) ?? 0;
      const encoderId = getExpenseEmployeeId(first);
      const tier = parseInt(String(first.return_to ?? "").replace(/\D/g, ""), 10) || 1;

      if (!myDivisionIds.includes(divisionId)) {
        return jsonResponse({ error: "Forbidden" }, { status: 403 });
      }

      // RBAC: Verify user has authority for THIS division AND at least THIS tier (Virtual Drafts)
      const authorizedLevels = approverRecords
        .filter((r) => {
          const rDivId = toNumericId(r.division_id);
          return rDivId !== null && rDivId === divisionId;
        })
        .map((r) => toNumber(r.approver_heirarchy));

      if (!authorizedLevels.some((lvl) => lvl === tier)) {
        console.warn(`[POST] RBAC Failure (Virtual): User ${currentUserId} attempted to vote on Tier ${tier} for Division ${divisionId}. Authorized tiers:`, authorizedLevels);
        return jsonResponse({ 
          error: "Unauthorized tier",
          detail: `You are authorized for levels [${authorizedLevels.join(",")}] in this division, but these items require Level ${tier} approval.`
        }, { status: 403 });
      }

      const initialTotal = resolved.items.reduce((sum, item) => {
        const decision = item_decisions?.[`-${toNumericId(item.id) ?? 0}`];
        if (decision?.status === "APPROVED") return sum + toNumber(item.amount);
        return sum;
      }, 0);

      const hasSupervisor = resolved.items.some((item) => Number(item.is_supervisor) === 1);

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
          date_created: nowTs,
          date_updated: nowTs,
          is_supervisor: hasSupervisor ? 1 : 0,
        }),
      });

      if (!createDraftRes.ok) {
        return jsonResponse(createDraftRes.data, { status: createDraftRes.status });
      }

      const createdDraft =
        (createDraftRes.data as DirectusItemResponse<DisbursementDraftRow>).data;

      if (!createdDraft) {
        return jsonResponse({ error: "Failed to create draft." }, { status: 500 });
      }

      draft = createdDraft;
      draftId = toNumericId(createdDraft.id) ?? 0;
      currentTier = tier;


      for (const expense of resolved.items) {
        const expenseId = toNumericId(expense.id);
        if (!expenseId) continue;

        handledVirtualExpenseIds.add(expenseId);

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
            return jsonResponse(
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
              approved_at: nowTs,
              date_updated: nowTs,
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
              date_updated: nowTs,
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
              date_updated: nowTs,
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

      if (!draftRes.ok) return jsonResponse(draftRes.data, { status: draftRes.status });

      draft =
        ((draftRes.data as DirectusListResponse<DisbursementDraftRow>).data ??
          [])[0] ?? null;

      if (!draft) return jsonResponse({ error: "Draft not found" }, { status: 404 });

      const divisionId = toNumericId(draft.division_id) ?? 0;
      if (!myDivisionIds.includes(divisionId)) {
        return jsonResponse({ error: "Forbidden" }, { status: 403 });
      }

      currentTier = parseTier(draft.status ?? "Submitted");
    }

    const draftDivisionId = toNumericId(draft?.division_id) ?? 0;
    const maxLevelForDivision =
      params.context.maxLevelByDivision[draftDivisionId] ?? currentTier;
    const isUserFinalApproverForDraft = approverRecords.some(
      (r) =>
        toNumericId(r.division_id) === draftDivisionId &&
        toNumber(r.approver_heirarchy) === maxLevelForDivision
    );

    if (!isVirtual && currentTier >= maxLevelForDivision && isUserFinalApproverForDraft) {
      return jsonResponse(
        {
          error: "Final approval must be handled through Final Top Sheets.",
          message:
            "This draft is already at your final approval level. Please use the Final Top Sheets tab to review and approve the matrix.",
          division_id: draftDivisionId,
          current_tier: currentTier,
          final_tier: maxLevelForDivision,
        },
        { status: 409 }
      );
    }

    const voteRes = await processDraftApproval({
      draftId,
      currentUserId: params.context.currentUserId,
      overallStatus,
      remarks: finalRemarks,
      item_decisions,
      edited_payables,
      nowTs,
      isVirtual,
      approverRecords: params.context.approverRecords,
      myDivisionIds: params.context.myDivisionIds,
    });

    if (!voteRes.ok) {
      const errorData = "data" in voteRes ? voteRes.data : { error: voteRes.message ?? "Vote failed" };
      const statusCode = "status" in voteRes && typeof voteRes.status === "number" ? voteRes.status : 500;
      return jsonResponse(errorData, { status: statusCode });
    }

    return jsonResponse(voteRes);
  } catch (err) {
    console.error("[POST] Global Failure:", err);
    return jsonResponse({ error: "Internal Server Error" }, { status: 500 });
  }
}


