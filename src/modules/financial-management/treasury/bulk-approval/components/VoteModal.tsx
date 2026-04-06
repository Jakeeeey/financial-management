// src/modules/financial-management/treasury/bulk-approval/components/VoteModal.tsx
"use client";

import * as React from "react";
import {
  Loader2, AlertCircle, FileText, CheckCircle2, XCircle, Clock, 
  ShieldCheck, ChevronRight, X, PanelRightOpen, PanelRightClose, 
  History, ExternalLink
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { DraftDetail } from "../type";
import * as api from "../providers/fetchProvider";

interface Props {
  open: boolean;
  loading: boolean;
  detail: DraftDetail | null;
  onClose: () => void;
  onVoteComplete: () => void;
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
  } catch { return d; }
}

function VoteStatusIcon({ status }: { status: string }) {
  if (status === "APPROVED") return <CheckCircle2 className="h-3 w-3 text-emerald-500" />;
  if (status === "REJECTED") return <XCircle className="h-3 w-3 text-red-500" />;
  return <Clock className="h-3 w-3 text-amber-500" />;
}

function formatDateTime(d: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return d; }
}

function ParseTierLabel(status: string): number {
  if (!status) return 1;
  const s = status.toUpperCase();
  if (s === "SUBMITTED") return 1;
  const m = s.match(/PENDING_L(\d+)/);
  if (m) return parseInt(m[1], 10);
  return 1;
}

export default function VoteModal({ open, loading, detail, onClose, onVoteComplete }: Props) {
  const [remarks, setRemarks] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<"APPROVED" | "REJECTED" | null>(null);
  const [showTiers, setShowTiers] = React.useState(true);
  const [editedAmounts, setEditedAmounts] = React.useState<Record<number, string>>({});
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setRemarks("");
      setConfirmAction(null);
      setEditedAmounts({});
    }
  }, [open, detail]);

  const currentTotalAmount = React.useMemo(() => {
    if (!detail) return 0;
    const { payables, draft } = detail;
    if (!payables || payables.length === 0) return Number(draft.total_amount);
    return payables.reduce((acc, p) => {
      const val = editedAmounts[p.id];
      return acc + (val !== undefined && val !== "" ? Number(val) : Number(p.amount));
    }, 0);
  }, [detail, editedAmounts]);
  
  const isAnyItemModified = React.useMemo(() => {
    if (!detail) return false;
    return Object.entries(editedAmounts).some(([id, val]) => {
      const p = detail.payables.find(item => item.id === Number(id));
      return p && (val !== "" && Number(val) !== Number(p.amount));
    });
  }, [detail, editedAmounts]);

  if (!detail) return null;

  const { draft, payables, approvers_by_level, my_level, my_vote, can_vote } = detail;
  const currentTier = draft.current_tier ?? ParseTierLabel(draft.status);
  const maxLevel = draft.max_level ?? 1;

  const isRejectionSubmittable = confirmAction === "REJECTED" && remarks.trim().length >= 10;
  const isApprovalSubmittable = confirmAction === "APPROVED";

  async function handleVote() {
    if (!detail || !confirmAction) return;

    if (confirmAction === "REJECTED" && remarks.trim().length < 10) {
      toast.warning("Rejection reason must be at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const payloadEditedPayables = payables.map(p => {
        const edited = editedAmounts[p.id];
        if (edited !== undefined && Number(edited) !== Number(p.amount)) {
          return { id: p.id, amount: Number(edited) };
        }
        return null;
      }).filter(Boolean) as { id: number; amount: number }[];

      const adjustmentSummary = payloadEditedPayables.map(ep => {
        const p = payables.find(item => item.id === ep.id);
        return `[ADJUSTED] ${p?.coa_name || "Item"}: ${formatCurrency(Number(p?.amount))} -> ${formatCurrency(ep.amount)}`;
      }).join(" | ");

      const finalRemarks = adjustmentSummary 
        ? `${adjustmentSummary}${remarks.trim() ? " | User Remarks: " + remarks.trim() : ""}` 
        : remarks.trim();

      const result = await api.submitVote({
        draft_id: draft.id,
        status: confirmAction,
        remarks: finalRemarks || undefined,
        edited_payables: payloadEditedPayables.length > 0 ? payloadEditedPayables : undefined,
      });

      if (result.result === "APPROVED") {
        toast.success(`Draft fully approved! Posted as ${result.doc_no ?? "live disbursement"}.`, {
          description: result.message,
        });
      } else if (result.result === "TIER_ADVANCED") {
        toast.success(`Level ${currentTier} complete! Advanced to Level ${result.next_tier}.`, {
          description: result.message,
        });
      } else if (result.result === "VOTE_RECORDED") {
        toast.info("Your approval has been recorded.", { description: result.message });
      } else if (result.result === "REJECTED") {
        toast.error("Draft has been rejected.", { description: result.message });
      }

      onVoteComplete();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Vote submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[1250px] w-[98vw] max-h-[92vh] flex flex-col gap-0 p-0 overflow-hidden border-none shadow-2xl rounded-xl">
        <DialogTitle className="sr-only">Verification & Approval - {draft.doc_no}</DialogTitle>
        <DialogDescription className="sr-only">Review details and vote on the treasury disbursement draft for {draft.payee_name}.</DialogDescription>
        {/* Header */}
        {/* Performance & Minimalist Header */}
        <div className="px-8 py-5 bg-background border-b relative overflow-hidden shrink-0">
          <div className="flex items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <h2 className="text-xl font-black tracking-tight text-foreground/90">Verification & Approval</h2>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest pl-5">
                <span className="font-mono text-primary/80">#{draft.doc_no}</span>
                <span className="opacity-20 text-[10px]">•</span>
                <span>{draft.payee_name}</span>
                <span className="opacity-20 text-[10px]">•</span>
                <span>{formatDate(draft.transaction_date)}</span>
              </div>
            </div>

            {/* Middle: Process Hub */}
            <div className="flex-1 hidden lg:flex items-center justify-center border-x border-muted/50 px-8 mx-4">
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2 bg-primary/5 border border-primary/10 px-3 py-1 rounded-full">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Level {currentTier} Verification</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold text-muted-foreground/40 uppercase tracking-tighter">Awaiting Action From:</span>
                  <span className="text-[10px] font-black text-foreground/70">
                    {(approvers_by_level[currentTier] || [])
                      .filter(a => !a.vote)
                      .map(a => a.name)
                      .join(", ") || "Nobody"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-0.5">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 leading-none mb-0.5 text-right w-full">Current Total</p>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black tabular-nums tracking-tighter text-primary">
                  {formatCurrency(currentTotalAmount)}
                </span>
                {(currentTotalAmount !== Number(draft.total_amount) || isAnyItemModified) && (
                  <Badge variant="secondary" className="h-5 px-1.5 bg-amber-500/10 text-amber-600 border-none uppercase font-black text-[9px] tracking-tighter align-top">MODIFIED</Badge>
                )}
              </div>
            </div>
          </div>
          
          {/* Subtle accent line */}
          <div className="absolute bottom-0 left-0 h-[3px] w-full bg-gradient-to-r from-primary/5 via-primary/40 to-primary/5 opacity-50" />
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-6 text-muted-foreground animate-pulse">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <span className="font-bold text-lg tracking-tight">Syncing draft details…</span>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-muted/5">

            {/* Remarks Section (Enhanced Highlight) */}
            {draft.remarks && (
              <div className="px-8 py-2.5 bg-primary/[0.03] border-b flex items-center gap-4">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.25em] text-primary/40 shrink-0">
                  <AlertCircle size={10} />
                  <span>Draft Remarks</span>
                </div>
                <div className="h-3 w-[1px] bg-primary/20 shrink-0" />
                <p className="text-[10px] font-black uppercase tracking-widest text-foreground/70 leading-relaxed">
                  {draft.remarks}
                </p>
              </div>
            )}

            {/* Scrollable Body */}
            <div className="flex-1 flex flex-col lg:flex-row gap-0 min-h-0">

              {/* Left Column: Payable Table (Full Height) */}
              <div className="flex-[3] flex flex-col min-w-0 min-h-0 bg-background relative border-r overflow-hidden shadow-sm">
                <div className="px-6 py-3 bg-muted/10 border-b flex items-center justify-between sticky top-0 z-10 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-primary font-black uppercase tracking-[0.2em] text-[10px]">
                    <FileText size={14} className="opacity-70" />
                    Payables Breakdown
                    <Badge variant="secondary" className="ml-2 h-4 px-1.5 bg-primary/10 text-primary border-none pointer-events-none">
                      {payables.length} Items
                    </Badge>
                  </div>
                  <Button
                    variant="ghost" 
                    size="icon"
                    className="h-8 w-8 hover:bg-primary/10 text-muted-foreground"
                    onClick={() => setShowTiers(!showTiers)}
                  >
                    {showTiers ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-muted-foreground/20 hover:scrollbar-thumb-muted-foreground/40">
                  <div className="p-4 pt-0">
                    <table className="w-full text-left border-collapse table-fixed">
                      <colgroup>
                        <col className="w-10" />
                        <col className="w-[35%]" />
                        <col className="w-[15%]" />
                        <col className="w-[10%]" />
                        <col className="w-[8%]" />
                        <col className="w-[22%]" />
                      </colgroup>
                      <thead className="sticky top-0 bg-background/95 backdrop-blur-md z-10">
                        <tr className="border-b bg-muted/20">
                          <th className="py-2.5 px-3 text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">#</th>
                          <th className="py-2.5 px-3 text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Account / COA</th>
                          <th className="py-2.5 px-3 text-right text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Amount</th>
                          <th className="py-2.5 px-3 text-center text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Trans Date</th>
                          <th className="py-2.5 px-3 text-center text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Docs</th>
                          <th className="py-2.5 px-3 text-left text-[9px] font-black uppercase tracking-wider text-muted-foreground/60">Audit Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y border-b">
                        {payables.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-20 text-muted-foreground">
                              <div className="flex flex-col items-center gap-3 opacity-40">
                                <FileText size={48} />
                                <p className="text-sm font-bold uppercase tracking-widest">No payable items found.</p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          payables.map((p, idx) => {
                            const originalAmount = detail.expense_logs?.find(l => l.expense_id === p.id && l.action === "Edited")?.amount || p.amount;
                            const isEdited = Number(editedAmounts[p.id] || p.amount) !== Number(originalAmount);

                            return (
                              <tr key={p.id} className="group hover:bg-muted/30 transition-colors">
                                <td className="py-2.5 px-3 text-[10px] text-muted-foreground/40 font-mono font-bold">{idx + 1}</td>
                                <td className="py-2.5 px-3">
                                  <div className="flex flex-col gap-0">
                                    <span className="text-xs font-black text-foreground group-hover:text-primary transition-colors truncate" title={p.coa_name}>{p.coa_name || "Uncategorized"}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] text-muted-foreground/60 font-mono uppercase tracking-tighter">#{p.coa_id}</span>
                                      {p.reference_no && <Badge variant="outline" className="h-3.5 px-1 text-[7px] text-muted-foreground tracking-tighter font-mono rounded-sm opacity-60">REF: {p.reference_no}</Badge>}
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3">
                                  {can_vote && !my_vote ? (
                                    <div className="flex flex-col items-end gap-0.5">
                                      <input
                                        type="number"
                                        step="1"
                                        className={`w-full max-w-[110px] text-right bg-background border-2 border-black/10 border-b-primary px-2 py-1.5 text-[13px] font-black tabular-nums transition-all outline-none hover:border-black/20 focus:ring-1 focus:ring-primary/20
                                          ${isEdited ? "text-primary shadow-sm" : "text-foreground shadow-inner"}`}
                                        value={editedAmounts[p.id] !== undefined ? editedAmounts[p.id] : p.amount}
                                        onChange={(e) => setEditedAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                                      />
                                      {isEdited && (
                                        <span className="text-[8px] font-black text-primary uppercase tracking-tighter italic animate-in fade-in slide-in-from-right-1 opacity-70">
                                          {formatCurrency(Number(originalAmount))}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-end">
                                      <span className="text-[13px] font-black text-foreground tabular-nums tracking-tight">
                                        {formatCurrency(Number(p.amount))}
                                      </span>
                                      {Number(p.amount) !== Number(originalAmount) && (
                                        <span className="text-[8px] line-through text-muted-foreground/30 tabular-nums">
                                          {formatCurrency(Number(originalAmount))}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="text-[10px] font-bold text-muted-foreground/80 bg-muted/30 px-2 py-0.5 rounded-md whitespace-nowrap">
                                    {p.date ? formatDate(p.date) : "—"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {p.attachment_url ? (
                                    <TooltipProvider delayDuration={0}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPreviewUrl(`/api/fm/expense-assets?id=${p.attachment_url}`);
                                            }}
                                            className="inline-flex items-center justify-center h-7 w-7 rounded-lg bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all shadow-sm border border-primary/10"
                                          >
                                            <ExternalLink size={12} />
                                          </button>
                                        </TooltipTrigger>
                                        <TooltipContent side="top">View Attachment</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  ) : (
                                    <span className="text-[8px] font-bold text-muted-foreground/20 italic tracking-widest">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <TooltipProvider>
                                    <Tooltip delayDuration={0}>
                                      <TooltipTrigger asChild>
                                        <div className="text-[11px] text-muted-foreground font-medium italic line-clamp-2 max-w-[200px] leading-relaxed group-hover:text-foreground/80 transition-colors">
                                          {p.remarks || <span className="opacity-30">—</span>}
                                        </div>
                                      </TooltipTrigger>
                                      {p.remarks && (
                                        <TooltipContent side="top" className="max-w-xs p-3">
                                          <p className="text-[11px] font-semibold leading-relaxed">{p.remarks}</p>
                                        </TooltipContent>
                                      )}
                                    </Tooltip>
                                  </TooltipProvider>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Sidebar: Tabbed Interface */}
              {showTiers && (
                <div className="flex-[1.5] min-w-[320px] max-w-[400px] flex flex-col min-h-0 bg-muted/10 relative border-l animate-in slide-in-from-right-2 duration-300 overflow-hidden">
                  <div className="h-12 flex items-center px-6 border-b bg-background shrink-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/80 flex items-center gap-2">
                       <History size={14} /> Audit Trail & History
                    </p>
                  </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin">
                      {/* Timeline Generator */}
                      {(() => {
                        const timeline: { date: string; node: React.ReactNode }[] = [];

                        // 1. Add Tiers (Votes)
                        Array.from({ length: maxLevel }, (_, i) => i + 1).forEach(level => {
                          const approvers = approvers_by_level[level] ?? [];
                          approvers.forEach(a => {
                            if (a.vote) {
                              timeline.push({
                                date: a.vote.created_at,
                                node: (
                                  <div key={`vote-${a.approver_id}`} className="relative pl-6 border-l border-emerald-500/20 pb-2">
                                    <div className="absolute -left-[4.5px] top-1 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center justify-between">
                                        <p className="text-[10px] font-black text-emerald-700/80 uppercase tracking-tighter">Level {level} Verified</p>
                                        <p className="text-[8px] font-bold text-muted-foreground/40">{formatDateTime(a.vote.created_at)}</p>
                                      </div>
                                      <p className="text-xs font-black text-foreground/90 leading-none">{a.name}</p>
                                      {a.vote.remarks && <p className="text-[10px] font-medium italic text-muted-foreground/60">&ldquo;{a.vote.remarks}&rdquo;</p>}
                                    </div>
                                  </div>
                                )
                              });
                            }
                          });
                        });

                        // 2. Add Amount Variances
                        detail.logs?.forEach(log => {
                          const variance = log.new_total - log.old_total;
                          timeline.push({
                            date: log.created_at,
                            node: (
                              <div key={`log-${log.id}`} className="relative pl-6 border-l border-primary/20 pb-2">
                                <div className="absolute -left-[4.5px] top-1 h-2 w-2 rounded-full bg-primary" />
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black text-primary/70 uppercase tracking-tighter">Budget Correction</p>
                                    <p className="text-[8px] font-bold text-muted-foreground/40">{formatDateTime(log.created_at)}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-foreground/90">{log.editor_name}</span>
                                    <span className={`text-[10px] font-black tabular-nums ${variance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                                      ({variance > 0 ? '+' : ''}{formatCurrency(variance)})
                                    </span>
                                  </div>
                                  <p className="text-[10px] font-medium italic text-muted-foreground/60 bg-muted/30 p-1.5 rounded-md mt-1">&ldquo;{log.edit_reason}&rdquo;</p>
                                </div>
                              </div>
                            )
                          });
                        });

                        // 3. Add Item Revisions
                        detail.expense_logs?.forEach(log => {
                          timeline.push({
                            date: log.changed_at,
                            node: (
                              <div key={`item-${log.id}`} className="relative pl-6 border-l border-primary/20 pb-2">
                                <div className="absolute -left-[4.5px] top-1 h-2 w-2 rounded-full bg-primary" />
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center justify-between">
                                    <p className="text-[10px] font-black text-primary/60 uppercase tracking-tighter">Item Revised</p>
                                    <p className="text-[8px] font-bold text-muted-foreground/40">{formatDateTime(log.changed_at)}</p>
                                  </div>
                                  <p className="text-[10px] font-black text-foreground/80 leading-none">{log.particulars}</p>
                                  {log.remarks && (
                                    <p className="text-[9px] font-medium italic text-muted-foreground/60 leading-snug">&ldquo;{log.remarks}&rdquo;</p>
                                  )}
                                  <div className="flex items-baseline gap-2 pt-0.5">
                                    <span className="text-[10px] font-black text-primary">{formatCurrency(log.amount)}</span>
                                    <span className="text-[8px] font-bold text-muted-foreground/40 italic">by {log.editor_name || "Approver"}</span>
                                  </div>
                                </div>
                              </div>
                            )
                          });
                        });

                        // Sort and render
                        const sorted = timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        
                        if (sorted.length === 0) {
                          return (
                            <div className="flex flex-col items-center justify-center py-20 opacity-20 gap-4">
                              <ShieldCheck size={40} />
                              <p className="text-[10px] font-black uppercase tracking-widest">No history recorded yet</p>
                            </div>
                          );
                        }

                        return sorted.map(item => item.node);
                      })()}

                    </div>
                  </div>
                )}
              </div>

            {/* Footer / Vote Area */}
            <div className="px-6 py-4 bg-background border-t shadow-[0_-12px_32px_-12px_rgba(0,0,0,0.12)] shrink-0 relative z-30">
              {/* Already voted */}
              {my_vote && (
                <div className={`flex items-center gap-3 p-3 rounded-xl mb-3 border-2 font-bold text-xs shadow-sm
                  ${my_vote.status === "APPROVED"
                    ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                    : "bg-red-50 border-red-100 text-red-800"}`}>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center
                    ${my_vote.status === "APPROVED" ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
                    <VoteStatusIcon status={my_vote.status} />
                  </div>
                  <div className="flex-1">
                    <p>You have already cast your vote: <span className="uppercase tracking-widest ml-1">{my_vote.status}</span></p>
                    {my_vote.remarks && <p className="text-xs font-medium italic mt-0.5 opacity-70">&ldquo;{my_vote.remarks}&rdquo;</p>}
                  </div>
                </div>
              )}

              {/* Not yet at active tier */}
              {!can_vote && !my_vote && (
                <div className="flex items-center gap-3 p-3 rounded-xl mb-3 bg-muted/40 border-2 border-muted border-dashed text-xs text-muted-foreground font-bold shadow-inner">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <AlertCircle className="h-4 w-4 opacity-40 text-primary" />
                  </div>
                  <div>
                    <p className="uppercase tracking-wider text-[10px] opacity-60">Status: Locked</p>
                    <p className="text-foreground/60">This draft is at <span className="text-primary">Level {currentTier}</span>. You can vote at Level {my_level}.</p>
                  </div>
                </div>
              )}

              {/* Voting controls */}
              {can_vote && !my_vote && (
                <div className="space-y-3 max-w-4xl mx-auto">
                  {/* Action picker */}
                  {!confirmAction ? (
                    <div className="flex items-center gap-2">
                      <Button
                        className="flex-[3] h-10 rounded-lg font-black text-xs gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.01] border-b-2 border-emerald-800"
                        onClick={() => setConfirmAction("APPROVED")}
                        disabled={submitting}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        APPROVE DRAFT
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-[2] h-10 rounded-lg font-black text-xs gap-2 border-red-200 text-red-600 hover:bg-red-50 transition-all hover:border-red-300"
                        onClick={() => setConfirmAction("REJECTED")}
                        disabled={submitting}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        REJECT
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 animate-in fade-in zoom-in-95 duration-300">
                      <div className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest
                        ${confirmAction === "APPROVED"
                          ? "bg-emerald-600 text-white shadow-md"
                          : "bg-red-600 text-white shadow-md"}`}>
                        {confirmAction === "APPROVED"
                          ? <CheckCircle2 className="h-4 w-4" />
                          : <XCircle className="h-4 w-4" />}
                        Confirming: {confirmAction}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-6 w-6 hover:bg-white/20 text-white"
                          onClick={() => { setConfirmAction(null); setRemarks(""); }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center justify-between px-1">
                          <span>
                            {confirmAction === "REJECTED" ? (
                              <>Reasons for Rejection <span className="text-red-600 ml-1 opacity-100">*</span></>
                            ) : "Supplementary Remarks (optional)"}
                          </span>
                        </label>
                        <Textarea
                          value={remarks}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setRemarks(e.target.value)}
                          placeholder={
                            confirmAction === "REJECTED"
                              ? "Please specify why you are rejecting this draft..."
                              : "Any notes for the next approver or encoder..."
                          }
                          className="min-h-[80px] max-h-[100px] rounded-xl border-2 focus:border-primary transition-all font-bold text-sm p-3 shadow-sm"
                          disabled={submitting}
                        />
                        {confirmAction === "REJECTED" && remarks.trim().length > 0 && remarks.trim().length < 10 && (
                          <p className="text-[11px] text-red-600 font-black animate-in slide-in-from-left-2 px-1">
                            {10 - remarks.trim().length} more character{10 - remarks.trim().length !== 1 ? "s" : ""} needed to confirm rejection.
                          </p>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          className={`flex-1 h-11 rounded-xl font-black text-sm gap-2 shadow-lg transition-all border-b-2
                            ${confirmAction === "APPROVED"
                              ? "bg-emerald-700 hover:bg-emerald-800 text-white border-emerald-900"
                              : "bg-red-700 hover:bg-red-800 text-white border-red-900"}`}
                          onClick={handleVote}
                          disabled={
                            submitting ||
                            (confirmAction === "REJECTED" && !isRejectionSubmittable) ||
                            (confirmAction === "APPROVED" && !isApprovalSubmittable)
                          }
                        >
                          {submitting ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                          {submitting
                            ? "PROCESSING..."
                            : `CONFIRM ${confirmAction === "APPROVED" ? "APPROVAL" : "REJECTION"}`}
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-6 h-11 rounded-xl font-bold text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => { setConfirmAction(null); setRemarks(""); }}
                          disabled={submitting}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Close if read-only */}
              {(!can_vote || my_vote) && (
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-xl mt-2 font-bold uppercase tracking-widest text-xs border-muted text-muted-foreground hover:bg-muted/10 transition-all"
                  onClick={onClose}
                >
                  <X className="h-4 w-4 mr-2" />
                  Dismiss Modal
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>

      {/* Attachment Preview Modal (Full Screen) */}
      <Dialog open={!!previewUrl} onOpenChange={(v) => !v && setPreviewUrl(null)}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[90vw] max-h-[85vh] w-fit p-0 overflow-hidden bg-black border-none shadow-2xl flex flex-col items-center justify-center rounded-lg"
        >
          <DialogTitle className="sr-only">Attachment Preview</DialogTitle>
          <DialogDescription className="sr-only">Full-screen view of the encoded attachment document.</DialogDescription>
          
          <Button
            variant="default"
            size="icon"
            className="absolute top-4 right-4 rounded-full bg-white text-black hover:bg-white/90 shadow-2xl transition-all active:scale-95 border-none h-10 w-10 flex items-center justify-center z-50 shadow-black/20"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="h-6 w-6 stroke-[2.5]" />
          </Button>

          <div className="relative group flex items-center justify-center">
            {previewUrl && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={previewUrl}
                alt="Attachment Preview"
                className="max-w-[90vw] max-h-[85vh] w-auto h-auto object-contain shadow-2xl transition-all duration-300"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
