"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ALL } from "../constants";
import type { AccountsFilter } from "../providers/masterlistApi";
import { OptionCombobox, type ComboboxOption } from "./OptionCombobox";

type Props = {
  filters: AccountsFilter;
  bankId: string;
  bankOptions: ComboboxOption[];
  accountTypeOptions: string[];
  ifrsOptions: string[];
  onChange: (next: AccountsFilter) => void;
  onBankChange: (next: string) => void;
  onClear: () => void;
};

const STATUS_OPTIONS = [
  { value: ALL, label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "DORMANT", label: "Dormant" },
  { value: "CLOSED", label: "Closed" },
];

const RECONCILIATION_OPTIONS = [
  { value: ALL, label: "Any reconciliation" },
  { value: "RECONCILED", label: "Reconciled at least once" },
  { value: "UNRECONCILED", label: "Never reconciled" },
];

/** FSD 1.6 masterlist facets: bank, type, currency, IFRS 9 category, status, reconciliation, search. */
export function MasterlistFilters({
  filters,
  bankId,
  bankOptions,
  accountTypeOptions,
  ifrsOptions,
  onChange,
  onBankChange,
  onClear,
}: Props) {
  const [query, setQuery] = useState(filters.q ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = query.trim() || undefined;
      if (next !== filters.q) onChange({ ...filters, q: next });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, filters, onChange]);

  const dirty =
    bankId !== ALL ||
    !!filters.q ||
    (filters.status ?? ALL) !== ALL ||
    (filters.currency ?? ALL) !== ALL ||
    (filters.type ?? ALL) !== ALL ||
    (filters.ifrs ?? ALL) !== ALL ||
    (filters.reconciliation ?? ALL) !== ALL;

  return (
    <div aria-label="Masterlist filters" className="border-b border-border/50 px-4 py-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1.2fr)]">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">Bank account</Label>
          <OptionCombobox
            options={bankOptions}
            value={bankId}
            onChange={onBankChange}
            placeholder="All accounts"
            searchPlaceholder="Search bank, account no. or branch"
            emptyLabel="No bank account found."
            aria-label="Bank account filter"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">Account type</Label>
          <Select
            value={filters.type ?? ALL}
            onValueChange={(value) => onChange({ ...filters, type: value === ALL ? undefined : value })}
          >
            <SelectTrigger className="w-full" aria-label="Account type filter">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value={ALL}>All types</SelectItem>
              {accountTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">Currency</Label>
          <Select
            value={filters.currency ?? ALL}
            onValueChange={(value) => onChange({ ...filters, currency: value === ALL ? undefined : value })}
          >
            <SelectTrigger className="w-full" aria-label="Currency filter">
              <SelectValue placeholder="All currencies" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value={ALL}>All currencies</SelectItem>
              <SelectItem value="PHP">PHP</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">IFRS 9 category</Label>
          <Select
            value={filters.ifrs ?? ALL}
            onValueChange={(value) => onChange({ ...filters, ifrs: value === ALL ? undefined : value })}
          >
            <SelectTrigger className="w-full" aria-label="IFRS 9 category filter">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value={ALL}>All categories</SelectItem>
              {ifrsOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">Status</Label>
          <Select
            value={filters.status ?? ALL}
            onValueChange={(value) => onChange({ ...filters, status: value === ALL ? undefined : value })}
          >
            <SelectTrigger className="w-full" aria-label="Status filter">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">Reconciliation</Label>
          <Select
            value={filters.reconciliation ?? ALL}
            onValueChange={(value) => onChange({ ...filters, reconciliation: value === ALL ? undefined : value })}
          >
            <SelectTrigger className="w-full" aria-label="Reconciliation filter">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {RECONCILIATION_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search accounts"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Account no., holder or branch"
            className="pl-9"
          />
        </div>
        {dirty ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              onClear();
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
        ) : null}
      </div>
    </div>
  );
}
