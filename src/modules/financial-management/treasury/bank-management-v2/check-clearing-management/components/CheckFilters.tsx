"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { statusLabel } from "../constants";
import { DateField } from "./DateField";
import { OptionCombobox } from "./OptionCombobox";
import type { RegisterFilters } from "../providers/checksApi";

const STATUS_FILTERS = ["ALL", "PENDING", "RECEIVED", "IN_CLEARING", "CLEARED", "RETURNED", "CANCELLED"] as const;

const FLAG_FILTERS = [
  { value: "ALL", label: "Any" },
  { value: "PDC", label: "Post-dated (PDC)" },
  { value: "STALE", label: "Stale (over 180 days)" },
  { value: "NOREPL", label: "Returned/cancelled, not yet replaced" },
  { value: "REPL", label: "Part of a replacement" },
] as const;

const EMPTY: RegisterFilters = {
  direction: "ALL",
  status: "ALL",
  accountId: undefined,
  bank: undefined,
  flag: undefined,
  from: undefined,
  to: undefined,
  q: undefined,
};

type Props = {
  accountOptions: { value: string; label: string }[];
  bankOptions: { value: string; label: string }[];
  filters: RegisterFilters;
  onChange: (next: RegisterFilters) => void;
};

/** Filter band for the check register, in the same shape as the other v2 modules. */
export function CheckFilters({ accountOptions, bankOptions, filters, onChange }: Props) {
  const [query, setQuery] = useState(filters.q ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = query.trim();
      if ((filters.q ?? "") !== next) onChange({ ...filters, q: next || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [query, filters, onChange]);

  const dirty =
    query.trim() !== "" ||
    (filters.direction ?? "ALL") !== "ALL" ||
    (filters.status ?? "ALL") !== "ALL" ||
    (filters.flag ?? "ALL") !== "ALL" ||
    filters.accountId !== undefined ||
    filters.bank !== undefined ||
    filters.from !== undefined ||
    filters.to !== undefined;

  return (
    <div aria-label="Check register filters" className="border-b border-border/50 px-4 py-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.85fr)]">
        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">Bank</Label>
          <OptionCombobox
            options={bankOptions}
            value={filters.bank ?? "ALL"}
            onChange={(value) => onChange({ ...filters, bank: value === "ALL" ? undefined : value, accountId: undefined })}
            placeholder="All banks"
            searchPlaceholder="Search banks"
            emptyLabel="No bank matches that search."
            aria-label="Bank filter"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">Account</Label>
          <OptionCombobox
            options={accountOptions}
            value={filters.accountId ? String(filters.accountId) : "ALL"}
            onChange={(value) => onChange({ ...filters, accountId: value === "ALL" ? undefined : Number(value) })}
            placeholder="All accounts"
            searchPlaceholder="Search accounts"
            emptyLabel="No account matches that search."
            aria-label="Account filter"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">Direction</Label>
          <Select
            value={filters.direction ?? "ALL"}
            onValueChange={(value) => onChange({ ...filters, direction: value })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All directions" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="ALL">All directions</SelectItem>
              <SelectItem value="ISSUED">Issued</SelectItem>
              <SelectItem value="RECEIVED">Received</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">Status</Label>
          <Select value={filters.status ?? "ALL"} onValueChange={(value) => onChange({ ...filters, status: value })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {STATUS_FILTERS.map((status) => (
                <SelectItem key={status} value={status}>
                  {status === "ALL" ? "All statuses" : statusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[11px] font-medium text-muted-foreground">Flag</Label>
          <Select value={filters.flag ?? "ALL"} onValueChange={(value) => onChange({ ...filters, flag: value })}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {FLAG_FILTERS.map((flag) => (
                <SelectItem key={flag.value} value={flag.value}>
                  {flag.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="check-from" className="text-[11px] font-medium text-muted-foreground">
            Check date from
          </Label>
          <DateField
            id="check-from"
            value={filters.from ?? ""}
            maxDate={filters.to}
            onChange={(value) => onChange({ ...filters, from: value || undefined })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="check-to" className="text-[11px] font-medium text-muted-foreground">
            Check date to
          </Label>
          <DateField
            id="check-to"
            value={filters.to ?? ""}
            minDate={filters.from}
            onChange={(value) => onChange({ ...filters, to: value || undefined })}
          />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="check-search"
            aria-label="Search checks"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Check no., payee, customer or reason"
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
              onChange({ ...EMPTY });
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
