"use client";

import { useState, useEffect } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { useBudgetApprovalContext } from "../providers/BudgetApprovalProvider";
import { budgetApprovalService } from "../services/budgetService";
import type { Division, Department } from "../types";
import { cn } from "@/lib/utils";

import { YEAR_OPTIONS } from "../utils";

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
      if (!filters.division_id || filters.division_id === "all") {
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

  const divisionOptions: FilterSelectOption[] = [
    { value: "all", label: "All Divisions" },
    ...divisions.map((div) => ({
      value: String(div.division_id),
      label: div.division_name,
    })),
  ];

  const departmentOptions: FilterSelectOption[] = [
    { value: "all", label: "All Depts." },
    ...departments.map((dept) => ({
      value: String(dept.department_id),
      label: dept.department_name,
    })),
  ];

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
      <SearchableFilterSelect
        value={filters.year}
        onChange={(val) => updateFilter("year", val)}
        placeholder="Year"
        options={YEAR_OPTIONS}
        className="w-[100px]"
      />

      {/* Division Filter */}
      <SearchableFilterSelect
        value={filters.division_id}
        onChange={(val) => {
          updateFilter("division_id", val);
          updateFilter("department_id", "all");
        }}
        placeholder="All Divisions"
        options={divisionOptions}
        className="w-[160px]"
      />

      {/* Department Filter */}
      <SearchableFilterSelect
        value={filters.department_id}
        onChange={(val) => updateFilter("department_id", val)}
        disabled={!filters.division_id || filters.division_id === "all"}
        placeholder="All Depts."
        options={departmentOptions}
        className="w-[160px]"
      />

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

    </div>
  );
}
