// src/modules/financial-management/treasury/budgeting/create-budget/components/CreateBudgetFilters.tsx

"use client";

import { useState, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateBudgetContext } from "../providers/CreateBudgetProvider";
import { budgetService } from "../services/budgetService";
import {
  YEAR_OPTIONS,
} from "../utils";
import type { BudgetFilters, Division, Department } from "../types";
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

export function CreateBudgetFilters() {
  const { filters, updateFilter, clearFilters, hasFilters } = useCreateBudgetContext();

  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadDivs() {
        try {
            setLoading(true);
            const data = await budgetService.getDivisions();
            setDivisions(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
            toast.error("Failed to load divisions for filters");
        } finally {
            setLoading(false);
        }
    }
    loadDivs();
  }, []);

  useEffect(() => {
    let active = true;
    async function loadDepts() {
        if (!filters.division_id) {
            await Promise.resolve();
            if (active) setDepartments([]);
            return;
        }
        try {
            setLoading(true);
            const data = await budgetService.getDepartments(Number(filters.division_id));
            if (active) {
                setDepartments(Array.isArray(data) ? data : []);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load departments for filters");
        } finally {
            if (active) setLoading(false);
        }
    }
    loadDepts();
    return () => {
        active = false;
    };
  }, [filters.division_id]);

  const divisionOptions = (divisions || [])
    .filter(d => d && d.division_id)
    .map((d, i) => ({ 
      value: String(d.division_id), 
      label: d.division_name || `Division ${i+1}` 
    }));

  const deptOptions = (departments || [])
    .filter(d => d && d.department_id)
    .map((d, i) => ({ 
      value: String(d.department_id), 
      label: d.department_name || `Department ${i+1}` 
    }));

  const handleFilter = <K extends keyof BudgetFilters>(key: K, val: BudgetFilters[K]) => {
    updateFilter(key, val);
    // Reset department when division changes
    if (key === "division_id") updateFilter("department_id", "");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative min-w-[180px] flex-1 max-w-xs">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          id="budget-filter-search"
          value={filters.search}
          onChange={e => handleFilter("search", e.target.value)}
          placeholder="Search Budget No..."
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
          id="budget-filter-year"
          value={filters.year}
          onChange={v => handleFilter("year", v)}
          placeholder="All Years"
          options={YEAR_OPTIONS}
        />
      </div>

      {/* Division */}
      <div className="w-[140px]">
        <FilterSelect
          id="budget-filter-division"
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
          id="budget-filter-department"
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
  );
}
