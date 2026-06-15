// src/modules/financial-management/treasury/budgeting/create-budget/components/CreateBudgetFilters.tsx

"use client";

import { useState, useEffect } from "react";
import { Search, X, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useCreateBudgetContext } from "../providers/CreateBudgetProvider";
import { budgetService } from "../services/budgetService";
import {
  YEAR_OPTIONS,
} from "../utils";
import type { BudgetFilters, Division, Department } from "../types";
import { toast } from "sonner";

export function CreateBudgetFilters() {
  const { filters, updateFilter, clearFilters, hasFilters, openModal } = useCreateBudgetContext();

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
  const divisionFilterOptions = [
    { value: "", label: loading && divisions.length === 0 ? "Loading..." : "All Divisions" },
    ...divisionOptions
  ];

  const deptOptions = (departments || [])
    .filter(d => d && d.department_id)
    .map((d, i) => ({ 
      value: String(d.department_id), 
      label: d.department_name || `Department ${i+1}` 
    }));
  const deptFilterOptions = [
    { value: "", label: loading && filters.division_id !== "" ? "Loading..." : "All Depts." },
    ...deptOptions
  ];
  const yearFilterOptions = [
    { value: "", label: "All Years" },
    ...YEAR_OPTIONS
  ];
  const searchableSelectClassName = "h-9 rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground shadow-none";

  const handleFilter = <K extends keyof BudgetFilters>(key: K, val: BudgetFilters[K]) => {
    updateFilter(key, val);
    // Reset department when division changes
    if (key === "division_id") updateFilter("department_id", "");
  };

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
          <SearchableSelect
            value={filters.year}
            onValueChange={v => handleFilter("year", v)}
            placeholder="All Years"
            options={yearFilterOptions}
            className={searchableSelectClassName}
          />
        </div>

        {/* Division */}
        <div className="w-[140px]">
          <SearchableSelect
            value={filters.division_id}
            onValueChange={v => handleFilter("division_id", v)}
            placeholder="All Divisions"
            options={divisionFilterOptions}
            disabled={loading && divisions.length === 0}
            className={searchableSelectClassName}
          />
        </div>

        {/* Department */}
        <div className="w-[150px]">
          <SearchableSelect
            value={filters.department_id}
            onValueChange={v => handleFilter("department_id", v)}
            placeholder="All Depts."
            options={deptFilterOptions}
            disabled={!filters.division_id || (loading && filters.division_id !== "")}
            className={searchableSelectClassName}
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

      <div className="flex shrink-0 items-center justify-end">
        <Button
          size="sm"
          onClick={openModal}
          className="h-9 px-4 text-xs gap-2 font-bold rounded-xl shadow-sm active:scale-95 transition-transform"
        >
          <Plus className="h-4 w-4" />
          Create Budget
        </Button>
      </div>
    </div>
  );
}
