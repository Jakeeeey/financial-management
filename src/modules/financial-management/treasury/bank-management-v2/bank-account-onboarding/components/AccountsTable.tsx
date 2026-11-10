"use client";

import { Landmark, MoreVertical, Pencil } from "lucide-react";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatNumber } from "@/lib/utils";

import { toPhtDateString } from "../pht";
import type { BankAccountV2 } from "../types";
import { StatusBadge } from "./StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TablePager } from "./TablePager";

const COLUMN_COUNT = 9;

type AccountsTableProps = {
  accounts: BankAccountV2[];
  isLoading: boolean;
  total: number;
  /** Accounts in the register before filters, so a filtered count is never read as the total. */
  registerTotal: number;
  isFiltered: boolean;
  page: number;
  pageSize: number;
  onEdit: (account: BankAccountV2) => void;
  onPageChange: (page: number) => void;
  /** Filter band rendered inside the register card, like every other V2 table. */
  filters: ReactNode;
};

function bankBranch(account: BankAccountV2): string {
  return account.branch ? `${account.bankName} – ${account.branch}` : account.bankName;
}

function glLabel(account: BankAccountV2): string {
  if (!account.glCode) return "Not linked";
  return account.glTitle ? `${account.glCode} · ${account.glTitle}` : account.glCode;
}

function onboardedOn(account: BankAccountV2): string {
  return toPhtDateString(account.effectiveDate ?? account.createdAt) || "—";
}

/** Register table with the card fallback below xl, per QA.md responsive rules. */
export function AccountsTable({
  accounts,
  isLoading,
  total,
  registerTotal,
  isFiltered,
  page,
  pageSize,
  onEdit,
  onPageChange,
  filters,
}: AccountsTableProps) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <section
      aria-label="Registered bank accounts"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-blue-500/70 bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Registered accounts</h2>
          <p className="text-xs text-muted-foreground">
            Active accounts appear in purchase order payment, sales order collection and disbursement lists. Dormant and
            closed accounts do not.
          </p>
        </div>
        <Badge variant="outline" className="tabular-nums text-[11px]">
          {isFiltered
            ? `${formatNumber(total)} of ${formatNumber(registerTotal)} accounts`
            : `${formatNumber(registerTotal)} accounts`}
        </Badge>
      </header>

      {filters}

      <div className="hidden overflow-x-auto min-[1300px]:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="max-w-[220px]">Bank &amp; branch</TableHead>
                <TableHead className="max-w-[150px]">Account no.</TableHead>
                <TableHead className="max-w-[180px]">Account holder</TableHead>
                <TableHead className="max-w-[110px]">Type</TableHead>
                <TableHead className="max-w-[180px]">Linked GL</TableHead>
                <TableHead className="max-w-[140px] text-right">Book balance</TableHead>
                <TableHead className="max-w-[110px]">Onboarded on</TableHead>
                <TableHead className="max-w-[100px]">Status</TableHead>
                <TableHead className="w-[56px] text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={COLUMN_COUNT}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Landmark aria-hidden="true" className="size-5" />
                      <span className="text-sm">No account matches these filters. Reset them to see the register.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                accounts.map((account) => (
                  <TableRow key={account.bankId}>
                    <TableCell className="max-w-[220px]">
                      <div className="max-w-[200px] truncate font-medium" title={bankBranch(account)}>
                        {account.bankName}
                      </div>
                      {account.branch ? (
                        <div className="max-w-[200px] truncate text-xs text-muted-foreground" title={account.branch}>
                          {account.branch}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell
                      className="max-w-[150px] truncate tabular-nums"
                      title={account.accountNumber}
                    >
                      {account.accountNumber || "—"}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate" title={account.accountName ?? undefined}>
                      {account.accountName ?? "Not recorded"}
                    </TableCell>
                    <TableCell className="max-w-[110px] truncate" title={account.accountType ?? undefined}>
                      {account.accountType
                        ? account.currency && account.currency !== "PHP"
                          ? `${account.accountType} · ${account.currency}`
                          : account.accountType
                        : "Not recorded"}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      {account.glCode ? (
                        <>
                          <p className="truncate" title={account.glCode}>
                            {account.glCode}
                          </p>
                          {account.glTitle ? (
                            <p className="truncate text-xs text-muted-foreground" title={account.glTitle}>
                              {account.glTitle}
                            </p>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not linked</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[140px] text-right tabular-nums whitespace-nowrap">
                      {formatCurrency(account.bookBalance, account.currency)}
                    </TableCell>
                    <TableCell className="max-w-[110px] tabular-nums">{onboardedOn(account)}</TableCell>
                    <TableCell className="max-w-[100px]">
                      <StatusBadge status={account.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            aria-label={`Actions for ${account.bankName} ${account.accountNumber}`}
                          >
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onSelect={() => onEdit(account)}>Edit account</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
      </div>

      <ul className="divide-y divide-border min-[1300px]:hidden">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <li key={index} className="p-4">
              <Skeleton className="h-16 w-full" />
            </li>
          ))
        ) : accounts.length === 0 ? (
          <li className="flex h-24 flex-col items-center justify-center gap-2 p-4 text-center text-muted-foreground">
            <Landmark aria-hidden="true" className="size-5" />
            <span className="text-sm">No account matches these filters. Reset them to see the register.</span>
          </li>
        ) : (
          accounts.map((account) => (
            <li key={account.bankId} className="space-y-2 p-4">
              <p className="font-mono text-xs text-muted-foreground">BA-{account.bankId}</p>
              <p className="font-medium break-words" title={bankBranch(account)}>
                {bankBranch(account)}
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <div className="col-span-2 min-w-0">
                  <dt className="text-xs text-muted-foreground">Account no.</dt>
                  <dd className="truncate tabular-nums" title={account.accountNumber}>
                    {account.accountNumber || "No account number"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Account holder</dt>
                  <dd className="truncate" title={account.accountName ?? undefined}>
                    {account.accountName ?? "—"}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Type</dt>
                  <dd className="truncate" title={account.accountType ?? undefined}>
                    {account.accountType ?? "—"}
                  </dd>
                </div>
                <div className="col-span-2 min-w-0">
                  <dt className="text-xs text-muted-foreground">Linked GL</dt>
                  <dd className="truncate" title={glLabel(account)}>
                    {glLabel(account)}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Book balance</dt>
                  <dd className="tabular-nums">{formatCurrency(account.bookBalance, account.currency)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs text-muted-foreground">Onboarded</dt>
                  <dd className="tabular-nums">{onboardedOn(account)}</dd>
                </div>
                <div className="col-span-2 min-w-0">
                  <dt className="text-xs text-muted-foreground">Status</dt>
                  <dd>
                    <StatusBadge status={account.status} />
                  </dd>
                </div>
              </dl>
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={`Edit ${account.bankName} ${account.accountNumber}`}
                  onClick={() => onEdit(account)}
                >
                  <Pencil className="mr-2 size-4" />
                  Edit
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      <TablePager
        page={page}
        pageCount={pageCount}
        total={total}
        pageSize={pageSize}
        onPageChange={onPageChange}
        className="border-t border-border/50 px-4 py-3"
      />
    </section>
  );
}
