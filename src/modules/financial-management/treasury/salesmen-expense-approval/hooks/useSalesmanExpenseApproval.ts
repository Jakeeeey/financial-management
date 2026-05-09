// src/modules/financial-management/treasury/salesmen-expense-approval/hooks/useSalesmanExpenseApproval.ts
"use client";

import * as React from "react";
import { toast } from "sonner";
import { format, endOfWeek } from "date-fns";

import type { SalesmanExpenseRow, SalesmanExpenseDetail, ApprovalLog } from "../type";
import * as api from "../providers/fetchProvider";

export function useSalesmanExpenseApproval() {
  const [rows, setRows] = React.useState<SalesmanExpenseRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [logs, setLogs] = React.useState<ApprovalLog[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [unauthorized, setUnauthorized] = React.useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalLoading, setModalLoading] = React.useState(false);
  const [selectedSalesman, setSelectedSalesman] = React.useState<SalesmanExpenseRow | null>(null);
  const [salesmanDetail, setSalesmanDetail] = React.useState<SalesmanExpenseDetail | null>(null);

  // Filtering state
  const [selectedWeek, setSelectedWeek] = React.useState<string>("all");
  const [availableWeeks, setAvailableWeeks] = React.useState<{ week_start: string; week_label: string }[]>([]);
  const [, setWeeksLoading] = React.useState(false);

  // Search & Pagination state
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const pageSize = 5;

  const loadWeeks = React.useCallback(async () => {
    try {
      setWeeksLoading(true);
      const data = await api.getAvailableWeeks();
      setAvailableWeeks(data);
    } catch (e) {
      console.error("Failed to load weeks", e);
    } finally {
      setWeeksLoading(false);
    }
  }, []);

  const loadLogs = React.useCallback(async () => {
    try {
      setLogsLoading(true);
      const data = await api.getApprovalLogs();
      setLogs(data);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "403_UNAUTHORIZED") {
        setUnauthorized(true);
      } else {
        console.error("Failed to load logs", e);
      }
    } finally {
      setLogsLoading(false);
    }
  }, []);

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      const start = selectedWeek !== "all" ? selectedWeek : undefined;
      let end: string | undefined = undefined;
      if (start) {
        const d = new Date(start + "T00:00:00");
        const wEnd = endOfWeek(d, { weekStartsOn: 1 });
        end = format(wEnd, "yyyy-MM-dd");
      }

      const [data] = await Promise.all([
        api.listSalesmenWithExpenses(start, end),
        loadLogs(),
        loadWeeks(),
      ]);
      setRows(data);
    } catch (e: unknown) {
      if (e instanceof Error && e.message === "403_UNAUTHORIZED") {
        setUnauthorized(true);
      } else {
        toast.error(e instanceof Error ? e.message : "Failed to load expenses.");
      }
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loadLogs, loadWeeks, selectedWeek]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    setPage(1);
  }, [selectedWeek]);

  // Client-side filtering
  const filteredRows = React.useMemo(() => {
    const query = q.toLowerCase().trim();
    if (!query) return rows;
    return rows.filter(
      (r) =>
        r.salesman_name.toLowerCase().includes(query) ||
        r.salesman_code.toLowerCase().includes(query)
    );
  }, [rows, q]);

  // Client-side pagination
  const paginatedRows = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, page, pageSize]);

  const totalItems = filteredRows.length;
  const pageCount = Math.ceil(totalItems / pageSize) || 1;

  async function openModal(row: SalesmanExpenseRow) {
    setSelectedSalesman(row);
    setModalOpen(true);
    setModalLoading(true);
    try {
      // For the modal, we fetch specifically for the row's week if available
      const start = row.week_start || (selectedWeek !== "all" ? selectedWeek : undefined);
      const end = row.week_end;
      const detail = await api.getSalesmanExpenses(row.id, start, end);
      setSalesmanDetail(detail);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load expenses");
      setSalesmanDetail(null);
    } finally {
      setModalLoading(false);
    }
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedSalesman(null);
    setSalesmanDetail(null);
  }

  async function onConfirmed() {
    closeModal();
    await load();
  }

  return {
    rows: paginatedRows,
    totalItems,
    q,
    setQ,
    page,
    setPage,
    pageCount,
    loading,
    modalOpen,
    modalLoading,
    selectedSalesman,
    salesmanDetail,
    logs,
    logsLoading,
    openModal,
    closeModal,
    onConfirmed,
    unauthorized,
    selectedWeek,
    setSelectedWeek,
    availableWeeks,
  };
}

