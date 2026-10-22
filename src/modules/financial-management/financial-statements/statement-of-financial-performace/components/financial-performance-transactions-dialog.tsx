"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FinancialPerformanceEntry,
  FinancialPerformanceReportCriteria,
  FinancialPerformanceTransactionsResponse,
} from "../types";
import { getFinancialPerformanceTransactions } from "../services/financial-performance.service";
import { formatFinancialPerformanceDateRange } from "../utils/periods";
import { describeFinancialPerformanceStatus, FINANCIAL_PERFORMANCE_SOURCE_MODULES } from "../utils/report-coverage";

const PAGE_SIZE = 25;

const formatMoney = (amount: number) => new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(amount);

const formatTransactionDate = (value: string | null) => {
  if (!value) return "—";
  const normalized = value.replace(" ", "T");
  const date = new Date(/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(normalized) ? normalized : `${normalized}+08:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(date);
};

interface FinancialPerformanceTransactionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: FinancialPerformanceEntry | null;
  criteria: FinancialPerformanceReportCriteria;
}

export function FinancialPerformanceTransactionsDialog({
  open,
  onOpenChange,
  account,
  criteria,
}: FinancialPerformanceTransactionsDialogProps) {
  const key = account
    ? JSON.stringify([account.coaId, account.division, account.department, criteria])
    : "no-account";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-6xl flex-col overflow-hidden sm:max-w-6xl">
        {account && (
          <TransactionsDialogContent
            key={key}
            account={account}
            criteria={criteria}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TransactionsDialogContent({
  account,
  criteria,
}: {
  account: FinancialPerformanceEntry;
  criteria: FinancialPerformanceReportCriteria;
}) {
  const [page, setPage] = useState(0);
  const [response, setResponse] = useState<FinancialPerformanceTransactionsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    void getFinancialPerformanceTransactions({
      account,
      criteria,
      page,
      pageSize: PAGE_SIZE,
      signal: controller.signal,
    })
      .then(result => {
        setResponse(result);
        setError(null);
      })
      .catch(reason => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "Failed to load account transactions.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [account, criteria, page, retryCount]);

  const divisionLabel = account.division || "Unassigned";
  const departmentLabel = account.department || "Unassigned";
  const appliedDivision = criteria.divisionName === "all" ? "All divisions" : criteria.divisionName;
  const appliedDepartment = criteria.departmentName === "all" ? "All departments" : criteria.departmentName;

  const retry = () => {
    setIsLoading(true);
    setError(null);
    setResponse(null);
    setRetryCount(value => value + 1);
  };

  const changePage = (nextPage: number) => {
    setIsLoading(true);
    setError(null);
    setResponse(null);
    setPage(nextPage);
  };

  return (
    <>
      <DialogHeader className="shrink-0">
        <DialogTitle>Account transactions</DialogTitle>
        <DialogDescription>
          {account.glCode || "GL code unavailable"} · {account.accountTitle} · {account.reportSection || "Account breakdown"}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 space-y-4 overflow-y-auto pr-1">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="Report account amount" value={formatMoney(account.amount)} />
          <Metric label="Matched transaction net" value={response ? formatMoney(response.netActivity) : "—"} />
          <Metric label="Total debit" value={response ? formatMoney(response.totalDebit) : "—"} />
          <Metric label="Total credit" value={response ? formatMoney(response.totalCredit) : "—"} />
        </div>

        <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Applied report:</span>{" "}
          {formatFinancialPerformanceDateRange(criteria.startDate, criteria.endDate)} · {describeFinancialPerformanceStatus(criteria.status)} · {appliedDivision} · {appliedDepartment}
          <span className="mt-1 block"><span className="font-medium text-foreground">Account row:</span> {divisionLabel} · {departmentLabel}</span>
          <span className="mt-1 block"><span className="font-medium text-foreground">Included sources:</span> {FINANCIAL_PERFORMANCE_SOURCE_MODULES.join(", ")}</span>
        </div>

        {error && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm" role="alert">
            <span>{error}</span>
            <Button type="button" variant="outline" size="sm" onClick={retry}>
              Retry
            </Button>
          </div>
        )}

        <div className="min-w-0 overflow-x-auto rounded-md border" aria-busy={isLoading}>
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Journal / reference</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Division</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    Loading account transactions…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && response?.items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No transactions match this account and report scope.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !error && response?.items.map((item, index) => (
                <TableRow key={`${item.journalEntryId}-${item.transactionRef}-${index}`}>
                  <TableCell className="whitespace-nowrap">{formatTransactionDate(item.transactionDate)}</TableCell>
                  <TableCell>
                    <span className="font-medium">{item.journalEntryId || "—"}</span>
                    {item.transactionRef && item.transactionRef !== item.journalEntryId && (
                      <span className="block text-xs text-muted-foreground">{item.transactionRef}</span>
                    )}
                  </TableCell>
                  <TableCell>{item.sourceModule || "—"}</TableCell>
                  <TableCell className="max-w-[260px] whitespace-normal">{item.description || "—"}</TableCell>
                  <TableCell>{item.division || "Unassigned"}</TableCell>
                  <TableCell>{item.department || "Unassigned"}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatMoney(item.debit)}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums">{formatMoney(item.credit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {response && response.totalRows > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground" aria-live="polite">
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, response.totalRows)} of {response.totalRows} transactions
            </span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={isLoading || page === 0} onClick={() => changePage(page - 1)}>
                Previous
              </Button>
              <span className="tabular-nums">Page {page + 1} of {Math.max(response.totalPages, 1)}</span>
              <Button type="button" variant="outline" size="sm" disabled={isLoading || page + 1 >= response.totalPages} onClick={() => changePage(page + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold tabular-nums" title={value}>{value}</p>
    </div>
  );
}
