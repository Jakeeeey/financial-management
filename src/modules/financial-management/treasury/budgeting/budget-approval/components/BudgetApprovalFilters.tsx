"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBudgetApprovalContext } from "../providers/BudgetApprovalProvider";
import { budgetApprovalService } from "../services/budgetService";
import type { Division, Department } from "../types";
import { Badge } from "@/components/ui/badge";

import { YEAR_OPTIONS } from "../utils";

export function BudgetApprovalFilters() {
  const { filters, updateFilter, clearFilters, hasFilters } = useBudgetApprovalContext();
  
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const divs = await budgetApprovalService.getDivisions();
        setDivisions(divs);
      } catch (err) {
        console.error("Failed to load divisions:", err);
      }
    };
    loadLookups();
  }, []);

  useEffect(() => {
    const loadDepts = async () => {
      if (!filters.division_id) {
        setDepartments([]);
        return;
      }
      try {
        const depts = await budgetApprovalService.getDepartments(Number(filters.division_id));
        setDepartments(depts);
      } catch (err) {
        console.error("Failed to load departments:", err);
      }
    };
    loadDepts();
  }, [filters.division_id]);

  return (
    <div className="flex flex-col gap-4">
    <div className="flex flex-wrap items-center gap-3">
      {/* Search Input */}
      <div className="relative w-full sm:w-[240px]">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
        <Input
          placeholder="Search Budget No..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="h-9 w-full pl-9 rounded-lg border-border/40 bg-background text-xs font-medium placeholder:text-muted-foreground/50 focus-visible:ring-primary/20"
        />
      </div>

      {/* Year Filter */}
      <Select
        value={filters.year}
        onValueChange={(val) => updateFilter("year", val)}
      >
        <SelectTrigger className="h-9 w-[100px] rounded-lg border-border/40 bg-background text-xs font-medium">
          <SelectValue placeholder="Year" />
        </SelectTrigger>
        <SelectContent className="rounded-lg border-border/40 shadow-xl">
          {YEAR_OPTIONS.map((y) => (
            <SelectItem key={`year-${y.value}`} value={y.value} className="text-xs font-medium">
              {y.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Division Filter */}
      <Select
        value={filters.division_id}
        onValueChange={(val) => {
          updateFilter("division_id", val);
          updateFilter("department_id", "all");
        }}
      >
        <SelectTrigger className="h-9 w-[160px] rounded-lg border-border/40 bg-background text-xs font-medium">
          <SelectValue placeholder="All Divisions" />
        </SelectTrigger>
        <SelectContent className="rounded-lg border-border/40 shadow-xl">
           <SelectItem value="all" className="text-xs font-medium">All Divisions</SelectItem>
          {divisions.map((div) => (
            <SelectItem key={`div-${div.division_id}`} value={String(div.division_id)} className="text-xs font-medium">
              {div.division_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Department Filter */}
      <Select
        value={filters.department_id}
        onValueChange={(val) => updateFilter("department_id", val)}
        disabled={!filters.division_id || filters.division_id === "all"}
      >
        <SelectTrigger className="h-9 w-[160px] rounded-lg border-border/40 bg-background text-xs font-medium text-left">
          <SelectValue placeholder="All Depts." />
        </SelectTrigger>
        <SelectContent className="rounded-lg border-border/40 shadow-xl">
           <SelectItem value="all" className="text-xs font-medium">All Depts.</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={`dept-${dept.department_id}`} value={String(dept.department_id)} className="text-xs font-medium">
              {dept.department_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="h-8 px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 active:scale-95 transition-all"
        >
          <X className="h-3 w-3" />
          Clear
        </Button>
      )}
    </div>

      {/* Active Filter Tags (Optional Enhancement) */}
      {hasFilters && (
         <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mr-1">Active Filters:</span>
            {filters.status && (
               <Badge variant="secondary" className="h-5 px-2 text-[8px] font-black uppercase tracking-tighter bg-primary/10 text-primary border-none">
                  Status: {filters.status}
               </Badge>
            )}
            {filters.division_id && (
               <Badge variant="secondary" className="h-5 px-2 text-[8px] font-black uppercase tracking-tighter bg-primary/10 text-primary border-none">
                  Division: {divisions.find(d => String(d.division_id) === filters.division_id)?.division_name}
               </Badge>
            )}
         </div>
      )}
    </div>
  );
}
