// src/modules/financial-management/treasury/bulk-approval/components/DraftListTable.tsx
"use client";

import * as React from "react";
import { Loader2, FolderOpen, Search, CheckCircle2, Clock, LockKeyhole, AlertTriangle, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Filter } from "lucide-react";
import type { DraftRow } from "../type";

interface Props {
  rows: DraftRow[];
  totalItems: number;
  q: string;
  setQ: (v: string) => void;
  page: number;
  setPage: (v: number) => void;
  pageCount: number;
  loading: boolean;
  myLevel: number;
  levelsByDivision: Record<number, number[]>;
  selectedDivisionId?: number;
  setSelectedDivisionId: (v: number | undefined) => void;
  availableDivisions: { id: number; name: string }[];
  onAction: (row: DraftRow) => void;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch {
    return d;
  }
}

function TierProgress({ current, max, approversPerLevel }: {
  current: number;
  max: number;
  approversPerLevel: Record<number, number>;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => i + 1).map(level => {
        const isDone = level < current;
        const isActive = level === current;
        return (
          <div key={level} className="flex items-center gap-0.5">
            <div
              title={`Level ${level} (${approversPerLevel[level] ?? 0} approver${(approversPerLevel[level] ?? 0) !== 1 ? "s" : ""})`}
              className={`flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black transition-all shrink-0
                ${isDone ? "bg-emerald-500 text-white" :
                  isActive ? "bg-primary text-primary-foreground animate-pulse" :
                    "bg-muted text-muted-foreground border border-muted-foreground/20"}`}
            >
              {isDone ? <CheckCircle2 className="h-2.5 w-2.5" /> : level}
            </div>
            {level < max && (
              <div className={`w-2 h-px rounded-full transition-all ${isDone ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status, current_tier, has_concern }: { status: string; current_tier: number; has_concern?: boolean }) {
  const s = status.toUpperCase();
  return (
    <div className="flex flex-col items-center gap-0.5">
      {s === "SUBMITTED" || s.startsWith("PENDING") ? (
        <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 gap-0.5 text-[10px] px-1.5 py-0">
          <Clock className="h-2.5 w-2.5" />
          Lvl {current_tier}
        </Badge>
      ) : s === "APPROVED" ? (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] px-1.5 py-0 shadow-sm">Approved</Badge>
      ) : s === "REJECTED" ? (
        <Badge className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0 shadow-sm">Rejected</Badge>
      ) : s === "WITH CONCERN" || s === "WITH_CONCERN" ? (
        <Badge className="bg-orange-100 text-orange-800 border-orange-200 gap-1 text-[10px] px-1.5 py-0 shadow-sm animate-pulse">
          <AlertTriangle className="h-2.5 w-2.5" />
          With Concern
        </Badge>
      ) : (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{status}</Badge>
      )}
      {has_concern && (
        <Badge className="bg-amber-500/15 text-amber-700 border-amber-400/30 text-[9px] px-1 py-0 gap-0.5 font-black">
          <AlertTriangle className="h-2 w-2" />
          Concern
        </Badge>
      )}
    </div>
  );
}

export default function DraftListTable(props: Props) {
  const {
    rows,
    totalItems,
    q,
    setQ,
    page,
    setPage,
    pageCount,
    loading,
    myLevel,
    levelsByDivision,
    selectedDivisionId,
    setSelectedDivisionId,
    availableDivisions,
    onAction,
  } = props;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-medium">Loading pending drafts…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        <div className="relative max-w-sm flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by doc no, payee, or remarks..."
            className="pl-8 h-8 text-xs bg-background/60 focus:bg-background transition-colors border-muted-foreground/20"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>

        {availableDivisions.length > 1 && (
          <div className="flex items-center gap-2">
            <Select
              value={selectedDivisionId?.toString() || "all"}
              onValueChange={(val) => {
                setSelectedDivisionId(val === "all" ? undefined : Number(val));
              }}
            >
              <SelectTrigger className="h-8 w-[180px] text-xs bg-background/60 border-muted-foreground/20">
                <div className="flex items-center gap-2">
                  <Filter className="h-3 w-3 text-muted-foreground" />
                  <SelectValue placeholder="All Divisions" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Divisions</SelectItem>
                {availableDivisions.map((d) => (
                  <SelectItem key={d.id} value={d.id.toString()}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Level indicator */}
      {Object.keys(levelsByDivision).length > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-[11px] font-semibold text-primary shrink-0">
          <LockKeyhole className="h-3 w-3 shrink-0" />
          {Object.keys(levelsByDivision).length > 1 ? (
            <span>Active approval roles in <span className="underline underline-offset-2">{Object.keys(levelsByDivision).length} divisions</span> — action buttons activate when a draft is at or below your tier.</span>
          ) : (
            <span>You are a <span className="underline underline-offset-2">Level {myLevel}</span> approver — buttons active when draft is at or below your tier.</span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-xl border shadow-inner bg-background relative">
        <Table className="w-full table-fixed">
          <colgroup>
            <col className="w-9" />
            <col className="w-[11%]" />
            <col className="w-[12%]" />
            <col className="w-[17%]" />
            <col className="w-[13%]" />
            <col className="w-[11%]" />
            <col className="w-[10%]" />
            <col className="w-[11%]" />
            <col className="w-[15%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm shadow-sm">
            <TableRow className="bg-muted/50">
              <TableHead className="text-center text-xs">#</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-tight">Doc No</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-tight">Division</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-tight">Salesman</TableHead>
              <TableHead className="text-right text-xs font-bold uppercase tracking-tight">Amount</TableHead>
              <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Date</TableHead>
              <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Status</TableHead>
              <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Tier Progress</TableHead>
              <TableHead className="text-center text-[10px] font-black uppercase tracking-widest w-[110px]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-[340px] text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <FolderOpen className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">No pending disbursement drafts found.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  className={`transition-colors group
                    ${row.has_concern
                      ? "bg-amber-50/40 hover:bg-amber-50/70 border-l-2 border-l-amber-400"
                      : "hover:bg-muted/30"
                    }`}
                >
                  <TableCell className="text-center text-muted-foreground text-xs font-mono">
                    {(page - 1) * 8 + idx + 1}
                  </TableCell>
                  <TableCell className="overflow-hidden">
                    <span className="font-black text-xs font-mono text-primary block truncate" title={row.doc_no}>
                      {row.doc_no}
                    </span>
                  </TableCell>
                  <TableCell className="overflow-hidden">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-bold bg-muted/50 border-muted-foreground/30 px-2 py-0 max-w-full block truncate"
                      title={row.division_name || "N/A"}
                    >
                      {row.division_name || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-foreground">
                      {row.encoder_name}
                    </div>


                  </TableCell>
                  <TableCell className="text-right font-black tabular-nums text-xs overflow-hidden">
                    <span className="block truncate" title={formatCurrency(Number(row.total_amount))}>
                      {formatCurrency(Number(row.total_amount))}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground font-medium overflow-hidden">
                    <span className="block truncate">{formatDate(row.transaction_date)}</span>
                  </TableCell>
                  <TableCell className="text-center overflow-hidden">
                    <div className="flex justify-center">
                      <StatusBadge status={row.status} current_tier={row.current_tier} has_concern={row.has_concern} />
                    </div>
                  </TableCell>
                  <TableCell className="overflow-hidden">
                    <div className="flex justify-center">
                      <TierProgress
                        current={row.current_tier}
                        max={row.max_level}
                        approversPerLevel={row.approvers_per_level}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center overflow-hidden">
                    <div className="flex flex-col items-center justify-center gap-1.5 py-1">
                      {row.my_vote ? (
                        <div className="flex flex-col items-center">
                          <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
                            <CheckCircle2 className="h-3 w-3" />
                            Voted
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-3 mt-1 text-[10px] font-bold text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all rounded-lg"
                            onClick={() => onAction(row)}
                          >
                            Review Details
                          </Button>
                        </div>
                      ) : row.can_vote ? (
                        <Button
                          size="sm"
                          className="relative h-8 px-4 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-[11px] font-black uppercase tracking-wider shadow-lg shadow-blue-500/25 border-t border-white/20 hover:scale-105 active:scale-95 transition-all group overflow-hidden"
                          onClick={() => onAction(row)}
                        >
                          <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <span className="relative flex items-center gap-2">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Vote Now
                          </span>
                        </Button>
                      ) : (
                        <div className="flex flex-col items-center opacity-60 group-hover:opacity-100 transition-opacity">
                          <div className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-inner">
                            <Clock className="h-3 w-3" />
                            Waiting
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-3 mt-1 text-[10px] font-bold text-muted-foreground hover:text-slate-800 transition-all rounded-lg"
                            onClick={() => onAction(row)}
                          >
                            View Only
                          </Button>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between shrink-0 border-t pt-3">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-bold text-foreground">{rows.length}</span> of{" "}
          <span className="font-bold text-foreground">{totalItems}</span> drafts
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
            Previous
          </Button>
          <span className="text-sm font-medium">
            Page {page} of {pageCount}
          </span>
          <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= pageCount}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
