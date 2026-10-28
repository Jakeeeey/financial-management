"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Eye, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TrialBalanceItem } from "../types/trial-balance.schema";
import { formatTrialBalanceAmount, getPeriodMovementLabel } from "../utils/money";
import { getTrialBalanceReviewLabel, getTrialBalanceReviewReason } from "../utils/review-flags";
import {
  calculateTrialBalanceCategorySubtotal,
  groupTrialBalanceAccounts,
  sortTrialBalanceAccounts,
  type TrialBalanceAccountSortKey,
  type TrialBalanceSortDirection,
} from "../utils/account-table";

const COLUMN_LABELS: Record<TrialBalanceAccountSortKey | "reviewFlag", string> = {
  glCode: "Account code",
  accountTitle: "Account title",
  totalDebit: "Period debit activity",
  totalCredit: "Period credit activity",
  netBalance: "Net period movement",
  reviewFlag: "Review status",
};

type DataColumnKey = "totalDebit" | "totalCredit" | "netBalance" | "reviewFlag";
type SortableColumnKey = TrialBalanceAccountSortKey;

export interface TrialBalanceDetailViewState {
  sortKey: SortableColumnKey;
  sortDirection: TrialBalanceSortDirection;
  pageIndex: number;
  pageSize: number;
  visibleColumns: Record<DataColumnKey, boolean>;
  scrollTop: number;
  scrollLeft: number;
}

export const INITIAL_TRIAL_BALANCE_DETAIL_VIEW_STATE: TrialBalanceDetailViewState = {
  sortKey: "glCode",
  sortDirection: "asc",
  pageIndex: 0,
  pageSize: 10,
  visibleColumns: { totalDebit: true, totalCredit: true, netBalance: true, reviewFlag: true },
  scrollTop: 0,
  scrollLeft: 0,
};

function getSortIcon(key: SortableColumnKey, sortKey: SortableColumnKey, direction: TrialBalanceSortDirection) {
  if (key !== sortKey) return <ArrowUpDown aria-hidden="true" className="size-3.5 text-muted-foreground" />;
  return direction === "asc"
    ? <ArrowUp aria-hidden="true" className="size-3.5" />
    : <ArrowDown aria-hidden="true" className="size-3.5" />;
}

function sortValueLabel(direction: TrialBalanceSortDirection) {
  return direction === "asc" ? "ascending" : "descending";
}

export function TrialBalanceDetailView({
  data,
  isLoading,
  onAccountClick,
  state,
  onStateChange,
}: {
  data: TrialBalanceItem[];
  isLoading: boolean;
  onAccountClick: (account: TrialBalanceItem, trigger: HTMLButtonElement) => void;
  state: TrialBalanceDetailViewState;
  onStateChange: React.Dispatch<React.SetStateAction<TrialBalanceDetailViewState>>;
}) {
  const tableScrollRef = React.useRef<HTMLDivElement>(null);
  const initialScrollRef = React.useRef({ top: state.scrollTop, left: state.scrollLeft });

  React.useLayoutEffect(() => {
    const element = tableScrollRef.current;
    if (!element) return;
    element.scrollTop = initialScrollRef.current.top;
    element.scrollLeft = initialScrollRef.current.left;
  }, []);

  const { sortKey, sortDirection, pageIndex, pageSize, visibleColumns } = state;
  const sortedItems = React.useMemo(() => sortTrialBalanceAccounts(data, sortKey, sortDirection), [data, sortKey, sortDirection]);
  const groups = React.useMemo(() => groupTrialBalanceAccounts(sortedItems), [sortedItems]);
  const pageCount = Math.max(1, Math.ceil(data.length / pageSize));
  const safePageIndex = Math.min(pageIndex, pageCount - 1);
  const pageStart = safePageIndex * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, data.length);
  const visibleGroups = React.useMemo(() => {
    let offset = 0;
    const visible: Array<{ category: string; accounts: TrialBalanceItem[]; allAccounts: TrialBalanceItem[]; isFinalCategoryRow: (account: TrialBalanceItem) => boolean }> = [];
    for (const group of groups) {
      const groupStart = offset;
      const groupEnd = groupStart + group.accounts.length;
      const start = Math.max(pageStart, groupStart);
      const end = Math.min(pageEnd, groupEnd);
      if (start < end) {
        const accounts = sortedItems.slice(start, end);
        const lastAccount = group.accounts[group.accounts.length - 1];
        visible.push({
          category: group.category,
          accounts,
          allAccounts: group.accounts,
          isFinalCategoryRow: account => account === lastAccount,
        });
      }
      offset = groupEnd;
    }
    return visible;
  }, [groups, pageEnd, pageStart, sortedItems]);

  React.useEffect(() => {
    if (pageIndex !== safePageIndex) onStateChange(current => ({ ...current, pageIndex: safePageIndex }));
  }, [pageIndex, safePageIndex, onStateChange]);

  const columnCount = 2 + Object.values(visibleColumns).filter(Boolean).length + 1;
  const handleSort = (key: SortableColumnKey) => {
    onStateChange(current => ({
      ...current,
      pageIndex: 0,
      sortKey: key,
      sortDirection: key === current.sortKey ? (current.sortDirection === "asc" ? "desc" : "asc") : "asc",
    }));
  };

  const renderSortableHeader = (key: SortableColumnKey, label: string, alignment: "left" | "right" = "left") => (
    <TableHead
      key={key}
      aria-sort={sortKey === key ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
      className={cn(
        "sticky top-0 z-30 h-11 bg-background px-3",
        key === "glCode" && "left-0 z-50 w-28 min-w-28",
        alignment === "right" && "text-right",
      )}
    >
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => handleSort(key)}
        aria-label={sortKey === key ? `Sorted by ${label}, ${sortValueLabel(sortDirection)}. Activate to reverse sort.` : `Sort by ${label}`}
        className={cn(
          "h-8 px-1.5 font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
          alignment === "right" && "flex w-full justify-end",
        )}
      >
        {label}
        {getSortIcon(key, sortKey, sortDirection)}
      </Button>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge variant="outline" className="h-8 px-3 font-medium">{isLoading ? "Loading accounts…" : `${data.length} Accounts`}</Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Settings2 aria-hidden="true" className="size-4" />
              View columns
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {(Object.keys(COLUMN_LABELS) as Array<keyof typeof COLUMN_LABELS>)
              .filter(key => key !== "glCode" && key !== "accountTitle")
              .map(key => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={visibleColumns[key as DataColumnKey]}
                  onCheckedChange={checked => onStateChange(current => ({ ...current, visibleColumns: { ...current.visibleColumns, [key]: Boolean(checked) } }))}
                >
                  {COLUMN_LABELS[key]}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        ref={tableScrollRef}
        onScroll={event => {
          const { scrollTop, scrollLeft } = event.currentTarget;
          onStateChange(current => current.scrollTop === scrollTop && current.scrollLeft === scrollLeft
            ? current
            : { ...current, scrollTop, scrollLeft });
        }}
        className="relative max-h-[70vh] w-full overflow-auto rounded-xl border bg-card shadow-sm"
      >
        <table className="w-full min-w-[78rem] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">Trial balance accounts grouped by category. Use the column heading buttons to sort within each category.</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {renderSortableHeader("glCode", COLUMN_LABELS.glCode)}
              <TableHead
                aria-sort={sortKey === "accountTitle" ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
                className="sticky top-0 left-28 z-40 h-11 min-w-[18rem] bg-background px-3 shadow-[1px_0_0_var(--border)]"
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort("accountTitle")}
                  aria-label={sortKey === "accountTitle" ? `Sorted by ${COLUMN_LABELS.accountTitle}, ${sortValueLabel(sortDirection)}. Activate to reverse sort.` : `Sort by ${COLUMN_LABELS.accountTitle}`}
                  className="h-8 px-1.5 font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                >
                  {COLUMN_LABELS.accountTitle}{getSortIcon("accountTitle", sortKey, sortDirection)}
                </Button>
              </TableHead>
              {visibleColumns.totalDebit && renderSortableHeader("totalDebit", COLUMN_LABELS.totalDebit, "right")}
              {visibleColumns.totalCredit && renderSortableHeader("totalCredit", COLUMN_LABELS.totalCredit, "right")}
              {visibleColumns.netBalance && renderSortableHeader("netBalance", COLUMN_LABELS.netBalance, "right")}
              {visibleColumns.reviewFlag && <TableHead className="sticky top-0 z-30 h-11 bg-background px-3">Review status</TableHead>}
              <TableHead className="sticky top-0 z-30 h-11 bg-background px-3 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !data.length ? (
              Array.from({ length: 5 }, (_, rowIndex) => (
                <TableRow key={rowIndex}>
                  {Array.from({ length: columnCount }, (_, cellIndex) => (
                    <TableCell key={cellIndex} className="px-3 py-3"><Skeleton className="h-5 w-28" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : !data.length ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center text-muted-foreground">
                  No accounts match the applied filters.
                </TableCell>
              </TableRow>
            ) : (
              visibleGroups.map(group => {
                const subtotal = calculateTrialBalanceCategorySubtotal(group.allAccounts);
                return <React.Fragment key={group.category}>
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={columnCount} className="border-b bg-muted/60 px-3 py-2 font-semibold text-foreground">
                      {group.category}
                    </TableCell>
                  </TableRow>
                  {group.accounts.map(account => (
                    <React.Fragment key={account.glCode}>
                      <TableRow className="group">
                        <TableCell className="sticky left-0 z-10 w-28 min-w-28 border-b bg-card px-3 py-3 font-mono font-medium group-hover:bg-muted/50">
                          {account.glCode}
                        </TableCell>
                        <TableCell className="sticky left-28 z-10 min-w-[18rem] max-w-[18rem] whitespace-normal break-words border-b bg-card px-3 py-3 shadow-[1px_0_0_var(--border)] group-hover:bg-muted/50">
                          <div className="font-semibold">{account.accountTitle}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{account.accountType}</div>
                        </TableCell>
                        {visibleColumns.totalDebit && <TableCell className={cn("border-b px-3 py-3 text-right font-mono tabular-nums", account.totalDebit < 0 && "text-destructive")}>
                          {formatTrialBalanceAmount(account.totalDebit)}
                        </TableCell>}
                        {visibleColumns.totalCredit && <TableCell className={cn("border-b px-3 py-3 text-right font-mono tabular-nums", account.totalCredit < 0 && "text-destructive")}>
                          {formatTrialBalanceAmount(account.totalCredit)}
                        </TableCell>}
                        {visibleColumns.netBalance && <TableCell className="border-b px-3 py-3 text-right">
                          <div className="font-mono font-medium tabular-nums">{formatTrialBalanceAmount(account.netBalance)}</div>
                          <div className="text-xs text-muted-foreground">{getPeriodMovementLabel(account)}</div>
                        </TableCell>}
                        {visibleColumns.reviewFlag && <TableCell className="border-b px-3 py-3">
                          <Badge
                            variant={account.reviewFlag.toLowerCase() === "critical" ? "outline" : "secondary"}
                            className={cn(account.reviewFlag.toLowerCase() === "critical" && "border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200")}
                          >
                            {getTrialBalanceReviewLabel(account.reviewFlag)}
                          </Badge>
                          {getTrialBalanceReviewReason(account.reviewFlag, account.reviewReason) && (
                            <p className="mt-1 max-w-sm text-xs leading-relaxed text-amber-800 dark:text-amber-200">
                              {getTrialBalanceReviewReason(account.reviewFlag, account.reviewReason)}
                            </p>
                          )}
                        </TableCell>}
                        <TableCell className="border-b px-3 py-3 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={event => onAccountClick(account, event.currentTarget)}
                            aria-label={`View entries for ${account.glCode} ${account.accountTitle}`}
                            className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                          >
                            <Eye aria-hidden="true" className="size-4" />
                            View entries
                          </Button>
                        </TableCell>
                      </TableRow>
                      {group.isFinalCategoryRow(account) && <TableRow className="hover:bg-transparent bg-muted/30">
                        <TableCell colSpan={2} className="border-b px-3 py-3 text-right font-semibold">{group.category} subtotal</TableCell>
                        {visibleColumns.totalDebit && <TableCell className="border-b px-3 py-3 text-right font-mono font-semibold tabular-nums">{formatTrialBalanceAmount(subtotal.totalDebit)}</TableCell>}
                        {visibleColumns.totalCredit && <TableCell className="border-b px-3 py-3 text-right font-mono font-semibold tabular-nums">{formatTrialBalanceAmount(subtotal.totalCredit)}</TableCell>}
                        {visibleColumns.netBalance && <TableCell className="border-b px-3 py-3 text-right">
                          <div className="font-mono font-semibold tabular-nums">{formatTrialBalanceAmount(subtotal.netMovement)}</div>
                          <div className="text-xs text-muted-foreground">{subtotal.movementType}</div>
                        </TableCell>}
                        {visibleColumns.reviewFlag && <TableCell className="border-b" />}
                        <TableCell className="border-b" />
                      </TableRow>}
                    </React.Fragment>
                  ))}
                </React.Fragment>;
              })
            )}
          </TableBody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm">
        <p className="text-muted-foreground" aria-live="polite">
          {isLoading ? "Loading accounts…" : data.length === 0 ? "Showing 0 accounts" : `Showing ${pageStart + 1}–${pageEnd} of ${data.length} accounts`}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-muted-foreground">
            Accounts per page
            <Select value={`${pageSize}`} onValueChange={value => onStateChange(current => ({ ...current, pageSize: Number(value), pageIndex: 0 }))}>
              <SelectTrigger className="h-8 w-[4.5rem]" aria-label="Accounts per page"><SelectValue /></SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map(size => <SelectItem key={size} value={`${size}`}>{size}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <span className="min-w-20 text-center text-muted-foreground" aria-live="polite">Page {safePageIndex + 1} of {pageCount}</span>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => onStateChange(current => ({ ...current, pageIndex: Math.max(0, current.pageIndex - 1) }))} disabled={safePageIndex === 0} aria-label="Previous page">
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => onStateChange(current => ({ ...current, pageIndex: Math.min(pageCount - 1, current.pageIndex + 1) }))} disabled={safePageIndex >= pageCount - 1} aria-label="Next page">
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
