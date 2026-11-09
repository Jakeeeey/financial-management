"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ALL } from "../constants";
import { EMPTY_LOG_FILTERS, type LogFilters } from "../hooks/useMasterlist";
import { DateField } from "./DateField";
import { OptionCombobox } from "./OptionCombobox";

type Props = {
  filters: LogFilters;
  modules: string[];
  users: string[];
  onChange: (next: LogFilters) => void;
};

const TIMESTAMP_OPTIONS = [
  { value: ALL, label: "Any timestamp" },
  { value: "PHT", label: "Stored in PHT" },
  { value: "NOT_PHT", label: "Not PHT (defect)" },
];

/** FSD 1.6 movement log facets: module, user, timestamp, date range, search. */
export function AuditFilters({ filters, modules, users, onChange }: Props) {
  const [query, setQuery] = useState(filters.q);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = query.trim();
      if (next !== filters.q) onChange({ ...filters, q: next });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, filters, onChange]);

  const userOptions = [
    { value: ALL, label: "All users" },
    ...users.map((user) => ({ value: user, label: user })),
  ];

  const dirty =
    filters.module !== ALL || filters.user !== ALL || filters.pht !== ALL || !!filters.from || !!filters.to || !!filters.q;

  return (
    <div
      aria-label="Movement log filters"
      className="grid items-center gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto]"
    >
      <Select value={filters.module} onValueChange={(value) => onChange({ ...filters, module: value })}>
        <SelectTrigger className="w-full" aria-label="Module filter">
          <SelectValue placeholder="All modules" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          <SelectItem value={ALL}>All modules</SelectItem>
          {modules.map((module) => (
            <SelectItem key={module} value={module}>
              {module}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <OptionCombobox
        options={userOptions}
        value={filters.user}
        onChange={(value) => onChange({ ...filters, user: value })}
        placeholder="All users"
        searchPlaceholder="Search users"
        emptyLabel="No user matches that search."
        aria-label="User filter"
      />

      <Select value={filters.pht} onValueChange={(value) => onChange({ ...filters, pht: value })}>
        <SelectTrigger className="w-full" aria-label="Timestamp filter">
          <SelectValue placeholder="Any timestamp" />
        </SelectTrigger>
        <SelectContent className="max-h-60">
          {TIMESTAMP_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DateField
        id="log-from"
        aria-label="From date"
        value={filters.from}
        maxDate={filters.to || undefined}
        onChange={(value) => onChange({ ...filters, from: value })}
      />

      <DateField
        id="log-to"
        aria-label="To date"
        value={filters.to}
        minDate={filters.from || undefined}
        onChange={(value) => onChange({ ...filters, to: value })}
      />

      <div className="relative min-w-0">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search log entries"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Action or reference"
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
            onChange(EMPTY_LOG_FILTERS);
          }}
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
