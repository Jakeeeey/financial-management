"use client";

import React, { useState, useEffect, useMemo } from "react";
import { RefreshCw } from "lucide-react";
import {
  ExpenseSummaryItem,
  SupplierOption,
  ChartOfAccountOption,
  DivisionInfo,
  DepartmentOption,
  SummaryFilterState,
  EncoderSummaryGroup,
  ExpenseApproverOption,
} from "./types";
import { SummaryMetricsCards } from "./components/SummaryMetricsCards";
import { SummaryFiltersBar } from "./components/SummaryFiltersBar";
import { SummaryEncoderCardsGrid } from "./components/SummaryEncoderCardsGrid";
import { ExpenseSummaryTable } from "./components/ExpenseSummaryTable";
import { ExpenseDetailsModal } from "./components/ExpenseDetailsModal";

export const ExpenseSummaryV2Module: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<ExpenseSummaryItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [coas, setCoas] = useState<ChartOfAccountOption[]>([]);
  const [divisions, setDivisions] = useState<DivisionInfo[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [approvers, setApprovers] = useState<ExpenseApproverOption[]>([]);

  // Navigation state: null = Encoders List (Screen 1), number = Selected Encoder ID (Screen 2)
  const [selectedEncoderId, setSelectedEncoderId] = useState<number | null>(null);

  // Selected item for details modal
  const [activeItem, setActiveItem] = useState<ExpenseSummaryItem | null>(null);

  // Filters state
  const [filters, setFilters] = useState<SummaryFilterState>({
    search: "",
    dateFrom: "",
    dateTo: "",
    statuses: [],
    divisionId: "ALL",
    divisionIds: [],
    departmentId: "ALL",
    coaIds: [],
    encoderIds: [],
  });

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch summary items
      const summaryRes = await fetch("/api/fm/treasury/expenses-v2/expense-summary-v2");
      const summaryJson = await summaryRes.json();
      setExpenses(summaryJson.data || []);

      // Fetch suppliers
      const supRes = await fetch("/api/fm/treasury/expenses-v2/expense-creation-v2/suppliers");
      const supJson = await supRes.json();
      setSuppliers(supJson.data || []);

      // Fetch COA
      const coaRes = await fetch("/api/fm/treasury/expenses-v2/expense-creation-v2/chart_of_accounts");
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

      // Fetch Approvers
      const appRes = await fetch("/api/fm/treasury/expenses-v2/expense-approval-v2/approvers");
      const appJson = await appRes.json();
      setApprovers(appJson.data || []);
    } catch (e) {
      console.error("Error fetching Expense Summary V2 data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFilterChange = <K extends keyof SummaryFilterState>(
    key: K,
    value: SummaryFilterState[K]
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      dateFrom: "",
      dateTo: "",
      statuses: [],
      divisionId: "ALL",
      divisionIds: [],
      departmentId: "ALL",
      coaIds: [],
      encoderIds: [],
    });
  };

  // Distinct Encoders extracted from all raw expenses for the Page 1 Encoders multi-select filter
  const allEncoders = useMemo(() => {
    const map = new Map<number, { user_id: number; user_fname: string; user_lname: string; user_email?: string; division_id?: number | null }>();
    expenses.forEach((item) => {
      const userObj =
        typeof item.created_by === "object" && item.created_by !== null
          ? item.created_by
          : null;
      const userId = userObj ? userObj.user_id : (item.created_by as number) || 0;
      if (!map.has(userId)) {
        map.set(userId, {
          user_id: userId,
          user_fname: userObj ? userObj.user_fname : "Unknown",
          user_lname: userObj ? userObj.user_lname : `Encoder #${userId}`,
          user_email: userObj ? userObj.user_email : undefined,
          division_id: item.division_id,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.user_fname.localeCompare(b.user_fname));
  }, [expenses]);

  // 1. Filtered expense list according to top filter controls
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      const userObj =
        typeof item.created_by === "object" && item.created_by !== null
          ? item.created_by
          : null;
      const userId = userObj ? userObj.user_id : (item.created_by as number) || 0;

      // Screen 1: Encoders Multi-Select Filter
      if (!selectedEncoderId && filters.encoderIds && filters.encoderIds.length > 0) {
        if (!filters.encoderIds.includes(userId)) return false;
      }

      // Screen 1: Divisions Multi-Select Filter
      if (!selectedEncoderId && filters.divisionIds && filters.divisionIds.length > 0) {
        if (!item.division_id || !filters.divisionIds.includes(Number(item.division_id))) return false;
      }

      // Screen 2: Search Query (Doc Code, Payee, COA title, Remarks)
      if (selectedEncoderId && filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const docMatch = (item.doc_no || "").toLowerCase().includes(q);
        const remarksMatch = (item.remarks || "").toLowerCase().includes(q);
        const payeeObj = suppliers.find((s) => s.id === item.payee);
        const payeeMatch = (payeeObj?.supplier_name || "").toLowerCase().includes(q);
        const coaObj = coas.find((c) => c.coa_id === item.coa_id);
        const coaMatch =
          (coaObj?.account_title || "").toLowerCase().includes(q) ||
          (coaObj?.gl_code || "").toLowerCase().includes(q);
        if (!docMatch && !remarksMatch && !payeeMatch && !coaMatch) return false;
      }

      // Statuses Filter (Multi-select)
      if (filters.statuses && filters.statuses.length > 0) {
        const hasMatch = filters.statuses.some((statusKey) => {
          if (statusKey === "With Concern") {
            return item.status === "With Concern" || !!item.has_concern;
          }
          return item.status === statusKey;
        });
        if (!hasMatch) return false;
      }

      // COA Filter (Multi-select)
      if (filters.coaIds && filters.coaIds.length > 0) {
        if (!filters.coaIds.includes(item.coa_id)) return false;
      }

      // Date Range Filter
      if (filters.dateFrom) {
        if (!item.expense_date || item.expense_date < filters.dateFrom) return false;
      }
      if (filters.dateTo) {
        if (!item.expense_date || item.expense_date > filters.dateTo) return false;
      }

      return true;
    });
  }, [expenses, filters, suppliers, coas, selectedEncoderId]);

  // 2. Group filtered expenses per Encoder / Submitter (created_by)
  const encoderGroups = useMemo<EncoderSummaryGroup[]>(() => {
    const groupsMap: Record<number, EncoderSummaryGroup> = {};

    filteredExpenses.forEach((item) => {
      const userObj =
        typeof item.created_by === "object" && item.created_by !== null
          ? item.created_by
          : null;

      const userId = userObj ? userObj.user_id : (item.created_by as number) || 0;
      const fname = userObj ? userObj.user_fname : "Unknown";
      const lname = userObj ? userObj.user_lname : `Encoder #${userId}`;
      const email = userObj ? userObj.user_email : undefined;

      if (!groupsMap[userId]) {
        groupsMap[userId] = {
          user_id: userId,
          user_fname: fname,
          user_lname: lname,
          user_email: email,
          division_id: item.division_id,
          total_count: 0,
          total_amount: 0,
          items: [],
        };
      }

      groupsMap[userId].items.push(item);
      groupsMap[userId].total_count += 1;
      groupsMap[userId].total_amount += Number(item.amount || 0);
    });

    return Object.values(groupsMap);
  }, [filteredExpenses]);

  // Selected encoder raw items (unfiltered by screen 2 filters, but scoped to encoder)
  const selectedEncoderExpenses = useMemo(() => {
    if (!selectedEncoderId) return [];
    return expenses.filter((item) => {
      const userObj =
        typeof item.created_by === "object" && item.created_by !== null
          ? item.created_by
          : null;
      const userId = userObj ? userObj.user_id : (item.created_by as number) || 0;
      return userId === selectedEncoderId;
    });
  }, [expenses, selectedEncoderId]);

  // Selected encoder user info (resolved even when filtered count is 0)
  const selectedEncoderUser = useMemo(() => {
    if (!selectedEncoderId) return null;
    const item = expenses.find((i) => {
      const userObj =
        typeof i.created_by === "object" && i.created_by !== null
          ? i.created_by
          : null;
      const userId = userObj ? userObj.user_id : (i.created_by as number) || 0;
      return userId === selectedEncoderId;
    });
    if (!item) return null;
    const userObj =
      typeof item.created_by === "object" && item.created_by !== null
        ? item.created_by
        : null;
    return {
      user_id: selectedEncoderId,
      user_fname: userObj ? userObj.user_fname : "Encoder",
      user_lname: userObj ? userObj.user_lname : `#${selectedEncoderId}`,
      user_email: userObj ? userObj.user_email : undefined,
    };
  }, [expenses, selectedEncoderId]);

  // Selected encoder filtered items (passed to Screen 2 table)
  const selectedEncoderFilteredItems = useMemo(() => {
    if (!selectedEncoderId) return [];
    return filteredExpenses.filter((item) => {
      const userObj =
        typeof item.created_by === "object" && item.created_by !== null
          ? item.created_by
          : null;
      const userId = userObj ? userObj.user_id : (item.created_by as number) || 0;
      return userId === selectedEncoderId;
    });
  }, [filteredExpenses, selectedEncoderId]);

  // Expenses to pass into KPI Cards: Global expenses on Screen 1, Scoped encoder expenses on Screen 2
  const kpiExpenses = useMemo(() => {
    return selectedEncoderId ? selectedEncoderExpenses : expenses;
  }, [selectedEncoderId, selectedEncoderExpenses, expenses]);

  return (
    <div className="space-y-4">
      {/* Title & Refresh Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-3.5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Expense Summary V2
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {selectedEncoderUser
              ? `Reviewing submitted expense records and timeline for ${selectedEncoderUser.user_fname} ${selectedEncoderUser.user_lname}.`
              : "Comprehensive overview, encoder breakdowns, and audit log history for division expense records."}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg border border-border/60 bg-card/60 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards (Global on Screen 1, Encoder-Scoped on Screen 2) */}
      <SummaryMetricsCards
        expenses={kpiExpenses}
        activeFilterStatuses={filters.statuses}
        onSelectFilter={(statusKey) => {
          if (statusKey === "ALL") {
            handleFilterChange("statuses", []);
          } else {
            const current = filters.statuses || [];
            if (current.includes(statusKey)) {
              handleFilterChange("statuses", current.filter((s) => s !== statusKey));
            } else {
              handleFilterChange("statuses", [...current, statusKey]);
            }
          }
        }}
      />

      {/* Filter Controls Bar (Adaptive controls for Screen 1 vs Screen 2) */}
      <SummaryFiltersBar
        filters={filters}
        divisions={divisions}
        departments={departments}
        coas={coas}
        encoders={allEncoders}
        isEncoderSelected={!!selectedEncoderId}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
      />

      {/* VIEW SWITCHING: SCREEN 1 (ENCODER CARDS GRID) vs SCREEN 2 (MASTER-DETAIL GROUP VIEW FOR SELECTED ENCODER) */}
      {!selectedEncoderId ? (
        <SummaryEncoderCardsGrid
          groups={encoderGroups}
          divisions={divisions}
          onSelectEncoder={(userId) => setSelectedEncoderId(userId)}
        />
      ) : (
        <ExpenseSummaryTable
          expenses={selectedEncoderFilteredItems}
          suppliers={suppliers}
          coas={coas}
          divisions={divisions}
          departments={departments}
          approvers={approvers}
          selectedEncoderName={
            selectedEncoderUser
              ? `${selectedEncoderUser.user_fname} ${selectedEncoderUser.user_lname}`
              : undefined
          }
          onBackToEncoders={() => setSelectedEncoderId(null)}
          onViewDetails={(item) => setActiveItem(item)}
        />
      )}

      {/* Details & Audit Trail Modal */}
      <ExpenseDetailsModal
        isOpen={!!activeItem}
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
