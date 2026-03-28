// src/modules/financial-management/treasury/bulk-approval/components/VoteModal.tsx
"use client";

import * as React from "react";
import {
  Loader2, AlertCircle, FileText, User, DollarSign,
  CheckCircle2, XCircle, Clock, ShieldCheck, ChevronRight,
  X, PanelRightOpen, PanelRightClose,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  React.useEffect(() => {
    if (open) {
      setRemarks("");
      setConfirmAction(null);
    }
  }, [open, detail]);

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
      const result = await api.submitVote({
        draft_id: draft.id,
        status: confirmAction,
        remarks: remarks.trim() || undefined,
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
      <DialogContent className="sm:max-w-[1200px] w-[95vw] max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden border-none shadow-2xl rounded-3xl">
        {/* Header */}
        <DialogHeader className="px-8 py-5 bg-gradient-to-br from-primary to-primary/95 text-primary-foreground shrink-0 relative overflow-hidden">
          <div className="absolute -top-4 -right-4 p-8 opacity-10 pointer-events-none rotate-12">
            <ShieldCheck size={180} />
          </div>
          <div className="relative z-10 flex flex-col gap-0.5">
            <DialogTitle className="text-xl font-black flex items-center gap-3 tracking-tight">
              <div className="h-9 w-9 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-md border border-white/10 shadow-inner">
                <ShieldCheck className="h-5 w-5" />
              </div>
              Disbursement Draft — Vote
            </DialogTitle>
            <p className="text-primary-foreground/70 text-xs font-medium pl-[48px] max-w-xl leading-tight opacity-90">
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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 px-8 py-4 bg-background border-b shadow-sm relative z-20">
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase text-primary/40 tracking-[0.1em] flex items-center gap-1.5">
                  <FileText size={12} /> Doc Number
                </p>
                <p className="font-bold text-sm text-primary font-mono tracking-tight">{draft.doc_no}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase text-primary/40 tracking-[0.1em] flex items-center gap-1.5">
                  <User size={12} /> Payee
                </p>
                <p className="font-bold text-sm leading-tight text-foreground/90">{draft.payee_name}</p>
                <p className="text-[9px] text-muted-foreground font-semibold italic opacity-60">Encoded by: {draft.encoder_name}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase text-primary/40 tracking-[0.1em] flex items-center gap-1.5">
                  <DollarSign size={12} /> Total Amount
                </p>
                <p className="font-black text-lg text-primary tabular-nums tracking-tighter">{formatCurrency(Number(draft.total_amount))}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] font-black uppercase text-primary/40 tracking-[0.1em]">Transaction Date</p>
                <p className="font-bold text-sm text-foreground/90">{formatDate(draft.transaction_date)}</p>
              </div>
            </div>

            {draft.remarks && (
              <div className="px-10 py-3 bg-primary/[0.02] border-b text-[13px] italic text-muted-foreground font-medium flex items-center gap-3">
                <div className="h-1 w-8 bg-primary/20 rounded-full" />
                &ldquo;{draft.remarks}&rdquo;
              </div>
            )}

            {/* Scrollable Body */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-0 min-h-0">

              {/* Left: Payables */}
              <div className="flex-[3] flex flex-col min-h-0 border-r bg-background relative transition-all duration-300">
                <div className="px-8 py-5 border-b bg-muted/5 shrink-0 flex items-center justify-between">
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
                <div className="flex-1 overflow-auto px-4 py-2">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background/95 backdrop-blur-md z-10 shadow-sm border-b">
                      <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="text-[10px] font-black uppercase tracking-wider h-10">#</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-wider h-10">Account (COA)</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-wider h-10">Amount</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase tracking-wider h-10">Date</TableHead>
                        <TableHead className="text-left text-[10px] font-black uppercase tracking-wider h-10">Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payables.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                            <div className="flex flex-col items-center gap-3 opacity-40">
                              <FileText size={48} />
                              <p className="text-sm font-bold uppercase tracking-widest">No payable items found.</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        payables.map((p, idx) => (
                          <TableRow key={p.id} className="group/row hover:bg-muted/30 border-muted/40 transition-colors">
                            <TableCell className="text-xs text-muted-foreground/60 font-mono font-bold w-12">{idx + 1}</TableCell>
                            <TableCell className="py-4">
                              <p className="text-sm font-black leading-tight text-foreground group-hover/row:text-primary transition-colors">{p.coa_name}</p>
                              <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">#{p.coa_id}</p>
                            </TableCell>
                            <TableCell className="text-right font-black tabular-nums text-sm text-primary">
                              {formatCurrency(Number(p.amount))}
                            </TableCell>
                            <TableCell className="text-center text-xs text-muted-foreground font-semibold px-4">{formatDate(p.date)}</TableCell>
                            <TableCell className="text-xs italic text-muted-foreground/80 max-w-[200px] truncate font-medium">
                              {p.remarks || "—"}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Right: Approvers by Level */}
              {showTiers && (
                <div className="flex-[2] min-w-[320px] max-w-[400px] flex flex-col min-h-0 overflow-auto p-6 space-y-4 bg-muted/[0.03] relative border-l lg:border-l-0 animate-in slide-in-from-right-2 duration-300">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(var(--primary),0.02),transparent)] pointer-events-none" />
                  <h3 className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/60 shrink-0 relative z-10 flex items-center gap-2">
                    <ShieldCheck size={16} className="text-primary/70" /> Approval Tiers
                  </h3>
                  
                  <div className="space-y-5 relative z-10 flex-1">
                    {Array.from({ length: maxLevel }, (_, i) => i + 1).map(level => {
                      const approvers = approvers_by_level[level] ?? [];
                      const isActive = level === currentTier;
                      const isDone = level < currentTier;
                      const isLocked = level > currentTier;

                      return (
                        <div
                          key={level}
                          className={`relative rounded-xl border p-4 space-y-3 transition-all duration-300 group/tier shadow-sm
                            ${isActive ? "border-primary/30 bg-primary/[0.03] ring-1 ring-primary/20 shadow-md z-10" :
                              isDone ? "border-emerald-200 bg-emerald-50/40 opacity-90" :
                              "border-muted bg-muted/10 opacity-60 hover:opacity-100"}`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border shadow-sm
                              ${isActive ? "text-primary border-primary/20 bg-background" :
                                isDone ? "text-emerald-700 border-emerald-200 bg-emerald-100/50" :
                                "text-muted-foreground border-muted-foreground/10 bg-muted"}`}>
                              Level {level} {isActive ? "• Active" : isDone ? "• Done" : "• Wait"}
                            </span>
                            {isDone && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                            {isActive && <span className="h-1.5 w-1.5 bg-primary rounded-full animate-ping" />}
                          </div>

                          <div className="space-y-2">
                            {approvers.map(a => (
                              <div key={a.approver_id} className="flex items-center justify-between gap-2.5 py-0.5">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`h-7 w-7 shrink-0 rounded-lg flex items-center justify-center text-[10px] font-black shadow-inner border transition-all duration-300
                                    ${a.vote?.status === "APPROVED" ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
                                      a.vote?.status === "REJECTED" ? "bg-red-100 text-red-700 border-red-200" :
                                      "bg-background text-muted-foreground border-muted-foreground/20 group-hover/tier:border-primary/30"}`}>
                                    {a.name.charAt(0)}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-black truncate text-foreground/80">{a.name}</p>
                                    {a.vote && (
                                      <p className="text-[9px] text-muted-foreground font-bold opacity-70 tracking-tight leading-none">{formatDateTime(a.vote.created_at)}</p>
                                    )}
                                  </div>
                                </div>
                                <div className="shrink-0">
                                  {a.vote ? (
                                    <div className="flex items-center gap-1 bg-background px-1.5 py-1 rounded-lg shadow-sm border border-muted-foreground/10">
                                      <VoteStatusIcon status={a.vote.status} />
                                      <span className={`text-[9px] font-black uppercase tracking-tight
                                        ${a.vote.status === "APPROVED" ? "text-emerald-600" : "text-red-600"}`}>
                                        {a.vote.status}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[9px] text-muted-foreground/50 italic font-bold uppercase tracking-tighter opacity-50 px-1">
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
            <div className="px-10 py-6 bg-background border-t shadow-[0_-12px_32px_-12px_rgba(0,0,0,0.12)] shrink-0 relative z-30">
              {/* Already voted */}
              {my_vote && (
                <div className={`flex items-center gap-4 p-4 rounded-2xl mb-4 border-2 font-bold text-sm shadow-sm
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
                <div className="flex items-center gap-4 p-4 rounded-2xl mb-4 bg-muted/40 border-2 border-muted border-dashed text-sm text-muted-foreground font-bold shadow-inner">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <AlertCircle className="h-5 w-5 opacity-40 text-primary" />
                  </div>
                  <div>
                    <p className="uppercase tracking-wider text-xs opacity-60">Status: Locked</p>
                    <p className="text-foreground/60">This draft is currently at <span className="text-primary">Level {currentTier}</span>. You can vote once it reaches Level {my_level}.</p>
                  </div>
                </div>
              )}

              {/* Voting controls */}
              {can_vote && !my_vote && (
                <div className="space-y-4 max-w-4xl mx-auto">
                  {/* Action picker */}
                  {!confirmAction ? (
                    <div className="flex items-center gap-3">
                      <Button
                        className="flex-[3] h-11 rounded-xl font-black text-sm gap-2 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.01] border-b-2 border-emerald-800"
                        onClick={() => setConfirmAction("APPROVED")}
                        disabled={submitting}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        APPROVE DRAFT
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-[2] h-11 rounded-xl font-black text-sm gap-2 border-red-200 text-red-600 hover:bg-red-50 transition-all hover:border-red-300"
                        onClick={() => setConfirmAction("REJECTED")}
                        disabled={submitting}
                      >
                        <XCircle className="h-4 w-4" />
                        REJECT
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                      <div className={`flex items-center gap-3 px-5 py-3 rounded-xl text-sm font-black uppercase tracking-widest
                        ${confirmAction === "APPROVED"
                          ? "bg-emerald-600 text-white shadow-lg"
                          : "bg-red-600 text-white shadow-lg"}`}>
                        {confirmAction === "APPROVED"
                          ? <CheckCircle2 className="h-5 w-5" />
                          : <XCircle className="h-5 w-5" />}
                        Confirming: {confirmAction}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="ml-auto h-8 w-8 hover:bg-white/20 text-white"
                          onClick={() => { setConfirmAction(null); setRemarks(""); }}
                        >
                          <X className="h-5 w-5" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 flex items-center justify-between px-1">
                          <span>
                            {confirmAction === "REJECTED" ? (
                              <>Reasons for Rejection <span className="text-red-600 ml-1 opacity-100">*</span></>
                            ) : "Supplementary Remarks (optional)"}
                          </span>
                          {confirmAction === "REJECTED" && (
                            <span className="text-[9px] normal-case opacity-60">Minimum 10 characters required</span>
                          )}
                        </label>
                        <Textarea
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          placeholder={
                            confirmAction === "REJECTED"
                              ? "Please specify why you are rejecting this draft..."
                              : "Any notes for the next approver or encoder..."
                          }
                          className="min-h-[100px] max-h-[120px] rounded-2xl border-2 focus:border-primary transition-all font-bold text-base p-4 shadow-sm"
                          disabled={submitting}
                        />
                        {confirmAction === "REJECTED" && remarks.trim().length > 0 && remarks.trim().length < 10 && (
                          <p className="text-[11px] text-red-600 font-black animate-in slide-in-from-left-2 px-1">
                            {10 - remarks.trim().length} more character{10 - remarks.trim().length !== 1 ? "s" : ""} needed to confirm rejection.
                          </p>
                        )}
                      </div>

                      <div className="flex gap-3">
                        <Button
                          className={`flex-1 h-14 rounded-2xl font-black text-base gap-3 shadow-xl transition-all border-b-4
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
                            <Loader2 className="h-6 w-6 animate-spin" />
                          ) : (
                            <ChevronRight className="h-6 w-6" />
                          )}
                          {submitting
                            ? "PROCESSING..."
                            : `CONFIRM ${confirmAction === "APPROVED" ? "FINAL APPROVAL" : "REJECTION"}`}
                        </Button>
                        <Button
                          variant="ghost"
                          className="px-8 h-14 rounded-2xl font-bold text-muted-foreground hover:text-foreground"
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
