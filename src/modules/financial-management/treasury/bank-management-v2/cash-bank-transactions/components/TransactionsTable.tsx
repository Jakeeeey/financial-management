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
import { TRANSACTION_KIND_LABELS, mappingTitle } from "../constants";
import type { TransactionRow } from "../types";

interface TransactionsTableProps {
  rows: TransactionRow[];
  isLoading: boolean;
  isSaving: boolean;
  page: number;
  pageCount: number;
      total: number;
      /** A filter is narrowing the register, so the chip must not claim the whole set. */
      isFiltered?: boolean;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  /** Keys a settlement posting still needs; empty when it can post. */
  mappingMissing: string[];
  onCancelMemo: (row: TransactionRow) => void;
  onSettle: (row: TransactionRow) => void;
  /** Posts the entry a saved row is missing. */
  onPost: (row: TransactionRow) => void;
  onOpenRow: (row: TransactionRow) => void;
  /** The filter row, rendered inside the register panel above the table. */
  filters: ReactNode;
  /** The register failed to load, so an empty table must say so rather than blame the filters. */
  isError?: boolean;
  onRetry?: () => void;
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
  mappingMissing,
  onCancelMemo,
  onSettle,
  onPost,
}: {
  row: TransactionRow;
  isSaving: boolean;
  mappingMissing: string[];
  onCancelMemo: (row: TransactionRow) => void;
  onSettle: (row: TransactionRow) => void;
  onPost: (row: TransactionRow) => void;
}) {
  const isPendingTransfer = row.kind === "TRANSFER" && row.status === "PENDING";
  const canCancelMemo = row.kind !== "TRANSFER" && row.status === "POSTED";
  const canSettle = isPendingTransfer && row.valueDate <= phtToday();
  const blocked = mappingMissing.length > 0;
  const postBlocked = row.missingEntryKeys.length > 0;

  if (!isPendingTransfer && !canCancelMemo && !row.canPost) {
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
      <DropdownMenuContent align="end" className="w-[180px]">
        {row.canPost ? (
          <DropdownMenuItem
            disabled={postBlocked}
            title={postBlocked ? mappingTitle(row.missingEntryKeys) : "Posts the journal entry this transaction is missing."}
            onSelect={() => onPost(row)}
          >
            Post entry
          </DropdownMenuItem>
        ) : null}
        {isPendingTransfer ? (
          canSettle ? (
            <DropdownMenuItem
              disabled={blocked}
              title={
                blocked ? "Ask accounting to set up the clearing account for money in transit." : undefined
              }
              onSelect={() => onSettle(row)}
            >
              Settle transfer
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem disabled title="Value date not reached">
              Settles on {row.valueDate}
            </DropdownMenuItem>
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
      isFiltered = false,
  pageSize,
  onPageChange,
  onPageSizeChange,
  mappingMissing,
  onCancelMemo,
  onSettle,
  onPost,
  onOpenRow,
  filters,
  isError,
  onRetry,
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
          {formatNumber(total)} {isFiltered ? "matching" : `transaction${total === 1 ? "" : "s"}`}
        </Badge>
      </header>

      {isError && rows.length === 0 ? null : filters}

      {showLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded bg-muted" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        isError ? (
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </EmptyMedia>
              <EmptyTitle>Could not load transactions.</EmptyTitle>
              <EmptyDescription>The request failed, so nothing is listed.</EmptyDescription>
            </EmptyHeader>
            {onRetry ? (
              <Button variant="outline" size="sm" onClick={onRetry}>
                Try again
              </Button>
            ) : null}
          </Empty>
        ) : (
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
        )
      ) : (
        <>
          <div className="hidden overflow-x-auto min-[1300px]:block">
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
                      <RowActions
                        row={row}
                        isSaving={isSaving}
                        mappingMissing={mappingMissing}
                        onCancelMemo={onCancelMemo}
                        onSettle={onSettle}
                        onPost={onPost}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y divide-border min-[1300px]:hidden">
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
                  <RowActions
                    row={row}
                    isSaving={isSaving}
                    mappingMissing={mappingMissing}
                    onCancelMemo={onCancelMemo}
                    onSettle={onSettle}
                    onPost={onPost}
                  />
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
        onPageSizeChange={onPageSizeChange}
        isLoading={isLoading}
        className="border-t border-border/50 px-4 py-3"
      />
    </section>
  );
}
