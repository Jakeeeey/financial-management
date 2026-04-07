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
        <TableHeader className="bg-slate-100 text-slate-800 border-b border-slate-200">
          <TableRow className="hover:bg-slate-100">
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
          {groups.map((group) => (
            <React.Fragment key={group.jeGroupCounter}>
              {/* LINE ITEM ROWS (With conditional Header info) */}
              {group.entries.map((entry, idx) => (
                <TableRow 
                  key={`${entry.jeGroupCounter}-${idx}`} 
                  onClick={() => onDrillDown(group)}
                  className={cn(
                    "cursor-pointer group/row transition-colors",
                    idx === 0 && "border-t-2 border-t-slate-200 bg-background",
                    idx > 0 && "border-none bg-background",
                    "hover:bg-indigo-50/40"
                  )}
                >
                  <TableCell className="align-top py-3 font-semibold text-xs text-slate-700">
                    {idx === 0 ? format(new Date(group.transactionDate), "yyyy-MM-dd") : ""}
                  </TableCell>
                  <TableCell className="align-top py-3 text-center">
                    {idx === 0 && (
                        <Badge variant="outline" className="text-[10px] font-bold bg-white shadow-sm border-slate-200 px-2 py-0 h-5">
                            {group.sourceModule.split(" ")[0]}
                        </Badge>
                    )}
                  </TableCell>
                  <TableCell className="align-top py-3 font-mono text-[11px] font-black text-slate-900 group-hover/row:text-indigo-600 transition-colors">
                      {idx === 0 && (
                          <div className="flex items-center gap-1.5">
                              {group.jeNo}
                              {group.isImbalanced && <AlertCircle className="h-3 w-3 text-rose-500" />}
                          </div>
                      )}
                  </TableCell>
                  <TableCell className="align-top py-3 font-semibold text-[11px] text-slate-800">
                    <div className={cn(idx > 0 && "pl-6 text-slate-600")}>
                        {entry.accountTitle}
                    </div>
                  </TableCell>
                  <TableCell className="align-top py-3 text-[11px]">
                    {idx === 0 ? (
                       <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-slate-900 group-hover/row:underline underline-offset-2 break-words">
                             {group.description}
                          </span>
                          <span className="italic text-slate-500 opacity-80 mt-1">Ref: {group.jeNo}</span>
                       </div>
                    ) : (
                       <span className="italic text-slate-500">{entry.accountTitle} distribution</span>
                    )}
                  </TableCell>
                  <TableCell className="align-top py-3 text-[10px] font-bold text-slate-500">
                      {idx === 0 ? group.sourceModule : "- / -"}
                  </TableCell>
                  <TableCell className="align-top py-3 text-right tabular-nums font-semibold text-[11px] text-slate-700">
                    {entry.debit > 0 ? formatNumber(entry.debit) : ""}
                  </TableCell>
                  <TableCell className="align-top py-3 text-right tabular-nums font-semibold text-[11px] text-slate-700">
                    {entry.credit > 0 ? formatNumber(entry.credit) : ""}
                  </TableCell>
                  <TableCell className="align-top py-3 text-right tabular-nums">
                    {idx === 0 && group.balance !== 0 ? (
                        <span className={cn(
                            "text-[11px] font-black",
                            group.isImbalanced ? "text-rose-600" : "text-slate-700"
                        )}>
                            {formatNumber(group.balance)}
                        </span>
                    ) : ""}
                  </TableCell>
                  <TableCell className="align-top py-3 text-right">
                      {idx === 0 && (
                          <div className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm border",
                              group.status === "Posted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                              group.status === "For Review" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              group.status === "Approved" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-slate-50 text-slate-700 border-slate-200"
                          )}>
                              {group.status}
                          </div>
                      )}
                  </TableCell>
                </TableRow>
              ))}
              
              {/* BALANCE SUMMARY ROW (INTERNAL TO GROUP) */}
              <TableRow 
                onClick={() => onDrillDown(group)}
                className="cursor-pointer border-none bg-background hover:bg-indigo-50/40"
              >
                  <TableCell colSpan={6} className="py-2 pr-6">
                      <div className="flex justify-end">
                         <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">TOTAL MATCH</span>
                      </div>
                  </TableCell>
                  <TableCell className="py-2 text-right tabular-nums text-[11px] font-black text-slate-900 border-t border-slate-200">
                    {formatNumber(group.totalDebit)}
                  </TableCell>
                  <TableCell className="py-2 text-right tabular-nums text-[11px] font-black text-slate-900 border-t border-slate-200">
                    {formatNumber(group.totalCredit)}
                  </TableCell>
                  <TableCell colSpan={2} className="py-2 border-t border-slate-200" />
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
