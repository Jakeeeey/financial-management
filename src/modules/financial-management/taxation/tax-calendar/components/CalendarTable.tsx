"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

import { DateField } from "./DateField";
import { OptionCombobox } from "./OptionCombobox";
import { TablePager } from "./TablePager";
import { CALENDAR_CATEGORIES, CALENDAR_STATUSES, toneClass, statusTone } from "../constants";
import type { CalendarFilter, CalendarObligation, CalendarStatus } from "../types";

const COLUMNS = 8;

const STATUS_LABEL: Record<CalendarStatus, string> = {
  PAID: "Recorded as paid",
  DUE: "Due",
  OVERDUE: "Overdue",
  UNKNOWN: "Unknown",
};

const CATEGORY_LABEL: Record<string, string> = {
  INCOME: "Income tax",
  VAT: "VAT",
  WITHHOLDING: "Withholding",
  OTHER: "Other",
};

export function CalendarTable({
  rows,
  total,
  companies,
  filters,
  isLoading,
  page,
  pageCount,
  pageSize,
  today,
  onFiltersChange,
  onPageChange,
}: {
  rows: CalendarObligation[];
  total: number;
  companies: Array<{ companyId: number; name: string; code: string }>;
  filters: CalendarFilter;
  isLoading: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  today: string;
  onFiltersChange: (patch: Partial<CalendarFilter>) => void;
  onPageChange: (page: number) => void;
}) {
  const companyOptions = [
    { value: "ALL", label: "Every company" },
    ...companies.map((company) => ({
      value: String(company.companyId),
      label: company.name,
      searchText: `${company.code} ${company.name}`,
    })),
  ];

  const dirty =
    filters.companyId !== null || filters.category !== "ALL" || filters.status !== "ALL" || filters.from !== "" || filters.to !== "";

  return (
    <section
      aria-label="Tax calendar"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-sky-500/70 bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Filing calendar</h2>
        </div>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          {formatNumber(total)} filings
        </Badge>
      </header>

      <div className="border-b border-border/50 px-4 py-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <OptionCombobox
            options={companyOptions}
            value={filters.companyId === null ? "ALL" : String(filters.companyId)}
            onChange={(value) => onFiltersChange({ companyId: value === "ALL" ? null : Number(value) })}
            placeholder="Every company"
            searchPlaceholder="Search companies…"
            emptyLabel="No company matches."
          />
          <Select value={filters.category} onValueChange={(value) => onFiltersChange({ category: value })}>
            <SelectTrigger aria-label="Category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {CALENDAR_CATEGORIES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(value) => onFiltersChange({ status: value })}>
            <SelectTrigger aria-label="Status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {CALENDAR_STATUSES.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateField
            value={filters.from}
            onChange={(value) => onFiltersChange({ from: value })}
            placeholder="Due from"
            aria-label="Due from"
            maxDate={filters.to || undefined}
          />
          <DateField
            value={filters.to}
            onChange={(value) => onFiltersChange({ to: value })}
            placeholder="Due to"
            aria-label="Due to"
            minDate={filters.from || undefined}
          />
          <Button
            variant="ghost"
            size="sm"
            className="justify-self-start xl:justify-self-end"
            disabled={!dirty}
            onClick={() => onFiltersChange({ companyId: null, category: "ALL", status: "ALL", from: "", to: "" })}
          >
            Clear filters
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">Due date</TableHead>
              <TableHead className="w-[180px]">Company</TableHead>
              <TableHead className="w-[100px]">Form</TableHead>
              <TableHead className="w-[130px]">Period</TableHead>
              <TableHead className="w-[120px]">Category</TableHead>
              <TableHead className="w-[150px] text-right">Estimate</TableHead>
              <TableHead className="w-[150px]">Status</TableHead>
              <TableHead className="w-[260px]">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell colSpan={COLUMNS}>
                    <div className="h-8 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS} className="h-24 text-center text-sm text-muted-foreground">
                  No filing matches these filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="tabular-nums">
                    <span className="block" title={row.dueDate}>
                      {row.dueDate === today ? `${row.dueDate} · today` : row.dueDate}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="block max-w-[170px] truncate" title={row.companyName}>
                      {row.companyName}
                    </span>
                    <span className="block text-xs text-muted-foreground">{row.companyCode}</span>
                  </TableCell>
                  <TableCell className="font-medium">{row.formCode}</TableCell>
                  <TableCell>
                    <span className="block max-w-[120px] truncate" title={row.periodLabel}>
                      {row.periodLabel}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {CATEGORY_LABEL[row.category] ?? row.category}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.estimated === null ? <span className="text-muted-foreground">—</span> : formatCurrency(row.estimated)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[11px] ${toneClass(statusTone(row.status))}`}>
                      {STATUS_LABEL[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="block max-w-[250px] truncate" title={row.note ?? undefined}>
                      {row.note ?? "—"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePager
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        onPageChange={onPageChange}
        isLoading={isLoading}
        className="border-t border-border/50 px-4 py-3"
      />
    </section>
  );
}
