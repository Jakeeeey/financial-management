"use client";

import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { CashFlowSummary, GroupedCashFlowEntries } from "../types/cash-flow.schema";
import { formatCashFlowDate } from "../utils/reporting-dates";

interface CashFlowStatementViewProps {
  groupedEntries: GroupedCashFlowEntries;
  entriesCount: number;
  summary: Pick<
    CashFlowSummary,
    | "operatingActivities"
    | "investingActivities"
    | "financingActivities"
    | "netIncreaseInCash"
    | "uncategorizedNetMovement"
    | "registerNetMovement"
    | "reconciliationDifference"
  >;
  startDate: string;
  endDate: string;
  isLoading: boolean;
  hasLoadedReport: boolean;
}

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const transactionDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

function formatAmount(value: number) {
  return currencyFormatter.format(Math.round(value * 100) / 100);
}

function formatTransactionDate(value: string | null | undefined) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : transactionDateFormatter.format(date);
}

export function CashFlowStatementView({
  groupedEntries,
  entriesCount,
  summary,
  startDate,
  endDate,
  isLoading,
  hasLoadedReport,
}: CashFlowStatementViewProps) {
  const sections = [
    { key: "operating", title: "Operating activities", entries: groupedEntries.operating, total: summary.operatingActivities },
    { key: "investing", title: "Investing activities", entries: groupedEntries.investing, total: summary.investingActivities },
    { key: "financing", title: "Financing activities", entries: groupedEntries.financing, total: summary.financingActivities },
    { key: "other", title: "Uncategorized transactions", entries: groupedEntries.other, total: summary.uncategorizedNetMovement ?? 0 },
  ] as const;

  if (isLoading && !hasLoadedReport) {
    return (
      <div className="space-y-3" aria-label="Loading cash flow statement">
        {[0, 1, 2, 3].map((section) => (
          <div key={section} className="h-16 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  if (!hasLoadedReport) {
    return (
      <p role="status" className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        The statement is unavailable until report data loads.
      </p>
    );
  }

  return (
    <div className="space-y-4" aria-busy={isLoading}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-semibold">Cash flow statement</h3>
          <p className="text-sm text-muted-foreground">
            Period activity from {formatCashFlowDate(startDate)} to {formatCashFlowDate(endDate)}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">{entriesCount} {entriesCount === 1 ? "transaction" : "transactions"}</p>
      </div>

      {entriesCount === 0 ? (
        <p role="status" className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No transactions were returned for this reporting period.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table className="min-w-[620px]">
            <caption className="sr-only">Cash flow activity and section subtotals for the applied period</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Activity line / reference</TableHead>
                <TableHead className="whitespace-nowrap">Transaction date</TableHead>
                <TableHead className="text-right">Net cash movement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sections.map((section) => (
                <Fragment key={section.key}>
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={3} className="font-semibold">
                      {section.title} <span className="font-normal text-muted-foreground">({section.entries.length})</span>
                    </TableCell>
                  </TableRow>
                  {section.entries.length === 0 ? (
                    <TableRow key={`${section.key}-empty`}>
                      <TableCell colSpan={3} className="py-2 text-sm text-muted-foreground">No activity in this section.</TableCell>
                    </TableRow>
                  ) : section.entries.map((entry, index) => (
                    <TableRow key={`${section.key}-${entry.transactionRef ?? "entry"}-${index}`}>
                      <TableCell className="max-w-[420px]">
                        <div className="font-medium">{entry.transactionRef?.trim() || "Transaction reference not provided"}</div>
                        <div className="text-xs text-muted-foreground">
                          Activity label: {entry.cashFlowActivity?.trim() || "Not provided"}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatTransactionDate(entry.transactionDate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.netCashFlow == null ? "Not provided" : formatAmount(entry.netCashFlow)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-b-2">
                    <TableCell colSpan={2} className="text-right font-medium text-muted-foreground">
                      {section.key === "other" ? "Uncategorized subtotal (excluded from Net Change in Cash)" : `${section.title} subtotal`}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{formatAmount(section.total)}</TableCell>
                  </TableRow>
                </Fragment>
              ))}
              <TableRow className="bg-muted/50 font-bold">
                <TableCell colSpan={2}>Net Change in Cash (Operating + Investing + Financing)</TableCell>
                <TableCell className="text-right tabular-nums">{formatAmount(summary.netIncreaseInCash)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={2} className="text-right font-medium text-muted-foreground">Difference from all-register movement</TableCell>
                <TableCell className="text-right tabular-nums">{formatAmount(summary.reconciliationDifference ?? 0)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cash balance reconciliation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Opening cash and cash equivalents</dt>
              <dd className="font-medium">Not available</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Net change in cash</dt>
              <dd className="font-medium tabular-nums">{formatAmount(summary.netIncreaseInCash)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Closing cash and cash equivalents</dt>
              <dd className="font-medium">Not available</dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            A balance reconciliation cannot be completed because the current report response does not include verified opening and closing cash balances.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Report basis and coverage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            This view presents period transaction activity using the activity labels returned by the report source. Uncategorized transactions remain visible and are excluded from Net Change in Cash under the current calculation.
          </p>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-xs text-muted-foreground">Reporting method</dt><dd>Not disclosed in report data</dd></div>
            <div><dt className="text-xs text-muted-foreground">Cash-account scope</dt><dd>Not disclosed in report data</dd></div>
            <div><dt className="text-xs text-muted-foreground">Transaction-status scope</dt><dd>Not disclosed in report data</dd></div>
            <div><dt className="text-xs text-muted-foreground">Source-module coverage</dt><dd>Not disclosed in report data</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">
            Confirm these reporting rules before using this activity view as a complete cash-flow reconciliation or adding account and status filters.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
