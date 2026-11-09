"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { EMPTY_UNDEPOSITED_FILTERS } from "../constants";
import { DateField } from "./DateField";
import type { UndepositedFilters } from "../types";

type Props = {
  filters: UndepositedFilters;
  onChange: (filters: UndepositedFilters) => void;
};

const TYPE_OPTIONS = [
  { value: "ALL", label: "All types" },
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Check" },
];

const CAN_DEPOSIT_OPTIONS = [
  { value: "ALL", label: "Any" },
  { value: "READY", label: "Ready to deposit" },
  { value: "PDC", label: "Post-dated, not yet" },
];

/** Filter bar from the prototype's 1.3 tab; enums are fixed, only search is free text. */
export function UndepositedFiltersBar({ filters, onChange }: Props) {
  const [query, setQuery] = useState(filters.q);

  useEffect(() => {
    if (query === filters.q) return;
    const timer = setTimeout(() => onChange({ ...filters, q: query }), 300);
    return () => clearTimeout(timer);
  }, [query, filters, onChange]);

  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_UNDEPOSITED_FILTERS);

  return (
    <div className="border-b border-border/50 px-4 py-3" aria-label="Undeposited collection filters">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.6fr)_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="undep-type" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Type
          </Label>
          <Select value={filters.type} onValueChange={(value) => onChange({ ...filters, type: value as UndepositedFilters["type"] })}>
            <SelectTrigger id="undep-type" className="w-full">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="undep-can-deposit" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Can deposit
          </Label>
          <Select
            value={filters.canDeposit}
            onValueChange={(value) => onChange({ ...filters, canDeposit: value as UndepositedFilters["canDeposit"] })}
          >
            <SelectTrigger id="undep-can-deposit" className="w-full">
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {CAN_DEPOSIT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="undep-from" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Collected from
          </Label>
          <DateField
            id="undep-from"
            value={filters.from}
            maxDate={filters.to || undefined}
            onChange={(value) => onChange({ ...filters, from: value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="undep-to" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Collected to
          </Label>
          <DateField
            id="undep-to"
            value={filters.to}
            minDate={filters.from || undefined}
            onChange={(value) => onChange({ ...filters, to: value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="undep-search" className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Search
          </Label>
          <Input
            id="undep-search"
            value={query}
            placeholder="OR / check no., customer or collection ref."
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
                onChange(EMPTY_UNDEPOSITED_FILTERS);
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
