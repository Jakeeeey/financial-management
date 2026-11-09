"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";

import { formatMonth, toneClass } from "../constants";
import { usePager } from "../hooks/usePager";
import { TablePager } from "./TablePager";
import type { IntercompanyMonthlyRow } from "../types";

const PAGE_SIZE = 10;

type Direction = "ALL" | "SALE" | "PURCHASE";

type MonthlyFilter = { month: string; counterparty: string; direction: Direction; q: string };

const EMPTY_FILTER: MonthlyFilter = { month: "ALL", counterparty: "ALL", direction: "ALL", q: "" };

export function MonthlyBreakdown({
  rows,
  isLoading,
  year,
  companyLabel,
}: {
  rows: IntercompanyMonthlyRow[];
  isLoading: boolean;
  year: number;
  companyLabel: string;
}) {
  const [filter, setFilter] = useState<MonthlyFilter>(EMPTY_FILTER);

  const months = useMemo(
    () => Array.from(new Set(rows.map((row) => row.month))).sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const counterparties = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of rows) map.set(row.counterpartyCode, row.counterpartyName);
    return Array.from(map, ([code, name]) => ({ code, name })).sort((a, b) => a.code.localeCompare(b.code));
  }, [rows]);

  const visible = useMemo(() => {
    const needle = filter.q.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter.month !== "ALL" && row.month !== filter.month) return false;
      if (filter.counterparty !== "ALL" && row.counterpartyCode !== filter.counterparty) return false;
      if (filter.direction !== "ALL" && row.direction !== filter.direction) return false;
      if (!needle) return true;
      return (
        row.counterpartyCode.toLowerCase().includes(needle) ||
        row.counterpartyName.toLowerCase().includes(needle)
      );
    });
  }, [rows, filter]);

  const { page, pageCount, pageRows, setPage } = usePager(visible, PAGE_SIZE);
  const dirty = JSON.stringify(filter) !== JSON.stringify(EMPTY_FILTER);

  function patch(next: Partial<MonthlyFilter>) {
    setFilter((current) => ({ ...current, ...next }));
    setPage(1);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Monthly breakdown</h2>
          <p className="text-xs text-muted-foreground">
            {companyLabel} · documents with a group company, bucketed by month of {year}.
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          {visible.length} row{visible.length === 1 ? "" : "s"}
        </Badge>
      </div>

      {rows.length > 0 && (
        <div aria-label="Monthly breakdown filters" className="border-b border-border/50 px-4 py-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Select value={filter.month} onValueChange={(value) => patch({ month: value })}>
              <SelectTrigger aria-label="Month" className="w-full">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">All months</SelectItem>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {formatMonth(month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filter.counterparty} onValueChange={(value) => patch({ counterparty: value })}>
              <SelectTrigger aria-label="Counterparty" className="w-full">
                <SelectValue placeholder="Counterparty" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">All counterparties</SelectItem>
                {counterparties.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} · {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filter.direction} onValueChange={(value) => patch({ direction: value as Direction })}>
              <SelectTrigger aria-label="Direction" className="w-full">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">All directions</SelectItem>
                <SelectItem value="SALE">Sale to</SelectItem>
                <SelectItem value="PURCHASE">Purchase from</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={filter.q}
                onChange={(event) => patch({ q: event.target.value })}
                placeholder="Code or name…"
                aria-label="Search counterparty"
                className="pl-8"
              />
            </div>

            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilter(EMPTY_FILTER);
                  setPage(1);
                }}
              >
                <X aria-hidden className="h-4 w-4" />
                Clear filters
              </Button>
            )}
          </div>
        </div>
      )}

      {isLoading && rows.length === 0 ? (
        <div className="space-y-2 px-4 py-4">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {rows.length === 0
            ? `No invoice or purchase order in ${year} names another group company.`
            : "No row matches these filters."}
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <Table aria-label="Monthly intercompany breakdown">
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Counterparty</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Documents</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Withheld</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((row) => (
                  <TableRow key={`${row.month}-${row.counterpartyCode}-${row.direction}`}>
                    <TableCell className="whitespace-nowrap tabular-nums">{formatMonth(row.month)}</TableCell>
                    <TableCell className="max-w-[16rem]">
                      <span className="block truncate font-medium" title={`${row.counterpartyCode} — ${row.counterpartyName}`}>
                        {row.counterpartyCode}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground" title={row.counterpartyName}>
                        {row.counterpartyName}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[11px]",
                          toneClass(row.direction === "SALE" ? "info" : "neutral"),
                        )}
                      >
                        {row.direction === "SALE" ? "Sale to" : "Purchase from"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.documents}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.vat)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.withheld)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="border-t px-4 py-3">
            <TablePager
              page={page}
              pageCount={pageCount}
              total={visible.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              isLoading={isLoading}
            />
          </div>
        </>
      )}
    </section>
  );
}
