"use client";

import * as React from "react";
import {
  AlertCircle,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JournalEntryGroup } from "../types";
import { cn } from "@/lib/utils";
import { formatJournalAmount } from "../utils/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";

interface JournalEntryTableProps {
  groups: JournalEntryGroup[];
  loading: boolean;
  onDrillDown: (group: JournalEntryGroup, opener: HTMLElement) => void;
  currentPage: number;
  pageSize: number;
  pageCount: number;
  totalGroupCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  startDate: string;
  endDate: string;
  sortField: string;
  sortOrder: "asc" | "desc" | null;
  onSort: (field: string) => void;
}

const sortFields = [
  { value: "date", label: "Transaction Date" },
  { value: "postingDate", label: "Posting Date" },
  { value: "accountTitle", label: "Account Title" },
  { value: "debit", label: "Debit Total" },
  { value: "credit", label: "Credit Total" },
  { value: "balance", label: "Debit–Credit Difference" },
];

export default function JournalEntryTable({
  groups,
  loading,
  onDrillDown,
  currentPage,
  pageSize,
  pageCount,
  totalGroupCount,
  onPageChange,
  onPageSizeChange,
  startDate,
  endDate,
  sortField,
  sortOrder,
  onSort,
}: JournalEntryTableProps) {
  const [expandedGroups, setExpandedGroups] = React.useState<Set<number>>(() => new Set());
  const visibleGroupKey = groups.map((group) => group.jeGroupCounter).join(",");

  React.useEffect(() => {
    setExpandedGroups(new Set());
  }, [currentPage, pageSize, visibleGroupKey]);

  const sortAnnouncement = !["date", "debit", "credit"].includes(sortField)
    ? `Sorted by ${sortFields.find((field) => field.value === sortField)?.label ?? sortField}, ${sortOrder === "asc" ? "ascending" : sortOrder === "desc" ? "descending" : "default order"}.`
    : "";

  const toggleGroup = (groupId: number) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/5 text-muted-foreground animate-pulse">
        <p>Processing ledger entries...</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/5 text-muted-foreground">
        <p>No journal entries found for the selected criteria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border bg-background p-5 shadow-sm md:flex-row md:items-center">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-foreground uppercase">Journal Entry Analysis</h2>
          <div className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/30 bg-muted/50 px-3 py-1.5 text-sm font-medium text-muted-foreground">
            <span className="text-primary/70 uppercase tracking-wider">Period:</span>
            <span className="text-foreground">
              {format(new Date(startDate), "MMMM d, yyyy")} to {format(new Date(endDate), "MMMM d, yyyy")}
            </span>
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto">
          <div className="flex flex-col items-end gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3 shadow-inner transition-colors dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="h-4 border-emerald-500/20 bg-emerald-500/10 px-2 py-0 text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Live Analytics
              </Badge>
              <div className="h-1 w-1 animate-pulse rounded-full bg-emerald-500" />
            </div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Basis: <span className="italic text-slate-900 dark:text-slate-100">Accrual</span> | View: <span className="text-indigo-600 dark:text-indigo-400">Analytics</span>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
            <span className="whitespace-nowrap pl-1 text-xs font-medium text-muted-foreground">Sort by</span>
            <Select value={sortField || "date"} onValueChange={onSort}>
              <SelectTrigger aria-label="Sort journal entries by" className="h-8 w-[220px] max-w-[58vw]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortFields.map((field) => (
                  <SelectItem key={field.value} value={field.value}>{field.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 px-2"
              onClick={() => onSort(sortField || "date")}
              aria-label={`Change sort direction, currently ${sortOrder === "asc" ? "ascending" : "descending"}`}
            >
              {sortOrder === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <span className="hidden lg:inline">{sortOrder === "asc" ? "Ascending" : "Descending"}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border bg-background shadow-sm">
        <span className="sr-only" aria-live="polite" aria-atomic="true">{sortAnnouncement}</span>
        <div role="region" aria-label="Journal entry table" tabIndex={0} className="relative max-h-[65vh] w-full overflow-auto">
          <table className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm">
            <caption className="sr-only">Journal entries. Activate sortable column headers to change sort order.</caption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 top-0 z-30 w-[190px] min-w-[190px] border-b bg-muted/95 py-3 text-sm font-semibold uppercase tracking-wide backdrop-blur">
                  Journal / Reference
                </TableHead>
                <SortableHeader label="Date" field="date" className="w-[125px]" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
                <TableHead className="sticky top-0 z-20 w-[160px] border-b bg-muted/95 py-3 text-sm font-semibold uppercase tracking-wide backdrop-blur">
                  Source
                </TableHead>
                <TableHead className="sticky top-0 z-20 min-w-[280px] border-b bg-muted/95 py-3 text-sm font-semibold uppercase tracking-wide backdrop-blur">
                  Description
                </TableHead>
                <SortableHeader label="Debit" field="debit" className="w-[145px] text-right" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
                <SortableHeader label="Credit" field="credit" className="w-[145px] text-right" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
                <TableHead className="sticky top-0 z-20 w-[130px] border-b bg-muted/95 py-3 text-sm font-semibold uppercase tracking-wide backdrop-blur">
                  Status
                </TableHead>
                <TableHead className="sticky top-0 z-20 w-[88px] border-b bg-muted/95 py-3 text-right text-sm font-semibold uppercase tracking-wide backdrop-blur">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {groups.map((group) => {
                const isExpanded = expandedGroups.has(group.jeGroupCounter);
                const status = (group.status || "").trim();
                const statusLower = status.toLowerCase();
                const statusClasses = getStatusClasses(statusLower);
                const isKnown = ["draft", "approved", "posted", "for review", "dispatched", "voided", "cancelled"].includes(statusLower);
                const sourceDebitTotal = group.entries.reduce((sum, entry) => sum + entry.debit, 0);
                const sourceCreditTotal = group.entries.reduce((sum, entry) => sum + entry.credit, 0);
                const totalDebit = group.adjustedTotalDebit ?? sourceDebitTotal;
                const totalCredit = group.adjustedTotalCredit ?? sourceCreditTotal;
                const distributionId = `journal-distribution-${group.jeGroupCounter}`;

                return (
                  <React.Fragment key={group.jeGroupCounter}>
                    <TableRow
                      onClick={(event) => onDrillDown(group, event.currentTarget)}
                      onKeyDown={(event) => {
                        if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) {
                          event.preventDefault();
                          onDrillDown(group, event.currentTarget);
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Open details for ${group.jeNo}`}
                      className="group/summary cursor-pointer border-b border-border hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px]"
                      title={`Open details for ${group.jeNo}`}
                    >
                      <TableCell className="sticky left-0 z-10 min-w-[190px] border-b border-border bg-background py-3 group-hover/summary:bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0"
                            aria-label={`${isExpanded ? "Collapse" : "Expand"} accounting lines for ${group.jeNo}`}
                            aria-expanded={isExpanded}
                            aria-controls={isExpanded ? distributionId : undefined}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleGroup(group.jeGroupCounter);
                            }}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          </Button>
                          <span className="truncate font-mono text-sm font-semibold text-foreground group-hover/summary:text-primary" title={group.jeNo}>
                            {group.jeNo}
                          </span>
                          {group.isImbalanced && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-500" aria-label="Imbalanced journal" />}
                        </div>
                      </TableCell>
                      <TableCell className="border-b border-border py-3 font-medium text-foreground">
                        {group.transactionDate ? format(new Date(group.transactionDate), "yyyy-MM-dd") : "-"}
                      </TableCell>
                      <TableCell className="border-b border-border py-3">
                        <Badge variant="outline" className="max-w-[145px] truncate border-border px-2 py-0 text-xs font-medium shadow-sm" title={group.sourceModule || "-"}>
                          {group.sourceModule || "-"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[360px] border-b border-border py-3 text-muted-foreground">
                        <span className="block truncate" title={group.description || "-"}>{group.description || "-"}</span>
                      </TableCell>
                      <TableCell className="border-b border-border py-3 text-right font-medium tabular-nums">
                        {formatJournalAmount(totalDebit)}
                      </TableCell>
                      <TableCell className="border-b border-border py-3 text-right font-medium tabular-nums">
                        {formatJournalAmount(totalCredit)}
                      </TableCell>
                      <TableCell className="border-b border-border py-3">
                        <span className={cn("inline-flex items-center whitespace-nowrap rounded-full border px-3 py-0.5 text-xs font-medium", statusClasses)}>
                          {isKnown ? status : status.toUpperCase() || "UNKNOWN"}
                        </span>
                      </TableCell>
                      <TableCell className="border-b border-border py-3 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 px-2"
                          aria-label={`View journal ${group.jeNo}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onDrillDown(group, event.currentTarget);
                          }}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow>
                        <TableCell id={distributionId} colSpan={8} className="border-b border-border bg-muted/20 p-0">
                          <div className="px-4 py-4 sm:px-6">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Accounting distribution · {group.jeNo}
                            </div>
                            {group.hasPostedAdjustments && (
                              <p className="mb-3 text-xs text-muted-foreground">
                                Summary totals include posted adjustments. Open the journal details to review their lines.
                              </p>
                            )}
                            {group.entries.length === 0 ? (
                              <p className="py-3 text-sm text-muted-foreground">No accounting lines are available.</p>
                            ) : (
                              <div className="overflow-x-auto rounded-md border bg-background">
                                <table className="w-full min-w-[620px] text-sm">
                                  <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                                    <tr>
                                      <th scope="col" className="px-3 py-2 text-left font-semibold">Account No.</th>
                                      <th scope="col" className="px-3 py-2 text-left font-semibold">Account</th>
                                      <th scope="col" className="px-3 py-2 text-right font-semibold">Debit</th>
                                      <th scope="col" className="px-3 py-2 text-right font-semibold">Credit</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.entries.map((entry, index) => (
                                      <tr key={`${entry.coaId ?? entry.accountNumber ?? "line"}-${index}`} className="border-t border-border/60">
                                        <td className="max-w-[160px] truncate px-3 py-2 font-mono text-muted-foreground" title={entry.accountNumber || "N/A"}>
                                          {entry.accountNumber || "N/A"}
                                        </td>
                                        <td className="max-w-[360px] truncate px-3 py-2 font-medium" title={entry.accountTitle || "N/A"}>
                                          {entry.accountTitle || "N/A"}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">{formatJournalAmount(entry.debit)}</td>
                                        <td className="px-3 py-2 text-right tabular-nums">{formatJournalAmount(entry.credit)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })}
            </TableBody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex-1 text-sm font-medium text-muted-foreground">
          {totalGroupCount === 0
            ? "Showing 0 of 0 journals."
            : `Showing ${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, totalGroupCount)} of ${totalGroupCount} ${totalGroupCount === 1 ? "journal" : "journals"}.`}
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select value={`${pageSize}`} onValueChange={(value) => onPageSizeChange(Number(value))}>
              <SelectTrigger className="h-8 w-[70px] rounded-lg">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>{size}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-medium">
            Page {currentPage + 1} of {pageCount}
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" className="hidden h-8 w-8 rounded-lg p-0 lg:flex" onClick={() => onPageChange(0)} disabled={currentPage === 0}>
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="h-8 w-8 rounded-lg p-0" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 0}>
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="h-8 w-8 rounded-lg p-0" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage >= pageCount - 1}>
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="hidden h-8 w-8 rounded-lg p-0 lg:flex" onClick={() => onPageChange(pageCount - 1)} disabled={currentPage >= pageCount - 1}>
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SortableHeader({
  label,
  field,
  sortField,
  sortOrder,
  onSort,
  className,
}: {
  label: string;
  field: string;
  sortField: string;
  sortOrder: "asc" | "desc" | null;
  onSort: (field: string) => void;
  className?: string;
}) {
  const isActive = sortField === field;

  return (
    <TableHead
      aria-sort={isActive && sortOrder ? (sortOrder === "asc" ? "ascending" : "descending") : undefined}
      className={cn("sticky top-0 z-20 border-b bg-muted/95 py-3 text-sm font-semibold uppercase tracking-wide backdrop-blur", className)}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="flex w-full items-center gap-1 rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <span className={className?.includes("text-right") ? "ml-auto" : undefined}>{label}</span>
        {isActive && sortOrder === "asc" ? (
          <ChevronUp aria-hidden="true" className="h-4 w-4 text-primary" />
        ) : isActive && sortOrder === "desc" ? (
          <ChevronDown aria-hidden="true" className="h-4 w-4 text-primary" />
        ) : (
          <ArrowUpDown aria-hidden="true" className="h-3 w-3 text-muted-foreground/50" />
        )}
      </button>
    </TableHead>
  );
}

function getStatusClasses(status: string) {
  if (status === "approved") return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-400";
  if (status === "posted") return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400";
  if (status === "for review") return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400";
  if (status === "draft") return "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400";
  if (status === "dispatched") return "border-indigo-200 bg-indigo-50 text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-900/20 dark:text-indigo-400";
  if (status === "voided" || status === "cancelled") return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/50 dark:bg-rose-900/20 dark:text-rose-400";
  return "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400";
}
