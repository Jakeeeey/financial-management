"use client";

import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import type { ExpectedCollectionFilters, FilterOptions, WeekRange } from "../types";
import { formatReportDate } from "../utils/date";

interface ExpectedCollectionControlsProps {
  range: WeekRange;
  showAllInvoices: boolean;
  filters: ExpectedCollectionFilters;
  filterOptions: FilterOptions;
  loading: boolean;
  hasActiveFilters: boolean;
  onFiltersChange: (filters: ExpectedCollectionFilters) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onCurrentWeek: () => void;
  onShowAllInvoicesChange: (value: boolean) => void;
  onDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClearFilters: () => void;
}

export function ExpectedCollectionControls({
  range,
  showAllInvoices,
  filters,
  filterOptions,
  loading,
  hasActiveFilters,
  onFiltersChange,
  onPreviousWeek,
  onNextWeek,
  onCurrentWeek,
  onShowAllInvoicesChange,
  onDateChange,
  onEndDateChange,
  onClearFilters,
}: ExpectedCollectionControlsProps) {
  return (
    <Card>
      <CardContent className="space-y-4 pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CalendarDays className="size-4 text-muted-foreground" />
            <span>{showAllInvoices ? "All invoice due dates" : `Week of ${formatReportDate(range.startDate)} – ${formatReportDate(range.endDate)}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="expected-collection-all-invoices"
              checked={showAllInvoices}
              onCheckedChange={(value) => onShowAllInvoicesChange(value === true)}
              disabled={loading}
            />
            <Label htmlFor="expected-collection-all-invoices" className="text-sm font-normal">
              Show all invoices
            </Label>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <Button type="button" variant="outline" size="icon" onClick={onPreviousWeek} disabled={loading || showAllInvoices} aria-label="Previous week">
              <ChevronLeft className="size-4" />
            </Button>
            <Button type="button" variant="outline" onClick={onCurrentWeek} disabled={loading}>
              Current week
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onNextWeek} disabled={loading || showAllInvoices} aria-label="Next week">
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
            <Label htmlFor="expected-collection-week">Week starting</Label>
            <Input
              id="expected-collection-week"
              type="date"
              value={range.startDate}
              onChange={(event) => onDateChange(event.target.value)}
              disabled={loading || showAllInvoices}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="expected-collection-week-ending">Week ending</Label>
            <Input
              id="expected-collection-week-ending"
              type="date"
              value={range.endDate}
              onChange={(event) => onEndDateChange(event.target.value)}
              disabled={loading || showAllInvoices}
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
