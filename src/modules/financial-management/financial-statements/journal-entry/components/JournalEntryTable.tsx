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
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[110px] text-[11px] font-bold uppercase tracking-wider">Date</TableHead>
            <TableHead className="w-[100px] text-[11px] font-bold uppercase tracking-wider text-center">Type</TableHead>
            <TableHead className="w-[140px] text-[11px] font-bold uppercase tracking-wider">Ref / JE No.</TableHead>
            <TableHead className="w-[200px] text-[11px] font-bold uppercase tracking-wider">Account Title</TableHead>
            <TableHead className="min-w-[240px] text-[11px] font-bold uppercase tracking-wider">Description / Narrative</TableHead>
            <TableHead className="w-[100px] text-[11px] font-bold uppercase tracking-wider">Source</TableHead>
            <TableHead className="w-[100px] text-[11px] font-bold uppercase tracking-wider text-right">Debit</TableHead>
            <TableHead className="w-[100px] text-[11px] font-bold uppercase tracking-wider text-right">Credit</TableHead>
            <TableHead className="w-[100px] text-[11px] font-bold uppercase tracking-wider text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groups.map((group) => (
            <React.Fragment key={group.jeGroupCounter}>
              {/* PRIMARY ENTRY ROW */}
              <TableRow 
                className={cn(
                  "bg-muted/5 group border-t-2 border-muted/80",
                  group.isImbalanced && "bg-orange-50/50 hover:bg-orange-100/50"
                )}
              >
                <TableCell className="font-medium text-xs">
                  {format(new Date(group.transactionDate), "yyyy-MM-dd")}
                </TableCell>
                <TableCell className="text-center">
                    <Badge variant="outline" className="text-[10px] font-semibold bg-background shadow-sm border-muted-foreground/20 px-1 py-0 h-4">
                        {group.sourceModule.split(" ")[0]}
                    </Badge>
                </TableCell>
                <TableCell className="font-mono text-[11px] font-bold text-indigo-600">
                    <div className="flex items-center gap-1">
                        {group.jeNo}
                        {group.isImbalanced && <AlertCircle className="h-3 w-3 text-orange-500" />}
                    </div>
                </TableCell>
                <TableCell className="text-muted-foreground text-[10px] italic">
                   Header Primary Context
                </TableCell>
                <TableCell>
                  <button 
                    onClick={() => onDrillDown(group)}
                    className="text-left hover:text-primary transition-colors focus:outline-none"
                  >
                    <div className="flex flex-col">
                        <span className="font-semibold text-xs text-foreground group-hover:underline underline-offset-2 flex items-center gap-1.5 leading-tight">
                            {group.description}
                            <ExternalLink className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </span>
                        <span className="text-[10px] text-muted-foreground/80 mt-0.5">Ref: {group.jeNo}</span>
                    </div>
                  </button>
                </TableCell>
                <TableCell className="text-[10px] font-medium text-muted-foreground">
                    {group.sourceModule}
                </TableCell>
                <TableCell colSpan={2} className="p-0">
                    {group.isImbalanced && (
                        <div className="flex items-center justify-end px-4 h-full">
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                                <AlertCircle className="h-2.5 w-2.5" />
                                IMBALANCE: {formatNumber(group.balance)}
                            </span>
                        </div>
                    )}
                </TableCell>
                <TableCell className="text-right">
                    <div className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight shadow-sm",
                        group.status === "Posted" ? "bg-emerald-100 text-emerald-800" :
                        group.status === "For Review" ? "bg-amber-100 text-amber-800" :
                        group.status === "Approved" ? "bg-blue-100 text-blue-800" : "bg-slate-100 text-slate-800"
                    )}>
                        {group.status}
                    </div>
                </TableCell>
              </TableRow>

              {/* LINE ITEM ROWS */}
              {group.entries.map((entry, idx) => (
                <TableRow key={`${entry.jeGroupCounter}-${idx}`} className="hover:bg-muted/50 border-none transition-colors">
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell className="font-semibold text-[11px] text-slate-700">
                    <div className={cn(idx > 0 && "pl-4 border-l-2 ml-1 border-muted/50")}>
                        {entry.accountTitle}
                    </div>
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground/70 italic">
                    {entry.accountTitle} distribution
                  </TableCell>
                  <TableCell className="text-[10px] text-muted-foreground/60">
                    {entry.division || "-"} / {entry.department || "-"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-[11px]">
                    {entry.debit > 0 ? formatNumber(entry.debit) : ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium text-[11px]">
                    {entry.credit > 0 ? formatNumber(entry.credit) : ""}
                  </TableCell>
                  <TableCell />
                </TableRow>
              ))}
              
              {/* BALANCE SUMMARY ROW (INTERNAL TO GROUP) */}
              <TableRow className="h-8 border-b-2 border-muted hover:bg-transparent">
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-[10px] font-bold text-muted-foreground text-right">TOTAL MATCH</TableCell>
                  <TableCell className="text-right tabular-nums text-[11px] font-black border-t border-slate-200">
                    {formatNumber(group.totalDebit)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-[11px] font-black border-t border-slate-200">
                    {formatNumber(group.totalCredit)}
                  </TableCell>
                  <TableCell />
              </TableRow>
            </React.Fragment>
          ))}
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
