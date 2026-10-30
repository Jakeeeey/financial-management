"use client";
import { journalEntryType } from "../utils/entry-type";

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

function journalLines(group: JournalEntryGroup) {
  const entries = [...group.entries].sort((a, b) => Number(a.credit !== 0 && a.debit === 0) - Number(b.credit !== 0 && b.debit === 0));
  let runningCents = 0;
  return entries.map((entry, index) => {
    const first = index === 0;
    const last = index === entries.length - 1;
    const creditLine = entry.credit !== 0 && entry.debit === 0;
    const next = entries[index + 1];
    const blockEnd = last || creditLine !== (next.credit !== 0 && next.debit === 0);
    runningCents += Math.round(entry.debit * 100) - Math.round(entry.credit * 100);
    return { entry, index, first, last, creditLine, blockEnd, balance: blockEnd ? (last ? group.balance : runningCents / 100) : null };
  });
}

const headerClass = "sticky top-0 z-20 border-b bg-muted/95 px-2 py-3 text-sm font-semibold uppercase tracking-wide backdrop-blur";

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
  const sortAnnouncement = !["date", "debit", "credit"].includes(sortField)
    ? `Sorted by ${sortFields.find((field) => field.value === sortField)?.label ?? sortField}, ${sortOrder === "asc" ? "ascending" : sortOrder === "desc" ? "descending" : "default order"}.`
    : "";

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
    <div className="@container min-w-0 space-y-4">
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
            <span className="whitespace-normal pl-1 text-xs font-medium text-muted-foreground">Sort by</span>
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

      <div className="hidden rounded-xl border bg-background shadow-sm @[1500px]:block">
        <span className="sr-only" aria-live="polite" aria-atomic="true">{sortAnnouncement}</span>
        <div role="region" aria-label="Journal entry table" tabIndex={0} className="relative max-h-[65vh] w-full overflow-y-auto">
          <table className="w-full table-fixed border-separate border-spacing-0 text-sm [&_th]:whitespace-normal [&_td]:whitespace-normal [&_th]:[overflow-wrap:anywhere] [&_td]:[overflow-wrap:anywhere]">
            <caption className="sr-only">Journal entries. Activate sortable column headers to change sort order.</caption>
            <colgroup>{[6,6,8,9,14,15,6,6,6,6,6,6,6].map((width,index)=><col key={index} style={{ width: `${width}%` }} />)}</colgroup>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <SortableHeader label="Date" field="date" className="" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
                <SortableHeader label="Posting Date" field="postingDate" className="" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
                <TableHead className={headerClass}>Type</TableHead>
                <TableHead className={cn(headerClass, "")}>Ref / JE No.</TableHead>
                <SortableHeader label="Account Title" field="accountTitle" className="" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
                <TableHead className={cn(headerClass, "")}>Description / Narrative</TableHead>
                <TableHead className={headerClass}>Division</TableHead>
                <TableHead className={headerClass}>Department</TableHead>
                <TableHead className={headerClass}>Source</TableHead>
                <SortableHeader label="Debit" field="debit" className=" text-right" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
                <SortableHeader label="Credit" field="credit" className=" text-right" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
                <SortableHeader label="Balance" field="balance" className=" text-right" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
                <TableHead className={headerClass}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => {
                const status = (group.status || "").trim();
                const statusLower = status.toLowerCase();
                const isKnown = ["draft", "approved", "posted", "for review", "dispatched", "voided", "cancelled"].includes(statusLower);
                return journalLines(group).map(({ entry, index, first, last, creditLine, blockEnd, balance }) => {
                  const cellClass = cn("px-2 py-3", blockEnd ? "border-b border-border" : "");
                  return <TableRow key={`${group.jeGroupCounter}-${index}`} className={cn("hover:bg-muted/30", creditLine && "text-muted-foreground")}>
                    {first && <>
                      <TableCell rowSpan={group.entries.length} className="border-b border-border px-2 py-4 align-top whitespace-normal">{group.transactionDate ? format(new Date(group.transactionDate), "yyyy-MM-dd") : "-"}</TableCell>
                      <TableCell rowSpan={group.entries.length} className="border-b border-border px-2 py-4 align-top whitespace-normal text-muted-foreground">{group.postingDate ? format(new Date(group.postingDate), "yyyy-MM-dd") : "-"}</TableCell>
                      <TableCell rowSpan={group.entries.length} className="border-b border-border px-2 py-4 align-top"><Badge variant="outline" className="whitespace-nowrap [overflow-wrap:normal] shadow-sm">{journalEntryType(group.sourceModule) || "-"}</Badge></TableCell>
                      <TableCell rowSpan={group.entries.length} className="border-b border-border px-2 py-4 align-top">
                        <div className="flex min-w-0 items-start gap-2"><button type="button" aria-label={`Open details for ${group.jeNo}`} className="min-w-0 [overflow-wrap:anywhere] text-left font-mono font-semibold text-foreground hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary" onClick={event => onDrillDown(group, event.currentTarget)}>{group.jeNo}</button>{group.isImbalanced && <AlertCircle className="mt-1 h-3.5 w-3.5 shrink-0 text-rose-500" aria-label="Imbalanced journal" />}</div>
                      </TableCell>
                    </>}
                    <TableCell className={cn(cellClass, "font-medium", creditLine && "pl-5 font-normal")}>{entry.accountTitle || entry.accountNumber || "-"}</TableCell>
                    <TableCell className={cn(cellClass, "", creditLine && "italic")}><span className="block whitespace-normal [overflow-wrap:anywhere]" title={entry.description || group.description || "-"}>{entry.description || group.description || "-"}</span></TableCell>
                    <TableCell className={cellClass}>{entry.divisionName || entry.division || "-"}</TableCell>
                    <TableCell className={cellClass}>{entry.departmentName || entry.department || "-"}</TableCell>
                    {first && <TableCell rowSpan={group.entries.length} className="border-b border-border px-2 py-4 align-top text-muted-foreground">{group.sourceModule || "-"}</TableCell>}
                    <TableCell className={cn(cellClass, "text-right tabular-nums text-foreground")}>{entry.debit !== 0 ? formatJournalAmount(entry.debit) : ""}</TableCell>
                    <TableCell className={cn(cellClass, "text-right tabular-nums text-foreground")}>{entry.credit !== 0 ? formatJournalAmount(entry.credit) : ""}</TableCell>
                    <TableCell className={cn(cellClass, "text-right tabular-nums text-foreground", last && group.balance !== 0 && "font-semibold text-rose-600 dark:text-rose-400")}>{balance !== null ? formatJournalAmount(balance) : ""}</TableCell>
                    {first && <TableCell rowSpan={group.entries.length} className="border-b border-border px-2 py-4 align-top"><span className={cn("inline-flex rounded-full border px-3 py-0.5 text-center text-xs font-medium", getStatusClasses(statusLower))}>{isKnown ? status : status.toUpperCase() || "UNKNOWN"}</span></TableCell>}
                  </TableRow>;
                });
              })}
            </TableBody>
          </table>
        </div>
      </div>

      <section aria-label="Journal entry register" className="min-w-0 space-y-4 @[1500px]:hidden">
        {groups.map(group => <article key={group.jeGroupCounter} aria-label={`Journal ${group.jeNo}`} className="min-w-0 rounded-xl border bg-background shadow-sm">
          <dl className="grid min-w-0 grid-cols-1 gap-4 border-b bg-muted/20 p-4 text-sm @sm:grid-cols-2 @3xl:grid-cols-3">
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">Ref / JE No.</dt><dd className="mt-1 flex min-w-0 items-start gap-2"><button type="button" className="min-w-0 text-left font-mono font-semibold text-primary [overflow-wrap:anywhere] hover:underline focus-visible:outline-2 focus-visible:outline-ring" aria-label={`Open details for ${group.jeNo}`} onClick={event=>onDrillDown(group,event.currentTarget)}>{group.jeNo}</button>{group.isImbalanced&&<AlertCircle aria-label="Imbalanced journal" className="mt-1 size-4 shrink-0 text-rose-500" />}</dd></div>
            {[["Date",group.transactionDate ? format(new Date(group.transactionDate),"yyyy-MM-dd") : "-"],["Posting Date",group.postingDate ? format(new Date(group.postingDate),"yyyy-MM-dd") : "-"],["Type",journalEntryType(group.sourceModule)||"-"],["Source",group.sourceModule||"-"]].map(([label,value])=><div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 [overflow-wrap:anywhere]">{value}</dd></div>)}
            <div className="min-w-0"><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1"><span className={cn("inline-flex max-w-full whitespace-normal rounded-full border px-3 py-0.5 text-xs [overflow-wrap:anywhere]",getStatusClasses((group.status||"").toLowerCase()))}>{group.status||"UNKNOWN"}</span></dd></div>
          </dl>
          <div className="divide-y">{journalLines(group).map(({entry,index,creditLine,last,balance})=><section key={index} aria-label={`Accounting line ${index+1}`} className="min-w-0 space-y-3 p-4 text-sm">
            <dl className="grid min-w-0 grid-cols-1 gap-3 @xl:grid-cols-2">
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Account Title</dt><dd className={cn("mt-1 font-medium [overflow-wrap:anywhere]",creditLine&&"pl-4 font-normal text-muted-foreground")}>{entry.accountTitle||entry.accountNumber||"-"}</dd></div>
              <div className="min-w-0"><dt className="text-xs text-muted-foreground">Description / Narrative</dt><dd className={cn("mt-1 whitespace-pre-wrap [overflow-wrap:anywhere]",creditLine&&"italic text-muted-foreground")}>{entry.description||group.description||"-"}</dd></div>
              {[["Division",entry.divisionName||entry.division||"-"],["Department",entry.departmentName||entry.department||"-"]].map(([label,value])=><div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 [overflow-wrap:anywhere]">{value}</dd></div>)}
            </dl>
            <dl className="grid min-w-0 grid-cols-1 gap-3 @md:grid-cols-3">{[["Debit",entry.debit!==0?formatJournalAmount(entry.debit):"-"],["Credit",entry.credit!==0?formatJournalAmount(entry.credit):"-"],["Balance",balance!==null?formatJournalAmount(balance):"-"]].map(([label,value])=><div key={label} className="min-w-0"><dt className="text-xs text-muted-foreground">{label}</dt><dd className={cn("mt-1 tabular-nums [overflow-wrap:anywhere]",label==="Balance"&&last&&group.balance!==0&&"font-semibold text-rose-600 dark:text-rose-400")}>{value}</dd></div>)}</dl>
          </section>)}</div>
        </article>)}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex-1 text-sm font-medium text-muted-foreground">
          {totalGroupCount === 0
            ? "Showing 0 of 0 journals."
            : `Showing ${currentPage * pageSize + 1}–${Math.min((currentPage + 1) * pageSize, totalGroupCount)} of ${totalGroupCount} ${totalGroupCount === 1 ? "journal" : "journals"}.`}
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:gap-6">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-medium">Rows per page</p>
            <Select value={`${pageSize}`} onValueChange={(value) => onPageSizeChange(Number(value))}>
              <SelectTrigger aria-label="Rows per page" className="h-8 w-[70px] rounded-lg">
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
