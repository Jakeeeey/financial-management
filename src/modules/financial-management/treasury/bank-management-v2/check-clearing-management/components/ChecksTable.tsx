"use client";

import { MoreVertical } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, formatCurrency, formatNumber } from "@/lib/utils";

import { toPhtDateString } from "../pht";
import { PAGE_SIZE } from "../constants";
import { StatusBadge } from "./StatusBadge";
import { TablePager, usePageSize } from "./TablePager";
import type { BankCheck } from "../types";

export type CheckAction = "RELEASE" | "DEPOSIT" | "CLEAR" | "RETURN" | "CANCEL" | "REPLACE" | "VIEW";

/** Which actions the FSD allows from the current status. Mirrors the server rules. */
export function allowedActions(check: BankCheck): { action: CheckAction; label: string; destructive?: boolean }[] {
  const actions: { action: CheckAction; label: string; destructive?: boolean }[] = [{ action: "VIEW", label: "View" }];

  if (check.status === "PENDING" && check.direction === "ISSUED") actions.push({ action: "RELEASE", label: "Release" });
  if (check.status === "RECEIVED") actions.push({ action: "DEPOSIT", label: "Deposit" });
  if ((check.status === "PENDING" && check.direction === "ISSUED") || check.status === "IN_CLEARING") {
    actions.push({ action: "CLEAR", label: "Mark cleared" });
  }
  if (["PENDING", "RECEIVED", "IN_CLEARING"].includes(check.status)) {
    actions.push({ action: "RETURN", label: "Record return" });
  }
  if (check.status === "PENDING" || check.status === "RECEIVED") {
    actions.push({ action: "CANCEL", label: "Cancel check", destructive: true });
  }
  if ((check.status === "RETURNED" || check.status === "CANCELLED") && !check.replacedById) {
    actions.push({ action: "REPLACE", label: "Replace check" });
  }
  return actions;
}

/** Clearing is the only action that runs in bulk today, so it is the only tickable one. */
export function canClear(check: BankCheck): boolean {
  return allowedActions(check).some((entry) => entry.action === "CLEAR");
}

const ACTION_MENU_CLASS: Record<CheckAction, string> = {
  VIEW: "",
  RELEASE: "text-blue-700 focus:text-blue-700 dark:text-blue-300 dark:focus:text-blue-300",
  DEPOSIT: "text-blue-700 focus:text-blue-700 dark:text-blue-300 dark:focus:text-blue-300",
  CLEAR: "text-emerald-700 focus:text-emerald-700 dark:text-emerald-300 dark:focus:text-emerald-300",
  RETURN: "text-amber-700 focus:text-amber-700 dark:text-amber-300 dark:focus:text-amber-300",
  CANCEL: "text-red-600 focus:text-red-600 dark:text-red-400 dark:focus:text-red-400",
  REPLACE: "",
};

type Props = {
  checks: BankCheck[];
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  onAction: (check: BankCheck, action: CheckAction) => void;
  selected: Set<number>;
  onSelectionChange: (next: Set<number>) => void;
  onBulkClear: () => void;
  /** Register-wide row count across every status; the header chip reports it. */
  total: number;
  /** True when any register filter is active, so the chip can read "N of M". */
  filtered: boolean;
  /** Register-wide in-clearing count, the same number the IN CLEARING tile shows. */
  inClearingCount: number;
  /** Filter band rendered inside the register card, like every other V2 table. */
  filters: ReactNode;
};

/** The check register: issued and received checks across every account. */
export function ChecksTable({
  checks,
  isLoading,
  page,
  onPageChange,
  onAction,
  selected,
  onSelectionChange,
  onBulkClear,
  total,
  filtered,
  inClearingCount,
  filters,
}: Props) {

  // A mutation can shorten the register under the current page; clamp rather than reset
  // so an unrelated action does not also move the user off their page.
  const [pageSize, setPageSize] = usePageSize("fm.check-clearing.rows", PAGE_SIZE);
  const pageCount = Math.max(1, Math.ceil(checks.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = checks.slice((safePage - 1) * pageSize, safePage * pageSize);

  const inClearingRows = checks.filter((row) => row.status === "IN_CLEARING" && canClear(row));
  const pageClearable = rows.filter(canClear);
  const allOnPageSelected = pageClearable.length > 0 && pageClearable.every((row) => selected.has(row.id));
  const selectedRows = checks.filter((row) => selected.has(row.id));
  const selectedTotal = selectedRows.reduce((sum, row) => sum + row.amount, 0);

  function toggle(id: number, next: boolean) {
    const draft = new Set(selected);
    if (next) draft.add(id);
    else draft.delete(id);
    onSelectionChange(draft);
  }

  function toggleAllOnPage(next: boolean) {
    const draft = new Set(selected);
    for (const row of pageClearable) {
      if (next) draft.add(row.id);
      else draft.delete(row.id);
    }
    onSelectionChange(draft);
  }

  return (
    <section
      aria-label="Check register"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-amber-500/70 bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Check register</h2>
          <p className="text-xs text-muted-foreground">Click a row for its details and audit trail.</p>
        </div>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          {filtered
            ? `${formatNumber(checks.length)} of ${formatNumber(total)} checks`
            : `${formatNumber(total)} checks`}
        </Badge>
      </header>

      {filters}

      {isLoading ? (
        <div className="space-y-2 px-4 py-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full" />
          ))}
        </div>
      ) : checks.length === 0 ? (
        <div className="px-4 py-16 text-center">
          <p className="text-sm font-medium">No checks match these filters</p>
          <p className="mt-1 text-sm text-muted-foreground">Issue a check or record one received from a customer.</p>
        </div>
      ) : (
        <>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2.5">
        {selectedRows.length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">Tick checks to clear them together.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={inClearingRows.length === 0}
              title={
                inClearingRows.length === 0
                  ? "No in-clearing checks in the current view."
                  : filtered
                    ? "Selects the in-clearing checks in the current view."
                    : undefined
              }
              onClick={() => onSelectionChange(new Set(inClearingRows.map((row) => row.id)))}
            >
              Select all in clearing ({formatNumber(inClearingCount)})
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-semibold">{selectedRows.length} selected</span>
              <span className="ml-2 text-muted-foreground tabular-nums">total {formatCurrency(selectedTotal)}</span>
            </p>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" onClick={onBulkClear}>
                Clear {selectedRows.length}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => onSelectionChange(new Set())}>
                Deselect all
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="hidden overflow-x-auto xl:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  aria-label="Select every clearable check on this page"
                  checked={allOnPageSelected}
                  disabled={pageClearable.length === 0}
                  onCheckedChange={(value) => toggleAllOnPage(value === true)}
                />
              </TableHead>
              <TableHead className="w-[130px]">Check no.</TableHead>
              <TableHead className="w-[100px]">Direction</TableHead>
              <TableHead className="max-w-[170px]">Account</TableHead>
              <TableHead className="max-w-[180px]">Payee / customer</TableHead>
              <TableHead className="w-[130px] text-right">Amount</TableHead>
              <TableHead className="w-[110px]">Check date</TableHead>
              <TableHead className="w-[220px]">Status</TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((check) => {
              return (
                <TableRow
                  key={check.id}
                  tabIndex={0}
                  aria-label={`Open check ${check.checkNo}`}
                  className="cursor-pointer"
                  onClick={() => onAction(check, "VIEW")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onAction(check, "VIEW");
                    }
                  }}
                >
                  <TableCell onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                    <Checkbox
                      aria-label={`Select check ${check.checkNo}`}
                      checked={selected.has(check.id)}
                      disabled={!canClear(check)}
                      onCheckedChange={(value) => toggle(check.id, value === true)}
                    />
                  </TableCell>
                  <TableCell className="max-w-[130px] text-sm">
                    <span className="block truncate" title={check.checkNo}>
                      {check.checkNo}
                    </span>
                    {check.draweeBank ? (
                      <span className="block truncate text-xs text-muted-foreground" title={check.draweeBank}>
                        {check.draweeBank}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-sm">{check.direction === "ISSUED" ? "Issued" : "Received"}</TableCell>
                  <TableCell className="max-w-[170px] text-sm">
                    <span className="block truncate" title={check.bankAccountLabel}>
                      {check.bankAccountLabel}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-[180px] text-sm">
                    <span className="block truncate" title={check.payee ?? check.payor ?? undefined}>
                      {check.payee ?? check.payor ?? "—"}
                    </span>
                    {check.replacesNo ? (
                      <span className="block truncate text-xs text-muted-foreground">Replaces {check.replacesNo}</span>
                    ) : null}
                    {check.replacedByNo ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        Replaced by {check.replacedByNo}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">{formatCurrency(check.amount)}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{toPhtDateString(check.checkDate)}</TableCell>
                  <TableCell>
                    <span className="flex flex-wrap items-center gap-1">
                      <StatusBadge status={check.status} />
                      {check.isStale ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-semibold",
                            "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
                          )}
                        >
                          Stale
                        </Badge>
                      ) : check.isPdc ? (
                        <Badge variant="outline" className="border-border bg-muted text-[10px] font-semibold text-muted-foreground">
                          PDC
                        </Badge>
                      ) : null}
                    </span>
                    {check.isPdc && check.status === "RECEIVED" ? (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        Deposit from {toPhtDateString(check.checkDate)}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`More actions for check ${check.checkNo}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-[190px]">
                        <DropdownMenuLabel className="truncate text-xs">{check.checkNo}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {allowedActions(check).map((entry) => (
                          <DropdownMenuItem
                            key={entry.action}
                            onSelect={() => onAction(check, entry.action)}
                            className={ACTION_MENU_CLASS[entry.action]}
                          >
                            {entry.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-border xl:hidden">
        {rows.map((check) => (
          <li
            key={check.id}
            tabIndex={0}
            aria-label={`Open check ${check.checkNo}`}
            className="cursor-pointer p-4"
            onClick={() => onAction(check, "VIEW")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onAction(check, "VIEW");
              }
            }}
          >
            <div className="flex items-start gap-3">
              <span onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                <Checkbox
                  aria-label={`Select check ${check.checkNo}`}
                  checked={selected.has(check.id)}
                  disabled={!canClear(check)}
                  onCheckedChange={(value) => toggle(check.id, value === true)}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium" title={check.checkNo}>
                  {check.checkNo} · {check.direction === "ISSUED" ? "Issued" : "Received"}
                </p>
                <p className="truncate text-xs" title={check.payee ?? check.payor ?? undefined}>
                  {check.payee ?? check.payor ?? "—"}
                </p>
                <p className="truncate text-xs text-muted-foreground" title={check.bankAccountLabel}>
                  {check.bankAccountLabel} · {toPhtDateString(check.checkDate)}
                </p>
              </div>
              <StatusBadge status={check.status} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
              <span className="text-sm tabular-nums">{formatCurrency(check.amount)}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[190px]">
                  {allowedActions(check).map((entry) => (
                    <DropdownMenuItem
                      key={entry.action}
                      onSelect={() => onAction(check, entry.action)}
                      className={ACTION_MENU_CLASS[entry.action]}
                    >
                      {entry.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </li>
        ))}
      </ul>
        </>
      )}

      <TablePager
        page={safePage}
        pageCount={pageCount}
        total={checks.length}
        pageSize={pageSize}
        onPageChange={onPageChange}
        onPageSizeChange={(size) => {
          setPageSize(size);
          onPageChange(1);
        }}
        className="border-t border-border/50 px-4 py-3"
      />
    </section>
  );
}
