"use client";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

import { phtToday, toPhtDateString } from "../pht";
import type { TransactionRow } from "../types";
import { StatusBadge } from "./StatusBadge";

interface TransfersClearingPanelProps {
  clearing: TransactionRow[];
  isLoading: boolean;
  isSaving: boolean;
  onSettle: (row: TransactionRow) => void;
  onOpenRow: (row: TransactionRow) => void;
}

/** PENDING transfers parked in transfer-in-transit, each settleable once its value date arrives. */
export function TransfersClearingPanel({ clearing, isLoading, isSaving, onSettle, onOpenRow }: TransfersClearingPanelProps) {
  const today = phtToday();

  return (
    <section
      aria-label="Transfers in clearing"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-violet-500/70 bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Transfers in clearing</h2>
          <p className="text-xs text-muted-foreground">
            Money already out of the source account, waiting for its value date.
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          {formatNumber(clearing.length)} transfers
        </Badge>
      </header>

      {isLoading && clearing.length === 0 ? (
        <div className="space-y-2 p-4">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </div>
      ) : clearing.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">No transfers are waiting to settle.</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Ref</TableHead>
                  <TableHead className="min-w-[240px]">From → To</TableHead>
                  <TableHead className="w-[140px] text-right">Amount</TableHead>
                  <TableHead className="w-[130px]">Value date</TableHead>
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clearing.map((row) => {
                  const canSettle = row.valueDate <= today;
                  return (
                    <TableRow
                      key={row.key}
                      tabIndex={0}
                      aria-label={`Open transfer ${row.refNo}`}
                      className="cursor-pointer"
                      onClick={() => onOpenRow(row)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onOpenRow(row);
                        }
                      }}
                    >
                      <TableCell className="truncate font-mono text-xs" title={row.refNo}>
                        {row.refNo}
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <span className="flex min-w-0 items-center gap-1.5 text-sm">
                          <span className="truncate" title={row.accountLabel}>
                            {row.accountLabel}
                          </span>
                          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="truncate" title={row.counterpartLabel ?? undefined}>
                            {row.counterpartLabel ?? "—"}
                          </span>
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-sm tabular-nums">
                        {formatCurrency(row.amount)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm tabular-nums">
                        {toPhtDateString(row.valueDate)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={!canSettle || isSaving}
                          title={canSettle ? undefined : "Value date not reached"}
                          onClick={() => onSettle(row)}
                          aria-label={`Settle transfer ${row.refNo}`}
                        >
                          Settle leg 2
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y divide-border/50 xl:hidden">
            {clearing.map((row) => {
              const canSettle = row.valueDate <= today;
              return (
                <li
                  key={row.key}
                  tabIndex={0}
                  aria-label={`Open transfer ${row.refNo}`}
                  className="cursor-pointer space-y-2 p-4"
                  onClick={() => onOpenRow(row)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenRow(row);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate font-mono text-xs" title={row.refNo}>
                      {row.refNo}
                    </p>
                    <StatusBadge status={row.status} />
                  </div>
                  <p
                    className="flex min-w-0 items-center gap-1.5 text-sm"
                    title={`${row.accountLabel} to ${row.counterpartLabel ?? "unknown account"}`}
                  >
                    <span className="truncate">{row.accountLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{row.counterpartLabel ?? "—"}</span>
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Value date <span className="tabular-nums">{toPhtDateString(row.valueDate)}</span>
                    </p>
                    <span className="text-sm font-medium tabular-nums">{formatCurrency(row.amount)}</span>
                  </div>
                  <div
                    className="flex items-end justify-end"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!canSettle || isSaving}
                      onClick={() => onSettle(row)}
                      aria-label={`Settle transfer ${row.refNo}`}
                    >
                      Settle leg 2
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
