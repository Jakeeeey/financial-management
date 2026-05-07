"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { Budget, BudgetApprovalFilters } from "../types";

const PAGE_SIZE = 20;

const DEFAULT_FILTERS: BudgetApprovalFilters = {
  search:        "",
  year:          String(new Date().getFullYear()),
  month:         String(new Date().getMonth() + 1), // Default to current month
  division_id:   "",
  department_id: "",
  status:        "Pending", // Default to pending
};

// Simulate async fetch for the list
function simulateFetch(budgets: Budget[], page: number): Promise<Budget[]> {
  return new Promise(resolve =>
    setTimeout(() => {
      const start = (page - 1) * PAGE_SIZE;
      resolve(budgets.slice(start, start + PAGE_SIZE));
    }, 600)
  );
}

const STORAGE_KEY = "fm_budget_entries";

export function useBudgetApproval() {
  const allBudgetsRef                    = useRef<Budget[]>([]);
  const [displayedItems, setDisplayed]   = useState<Budget[]>([]);
  const [filters, setFilters]            = useState<BudgetApprovalFilters>(DEFAULT_FILTERS);
  const [page, setPage]                  = useState(1);
  const [loading, setLoading]            = useState(false);
  const [initialLoading, setInitial]     = useState(false);
  const [hasMore, setHasMore]            = useState(false);
  const [selectedIds, setSelectedIds]    = useState<Set<string>>(new Set());

  // Persistence helpers
  const saveToLocal = (data: Budget[]) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const loadFromLocal = (): Budget[] => {
    if (typeof window === "undefined") return [];
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  };

  // Initial load from LocalStorage
  useEffect(() => {
    const data = loadFromLocal();
    allBudgetsRef.current = data;
    const initialFiltered = data.filter(b => b.status === DEFAULT_FILTERS.status);
    reload(initialFiltered);
  }, []);

  // Apply filters in memory
  const filteredBudgets = useMemo(() => {
    const term    = filters.search.trim().toLowerCase();
    const year    = filters.year    ? Number(filters.year)    : null;
    const month   = filters.month   ? Number(filters.month)   : null;
    const divId   = filters.division_id ? Number(filters.division_id) : null;
    const deptId  = filters.department_id ? Number(filters.department_id) : null;
    const status  = filters.status;

    return allBudgetsRef.current.filter(b => {
      if (b.status !== status) return false; // Filter by status tab
      if (year   && b.year          !== year)   return false;
      if (month  && b.month         !== month)  return false;
      if (divId  && b.division_id   !== divId)  return false;
      if (deptId && b.department_id !== deptId) return false;
      if (term && ![b.division_name, b.department_name, b.coa_name, b.gl_code, b.remarks]
        .join(" ").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [filters, allBudgetsRef.current]);

  // Initial load / re-load on filter change
  const reload = useCallback(async (newFiltered: Budget[]) => {
    setInitial(true);
    setPage(1);
    setDisplayed([]);
    setHasMore(true);
    try {
      const items = await simulateFetch(newFiltered, 1);
      setDisplayed(items);
      setPage(2);
      setHasMore(items.length === PAGE_SIZE && newFiltered.length > PAGE_SIZE);
    } finally {
      setInitial(false);
    }
  }, []);

  // Trigger reload when filters change
  const filteredKey = JSON.stringify(filters);
  const prevKey     = useRef(filteredKey);
  if (prevKey.current !== filteredKey) {
    prevKey.current = filteredKey;
    reload(filteredBudgets);
    setSelectedIds(new Set()); // clear selection when changing tabs
  }

  // Load more (infinite scroll)
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const items = await simulateFetch(filteredBudgets, page);
      if (items.length === 0) {
        setHasMore(false);
      } else {
        setDisplayed(prev => [...prev, ...items]);
        setPage(p => p + 1);
        setHasMore(items.length === PAGE_SIZE);
      }
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, filteredBudgets, page]);

  const updateFilter = <K extends keyof BudgetApprovalFilters>(key: K, value: BudgetApprovalFilters[K]) =>
    setFilters(f => ({ ...f, [key]: value }));

  const clearFilters = () => setFilters(DEFAULT_FILTERS);
  const hasFilters   = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  // Selection
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleSelectAll = () => {
    if (selectedIds.size === displayedItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedItems.map(b => b.id)));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Actions
  const approveBudget = (id: string) => {
    const updated = allBudgetsRef.current.map(b =>
      b.id === id ? { ...b, status: "Approved" as const, updated_at: new Date().toISOString() } : b
    );
    allBudgetsRef.current = updated;
    saveToLocal(updated);
    setDisplayed(prev => prev.filter(b => b.id !== id));
    toast.success("Budget approved successfully.");
  };

  const rejectBudget = (id: string) => {
    const updated = allBudgetsRef.current.map(b =>
      b.id === id ? { ...b, status: "Rejected" as const, updated_at: new Date().toISOString() } : b
    );
    allBudgetsRef.current = updated;
    saveToLocal(updated);
    setDisplayed(prev => prev.filter(b => b.id !== id));
    toast.error("Budget rejected.");
  };

  const bulkApprove = () => {
    if (selectedIds.size === 0) return;
    const updated = allBudgetsRef.current.map(b =>
      selectedIds.has(b.id) ? { ...b, status: "Approved" as const, updated_at: new Date().toISOString() } : b
    );
    allBudgetsRef.current = updated;
    saveToLocal(updated);
    setDisplayed(prev => prev.filter(b => !selectedIds.has(b.id)));
    toast.success(`${selectedIds.size} budget(s) approved.`);
    clearSelection();
  };

  const bulkReject = () => {
    if (selectedIds.size === 0) return;
    const updated = allBudgetsRef.current.map(b =>
      selectedIds.has(b.id) ? { ...b, status: "Rejected" as const, updated_at: new Date().toISOString() } : b
    );
    allBudgetsRef.current = updated;
    saveToLocal(updated);
    setDisplayed(prev => prev.filter(b => !selectedIds.has(b.id)));
    toast.error(`${selectedIds.size} budget(s) rejected.`);
    clearSelection();
  };

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
    total: filteredBudgets.length,
  };
}
