// src/modules/financial-management/treasury/salesmen-expense-approval/components/SalesmanExpenseTable.tsx
"use client";

import * as React from "react";
import { Loader2, FolderOpen, Search, Layers, Coins, FileText, AlertCircle, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Input } from "@/components/ui/input";
import type { SalesmanExpenseRow } from "../type";

interface Props {
  rows: SalesmanExpenseRow[];
  totalItems: number;
  q: string;
  setQ: (v: string) => void;
  page: number;
  setPage: (v: number) => void;
  pageCount: number;
  loading: boolean;
  onAction: (row: SalesmanExpenseRow) => void;
  selectedId?: number | null;
}

export default function SalesmanExpenseTable(props: Props) {
  const {
    rows,
    totalItems,
    q,
    setQ,
    page,
    setPage,
    pageCount,
    loading,
    onAction,
    selectedId,
  } = props;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading salesmen…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {/* Search Input */}
      <div className="relative max-w-sm shrink-0">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search salesman by name or code..."
          className="pl-8 h-8 text-xs"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Flexible Height Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-[1.5rem] border bg-white shadow-xl shadow-slate-200/20 relative">
        <Table className="w-full table-fixed">
          <colgroup>
            <col className="w-9" />
            <col className="w-[35%]" />
            <col className="w-[20%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
            <col className="w-[15%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur-md border-b">
            <TableRow className="bg-slate-50/50">
              <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-12">#</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Account Identity</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-widest text-slate-400">Division</TableHead>
              <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-32">Submittals</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-widest text-slate-400 pr-8">Outstanding Exposure</TableHead>
              <TableHead className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-[340px] text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <FolderOpen className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">No salesmen with pending expenses.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow
                  key={`${row.employee_id}_${row.division_id}`}
                  className={`transition-colors group ${selectedId === row.id ? "bg-primary/10 hover:bg-primary/15" : "hover:bg-muted/30"}`}
                >
                  <TableCell className="text-center text-muted-foreground text-xs font-mono">
                    {(page - 1) * 5 + idx + 1}
                  </TableCell>
                  <TableCell className="overflow-hidden">
                    <div className="flex items-center gap-3">
                       <div className={`h-10 w-10 rounded-2xl flex items-center justify-center font-black text-xs border shadow-inner transition-all duration-300 ${selectedId === row.id ? "bg-primary text-white border-primary shadow-primary/20 scale-110" : "bg-slate-50 text-slate-400 border-slate-100 group-hover:bg-white group-hover:border-primary/30 group-hover:text-primary"}`}>
                          {row.salesman_name.charAt(0)}
                       </div>
                       <div className="min-w-0">
                          <span className="font-black text-[13px] text-slate-800 block truncate leading-tight mb-0.5" title={row.salesman_name}>
                            {row.salesman_name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-black uppercase tracking-tighter block">
                            ID: {row.salesman_code}
                          </span>
                       </div>
                    </div>
                  </TableCell>
                  <TableCell className="overflow-hidden">
                    {row.division_name ? (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight truncate max-w-[120px]">{row.division_name}</span>
                      </div>
                    ) : (
                      <span className="text-slate-300 text-[10px] font-black italic">No Division</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center overflow-hidden">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 shadow-sm group-hover:scale-105 transition-transform">
                      <Layers size={12} className="text-blue-600" />
                      <span className="text-[11px] font-black text-blue-700 tabular-nums">
                        {row.header_count} <span className="text-[9px] text-blue-400 font-bold uppercase ml-0.5">Periods</span>
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-8 overflow-hidden">
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        <Coins size={14} className="text-emerald-500" />
                        <span className="text-sm font-black tabular-nums text-slate-900 tracking-tight">
                          {new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(row.pending_amount || 0)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {row.draft_count > 0 && (
                          <div className="flex items-center gap-1">
                            <FileText size={10} className="text-slate-400" />
                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">{row.draft_count} Draft</span>
                          </div>
                        )}
                        {row.concern_count > 0 && (
                          <div className="flex items-center gap-1">
                            <AlertCircle size={10} className="text-amber-500" />
                            <span className="text-[9px] font-black text-amber-600 uppercase tracking-tighter">{row.concern_count} Concern</span>
                          </div>
                        )}
                        {row.rejected_count > 0 && (
                          <div className="flex items-center gap-1">
                            <XCircle size={10} className="text-rose-500" />
                            <span className="text-[9px] font-black text-rose-600 uppercase tracking-tighter">{row.rejected_count} Rejected</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center overflow-hidden">
                    <Button
                      size="sm"
                      variant={selectedId === row.id ? "default" : "outline"}
                      className={`h-8 w-full max-w-[100px] mx-auto rounded-full transition-all group/btn flex items-center justify-center gap-2 ${selectedId === row.id ? "shadow-lg shadow-primary/20 scale-105" : "hover:bg-slate-50 border-slate-200"}`}
                      onClick={() => onAction(row)}
                    >
                      <span className="text-[10px] font-black uppercase tracking-widest">
                        {selectedId === row.id ? "Active" : "Review"}
                      </span>
                      <ArrowRight size={14} className={selectedId === row.id ? "text-white" : "text-slate-400 group-hover/btn:text-primary"} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between shrink-0 border-t pt-3">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-bold text-foreground">{rows.length}</span> of{" "}
          <span className="font-bold text-foreground">{totalItems}</span> salesmen
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm font-medium">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= pageCount}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

