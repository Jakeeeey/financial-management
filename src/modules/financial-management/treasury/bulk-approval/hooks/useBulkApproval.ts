// src/modules/financial-management/treasury/bulk-approval/hooks/useBulkApproval.ts
"use client";

import * as React from "react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import type { DateRange } from "react-day-picker";

import type { DraftRow, DraftDetail, LogDraft } from "../type";
import * as api from "../providers/fetchProvider";

export function useBulkApproval() {
  const [drafts, setDrafts] = React.useState<DraftRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [myLevel, setMyLevel] = React.useState<number>(0);
  const [levelsByDivision, setLevelsByDivision] = React.useState<Record<number, number[]>>({});
  const [unauthorized, setUnauthorized] = React.useState(false);

  const [logs, setLogs] = React.useState<LogDraft[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);

  // Date filter
  const [dateRange, setDateRange] = React.useState<DateRange | undefined>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  // Search & pagination
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const pageSize = 8;

  const startDateStr = React.useMemo(() => 
    dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined
  , [dateRange]);

  const endDateStr = React.useMemo(() => 
    dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined
  , [dateRange]);

  // Vote modal
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalLoading, setModalLoading] = React.useState(false);
  const [draftDetail, setDraftDetail] = React.useState<DraftDetail | null>(null);
  const [selectedDraftId, setSelectedDraftId] = React.useState<number | null>(null);

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

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const [result] = await Promise.all([
        api.listDrafts(startDateStr, endDateStr),
        loadLogs(),
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
  }, [loadLogs, startDateStr, endDateStr]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [dateRange]);

  // Client-side filter
  const filteredDrafts = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return drafts;
    return drafts.filter(
      (d) =>
        d.doc_no.toLowerCase().includes(query) ||
        d.payee_name.toLowerCase().includes(query) ||
        (d.remarks ?? "").toLowerCase().includes(query)
    );
  }, [drafts, q]);

  // Client-side pagination
  const paginatedDrafts = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredDrafts.slice(start, start + pageSize);
  }, [filteredDrafts, page, pageSize]);

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

  function closeModal() {
    setModalOpen(false);
    setSelectedDraftId(null);
    setDraftDetail(null);
  }

  async function onVoteComplete() {
    closeModal();
    await load();
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
    unauthorized,
    logs,
    logsLoading,
    modalOpen,
    modalLoading,
    draftDetail,
    selectedDraftId,
    openVoteModal,
    closeModal,
    onVoteComplete,
    dateRange,
    setDateRange,
  };
}
