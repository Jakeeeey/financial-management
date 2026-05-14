// src/modules/financial-management/treasury/bulk-approval/components/DraftListTable.tsx
"use client";

import * as React from "react";
import { Loader2, FolderOpen, Search, CheckCircle2, Clock, LockKeyhole, AlertTriangle, ShieldCheck, ArrowLeft, ChevronRight, Eye } from "lucide-react";
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
  actionLoadingId?: number | null;
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
    actionLoadingId,
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
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search drafts..."
            className="pl-7 h-7 text-[11px] bg-background/60 focus:bg-background transition-colors border-muted-foreground/20"
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
              <SelectTrigger className="h-7 w-[160px] text-[11px] bg-background/60 border-muted-foreground/20">
                <div className="flex items-center gap-1.5">
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
        <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 border border-primary/20 rounded-lg text-[10px] font-semibold text-primary shrink-0 leading-none">
          <LockKeyhole className="h-3 w-3 shrink-0" />
          {Object.keys(levelsByDivision).length > 1 ? (
            <span>Active roles in <span className="underline underline-offset-2">{Object.keys(levelsByDivision).length} divisions</span>.</span>
          ) : (
            <span>You are a <span className="underline underline-offset-2">Level {myLevel}</span> approver.</span>
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
              <TableHead className="text-center text-[10px] px-1 py-2">#</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-tight py-2">Doc No</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-tight py-2">Division</TableHead>
              <TableHead className="text-[10px] font-black uppercase tracking-tight py-2">Salesman</TableHead>
              <TableHead className="text-right text-[10px] font-black uppercase tracking-tight py-2">Amount</TableHead>
              <TableHead className="text-center text-[10px] font-black uppercase tracking-tight py-2">Date</TableHead>
              <TableHead className="text-center text-[10px] font-black uppercase tracking-tight py-2">Status</TableHead>
              <TableHead className="text-center text-[10px] font-black uppercase tracking-tight py-2">Tier</TableHead>
              <TableHead className="text-center text-[9px] font-black uppercase tracking-widest w-[100px] py-2">Action</TableHead>
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
              rows.map((row, idx) => {
                const isActionLoading = actionLoadingId === row.id;

                return (
                <TableRow
                  key={row.id}
                  className={`transition-colors group
                    ${row.has_concern
                      ? "bg-amber-50/40 hover:bg-amber-50/70 border-l-2 border-l-amber-400"
                      : "hover:bg-muted/30"
                    }`}
                >
                  <TableCell className="text-center text-muted-foreground text-[10px] font-mono py-1.5">
                    {(page - 1) * 8 + idx + 1}
                  </TableCell>
                  <TableCell className="overflow-hidden py-1.5">
                    <span className="font-black text-[11px] font-mono text-primary block truncate" title={row.doc_no}>
                      {row.doc_no}
                    </span>
                  </TableCell>
                  <TableCell className="overflow-hidden py-1.5">
                    <Badge
                      variant="outline"
                      className="text-[9px] font-bold bg-muted/50 border-muted-foreground/30 px-1.5 py-0 max-w-full block truncate"
                      title={row.division_name || "N/A"}
                    >
                      {row.division_name || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5">
                    <div className="font-black text-[12px] text-foreground leading-tight truncate">
                      {row.encoder_name}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black tabular-nums text-[12px] overflow-hidden py-1.5">
                    <span className="block truncate" title={formatCurrency(Number(row.total_amount))}>
                      {formatCurrency(Number(row.total_amount))}
                    </span>
                  </TableCell>
                  <TableCell className="text-center text-[10px] text-muted-foreground font-medium overflow-hidden py-1.5">
                    <span className="block truncate">{formatDate(row.transaction_date)}</span>
                  </TableCell>
                  <TableCell className="text-center overflow-hidden py-1.5">
                    <div className="flex justify-center scale-90">
                      <StatusBadge status={row.status} current_tier={row.current_tier} has_concern={row.has_concern} />
                    </div>
                  </TableCell>
                  <TableCell className="overflow-hidden py-1.5">
                    <div className="flex justify-center scale-90">
                      <TierProgress
                        current={row.current_tier}
                        max={row.max_level}
                        approversPerLevel={row.approvers_per_level}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-center overflow-hidden py-1.5">
                    <div className="flex flex-col items-center justify-center gap-1">
                      {row.requires_final_top_sheet ? (
                        <Button
                          size="sm"
                          className="h-7 px-4 rounded-xl bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-[0.15em] hover:bg-primary/90 transition-all shadow-lg shadow-primary/10 active:scale-95 flex items-center gap-1.5"
                          onClick={() => onAction(row)}
                          disabled={isActionLoading}
                        >
                          {isActionLoading ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <ShieldCheck className="h-3 w-3" />
                          )}
                          {isActionLoading ? "Opening..." : "Open Top Sheet"}
                        </Button>
                      ) : row.my_vote ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 rounded-xl border-emerald-200 bg-emerald-50 text-emerald-700 text-[9px] font-black uppercase tracking-[0.1em] hover:bg-emerald-100 hover:text-emerald-800 transition-all flex items-center gap-1.5 group/action"
                          onClick={() => onAction(row)}
                        >
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 group-hover/action:scale-110 transition-transform" />
                          Review Audit
                        </Button>
                      ) : row.can_vote ? (
                        <Button
                          size="sm"
                          className="h-7 px-4 rounded-xl bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.15em] hover:bg-primary transition-all shadow-lg shadow-slate-900/10 active:scale-95 flex items-center gap-1.5"
                          onClick={() => onAction(row)}
                        >
                          <ShieldCheck className="h-3 w-3 text-emerald-400" />
                          Cast Vote
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 rounded-xl border-slate-200 bg-slate-50 text-slate-500 text-[9px] font-black uppercase tracking-[0.1em] hover:bg-white hover:text-slate-900 hover:border-slate-300 transition-all flex items-center gap-1.5 group/action"
                          onClick={() => onAction(row)}
                        >
                          <Eye className="h-3 w-3 text-slate-400 group-hover/action:text-primary transition-colors" />
                          Inspect Audit
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between shrink-0 border-t pt-2">
        <p className="text-[11px] text-muted-foreground">
          <span className="font-bold text-foreground">{rows.length}</span> /{" "}
          <span className="font-bold text-foreground">{totalItems}</span> drafts
        </p>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(page - 1)} disabled={page <= 1}>
             <ArrowLeft className="h-3 w-3" />
          </Button>
          <span className="text-[11px] font-bold">
            {page} / {pageCount}
          </span>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setPage(page + 1)} disabled={page >= pageCount}>
             <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
