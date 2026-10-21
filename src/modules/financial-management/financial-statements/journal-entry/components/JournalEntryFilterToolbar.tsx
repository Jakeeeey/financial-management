"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown, Filter, RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FilterState, PresetRange } from "../types";

interface JournalEntryFilterToolbarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  isMoreFiltersOpen: boolean;
  statusOptions: string[];
  hasPendingChanges: boolean;
  onToggleMoreFilters: () => void;
  onApply: () => void;
  onReset: () => void;
}

export default function JournalEntryFilterToolbar({
  filters,
  setFilters,
  isMoreFiltersOpen,
  statusOptions,
  hasPendingChanges,
  onToggleMoreFilters,
  onApply,
  onReset,
}: JournalEntryFilterToolbarProps) {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const periodLabel = getPeriodLabel(filters);

  return (
    <section aria-label="Journal entry filters" className="shrink-0 border-b bg-background px-3 py-3 sm:px-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-[minmax(220px,1fr)_minmax(230px,300px)_minmax(150px,190px)_auto]">
        <div className="col-span-2 min-w-0 space-y-1 xl:col-span-1">
          <Label htmlFor="journal-entry-search" className="text-xs font-semibold text-muted-foreground">Search</Label>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="journal-entry-search"
              placeholder="JE no., account, description"
              className="h-9 pl-9"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
            />
          </div>
        </div>

        <div className="min-w-0 space-y-1">
          <Label className="text-xs font-semibold text-muted-foreground">Period</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" aria-label={`Period: ${periodLabel}`} className="h-9 w-full min-w-0 justify-start gap-2 px-2.5 font-normal">
                <CalendarIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{periodLabel}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] space-y-4 p-4">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={filters.presetRange !== "Custom" ? "default" : "outline"}
                  size="sm"
                  className="h-9 text-sm"
                  onClick={() => updateFilter("presetRange", "Monthly")}
                >
                  Preset Range
                </Button>
                <Button
                  type="button"
                  variant={filters.presetRange === "Custom" ? "default" : "outline"}
                  size="sm"
                  className="h-9 text-sm"
                  onClick={() => updateFilter("presetRange", "Custom")}
                >
                  Manual Range
                </Button>
              </div>

              {filters.presetRange === "Custom" ? (
                <div className="grid grid-cols-2 gap-2">
                  <DatePicker
                    label="From date"
                    value={filters.startDate}
                    onChange={(value) => updateFilter("startDate", value)}
                  />
                  <DatePicker
                    label="To date"
                    value={filters.endDate}
                    onChange={(value) => updateFilter("endDate", value)}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Range</Label>
                    <Select value={filters.presetRange} onValueChange={(value) => updateFilter("presetRange", value as PresetRange)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Monthly">Monthly</SelectItem>
                        <SelectItem value="Quarterly">Quarterly</SelectItem>
                        <SelectItem value="Yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {filters.presetRange === "Monthly" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Month</Label>
                        <Select value={filters.selectedMonth.toString()} onValueChange={(value) => updateFilter("selectedMonth", Number(value))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 12 }, (_, month) => (
                              <SelectItem key={month} value={month.toString()}>{format(new Date(2000, month, 1), "MMMM")}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <YearSelect value={filters.selectedYear} onChange={(value) => updateFilter("selectedYear", value)} />
                    </div>
                  )}

                  {filters.presetRange === "Quarterly" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Quarter</Label>
                        <Select value={filters.selectedQuarter.toString()} onValueChange={(value) => updateFilter("selectedQuarter", Number(value))}>
                          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {[1, 2, 3, 4].map((quarter) => (
                              <SelectItem key={quarter} value={quarter.toString()}>Q{quarter}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <YearSelect value={filters.selectedYear} onChange={(value) => updateFilter("selectedYear", value)} />
                    </div>
                  )}

                  {filters.presetRange === "Yearly" && (
                    <YearSelect label="Reporting year" value={filters.selectedYear} onChange={(value) => updateFilter("selectedYear", value)} />
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>
        </div>

        <div className="min-w-0 space-y-1">
          <Label htmlFor="journal-entry-status" className="text-xs font-semibold text-muted-foreground">Status</Label>
          <Select value={filters.status} onValueChange={(value) => updateFilter("status", value)}>
            <SelectTrigger id="journal-entry-status" className="h-9 w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from(new Set(["All Statuses", "Posted", "Unposted", "Dispatched", "For Review", "Approved", "Draft", ...statusOptions])).map((status) => (
                <SelectItem key={status} value={status}>{status}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 xl:col-span-4">
          {hasPendingChanges && (
            <span role="status" className="mr-auto text-xs font-medium text-amber-700 dark:text-amber-400">
              Filter changes are waiting for Apply.
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            className="h-9"
            aria-expanded={isMoreFiltersOpen}
            aria-controls="journal-entry-advanced-filters"
            onClick={onToggleMoreFilters}
          >
            <Filter aria-hidden="true" className="mr-2 h-4 w-4" />
            {isMoreFiltersOpen ? "Hide filters" : "More filters"}
            <ChevronDown aria-hidden="true" className={`ml-2 h-4 w-4 transition-transform ${isMoreFiltersOpen ? "rotate-180" : ""}`} />
          </Button>
          <Button type="button" variant="outline" className="h-9" onClick={onReset}>
            <RotateCcw aria-hidden="true" className="mr-2 h-3.5 w-3.5" />
            Clear all
          </Button>
          <Button type="button" className="h-9" onClick={onApply} disabled={!hasPendingChanges}>
            Apply filters
          </Button>
        </div>
      </div>
    </section>
  );
}

function YearSelect({
  label = "Year",
  value,
  onChange,
}: {
  label?: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value.toString()} onValueChange={(nextValue) => onChange(Number(nextValue))}>
        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
        <SelectContent>
          {[2024, 2025, 2026, 2027].map((year) => (
            <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DatePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const selectedDate = value ? new Date(value) : undefined;

  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="h-9 w-full justify-start px-2 text-left font-normal">
            <CalendarIcon aria-hidden="true" className="mr-2 h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{selectedDate ? format(selectedDate, "PP") : label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && onChange(date.toISOString())}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function getPeriodLabel(filters: FilterState) {
  if (filters.presetRange === "Custom") {
    const start = filters.startDate ? format(new Date(filters.startDate), "MMM d, yyyy") : "Start date";
    const end = filters.endDate ? format(new Date(filters.endDate), "MMM d, yyyy") : "End date";
    return `${start} – ${end}`;
  }

  if (filters.presetRange === "Monthly") {
    return format(new Date(filters.selectedYear, filters.selectedMonth, 1), "MMMM yyyy");
  }

  if (filters.presetRange === "Quarterly") {
    return `Q${filters.selectedQuarter} ${filters.selectedYear}`;
  }

  return filters.selectedYear.toString();
}
