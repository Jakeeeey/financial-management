"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { ExpectedCollectionRecord } from "../types";
import { currentManilaDateOnly, formatReportDate, parseDateOnly } from "../utils/date";
import { InvoiceDetails } from "./InvoiceDetails";

const pesoFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 10;

type InvoiceRowStatus = "settled" | "critical" | "elevated" | "mellow";

const rowStatusClasses: Record<InvoiceRowStatus, string> = {
  settled: "bg-emerald-50/80 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50",
  critical: "bg-red-50/80 hover:bg-red-100/80 dark:bg-red-950/30 dark:hover:bg-red-950/50",
  elevated: "bg-orange-50/70 hover:bg-orange-100/70 dark:bg-orange-950/25 dark:hover:bg-orange-950/40",
  mellow: "bg-yellow-50/50 hover:bg-yellow-100/70 dark:bg-yellow-950/15 dark:hover:bg-yellow-950/25",
};

const rowStatusAccentClasses: Record<InvoiceRowStatus, string> = {
  settled: "border-l-4 border-l-emerald-500",
  critical: "border-l-4 border-l-red-500",
  elevated: "border-l-4 border-l-orange-500",
  mellow: "border-l-4 border-l-yellow-500",
};

function formatPeso(value: number): string {
  return pesoFormatter.format(value);
}

function getInvoiceRowStatus(record: ExpectedCollectionRecord, today: string): InvoiceRowStatus {
  if (record.outstandingBalance === 0) return "settled";

  const dueDate = parseDateOnly(record.dueDate);
  const currentDate = parseDateOnly(today);
  if (!dueDate || !currentDate) return "mellow";

  const daysUntilDue = Math.round((dueDate.getTime() - currentDate.getTime()) / MILLISECONDS_PER_DAY);
  if (daysUntilDue <= 3) return "critical";
  if (daysUntilDue <= 7) return "elevated";
  return "mellow";
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Invoice status color legend">
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-emerald-500" />Settled</span>
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-red-500" />Due soon or overdue</span>
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-orange-500" />Due within 7 days</span>
      <span className="inline-flex items-center gap-1"><span className="size-2 rounded-full bg-yellow-500" />Due later</span>
    </div>
  );
}

interface InvoicesTabProps {
  records: ExpectedCollectionRecord[];
  loading: boolean;
  hasActiveFilters: boolean;
}

export function InvoicesTab({ records, loading, hasActiveFilters }: InvoicesTabProps) {
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-3 pt-6">
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {hasActiveFilters ? "No invoices match the selected filters." : "No invoices are due during this week."}
        </CardContent>
      </Card>
    );
  }

  const sortedRecords = [...records].sort((left, right) => {
    const dueDateComparison = (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31");
    return dueDateComparison || left.invoiceNo.localeCompare(right.invoiceNo);
  });
  const totalOutstanding = sortedRecords.reduce((sum, record) => sum + record.outstandingBalance, 0);
  const today = currentManilaDateOnly();
  const pageCount = Math.ceil(sortedRecords.length / PAGE_SIZE);
  const currentPageIndex = Math.min(pageIndex, Math.max(pageCount - 1, 0));
  const pageRecords = sortedRecords.slice(currentPageIndex * PAGE_SIZE, (currentPageIndex + 1) * PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Invoices ({sortedRecords.length})</CardTitle>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <StatusLegend />
          <span className="text-sm font-semibold text-muted-foreground">Total: {formatPeso(totalOutstanding)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Salesman</TableHead>
              <TableHead>Division</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead className="text-right">Outstanding balance</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRecords.map((record) => {
              const invoiceKey = `${record.invoiceId}-${record.invoiceNo}`;
              const isExpanded = expandedInvoices.has(invoiceKey);
              const rowStatus = getInvoiceRowStatus(record, today);

              return (
                <Fragment key={invoiceKey}>
                  <TableRow data-state={isExpanded ? "selected" : undefined} data-status={rowStatus} className={rowStatusClasses[rowStatus]}>
                    <TableCell className={`${rowStatusAccentClasses[rowStatus]} font-medium`}>{record.invoiceNo || "N/A"}</TableCell>
                    <TableCell>
                      <div>{record.customerName || "N/A"}</div>
                      {record.customerCode && <div className="text-xs text-muted-foreground">{record.customerCode}</div>}
                    </TableCell>
                    <TableCell>{record.salesman || "Unassigned Salesman"}</TableCell>
                    <TableCell>{record.division || "Unassigned Division"}</TableCell>
                    <TableCell>{formatReportDate(record.dueDate)}</TableCell>
                    <TableCell className="text-right font-medium">{formatPeso(record.outstandingBalance)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-expanded={isExpanded}
                        onClick={() => {
                          setExpandedInvoices((current) => {
                            const next = new Set(current);
                            if (next.has(invoiceKey)) next.delete(invoiceKey);
                            else next.add(invoiceKey);
                            return next;
                          });
                        }}
                      >
                        {isExpanded ? "Hide details" : "View details"}
                        <ChevronDown className={`ml-2 size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <TableRow>
                      <TableCell colSpan={7} className="bg-muted/20 p-4">
                        <InvoiceDetails record={record} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        {pageCount > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
            <span className="text-sm text-muted-foreground">
              Showing {currentPageIndex * PAGE_SIZE + 1}–{Math.min((currentPageIndex + 1) * PAGE_SIZE, sortedRecords.length)} of {sortedRecords.length} invoices
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPageIndex((current) => Math.max(current - 1, 0))}
                disabled={currentPageIndex === 0}
              >
                <ChevronLeft className="mr-1 size-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">Page {currentPageIndex + 1} of {pageCount}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPageIndex((current) => Math.min(current + 1, pageCount - 1))}
                disabled={currentPageIndex === pageCount - 1}
              >
                Next
                <ChevronRight className="ml-1 size-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
