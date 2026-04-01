// src/modules/financial-management/treasury/bulk-approval/components/VoteModal.tsx
"use client";

import * as React from "react";
import {
  Loader2, AlertCircle, FileText, User, DollarSign,
  CheckCircle2, XCircle, Clock, ShieldCheck, ChevronRight,
  X, PanelRightOpen, PanelRightClose, History, ArrowRight, TrendingDown, TrendingUp
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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

function formatDateTime(d: string) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return d; }
}

function VoteStatusIcon({ status }: { status: string }) {
  if (status === "APPROVED") return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "REJECTED") return <XCircle className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-amber-500" />;
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

      const result = await api.submitVote({
        draft_id: draft.id,
        status: confirmAction,
        remarks: remarks.trim() || undefined,
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
      <DialogContent className="sm:max-w-[1100px] w-[95vw] max-h-[80vh] flex flex-col gap-0 p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        {/* Header */}
        <DialogHeader className="px-6 py-4 bg-gradient-to-br from-primary to-primary/95 text-primary-foreground shrink-0 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 p-8 opacity-10 pointer-events-none rotate-12">
            <ShieldCheck size={180} />
          </div>
          <div className="relative z-10 flex flex-col gap-0.5">
            <DialogTitle className="text-lg font-black flex items-center gap-2.5 tracking-tight">
              <div className="h-7 w-7 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner">
                <ShieldCheck className="h-4 w-4" />
              </div>
              Disbursement Draft — Vote
            </DialogTitle>
            <p className="text-primary-foreground/70 text-[11px] font-medium pl-10 max-w-xl leading-tight opacity-90">
              Review draft details and cast your vote. All levels must clear for final posting.
            </p>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-6 text-muted-foreground animate-pulse">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <span className="font-bold text-lg tracking-tight">Syncing draft details…</span>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-muted/5">

            {/* Draft Info Bar */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-6 py-3 bg-background border-b shadow-sm relative z-20">
              <div className="space-y-0.5">
                <p className="text-[8px] font-black uppercase text-primary/40 tracking-[0.1em] flex items-center gap-1.5">
                  <FileText size={10} /> Doc Number
                </p>
                <p className="font-bold text-[13px] text-primary font-mono tracking-tight">{draft.doc_no}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black uppercase text-primary/40 tracking-[0.1em] flex items-center gap-1.5">
                  <User size={10} /> Payee
                </p>
                <p className="font-bold text-[13px] leading-tight text-foreground/90">{draft.payee_name}</p>
                <p className="text-[8px] text-muted-foreground font-semibold italic opacity-60">Encoded: {draft.encoder_name}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black uppercase text-primary/40 tracking-[0.1em] flex items-center gap-1.5">
                  <DollarSign size={10} /> Amount
                </p>
                <p className="font-black text-base text-primary tabular-nums tracking-tighter">
                  {formatCurrency(currentTotalAmount)}
                  {currentTotalAmount !== Number(draft.total_amount) && (
                    <span className="text-[10px] text-amber-500 ml-2 animate-pulse">(Modified)</span>
                  )}
                </p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[8px] font-black uppercase text-primary/40 tracking-[0.1em]">Date</p>
                <p className="font-bold text-[13px] text-foreground/90">{formatDate(draft.transaction_date)}</p>
              </div>
            </div>

            {draft.remarks && (
              <div className="px-10 py-3 bg-primary/[0.02] border-b text-[13px] italic text-muted-foreground font-medium flex items-center gap-3">
                <div className="h-1 w-8 bg-primary/20 rounded-full" />
                &ldquo;{draft.remarks}&rdquo;
              </div>
            )}

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row gap-0 min-h-0">

              {/* Left: Payables */}
              <div className="flex-[3] flex flex-col border-r bg-background relative transition-all duration-300">
                
                {/* Revision History & Amount Variance */}
                {detail.logs && detail.logs.length > 0 && (
                  <div className="px-6 py-4 border-b bg-muted/[0.03]">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70 mb-3 flex items-center gap-2">
                      <History size={14} /> Amount Variance & Revision Flow
                    </h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                      {detail.logs.map((log) => {
                        const variance = log.new_total - log.old_total;
                        const isIncrease = variance > 0;
                        const isDecrease = variance < 0;
                        return (
                          <div key={log.id} className="min-w-[240px] max-w-[300px] border bg-card rounded-xl shadow-sm hover:shadow-md transition-shadow p-3.5 shrink-0 flex flex-col gap-2.5 relative overflow-hidden group">
                            {/* Decorative Background Icon */}
                            <div className="absolute -right-3 -top-3 opacity-[0.03] rotate-12 group-hover:scale-110 transition-transform duration-500">
                              <History size={80} />
                            </div>

                            <div className="relative z-10 flex justify-between items-start gap-4 mb-0.5">
                              <div className="flex flex-col min-w-0">
                                <span className="text-[9px] uppercase font-black tracking-widest text-primary/60 flex items-center gap-1.5 truncate">
                                  <User size={10} className="shrink-0" /> {log.editor_name || "System Actor"}
                                </span>
                                <span className="text-[9px] font-bold text-muted-foreground/60 mt-0.5">
                                  {formatDateTime(log.created_at)}
                                </span>
                              </div>
                              <div className={`shrink-0 flex items-center gap-1 text-[8px] uppercase font-black tracking-widest px-1.5 py-0.5 rounded-md border
                                ${isIncrease ? 'bg-rose-50 border-rose-200 text-rose-700' : 
                                  isDecrease ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 
                                  'bg-muted border-muted-foreground/20 text-muted-foreground'}`
                              }>
                                {isIncrease ? <TrendingUp size={10} /> : isDecrease ? <TrendingDown size={10} /> : <ArrowRight size={10} />}
                                {isIncrease ? 'Up' : isDecrease ? 'Down' : 'Same'}
                              </div>
                            </div>

                            <p className="relative z-10 text-[11px] font-bold italic text-foreground/75 leading-tight line-clamp-2 pl-2.5 before:absolute before:left-0 before:top-0.5 before:bottom-0.5 before:w-0.5 before:bg-primary/20 before:rounded-full">
                              "{log.edit_reason}"
                            </p>

                            <div className="relative z-10 mt-auto pt-3 border-t flex flex-col gap-1.5">
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">Variance</span>
                                <span className={`text-[13px] font-black tabular-nums tracking-tighter
                                  ${isIncrease ? 'text-rose-600' : isDecrease ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                  {isIncrease ? '+' : ''}{formatCurrency(variance)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Itemized Expense Revisions */}
                {detail.expense_logs && detail.expense_logs.length > 0 && (
                  <div className="px-6 py-4 border-b bg-muted/[0.01]">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600/80 mb-3 flex items-center gap-2">
                      <FileText size={14} /> Itemized Expense Revisions
                    </h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 custom-scrollbar">
                      {detail.expense_logs.map((log) => (
                        <div key={log.id} className="min-w-[210px] max-w-[250px] border border-amber-100 bg-amber-50/10 rounded-xl p-3 shrink-0 flex flex-col gap-1.5 shadow-sm">
                          <div className="flex justify-between items-start">
                            <div className="flex flex-col">
                              <span className="text-[8px] font-black text-amber-700/60 uppercase tracking-widest truncate max-w-[120px]">{log.editor_name}</span>
                              <span className="text-[8px] text-muted-foreground/60 font-bold">{formatDateTime(log.changed_at)}</span>
                            </div>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border border-amber-200 text-amber-700 bg-amber-50 uppercase tracking-tighter`}>
                              {log.action}
                            </span>
                          </div>
                          
                          <div className="mt-0.5">
                            <p className="text-[10px] font-black text-foreground/70 line-clamp-1">Item: {log.particulars}</p>
                            <p className="text-[13px] font-black text-primary mt-0.5">{formatCurrency(log.amount)}</p>
                          </div>

                          {log.remarks && (
                            <p className="text-[9px] font-medium italic text-muted-foreground line-clamp-1 mt-0.5 border-l-2 border-amber-200 pl-1.5">
                              "{log.remarks}"
                            </p>
                          )}
                          
                          <div className="mt-auto pt-1.5 flex items-center justify-between opacity-60">
                            <span className="text-[8px] font-bold uppercase tracking-widest">Status: {log.status}</span>
                            <span className="text-[8px] font-mono font-bold">EXP#{log.expense_id}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="px-8 py-4 border-b bg-muted/5 shrink-0 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/60 flex items-center gap-2">
                    <FileText size={16} className="text-primary/70" /> Payable Line Items
                  </h3>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 transition-colors ${showTiers ? "text-muted-foreground" : "text-primary bg-primary/10"}`}
                          onClick={() => setShowTiers(!showTiers)}
                        >
                          {showTiers ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="text-[10px] font-bold uppercase tracking-widest">{showTiers ? "Hide Approval Tiers" : "Show Approval Tiers"}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="flex-1 px-4 py-2">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b bg-muted/20">
                        <th className="py-3 px-2 text-[10px] font-black uppercase tracking-wider">#</th>
                        <th className="py-3 px-2 text-[10px] font-black uppercase tracking-wider">Account (COA)</th>
                        <th className="py-3 px-2 text-right text-[10px] font-black uppercase tracking-wider">Amount</th>
                        <th className="py-3 px-2 text-center text-[10px] font-black uppercase tracking-wider">Date</th>
                        <th className="py-3 px-2 text-left text-[10px] font-black uppercase tracking-wider">Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
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
                        payables.map((p, idx) => (
                          <tr key={p.id} className="border-b hover:bg-muted/10 transition-colors">
                            <td className="py-3 px-2 text-[11px] text-muted-foreground/60 font-mono font-bold w-10">{idx + 1}</td>
                            <td className="py-3 px-2">
                              <p className="text-xs font-black leading-tight text-foreground">{p.coa_name || "Unknown COA"}</p>
                              <p className="text-[9px] text-muted-foreground/70 font-mono mt-0.5">#{p.coa_id}</p>
                            </td>
                            <td className="py-1.5 px-2 text-right font-black tabular-nums text-[13px] text-primary">
                              {can_vote && !my_vote ? (
                                <div className="flex justify-end">
                                  <input
                                    type="number"
                                    step="0.01"
                                    className="w-28 text-right bg-background border rounded-md px-2 py-1 text-sm font-black tabular-nums focus:ring-2 focus:ring-primary focus:outline-none transition-all shadow-sm"
                                    value={editedAmounts[p.id] !== undefined ? editedAmounts[p.id] : p.amount}
                                    onChange={(e) => setEditedAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                                  />
                                </div>
                              ) : (
                                p.amount ? formatCurrency(Number(p.amount)) : "0.00"
                              )}
                            </td>
                            <td className="py-3 px-2 text-center text-[11px] text-muted-foreground font-semibold px-4">
                              {p.date ? formatDate(p.date) : "—"}
                            </td>
                            <td className="py-3 px-2 text-[11px] italic text-muted-foreground/80 max-w-[150px] truncate font-medium">
                              {p.remarks || "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Right: Approvers by Level */}
                {showTiers && (
                  <div className="flex-[1.5] min-w-[260px] max-w-[300px] flex flex-col p-4 space-y-3 bg-muted/[0.03] relative border-l lg:border-l-0 animate-in slide-in-from-right-2 duration-300">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.02),transparent)] pointer-events-none" />
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 shrink-0 relative z-10 flex items-center gap-2 sticky top-0 bg-background/95 backdrop-blur-md -mx-4 px-4 py-3 border-b mb-1 shadow-sm">
                    <ShieldCheck size={14} className="text-primary/70" /> Tiers
                  </h3>
                  
                  <div className="space-y-3 relative z-10 flex-1">
                    {Array.from({ length: maxLevel }, (_, i) => i + 1).map(level => {
                      const approvers = approvers_by_level[level] ?? [];
                      const isActive = level === currentTier;
                      const isDone = level < currentTier;
                      const isLocked = level > currentTier;
 
                      return (
                        <div
                          key={level}
                          className={`relative rounded-lg border p-3 space-y-2 transition-all duration-300 group/tier shadow-sm
                            ${isActive ? "border-primary/30 bg-primary/[0.03] ring-1 ring-primary/10 shadow-md z-10" :
                              isDone ? "border-emerald-200 bg-emerald-50/40 opacity-80" :
                              "border-muted bg-muted/5 opacity-50 hover:opacity-100"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-full border shadow-sm
                              ${isActive ? "text-primary border-primary/10 bg-background" :
                                isDone ? "text-emerald-700 border-emerald-100 bg-emerald-50" :
                                "text-muted-foreground border-muted-foreground/10 bg-muted"}`}>
                              Lvl {level} {isActive ? "• Active" : isDone ? "• Done" : "• Wait"}
                            </span>
                            {isDone && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                            {isActive && <span className="h-1.5 w-1.5 bg-primary rounded-full animate-ping" />}
                          </div>
 
                          <div className="space-y-1.5">
                            {approvers.map(a => (
                              <div key={a.approver_id} className="flex items-center justify-between gap-2 py-0.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={`h-6 w-6 shrink-0 rounded-md flex items-center justify-center text-[9px] font-black shadow-inner border transition-all duration-300
                                    ${a.vote?.status === "APPROVED" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                      a.vote?.status === "REJECTED" ? "bg-red-100 text-red-700 border-red-200" :
                                      "bg-background text-muted-foreground border-muted-foreground/20 group-hover/tier:border-primary/30"}`}>
                                    {a.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-black truncate text-foreground/85 leading-tight">{a.name}</p>
                                    {a.vote && (
                                      <p className="text-[8px] text-muted-foreground font-bold opacity-60 tracking-tight leading-none mt-0.5">{formatDateTime(a.vote.created_at)}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="shrink-0 scale-[0.85] origin-right">
                                  {a.vote ? (
                                    <div className="flex items-center gap-1 bg-background px-1.5 py-1 rounded-md shadow-sm border border-muted-foreground/10">
                                      <VoteStatusIcon status={a.vote.status} />
                                      <span className={`text-[8px] font-black uppercase tracking-tight
                                        ${a.vote.status === "APPROVED" ? "text-emerald-600" : "text-red-600"}`}>
                                        {a.vote.status}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[8px] text-muted-foreground/50 italic font-bold uppercase tracking-tighter opacity-50 px-1">
                                      {isLocked ? "Queue" : "Invited"}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
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
                          onChange={(e) => setRemarks(e.target.value)}
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
    </Dialog>
  );
}
