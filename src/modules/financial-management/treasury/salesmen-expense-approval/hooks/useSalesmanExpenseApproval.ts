// src/modules/financial-management/treasury/salesmen-expense-approval/hooks/useSalesmanExpenseApproval.ts
"use client";

import * as React from "react";
import { toast } from "sonner";

import type { SalesmanExpenseRow, SalesmanExpenseDetail, ApprovalLog, ExpenseHeader } from "../type";
import * as api from "../providers/fetchProvider";

export function useSalesmanExpenseApproval() {
  const [rows, setRows] = React.useState<SalesmanExpenseRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [logs, setLogs] = React.useState<ApprovalLog[]>([]);
  const [logsLoading, setLogsLoading] = React.useState(false);
  const [unauthorized, setUnauthorized] = React.useState(false);

  // Two-step modal flow
  const [selectedSalesman, setSelectedSalesman] = React.useState<SalesmanExpenseRow | null>(null);
  const [salesmanDetail, setSalesmanDetail] = React.useState<SalesmanExpenseDetail | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [selectedHeader, setSelectedHeader] = React.useState<ExpenseHeader | null>(null);

  // Modal state (only opens after header is chosen)
  const [modalOpen, setModalOpen] = React.useState(false);
  const [modalLoading, setModalLoading] = React.useState(false);

  // Search & Pagination state
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const pageSize = 5;

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
      const [data] = await Promise.all([
        api.listSalesmenWithExpenses(),
        loadLogs(),
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
  }, [loadLogs]);

  React.useEffect(() => {
    load();
  }, [load]);

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

  // Step 1: Select a salesman → load detail & show header panel
  async function selectSalesman(row: SalesmanExpenseRow) {
    if (selectedSalesman?.id === row.id) {
      // Clicking the same row dismisses the panel
      setSelectedSalesman(null);
      setSalesmanDetail(null);
      setSelectedHeader(null);
      return;
    }
    setSelectedSalesman(row);
    setSelectedHeader(null);
    setDetailLoading(true);
    try {
      const detail = await api.getSalesmanExpenses(row.id);
      setSalesmanDetail(detail);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to load expenses");
      setSalesmanDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  // Step 2: Pick a header → open modal
  function openModalForHeader(header: ExpenseHeader) {
    setSelectedHeader(header);
    setModalOpen(true);
    setModalLoading(false);
  }

  function closeModal() {
    setModalOpen(false);
    setSelectedHeader(null);
  }

  function closePanel() {
    setSelectedSalesman(null);
    setSalesmanDetail(null);
    setSelectedHeader(null);
    setModalOpen(false);
  }

  async function onConfirmed() {
    closeModal();
    closePanel();
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
    // Panel state
    selectedSalesman,
    salesmanDetail,
    detailLoading,
    selectSalesman,
    closePanel,
    // Header selection
    selectedHeader,
    openModalForHeader,
    // Modal state
    modalOpen,
    modalLoading,
    closeModal,
    onConfirmed,
    // Logs
    logs,
    logsLoading,
    unauthorized,
  };
}
