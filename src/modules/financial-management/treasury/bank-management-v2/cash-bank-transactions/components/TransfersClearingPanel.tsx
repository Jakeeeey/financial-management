"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

import { phtToday, toPhtDateString } from "../pht";
import type { TransactionRow } from "../types";
import { StatusBadge } from "./StatusBadge";

interface TransfersClearingPanelProps {
  clearing: TransactionRow[];
  /** Keys a settlement needs and this instance has not mapped yet; empty when it can post. */
  mappingMissing: string[];
  isLoading: boolean;
  isSaving: boolean;
  onSettle: (row: TransactionRow) => void;
  onSettleDue: (rows: TransactionRow[]) => void;
  onOpenRow: (row: TransactionRow) => void;
}

type SortKey = "from" | "to" | "amount" | "valueDate";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const ALL_ACCOUNTS = "__all__";

function SortHead({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  const Icon = active ? (sort.dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <TableHead
      className={className}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        {label}
        <Icon className={active ? "h-3 w-3" : "h-3 w-3 opacity-40"} aria-hidden />
      </button>
    </TableHead>
  );
}

/** PENDING transfers parked in transfer-in-transit, each settleable once its value date arrives. */
export function TransfersClearingPanel({
  clearing,
  mappingMissing,
  isLoading,
  isSaving,
  onSettle,
  onSettleDue,
  onOpenRow,
}: TransfersClearingPanelProps) {
  const today = phtToday();
  const blocked = mappingMissing.length > 0;

  const [sort, setSort] = useState<Sort>({ key: "valueDate", dir: "asc" });
  const [fromAccount, setFromAccount] = useState(ALL_ACCOUNTS);
  const [toAccount, setToAccount] = useState(ALL_ACCOUNTS);

  const fromOptions = useMemo(
    () => [...new Set(clearing.map((row) => row.accountLabel))].sort((a, b) => a.localeCompare(b)),
    [clearing],
  );
  const toOptions = useMemo(
    () =>
      [...new Set(clearing.map((row) => row.counterpartLabel).filter((label): label is string => Boolean(label)))].sort(
        (a, b) => a.localeCompare(b),
      ),
    [clearing],
  );

  const visible = useMemo(() => {
    const filtered = clearing.filter(
      (row) =>
        (fromAccount === ALL_ACCOUNTS || row.accountLabel === fromAccount) &&
        (toAccount === ALL_ACCOUNTS || row.counterpartLabel === toAccount),
    );
    const factor = sort.dir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      if (sort.key === "amount") return (a.amount - b.amount) * factor;
      if (sort.key === "valueDate") return a.valueDate.localeCompare(b.valueDate) * factor;
      const left = sort.key === "from" ? a.accountLabel : a.counterpartLabel ?? "";
      const right = sort.key === "from" ? b.accountLabel : b.counterpartLabel ?? "";
      return left.localeCompare(right) * factor;
    });
  }, [clearing, fromAccount, toAccount, sort]);

  const isFiltered = fromAccount !== ALL_ACCOUNTS || toAccount !== ALL_ACCOUNTS;
  const due = useMemo(() => visible.filter((row) => row.valueDate <= today), [visible, today]);

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  };

  return (
    <section
      aria-label="Transfers in clearing"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-violet-500/70 bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Transfers in clearing</h2>
          <p className="text-xs text-muted-foreground">
            A transfer clears on its value date. Open a row to see which legs have posted.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="tabular-nums text-[11px]">
            {isFiltered
              ? `${formatNumber(visible.length)} of ${formatNumber(clearing.length)} transfers`
              : `${formatNumber(clearing.length)} transfers`}
          </Badge>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11 md:min-h-0"
            disabled={blocked || isSaving || due.length === 0}
            title={
              blocked
                ? "Ask accounting to set up the clearing account for money in transit."
                : due.length === 0
                  ? "No transfer has reached its value date."
                  : undefined
            }
            onClick={() => onSettleDue(due)}
          >
            <ListChecks className="mr-2 h-4 w-4" aria-hidden />
            Settle due ({formatNumber(due.length)})
          </Button>
        </div>
      </header>

      {clearing.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-y bg-muted/30 px-4 py-2">
          <Select value={fromAccount} onValueChange={setFromAccount}>
            <SelectTrigger className="h-9 w-[220px] max-w-full" aria-label="Filter by sending account">
              <SelectValue className="truncate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACCOUNTS}>All sending accounts</SelectItem>
              {fromOptions.map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={toAccount} onValueChange={setToAccount}>
            <SelectTrigger className="h-9 w-[220px] max-w-full" aria-label="Filter by receiving account">
              <SelectValue className="truncate" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ACCOUNTS}>All receiving accounts</SelectItem>
              {toOptions.map((label) => (
                <SelectItem key={label} value={label}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isFiltered ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setFromAccount(ALL_ACCOUNTS);
                setToAccount(ALL_ACCOUNTS);
              }}
            >
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}

      {blocked ? (
        <div className="mx-4 my-3 rounded-xl border border-amber-500/40 bg-amber-50/60 px-4 py-3 text-sm dark:bg-amber-950/20">
          <p className="font-medium text-amber-900 dark:text-amber-200">Settling needs one account set up first.</p>
          <p className="mt-1 text-amber-800 dark:text-amber-300">
            These {formatNumber(clearing.length)} transfers are waiting on the clearing account for money in transit.
            Accounting has not set it up yet, so a settlement cannot post; they settle as soon as it exists.
          </p>
        </div>
      ) : null}

      {isLoading && clearing.length === 0 ? (
        <div className="space-y-2 p-4">
          <div className="h-10 animate-pulse rounded bg-muted" />
          <div className="h-10 animate-pulse rounded bg-muted" />
        </div>
      ) : clearing.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">No transfers are waiting to settle.</p>
      ) : visible.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No transfer matches these account filters.
        </p>
      ) : (
        <>
          <div className="hidden overflow-x-auto xl:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Ref</TableHead>
                  <SortHead label="From account" sortKey="from" sort={sort} onSort={toggleSort} className="w-[220px]" />
                  <SortHead label="To account" sortKey="to" sort={sort} onSort={toggleSort} className="w-[220px]" />
                  <SortHead
                    label="Amount"
                    sortKey="amount"
                    sort={sort}
                    onSort={toggleSort}
                    className="w-[140px] text-right"
                  />
                  <SortHead label="Value date" sortKey="valueDate" sort={sort} onSort={toggleSort} className="w-[130px]" />
                  <TableHead className="w-[130px]">Status</TableHead>
                  <TableHead className="w-[140px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map((row) => {
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
                      <TableCell className="max-w-[220px] truncate text-sm" title={row.accountLabel}>
                        {row.accountLabel}
                      </TableCell>
                      <TableCell
                        className="max-w-[220px] truncate text-sm"
                        title={row.counterpartLabel ?? undefined}
                      >
                        {row.counterpartLabel ?? "—"}
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
                          disabled={!canSettle || isSaving || blocked}
                          title={
                            blocked
                              ? "Ask accounting to set up the clearing account for money in transit."
                              : canSettle
                                ? undefined
                                : "Value date not reached"
                          }
                          onClick={() => onSettle(row)}
                          aria-label={`Settle transfer ${row.refNo}`}
                        >
                          Settle
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y divide-border/50 xl:hidden">
            {visible.map((row) => {
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
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">From account</dt>
                      <dd className="truncate" title={row.accountLabel}>
                        {row.accountLabel}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">To account</dt>
                      <dd className="truncate" title={row.counterpartLabel ?? undefined}>
                        {row.counterpartLabel ?? "—"}
                      </dd>
                    </div>
                  </dl>
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
                      disabled={!canSettle || isSaving || blocked}
                      title={
                        blocked
                          ? "Ask accounting to set up the clearing account for money in transit."
                          : canSettle
                            ? undefined
                            : "Value date not reached"
                      }
                      onClick={() => onSettle(row)}
                      aria-label={`Settle transfer ${row.refNo}`}
                    >
                      Settle
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
