// src/modules/financial-management/treasury/bulk-approval/components/AuditeeDetailSplitModal.tsx
"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  Maximize2,
  RotateCcw,
  RotateCw,
  Send,
  ShieldCheck,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

import type {
  FinalDecisionTarget,
  FinalHeaderDecisionStatus,
  FinalTopSheetDetail,
  FinalTopSheetResponse,
  FinalTopSheetSalesmanResponse,
} from "../type";
import { formatCurrency, formatDate } from "../utils/format";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: number | null;
  headerId?: number | null;
  data: FinalTopSheetResponse | null;
  submitting: boolean;
  onSubmitTargetDecision: (
    status: FinalHeaderDecisionStatus,
    target: FinalDecisionTarget,
    remarks?: string
  ) => void | Promise<void>;
  onToggleDecision?: (status: FinalHeaderDecisionStatus, target: FinalDecisionTarget) => void;
  stagedDecisions?: Record<string, { target: FinalDecisionTarget; status: FinalHeaderDecisionStatus }>;
  onPreviewUrl: (url: string) => void;
};

function groupByCoa(details: FinalTopSheetDetail[]) {
  const map = new Map<number, { coa_id: number; account_title: string; items: FinalTopSheetDetail[] }>();
  for (const d of details) {
    if (!map.has(d.coa_id)) {
      map.set(d.coa_id, { coa_id: d.coa_id, account_title: d.account_title, items: [] });
    }
    map.get(d.coa_id)!.items.push(d);
  }
  return Array.from(map.values());
}

export default function AuditeeDetailSplitModal({
  open,
  onOpenChange,
  employeeId,
  headerId,
  data,
  submitting,
  onSubmitTargetDecision,
  onToggleDecision,
  stagedDecisions,
  onPreviewUrl,
}: Props) {
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [inlineZoom, setInlineZoom] = React.useState(1);
  const [inlineRotation, setInlineRotation] = React.useState(0);
  const [inlineEl, setInlineEl] = React.useState<HTMLDivElement | null>(null);
  const [showEvidence, setShowEvidence] = React.useState(true);
  const [evidenceMode, setEvidenceMode] = React.useState<{ kind: "all" } | { kind: "line"; expenseId: number }>({ kind: "all" });

  const [showCloseConfirm, setShowCloseConfirm] = React.useState(false);
  const [dontShowAgain, setDontShowAgain] = React.useState(false);

  const [submitDisbursementConfirmOpen, setSubmitDisbursementConfirmOpen] = React.useState(false);
  const [disbursementRemarks, setDisbursementRemarks] = React.useState("");

  const [rejectAllConfirmOpen, setRejectAllConfirmOpen] = React.useState(false);

  // Read the dont-show-again preference from localStorage on mount
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("hide_staged_close_warning");
      setDontShowAgain(saved === "true");
    }
  }, [open]);

  const salesman = React.useMemo(() => {
    if (!data || employeeId === null) return null;
    return data.salesmen.find((s: FinalTopSheetSalesmanResponse) => {
      if (s.employee_id !== employeeId) return false;
      if (headerId !== undefined && headerId !== null && s.header_id !== headerId) return false;
      return true;
    }) ?? null;
  }, [data, employeeId, headerId]);

  const effectiveCurrentTier = React.useMemo(() => {
    return salesman?.current_tier !== undefined ? salesman.current_tier : (data?.group?.current_tier ?? 1);
  }, [salesman, data]);

  const effectivePrevTierApproverNames = React.useMemo(() => {
    return salesman?.previous_tier_approver_names ?? data?.group?.previous_tier_approver_names ?? [];
  }, [salesman, data]);

  const hasStagedDecisions = React.useMemo(() => {
    if (!stagedDecisions) return false;
    return Object.values(stagedDecisions).some((item) => {
      if (item.target.scope === "cell" && item.target.employee_id === employeeId) {
        return true;
      }
      if (item.target.scope === "encoder" && item.target.employee_id === employeeId) {
        return true;
      }
      if (item.target.scope === "expense_ids" && item.target.expense_ids) {
        return item.target.expense_ids.some(id => 
          data?.details.some(d => d.expense_id === id && d.employee_id === employeeId)
        );
      }
      return false;
    });
  }, [stagedDecisions, employeeId, data]);

  const handleClose = React.useCallback(() => {
    const isWarningSilenced = typeof window !== "undefined" && localStorage.getItem("hide_staged_close_warning") === "true";
    
    if (hasStagedDecisions && !isWarningSilenced) {
      setShowCloseConfirm(true);
    } else {
      onOpenChange(false);
    }
  }, [hasStagedDecisions, onOpenChange]);

  const isApprovedHistory = React.useMemo(() => {
    const statuses = salesman?.draft_statuses ?? data?.group?.draft_statuses;
    if (!Array.isArray(statuses) || statuses.length === 0) return false;
    const allTerminal = statuses.every((s) => {
      const lower = s.toLowerCase();
      return lower === "approved" || lower === "rejected" || lower === "posted";
    });
    const allRejected = statuses.every((s) => s.toLowerCase() === "rejected");
    return allTerminal && !allRejected;
  }, [salesman, data]);

  const isRejectedHistory = React.useMemo(() => {
    if (salesman && salesman.current_tier !== undefined && salesman.current_tier > 0) {
      return false;
    }
    const statuses = salesman?.draft_statuses ?? data?.group?.draft_statuses;
    if (!Array.isArray(statuses) || statuses.length === 0) return false;
    return statuses.every((s) => s.toLowerCase() === "rejected");
  }, [salesman, data]);

  const isTerminalHistory = React.useMemo(() => {
    const statuses = salesman?.draft_statuses ?? data?.group?.draft_statuses;
    if (!Array.isArray(statuses) || statuses.length === 0) return false;
    return statuses.every((s) => {
      const lower = s.toLowerCase();
      return lower === "approved" || lower === "rejected" || lower === "posted";
    });
  }, [salesman, data]);

  const canAct = Boolean(data?.group?.can_act) && !isTerminalHistory;

  // Non-passive wheel zoom for inline viewer
  React.useEffect(() => {
    if (!inlineEl) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) setInlineZoom(prev => Math.min(prev + 0.1, 3));
      else setInlineZoom(prev => Math.max(prev - 0.1, 1));
    };
    inlineEl.addEventListener("wheel", handler, { passive: false });
    return () => inlineEl.removeEventListener("wheel", handler);
  }, [inlineEl]);

  React.useEffect(() => {
    if (!carouselApi) return;
    setCurrentSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
      setInlineZoom(1);
      setInlineRotation(0);
    });
  }, [carouselApi]);

  // Reset zoom on close
  React.useEffect(() => {
    if (!open) {
      setInlineZoom(1);
      setInlineRotation(0);
      setCurrentSlide(0);
      setShowEvidence(true);
      setEvidenceMode({ kind: "all" });
    }
  }, [open]);

  const auditeeDetails = React.useMemo<FinalTopSheetDetail[]>(() => {
    if (!data) return [];
    return data.details.filter((d: FinalTopSheetDetail) => {
      if (employeeId !== null && d.employee_id !== employeeId) return false;
      if (headerId !== undefined && headerId !== null && d.header_id !== headerId) return false;
      return true;
    });
  }, [data, employeeId, headerId]);

  const hasUnstagedActiveLines = React.useMemo(() => {
    const activeLines = auditeeDetails.filter(
      (item) => {
        const s = (item.status ?? "").toLowerCase();
        return !s.includes("concern") && s !== "rejected";
      }
    );

    return activeLines.some((item) => {
      const stagedKey = `expense:${item.expense_id}`;
      const hasItemStaged = stagedDecisions && stagedDecisions[stagedKey];
      if (hasItemStaged) return false;

      const encoderKey = `encoder:${item.employee_id}`;
      const cellKey = `cell:${item.employee_id}:${item.coa_id}`;
      
      const hasEncoderStaged = stagedDecisions && stagedDecisions[encoderKey];
      const hasCellStaged = stagedDecisions && stagedDecisions[cellKey];

      if (hasEncoderStaged || hasCellStaged) return false;

      return true;
    });
  }, [auditeeDetails, stagedDecisions]);



  const pendingApproverNames = React.useMemo(() => {
    const approvers = salesman?.current_tier_approvers ?? data?.group?.current_tier_approvers;
    if (!approvers) return [];
    return approvers
      .filter((a) => !a.voted)
      .map((a) => a.name);
  }, [salesman, data]);

  const nextApproverNames = React.useMemo(() => {
    const approvers = salesman?.next_tier_approvers ?? data?.group?.next_tier_approvers;
    if (!approvers) return [];
    return approvers.map((a: { name: string }) => a.name);
  }, [salesman, data]);

  const expenseEvidenceItems = React.useMemo(() => {
    if (!data) return [];
    const orderedDetails = groupByCoa(auditeeDetails).flatMap((group) => group.items);
    return orderedDetails
      .filter((detail) => Boolean(detail.attachment_url))
      .map((detail) => ({
        category: "expense" as const,
        expenseId: detail.expense_id,
        headerId: detail.header_id,
        url: detail.attachment_url!,
        label: detail.remarks ? `${detail.remarks} (${detail.account_title})` : `${detail.account_title} (Line Item)`,
      }));
  }, [auditeeDetails, data]);

  const activeEvidenceItems = evidenceMode.kind === "all"
    ? expenseEvidenceItems
    : expenseEvidenceItems.filter((item) => item.expenseId === evidenceMode.expenseId);

  const openEvidence = React.useCallback((mode: { kind: "all" } | { kind: "line"; expenseId: number }) => {
    setEvidenceMode(mode);
    setCurrentSlide(0);
    setInlineZoom(1);
    setInlineRotation(0);
    setShowEvidence(true);
    carouselApi?.scrollTo(0);
  }, [carouselApi]);

  const coaGroups = React.useMemo(() => groupByCoa(auditeeDetails), [auditeeDetails]);
  const grandTotal = React.useMemo(() => {
    return auditeeDetails
      .filter((d) => {
        const s = (d.status ?? "").toLowerCase();
        return !s.includes("concern") && s !== "rejected";
      })
      .reduce((sum, d) => sum + d.amount, 0);
  }, [auditeeDetails]);

  // For the final-approval confirmation modal, only count expenses belonging to the
  // currently actionable draft tier — a single encoder may have expenses across
  // multiple drafts at different tiers (e.g. Pending_L4 and Pending_L2).
  const actionableDetails = React.useMemo(() => {
    const tier = salesman?.current_tier;
    if (tier === undefined || tier === 0) return auditeeDetails;
    const hasMixedTiers = auditeeDetails.some(
      (d) => d.draft_tier !== undefined && d.draft_tier !== tier
    );
    if (!hasMixedTiers) return auditeeDetails;
    return auditeeDetails.filter((d) => d.draft_tier === undefined || d.draft_tier === tier);
  }, [auditeeDetails, salesman]);

  const actionableTotal = React.useMemo(() => {
    return actionableDetails
      .filter((d) => {
        const s = (d.status ?? "").toLowerCase();
        return !s.includes("concern") && s !== "rejected";
      })
      .reduce((sum, d) => sum + d.amount, 0);
  }, [actionableDetails]);

  const salesmantName = salesman?.header_id
    ? `${salesman.salesman_name} (Header #${salesman.header_id})`
    : salesman?.salesman_name ?? `Employee #${employeeId}`;

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="sm:!max-w-[98vw] sm:!w-[98vw] h-[95vh] bg-transparent border-none shadow-none flex items-center justify-center gap-4 p-0 overflow-visible"
      >
        <DialogTitle className="sr-only">Auditee Expense Detail — {salesmantName}</DialogTitle>
        <DialogDescription className="sr-only">
          Detailed COA breakdown and supporting evidence for {salesmantName}
        </DialogDescription>

        {submitting && (
          <div className="absolute inset-0 z-[250] bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 rounded-[2.5rem] animate-in fade-in duration-300">
            <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
            <p className="text-xs font-semibold text-white/95 tracking-wide">
              Submitting...
            </p>
          </div>
        )}

        {/* LEFT: Evidence Registry */}
        {showEvidence && activeEvidenceItems.length > 0 && (
          <div className="w-[35vw] h-full bg-[#0f172a] rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-white/5 flex flex-col overflow-hidden animate-in slide-in-from-left duration-500 relative">
            <div className="p-8 pb-4 flex items-center justify-between">
              <div>
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
                  Evidence Registry
                </Badge>
                <h3 className="text-xl font-black text-white tracking-tight">Supporting Evidence</h3>
                <p className="text-white/40 text-[10px] font-bold mt-0.5 truncate max-w-[22vw]">{salesmantName}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/40 hover:text-white hover:bg-white/10 rounded-full"
                  onClick={() => {
                    const at = activeEvidenceItems[currentSlide];
                    if (at) onPreviewUrl(`/api/fm/expense-assets?id=${at.url}`);
                  }}
                  title="View Full Screen"
                >
                  <Maximize2 size={20} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white/40 hover:text-white hover:bg-white/10 rounded-full"
                  onClick={() => setShowEvidence(false)}
                >
                  <X size={20} />
                </Button>
              </div>
            </div>

            <div ref={setInlineEl} className="flex-1 relative flex items-center justify-center p-8">
              <Carousel setApi={setCarouselApi} opts={{ watchDrag: false }} className="w-full h-full">
                <CarouselContent className="h-full">
                  {activeEvidenceItems.map((at, i) => (
                    <CarouselItem key={`${at.category}:${at.url}`} className="flex items-center justify-center h-full">
                      <div className="relative w-full h-full flex flex-col items-center justify-center gap-6">
                        <div className="relative group/img max-w-full h-[65vh] w-full flex items-center justify-center bg-black/40 rounded-3xl overflow-hidden border border-white/10 shadow-2xl select-none">                           <motion.div
                            drag={inlineZoom > 1}
                            dragMomentum={false}
                            className="relative flex items-center justify-center w-full h-full select-none"
                            style={{ scale: inlineZoom, rotate: inlineRotation }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`/api/fm/expense-assets?id=${at.url}`}
                              alt={at.label}
                              className="max-w-full max-h-full object-contain pointer-events-none"
                              draggable={false}
                            />
                          </motion.div>

                          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-xl opacity-0 group-hover/img:opacity-100 transition-all duration-300">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setInlineZoom(prev => Math.min(prev + 0.25, 3))} title="Zoom In">
                              <ZoomIn size={16} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setInlineZoom(prev => Math.max(prev - 0.25, 1))} title="Zoom Out">
                              <ZoomOut size={16} />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setInlineRotation(prev => (prev + 90) % 360)} title="Rotate Clockwise">
                              <RotateCw size={16} />
                            </Button>
                            {(inlineZoom > 1 || inlineRotation !== 0) && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => { setInlineZoom(1); setInlineRotation(0); }} title="Reset">
                                <RotateCcw size={16} />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <Badge className="mb-2 border-blue-500/30 bg-blue-500/15 text-blue-300">
                            Expense Attachment
                          </Badge>
                          <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">{at.label}</p>
                          <p className="text-white/30 text-[9px] font-medium mt-1">ATTACHMENT {i + 1} OF {activeEvidenceItems.length}</p>
                        </div>
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-4 size-12 bg-white/5 border-white/10 text-white hover:bg-white/20 hover:scale-110 transition-all" />
                <CarouselNext className="right-4 size-12 bg-white/5 border-white/10 text-white hover:bg-white/20 hover:scale-110 transition-all" />
              </Carousel>
            </div>

            <div className="p-8 pt-4 bg-black/20 border-t border-white/5">
              <div className="flex items-center gap-4 text-white/40 text-[9px] font-black uppercase tracking-[0.2em]">
                <ShieldCheck size={14} className="text-emerald-500" />
                Verified Immutable Audit Trail
              </div>
            </div>
          </div>
        )}

        {/* RIGHT: Main Detail Pane */}
        <div className={`flex flex-col bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_0_50px_-12px_rgba(0,0,0,0.8)] overflow-hidden h-full transition-all duration-500 border border-slate-200 dark:border-slate-800 ${showEvidence && activeEvidenceItems.length > 0 ? "w-[60vw]" : "w-[85vw]"}`}>

          {/* Blue Header */}
          <div className="px-[2vw] py-[2.5vh] bg-[#1e40af] text-white shrink-0 relative overflow-hidden">
            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                    <ShieldCheck size={26} />
                  </div>
                  Auditee Expense Inspection
                </h2>
                <p className="text-[10px] text-white/70 font-black uppercase tracking-[0.2em]">
                  Detailed COA breakdown for {salesmantName}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {expenseEvidenceItems.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`bg-white/10 text-white border-white/20 hover:bg-white/20 text-[10px] font-black uppercase tracking-widest gap-2 h-10 px-6 rounded-2xl transition-all ${showEvidence ? "bg-white/30 border-white/40" : ""}`}
                    onClick={() => showEvidence ? setShowEvidence(false) : openEvidence({ kind: "all" })}
                  >
                    <FileText size={16} />
                    {showEvidence ? "Hide Attachments" : "Show Evidence"}
                  </Button>
                )}
                <Badge className="bg-white/20 text-white border-white/30 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm shadow-xl h-10 flex items-center justify-center rounded-2xl">
                  {activeEvidenceItems.length} Docs
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-2xl bg-white/10 text-white hover:bg-white/20"
                  onClick={() => onOpenChange(false)}
                >
                  <X size={20} />
                </Button>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-3 gap-4 px-[1.5vw] py-[2vh] bg-white dark:bg-slate-900 border-b dark:border-slate-800 shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-[8px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Auditee</p>
                <p className="font-black text-xs text-foreground truncate max-w-[15vw]">{salesmantName}</p>
                <p className="text-[9px] text-muted-foreground font-mono">ID: {employeeId ?? "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pl-4 border-l">
              <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-900/50">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-[8px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Expense Lines</p>
                <p className="font-black text-xs">
                  {actionableDetails.length}
                  {actionableDetails.length < auditeeDetails.length && (
                    <span className="ml-1.5 text-[9px] font-black text-amber-600 dark:text-amber-400">/{auditeeDetails.length}</span>
                  )}
                </p>
                {actionableDetails.length < auditeeDetails.length && (
                  <p className="text-[8px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">{auditeeDetails.length - actionableDetails.length} pending lower tier</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 pl-4 border-l">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-[8px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Total Amount</p>
                <p className="font-black text-xs text-emerald-700">{formatCurrency(actionableTotal)}</p>
              </div>
            </div>
          </div>

          {/* View-Only Context Banner */}
          {!canAct && (
            <div className={`mx-[1.5vw] mt-4 relative overflow-hidden rounded-2xl border p-4 animate-in fade-in slide-in-from-top-2 duration-300 ${
              isRejectedHistory
                ? "border-rose-200/60 dark:border-rose-900/30 bg-rose-50/40 dark:bg-rose-950/10"
                : "border-amber-200/60 dark:border-amber-900/30 bg-amber-50/40 dark:bg-amber-950/10"
            }`}>
              <div className={`absolute inset-0 ${
                isRejectedHistory
                  ? "bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.06),transparent_40%)]"
                  : "bg-[radial-gradient(circle_at_top_left,rgba(245,158,11,0.06),transparent_40%)]"
              }`} />
              <div className="relative flex gap-3.5 items-start">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm ${
                  isRejectedHistory
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-500 shadow-rose-500/5"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-500 shadow-amber-500/5"
                }`}>
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
                <div className="space-y-1 text-left min-w-0 flex-1">
                  <h4 className={`text-[11px] font-black uppercase tracking-wider leading-none ${
                    isRejectedHistory ? "text-rose-800 dark:text-rose-400" : "text-amber-800 dark:text-amber-500"
                  }`}>
                    {isRejectedHistory ? "Rejected — View Only" : isApprovedHistory ? "Finalized — View Only" : "View-Only Staging Mode"}
                  </h4>
                  <p className={`text-xs font-medium leading-relaxed max-w-4xl ${
                    isRejectedHistory ? "text-rose-700/90 dark:text-rose-400/80" : "text-amber-700/90 dark:text-amber-400/80"
                  }`}>
                    You are viewing the details for <strong className="text-slate-900 dark:text-white font-bold">{salesmantName}</strong>.{" "}
                    {isRejectedHistory ? (
                      "This submission was rejected by the final approver. No further actions can be taken on this record."
                    ) : isApprovedHistory ? (
                      "This top-sheet has been finalized and posted. No further actions can be taken."
                    ) : (
                      <>
                        Since the draft is currently at Level <strong className="text-slate-900 dark:text-white font-bold">{effectiveCurrentTier}</strong>
                        {pendingApproverNames.length > 0 ? (
                          <>
                            {" "}
                            (waiting for approver:{" "}
                            <strong className="text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-lg font-black border border-rose-500/20 shadow-sm">
                              {pendingApproverNames.join(", ")}
                            </strong>
                            )
                          </>
                        ) : (
                          nextApproverNames.length > 0 && (
                            <>
                              {" "}
                              (processing to next tier:{" "}
                              <strong className="text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg font-black border border-emerald-500/20 shadow-sm">
                                {nextApproverNames.join(", ")}
                              </strong>
                              )
                            </>
                          )
                        )}
                        , action items, staging buttons, and feedback updates are locked. They will become actionable once the draft reaches the required final approval tier (Level {data?.group?.required_approver_level ?? 4}).
                      </>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}


          {/* Toolbar */}
          <div className="px-[2vw] py-3 bg-muted/5 dark:bg-slate-900/50 border-b dark:border-slate-800 flex items-center justify-between shrink-0">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-slate-800 dark:text-slate-200">
              <FileText className="h-4 w-4 text-primary" />
              Verification Registry — Grouped by COA
            </h3>
          </div>

          {/* COA-Grouped Table */}
          <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950/50 p-6">
            {coaGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest">No expense lines found.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {coaGroups.map(group => {
                  const coaTotal = group.items
                    .filter(i => {
                      const s = (i.status ?? "").toLowerCase();
                      return !s.includes("concern") && s !== "rejected";
                    })
                    .reduce((s, i) => s + i.amount, 0);
                  return (
                    <div key={group.coa_id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                      {/* COA Header */}
                      <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Account</p>
                          <p className="text-sm font-black">{group.account_title}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-black text-emerald-400">{formatCurrency(coaTotal)}</p>
                          {/* <div className="flex items-center gap-1">
                            <Button type="button" size="icon" className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white" disabled={submitting} onClick={() => void onSubmitTargetDecision("Approved", { scope: "coa", coa_id: group.coa_id })} title="Approve entire COA">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-lg border-amber-500/30 text-amber-400 hover:bg-amber-500/20" disabled={submitting} onClick={() => void onSubmitTargetDecision("With Concern", { scope: "coa", coa_id: group.coa_id })} title="Flag entire COA with concern">
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-lg border-rose-500/30 text-rose-400 hover:bg-rose-500/20" disabled={submitting} onClick={() => void onSubmitTargetDecision("Rejected", { scope: "coa", coa_id: group.coa_id })} title="Reject entire COA">
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div> */}
                        </div>
                      </div>

                      {/* Line Items */}
                      <Table>
                        <TableHeader className="bg-slate-50/70 dark:bg-slate-900/70">
                          <TableRow>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest py-2 pl-5 w-8">#</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest py-2">Remarks</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest py-2">Payee</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest py-2 text-center">Date</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest py-2 text-right">Amount</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest py-2 text-center">Status</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest py-2 text-center">Feedback</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest py-2 text-center">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.items.map((item, idx) => {
                            const isAlreadyCulled = ["with concern", "rejected"].includes(item.status.toLowerCase());
                            const stagedStatus = stagedDecisions?.[`expense:${item.expense_id}`]?.status;
                            const isLowerTierLocked = (
                              item.draft_tier !== undefined &&
                              item.draft_tier > 0 &&
                              salesman?.current_tier !== undefined &&
                              salesman.current_tier > 0 &&
                              item.draft_tier !== salesman.current_tier
                            );
                            const isFinalized = item.draft_tier === 0;
                            const itemTier = item.draft_tier !== undefined ? item.draft_tier : effectiveCurrentTier;
                            return (
                            <TableRow key={item.expense_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                              <TableCell className="py-3 pl-5 text-[9px] font-black text-slate-300 dark:text-slate-600 italic">{String(idx + 1).padStart(2, "0")}</TableCell>
                              <TableCell className="py-3">
                                <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 line-clamp-2">{item.remarks || "—"}</p>
                              </TableCell>
                              <TableCell className="py-3 text-[10px] font-medium text-slate-500 dark:text-slate-400">{item.payee || "—"}</TableCell>
                              <TableCell className="py-3 text-center text-[10px] font-bold text-slate-500 uppercase tabular-nums">{formatDate(item.transaction_date)}</TableCell>
                              <TableCell className="py-3 text-right text-[10px] font-black text-slate-800 dark:text-slate-200 tabular-nums">{formatCurrency(item.amount)}</TableCell>
                              <TableCell className="py-3 text-center">
                                <div className="flex flex-col items-center justify-center gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <Badge className="text-[9px] font-black border rounded-lg px-2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                                      Draft
                                    </Badge>
                                    <Badge
                                      className={`text-[8px] font-bold border rounded-lg px-1.5 py-0.5 ${
                                        item.status.toLowerCase() === "rejected"
                                          ? "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/50"
                                          : item.status.toLowerCase().includes("concern")
                                          ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50"
                                          : itemTier === 1
                                          ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/50"
                                          : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50"
                                      }`}
                                    >
                                      {item.status.toLowerCase() === "rejected"
                                        ? "Rejected"
                                        : item.status.toLowerCase().includes("concern")
                                        ? "With Concern"
                                        : itemTier === 1
                                        ? "Submitted"
                                        : `L${Math.max(1, itemTier - 1)} Approved (${effectivePrevTierApproverNames.length ? effectivePrevTierApproverNames.join(', ') : 'System'})`}
                                    </Badge>
                                  </div>
                                  {canAct && !isAlreadyCulled && !stagedStatus && !isLowerTierLocked && !isFinalized && (
                                    <Badge className="text-[8px] font-black border rounded-lg px-2 bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800 uppercase shadow-sm">
                                      Pending Your Action
                                    </Badge>
                                  )}
                                  {isLowerTierLocked && (
                                    <Badge className="text-[8px] font-black border rounded-lg px-2 bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800 uppercase shadow-sm">
                                      Pending Lower Tier
                                    </Badge>
                                  )}
                                  {stagedStatus === "Approved" && (
                                    <Badge className="text-[8px] font-black border rounded-lg px-2 bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800 uppercase shadow-sm mt-0.5">
                                      Approved (Staged)
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="py-3 px-3">
                                {item.feedback ? (
                                  <p className="text-[9px] font-medium text-slate-600 dark:text-slate-400 bg-amber-50 dark:bg-amber-900/20 p-1.5 rounded-lg border border-amber-100 dark:border-amber-900/50 text-left">
                                    <span className="font-bold text-amber-700 dark:text-amber-500 uppercase">Prior Note:</span> {item.feedback}
                                  </p>
                                ) : (
                                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-600">—</span>
                                )}
                              </TableCell>
                              <TableCell className="py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  {canAct && !isLowerTierLocked && !isFinalized && (
                                    <>
                                      {!isAlreadyCulled && (
                                        <>
                                          <Button 
                                            type="button" 
                                            size="icon" 
                                            className={`h-7 w-7 rounded-lg ${stagedStatus === 'Approved' ? 'bg-emerald-500 text-white shadow-md' : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white'}`} 
                                            disabled={submitting} 
                                            onClick={() => {
                                              if (isAlreadyCulled) {
                                                void onSubmitTargetDecision("Approved", { scope: "expense_ids", expense_ids: [item.expense_id] });
                                              } else {
                                                onToggleDecision?.("Approved", { scope: "expense_ids", expense_ids: [item.expense_id] });
                                              }
                                            }} 
                                            title="Approve"
                                          >
                                            <CheckCircle2 size={13} />
                                          </Button>
                                          <Button
                                            type="button"
                                            size="icon"
                                            variant="outline"
                                            className={`h-7 w-7 rounded-lg ${item.status.toLowerCase().includes('concern') ? 'bg-amber-500 text-white border-amber-500 shadow-md' : 'border-amber-200 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'}`}
                                            disabled={submitting}
                                            onClick={() => void onSubmitTargetDecision("With Concern", { scope: "expense_ids", expense_ids: [item.expense_id] })}
                                            title="Concern"
                                          >
                                            <AlertTriangle size={12} />
                                          </Button>
                                        </>
                                      )}
                                      {(!isAlreadyCulled || item.status.toLowerCase().includes('concern')) && (
                                        <Button
                                          type="button"
                                          size="icon"
                                          variant="outline"
                                          className={`h-7 w-7 rounded-lg ${item.status.toLowerCase() === 'rejected' ? 'bg-rose-500 text-white border-rose-500 shadow-md' : 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20'}`}
                                          disabled={submitting}
                                          onClick={() => void onSubmitTargetDecision("Rejected", { scope: "expense_ids", expense_ids: [item.expense_id] })}
                                          title="Reject"
                                        >
                                          <XCircle size={13} />
                                        </Button>
                                      )}
                                    </>
                                  )}
                                  {item.attachment_url && (
                                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 cursor-pointer rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400" onClick={() => openEvidence({ kind: "line", expenseId: item.expense_id })} title="View expense attachment">
                                      <FileText size={12} />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>

                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                <ShieldCheck size={14} className="text-emerald-500" />
                Audit Consensus Engine — Immutable Trail
              </div>
              {canAct && hasUnstagedActiveLines && (
                <div className="text-[10px] font-bold text-amber-500 dark:text-amber-400 flex items-center gap-1.5 animate-pulse bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10">
                  <AlertTriangle size={11} />
                  <span>Stage decisions for all pending lines to enable submit</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {canAct && employeeId !== null && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-xl border-rose-200/60 bg-rose-50/50 dark:bg-rose-950/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-300 px-5 text-[10px] font-black uppercase tracking-widest transition-all"
                    disabled={submitting}
                    onClick={() => {
                      setRejectAllConfirmOpen(true);
                    }}
                  >
                    Reject All
                  </Button>
                  <Button
                    type="button"
                    className="h-9 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 px-5 text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-emerald-600/10 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:shadow-none"
                    disabled={submitting || hasUnstagedActiveLines}
                    onClick={() => {
                      setDisbursementRemarks("");
                      setSubmitDisbursementConfirmOpen(true);
                    }}
                    title={hasUnstagedActiveLines ? "Stage decisions for all pending lines first" : "Submit to disbursement"}
                  >
                    Submit to Disbursement
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 rounded-xl border-slate-200 dark:border-slate-700 px-5 text-[10px] font-black uppercase tracking-widest"
                onClick={handleClose}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>

      <Dialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <DialogContent className="max-w-md p-0 overflow-hidden border border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl z-[100]">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="flex flex-col leading-none">
              <DialogTitle className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Unsubmitted Staged Decisions
              </DialogTitle>
              <DialogDescription className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                Staged Decision Warning
              </DialogDescription>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 pb-6 space-y-4">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
              You have active staged decisions for <strong className="text-slate-900 dark:text-white font-bold">{salesmantName}</strong> that have not been submitted.
            </p>

            <p className="text-[11px] text-slate-500 dark:text-slate-500 leading-normal">
              You can submit to disbursement immediately inside this modal, close to keep them staged on the parent Top-Sheet, or cancel to stay and review.
            </p>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="dontShowAgain"
                checked={dontShowAgain}
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20 dark:border-slate-800 dark:bg-slate-950"
                onChange={(e) => {
                  const val = e.target.checked;
                  setDontShowAgain(val);
                  if (typeof window !== "undefined") {
                    localStorage.setItem("hide_staged_close_warning", val ? "true" : "false");
                  }
                }}
              />
              <label htmlFor="dontShowAgain" className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 cursor-pointer select-none">
                Don&apos;t show this warning again
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10 rounded-xl border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50"
                onClick={() => {
                  setShowCloseConfirm(false);
                  onOpenChange(false);
                }}
              >
                Close Anyway
              </Button>
              <Button
                type="button"
                className="flex-1 h-10 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800"
                onClick={() => setShowCloseConfirm(false)}
              >
                Cancel / Stay
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={submitDisbursementConfirmOpen} onOpenChange={setSubmitDisbursementConfirmOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl z-[100]">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-center gap-3 bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div className="flex flex-col leading-none">
              <DialogTitle className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Disbursement Submission Confirmation
              </DialogTitle>
              <DialogDescription className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                Finalizing Payment Release
              </DialogDescription>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            {auditeeDetails.some((d) => (d.status ?? "").toLowerCase() === "with concern") && (
              <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-2xl p-4 flex items-start gap-3.5 shadow-sm">
                <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-900 dark:text-rose-300 leading-none">
                    Automatic Rejection Warning
                  </p>
                  <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium leading-relaxed">
                    Item(s) currently marked <strong>&quot;With Concern&quot;</strong> will be <strong>automatically rejected</strong> upon submitting to disbursement so that only clean, verified expenses are posted.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Auditee</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">{salesmantName}</span>
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-800" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Affected Lines</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  {actionableDetails.length} Lines
                  {actionableDetails.length < auditeeDetails.length && (
                    <span className="ml-1.5 text-[9px] font-black text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                      {auditeeDetails.length - actionableDetails.length} pending lower-tier approval
                    </span>
                  )}
                </span>
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-800" />
              <div className="flex items-center justify-between bg-emerald-50/50 dark:bg-emerald-950/20 p-3 rounded-2xl border border-emerald-100/50 dark:border-emerald-900/30">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-400">Total Approved Amount</span>
                <span className="text-sm font-black text-emerald-800 dark:text-emerald-400 tabular-nums">
                  {formatCurrency(actionableTotal)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 flex items-center gap-2">
                <FileText size={14} className="text-primary" />
                Audit Remarks <span className="text-rose-500">*</span>
              </label>
              <Textarea
                value={disbursementRemarks}
                onChange={(e) => setDisbursementRemarks(e.target.value)}
                placeholder="Provide mandatory audit remarks for this disbursement..."
                rows={3}
                className="resize-none rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-xs font-medium shadow-inner dark:shadow-none focus:ring-2 focus:ring-primary/10"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10 rounded-xl border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50"
                onClick={() => setSubmitDisbursementConfirmOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 h-10 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800"
                onClick={async () => {
                  setSubmitDisbursementConfirmOpen(false);
                  await onSubmitTargetDecision("Approved", { scope: "expense_ids", expense_ids: actionableDetails.map(d => d.expense_id) }, disbursementRemarks);
                  onOpenChange(false);
                }}
                disabled={submitting || !disbursementRemarks.trim()}
              >
                {submitting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                Confirm & Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectAllConfirmOpen} onOpenChange={setRejectAllConfirmOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden border border-slate-100 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 shadow-2xl z-[100]">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-center gap-3 bg-slate-50 dark:bg-slate-950 border-b dark:border-slate-800">
            <div className="h-10 w-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="flex flex-col leading-none">
              <DialogTitle className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Confirm Reject All
              </DialogTitle>
              <DialogDescription className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
                Rejecting Auditee Scope
              </DialogDescription>
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-5">
            <div className="bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 rounded-2xl p-4 flex items-start gap-4">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-900 dark:text-rose-400 leading-none">Reject Action Required</p>
                <p className="text-[11px] text-rose-700 dark:text-rose-400 font-medium leading-relaxed">
                  Are you sure you want to reject all active expense lines for this auditee? This action will require you to provide a rejection remark for each affected line.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Auditee</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">{salesmantName}</span>
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-800" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Affected Lines</span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">{auditeeDetails.length} Lines</span>
              </div>
              <div className="h-px bg-slate-100 dark:bg-slate-800" />
              <div className="flex items-center justify-between bg-rose-50/50 dark:bg-rose-950/20 p-3 rounded-2xl border border-rose-100/50 dark:border-rose-900/30">
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-800 dark:text-rose-400">Total Rejected Amount</span>
                <span className="text-sm font-black text-rose-800 dark:text-rose-400 tabular-nums">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t dark:border-slate-800">
              <Button
                type="button"
                variant="outline"
                className="flex-1 h-10 rounded-xl border-slate-200 dark:border-slate-800 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50"
                onClick={() => setRejectAllConfirmOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 h-10 rounded-xl bg-rose-600 text-white hover:bg-rose-700 text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-rose-600/10"
                onClick={async () => {
                  setRejectAllConfirmOpen(false);
                  await onSubmitTargetDecision("Rejected", { scope: "encoder", employee_id: employeeId!, header_id: headerId ?? undefined });
                }}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="mr-1.5 h-3.5 w-3.5" />
                )}
                Confirm & Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
