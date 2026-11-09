"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";
import { PERIOD_KEYS, PERIOD_LABELS } from "../constants";
import type { CertificateRegister, PeriodKey } from "../types";
import { TablePager } from "./TablePager";

const numeric = "text-right tabular-nums";
const PAGE_SIZE = 10;
const PERIOD_FILTERS: PeriodKey[] = [...PERIOD_KEYS, "ANNUAL"];

/**
 * 2307s received against what the invoices say customers withheld.
 *
 * "Expected" is `sales_invoice.ewt_amount`; "on certificates" is what a stored 2307
 * documents. A gap is either a certificate not chased or a wrong amount on one.
 */
export function CertificatePanel({ register }: { register: CertificateRegister }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState("ALL");
  const [incomeType, setIncomeType] = useState("ALL");

  // The input stays instant; the filter list follows the debounced value.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = query.trim();
      if (next === search) return;
      setSearch(next);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const incomeTypes = useMemo(
    () =>
      Array.from(new Set(register.rows.map((row) => row.incomeType))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [register.rows],
  );

  const rows = useMemo(() => {
    const needle = search.toLowerCase();
    return register.rows.filter((row) => {
      if (period !== "ALL" && row.periodKey !== period) return false;
      if (incomeType !== "ALL" && row.incomeType !== incomeType) return false;
      if (!needle) return true;
      return [row.counterpartyName, row.counterpartyTin, row.incomeType, row.sourceRef, row.remarks].some(
        (value) => (value ?? "").toLowerCase().includes(needle),
      );
    });
  }, [register.rows, period, incomeType, search]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visible = rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const dirty = query.trim() !== "" || search !== "" || period !== "ALL" || incomeType !== "ALL";
  const emptyMessage = dirty
    ? "No 2307 matches these filters."
    : "No 2307 received for this company and year.";

  function clearFilters() {
    setQuery("");
    setSearch("");
    setPeriod("ALL");
    setIncomeType("ALL");
    setPage(1);
  }

  return (
    <section aria-label="2307 certificates received" className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm">
      {register.notices.length > 0 && (
        <div className="space-y-2 px-4 pt-4">
          {register.notices.map((notice) => (
            <Alert key={notice}>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      <div className="overflow-x-auto px-4 pt-4">
        <Table aria-label="2307 expected versus on certificates">
          <TableHeader>
            <TableRow>
              <TableHead>Quarter</TableHead>
              <TableHead className={numeric}>Expected (sales-invoice EWT)</TableHead>
              <TableHead className={numeric}>On certificates</TableHead>
              <TableHead className={numeric}>Difference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {register.summary.map((row) => (
              <TableRow key={row.quarter}>
                <TableCell className="font-medium">{row.quarter}</TableCell>
                <TableCell className={numeric}>{formatCurrency(row.expected)}</TableCell>
                <TableCell className={numeric}>{formatCurrency(row.onCertificates)}</TableCell>
                <TableCell className={cn(numeric, row.difference !== 0 && "font-medium")}>
                  {formatCurrency(row.difference)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div aria-label="2307 certificate filters" className="mt-4 border-b border-border/50 px-4 py-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto]">
          <div className="space-y-1.5">
            <Label
              htmlFor="certificate-filter-search"
              className="text-[11px] font-medium text-muted-foreground"
            >
              Search
            </Label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="certificate-filter-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Payee, TIN, income type or reference"
                className="pl-8"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">Period</Label>
            <Select
              value={period}
              onValueChange={(value) => {
                setPeriod(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full" aria-label="Period filter">
                <SelectValue placeholder="All periods" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">All periods</SelectItem>
                {PERIOD_FILTERS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {PERIOD_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-medium text-muted-foreground">Income type</Label>
            <Select
              value={incomeType}
              onValueChange={(value) => {
                setIncomeType(value);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full" aria-label="Income type filter">
                <SelectValue placeholder="All income types" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                <SelectItem value="ALL">All income types</SelectItem>
                {incomeTypes.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            {dirty ? (
              <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 size-3.5" aria-hidden="true" />
                Clear filters
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 hidden overflow-x-auto xl:block">
        <Table aria-label="2307 certificates received">
          <TableHeader>
            <TableRow>
              <TableHead>Received</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Payee</TableHead>
              <TableHead>TIN</TableHead>
              <TableHead>Income type</TableHead>
              <TableHead className={numeric}>Income amount</TableHead>
              <TableHead className={numeric}>Rate</TableHead>
              <TableHead className={numeric}>Tax withheld</TableHead>
              <TableHead>Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="tabular-nums">{row.dateReceived ?? "—"}</TableCell>
                  <TableCell className="max-w-24 truncate" title={row.periodLabel}>
                    {row.periodLabel}
                  </TableCell>
                  <TableCell className="max-w-56 truncate" title={row.counterpartyName}>
                    {row.counterpartyName}
                  </TableCell>
                  <TableCell className="max-w-36 truncate tabular-nums" title={row.counterpartyTin ?? undefined}>
                    {row.counterpartyTin ?? "—"}
                  </TableCell>
                  <TableCell className="max-w-32 truncate" title={row.incomeType}>
                    {row.incomeType}
                  </TableCell>
                  <TableCell className={numeric}>{formatCurrency(row.incomeAmount)}</TableCell>
                  <TableCell className={numeric}>{row.taxRate ? `${row.taxRate}%` : "—"}</TableCell>
                  <TableCell className={numeric}>{formatCurrency(row.taxWithheld)}</TableCell>
                  <TableCell className="max-w-40 truncate" title={row.sourceRef ?? row.remarks ?? undefined}>
                    {row.sourceRef ?? row.remarks ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y xl:hidden">
        {visible.length === 0 ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">{emptyMessage}</li>
        ) : (
          visible.map((row) => (
            <li key={row.id} className="space-y-2 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium" title={row.counterpartyName}>
                    {row.counterpartyName}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground" title={row.incomeType}>
                    {row.periodLabel} · {row.incomeType}
                  </p>
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{row.dateReceived ?? "—"}</span>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Income amount</dt>
                  <dd className="tabular-nums">{formatCurrency(row.incomeAmount)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Tax withheld</dt>
                  <dd className="font-medium tabular-nums">{formatCurrency(row.taxWithheld)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Rate</dt>
                  <dd className="tabular-nums">{row.taxRate ? `${row.taxRate}%` : "—"}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">TIN</dt>
                  <dd className="truncate tabular-nums" title={row.counterpartyTin ?? undefined}>
                    {row.counterpartyTin ?? "—"}
                  </dd>
                </div>
              </dl>
              {(row.sourceRef ?? row.remarks) && (
                <p className="truncate text-[11px] text-muted-foreground" title={row.sourceRef ?? row.remarks ?? undefined}>
                  {row.sourceRef ?? row.remarks}
                </p>
              )}
            </li>
          ))
        )}
      </ul>

      {rows.length > 0 && (
        <div className="border-t px-4 py-3">
          <TablePager
            page={safePage}
            pageCount={pageCount}
            total={rows.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      )}
    </section>
  );
}
