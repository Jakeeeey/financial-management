"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { DateRange } from "../utils/date";

interface LogisticsWerFiltersProps {
  draftRange: DateRange;
  draftSearch: string;
  status: string;
  statusOptions: { value: string; label: string }[];
  onRangeChange: (range: DateRange) => void;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onApply: () => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
}

export function LogisticsWerFilters({
  draftRange,
  draftSearch,
  status,
  statusOptions,
  onRangeChange,
  onSearchChange,
  onStatusChange,
  onApply,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
}: LogisticsWerFiltersProps) {
  return (
    <form
      className="grid w-full min-w-0 gap-3 rounded-xl border bg-card p-3 shadow-sm xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">
          Start date
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={draftRange.startDate}
              onChange={(event) => onRangeChange({ ...draftRange, startDate: event.target.value })}
              className="min-w-0 pl-9"
            />
          </div>
        </label>

        <label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">
          End date
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="date"
              value={draftRange.endDate}
              onChange={(event) => onRangeChange({ ...draftRange, endDate: event.target.value })}
              className="min-w-0 pl-9"
            />
          </div>
        </label>

        <label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">
          Search dispatch plans
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={draftSearch}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Plan no., driver, or vehicle"
              className="min-w-0 pl-9"
            />
          </div>
        </label>

        <label className="min-w-0 space-y-1.5 text-xs font-medium text-muted-foreground">
          Dispatch plan status
          <SearchableSelect
            options={statusOptions}
            value={status}
            onValueChange={onStatusChange}
            placeholder="All statuses"
            className="h-9 min-w-0"
          />
        </label>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 xl:justify-end xl:pb-0.5">
        <Button type="submit" size="sm" className="w-full gap-1.5 sm:w-auto">
          <Search className="size-3.5" />
          Apply
        </Button>
        <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" onClick={onCurrentWeek}>
          Current week
        </Button>
        <div className="flex w-full shrink-0 items-center justify-end gap-1 sm:ml-auto sm:w-auto xl:ml-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={onPreviousWeek}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
            Previous week
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={onNextWeek}
            aria-label="Next week"
          >
            Next week
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </form>
  );
}
