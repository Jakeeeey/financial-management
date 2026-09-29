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

  // Navigation state: null = Encoders List (Screen 1), number = Selected Encoder ID (Screen 2)
  const [selectedEncoderId, setSelectedEncoderId] = useState<number | null>(null);

  // Selected item for details modal
  const [activeItem, setActiveItem] = useState<ExpenseSummaryItem | null>(null);

  // Filters state
  const [filters, setFilters] = useState<SummaryFilterState>({
    search: "",
    dateFrom: "",
    dateTo: "",
    status: "ALL",
    divisionId: "ALL",
    departmentId: "ALL",
    coaId: "ALL",
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
    } catch (e) {
      console.error("Error fetching Expense Summary V2 data:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFilterChange = (key: keyof SummaryFilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      search: "",
      dateFrom: "",
      dateTo: "",
      status: "ALL",
      divisionId: "ALL",
      departmentId: "ALL",
      coaId: "ALL",
    });
  };

  // 1. Filtered expense list according to top filter controls
  const filteredExpenses = useMemo(() => {
    return expenses.filter((item) => {
      // Search Query
      if (filters.search.trim()) {
        const q = filters.search.toLowerCase();
        const docMatch = (item.doc_no || "").toLowerCase().includes(q);
        const remarksMatch = (item.remarks || "").toLowerCase().includes(q);
        const payeeObj = suppliers.find((s) => s.id === item.payee);
        const payeeMatch = (payeeObj?.supplier_name || "").toLowerCase().includes(q);
        if (!docMatch && !remarksMatch && !payeeMatch) return false;
      }

      // Status Filter
      if (filters.status !== "ALL") {
        if (filters.status === "With Concern") {
          if (item.status !== "With Concern" && !item.has_concern) return false;
        } else if (item.status !== filters.status) {
          return false;
        }
      }

      // Division Filter
      if (filters.divisionId !== "ALL") {
        if (String(item.division_id) !== filters.divisionId) return false;
      }

      // COA Filter
      if (filters.coaId !== "ALL") {
        if (String(item.coa_id) !== filters.coaId) return false;
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
  }, [expenses, filters, suppliers]);

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

  // Selected encoder details group
  const selectedEncoderGroup = useMemo(() => {
    if (!selectedEncoderId) return null;
    return encoderGroups.find((g) => g.user_id === selectedEncoderId) || null;
  }, [selectedEncoderId, encoderGroups]);

  // Auto return to Encoders list if selected encoder has 0 items after filter change
  useEffect(() => {
    if (selectedEncoderId && !selectedEncoderGroup) {
      setSelectedEncoderId(null);
    }
  }, [selectedEncoderId, selectedEncoderGroup]);

  return (
    <div className="space-y-4">
      {/* Title & Refresh Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-3.5">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            Expense Summary V2
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Comprehensive overview, encoder breakdowns, and audit log history for division expense records.
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

      {/* KPI Metrics Cards */}
      <SummaryMetricsCards expenses={filteredExpenses} />

      {/* Filter Controls Bar */}
      <SummaryFiltersBar
        filters={filters}
        divisions={divisions}
        departments={departments}
        coas={coas}
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
          expenses={selectedEncoderGroup ? selectedEncoderGroup.items : []}
          suppliers={suppliers}
          coas={coas}
          divisions={divisions}
          departments={departments}
          selectedEncoderName={
            selectedEncoderGroup
              ? `${selectedEncoderGroup.user_fname} ${selectedEncoderGroup.user_lname}`
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
