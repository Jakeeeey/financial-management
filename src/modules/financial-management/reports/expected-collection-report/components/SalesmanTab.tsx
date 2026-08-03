"use client";

import { Fragment, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { SalesmanCollectionGroup } from "../types";
import { formatReportDate } from "../utils/date";
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
  allInvoices: boolean;
}

function SalesmanGroupCard({ group, allInvoices }: { group: SalesmanCollectionGroup; allInvoices: boolean }) {
  const [open, setOpen] = useState(false);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());

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

          <div className="grid gap-2 sm:grid-cols-4">
            <SummaryMetric label="Invoices" value={String(group.invoiceCount)} />
            <SummaryMetric label="Customers" value={String(group.customerCount)} />
            <SummaryMetric label="Divisions" value={String(group.divisions.length)} />
            <SummaryMetric label="Outstanding" value={formatPeso(group.outstandingBalance)} />
          </div>
        </CardHeader>

        <CardContent>
          <CollapsibleContent className="space-y-3">
            {allInvoices ? (
              <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
                The weekly outstanding-balance graph is unavailable when all invoice due dates are selected.
              </p>
            ) : (
            <div className="h-[210px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={group.dailyOutstanding} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" fontSize={12} />
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
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead className="text-right">Outstanding balance</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {group.records.map((record) => {
                  const invoiceKey = `${record.invoiceId}-${record.invoiceNo}`;
                  const isExpanded = expandedInvoices.has(invoiceKey);

                  return (
                    <Fragment key={invoiceKey}>
                      <TableRow data-state={isExpanded ? "selected" : undefined}>
                        <TableCell className="font-medium">{record.invoiceNo || "N/A"}</TableCell>
                        <TableCell>
                          <div>{record.customerName || "N/A"}</div>
                          {record.customerCode && <div className="text-xs text-muted-foreground">{record.customerCode}</div>}
                        </TableCell>
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
                          <TableCell colSpan={5} className="bg-muted/20 p-4">
                            <InvoiceDetails record={record} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
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

export function SalesmanTab({ groups, loading, hasActiveFilters, allInvoices }: SalesmanTabProps) {
  const [pageIndex, setPageIndex] = useState(0);

  if (loading) {
    return (
      <div className="space-y-4">
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
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          {hasActiveFilters ? "No salesman groups match the selected filters." : "No salesman collection data is available for this week."}
        </CardContent>
      </Card>
    );
  }

  const pageCount = Math.ceil(groups.length / PAGE_SIZE);
  const currentPageIndex = Math.min(pageIndex, Math.max(pageCount - 1, 0));
  const pageGroups = groups.slice(currentPageIndex * PAGE_SIZE, (currentPageIndex + 1) * PAGE_SIZE);

  return (
    <div className="space-y-4">
      {pageGroups.map((group) => <SalesmanGroupCard key={group.name} group={group} allInvoices={allInvoices} />)}
      {pageCount > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
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
