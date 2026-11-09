"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { CARRYOVER_KIND_LABELS, PAGE_SIZE } from "../constants";
import type { CarryoverLot } from "../types";
import { TablePager } from "./TablePager";

const COLUMNS = 7;

function kindLabel(lot: CarryoverLot) {
  return CARRYOVER_KIND_LABELS[lot.kind] ?? lot.kind;
}

function expiry(lot: CarryoverLot) {
  return lot.expiresAfterYear === null ? "No expiry" : `After ${lot.expiresAfterYear}`;
}

/**
 * Credit and loss lots usable in the selected year.
 *
 * When the table does not exist yet this shows the reason instead of an empty table:
 * "no carryovers" and "cannot read carryovers" mean different things to a preparer.
 */
export function CarryoverTable({
  lots,
  notice,
  year,
}: {
  lots: CarryoverLot[];
  notice: string | null;
  year: number;
}) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("ALL");
  const [page, setPage] = useState(1);

  const kinds = useMemo(() => Array.from(new Set(lots.map((lot) => lot.kind))), [lots]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return lots.filter((lot) => {
      if (kind !== "ALL" && lot.kind !== kind) return false;
      if (!needle) return true;
      return `${lot.companyCode} ${lot.companyName}`.toLowerCase().includes(needle);
    });
  }, [lots, q, kind]);

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);
  const remaining = filtered.reduce((sum, lot) => sum + lot.remaining, 0);
  const dirty = q !== "" || kind !== "ALL";

  return (
    <section className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-primary/40 bg-card shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Carryover lots</h2>
          <p className="text-[11px] text-muted-foreground">
            Loss and credit lots still usable in {year}, with the year they expire after.
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          {total} {total === 1 ? "lot" : "lots"}
        </Badge>
      </header>

      {notice ? (
        <p className="border-t px-4 py-6 text-sm text-muted-foreground">{notice}</p>
      ) : (
        <>
          {lots.length > 0 && (
            <div aria-label="Carryover filters" className="border-b border-border/50 px-4 py-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
                <div className="relative">
                  <Search
                    aria-hidden
                    className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  />
                  <Input
                    value={q}
                    onChange={(event) => {
                      setQ(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Company name or code…"
                    aria-label="Search company"
                    className="pl-8"
                  />
                </div>

                <Select
                  value={kind}
                  onValueChange={(value) => {
                    setKind(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger aria-label="Kind" className="w-full">
                    <SelectValue placeholder="Kind" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="ALL">All kinds</SelectItem>
                    {kinds.map((value) => (
                      <SelectItem key={value} value={value}>
                        {CARRYOVER_KIND_LABELS[value] ?? value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {dirty && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setQ("");
                      setKind("ALL");
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

          {total > 0 && (
            <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
              <span className="text-xs text-muted-foreground">Remaining across these lots</span>
              <span className="text-xs font-medium tabular-nums">{formatCurrency(remaining)}</span>
            </div>
          )}

          <div className="hidden overflow-x-auto xl:block">
            <table aria-label={`Carryover lots usable in ${year}`} className="w-full min-w-[820px] border-collapse text-sm">
              <caption className="sr-only">Carryover lots with their origin year, amount used and remaining balance</caption>
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-semibold">Company</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Kind</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Origin year</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Amount</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Used</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Remaining</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Expires</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((lot) => (
                  <tr key={lot.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="max-w-[240px] px-4 py-2.5">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate font-medium" title={`${lot.companyCode} ${lot.companyName}`}>
                          {lot.companyName}
                        </span>
                        <span className="font-mono text-[11px] text-muted-foreground">{lot.companyCode}</span>
                      </div>
                    </td>
                    <td className="max-w-[160px] px-4 py-2.5">
                      <span className="block truncate" title={kindLabel(lot)}>
                        {kindLabel(lot)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums">{lot.originYear}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(lot.amount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrency(lot.used)}</td>
                    <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatCurrency(lot.remaining)}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{expiry(lot)}</td>
                  </tr>
                ))}
                {total === 0 && (
                  <tr>
                    <td colSpan={COLUMNS} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      {lots.length === 0
                        ? `No carryover lot is recorded for ${year}.`
                        : "No carryover lot matches these filters."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <ul className="divide-y xl:hidden">
            {visible.map((lot) => (
              <li key={lot.id} className="space-y-2 px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={`${lot.companyCode} ${lot.companyName}`}>
                      {lot.companyName}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">{lot.companyCode}</p>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-[10px]" title={kindLabel(lot)}>
                    {kindLabel(lot)}
                  </Badge>
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Origin year</dt>
                    <dd className="tabular-nums">{lot.originYear}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Expires</dt>
                    <dd className="truncate text-right" title={expiry(lot)}>
                      {expiry(lot)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="tabular-nums">{formatCurrency(lot.amount)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Used</dt>
                    <dd className="tabular-nums">{formatCurrency(lot.used)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Remaining</dt>
                    <dd className="font-medium tabular-nums">{formatCurrency(lot.remaining)}</dd>
                  </div>
                </dl>
              </li>
            ))}
            {total === 0 && (
              <li className="px-4 py-8 text-center text-sm text-muted-foreground">
                {lots.length === 0
                  ? `No carryover lot is recorded for ${year}.`
                  : "No carryover lot matches these filters."}
              </li>
            )}
          </ul>

          {total > 0 && (
            <div className="border-t px-4 py-3">
              <TablePager
                page={safePage}
                pageCount={pageCount}
                total={total}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </section>
  );
}
