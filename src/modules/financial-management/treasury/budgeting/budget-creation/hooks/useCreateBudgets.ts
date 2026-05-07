// src/modules/financial-management/treasury/budgeting/create-budget/hooks/useCreateBudgets.ts

"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { toast } from "sonner";
import type { Budget, BudgetFilters, CreateBudgetPayload } from "../types";

const PAGE_SIZE = 20;

const DEFAULT_FILTERS: BudgetFilters = {
  search:        "",
  year:          String(new Date().getFullYear()),
  month:         String(new Date().getMonth() + 1),
  division_id:   "",
  department_id: "",
  status:        "Draft", // Default to Draft tab
};

// Simulate async fetch for the list (since Budget DDL/API not yet provided)
function simulateFetch(budgets: Budget[], page: number): Promise<Budget[]> {
  return new Promise(resolve =>
    setTimeout(() => {
      const start = (page - 1) * PAGE_SIZE;
      resolve(budgets.slice(start, start + PAGE_SIZE));
    }, 600)
  );
}



const STORAGE_KEY = "fm_budget_entries";

export function useCreateBudgets() {
  const allBudgetsRef                    = useRef<Budget[]>([]);
  const [displayedItems, setDisplayed]   = useState<Budget[]>([]);
  const [filters, setFilters]            = useState<BudgetFilters>(DEFAULT_FILTERS);
  const [page, setPage]                  = useState(1);
  const [loading, setLoading]            = useState(false);
  const [initialLoading, setInitial]     = useState(false);
  const [hasMore, setHasMore]            = useState(false);
  const [selectedIds, setSelectedIds]    = useState<Set<string>>(new Set());
  const [isModalOpen, setModalOpen]      = useState(false);
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
  const [supplementParent, setSupplementParent] = useState<Budget | null>(null);

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
    reload(data);
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
      if (status && b.status !== status) return false;
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

  const updateFilter = <K extends keyof BudgetFilters>(key: K, value: BudgetFilters[K]) =>
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

  const submitForApproval = (id: string) => {
    const updated = allBudgetsRef.current.map(b =>
      b.id === id ? { ...b, status: "Pending" as const } : b
    );
    allBudgetsRef.current = updated;
    saveToLocal(updated);
    setDisplayed(prev => prev.map(b => b.id === id ? { ...b, status: "Pending" as const } : b));
    toast.success("Budget submitted for approval.");
  };

  const quickSubmit = () => {
    if (selectedIds.size === 0) return;
    const updated = allBudgetsRef.current.map(b =>
      selectedIds.has(b.id) ? { ...b, status: "Pending" as const } : b
    );
    allBudgetsRef.current = updated;
    saveToLocal(updated);
    setDisplayed(prev => prev.map(b =>
      selectedIds.has(b.id) ? { ...b, status: "Pending" as const } : b
    ));
    toast.success(`${selectedIds.size} budget(s) submitted for approval.`);
    clearSelection();
  };

  const isDuplicate = (
    year: number, 
    month: number, 
    deptDivCoaId: number,
    excludeId?: string
  ): boolean => {
    return allBudgetsRef.current.some(b => 
      b.year === year && 
      b.month === month && 
      b.coa_id === deptDivCoaId && 
      b.id !== excludeId
    );
  };

  const addBudget = (
    payload: CreateBudgetPayload, 
    names?: { division_name?: string; department_name?: string; coa_name?: string }
  ) => {
    const id = String(Date.now()); // Use timestamp for more unique local IDs
    
    const newBudget: Budget = {
      id,
      parent_budget_id: payload.parent_budget_id,
      entry_type:    payload.entry_type || 'original',
      year:          payload.year,
      month:         payload.month,
      division_id:   payload.division_id, 
      division_name: names?.division_name || "New Division",
      department_id: payload.department_id,
      department_name: names?.department_name || "New Department",
      coa_id:        payload.dept_div_coa_id,
      coa_name:      names?.coa_name || "Selected COA",
      coa_code:      payload.gl_code,
      gl_code:       payload.gl_code,
      amount:        payload.amount,
      remarks:       payload.remarks,
      attachments:   payload.attachments.map((f, i) => ({
        id:   String(i),
        name: f.name,
        url:  URL.createObjectURL(f),
        type: f.type,
        size: f.size,
      })),
      status:     "Draft",
      created_by: "Current User",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const updated = [newBudget, ...allBudgetsRef.current];
    allBudgetsRef.current = updated;
    saveToLocal(updated);
    setDisplayed(prev => [newBudget, ...prev]);
    toast.success("Budget entry created successfully.");
  };

  const updateBudget = (
    id: string,
    payload: CreateBudgetPayload,
    names?: { division_name?: string; department_name?: string; coa_name?: string }
  ) => {
    const updater = (prev: Budget[]) => prev.map(b => {
        if (b.id !== id) return b;
        return {
            ...b,
            year:          payload.year,
            month:         payload.month,
            division_id:   payload.division_id,
            department_id: payload.department_id,
            coa_id:        payload.dept_div_coa_id,
            coa_name:      names?.coa_name || b.coa_name,
            division_name: names?.division_name || b.division_name,
            department_name: names?.department_name || b.department_name,
            gl_code:       payload.gl_code,
            coa_code:      payload.gl_code,
            amount:        payload.amount,
            remarks:       payload.remarks,
            attachments:   [
                ...b.attachments,
                ...payload.attachments.map((f, i) => ({
                    id:   `new-${Date.now()}-${i}`,
                    name: f.name,
                    url:  URL.createObjectURL(f),
                    type: f.type,
                    size: f.size,
                }))
            ],
            updated_at:    new Date().toISOString(),
        };
    });

    const updated = updater(allBudgetsRef.current);
    allBudgetsRef.current = updated;
    saveToLocal(updated);
    setDisplayed(prev => updater(prev));
    toast.success("Budget entry updated successfully.");
  };

  const deleteBudget = (id: string) => {
    const updated = allBudgetsRef.current.filter(b => b.id !== id);
    allBudgetsRef.current = updated;
    saveToLocal(updated);
    setDisplayed(prev => prev.filter(b => b.id !== id));
    toast.success("Budget entry deleted.");
  };

  // Helper to calculate grand total (Original + Supplements)
  const getGrandTotal = (budgetId: string) => {
    const parent = allBudgetsRef.current.find(b => b.id === budgetId);
    if (!parent) return 0;
    
    // Find all approved supplements for this parent
    const supplements = allBudgetsRef.current.filter(
      b => b.parent_budget_id === budgetId && b.status === "Approved"
    );
    
    return parent.amount + supplements.reduce((sum, s) => sum + s.amount, 0);
  };

  // Check if a parent budget already has a Draft or Pending supplement ("in-flight")
  const hasInFlightSupplement = (parentId: string): boolean => {
    return allBudgetsRef.current.some(
      b => b.parent_budget_id === parentId &&
           b.entry_type === "supplemental" &&
           (b.status === "Draft" || b.status === "Pending")
    );
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
    submitForApproval,
    quickSubmit,
    addBudget,
    updateBudget,
    deleteBudget,
    isDuplicate,
    getGrandTotal,
    hasInFlightSupplement,
    total: filteredBudgets.length,
    allBudgets: allBudgetsRef.current,
  };
}
