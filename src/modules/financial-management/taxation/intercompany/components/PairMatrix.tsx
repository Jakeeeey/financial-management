"use client";

import { useMemo, type KeyboardEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import { usePager } from "../hooks/usePager";
import type { IntercompanyPair } from "../types";
import { PairStatusBadge } from "./PairStatusBadge";
import { TablePager } from "./TablePager";

const PAGE_SIZE = 10;

// The money column shows money or nothing; the reason a figure is missing belongs on the hint line.
function reciprocalText(pair: IntercompanyPair): string {
  if (pair.status === "NOT_LINKABLE") return "—";
  if (pair.reciprocalAmount === null) return "—";
  const documents = `${pair.reciprocalInvoices} doc${pair.reciprocalInvoices === 1 ? "" : "s"}`;
  return `${formatCurrency(pair.reciprocalAmount)} · ${documents}`;
}

/** Cross-sided check: what the buyer's orders say about the seller's invoice. */
function reciprocalHint(pair: IntercompanyPair): string | undefined {
  if (pair.status === "NOT_LINKABLE") return "the buyer's supplier field holds ids, not names";
  if (pair.reciprocalAmount === null) return "no purchase order at the buyer";
  const gap = pair.reciprocalAmount - pair.amount;
  if (Math.abs(gap) <= 1) return "within ₱1 of the seller's figure";
  return `buyer is ${formatCurrency(Math.abs(gap))} ${gap > 0 ? "higher" : "lower"} than the seller's figure`;
}

function pairLabel(pair: IntercompanyPair): string {
  return `Open pair ${pair.fromCode} to ${pair.toCode}`;
}

/** Rows are the drilldown trigger, so both the table and the card list answer Enter and Space. */
function rowKeyDown(event: KeyboardEvent, action: () => void) {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  action();
}

function SkeletonRows() {
  return (
    <div className="space-y-2 px-4 py-4">
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-4 w-full" />
      ))}
    </div>
  );
}

export function PairMatrix({
  pairs,
  isLoading,
  oneSided,  year,
  onSelectPair,
}: {
  pairs: IntercompanyPair[];
  isLoading: boolean;
  /** Documents with a group counterparty whose own ledger could not be read. */
  oneSided: number;
  year: number;
  onSelectPair: (pair: IntercompanyPair) => void;
}) {
  const { page, pageCount, pageRows, setPage } = usePager(pairs, PAGE_SIZE);
  const matched = useMemo(() => pairs.filter((pair) => pair.status === "MATCHED").length, [pairs]);
  const rowClass =
    "cursor-pointer focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

  return (
    <section className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-violet-500/70 bg-card shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Pair matrix</h2>
          <p className="text-xs text-muted-foreground">
            Every directed pair in {year}: the seller&apos;s invoices against the buyer&apos;s purchase orders.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="outline" className="tabular-nums text-[11px]">
            {pairs.length} pair{pairs.length === 1 ? "" : "s"}
          </Badge>
          <Badge variant="outline" className="tabular-nums text-[11px]">
            {matched} matched
          </Badge>
        </div>
      </div>

      {isLoading && pairs.length === 0 ? (
        <SkeletonRows />
      ) : pairs.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">
          {oneSided > 0
            ? `${oneSided} document${oneSided === 1 ? "" : "s"} name${oneSided === 1 ? "s" : ""} a group company, but the other side could not be read, so no pair can be confirmed for ${year}.`
            : `No pair has a document in ${year}.`}
        </p>
      ) : (
        <>
          <div className="hidden xl:block">
            <Table aria-label="Intercompany pair matrix">
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Invoices detected</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">EWTs withheld</TableHead>
                  <TableHead>Reciprocal match</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((pair) => (
                  <TableRow
                    key={`${pair.fromCode}-${pair.toCode}`}
                    tabIndex={0}
                    aria-label={pairLabel(pair)}
                    className={rowClass}
                    onClick={() => onSelectPair(pair)}
                    onKeyDown={(event) => rowKeyDown(event, () => onSelectPair(pair))}
                  >
                    <TableCell className="max-w-[14rem]">
                      <span className="block truncate font-medium" title={`${pair.fromCode} — ${pair.fromName}`}>
                        {pair.fromCode}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground" title={pair.fromName}>
                        {pair.fromName}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[14rem]">
                      <span className="block truncate font-medium" title={`${pair.toCode} — ${pair.toName}`}>
                        {pair.toCode}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground" title={pair.toName}>
                        {pair.toName}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{pair.invoices}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(pair.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(pair.withheld)}</TableCell>
                    <TableCell className="max-w-[18rem]">
                      <span className="block truncate text-sm" title={reciprocalText(pair)}>
                        {reciprocalText(pair)}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground" title={reciprocalHint(pair)}>
                        {reciprocalHint(pair) ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <PairStatusBadge pair={pair} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="divide-y xl:hidden">
            {pageRows.map((pair) => (
              <article
                key={`${pair.fromCode}-${pair.toCode}`}
                role="button"
                tabIndex={0}
                aria-label={pairLabel(pair)}
                className={`space-y-2 px-4 py-3 ${rowClass}`}
                onClick={() => onSelectPair(pair)}
                onKeyDown={(event) => rowKeyDown(event, () => onSelectPair(pair))}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-medium">
                    <span className="block truncate" title={`${pair.fromCode} — ${pair.fromName}`}>
                      {pair.fromCode} → {pair.toCode}
                    </span>
                    <span className="block truncate text-xs font-normal text-muted-foreground" title={pair.fromName}>
                      {pair.fromName} → {pair.toName}
                    </span>
                  </p>
                  <PairStatusBadge pair={pair} />
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Invoices</dt>
                    <dd className="tabular-nums">{pair.invoices}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Amount</dt>
                    <dd className="tabular-nums">{formatCurrency(pair.amount)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">EWTs withheld</dt>
                    <dd className="tabular-nums">{formatCurrency(pair.withheld)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Reciprocal</dt>
                    <dd className="truncate tabular-nums" title={reciprocalText(pair)}>
                      {reciprocalText(pair)}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <div className="border-t px-4 py-3">
            <TablePager
              page={page}
              pageCount={pageCount}
              total={pairs.length}
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


