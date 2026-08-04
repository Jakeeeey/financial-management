"use client";

import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DateRange, ExpectedCollectionFilters, FilterOptions, ReportPeriod } from "../types";
import { formatPeriodRange, periodLabel } from "../utils/date";

const PERIOD_OPTIONS: Array<{ value: ReportPeriod; label: string }> = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

interface ExpectedCollectionControlsProps {
  range: DateRange;
  period: ReportPeriod;
  filters: ExpectedCollectionFilters;
  filterOptions: FilterOptions;
  loading: boolean;
  hasActiveFilters: boolean;
  onFiltersChange: (filters: ExpectedCollectionFilters) => void;
  onPreviousPeriod: () => void;
  onNextPeriod: () => void;
  onCurrentPeriod: () => void;
  onPeriodChange: (value: ReportPeriod) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClearFilters: () => void;
}

export function ExpectedCollectionControls({
  range,
  period,
  filters,
  filterOptions,
  loading,
  hasActiveFilters,
  onFiltersChange,
  onPreviousPeriod,
  onNextPeriod,
  onCurrentPeriod,
  onPeriodChange,
  onStartDateChange,
  onEndDateChange,
  onClearFilters,
}: ExpectedCollectionControlsProps) {
  const selectedPeriodLabel = periodLabel(period);

  return (
    <Card>
      <CardContent className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span>{formatPeriodRange(period, range)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="expected-collection-period" className="text-sm font-normal">Period</Label>
            <Select
              value={period}
              onValueChange={(value) => onPeriodChange(value as ReportPeriod)}
              disabled={loading}
            >
              <SelectTrigger id="expected-collection-period" className="w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onPreviousPeriod}
              disabled={loading}
              aria-label={`Previous ${selectedPeriodLabel}`}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button type="button" variant="outline" onClick={onCurrentPeriod} disabled={loading}>
              Current {selectedPeriodLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={onNextPeriod}
              disabled={loading}
              aria-label={`Next ${selectedPeriodLabel}`}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5">
            <Label htmlFor="expected-collection-invoice">Invoice Number</Label>
            <Input
              id="expected-collection-invoice"
              value={filters.invoiceNo}
              onChange={(event) => onFiltersChange({ ...filters, invoiceNo: event.target.value })}
              placeholder="Search invoice number"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expected-collection-customer">Customer Name</Label>
            <Input
              id="expected-collection-customer"
              value={filters.customerName}
              onChange={(event) => onFiltersChange({ ...filters, customerName: event.target.value })}
              placeholder="Search customer or code"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Salesman</Label>
            <SearchableSelect
              options={[
                { value: "", label: "All salesmen" },
                ...filterOptions.salesmen.map((salesman) => ({ value: salesman, label: salesman })),
              ]}
              value={filters.salesman}
              onValueChange={(value) => onFiltersChange({ ...filters, salesman: value })}
              placeholder="All salesmen"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Division</Label>
            <SearchableSelect
              options={[
                { value: "", label: "All divisions" },
                ...filterOptions.divisions.map((division) => ({ value: division, label: division })),
              ]}
              value={filters.division}
              onValueChange={(value) => onFiltersChange({ ...filters, division: value })}
              placeholder="All divisions"
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expected-collection-start-date">Start date</Label>
            <Input
              id="expected-collection-start-date"
              type="date"
              value={range.startDate}
              onChange={(event) => onStartDateChange(event.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expected-collection-end-date">End date</Label>
            <Input
              id="expected-collection-end-date"
              type="date"
              value={range.endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        {hasActiveFilters && (
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters} disabled={loading}>
            <RotateCcw className="mr-2 size-4" />
            Clear filters
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
