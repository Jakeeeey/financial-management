"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Budget, BudgetApprovalFilters, BudgetStatus, AuditAction } from "../types";
import { budgetApprovalService } from "../services/budgetService";


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
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const fetchSequenceRef = useRef(0);

  // ---------- Data fetching ----------
  const fetchData = useCallback(async () => {
    const params: Record<string, unknown> = {
      limit: "-1",
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
    const requestId = fetchSequenceRef.current + 1;
    fetchSequenceRef.current = requestId;

    const load = async () => {
      setLoading(true);
      try {
        const { data, attachmentLoadFailed } = await fetchData();
        if (requestId !== fetchSequenceRef.current) return;

        setDisplayed(data);
        if (attachmentLoadFailed) {
          toast.warning("Budgets loaded, but some attachments could not be loaded.");
        }
      } catch (error) {
        if (requestId !== fetchSequenceRef.current) return;

        toast.error("Failed to load budgets.");
        console.error(error);
      } finally {
        if (requestId !== fetchSequenceRef.current) return;

        setLoading(false);
        setInitialLoading(false);
      }
    };
    load();
    setSelectedIds(new Set());
  }, [fetchData]);


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
      toast.success(`${ids.length} budget(s) ${status.toLowerCase()} successfully.`);
      clearSelection();
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to ${status.toLowerCase()} budget(s).`;
      toast.error(message);
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
  };
}
