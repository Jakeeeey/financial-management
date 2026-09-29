"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SummaryFilterState,
  DivisionInfo,
  DepartmentOption,
  ChartOfAccountOption,
} from "../types";
import { Search, RotateCcw } from "lucide-react";

interface SummaryFiltersBarProps {
  filters: SummaryFilterState;
  divisions: DivisionInfo[];
  departments?: DepartmentOption[];
  coas: ChartOfAccountOption[];
  onFilterChange: (key: keyof SummaryFilterState, value: string) => void;
  onResetFilters: () => void;
}

export const SummaryFiltersBar: React.FC<SummaryFiltersBarProps> = ({
  filters,
  divisions,
  coas,
  onFilterChange,
  onResetFilters,
}) => {
  return (
    <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 p-3.5 rounded-xl space-y-3 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Search Field */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search doc code, payee, remarks..."
            value={filters.search}
            onChange={(e) => onFilterChange("search", e.target.value)}
            className="pl-9 bg-background border border-border dark:border-zinc-700/80 text-xs"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end lg:self-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={onResetFilters}
            className="h-8 text-xs gap-1.5 bg-background border border-border dark:border-zinc-700/80 hover:bg-muted font-semibold"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
          </Button>
        </div>
      </div>

      {/* Filter Dropdowns Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 pt-1 border-t border-border/60 dark:border-zinc-800">
        {/* Date From */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Date From
          </label>
          <Input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => onFilterChange("dateFrom", e.target.value)}
            className="bg-background border border-border dark:border-zinc-700/80 text-xs h-8"
          />
        </div>

        {/* Date To */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Date To
          </label>
          <Input
            type="date"
            value={filters.dateTo}
            onChange={(e) => onFilterChange("dateTo", e.target.value)}
            className="bg-background border border-border dark:border-zinc-700/80 text-xs h-8"
          />
        </div>

        {/* Status */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Status
          </label>
          <Select
            value={filters.status}
            onValueChange={(val) => onFilterChange("status", val)}
          >
            <SelectTrigger className="bg-background border border-border dark:border-zinc-700/80 text-xs h-8">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Pending Approval">Pending Approval</SelectItem>
              <SelectItem value="Submitted To Disbursement">Submitted To Disbursement</SelectItem>
              <SelectItem value="With Concern">With Concern</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Division */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Division
          </label>
          <Select
            value={filters.divisionId}
            onValueChange={(val) => onFilterChange("divisionId", val)}
          >
            <SelectTrigger className="bg-background border border-border dark:border-zinc-700/80 text-xs h-8">
              <SelectValue placeholder="All Divisions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Divisions</SelectItem>
              {divisions.map((d) => (
                <SelectItem key={d.division_id} value={String(d.division_id)}>
                  {d.division_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Chart of Accounts */}
        <div className="space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Chart of Accounts
          </label>
          <Select
            value={filters.coaId}
            onValueChange={(val) => onFilterChange("coaId", val)}
          >
            <SelectTrigger className="bg-background border border-border dark:border-zinc-700/80 text-xs h-8">
              <SelectValue placeholder="All COAs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All COAs</SelectItem>
              {coas.map((c) => (
                <SelectItem key={c.coa_id} value={String(c.coa_id)}>
                  {c.gl_code ? `${c.gl_code} - ` : ""}{c.account_title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};
