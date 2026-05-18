"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import type { Budget, BudgetApprovalFilters, BudgetStatus, AuditAction } from "../types";
import { budgetApprovalService } from "../services/budgetService";

const PAGE_SIZE = 20;

const DEFAULT_FILTERS: BudgetApprovalFilters = {
  search: "",
  year: String(new Date().getFullYear()),
  month: String(new Date().getMonth() + 1),
  division_id: "all",
  department_id: "all",
  status: "Pending",
};

export function useBudgetApproval() {
  const [displayedItems, setDisplayed] = useState<Budget[]>([]);
  const [filters, setFilters] = useState<BudgetApprovalFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // ---------- Data fetching ----------
  const fetchPage = useCallback(async (pg: number) => {
    const offset = (pg - 1) * PAGE_SIZE;
    const params: Record<string, unknown> = {
      limit: PAGE_SIZE,
      offset,
      "filter[status][_eq]": filters.status,
    };

    if (filters.year && filters.year !== "all") params["filter[year][_eq]"] = filters.year;
    
    if (filters.month && filters.month !== "all") {
      const monthNames = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
      ];
      const monthIdx = Number(filters.month) - 1;
      if (monthIdx >= 0 && monthIdx < 12) {
        params["filter[month][_eq]"] = monthNames[monthIdx];
      }
    }

    if (filters.division_id && filters.division_id !== "all") params["filter[division_id][_eq]"] = Number(filters.division_id);
    if (filters.department_id && filters.department_id !== "all") params["filter[department_id][_eq]"] = Number(filters.department_id);
    if (filters.search) params.search = filters.search;

    const result = await budgetApprovalService.getBudgets(params);
    return result;
  }, [filters]);

  // Initial load & filter change
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, total } = await fetchPage(1);
        setDisplayed(data);
        setTotalCount(total);
        setPage(2);
        setHasMore(data.length === PAGE_SIZE && data.length < total);
      } catch (error) {
        toast.error("Failed to load budgets.");
        console.error(error);
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    };
    load();
    setSelectedIds(new Set());
  }, [fetchPage]);

  // Infinite scroll loader
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const { data, total } = await fetchPage(page);
      setDisplayed((prev) => [...prev, ...data]);
      setPage((p) => p + 1);
      setHasMore(data.length === PAGE_SIZE && (displayedItems.length + data.length) < total);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load more budgets.");
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, page, fetchPage, displayedItems.length]);

  // ---------- Filters ----------
  const updateFilter = <K extends keyof BudgetApprovalFilters>(
    key: K,
    value: BudgetApprovalFilters[K]
  ) => {
    setFilters((f) => ({ ...f, [key]: value }));
  };
  const clearFilters = () => setFilters(DEFAULT_FILTERS);
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  // ---------- Selection ----------
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === displayedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedItems.map((b) => String(b.id))));
    }
  };
  const clearSelection = () => setSelectedIds(new Set());

  // ---------- Actions (Combined with Audit Logging) ----------
  const processBudgetAction = async (
    ids: string[], 
    status: BudgetStatus, 
    action: AuditAction, 
    remarks?: string
  ) => {
    const isBulk = ids.length > 1;
    setLoading(true);
    try {
      if (isBulk) {
        await budgetApprovalService.bulkUpdateStatus(ids, status, action, remarks);
      } else {
        await budgetApprovalService.updateStatus(ids[0], status, action, remarks);
      }
      
      setDisplayed((prev) => prev.filter((b) => !ids.includes(String(b.id))));
      setTotalCount((prev) => prev - ids.length);
      toast.success(`${ids.length} budget(s) ${status.toLowerCase()} successfully.`);
      clearSelection();
    } catch (error) {
      toast.error(`Failed to ${status.toLowerCase()} budget(s).`);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const approveBudget = (id: string, remarks?: string) => 
    processBudgetAction([id], "Approved", "Approved", remarks);

  const rejectBudget = (id: string, remarks?: string) => 
    processBudgetAction([id], "Rejected", "Rejected", remarks);

  const bulkApprove = (remarks?: string) => 
    processBudgetAction(Array.from(selectedIds), "Approved", "Approved", remarks);

  const bulkReject = (remarks?: string) => 
    processBudgetAction(Array.from(selectedIds), "Rejected", "Rejected", remarks);

  return {
    displayedItems,
    loading,
    initialLoading,
    hasMore,
    loadMore,
    filters,
    updateFilter,
    clearFilters,
    hasFilters,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    clearSelection,
    approveBudget,
    rejectBudget,
    bulkApprove,
    bulkReject,
    total: totalCount,
  };
}
