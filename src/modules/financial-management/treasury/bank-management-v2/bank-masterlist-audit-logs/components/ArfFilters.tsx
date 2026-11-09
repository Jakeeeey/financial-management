"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ALL } from "../constants";
import type { ArfFilters as ArfFiltersState } from "../hooks/useMasterlist";

type Props = {
  filters: ArfFiltersState;
  subModules: string[];
  onChange: (next: ArfFiltersState) => void;
};

const SEVERITY_OPTIONS = [
  { value: ALL, label: "All severities" },
  { value: "CRITICAL", label: "Critical" },
  { value: "HIGH", label: "High" },
  { value: "MEDIUM", label: "Medium" },
];

/** FSD 1.6 ARF facets: severity, ARF sub-module, search. */
export function ArfFilters({ filters, subModules, onChange }: Props) {
  const [query, setQuery] = useState(filters.q);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = query.trim();
      if (next !== filters.q) onChange({ ...filters, q: next });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, filters, onChange]);

  const dirty = filters.severity !== ALL || filters.subModule !== ALL || !!filters.q;

  return (
    <div
      aria-label="ARF findings filters"
      className="grid items-center gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,2.2fr)_auto]"
    >
      <Select
        value={filters.severity}
        onValueChange={(value) => onChange({ ...filters, severity: value })}
      >
        <SelectTrigger className="w-full" aria-label="Severity filter">
          <SelectValue placeholder="All severities" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {SEVERITY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.subModule}
        onValueChange={(value) => onChange({ ...filters, subModule: value })}
      >
        <SelectTrigger className="w-full" aria-label="ARF sub-module filter">
          <SelectValue placeholder="All sub-modules" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          <SelectItem value={ALL}>All sub-modules</SelectItem>
          {subModules.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search findings"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Reference or finding"
          className="pl-9"
        />
      </div>

      {dirty ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 justify-self-start"
          onClick={() => {
            setQuery("");
            onChange({ severity: ALL, subModule: ALL, q: "" });
          }}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
