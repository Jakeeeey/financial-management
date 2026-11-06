"use client";

import { ChevronLeft, ChevronRight, MoreVertical } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn, formatCurrency } from "@/lib/utils";

import { toPhtDateString } from "../pht";
import { PAGE_SIZE } from "../constants";
import { StatusBadge } from "./StatusBadge";
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

type Props = {
  checks: BankCheck[];
  isLoading: boolean;
  page: number;
  onPageChange: (page: number) => void;
  onAction: (check: BankCheck, action: CheckAction) => void;
};

/** The check register: issued and received checks across every account. */
export function ChecksTable({ checks, isLoading, page, onPageChange, onAction }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-2 rounded-xl border border-border/50 p-4">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (checks.length === 0) {
    return (
      <div className="rounded-xl border border-border/50 px-4 py-16 text-center">
        <p className="text-sm font-medium">No checks match these filters</p>
        <p className="mt-1 text-sm text-muted-foreground">Issue a check or record one received from a customer.</p>
      </div>
    );
  }

  // A mutation can shorten the register under the current page; clamp rather than reset
  // so an unrelated action does not also move the user off their page.
  const pageCount = Math.max(1, Math.ceil(checks.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = checks.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const first = (safePage - 1) * PAGE_SIZE + 1;
  const last = Math.min(safePage * PAGE_SIZE, checks.length);

  return (
    <div className="overflow-hidden rounded-xl border border-border/50">
      <div className="hidden overflow-x-auto xl:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="max-w-[140px]">Check no.</TableHead>
              <TableHead className="w-[100px]">Direction</TableHead>
              <TableHead className="max-w-[180px]">Account</TableHead>
              <TableHead className="max-w-[170px]">Payee / customer</TableHead>
              <TableHead className="w-[130px] text-right">Amount</TableHead>
              <TableHead className="w-[110px]">Check date</TableHead>
              <TableHead className="w-[130px]">Status</TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((check) => (
              <TableRow key={check.id}>
                <TableCell className="max-w-[140px] truncate text-sm" title={check.checkNo}>
                  {check.checkNo}
                </TableCell>
                <TableCell className="text-sm">{check.direction === "ISSUED" ? "Issued" : "Received"}</TableCell>
                <TableCell className="max-w-[180px] truncate text-sm" title={check.bankAccountLabel}>
                  {check.bankAccountLabel}
                </TableCell>
                <TableCell className="max-w-[170px] truncate text-sm" title={check.payee ?? check.payor ?? undefined}>
                  {check.payee ?? check.payor ?? "—"}
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums">{formatCurrency(check.amount)}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{toPhtDateString(check.checkDate)}</TableCell>
                <TableCell>
                  <StatusBadge status={check.status} />
                  {check.isStale ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        "ml-1 text-[10px] font-semibold",
                        "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300",
                      )}
                    >
                      Stale
                    </Badge>
                  ) : check.isPdc ? (
                    <Badge variant="outline" className={cn("ml-1 text-[10px] font-semibold", "border-border bg-muted text-muted-foreground")}>
                      PDC
                    </Badge>
                  ) : null}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Actions for check ${check.checkNo}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                      <DropdownMenuLabel className="truncate text-xs">{check.checkNo}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {allowedActions(check).map((entry) => (
                        <DropdownMenuItem
                          key={entry.action}
                          onSelect={() => onAction(check, entry.action)}
                          className={entry.destructive ? "text-red-600 focus:text-red-600" : undefined}
                        >
                          {entry.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-border xl:hidden">
        {rows.map((check) => (
          <li key={check.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={check.checkNo}>
                  {check.checkNo} · {check.direction === "ISSUED" ? "Issued" : "Received"}
                </p>
                <p className="truncate text-xs text-muted-foreground" title={check.bankAccountLabel}>
                  {check.bankAccountLabel} · {toPhtDateString(check.checkDate)}
                </p>
              </div>
              <StatusBadge status={check.status} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="text-sm tabular-nums">{formatCurrency(check.amount)}</span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[180px]">
                  {allowedActions(check).map((entry) => (
                    <DropdownMenuItem
                      key={entry.action}
                      onSelect={() => onAction(check, entry.action)}
                      className={entry.destructive ? "text-red-600 focus:text-red-600" : undefined}
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

      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
          <p className="text-sm text-muted-foreground tabular-nums">
            Showing {first}–{last} of {checks.length}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(safePage - 1)}
              disabled={safePage <= 1}
            >
              <ChevronLeft className="mr-1 size-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              Page {safePage} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onPageChange(safePage + 1)}
              disabled={safePage >= pageCount}
            >
              Next
              <ChevronRight className="ml-1 size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
