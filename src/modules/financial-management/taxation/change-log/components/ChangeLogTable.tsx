"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/utils";

import { ChangeLogDetailDialog } from "./ChangeLogDetailDialog";
import { DateField } from "./DateField";
import { OptionCombobox } from "./OptionCombobox";
import { TablePager } from "./TablePager";
import { CHANGE_LOG_ENTITIES, entityLabel } from "../constants";
import { phtDisplayStamp } from "../pht";
import type { ChangeLogFilter, ChangeLogRow } from "../types";

const COLUMNS = 8;

function display(value: string | null): string {
  return value && value.trim() ? value : "â€”";
}

/** Stored stamps arrive as raw ISO; the column is labelled PHT, so it prints PHT. */
function displayStamp(value: string | null): string {
  return value && value.trim() ? phtDisplayStamp(value) : "â€”";
}

export function ChangeLogTable({
  rows,
  total,
  companies,
  filters,
  isLoading,
  page,
  pageCount,
  pageSize,
  onFiltersChange,
  onPageChange,
}: {
  rows: ChangeLogRow[];
  total: number;
  companies: Array<{ companyId: number; name: string; code: string }>;
  filters: ChangeLogFilter;
  isLoading: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  onFiltersChange: (patch: Partial<ChangeLogFilter>) => void;
  onPageChange: (page: number) => void;
}) {
  const [openRow, setOpenRow] = useState<ChangeLogRow | null>(null);

  const dirty =
    filters.companyId !== null ||
    filters.entity !== "ALL" ||
    filters.q !== "" ||
    filters.from !== "" ||
    filters.to !== "";

  // The API recomputes `total` under the filters, so `total` alone cannot tell an empty year
  // from a search that matched nothing; the active filters can.
  const emptyLabel = dirty ? "No entry matches these filters." : "No change has been recorded for this year yet.";

  const companyOptions = [
    { value: "ALL", label: "All companies" },
    ...companies.map((company) => ({
      value: String(company.companyId),
      label: company.name,
      searchText: `${company.code} ${company.name}`,
    })),
  ];

  return (
    <section
      aria-label="Taxation change log"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-slate-500/70 bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Recorded edits</h2>
          <p className="text-xs text-muted-foreground">
            Every recorded edit, newest first.
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          {formatNumber(total)} entries
        </Badge>
      </header>

      <div className="border-b border-border/50 px-4 py-3">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(200px,1.8fr)]">
          <OptionCombobox
            options={companyOptions}
            value={filters.companyId === null ? "ALL" : String(filters.companyId)}
            onChange={(value) => onFiltersChange({ companyId: value === "ALL" ? null : Number(value) })}
            placeholder="All companies"
            searchPlaceholder="Search companiesâ€¦"
            emptyLabel="No company matches."
          />
          <Select
            value={filters.entity}
            onValueChange={(value) => onFiltersChange({ entity: value })}
          >
            <SelectTrigger aria-label="Entity">
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="ALL">All entities</SelectItem>
              {CHANGE_LOG_ENTITIES.map((entity) => (
                <SelectItem key={entity} value={entity}>
                  {entityLabel(entity)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateField
            value={filters.from}
            onChange={(value) => onFiltersChange({ from: value, to: filters.to && value > filters.to ? "" : filters.to })}
            maxDate={filters.to || undefined}
            placeholder="From date"
            aria-label="From date"
          />
          <DateField
            value={filters.to}
            onChange={(value) => onFiltersChange({ to: value })}
            minDate={filters.from || undefined}
            placeholder="To date"
            aria-label="To date"
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.q}
              onChange={(event) => onFiltersChange({ q: event.target.value })}
              placeholder="Reference, reason or value"
              className="pl-9"
              aria-label="Search the change log"
            />
          </div>
        </div>
        {dirty && (
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onFiltersChange({ companyId: null, entity: "ALL", q: "", from: "", to: "" })}
            >
              Clear filters
            </Button>
          </div>
        )}
      </div>

      <div className="hidden overflow-x-auto xl:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">When (PHT)</TableHead>
              <TableHead className="w-[120px]">Company</TableHead>
              <TableHead className="w-[100px]">Entity</TableHead>
              <TableHead className="w-[110px]">Reference</TableHead>
              <TableHead className="w-[90px]">Field</TableHead>
              <TableHead className="w-[150px]">Before â†’ after</TableHead>
              <TableHead className="w-[90px]">Actor</TableHead>
              <TableHead className="w-[140px]">Reason</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell colSpan={COLUMNS}>
                    <div className="h-8 animate-pulse rounded bg-muted" />
                  </TableCell>
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMNS} className="h-24 text-center text-sm text-muted-foreground">
                  {emptyLabel}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const company = companies.find((entry) => entry.companyId === row.companyId);
                return (
                  <TableRow
                    key={row.id}
                    tabIndex={0}
                    aria-label={`Open change ${row.field ?? row.entity}`}
                    className="cursor-pointer"
                    onClick={() => setOpenRow(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setOpenRow(row);
                      }
                    }}
                  >
                    <TableCell className="tabular-nums text-xs">
                      <span className="block truncate" title={row.occurredAt ?? undefined}>
                        {displayStamp(row.occurredAt)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-[110px] truncate" title={company?.name ?? undefined}>
                        {company?.name ?? (row.companyId ? `Company ${row.companyId}` : "â€”")}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[11px]">
                        {entityLabel(row.entity)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-[100px] truncate" title={row.entityRef ?? undefined}>
                        {display(row.entityRef)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-[80px] truncate" title={row.field ?? undefined}>
                        {display(row.field)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div
                        className="line-clamp-2 max-w-[140px] break-words"
                        title={`${row.beforeValue ?? ""} â†’ ${row.afterValue ?? ""}`}
                      >
                        {display(row.beforeValue)} â†’ {display(row.afterValue)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-[80px] truncate" title={row.actor ?? undefined}>
                        {display(row.actor)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-[130px] truncate" title={row.reason ?? undefined}>
                        {display(row.reason)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-border/50 xl:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <li key={`skeleton-card-${index}`} className="px-4 py-3">
              <div className="h-10 animate-pulse rounded bg-muted" />
            </li>
          ))
        ) : rows.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">
            {emptyLabel}
          </li>
        ) : (
          rows.map((row) => {
            const company = companies.find((entry) => entry.companyId === row.companyId);
            return (
              <li
                key={`card-${row.id}`}
                tabIndex={0}
                aria-label={`Open change ${row.field ?? row.entity}`}
                className="cursor-pointer space-y-1 px-4 py-3"
                onClick={() => setOpenRow(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setOpenRow(row);
                  }
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium" title={company?.name ?? undefined}>
                    {company?.name ?? (row.companyId ? `Company ${row.companyId}` : "â€”")}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {displayStamp(row.occurredAt)}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground" title={row.reason ?? undefined}>
                  {entityLabel(row.entity)}
                  {row.field ? ` Â· ${row.field}` : ""} Â· {display(row.actor)}
                </p>
                <p className="truncate text-xs" title={`${row.beforeValue ?? ""} â†’ ${row.afterValue ?? ""}`}>
                  {display(row.beforeValue)} â†’ {display(row.afterValue)}
                </p>
              </li>
            );
          })
        )}
      </ul>

      <ChangeLogDetailDialog
        row={openRow}
        companyName={
          openRow ? companies.find((entry) => entry.companyId === openRow.companyId)?.name ?? null : null
        }
        onOpenChange={(open) => {
          if (!open) setOpenRow(null);
        }}
      />

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


