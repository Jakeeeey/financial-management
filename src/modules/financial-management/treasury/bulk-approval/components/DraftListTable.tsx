// src/modules/financial-management/treasury/bulk-approval/components/DraftListTable.tsx
"use client";

import * as React from "react";
import { Loader2, FolderOpen, Search, CheckCircle2, Clock, LockKeyhole } from "lucide-react";
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
    <div className="flex items-center gap-1">
      {Array.from({ length: max }, (_, i) => i + 1).map(level => {
        const isDone = level < current;
        const isActive = level === current;
        return (
          <div key={level} className="flex items-center gap-1">
            <div
              title={`Level ${level} (${approversPerLevel[level] ?? 0} approver${(approversPerLevel[level] ?? 0) !== 1 ? "s" : ""})`}
              className={`flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black transition-all
                ${isDone ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30" :
                  isActive ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30 animate-pulse" :
                  "bg-muted text-muted-foreground border border-muted-foreground/20"}`}
            >
              {isDone ? <CheckCircle2 className="h-3 w-3" /> : level}
            </div>
            {level < max && (
              <div className={`w-4 h-0.5 rounded-full transition-all ${isDone ? "bg-emerald-400" : "bg-muted"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status, current_tier }: { status: string; current_tier: number }) {
  const s = status.toUpperCase();
  if (s === "SUBMITTED" || s.startsWith("PENDING")) {
    return (
      <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 gap-1">
        <Clock className="h-3 w-3" />
        Level {current_tier}
      </Badge>
    );
  }
  if (s === "APPROVED") return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Approved</Badge>;
  if (s === "REJECTED") return <Badge className="bg-red-100 text-red-700 border-red-200">Rejected</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export default function DraftListTable(props: Props) {
  const { rows, totalItems, q, setQ, page, setPage, pageCount, loading, myLevel, levelsByDivision, onAction } = props;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm font-medium">Loading pending drafts…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Search */}
      <div className="relative max-w-sm shrink-0">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by doc no, payee, or remarks..."
          className="pl-9"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Level indicator */}
      {Object.keys(levelsByDivision).length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 border border-primary/20 rounded-xl text-xs font-bold text-primary shrink-0 transition-all hover:bg-primary/10">
          <LockKeyhole className="h-3.5 w-3.5" />
          {Object.keys(levelsByDivision).length > 1 ? (
            <span>You have active approval roles in <span className="underline underline-offset-2">{Object.keys(levelsByDivision).length} divisions</span>. The action button is enabled only when a draft reaches your specific tier.</span>
          ) : (
            <span>You are a <span className="underline underline-offset-2">Level {myLevel}</span> approver — buttons are active only when the draft reaches your tier.</span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-xl border shadow-inner bg-background relative">
        <Table className="relative min-w-max w-full">
          <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm shadow-sm">
            <TableRow className="bg-muted/50">
              <TableHead className="w-10 text-center text-xs">#</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-tight">Doc No</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-tight">Division</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-tight">Payee</TableHead>
              <TableHead className="text-right text-xs font-bold uppercase tracking-tight">Amount</TableHead>
              <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Date</TableHead>
              <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Status</TableHead>
              <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Tier Progress</TableHead>
              <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-[340px] text-center">
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
                  className="hover:bg-muted/30 transition-colors group"
                >
                  <TableCell className="text-center text-muted-foreground text-xs font-mono">
                    {(page - 1) * 8 + idx + 1}
                  </TableCell>
                  <TableCell>
                    <span className="font-black text-sm font-mono text-primary">{row.doc_no}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px] font-bold bg-muted/50 border-muted-foreground/30 px-2 py-0">
                      {row.division_name || "N/A"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-bold text-sm">{row.payee_name}</span>
                      <span className="text-[10px] text-muted-foreground italic">
                        Encoded by: {row.encoder_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-black tabular-nums text-sm">
                    {formatCurrency(Number(row.total_amount))}
                  </TableCell>
                  <TableCell className="text-center text-xs text-muted-foreground font-medium">
                    {formatDate(row.transaction_date)}
                  </TableCell>
                  <TableCell className="text-center">
                    <StatusBadge status={row.status} current_tier={row.current_tier} />
                  </TableCell>
                  <TableCell className="text-center">
                    <TierProgress
                      current={row.current_tier}
                      max={row.max_level}
                      approversPerLevel={row.approvers_per_level}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant={row.can_vote ? "default" : "outline"}
                      className={`text-xs rounded-full transition-all
                        ${row.can_vote
                          ? "shadow-sm shadow-primary/20 font-bold"
                          : "text-muted-foreground"
                        }`}
                      onClick={() => onAction(row)}
                    >
                      {row.can_vote ? "Vote Now" : "View"}
                    </Button>
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
