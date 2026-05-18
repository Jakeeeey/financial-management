// src/modules/financial-management/treasury/budgeting/budget-creation/hooks/useCreateBudgets.ts

"use client";

import { useState, useCallback, useEffect } from "react";
import type { Budget, CreateBudgetPayload, BudgetFilters } from "../types";
import { budgetService } from "../services/budgetService";
import { toast } from "sonner";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", 
  "July", "August", "September", "October", "November", "December"
];

export function useCreateBudgets() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<BudgetFilters>({
    search: "",
    year: String(new Date().getFullYear()),
    month: String(new Date().getMonth() + 1),
    division_id: "",
    department_id: "",
    status: "Draft",
  });

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    try {
      const monthIndex = Number(filters.month);
      const monthName = monthIndex ? MONTH_NAMES[monthIndex - 1] : undefined;

      const { data } = await budgetService.getBudgets({
        year: filters.year ? Number(filters.year) : undefined,
        month: monthName,
        status: filters.status || undefined,
        division_id: filters.division_id ? Number(filters.division_id) : undefined,
        department_id: filters.department_id ? Number(filters.department_id) : undefined,
      });

      // Filter by search term locally for responsiveness
      const term = filters.search.trim().toLowerCase();
      const filtered = term ? data.filter(b => 
        [b.coa_name, b.gl_code, b.remarks, b.department_name, b.division_name, b.budget_no]
          .join(" ").toLowerCase().includes(term)
      ) : data;

      setBudgets(filtered);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch budgets";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchBudgets();
  }, [fetchBudgets]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === budgets.length && budgets.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(budgets.map(b => String(b.id))));
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Actions
  const submitBudgets = async (ids: string[]) => {
    if (!ids.length) return;
    const previousItems = [...budgets];
    
    setBudgets(prev => prev.map(item => 
        ids.includes(String(item.id)) ? { ...item, status: "Pending" } : item
    ));

    try {
      await budgetService.submitBudgets(ids);
      toast.success(`${ids.length} budget(s) submitted for approval.`);
    } catch (err) {
      setBudgets(previousItems);
      const msg = err instanceof Error ? err.message : "Submission failed";
      toast.error(msg);
    }
  };

  const deleteBudget = async (id: string | number) => {
    const previousItems = [...budgets];
    
    setBudgets(prev => prev.filter(item => String(item.id) !== String(id)));

    try {
      await budgetService.deleteBudget(id);
      toast.success("Budget deleted successfully.");
    } catch (err) {
      setBudgets(previousItems);
      const msg = err instanceof Error ? err.message : "Deletion failed";
      toast.error(msg);
    }
  };

  const deleteSelected = async () => {
    if (selectedIds.size === 0) return;
    const previousItems = [...budgets];
    
    setBudgets(prev => prev.filter(item => !selectedIds.has(String(item.id))));

    try {
      await Promise.all(Array.from(selectedIds).map(id => budgetService.deleteBudget(id)));
      toast.success(`${selectedIds.size} budget(s) deleted.`);
      clearSelection();
    } catch (err) {
      setBudgets(previousItems);
      const msg = err instanceof Error ? err.message : "Failed to delete selected budgets";
      toast.error(msg);
    }
  };

  const submitForApproval = async (id: string | number) => {
    const previousItems = [...budgets];
    setBudgets(prev => prev.map(item => 
        String(item.id) === String(id) ? { ...item, status: "Pending" } : item
    ));

    try {
      await budgetService.submitBudgets([String(id)]);
      toast.success("Budget submitted for approval.");
    } catch (err) {
      setBudgets(previousItems);
      const msg = err instanceof Error ? err.message : "Failed to submit budget";
      toast.error(msg);
    }
  };

  const quickSubmit = async () => {
    if (selectedIds.size === 0) return;
    const previousItems = [...budgets];
    const ids = Array.from(selectedIds);

    setBudgets(prev => prev.map(item => 
        ids.includes(String(item.id)) ? { ...item, status: "Pending" } : item
    ));

    try {
      await budgetService.submitBudgets(ids);
      toast.success(`${ids.length} budget(s) submitted for approval.`);
      clearSelection();
    } catch (err) {
      setBudgets(previousItems);
      const msg = err instanceof Error ? err.message : "Failed to submit budgets";
      toast.error(msg);
    }
  };

  const isDuplicate = async (
    year: number, 
    month: number, 
    coaId: number,
    divisionId: number,
    departmentId: number,
    excludeId?: string
  ): Promise<boolean> => {
    const monthName = MONTH_NAMES[month - 1];
    if (!monthName) return false;
    return await budgetService.checkDuplicate(year, monthName, coaId, divisionId, departmentId, excludeId);
  };

  const addBudget = async (payload: CreateBudgetPayload) => {
    try {
      const monthIndex = Number(payload.month);
      const monthName = MONTH_NAMES[monthIndex - 1] || payload.month;

      await budgetService.createBudget({
        ...payload,
        month: monthName,
      });
      toast.success("Budget created successfully.");
      fetchBudgets();
    } catch (err) {
      throw err;
    }
  };

  const updateBudget = async (id: string | number, payload: Partial<CreateBudgetPayload>) => {
    try {
      if (payload.month) {
          const monthIndex = Number(payload.month);
          if (!isNaN(monthIndex) && monthIndex > 0 && monthIndex <= 12) {
              payload.month = MONTH_NAMES[monthIndex - 1];
          }
      }

      await budgetService.updateBudget(id, payload);
      toast.success("Budget updated successfully.");
      fetchBudgets();
    } catch (err) {
      throw err;
    }
  };

  // Helpers for table
  const getGrandTotal = (budgetId: string): number => {
    const parent = budgets.find(b => String(b.id) === budgetId);
    if (!parent) return 0;
    
    const approvedSupplements = budgets.filter(
      b => b.parent_budget_id != null && String(b.parent_budget_id) === budgetId && 
           b.entry_type === "supplemental" && 
           b.status === "Approved"
    );
    return parent.amount + approvedSupplements.reduce((sum, s) => sum + s.amount, 0);
  };

  const hasInFlightSupplement = (parentId: string): boolean => {
    return budgets.some(
      b => b.parent_budget_id != null && String(b.parent_budget_id) === parentId && 
           b.entry_type === "supplemental" && 
           (b.status === "Pending" || b.status === "Draft")
    );
  };

  return {
    budgets, 
    loading, 
    filters, 
    setFilters,
    selectedIds, 
    toggleSelect, 
    toggleSelectAll, 
    clearSelection,
    fetchBudgets, 
    deleteBudget, 
    deleteSelected, 
    submitBudgets,
    submitForApproval, 
    quickSubmit,
    isDuplicate, 
    addBudget, 
    updateBudget,
    getGrandTotal, 
    hasInFlightSupplement,
  };
}
