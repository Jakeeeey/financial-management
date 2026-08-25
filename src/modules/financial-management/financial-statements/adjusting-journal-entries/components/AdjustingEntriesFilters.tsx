"use client";

import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { LookupOption } from "../types";
import { AjeSearchableSelect } from "./AjeSearchableSelect";

type AdjustingEntriesFiltersProps = {
  search: string;
  startDate: string;
  endDate: string;
  status: string;
  pageSize: number;
  filterDivisionId: string;
  filterDepartmentId: string;
  statusOptions: string[];
  pageSizes: number[];
  filterDivisionOptions: LookupOption[];
  filterDepartmentOptions: LookupOption[];
  hasActiveFilters: boolean;
  onSearchChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onPageSizeChange: (value: number) => void;
  onDivisionChange: (value: string) => void;
  onDepartmentChange: (value: string) => void;
  onClearFilters: () => void;
};

export function AdjustingEntriesFilters({
  search,
  startDate,
  endDate,
  status,
  pageSize,
  filterDivisionId,
  filterDepartmentId,
  statusOptions,
  pageSizes,
  filterDivisionOptions,
  filterDepartmentOptions,
  hasActiveFilters,
  onSearchChange,
  onStartDateChange,
  onEndDateChange,
  onStatusChange,
  onPageSizeChange,
  onDivisionChange,
  onDepartmentChange,
  onClearFilters,
}: AdjustingEntriesFiltersProps) {
  return (
    <div className="grid gap-3 rounded-md border bg-background p-3 shadow-sm lg:grid-cols-12">
      <div className="space-y-1.5 lg:col-span-4">
        <Label htmlFor="aje-search-filter" className="text-xs font-medium text-muted-foreground">Search</Label>
        <div className="relative min-w-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="aje-search-filter"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="JE no, description, or creator"
            className="pl-9"
          />
        </div>
      </div>
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="aje-start-date-filter" className="text-xs font-medium text-muted-foreground">Start Date</Label>
        <Input
          id="aje-start-date-filter"
          type="date"
          value={startDate}
          onChange={(event) => onStartDateChange(event.target.value)}
          aria-label="Start date"
        />
      </div>
      <div className="space-y-1.5 lg:col-span-2">
        <Label htmlFor="aje-end-date-filter" className="text-xs font-medium text-muted-foreground">End Date</Label>
        <Input
          id="aje-end-date-filter"
          type="date"
          value={endDate}
          onChange={(event) => onEndDateChange(event.target.value)}
          aria-label="End date"
        />
      </div>
      <div className="space-y-1.5 lg:col-span-2">
        <Label className="text-xs font-medium text-muted-foreground">Status</Label>
        <Select value={status} onValueChange={onStatusChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 lg:col-span-2">
        <Label className="text-xs font-medium text-muted-foreground">Rows Per Page</Label>
        <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value))}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Rows" />
          </SelectTrigger>
          <SelectContent>
            {pageSizes.map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size} rows
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 lg:col-span-3">
        <Label className="text-xs font-medium text-muted-foreground">Division</Label>
        <AjeSearchableSelect
          options={filterDivisionOptions}
          value={filterDivisionId}
          onValueChange={onDivisionChange}
          placeholder="All divisions"
        />
      </div>
      <div className="space-y-1.5 lg:col-span-3">
        <Label className="text-xs font-medium text-muted-foreground">Department</Label>
        <AjeSearchableSelect
          options={filterDepartmentOptions}
          value={filterDepartmentId}
          onValueChange={onDepartmentChange}
          placeholder="All departments"
        />
      </div>
      <div className="flex items-end lg:col-span-2">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
        >
          <X className="mr-2 size-4" />
          Clear Filters
        </Button>
      </div>
    </div>
  );
}
