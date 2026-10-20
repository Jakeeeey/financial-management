"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  FileSpreadsheet,
  Filter,
} from "lucide-react";
import {
  ExpenseItem,
  SupplierOption,
  ChartOfAccountOption,
  DivisionInfo,
  DepartmentOption,
  InspectorFilterState,
} from "./types";
import { Skeleton } from "@/components/ui/skeleton";
import { InspectorFiltersBar } from "./components/InspectorFiltersBar";
import { InspectorMatrixGrid } from "./components/InspectorMatrixGrid";
import { InspectorReceiptPreviewModal } from "./components/InspectorReceiptPreviewModal";

export const ExpenseInspectorV2Module: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [coas, setCoas] = useState<ChartOfAccountOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionInfo[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);

  // Selected item for preview inspector modal
  const [activeItem, setActiveItem] = useState<ExpenseItem | null>(null);

  // Filter State: initial encoderId is null (no default auto-selection)
  const [filters, setFilters] = useState<InspectorFilterState>({
    search: "",
    encoderId: null,
    coaIds: [],
    dateFrom: "",
    dateTo: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch inspector items
      const inspRes = await fetch("/api/fm/treasury/expenses-v2/expense-inspector-v2");
      const inspJson = await inspRes.json();
      setExpenses(inspJson.data || []);

      // Fetch suppliers
      const supRes = await fetch("/api/fm/treasury/expenses-v2/expense-creation-v2/suppliers");
      const supJson = await supRes.json();
      setSuppliers(supJson.data || []);

      // Fetch COA (Expense accounts)
      const coaRes = await fetch(
        "/api/fm/treasury/expenses-v2/expense-creation-v2/chart_of_accounts?filter=expense_only"
      );
      const coaJson = await coaRes.json();
      setCoas(coaJson.data || []);

      // Fetch Divisions
      const divRes = await fetch("/api/fm/treasury/expenses-v2/expense-creation-v2/division");
      const divJson = await divRes.json();
      setDivisions(divJson.data || []);

      // Fetch Departments
      const deptRes = await fetch("/api/fm/treasury/expenses-v2/expense-creation-v2/department");
      const deptJson = await deptRes.json();
      setDepartments(deptJson.data || []);
    } catch (e) {
      console.error("Error fetching Expense Inspector V2 data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Distinct Encoders from expenses
  const encodersList = useMemo(() => {
    const map = new Map<
      number,
      {
        user_id: number;
        user_fname: string;
        user_lname: string;
        user_email?: string;
        division_name?: string;
      }
    >();

    expenses.forEach((item) => {
      const userObj =
        typeof item.created_by === "object" && item.created_by !== null
          ? item.created_by
          : null;

      if (userObj && userObj.user_id) {
        const div = divisions.find((d) => d.division_id === item.division_id);
        if (!map.has(userObj.user_id)) {
          map.set(userObj.user_id, {
            user_id: userObj.user_id,
            user_fname: userObj.user_fname || "Encoder",
            user_lname: userObj.user_lname || `#${userObj.user_id}`,
            user_email: userObj.user_email,
            division_name: div?.division_name,
          });
        }
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.user_fname.localeCompare(b.user_fname)
    );
  }, [expenses, divisions]);

  const handleFilterChange = <K extends keyof InspectorFilterState>(
    key: K,
    value: InspectorFilterState[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  // Reset filters clears encoder, dates, and search back to empty state
  const handleResetFilters = () => {
    setFilters({
      search: "",
      encoderId: null,
      coaIds: [],
      dateFrom: "",
      dateTo: "",
    });
  };

  // Normalized date range for filtering (supports inverted dates gracefully)
  const { effectiveDateFrom, effectiveDateTo } = useMemo(() => {
    if (!filters.dateFrom || !filters.dateTo) {
      return { effectiveDateFrom: filters.dateFrom, effectiveDateTo: filters.dateTo };
    }
    if (filters.dateFrom > filters.dateTo) {
      return { effectiveDateFrom: filters.dateTo, effectiveDateTo: filters.dateFrom };
    }
    return { effectiveDateFrom: filters.dateFrom, effectiveDateTo: filters.dateTo };
  }, [filters.dateFrom, filters.dateTo]);

  // Requirement: Encoder and Date Range must be set before displaying the grid
  const isFilterReady = useMemo(() => {
    const hasEncoder = filters.encoderId !== null;
    const hasDateRange = Boolean(filters.dateFrom && filters.dateTo);
    return hasEncoder && hasDateRange;
  }, [filters.encoderId, filters.dateFrom, filters.dateTo]);

  const isCoaEmpty = useMemo(() => {
    // If coaIds contains -1 or explicitly has 0 length when cleared
    const validCoas = (filters.coaIds || []).filter((id) => id !== -1);
    return filters.coaIds?.includes(-1) && validCoas.length === 0;
  }, [filters.coaIds]);

  // Compute active COAs list for the grid based on selection
  const activeCoas = useMemo(() => {
    if (isCoaEmpty) return [];
    const validCoas = (filters.coaIds || []).filter((id) => id !== -1);
    if (!validCoas || validCoas.length === 0 || validCoas.length === coas.length) {
      return coas;
    }
    return coas.filter((c) => validCoas.includes(c.coa_id));
  }, [coas, filters.coaIds, isCoaEmpty]);

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    if (!isFilterReady || isCoaEmpty) return [];

    const validCoas = (filters.coaIds || []).filter((id) => id !== -1);

    return expenses.filter((item) => {
      // 1. Encoder Filter (Single Select)
      if (filters.encoderId !== null) {
        const userId =
          typeof item.created_by === "object" && item.created_by !== null
            ? item.created_by.user_id
            : item.created_by;
        if (userId !== filters.encoderId) return false;
      }

      // 2. COA Filter
      if (validCoas && validCoas.length > 0 && validCoas.length < coas.length) {
        if (!validCoas.includes(item.coa_id)) return false;
      }

      // 3. Date Range Filter
      if (effectiveDateFrom && item.expense_date) {
        if (item.expense_date < effectiveDateFrom) return false;
      }
      if (effectiveDateTo && item.expense_date) {
        if (item.expense_date > effectiveDateTo) return false;
      }

      // 4. Search Filter
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const docNo = (item.doc_no || "").toLowerCase();
        const remarks = (item.remarks || "").toLowerCase();
        const supplierName = (
          suppliers.find((s) => s.id === item.payee)?.supplier_name || ""
        ).toLowerCase();

        return docNo.includes(q) || remarks.includes(q) || supplierName.includes(q);
      }

      return true;
    });
  }, [expenses, filters, suppliers, coas.length, isFilterReady, isCoaEmpty, effectiveDateFrom, effectiveDateTo]);

  // Selected Encoder Name for display
  const selectedEncoderName = useMemo(() => {
    if (!filters.encoderId) return undefined;
    const found = encodersList.find((e) => e.user_id === filters.encoderId);
    return found ? `${found.user_fname} ${found.user_lname}` : undefined;
  }, [encodersList, filters.encoderId]);

  return (
    <div className="space-y-4">
      {/* Module Title Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 dark:border-zinc-700/80 pb-3.5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Expense Inspector V2
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit tabular expense amounts and inspect receipt attachments across encoders and accounts.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Fixed Amounts Mode Badge */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-muted/60 dark:bg-zinc-950 border border-border/80 dark:border-zinc-700/80 text-foreground">
            <FileSpreadsheet className="w-3.5 h-3.5 text-primary" />
            <span>Amounts View</span>
          </div>
        </div>
      </div>

      {/* FILTERS BAR */}
      <InspectorFiltersBar
        filters={filters}
        encoders={encodersList}
        coas={coas}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
      />

      {/* MATRIX TABULAR GRID DATA / SKELETON / PROMPT */}
      {loading ? (
        <div className="bg-card dark:bg-zinc-900/80 border border-border/80 dark:border-zinc-700/80 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/60">
            <Skeleton className="h-5 w-48 rounded" />
            <Skeleton className="h-7 w-32 rounded-lg" />
          </div>
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 rounded" />
            ))}
          </div>
          <div className="space-y-2.5 pt-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      ) : !isFilterReady ? (
        <div className="bg-card dark:bg-zinc-900/80 border border-dashed border-border dark:border-zinc-700/80 rounded-xl p-16 text-center flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Filter className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Select Filters to Generate Matrix
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Please select an <strong>Encoder</strong> and a <strong>Date Range (From & To)</strong> in the filter bar above to display the tabular expense matrix.
            </p>
          </div>
        </div>
      ) : (
        <InspectorMatrixGrid
          expenses={filteredExpenses}
          coas={activeCoas}
          viewMode="amounts"
          onSelectExpense={(item) => setActiveItem(item)}
          selectedEncoderName={selectedEncoderName}
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          isCoaEmpty={isCoaEmpty}
          activeSearch={filters.search}
        />
      )}

      {/* RECEIPT INSPECTOR LIGHTBOX & AUDIT MODAL */}
      <InspectorReceiptPreviewModal
        isOpen={Boolean(activeItem)}
        onClose={() => setActiveItem(null)}
        item={activeItem}
        suppliers={suppliers}
        coas={coas}
        divisions={divisions}
        departments={departments}
      />
    </div>
  );
};
