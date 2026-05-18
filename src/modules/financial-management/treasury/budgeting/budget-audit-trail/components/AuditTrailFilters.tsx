"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuditTrailFilters as FiltersType, BudgetStatus, Division, Department } from "../types";
import { auditTrailService } from "../services/auditTrailService";
import { toast } from "sonner";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";

const STATUSES: BudgetStatus[] = [
  "Draft", "Pending", "Approved", "Rejected", "Deleted"
];

export function AuditTrailFilters({ 
  filters, 
  updateFilter, 
  clearFilters 
}: { 
  filters: FiltersType; 
  updateFilter: <K extends keyof FiltersType>(k: K, v: FiltersType[K]) => void;
  clearFilters: () => void;
}) {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  useEffect(() => {
    async function loadDivs() {
      try {
        const data = await auditTrailService.getDivisions();
        setDivisions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load divisions");
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
        const data = await auditTrailService.getDepartments(Number(filters.division_id));
        if (active) {
          setDepartments(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load departments");
      }
    }
    loadDepts();
    return () => {
      active = false;
    };
  }, [filters.division_id]);

  const hasFilters = filters.search || filters.status || filters.division_id || filters.department_id || filters.date_from || filters.date_to;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
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

      {/* Status Filter */}
      <Select
        value={filters.status || "all"}
        onValueChange={(val) => updateFilter("status", val === "all" ? "" : (val as BudgetStatus))}
      >
        <SelectTrigger className="h-9 w-[130px] rounded-lg border-border/40 bg-background text-xs font-medium">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent className="rounded-lg border-border/40 shadow-xl">
           <SelectItem value="all" className="text-xs font-medium">All Statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="text-xs font-medium">
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Division Filter */}
      <Select
        value={filters.division_id || "all"}
        onValueChange={(val) => {
          updateFilter("division_id", val === "all" ? "" : val);
          updateFilter("department_id", "");
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
        value={filters.department_id || "all"}
        onValueChange={(val) => updateFilter("department_id", val === "all" ? "" : val)}
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

      {/* Date Range Group */}
      <div className="flex items-center gap-2 bg-muted/30 p-1 rounded-xl border border-border/40">
        <Input 
          type="date"
          value={filters.date_from}
          onChange={(e) => updateFilter("date_from", e.target.value)}
          className="h-7 w-[125px] border-none bg-transparent text-[10px] font-bold uppercase tracking-tight focus-visible:ring-0 px-2"
        />
        <div className="h-3 w-px bg-border/60" />
        <Input 
          type="date"
          value={filters.date_to}
          onChange={(e) => updateFilter("date_to", e.target.value)}
          className="h-7 w-[125px] border-none bg-transparent text-[10px] font-bold uppercase tracking-tight focus-visible:ring-0 px-2"
        />
      </div>

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
  );
}
