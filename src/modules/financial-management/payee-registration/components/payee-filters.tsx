"use client";

import * as React from "react";
import { Filter, Search, X } from "lucide-react";

import { SearchableSelect } from "@/components/ui/searchable-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Payee } from "../types/payee.schema";

export type PayeeStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

export interface PayeeFilterState {
  search: string;
  payeeId: string;
  status: PayeeStatusFilter;
}

interface PayeeFiltersProps {
  filters: PayeeFilterState;
  payees: Payee[];
  onFiltersChange: (filters: PayeeFilterState) => void;
  onReset: () => void;
}

export function PayeeFilters({
  filters,
  payees,
  onFiltersChange,
  onReset,
}: PayeeFiltersProps) {
  const payeeOptions = React.useMemo(
    () => [
      { value: "", label: "All Payees" },
      ...payees
        .filter((payee) => payee.id != null && payee.supplier_name?.trim())
        .sort((left, right) =>
          left.supplier_name.localeCompare(right.supplier_name),
        )
        .map((payee) => ({
          value: String(payee.id),
          label: payee.supplier_name,
        })),
    ],
    [payees],
  );

  const hasActiveFilters = Boolean(
    filters.search || filters.payeeId || filters.status !== "ALL",
  );

  return (
    <section className="space-y-4 rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Filter className="h-4 w-4 text-muted-foreground" />
          Search & Filters
        </div>
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
          >
            Reset filters
            <X className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor="payee-search" className="text-sm font-medium">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="payee-search"
              type="search"
              value={filters.search}
              onChange={(event) =>
                onFiltersChange({ ...filters, search: event.target.value })
              }
              placeholder="Contact, TIN, email, phone, or bank details..."
              className="pl-9 pr-9"
            />
            {filters.search && (
              <button
                type="button"
                aria-label="Clear payee search"
                onClick={() => onFiltersChange({ ...filters, search: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Payee Name</label>
          <SearchableSelect
            options={payeeOptions}
            value={filters.payeeId}
            onValueChange={(payeeId) =>
              onFiltersChange({ ...filters, payeeId })
            }
            placeholder="All Payees"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select
            value={filters.status}
            onValueChange={(status) =>
              onFiltersChange({
                ...filters,
                status: status as PayeeStatusFilter,
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="INACTIVE">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  );
}
