"use client";

import { Fragment, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { DateRange, ExpectedCollectionRecord } from "../types";
import { currentManilaDateOnly, formatReportDate } from "../utils/date";
import {
  getInvoiceUrgency,
  invoiceRowStatusAccentClasses,
  invoiceRowStatusClasses,
} from "../utils/invoiceUrgency";
import { InvoiceDetails } from "./InvoiceDetails";

const pesoFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const PAGE_SIZE = 10;

type InvoiceSort = "due-date" | "urgency" | "balance" | "customer" | "salesman";

function formatPeso(value: number): string {
  return pesoFormatter.format(value);
}

interface InvoicesTabProps {
  records: ExpectedCollectionRecord[];
  loading: boolean;
  hasActiveFilters: boolean;
  range: DateRange;
  onClearFilters: () => void;
}

export function InvoicesTab({ records, loading, hasActiveFilters, range, onClearFilters }: InvoicesTabProps) {
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);
  const [sortBy, setSortBy] = useState<InvoiceSort>("due-date");

  if (loading) {
    return (
      <Card role="status" aria-live="polite">
        <CardContent className="space-y-3 pt-6">
          <span className="sr-only">Loading expected collection invoices.</span>
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center text-sm text-muted-foreground">
          <p>
            {hasActiveFilters
              ? "No invoices match the selected filters."
              : `No invoices are due from ${formatReportDate(range.startDate)} to ${formatReportDate(range.endDate)}.`}
          </p>
          {hasActiveFilters && (
            <Button type="button" variant="outline" size="sm" onClick={onClearFilters}>
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const today = currentManilaDateOnly();
  const sortedRecords = [...records].sort((left, right) => {
    if (sortBy === "urgency") {
      const urgencyDifference = getInvoiceUrgency(right, today).rank - getInvoiceUrgency(left, today).rank;
      if (urgencyDifference) return urgencyDifference;
    }
    if (sortBy === "balance") {
      const balanceDifference = right.outstandingBalance - left.outstandingBalance;
      if (balanceDifference) return balanceDifference;
    }
    if (sortBy === "customer") {
      const customerDifference = left.customerName.localeCompare(right.customerName);
      if (customerDifference) return customerDifference;
    }
    if (sortBy === "salesman") {
      const salesmanDifference = (left.salesman || "").localeCompare(right.salesman || "");
      if (salesmanDifference) return salesmanDifference;
    }
    const dueDateComparison = (left.dueDate || "9999-12-31").localeCompare(right.dueDate || "9999-12-31");
    return dueDateComparison || left.invoiceNo.localeCompare(right.invoiceNo);
  });
  const totalOutstanding = sortedRecords.reduce((sum, record) => sum + record.outstandingBalance, 0);
  const customerCount = new Set(sortedRecords.map((record) => record.customerCode || record.customerName)).size;
  const overdueAmount = sortedRecords.reduce((sum, record) => {
    return getInvoiceUrgency(record, today).status === "overdue" ? sum + record.outstandingBalance : sum;
  }, 0);
  const dueSoonAmount = sortedRecords.reduce((sum, record) => {
    const urgency = getInvoiceUrgency(record, today);
    return urgency.daysUntilDue !== null && urgency.daysUntilDue >= 0 && urgency.daysUntilDue <= 7
      ? sum + record.outstandingBalance
      : sum;
  }, 0);
  const pageCount = Math.ceil(sortedRecords.length / PAGE_SIZE);
  const currentPageIndex = Math.min(pageIndex, Math.max(pageCount - 1, 0));
  const pageRecords = sortedRecords.slice(currentPageIndex * PAGE_SIZE, (currentPageIndex + 1) * PAGE_SIZE);

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Invoices ({sortedRecords.length})</CardTitle>
        <div className="flex items-center gap-2">
          <label htmlFor="expected-collection-sort" className="text-sm text-muted-foreground">Sort by</label>
          <Select
            value={sortBy}
            onValueChange={(value) => {
              setSortBy(value as InvoiceSort);
              setPageIndex(0);
              setExpandedInvoices(new Set());
            }}
          >
            <SelectTrigger id="expected-collection-sort" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due-date">Due date</SelectItem>
              <SelectItem value="urgency">Urgency</SelectItem>
              <SelectItem value="balance">Highest balance</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="salesman">Salesman</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Expected collection summary">
          <SummaryMetric label="Invoices" value={String(sortedRecords.length)} />
          <SummaryMetric label="Customers" value={String(customerCount)} />
          <SummaryMetric label="Total outstanding" value={formatPeso(totalOutstanding)} />
          <SummaryMetric label="Overdue amount" value={formatPeso(overdueAmount)} />
          <SummaryMetric label="Due within 7 days" value={formatPeso(dueSoonAmount)} />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="hidden md:table-cell">Salesman</TableHead>
              <TableHead className="hidden lg:table-cell">Division</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Outstanding balance</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRecords.map((record) => {
              const invoiceKey = [record.invoiceId, record.invoiceNo, record.orderId, record.dueDate].join("-");
              const detailsId = `expected-collection-${invoiceKey.replace(/[^a-zA-Z0-9_-]/g, "-")}-details`;
              const isExpanded = expandedInvoices.has(invoiceKey);
              const urgency = getInvoiceUrgency(record, today);
              const rowStatus = urgency.status;

              return (
                <Fragment key={invoiceKey}>
                  <TableRow data-state={isExpanded ? "selected" : undefined} data-status={rowStatus} className={invoiceRowStatusClasses[rowStatus]}>
                    <TableCell className={`${invoiceRowStatusAccentClasses[rowStatus]} font-medium`}>{record.invoiceNo || "N/A"}</TableCell>
                    <TableCell>
                      <div>{record.customerName || "N/A"}</div>
                      {record.customerCode && <div className="text-xs text-muted-foreground">{record.customerCode}</div>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">{record.salesman || "Unassigned Salesman"}</TableCell>
                    <TableCell className="hidden lg:table-cell">{record.division || "Unassigned Division"}</TableCell>
                    <TableCell>{formatReportDate(record.dueDate)}</TableCell>
                    <TableCell>
                      <Badge variant={urgency.badgeVariant}>
                        {urgency.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatPeso(record.outstandingBalance)}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        aria-expanded={isExpanded}
                        aria-controls={detailsId}
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
                    <TableRow id={detailsId}>
                      <TableCell colSpan={8} className="bg-muted/20 p-4">
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
          <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4" aria-live="polite">
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

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  );
}
