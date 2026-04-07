"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { JournalEntryGroup, JournalEntry } from "../types";
import { cn, formatNumber } from "@/lib/utils";
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
  onDrillDown: (group: JournalEntryGroup) => void;
  currentPage: number;
  pageSize: number;
  pageCount: number;
  totalGroupCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

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
}: JournalEntryTableProps) {

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground bg-muted/5 rounded-xl border border-dashed animate-pulse">
        <p>Processing ledger entries...</p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground bg-muted/5 rounded-xl border border-dashed">
        <p>No journal entries found for the selected criteria.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border shadow-sm overflow-hidden bg-background">
        <Table>
          <TableHeader className="bg-muted/30 text-foreground border-b border-border">
            <TableRow className="hover:bg-muted/50">
              <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest py-3">Date</TableHead>
              <TableHead className="w-[80px] text-[10px] font-black uppercase tracking-widest text-center py-3">Type</TableHead>
              <TableHead className="w-[140px] text-[10px] font-black uppercase tracking-widest py-3">Ref / JE No.</TableHead>
              <TableHead className="w-[200px] text-[10px] font-black uppercase tracking-widest py-3">Account Title</TableHead>
              <TableHead className="min-w-[240px] text-[10px] font-black uppercase tracking-widest py-3">Description / Narrative</TableHead>
              <TableHead className="w-[120px] text-[10px] font-black uppercase tracking-widest py-3">Source</TableHead>
              <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest text-right py-3">Debit</TableHead>
              <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest text-right py-3">Credit</TableHead>
              <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest text-right py-3">Balance</TableHead>
              <TableHead className="w-[100px] text-[10px] font-black uppercase tracking-widest text-right py-3">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => {
              // Determine status colors based on hardcoded rules
              const statusStr = (group.status || "").trim();
              const statusLower = statusStr.toLowerCase();
              let statusClasses = "border-slate-200 text-slate-500 bg-white"; // default

              if (statusLower === "approved") {
                statusClasses = "border-blue-200 text-blue-700 bg-blue-50";
              } else if (statusLower === "posted") {
                statusClasses = "border-emerald-200 text-emerald-700 bg-emerald-50";
              } else if (statusLower === "for review") {
                statusClasses = "border-amber-200 text-amber-700 bg-amber-50";
              } else if (statusLower === "draft") {
                statusClasses = "border-slate-200 text-slate-700 bg-slate-50";
              } else if (statusLower === "dispatched") {
                statusClasses = "border-indigo-200 text-indigo-700 bg-indigo-50";
              } else if (statusLower === "voided" || statusLower === "cancelled") {
                statusClasses = "border-rose-200 text-rose-700 bg-rose-50";
              }

              const isKnown = ['draft', 'approved', 'posted', 'for review', 'dispatched', 'voided', 'cancelled'].includes(statusLower);

              const debitEntries = group.entries.filter(e => e.debit > 0);
              const creditEntries = group.entries.filter(e => e.credit > 0);

              const renderDistributionStrStack = (
                 entriesToRender: typeof group.entries, 
                 isDescCol: boolean = false,
                 isCredit: boolean = false
              ) => {
                 return (
                    <div className="flex flex-col gap-2">
                       {entriesToRender.map((e, idx) => (
                           <div key={idx} className={cn(
                              "min-h-[32px] flex items-center text-[11px]", 
                              isDescCol ? "text-muted-foreground max-w-[280px]" : "font-semibold text-foreground",
                              isCredit && !isDescCol && "pl-6 text-muted-foreground/80"
                           )}>
                              {isDescCol ? (
                                  idx === 0 && !isCredit ? (
                                    <div className="flex flex-col justify-center">
                                       <span className="font-semibold text-foreground break-words leading-tight">
                                          {group.description || "N/A"}
                                       </span>
                                       <span className="italic text-muted-foreground opacity-80 mt-0.5 text-[10px]">Ref: {group.jeNo}</span>
                                    </div>
                                  ) : (
                                    <span className="italic text-muted-foreground text-[10px] break-words line-clamp-2 leading-tight">
                                       - {e.accountTitle} distribution
                                    </span>
                                  )
                              ) : (
                                 e.accountTitle
                              )}
                           </div>
                       ))}
                    </div>
                 );
              };

              const renderNumericStack = (entriesToRender: typeof group.entries, field: "debit" | "credit") => {
                 return (
                    <div className="flex flex-col gap-2">
                       {entriesToRender.map((e, idx) => (
                           <div key={idx} className="min-h-[32px] flex justify-end items-center text-[11px] font-semibold text-foreground/90">
                               {e[field] > 0 ? formatNumber(e[field]) : ""}
                           </div>
                       ))}
                    </div>
                 );
              }

              return (
                <React.Fragment key={group.jeGroupCounter}>
                  {/* ROW 1: PRIMARY (DEBIT) */}
                  <TableRow
                    onClick={() => onDrillDown(group)}
                    className="cursor-pointer transition-colors border-b border-border hover:bg-muted/50 group/debit"
                  >
                    <TableCell className="align-top py-4 font-semibold text-xs text-foreground group-hover/debit:bg-muted/20">
                      {format(new Date(group.transactionDate), "yyyy-MM-dd")}
                    </TableCell>
                    <TableCell className="align-top py-4 text-center group-hover/debit:bg-muted/20">
                      <Badge variant="outline" className="text-[10px] font-bold shadow-sm border-border px-2 py-0 h-5">
                        {group.sourceModule.split(" ")[0]}
                      </Badge>
                    </TableCell>
                    <TableCell className="align-top py-4 font-mono text-[11px] font-black text-foreground group-hover/debit:text-primary group-hover/debit:bg-muted/20">
                      <div className="flex items-center gap-1.5">
                        {group.jeNo}
                        {group.isImbalanced && <AlertCircle className="h-3.5 w-3.5 text-rose-500" />}
                      </div>
                    </TableCell>

                    <TableCell className="align-top py-4">
                       {renderDistributionStrStack(debitEntries, false, false)}
                    </TableCell>
                    <TableCell className="align-top py-4">
                       {renderDistributionStrStack(debitEntries, true, false)}
                    </TableCell>

                    <TableCell className="align-top py-4 text-[10px] font-bold text-muted-foreground group-hover/debit:bg-muted/20">
                      {group.sourceModule}
                    </TableCell>

                    <TableCell className="align-top py-4 text-right tabular-nums">
                       {renderNumericStack(debitEntries, "debit")}
                       {/* Total Debit on the same row if desired? Wait, the wireframe shows Debit totals on the same block. Let's put the total at the bottom of the stack! */}
                       {debitEntries.length > 0 && (
                           <div className="min-h-[28px] mt-2 flex justify-end items-center text-[11px] font-black text-foreground border-t border-border pt-1">
                              {formatNumber(group.totalDebit)}
                           </div>
                       )}
                    </TableCell>
                    <TableCell className="align-top py-4 text-right tabular-nums"></TableCell>

                    <TableCell className="align-top py-4 text-right tabular-nums group-hover/debit:bg-muted/20">
                      {group.balance !== 0 ? (
                        <span className={cn(
                          "text-[11px] font-black",
                          group.isImbalanced ? "text-rose-600" : "text-foreground"
                        )}>
                          {formatNumber(group.balance)}
                        </span>
                      ) : (
                        <span className="text-[11px] font-bold text-muted-foreground">0.00</span>
                      )}
                    </TableCell>
                    <TableCell className="align-top py-4 text-right group-hover/debit:bg-muted/20">
                      <div className={cn(
                        "inline-flex items-center px-3 py-0.5 rounded-full text-[11px] font-medium border shadow-sm",
                        statusClasses
                      )}>
                        {isKnown ? group.status : statusStr.toUpperCase()}
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* ROW 2: SECONDARY (CREDIT) */}
                  <TableRow
                    onClick={() => onDrillDown(group)}
                    className="cursor-pointer transition-colors border-b-2 border-border/80 hover:bg-muted/50 group/credit"
                  >
                    {/* Empty cells for metadata aligning */}
                    <TableCell className="group-hover/credit:bg-muted/20"></TableCell>
                    <TableCell className="group-hover/credit:bg-muted/20"></TableCell>
                    <TableCell className="group-hover/credit:bg-muted/20"></TableCell>

                    <TableCell className="align-top py-4">
                       {renderDistributionStrStack(creditEntries, false, true)}
                    </TableCell>
                    <TableCell className="align-top py-4">
                       {renderDistributionStrStack(creditEntries, true, true)}
                    </TableCell>

                    <TableCell className="group-hover/credit:bg-muted/20"></TableCell>

                    <TableCell className="align-top py-4 text-right tabular-nums"></TableCell>
                    <TableCell className="align-top py-4 text-right tabular-nums">
                       {renderNumericStack(creditEntries, "credit")}
                       {/* Total Credit */}
                       {creditEntries.length > 0 && (
                           <div className="min-h-[28px] mt-2 flex justify-end items-center text-[11px] font-black text-foreground border-t border-border pt-1">
                              {formatNumber(group.totalCredit)}
                           </div>
                       )}
                    </TableCell>
                    
                    <TableCell className="group-hover/credit:bg-muted/20"></TableCell>
                    <TableCell className="group-hover/credit:bg-muted/20"></TableCell>
                  </TableRow>
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls — matches NewDataTable visual */}
      <div className="flex items-center justify-between px-2">
        <div className="flex-1 text-sm text-muted-foreground font-medium">
          Showing {totalGroupCount === 0 ? 0 : currentPage * pageSize + 1}-{Math.min((currentPage + 1) * pageSize, totalGroupCount)} of{" "}
          {totalGroupCount} group(s).
        </div>
        <div className="flex items-center space-x-6 lg:space-x-8">
          <div className="flex items-center space-x-2">
            <p className="text-sm font-bold">Rows per page</p>
            <Select
              value={`${pageSize}`}
              onValueChange={(value) => onPageSizeChange(Number(value))}
            >
              <SelectTrigger className="h-8 w-[70px] rounded-lg">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40, 50].map((size) => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-[100px] items-center justify-center text-sm font-bold">
            Page {currentPage + 1} of {pageCount}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex rounded-lg"
              onClick={() => onPageChange(0)}
              disabled={currentPage === 0}
            >
              <span className="sr-only">Go to first page</span>
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 0}
            >
              <span className="sr-only">Go to previous page</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0 rounded-lg"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= pageCount - 1}
            >
              <span className="sr-only">Go to next page</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="hidden h-8 w-8 p-0 lg:flex rounded-lg"
              onClick={() => onPageChange(pageCount - 1)}
              disabled={currentPage >= pageCount - 1}
            >
              <span className="sr-only">Go to last page</span>
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
