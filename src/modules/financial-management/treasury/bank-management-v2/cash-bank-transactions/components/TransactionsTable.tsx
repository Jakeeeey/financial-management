"use client";

import type { ReactNode } from "react";
import { MoreVertical, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

import { phtToday } from "../pht";
import { StatusBadge } from "./StatusBadge";
import { TablePager } from "./TablePager";
import { TRANSACTION_KIND_LABELS } from "../constants";
import type { TransactionRow } from "../types";

interface TransactionsTableProps {
  rows: TransactionRow[];
  isLoading: boolean;
  isSaving: boolean;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onCancelMemo: (row: TransactionRow) => void;
  onSettle: (row: TransactionRow) => void;
  onOpenRow: (row: TransactionRow) => void;
  /** The filter row, rendered inside the register panel above the table. */
  filters: ReactNode;
}

/** Money leaving the account also carries the transfer fee, so the two sides can differ. */
function addition(row: TransactionRow): number | null {
  return row.direction === "IN" ? row.amount : null;
}

function deduction(row: TransactionRow): number | null {
  return row.direction === "OUT" ? row.amount + row.fee : null;
}

function RowActions({
  row,
  isSaving,
  onCancelMemo,
  onSettle,
}: {
  row: TransactionRow;
  isSaving: boolean;
  onCancelMemo: (row: TransactionRow) => void;
  onSettle: (row: TransactionRow) => void;
}) {
  const isPendingTransfer = row.kind === "TRANSFER" && row.status === "PENDING";
  const canCancelMemo = row.kind !== "TRANSFER" && row.status === "POSTED";
  const canSettle = isPendingTransfer && row.valueDate <= phtToday();

  if (!isPendingTransfer && !canCancelMemo) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Actions for ${row.refNo}`}
          disabled={isSaving}
        >
          <MoreVertical className="h-4 w-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[160px]">
        {isPendingTransfer ? (
          canSettle ? (
            <DropdownMenuItem onSelect={() => onSettle(row)}>Settle transfer</DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled>Settles on {row.valueDate}</DropdownMenuItem>
          )
        ) : null}
        {canCancelMemo ? <DropdownMenuItem onSelect={() => onCancelMemo(row)}>Cancel memo</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TransactionsTable({
  rows,
  isLoading,
  isSaving,
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  onCancelMemo,
  onSettle,
  onOpenRow,
  filters,
}: TransactionsTableProps) {
  const showLoading = isLoading && rows.length === 0;

  return (
    <section
      aria-label="Bank transactions"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-violet-500/70 bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold">Bank transactions</h2>
          <p className="truncate text-xs text-muted-foreground">Newest first, each with its journal entry.</p>
        </div>
        <Badge variant="outline" className="shrink-0 tabular-nums text-[11px]">
          {formatNumber(total)} transactions
        </Badge>
      </header>

      {filters}

      {showLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Empty className="py-12">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ReceiptText className="h-5 w-5" aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>No transactions match these filters.</EmptyTitle>
            <EmptyDescription>
              Clear the filters, or record a credit memo, debit memo, interest earned or fund transfer.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[120px]">Date (PHT)</TableHead>
                  <TableHead className="min-w-[280px]">Account</TableHead>
                  <TableHead className="w-[130px]">Reference</TableHead>
                  <TableHead className="min-w-[200px]">Payee / description</TableHead>
                  <TableHead className="w-[150px]">Type</TableHead>
                  <TableHead className="w-[120px] text-right">Addition</TableHead>
                  <TableHead className="w-[120px] text-right">Deduction</TableHead>
                  <TableHead className="w-[60px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.key}
                    tabIndex={0}
                    aria-label={`Open transaction ${row.refNo}`}
                    className="cursor-pointer"
                    onClick={() => onOpenRow(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onOpenRow(row);
                      }
                    }}
                  >
                    <TableCell className="tabular-nums">{row.date}</TableCell>
                    <TableCell>
                      <span className="block max-w-[300px] truncate" title={row.accountLabel}>
                        {row.accountLabel}
                      </span>
                      {row.counterpartLabel ? (
                        <span
                          className="block max-w-[300px] truncate text-xs text-muted-foreground"
                          title={`to ${row.counterpartLabel}`}
                        >
                          to {row.counterpartLabel}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-[120px] truncate font-mono text-xs" title={row.refNo}>
                        {row.refNo}
                      </span>
                      <span className="block max-w-[120px] truncate text-xs text-muted-foreground" title={row.jeNo ?? "No journal entry"}>
                        {row.jeNo ?? "No JE"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className="block max-w-[300px] truncate"
                        title={row.description ?? TRANSACTION_KIND_LABELS[row.kind]}
                      >
                        {row.description ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="block max-w-[140px] truncate" title={TRANSACTION_KIND_LABELS[row.kind]}>
                        {TRANSACTION_KIND_LABELS[row.kind]}
                      </span>
                      <StatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {addition(row) === null ? "" : formatCurrency(addition(row) as number)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-red-700 dark:text-red-400">
                      {deduction(row) === null ? "" : formatCurrency(deduction(row) as number)}
                    </TableCell>
                    <TableCell
                      className="text-right"
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <RowActions row={row} isSaving={isSaving} onCancelMemo={onCancelMemo} onSettle={onSettle} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y divide-border xl:hidden">
            {rows.map((row) => (
              <li
                key={row.key}
                tabIndex={0}
                aria-label={`Open transaction ${row.refNo}`}
                className="cursor-pointer space-y-2 p-4"
                onClick={() => onOpenRow(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpenRow(row);
                  }
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs" title={row.refNo}>
                      {row.refNo}
                    </p>
                    <p className="truncate text-sm font-medium" title={TRANSACTION_KIND_LABELS[row.kind]}>
                      {TRANSACTION_KIND_LABELS[row.kind]}
                    </p>
                  </div>
                  <StatusBadge status={row.status} />
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Date</dt>
                  <dd className="text-right tabular-nums">{row.date}</dd>
                  <dt className="text-muted-foreground">Account</dt>
                  <dd className="truncate text-right" title={row.accountLabel}>
                    {row.accountLabel}
                    {row.counterpartLabel ? (
                      <span className="text-muted-foreground"> → {row.counterpartLabel}</span>
                    ) : null}
                  </dd>
                  {row.description ? (
                    <>
                      <dt className="text-muted-foreground">Payee / description</dt>
                      <dd className="truncate text-right" title={row.description}>
                        {row.description}
                      </dd>
                    </>
                  ) : null}
                  <dt className="text-muted-foreground">Addition</dt>
                  <dd className="text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                    {addition(row) === null ? "—" : formatCurrency(addition(row) as number)}
                  </dd>
                  <dt className="text-muted-foreground">Deduction</dt>
                  <dd className="text-right tabular-nums text-red-700 dark:text-red-400">
                    {deduction(row) === null ? "—" : formatCurrency(deduction(row) as number)}
                  </dd>
                  <dt className="text-muted-foreground">JE no.</dt>
                  <dd className="truncate text-right font-mono text-xs">{row.jeNo ?? "—"}</dd>
                </dl>
                <div
                  className="flex justify-end"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  <RowActions row={row} isSaving={isSaving} onCancelMemo={onCancelMemo} onSettle={onSettle} />
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

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
