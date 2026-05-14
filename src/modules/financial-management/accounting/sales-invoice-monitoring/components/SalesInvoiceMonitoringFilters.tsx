import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Filter, RefreshCw, Search, X } from "lucide-react";
import type { SalesInvoiceMonitoringFilters } from "../types";
import { getDefaultDateRange } from "../utils";

interface SalesInvoiceMonitoringFiltersBarProps {
  filters: SalesInvoiceMonitoringFilters;
  salesmanOptions: string[];
  isLoading: boolean;
  onFilterChange: (key: keyof SalesInvoiceMonitoringFilters, value: string) => void;
  onApply: () => void;
  onClear: () => void;
  onRefresh: () => void;
}

export function SalesInvoiceMonitoringFiltersBar({
  filters,
  salesmanOptions,
  isLoading,
  onFilterChange,
  onApply,
  onClear,
  onRefresh,
}: SalesInvoiceMonitoringFiltersBarProps) {
  const defaults = getDefaultDateRange();
  const hasDateFilters =
    filters.startDate !== defaults.startDate || filters.endDate !== defaults.endDate;
  const hasSearch = Boolean(filters.search.trim());
  const hasSalesman = Boolean(filters.salesman.trim());

  const salesmanSelectOptions = [
    { value: "__all__", label: "All Salesmen" },
    ...salesmanOptions.map((name) => ({ value: name, label: name })),
  ];

  return (
    <form
      className="rounded-md border border-border bg-card p-3 md:p-4 flex flex-wrap items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        onApply();
      }}
    >
      <div className="min-w-[150px]">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Start Date</label>
        <Input
          type="date"
          value={filters.startDate}
          onChange={(event) => onFilterChange("startDate", event.target.value)}
          className="h-9"
        />
      </div>

      <div className="min-w-[150px]">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">End Date</label>
        <Input
          type="date"
          value={filters.endDate}
          onChange={(event) => onFilterChange("endDate", event.target.value)}
          className="h-9"
        />
      </div>

      <div className="min-w-[220px] flex-1">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Search</label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(event) => onFilterChange("search", event.target.value)}
            placeholder="Invoice, customer, salesman"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="min-w-[200px]">
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Salesman</label>
        <SearchableSelect
          options={salesmanSelectOptions}
          value={filters.salesman || "__all__"}
          onValueChange={(value) => onFilterChange("salesman", value === "__all__" ? "" : value)}
          placeholder="All Salesmen"
          disabled={isLoading}
          className="h-9"
        />
      </div>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" className="h-9" disabled={isLoading}>
          <Filter className="mr-1.5 h-3.5 w-3.5" />
          Apply
        </Button>

        <Button type="button" variant="outline" size="sm" className="h-9" onClick={onRefresh} disabled={isLoading}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
          Refresh
        </Button>

        {(hasDateFilters || hasSearch || hasSalesman) && (
          <Button type="button" variant="ghost" size="sm" className="h-9" onClick={onClear} disabled={isLoading}>
            <X className="mr-1.5 h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
