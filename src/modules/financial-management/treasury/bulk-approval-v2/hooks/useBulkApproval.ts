// src/modules/financial-management/treasury/bulk-approval/hooks/useBulkApproval.ts
"use client";

import * as React from "react";
import { toast } from "sonner";

import type {
  ApprovalContext,
  DraftDetail,
  DraftRow,
  FinalHeaderGroup,
  LogDraft,
} from "../type";
import * as api from "../providers/fetchProvider";

export function useBulkApproval() {
  const [drafts, setDrafts] = React.useState<DraftRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [myLevel, setMyLevel] = React.useState<number>(0);
  const [levelsByDivision, setLevelsByDivision] = React.useState<Record<number, number[]>>({});
  const [unauthorized, setUnauthorized] = React.useState(false);

  const [approvalContexts, setApprovalContexts] = React.useState<ApprovalContext[]>([]);
  const [contextsLoading, setContextsLoading] = React.useState(true);
  const [currentUserName, setCurrentUserName] = React.useState("");

  const [finalHeaderGroups, setFinalHeaderGroups] = React.useState<FinalHeaderGroup[]>([]);
  const [finalHeaderGroupsLoading, setFinalHeaderGroupsLoading] = React.useState(false);
  const [finalHeaderStatus, setFinalHeaderStatus] = React.useState<"ready" | "completed">("ready");

  const [logs, setLogs] = React.useState<LogDraft[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);

  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const pageSize = 8;

  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalLoading, setModalLoading] = React.useState(false);
  const [draftDetail, setDraftDetail] = React.useState<DraftDetail | null>(null);
  const [selectedDraftId, setSelectedDraftId] = React.useState<number | null>(null);

  const [selectedDivisionId, setSelectedDivisionId] = React.useState<number | undefined>(undefined);

  const normalApprovalContexts = React.useMemo(
    () => approvalContexts.filter((context) => !context.is_final_approver),
    [approvalContexts]
  );

  const finalApprovalContexts = React.useMemo(
    () => approvalContexts.filter((context) => context.is_final_approver),
    [approvalContexts]
  );

  const canDoNormalApproval = normalApprovalContexts.length > 0;
  const canDoFinalApproval = finalApprovalContexts.length > 0;

  const availableDivisions = React.useMemo(
    () =>
      normalApprovalContexts.map((context) => ({
        id: context.division_id,
        name: context.division_name ?? `Division #${context.division_id}`,
      })),
    [normalApprovalContexts]
  );

  const loadApprovalContexts = React.useCallback(async () => {
    try {
      setContextsLoading(true);
      const { contexts, currentUserName: name } = await api.getMyApprovalContexts();
      setApprovalContexts(contexts);
      setCurrentUserName(name);
      if (contexts.length === 0) setUnauthorized(true);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "403_UNAUTHORIZED") {
        setUnauthorized(true);
      } else {
        console.error("Failed to load approval contexts", e);
      }
      setApprovalContexts([]);
    } finally {
      setContextsLoading(false);
    }
  }, []);

  const loadLogs = React.useCallback(async () => {
    try {
      setLogsLoading(true);
      const data = await api.getActivityLogs();
      setLogs(data);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "403_UNAUTHORIZED") {
        setUnauthorized(true);
      } else {
        console.error("Failed to load activity logs", e);
      }
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const loadFinalHeaderGroups = React.useCallback(async (status: "ready" | "completed" = "ready"): Promise<FinalHeaderGroup[]> => {
    try {
      setFinalHeaderGroupsLoading(true);
      const groups = await api.getFinalHeaderGroups(status);
      setFinalHeaderGroups(groups);
      return groups;
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "403_UNAUTHORIZED") {
        setFinalHeaderGroups([]);
      } else {
        console.error("Failed to load final top-sheet groups", e);
      }
      return [];
    } finally {
      setFinalHeaderGroupsLoading(false);
    }
  }, []);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const [result] = await Promise.all([
        api.listDrafts(selectedDivisionId),
        loadLogs(),
        loadFinalHeaderGroups(finalHeaderStatus),
      ]);
      setDrafts(result.data);
      setMyLevel(result.myLevel);
      setLevelsByDivision(result.levelsByDivision || {});
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "403_UNAUTHORIZED") {
        setUnauthorized(true);
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to load pending drafts.");
      }
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [loadFinalHeaderGroups, loadLogs, selectedDivisionId, finalHeaderStatus]);

  React.useEffect(() => {
    void loadApprovalContexts();
  }, [loadApprovalContexts]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [selectedDivisionId, q]);

  React.useEffect(() => {
    if (!selectedDivisionId) return;
    const stillAllowed = availableDivisions.some((division) => division.id === selectedDivisionId);
    if (!stillAllowed) setSelectedDivisionId(undefined);
  }, [availableDivisions, selectedDivisionId]);

  const filteredDrafts = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return drafts;

    return drafts.filter(
      (draft) =>
        draft.doc_no.toLowerCase().includes(query) ||
        draft.payee_name.toLowerCase().includes(query) ||
        draft.encoder_name.toLowerCase().includes(query) ||
        (draft.division_name ?? "").toLowerCase().includes(query) ||
        (draft.remarks ?? "").toLowerCase().includes(query)
    );
  }, [drafts, q]);

  const paginatedDrafts = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDrafts.slice(start, start + pageSize);
  }, [filteredDrafts, page]);

  const totalItems = filteredDrafts.length;
  const pageCount = Math.ceil(totalItems / pageSize) || 1;

  async function openVoteModal(draft: DraftRow) {
    setSelectedDraftId(draft.id);
    setModalOpen(true);
    setModalLoading(true);

    try {
      const detail = await api.getDraftDetail(draft.id);
      setDraftDetail(detail);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load draft details");
      setDraftDetail(null);
    } finally {
      setModalLoading(false);
    }
  }

  async function refreshDetail() {
    if (!selectedDraftId) return;

    setModalLoading(true);
    try {
      const detail = await api.getDraftDetail(selectedDraftId);
      setDraftDetail(detail);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to refresh draft details");
    } finally {
      setModalLoading(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedDraftId(null);
    setDraftDetail(null);
  }

  async function onVoteComplete() {
    closeModal();
    await load();
  }

  async function refreshAll() {
    await Promise.all([loadApprovalContexts(), load()]);
  }

  return {
    drafts: paginatedDrafts,
    totalItems,
    q,
    setQ,
    page,
    setPage,
    pageCount,
    loading,
    myLevel,
    levelsByDivision,
    selectedDivisionId,
    setSelectedDivisionId,
    availableDivisions,
    unauthorized,
    logs,
    logsLoading,
    modalOpen,
    modalLoading,
    draftDetail,
    selectedDraftId,
    approvalContexts,
    contextsLoading,
    currentUserName,
    normalApprovalContexts,
    finalApprovalContexts,
    canDoNormalApproval,
    canDoFinalApproval,
    finalHeaderGroups,
    finalHeaderGroupsLoading,
    finalHeaderStatus,
    setFinalHeaderStatus,
    loadFinalHeaderGroups,
    openVoteModal,
    closeModal,
    onVoteComplete,
    refreshDetail,
    refreshAll,
  };
}
