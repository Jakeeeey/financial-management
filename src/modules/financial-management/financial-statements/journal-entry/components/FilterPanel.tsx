"use client";

import * as React from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { journalEntryType, standardEntryTypes } from "../utils/entry-type";
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
  statusOptions: string[];
  filterOptions: JournalEntryFilterOptions;
  filterOptionsLoading: boolean;
  filterOptionsError: string | null;
}

export default function FilterPanel({
  filters,
  setFilters,
  uniqueSourceModules,
  statusOptions,
  filterOptions,
  filterOptionsLoading,
  filterOptionsError,
}: FilterPanelProps) {
  return (
    <section
      id="journal-entry-advanced-filters"
      aria-label="Additional journal entry filters"
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
        statusOptions={statusOptions}
        filterOptions={filterOptions}
        filterOptionsLoading={filterOptionsLoading}
        filterOptionsError={filterOptionsError}
      />
    </section>
  );
}

function AdvancedFilterFields({
  filters,
  setFilters,
  uniqueSourceModules,
  statusOptions,
  filterOptions,
  filterOptionsLoading,
  filterOptionsError,
}: {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  uniqueSourceModules: string[];
  statusOptions: string[];
  filterOptions: JournalEntryFilterOptions;
  filterOptionsLoading: boolean;
  filterOptionsError: string | null;
}) {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const selects: {
    label: string;
    key: "branch" | "division" | "department" | "sourceModule" | "entryType" | "status";
    items: { value: string; label: string }[];
    optionState?: "loading" | "unavailable" | "empty";
  }[] = [
    { label: "Branch", key: "branch", items: [
      { value: "All Branches", label: "All Branches" },
      ...filterOptions.branches.map(({ id, name }) => ({ value: id, label: name })),
    ], optionState: getLookupState(filterOptions.branches.length, filterOptionsLoading, filterOptionsError) },
    { label: "Division", key: "division", items: [
      { value: "All Divisions", label: "All Divisions" },
      ...filterOptions.divisions.map(({ id, name }) => ({ value: id, label: name })),
    ], optionState: getLookupState(filterOptions.divisions.length, filterOptionsLoading, filterOptionsError) },
    { label: "Department", key: "department", items: [
      { value: "All Departments", label: "All Departments" },
      ...filterOptions.departments.map(({ id, name }) => ({ value: id, label: name })),
    ], optionState: getLookupState(filterOptions.departments.length, filterOptionsLoading, filterOptionsError) },
    { label: "Entry Type", key: "entryType", items: Array.from(new Set(["All Entry Types", ...standardEntryTypes, ...uniqueSourceModules.filter(value => value !== "All Source Modules").map(journalEntryType), filters.entryType || "All Entry Types"])).map(value => ({ value, label: value })) },
    { label: "Source Module", key: "sourceModule", items: Array.from(new Set(["All Source Modules", ...uniqueSourceModules, filters.sourceModule])).map((value) => ({ value, label: value })) },
    { label: "Entry Status", key: "status", items: Array.from(new Set(["All Statuses", "Posted", "Unposted", "Dispatched", "For Review", "Approved", "Draft", ...statusOptions])).map(value => ({ value, label: value })) },
  ];

  return (
    <div className="space-y-4"><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {selects.map(({ label, key, items, optionState }) => (
        <div key={key} className="min-w-0 space-y-2">
          <Label htmlFor={`journal-entry-filter-${key}`} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </Label>
          <Select value={filters[key] || "All Entry Types"} onValueChange={(value) => updateFilter(key, value)} disabled={Boolean(optionState)}>
            <SelectTrigger id={`journal-entry-filter-${key}`} className="h-9 text-sm">
              <SelectValue placeholder={optionState === "loading" ? "Loading options…" : optionState ? "Unavailable" : undefined} />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => <SelectItem key={item.value} value={item.value} className="text-sm">{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {optionState && (
            <p className="text-xs text-muted-foreground">
              {optionState === "loading" ? "Loading choices…" : optionState === "unavailable" ? "Options unavailable." : "No choices available."}
            </p>
          )}
        </div>
      ))}
    </div><div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/30 p-3"><Checkbox id="journal-posted-only" checked={filters.status === "Posted"} onCheckedChange={checked => updateFilter("status", checked === true ? "Posted" : "All Statuses")} /><Label htmlFor="journal-posted-only" className="cursor-pointer text-sm">View only posted entries</Label></div></div>
  );
}

function getLookupState(count: number, loading: boolean, error: string | null): "loading" | "unavailable" | "empty" | undefined {
  if (loading) return "loading";
  if (error) return "unavailable";
  if (count === 0) return "empty";
  return undefined;
}
