"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OptionCombobox } from "./OptionCombobox";
import { ACCOUNT_STATUSES, DORMANCY_CLASSES, EMPTY_FILTERS } from "../constants";
import type { DormancyFilter } from "../types";

type Props = {
  filters: DormancyFilter;
  banks: Array<{ value: string; label: string }>;
  onChange: (next: DormancyFilter) => void;
};

/** One band above the scan, matching the other Bank Management V2 toolbars. */
export function DormancyFilters({ filters, banks, onChange }: Props) {
  const dirty = JSON.stringify(filters) !== JSON.stringify(EMPTY_FILTERS);

  return (
    <div
      aria-label="Dormancy filters"
      className="border-b border-border/50 px-4 py-3"
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(220px,1.8fr)]">
        <OptionCombobox
          options={[{ value: "ALL", label: "All banks" }, ...banks]}
          value={filters.bankName ?? "ALL"}
          onChange={(value) => onChange({ ...filters, bankName: value === "ALL" ? null : value })}
          placeholder="Bank"
          searchPlaceholder="Search banks…"
          emptyLabel="No bank matches."
          className="w-full"
        />
        <Select
          value={filters.classification}
          onValueChange={(value) => onChange({ ...filters, classification: value as DormancyFilter["classification"] })}
        >
          <SelectTrigger className="w-full truncate" aria-label="Classification">
            <SelectValue placeholder="Classification" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="ALL">All classifications</SelectItem>
            {DORMANCY_CLASSES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status}
          onValueChange={(value) => onChange({ ...filters, status: value as DormancyFilter["status"] })}
        >
          <SelectTrigger className="w-full truncate" aria-label="Account status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="ALL">All statuses</SelectItem>
            {ACCOUNT_STATUSES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={filters.q}
            onChange={(event) => onChange({ ...filters, q: event.target.value })}
            placeholder="Account no., holder or branch"
            className="pl-9"
            aria-label="Search accounts"
          />
        </div>
      </div>
      {dirty && (
        <div className="mt-2 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onChange({ ...EMPTY_FILTERS })}>
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
