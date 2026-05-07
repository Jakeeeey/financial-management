"use client";

import { useState, useEffect } from "react";
import { Search, X, ChevronDown, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useBudgetApprovalContext } from "../providers/BudgetApprovalProvider";
import { budgetApprovalService } from "../services/budgetService";
import {
  MONTH_OPTIONS,
  YEAR_OPTIONS,
} from "../utils";
import type { BudgetApprovalFilters, Division, Department } from "../types";
import { toast } from "sonner";

function FilterSelect({
  id,
  value,
  onChange,
  placeholder,
  options,
  disabled,
  loading,
}: {
  id:          string;
  value:       string;
  onChange:    (val: string) => void;
  placeholder: string;
  options:     { value: string; label: string }[];
  disabled?:   boolean;
  loading?:    boolean;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled || loading}
        className="flex h-9 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 pr-8 text-xs text-foreground ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">{loading ? "Loading..." : placeholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export function BudgetApprovalFilters() {
  const { filters, updateFilter, clearFilters, hasFilters } = useBudgetApprovalContext();

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadDivs() {
        try {
            setLoading(true);
            const data = await budgetApprovalService.getDivisions();
            setDivisions(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error("Failed to load divisions for filters");
        } finally {
            setLoading(false);
        }
    }
    loadDivs();
  }, []);

  useEffect(() => {
    if (!filters.division_id) {
        setDepartments([]);
        return;
    }
    async function loadDepts() {
        try {
            setLoading(true);
            const data = await budgetApprovalService.getDepartments(Number(filters.division_id));
            setDepartments(Array.isArray(data) ? data : []);
        } catch (e) {
            toast.error("Failed to load departments for filters");
        } finally {
            setLoading(false);
        }
    }
    loadDepts();
  }, [filters.division_id]);

  const divisionOptions = (divisions || [])
    .filter(d => d && (d.division_id || (d as any).id))
    .map((d, i) => ({ 
      value: String(d.division_id || (d as any).id), 
      label: d.division_name || (d as any).name || (d as any).divisionName || `Division ${i+1}` 
    }));

  const deptOptions = (departments || [])
    .filter(d => d && (d.department_id || (d as any).id))
    .map((d, i) => ({ 
      value: String((d as any).dept_div_id || d.department_id || (d as any).id), 
      label: d.department_name || (d as any).name || (d as any).departmentName || `Department ${i+1}` 
    }));

  const handleFilter = <K extends keyof BudgetApprovalFilters>(key: K, val: BudgetApprovalFilters[K]) => {
    updateFilter(key, val);
    // Reset department when division changes
    if (key === "division_id") updateFilter("department_id", "");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top Tabs for Status */}
      <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg w-max border border-border">
          <Button
              variant={filters.status === "Pending" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleFilter("status", "Pending")}
              className={`h-8 text-xs font-semibold px-4 gap-2 ${filters.status === "Pending" ? "shadow-sm" : "text-muted-foreground"}`}
          >
              <Clock className="w-3.5 h-3.5" />
              Pending
          </Button>
          <Button
              variant={filters.status === "Approved" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleFilter("status", "Approved")}
              className={`h-8 text-xs font-semibold px-4 gap-2 ${filters.status === "Approved" ? "shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white" : "text-muted-foreground hover:text-emerald-600"}`}
          >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approved
          </Button>
          <Button
              variant={filters.status === "Rejected" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleFilter("status", "Rejected")}
              className={`h-8 text-xs font-semibold px-4 gap-2 ${filters.status === "Rejected" ? "shadow-sm bg-destructive hover:bg-destructive text-destructive-foreground" : "text-muted-foreground hover:text-destructive"}`}
          >
              <XCircle className="w-3.5 h-3.5" />
              Rejected
          </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative min-w-[180px] flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            id="budget-approval-search"
            value={filters.search}
            onChange={e => handleFilter("search", e.target.value)}
            placeholder="Search budgets…"
            className="h-9 pl-9 text-xs"
          />
          {filters.search && (
            <button
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => handleFilter("search", "")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Year */}
        <div className="w-[110px]">
          <FilterSelect
            id="budget-approval-year"
            value={filters.year}
            onChange={v => handleFilter("year", v)}
            placeholder="All Years"
            options={YEAR_OPTIONS}
          />
        </div>

        {/* Month */}
        <div className="w-[130px]">
          <FilterSelect
            id="budget-approval-month"
            value={filters.month}
            onChange={v => handleFilter("month", v)}
            placeholder="All Months"
            options={MONTH_OPTIONS}
          />
        </div>

        {/* Division */}
        <div className="w-[140px]">
          <FilterSelect
            id="budget-approval-division"
            value={filters.division_id}
            onChange={v => handleFilter("division_id", v)}
            placeholder="All Divisions"
            options={divisionOptions}
            loading={loading && divisions.length === 0}
          />
        </div>

        {/* Department */}
        <div className="w-[150px]">
          <FilterSelect
            id="budget-approval-department"
            value={filters.department_id}
            onChange={v => handleFilter("department_id", v)}
            placeholder="All Depts."
            options={deptOptions}
            disabled={!filters.division_id}
            loading={loading && filters.division_id !== ""}
          />
        </div>

        {/* Clear */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
