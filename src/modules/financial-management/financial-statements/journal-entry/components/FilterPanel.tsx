"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterState, JournalEntryFilterOptions } from "../types";

interface FilterPanelProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  uniqueSourceModules: string[];
  filterOptions: JournalEntryFilterOptions;
  filterOptionsLoading: boolean;
  filterOptionsError: string | null;
  isOpen: boolean;
}

export default function FilterPanel({
  filters,
  setFilters,
  uniqueSourceModules,
  filterOptions,
  filterOptionsLoading,
  filterOptionsError,
  isOpen,
}: FilterPanelProps) {
  return (
    <section
      id="journal-entry-advanced-filters"
      aria-label="Additional journal entry filters"
      hidden={!isOpen}
      className="shrink-0 border-b bg-background px-3 py-4 sm:px-6"
    >
      <div className="mb-4">
        <h2 className="text-sm font-semibold">More filters</h2>
        <p className="text-sm text-muted-foreground">Choose additional criteria to narrow the journal entries.</p>
      </div>
      <AdvancedFilterFields
        filters={filters}
        setFilters={setFilters}
        uniqueSourceModules={uniqueSourceModules}
        filterOptions={filterOptions}
        filterOptionsLoading={filterOptionsLoading}
        filterOptionsError={filterOptionsError}
        checkboxId="journal-entry-posted-only"
      />
    </section>
  );
}

function AdvancedFilterFields({
  filters,
  setFilters,
  uniqueSourceModules,
  filterOptions,
  filterOptionsLoading,
  filterOptionsError,
  checkboxId,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  uniqueSourceModules: string[];
  filterOptions: JournalEntryFilterOptions;
  filterOptionsLoading: boolean;
  filterOptionsError: string | null;
  checkboxId: string;
}) {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const selects: {
    label: string;
    key: "branch" | "division" | "department" | "entryType" | "sourceModule";
    items: { value: string; label: string }[];
    hasLookup: boolean;
  }[] = [
    { label: "Branch", key: "branch", items: [
      { value: "All Branches", label: "All Branches" },
      ...filterOptions.branches.map(({ id, name }) => ({ value: id, label: name })),
    ], hasLookup: true },
    { label: "Division", key: "division", items: [
      { value: "All Divisions", label: "All Divisions" },
      ...filterOptions.divisions.map(({ id, name }) => ({ value: id, label: name })),
    ], hasLookup: true },
    { label: "Department", key: "department", items: [
      { value: "All Departments", label: "All Departments" },
      ...filterOptions.departments.map(({ id, name }) => ({ value: id, label: name })),
    ], hasLookup: true },
    { label: "Entry Type", key: "entryType", items: ["All Entry Types", "Sales", "Purchase", "Adjustment", "Accrual"].map((value) => ({ value, label: value })), hasLookup: false },
    { label: "Source Module", key: "sourceModule", items: (uniqueSourceModules.length > 0 ? uniqueSourceModules : ["All Source Modules"]).map((value) => ({ value, label: value })), hasLookup: false },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {selects.map(({ label, key, items, hasLookup }) => (
        <div key={key} className="min-w-0 space-y-2">
          <Label htmlFor={`${checkboxId}-${key}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </Label>
          <Select value={filters[key]} onValueChange={(value) => updateFilter(key, value)}>
            <SelectTrigger id={`${checkboxId}-${key}`} className="h-9 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => <SelectItem key={item.value} value={item.value} className="text-sm">{item.label}</SelectItem>)}
              {hasLookup && filterOptionsLoading && items.length === 1 && (
                <SelectItem value={`loading-${key}`} disabled className="text-sm">Loading options…</SelectItem>
              )}
              {hasLookup && filterOptionsError && items.length === 1 && !filterOptionsLoading && (
                <SelectItem value={`unavailable-${key}`} disabled className="text-sm">Options unavailable</SelectItem>
              )}
              {hasLookup && !filterOptionsLoading && !filterOptionsError && items.length === 1 && (
                <SelectItem value={`empty-${key}`} disabled className="text-sm">No options available</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      ))}

      <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-3 sm:col-span-2 lg:col-span-1">
        <Checkbox
          id={checkboxId}
          checked={filters.showPostedOnly}
          onCheckedChange={(checked) => updateFilter("showPostedOnly", checked === true)}
        />
        <Label htmlFor={checkboxId} className="cursor-pointer text-sm font-medium leading-none">
          View only posted entries
        </Label>
      </div>
    </div>
  );
}
