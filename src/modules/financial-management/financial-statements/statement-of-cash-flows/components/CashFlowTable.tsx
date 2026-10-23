"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Loader2,
  FileText,
  Search,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CashFlowActivityFilter,
  CashFlowEntry,
  CashFlowSortField,
  CashFlowSortOrder,
  GroupedCashFlowEntries,
  CashFlowTransactionDetails,
} from "../types/cash-flow.schema";
import { getCashFlowTransactionDetails } from "../services/cash-flow.service";
import {
  filterCashFlowEntries,
  flattenCashFlowEntries,
  paginateCashFlowEntries,
  sortCashFlowEntries,
  sumCashFlowEntries,
} from "../utils/transaction-view";

interface CashFlowTableProps {
  groupedEntries: GroupedCashFlowEntries;
  isLoading?: boolean;
  hasLoadedReport: boolean;
  appliedStartDate: string;
  appliedEndDate: string;
  search: string;
  activity: CashFlowActivityFilter;
  sortField: CashFlowSortField;
  sortOrder: CashFlowSortOrder;
  page: number;
  pageSize: 10 | 25 | 50;
  onSearchChange: (search: string) => void;
  onActivityChange: (activity: CashFlowActivityFilter) => void;
  onSortChange: (field: CashFlowSortField) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: 10 | 25 | 50) => void;
}

const currencyFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function getDisplayedCashFlowValue(value: number) {
  return Math.round(Math.abs(value) * 100) === 0 ? 0 : value;
}

function formatCashFlowAmount(value: number) {
  return currencyFormatter.format(getDisplayedCashFlowValue(value));
}

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const BADGE_VARIANT_MAP: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  operating: "default",
  investing: "secondary",
  financing: "outline",
};

function getActivityBadgeVariant(activity: string | null | undefined): "default" | "secondary" | "outline" | "destructive" {
  if (!activity) return "outline";
  return BADGE_VARIANT_MAP[activity.toLowerCase()] ?? "outline";
}

function CashFlowTableRow({
  entry,
  onView,
}: {
  entry: CashFlowEntry;
  onView: (entry: CashFlowEntry, trigger: HTMLButtonElement) => void;
}) {
  const date = entry.transactionDate
    ? dateFormatter.format(new Date(entry.transactionDate))
    : "—";
  const activity = entry.cashFlowActivity?.trim() || "Uncategorized";
  const amount = entry.netCashFlow ?? 0;

  return (
    <TableRow>
      <TableCell className="sticky left-0 z-10 min-w-[240px] max-w-[360px] whitespace-normal break-words bg-card font-mono text-sm shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
        {entry.transactionRef?.trim() || "Reference not provided"}
      </TableCell>
      <TableCell className="font-mono text-sm">
        <div className="flex items-center gap-2">
          <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
          <span>{date}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={getActivityBadgeVariant(entry.cashFlowActivity)}>{activity}</Badge>
      </TableCell>
      <TableCell
        className={cn(
          "text-right font-medium tabular-nums text-foreground",
        )}
      >
        {formatCashFlowAmount(amount)}
      </TableCell>
      <TableCell className="w-[100px] text-right">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`View transaction ${entry.transactionRef?.trim() || "without a reference"}`}
          onClick={event => onView(entry, event.currentTarget)}
        >
          View
        </Button>
      </TableCell>
    </TableRow>
  );
}

function SkeletonRows() {
  return <>
    {Array.from({ length: 6 }).map((_, index) => (
      <TableRow key={index} className="animate-pulse">
        <TableCell><div className="h-4 w-24 rounded bg-muted" /></TableCell>
        <TableCell><div className="h-6 w-28 rounded bg-muted" /></TableCell>
        <TableCell><div className="h-4 w-40 rounded bg-muted" /></TableCell>
        <TableCell className="text-right"><div className="ml-auto h-4 w-24 rounded bg-muted" /></TableCell>
        <TableCell><div className="ml-auto h-8 w-16 rounded bg-muted" /></TableCell>
      </TableRow>
    ))}
  </>;
}

function SortIcon({ active, order }: { active: boolean; order: CashFlowSortOrder }) {
  if (!active) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-50" />;
  return order === "asc"
    ? <ArrowUp className="ml-2 h-4 w-4 text-emerald-600" />
    : <ArrowDown className="ml-2 h-4 w-4 text-emerald-600" />;
}

export function CashFlowTable({
  groupedEntries,
  isLoading = false,
  hasLoadedReport,
  appliedStartDate,
  appliedEndDate,
  search,
  activity,
  sortField,
  sortOrder,
  page,
  pageSize,
  onSearchChange,
  onActivityChange,
  onSortChange,
  onPageChange,
  onPageSizeChange,
}: CashFlowTableProps) {
  const [selectedEntry, setSelectedEntry] = useState<CashFlowEntry | null>(null);
  const [journalDetails, setJournalDetails] = useState<CashFlowTransactionDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsAttempt, setDetailsAttempt] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const viewButtonRef = useRef<HTMLButtonElement | null>(null);
  const filteredEntries = useMemo(() => {
    const entries = flattenCashFlowEntries(groupedEntries);
    return filterCashFlowEntries(entries, search, activity);
  }, [activity, groupedEntries, search]);
  const sortedEntries = useMemo(
    () => sortCashFlowEntries(filteredEntries, sortField, sortOrder),
    [filteredEntries, sortField, sortOrder],
  );
  const pageResult = useMemo(
    () => paginateCashFlowEntries(sortedEntries, page, pageSize),
    [page, pageSize, sortedEntries],
  );
  const filteredSubtotal = useMemo(() => sumCashFlowEntries(filteredEntries), [filteredEntries]);

  useEffect(() => {
    if (!isLoading && pageResult.page !== page) onPageChange(pageResult.page);
  }, [isLoading, onPageChange, page, pageResult.page]);

  const sortButton = (label: string, field: CashFlowSortField) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 px-2 font-semibold"
      onClick={() => onSortChange(field)}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <SortIcon active={sortField === field} order={sortOrder} />
    </Button>
  );

  const firstShown = filteredEntries.length === 0 ? 0 : pageResult.startIndex + 1;
  const selectedReference = selectedEntry?.transactionRef?.trim() ?? "";
  const selectedJournalEntryId = selectedEntry?.journalEntryId?.trim() ?? "";
  const selectedSourceModule = selectedEntry?.sourceModule?.trim() ?? "";

  useEffect(() => {
    if (!selectedEntry) {
      setJournalDetails(null);
      setDetailsError(null);
      setDetailsLoading(false);
      return;
    }

    if (!selectedJournalEntryId || !selectedSourceModule) {
      setJournalDetails(null);
      setDetailsError(null);
      setDetailsLoading(false);
      return;
    }

    const controller = new AbortController();
    setJournalDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    getCashFlowTransactionDetails(selectedJournalEntryId, selectedSourceModule, controller.signal)
      .then(setJournalDetails)
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setDetailsError(failure instanceof Error ? failure.message : "Unable to load journal details.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailsLoading(false);
      });

    return () => controller.abort();
  }, [detailsAttempt, selectedEntry, selectedJournalEntryId, selectedSourceModule]);

  const handleView = (entry: CashFlowEntry, trigger: HTMLButtonElement) => {
    viewButtonRef.current = trigger;
    setCopyStatus("");
    setJournalDetails(null);
    setDetailsError(null);
    setSelectedEntry(entry);
  };

  const retryJournalDetails = () => setDetailsAttempt(attempt => attempt + 1);

  const handleCopyReference = async () => {
    if (!selectedReference) {
      setCopyStatus("No transaction reference is available to copy.");
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(selectedReference);
      setCopyStatus("Reference copied.");
    } catch {
      setCopyStatus("Could not copy the reference. Select the text above and copy it manually.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by reference or activity..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search report transactions"
            className="pl-10"
          />
        </div>
        <Collapsible defaultOpen={false} className="w-full sm:w-auto">
          <CollapsibleTrigger asChild>
            <Button type="button" variant="outline" className="group h-9 w-full justify-between sm:w-auto">
              <span className="flex min-w-0 items-center gap-2">
                <Tag className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span>Activity filter</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {activity === "all" ? "All activities" : activity === "uncategorized" ? "Uncategorized" : activity[0].toUpperCase() + activity.slice(1)}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <Select value={activity} onValueChange={(value) => onActivityChange(value as CashFlowActivityFilter)}>
              <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter by activity">
                <SelectValue placeholder="All activities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All activities</SelectItem>
                <SelectItem value="operating">Operating</SelectItem>
                <SelectItem value="investing">Investing</SelectItem>
                <SelectItem value="financing">Financing</SelectItem>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
              </SelectContent>
            </Select>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <div className="flex flex-col gap-2 rounded-md bg-muted/30 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground tabular-nums" aria-live="polite">
          {!hasLoadedReport && !isLoading
            ? "Report transactions are unavailable. Retry the report request."
            : isLoading
            ? "Loading transactions for the applied report…"
            : filteredEntries.length === 0
              ? "Showing 0 of 0 transactions"
              : `Showing ${firstShown}–${pageResult.endIndex} of ${filteredEntries.length} transactions`}
        </p>
        <p className="text-right tabular-nums">
          {!hasLoadedReport && !isLoading ? "Filtered subtotal unavailable" : isLoading ? "Calculating filtered subtotal…" : <>
            <span className="text-muted-foreground">Filtered transaction subtotal: </span>
            <strong>{formatCashFlowAmount(filteredSubtotal)}</strong>
            <span className="ml-2 text-xs text-muted-foreground">Across all matching pages</span>
          </>}
        </p>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Summary cards show full-report totals; the subtotal above uses the current search and activity filter.
      </p>

      <div
        className="max-h-[65vh] overflow-auto rounded-md border"
        role="region"
        aria-label="Cash flow transaction register"
        tabIndex={0}
      >
        <table className="w-full min-w-[900px] caption-bottom text-sm">
          <caption className="sr-only">Cash flow transactions matching the current search and activity filters</caption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col" className="sticky left-0 top-0 z-30 min-w-[240px] max-w-[360px] bg-background shadow-[2px_0_4px_rgba(0,0,0,0.04)]">
                Reference
              </TableHead>
              <TableHead
                scope="col"
                className="sticky top-0 z-20 w-[180px] bg-background"
                aria-sort={sortField === "transactionDate" ? (sortOrder === "asc" ? "ascending" : "descending") : undefined}
              >
                {sortButton("Date", "transactionDate")}
              </TableHead>
              <TableHead
                scope="col"
                className="sticky top-0 z-20 bg-background"
                aria-sort={sortField === "cashFlowActivity" ? (sortOrder === "asc" ? "ascending" : "descending") : undefined}
              >
                {sortButton("Activity type", "cashFlowActivity")}
              </TableHead>
              <TableHead
                scope="col"
                className="sticky top-0 z-20 bg-background text-right"
                aria-sort={sortField === "netCashFlow" ? (sortOrder === "asc" ? "ascending" : "descending") : undefined}
              >
                <div className="flex justify-end">{sortButton("Net cash flow", "netCashFlow")}</div>
              </TableHead>
              <TableHead scope="col" className="sticky top-0 z-20 w-[100px] bg-background text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? <SkeletonRows /> : pageResult.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <FileText className="mb-2 h-8 w-8 opacity-50" />
                    <p>
                      {!hasLoadedReport
                        ? "Report transactions are unavailable"
                        : activity === "uncategorized"
                          ? search.trim()
                            ? "No uncategorized transactions match this search"
                            : "No uncategorized transactions in this report"
                          : "No transactions match these filters"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : pageResult.items.map((entry, index) => (
              <CashFlowTableRow
                key={`${entry.journalEntryId ?? "unlinked"}-${entry.sourceModule ?? "unknown"}-${entry.transactionRef}-${entry.transactionDate}-${index}`}
                entry={entry}
                onView={handleView}
              />
            ))}
          </TableBody>
        </table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Rows per page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value) as 10 | 25 | 50)}
          >
            <SelectTrigger className="h-8 w-[78px]" aria-label="Rows per page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-end gap-2">
          <span className="mr-2 text-sm text-muted-foreground">Page {pageResult.page + 1} of {pageResult.pageCount}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageResult.page === 0}
            onClick={() => onPageChange(pageResult.page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageResult.page >= pageResult.pageCount - 1}
            onClick={() => onPageChange(pageResult.page + 1)}
            aria-label="Next page"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog
        open={selectedEntry !== null}
        onOpenChange={open => {
          if (!open) {
            setSelectedEntry(null);
            setCopyStatus("");
          }
        }}
      >
        <DialogContent
          className="max-h-[90vh] min-w-0 overflow-y-auto sm:max-w-3xl"
          onCloseAutoFocus={event => {
            event.preventDefault();
            viewButtonRef.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>Cash flow transaction</DialogTitle>
          <DialogDescription>Review the report transaction and the journal lines linked to its source record.</DialogDescription>
          </DialogHeader>
          {selectedEntry && (
            <div className="min-w-0 space-y-4">
              <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Full reference</p>
                <p className="select-all break-all font-mono text-sm" aria-label="Full transaction reference">
                  {selectedReference || "Reference not provided"}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!selectedReference}
                  onClick={() => void handleCopyReference()}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy reference
                </Button>
                {copyStatus && <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{copyStatus}</p>}
              </div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Journal entry</dt>
                  <dd className="mt-1 break-all font-mono text-sm">{selectedJournalEntryId || "Journal link unavailable"}</dd>
                </div>
                <div className="rounded-md border p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Source module</dt>
                  <dd className="mt-1 text-sm">{selectedSourceModule || "Not provided"}</dd>
                </div>
                <div className="rounded-md border p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Accounting date</dt>
                  <dd className="mt-1 text-sm">{selectedEntry.transactionDate ? dateFormatter.format(new Date(selectedEntry.transactionDate)) : "Date not provided"}</dd>
                </div>
                <div className="rounded-md border p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Journal status</dt>
                  <dd className="mt-1 text-sm">{detailsLoading ? "Loading…" : journalDetails?.status || "Unavailable"}</dd>
                </div>
                <div className="rounded-md border p-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity</dt>
                  <dd className="mt-1 text-sm">{selectedEntry.cashFlowActivity?.trim() || "Uncategorized"}</dd>
                </div>
                <div className="rounded-md border p-3 sm:col-span-2">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Net cash movement</dt>
                  <dd className="mt-1 text-right font-semibold tabular-nums">
                    {selectedEntry.netCashFlow == null ? "Amount not provided" : formatCashFlowAmount(selectedEntry.netCashFlow)}
                  </dd>
                </div>
              </dl>

              <section className="space-y-3 rounded-md border p-3" aria-labelledby="cash-flow-report-context-title">
                <h3 id="cash-flow-report-context-title" className="text-sm font-semibold">Report context</h3>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">Applied period</dt>
                    <dd>{formatContextDate(appliedStartDate)} – {formatContextDate(appliedEndDate)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Activity filter</dt>
                    <dd>{activity === "all" ? "All activities" : activity === "uncategorized" ? "Uncategorized" : activity[0].toUpperCase() + activity.slice(1)}</dd>
                  </div>
                  {search.trim() && <div className="sm:col-span-2">
                    <dt className="text-xs text-muted-foreground">Register search</dt>
                    <dd className="break-words">{search.trim()}</dd>
                  </div>}
                </dl>
              </section>

              <section className="space-y-3" aria-labelledby="cash-flow-journal-lines-title">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="cash-flow-journal-lines-title" className="text-sm font-semibold">Journal and account details</h3>
                  {journalDetails && <p className="text-xs text-muted-foreground">{journalDetails.status || "Status unavailable"}</p>}
                </div>
                {!selectedJournalEntryId || !selectedSourceModule ? (
                  <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Journal details are unavailable because this report row has no stable journal link.
                  </p>
                ) : detailsLoading ? (
                  <p role="status" aria-live="polite" className="flex items-center gap-2 rounded-md border p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading journal and account details…
                  </p>
                ) : detailsError ? (
                  <div className="space-y-2 rounded-md border border-destructive/40 p-4" role="alert">
                    <p className="text-sm text-destructive">{detailsError}</p>
                    <Button type="button" variant="outline" size="sm" onClick={retryJournalDetails}>Retry details</Button>
                  </div>
                ) : journalDetails ? (
                  <>
                    {journalDetails.description && <p className="text-sm text-muted-foreground">{journalDetails.description}</p>}
                    <div className="flex flex-wrap justify-end gap-x-5 gap-y-1 rounded-md bg-muted/30 px-3 py-2 text-sm tabular-nums">
                      <span>Total debit: <strong>{formatCashFlowAmount(journalDetails.totalDebit)}</strong></span>
                      <span>Total credit: <strong>{formatCashFlowAmount(journalDetails.totalCredit)}</strong></span>
                    </div>
                    <div className="hidden max-h-64 overflow-y-auto rounded-md border lg:block">
                      <table className="w-full table-fixed text-sm">
                        <caption className="sr-only">Account lines for journal {journalDetails.journalEntryId}</caption>
                        <thead className="sticky top-0 bg-muted">
                          <tr>
                            <th scope="col" className="w-[25%] px-3 py-2 text-left">Account</th>
                            <th scope="col" className="w-[31%] px-3 py-2 text-left">Description</th>
                            <th scope="col" className="w-[22%] px-3 py-2 text-right">Debit</th>
                            <th scope="col" className="w-[22%] px-3 py-2 text-right">Credit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {journalDetails.lines.map((line, index) => (
                            <tr key={`${line.accountNumber ?? "account"}-${index}`} className="border-t">
                              <td className="px-3 py-2 align-top">
                                <span className="block break-all font-mono text-xs text-muted-foreground">{line.accountNumber || "Code unavailable"}</span>
                                <span className="block whitespace-normal break-words">{line.accountTitle || "Account title unavailable"}</span>
                              </td>
                              <td className="max-w-[220px] whitespace-normal break-words px-3 py-2 align-top">{line.description || "—"}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatCashFlowAmount(line.debit)}</td>
                              <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{formatCashFlowAmount(line.credit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="space-y-2 lg:hidden" role="list" aria-label="Journal account lines">
                      {journalDetails.lines.map((line, index) => (
                        <article key={`${line.accountNumber ?? "account"}-${index}`} className="min-w-0 rounded-md border p-3" role="listitem">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Account</p>
                            <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{line.accountNumber || "Code unavailable"}</p>
                            <p className="break-words text-sm">{line.accountTitle || "Account title unavailable"}</p>
                          </div>
                          <div className="mt-3 min-w-0">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
                            <p className="mt-1 break-words text-sm">{line.description || "—"}</p>
                          </div>
                          <dl className="mt-3 grid min-w-0 grid-cols-2 gap-3 text-sm">
                            <div className="min-w-0 rounded-md bg-muted/30 p-2">
                              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Debit</dt>
                              <dd className="mt-1 break-words tabular-nums">{formatCashFlowAmount(line.debit)}</dd>
                            </div>
                            <div className="min-w-0 rounded-md bg-muted/30 p-2">
                              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credit</dt>
                              <dd className="mt-1 break-words tabular-nums">{formatCashFlowAmount(line.credit)}</dd>
                            </div>
                          </dl>
                        </article>
                      ))}
                    </div>
                  </>
                ) : null}
              </section>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatContextDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00`));
}
