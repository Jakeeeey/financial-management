"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AuditTrailFilters as FiltersType, BudgetStatus, Division, Department, COA } from "../types";
import { auditTrailService } from "../services/auditTrailService";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const STATUSES: BudgetStatus[] = [
  "Draft", "Pending", "Approved", "Rejected", "Deleted"
];

type FilterSelectOption = { value: string; label: string };

function SearchableFilterSelect({
  value,
  onChange,
  placeholder,
  options,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: FilterSelectOption[];
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 justify-between rounded-lg border-border/40 bg-background px-3 text-xs font-medium shadow-none hover:bg-background",
            !selectedLabel && "text-muted-foreground",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
        >
          <span className="truncate">{selectedLabel || placeholder}</span>
          <ChevronDown className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={`Search ${placeholder.toLowerCase()}...`} className="h-9 text-xs" />
          <CommandList className="max-h-[240px]">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.value}`}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="text-xs font-medium"
                >
                  <Check
                    className={cn(
                      "mr-2 h-3.5 w-3.5",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
  const [coas, setCoas] = useState<COA[]>([]);

  useEffect(() => {
    async function loadLookups() {
      try {
        const [divisionData, coaData] = await Promise.all([
          auditTrailService.getDivisions(),
          auditTrailService.getCOAs(),
        ]);
        setDivisions(Array.isArray(divisionData) ? divisionData : []);
        setCoas(Array.isArray(coaData) ? coaData : []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load audit filter options");
      }
    }
    loadLookups();
  }, []);

  useEffect(() => {
    let active = true;
    async function loadDepts() {
      if (!filters.division_id || filters.division_id === "all") {
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

  const statusOptions: FilterSelectOption[] = [
    { value: "all", label: "All Statuses" },
    ...STATUSES.map((status) => ({ value: status, label: status })),
  ];

  const divisionOptions: FilterSelectOption[] = [
    { value: "all", label: "All Divisions" },
    ...divisions.map((division) => ({
      value: String(division.division_id),
      label: division.division_name,
    })),
  ];

  const departmentOptions: FilterSelectOption[] = [
    { value: "all", label: "All Depts." },
    ...departments.map((department) => ({
      value: String(department.department_id),
      label: department.department_name,
    })),
  ];

  const coaOptions: FilterSelectOption[] = [
    { value: "all", label: "All COA" },
    ...coas.map((coa) => ({
      value: String(coa.coa_id),
      label: `${coa.account_title}${coa.gl_code ? ` (${coa.gl_code})` : ""}`,
    })),
  ];

  const hasFilters = filters.search || filters.status || filters.division_id || filters.department_id || filters.coa_id || filters.date_from || filters.date_to;

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
      <SearchableFilterSelect
        value={filters.status || "all"}
        onChange={(val) => updateFilter("status", val === "all" ? "" : (val as BudgetStatus))}
        placeholder="All Statuses"
        options={statusOptions}
        className="w-[130px]"
      />

      {/* Division Filter */}
      <SearchableFilterSelect
        value={filters.division_id || "all"}
        onChange={(val) => {
          updateFilter("division_id", val === "all" ? "" : val);
          updateFilter("department_id", "");
        }}
        placeholder="All Divisions"
        options={divisionOptions}
        className="w-[160px]"
      />

      {/* Department Filter */}
      <SearchableFilterSelect
        value={filters.department_id || "all"}
        onChange={(val) => updateFilter("department_id", val === "all" ? "" : val)}
        disabled={!filters.division_id || filters.division_id === "all"}
        placeholder="All Depts."
        options={departmentOptions}
        className="w-[160px]"
      />

      {/* COA Filter */}
      <SearchableFilterSelect
        value={filters.coa_id || "all"}
        onChange={(val) => updateFilter("coa_id", val === "all" ? "" : val)}
        placeholder="All COA"
        options={coaOptions}
        className="w-[220px]"
      />

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
