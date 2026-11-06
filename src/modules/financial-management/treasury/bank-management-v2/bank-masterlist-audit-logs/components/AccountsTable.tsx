"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import { LIST_PAGE_SIZE, statusLabel, statusTone, toneClass } from "../constants";
import { toPhtDateString } from "../pht";
import type { BankAccountV2 } from "../types";
import { TablePager } from "./TablePager";

type Props = {
  accounts: BankAccountV2[];
  isLoading: boolean;
  page: number;
  pageCount: number;
  total: number;
  onPageChange: (page: number) => void;
};

const COLUMNS = 9;

function bankBranch(account: BankAccountV2): string {
  return account.branch ? `${account.bankName} – ${account.branch}` : account.bankName;
}

/** Prototype sub-line under the bank name: holder · account type, skipping absent parts. */
function holderLine(account: BankAccountV2): string {
  return [account.accountName, account.accountType].filter(Boolean).join(" · ");
}

/** FSD 1.6 account masterlist: one row per bank account with its GL, IFRS category and book balance. */
export function AccountsTable({ accounts, isLoading, page, pageCount, total, onPageChange }: Props) {
  const start = (page - 1) * LIST_PAGE_SIZE;
  const rows = accounts.slice(start, start + LIST_PAGE_SIZE);

  return (
    <>
      <Card className="hidden overflow-hidden border-border/50 shadow-none xl:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[90px]">Bank code</TableHead>
                  <TableHead className="min-w-[220px]">Bank &amp; branch</TableHead>
                  <TableHead className="w-[160px]">Account no.</TableHead>
                  <TableHead className="w-[90px]">Currency</TableHead>
                  <TableHead className="w-[150px]">IFRS 9 category</TableHead>
                  <TableHead className="w-[140px]">Linked GL</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[150px] text-right">Book balance</TableHead>
                  <TableHead className="w-[130px]">Last reconciled (PHT)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: COLUMNS }).map((__, cell) => (
                        <TableCell key={cell}>
                          <Skeleton className="h-4 w-full max-w-[120px]" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}

                {!isLoading && accounts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={COLUMNS} className="h-24 text-center text-sm text-muted-foreground">
                      No account matches these filters.
                    </TableCell>
                  </TableRow>
                )}

                {!isLoading &&
                  rows.map((account) => (
                    <TableRow key={account.bankId}>
                      <TableCell className="tabular-nums text-muted-foreground">BA-{account.bankId}</TableCell>
                      <TableCell className="max-w-[280px]">
                        <p className="truncate" title={bankBranch(account)}>
                          {bankBranch(account)}
                        </p>
                        {holderLine(account) ? (
                          <p className="truncate text-xs text-muted-foreground" title={holderLine(account)}>
                            {holderLine(account)}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate" title={account.accountNumber}>
                        {account.accountNumber}
                      </TableCell>
                      <TableCell>{account.currency}</TableCell>
                      <TableCell className="max-w-[150px] truncate" title={account.ifrsCategory}>
                        {account.ifrsCategory}
                      </TableCell>
                      <TableCell className="max-w-[140px] truncate" title={account.glCode ?? undefined}>
                        {account.glCode ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={toneClass(statusTone(account.status))}>
                          {statusLabel(account.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(account.bookBalance)}</TableCell>
                      <TableCell className="tabular-nums">
                        {account.lastReconciledAt ? toPhtDateString(account.lastReconciledAt) : "Never"}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          {!isLoading && (
            <TablePager
              page={page}
              pageCount={pageCount}
              total={total}
              shown={rows.length}
              onPageChange={onPageChange}
              className="border-t px-4 py-3"
            />
          )}
        </CardContent>
      </Card>

      <ul className="divide-y divide-border rounded-2xl border border-border/50 xl:hidden">
        {isLoading &&
          Array.from({ length: 3 }).map((_, index) => (
            <li key={index} className="space-y-2 p-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </li>
          ))}
        {!isLoading && accounts.length === 0 && (
          <li className="p-6 text-center text-sm text-muted-foreground">No account matches these filters.</li>
        )}
        {!isLoading &&
          rows.map((account) => (
            <li key={account.bankId} className="space-y-1 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate font-medium" title={account.bankName}>
                  {account.bankName}
                </p>
                <Badge variant="outline" className={toneClass(statusTone(account.status))}>
                  {statusLabel(account.status)}
                </Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">{account.accountNumber}</p>
              <p className="text-sm tabular-nums">{formatCurrency(account.bookBalance)}</p>
            </li>
          ))}
      </ul>

      {!isLoading && (
        <TablePager
          page={page}
          pageCount={pageCount}
          total={total}
          shown={rows.length}
          onPageChange={onPageChange}
          className="px-1 pt-2 xl:hidden"
        />
      )}
    </>
  );
}
