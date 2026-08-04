"use client";

import { Fragment, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { DateRange, SalesmanCollectionGroup } from "../types";
import { currentManilaDateOnly, formatReportDate } from "../utils/date";
import {
  getInvoiceUrgency,
  invoiceRowStatusAccentClasses,
  invoiceRowStatusClasses,
} from "../utils/invoiceUrgency";
import { HighlightedText } from "./HighlightedText";
import { InvoiceDetails } from "./InvoiceDetails";

const pesoFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
const PAGE_SIZE = 10;

function formatPeso(value: number): string {
  return pesoFormatter.format(value);
}

interface SalesmanTabProps {
  groups: SalesmanCollectionGroup[];
  loading: boolean;
  hasActiveFilters: boolean;
  range: DateRange;
  invoiceQuery: string;
  customerQuery: string;
  onClearFilters: () => void;
}

function SalesmanGroupCard({
  group,
  invoiceQuery,
  customerQuery,
}: {
  group: SalesmanCollectionGroup;
  invoiceQuery: string;
  customerQuery: string;
}) {
  const [open, setOpen] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [invoicePageIndex, setInvoicePageIndex] = useState(0);
  const invoicePageCount = Math.ceil(group.records.length / PAGE_SIZE);
  const currentInvoicePage = Math.min(invoicePageIndex, Math.max(invoicePageCount - 1, 0));
  const pageRecords = group.records.slice(currentInvoicePage * PAGE_SIZE, (currentInvoicePage + 1) * PAGE_SIZE);
  const today = currentManilaDateOnly();
  const settledInvoiceCount = group.records.filter((record) => record.outstandingBalance === 0).length;
  const outstandingInvoiceCount = group.records.filter((record) => record.outstandingBalance > 0).length;

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="size-4 text-muted-foreground" />
                {group.name}
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{group.divisions.join(", ")}</p>
            </div>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="outline" size="sm" aria-expanded={open}>
                {open ? "Hide details" : "View more details"}
                <ChevronDown className={`ml-2 size-4 transition-transform ${open ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <SummaryMetric label="Invoices" value={String(group.invoiceCount)} />
            <SummaryMetric label="Customers" value={String(group.customerCount)} />
            <SummaryMetric label="Settled Invoices" value={String(settledInvoiceCount)} />
            <SummaryMetric label="Outstanding Invoices" value={String(outstandingInvoiceCount)} />
            <SummaryMetric label="Total Outstanding" value={formatPeso(group.outstandingBalance)} />
          </div>
        </CardHeader>

        <CardContent>
          <CollapsibleContent className="space-y-3">
            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={group.dailyOutstanding} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    fontSize={12}
                    interval={group.dailyOutstanding.length > 12 ? Math.ceil(group.dailyOutstanding.length / 12) - 1 : 0}
                  />
                  <YAxis
                    width={84}
                    fontSize={10}
                    tickFormatter={(value) => `₱${Number(value).toLocaleString("en-PH", { maximumFractionDigits: 0 })}`}
                  />
                  <Tooltip
                    formatter={(value) => [formatPeso(Number(value)), "Outstanding"]}
                    labelFormatter={(label) => `Due ${label}`}
                  />
                  <Bar dataKey="amount" name="Outstanding" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={42} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Outstanding balance</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRecords.map((record) => {
                  const invoiceKey = [record.invoiceId, record.invoiceNo, record.orderId, record.dueDate].join("-");
                  const detailsId = `salesman-${group.name}-${invoiceKey}-details`.replace(/[^a-zA-Z0-9_-]/g, "-");
                  const isExpanded = expandedInvoices.has(invoiceKey);
                  const urgency = getInvoiceUrgency(record, today);
                  const rowStatus = urgency.status;

                  return (
                    <Fragment key={invoiceKey}>
                      <TableRow data-status={rowStatus} className={invoiceRowStatusClasses[rowStatus]}>
                        <TableCell className={`${invoiceRowStatusAccentClasses[rowStatus]} font-medium`}>
                          <HighlightedText value={record.invoiceNo} query={invoiceQuery} />
                        </TableCell>
                        <TableCell>
                          <div><HighlightedText value={record.customerName} query={customerQuery} /></div>
                          {record.customerCode && (
                            <div className="text-xs text-muted-foreground">
                              <HighlightedText value={record.customerCode} query={customerQuery} />
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{formatReportDate(record.dueDate)}</TableCell>
                        <TableCell>
                          <Badge variant={urgency.badgeVariant}>{urgency.label}</Badge>
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
                        <TableRow id={detailsId} className="hover:bg-transparent">
                          <TableCell colSpan={6} className="bg-muted/20 p-4">
                            <InvoiceDetails
                              record={record}
                              urgencyStatus={rowStatus}
                              invoiceQuery={invoiceQuery}
                              customerQuery={customerQuery}
                            />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
            {invoicePageCount > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3" aria-live="polite">
                <span className="text-xs text-muted-foreground">
                  Showing {currentInvoicePage * PAGE_SIZE + 1}–
                  {Math.min((currentInvoicePage + 1) * PAGE_SIZE, group.records.length)} of {group.records.length} invoices
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setInvoicePageIndex((current) => Math.max(current - 1, 0))}
                    disabled={currentInvoicePage === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setInvoicePageIndex((current) => Math.min(current + 1, invoicePageCount - 1))}
                    disabled={currentInvoicePage === invoicePageCount - 1}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CollapsibleContent>
        </CardContent>
      </Card>
    </Collapsible>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

export function SalesmanTab({
  groups,
  loading,
  hasActiveFilters,
  range,
  invoiceQuery,
  customerQuery,
  onClearFilters,
}: SalesmanTabProps) {
  const [pageIndex, setPageIndex] = useState(0);

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-live="polite">
        <span className="sr-only">Loading expected collections by salesman.</span>
        {Array.from({ length: 2 }, (_, index) => (
          <Card key={index}>
            <CardContent className="space-y-4 pt-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-44 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center text-sm text-muted-foreground">
          <p>
            {hasActiveFilters
              ? "No salesman groups match the selected filters."
              : `No salesman collection data is available from ${formatReportDate(range.startDate)} to ${formatReportDate(range.endDate)}.`}
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

  const pageCount = Math.ceil(groups.length / PAGE_SIZE);
  const currentPageIndex = Math.min(pageIndex, Math.max(pageCount - 1, 0));
  const pageGroups = groups.slice(currentPageIndex * PAGE_SIZE, (currentPageIndex + 1) * PAGE_SIZE);
  const allRecords = groups.flatMap((group) => group.records);
  const totalInvoices = groups.reduce((sum, group) => sum + group.invoiceCount, 0);
  const totalCustomers = new Set(groups.flatMap((group) => (
    group.records.map((record) => record.customerCode || record.customerName)
  ))).size;
  const settledInvoiceCount = allRecords.filter((record) => record.outstandingBalance === 0).length;
  const outstandingInvoiceCount = allRecords.filter((record) => record.outstandingBalance > 0).length;
  const totalOutstanding = groups.reduce((sum, group) => sum + group.outstandingBalance, 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" aria-label="Salesman collection summary">
        <SummaryMetric label="Invoices" value={String(totalInvoices)} />
        <SummaryMetric label="Customers" value={String(totalCustomers)} />
        <SummaryMetric label="Settled Invoices" value={String(settledInvoiceCount)} />
        <SummaryMetric label="Outstanding Invoices" value={String(outstandingInvoiceCount)} />
        <SummaryMetric label="Total Outstanding" value={formatPeso(totalOutstanding)} />
      </div>
      {pageGroups.map((group) => (
        <SalesmanGroupCard
          key={group.name}
          group={group}
          invoiceQuery={invoiceQuery}
          customerQuery={customerQuery}
        />
      ))}
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4" aria-live="polite">
          <span className="text-sm text-muted-foreground">
            Showing {currentPageIndex * PAGE_SIZE + 1}–{Math.min((currentPageIndex + 1) * PAGE_SIZE, groups.length)} of {groups.length} salesmen
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
    </div>
  );
}
