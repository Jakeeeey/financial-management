"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { EMPTY_SLIP_FILTERS, statusLabel } from "../constants";
import type { DepositSlip, SlipFilters } from "../types";
import { DateField } from "./DateField";
import { OptionCombobox } from "./OptionCombobox";

type Props = {
  slips: DepositSlip[];
  filters: SlipFilters;
  onChange: (filters: SlipFilters) => void;
};

/**
 * Filter bar for the deposit-slips tab: bank, status, deposit-date range and free text.
 * Bank options come from the slips themselves so the list never offers an empty result.
 */
export function SlipFiltersBar({ slips, filters, onChange }: Props) {
  const [query, setQuery] = useState(filters.q);

  useEffect(() => {
    if (query === filters.q) return;
    const timer = setTimeout(() => onChange({ ...filters, q: query }), 300);
    return () => clearTimeout(timer);
  }, [query, filters, onChange]);

  const banks = Array.from(new Set(slips.map((slip) => slip.targetBankLabel))).sort();
  const statuses = Array.from(new Set(slips.map((slip) => slip.status))).sort();
  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_SLIP_FILTERS);

  return (
    <div className="border-b border-border/50 px-4 py-3" aria-label="Deposit slip filters">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.6fr)_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="slip-bank" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Bank
          </Label>
          <OptionCombobox
            id="slip-bank"
            options={banks.map((bank) => ({ value: bank, label: bank }))}
            value={filters.bank}
            onChange={(bank) => onChange({ ...filters, bank })}
            placeholder="All banks"
            searchPlaceholder="Search banks"
            emptyLabel="No bank matches that search."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slip-status" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Status
          </Label>
          <Select value={filters.status} onValueChange={(status) => onChange({ ...filters, status })}>
            <SelectTrigger id="slip-status" className="w-full">
              <SelectValue placeholder="Any status" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="ALL">Any status</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slip-from" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Deposit date from
          </Label>
          <DateField
            id="slip-from"
            value={filters.from}
            maxDate={filters.to || undefined}
            onChange={(value) => onChange({ ...filters, from: value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slip-to" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Deposit date to
          </Label>
          <DateField
            id="slip-to"
            value={filters.to}
            minDate={filters.from || undefined}
            onChange={(value) => onChange({ ...filters, to: value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slip-search" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Search
          </Label>
          <Input
            id="slip-search"
            value={query}
            placeholder="Slip no., validation no. or remarks"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

        <div className="flex items-end justify-end gap-2">
          {dirty ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9"
              onClick={() => {
                setQuery("");
                onChange(EMPTY_SLIP_FILTERS);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
