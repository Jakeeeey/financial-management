// src/modules/financial-management/treasury/bulk-approval/components/VoteModal.tsx
"use client";

import * as React from "react";
import {
  Loader2, FileText, CheckCircle2,
  ShieldCheck, X,
  ExternalLink, Info,
  AlertTriangle, RefreshCw, Send, Check, User, Building2, Wallet,
  Maximize2, ZoomIn, ZoomOut, RotateCcw, RotateCw, Move
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi
} from "@/components/ui/carousel";


import type { DraftDetail, DraftPayable, ConcernItemResponse } from "../type";
import * as api from "../providers/fetchProvider";

interface Props {
  open: boolean;
  loading: boolean;
  detail: DraftDetail | null;
  onClose: () => void;
  onVoteComplete: (draftId: number, status: string, nextTier?: number) => void;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(amount);
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try {
    const dateObj = d.includes("T") ? new Date(d) : new Date(d + "T00:00:00");
    if (isNaN(dateObj.getTime())) return d;
    return dateObj.toLocaleDateString("en-PH", {
      year: "numeric", month: "short", day: "numeric",
    });
  } catch { return d; }
}

export default function VoteModal({ open, loading, detail, onClose, onVoteComplete }: Props) {
  const [remarks, setRemarks] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [editedAmounts, setEditedAmounts] = React.useState<Record<number, string>>({});
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = React.useState<string | null>(null);
  const [showCoverage, setShowCoverage] = React.useState(false);
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [inlineZoom, setInlineZoom] = React.useState(1);
  const [inlineRotation, setInlineRotation] = React.useState(0);
  const [showConcernWarning, setShowConcernWarning] = React.useState(false);
  const [showRejectWarning, setShowRejectWarning] = React.useState(false);
  const pendingRemarks = React.useRef<string>("");
  const [sidebarWidth, setSidebarWidth] = React.useState(350);
  const isDraggingSidebar = React.useRef(false);

  // State-based callback refs: the element becomes a proper effect dependency,
  // so the listener is attached only after the DOM node actually mounts
  // (avoids the race where useEffect fires before the Radix Portal commits its content).
  const [inlineEl, setInlineEl] = React.useState<HTMLDivElement | null>(null);
  const [fullScreenEl, setFullScreenEl] = React.useState<HTMLDivElement | null>(null);

  // Native wheel handler to prevent page scroll (non-passive)
  React.useEffect(() => {
    if (!inlineEl) return;
    const handleInlineWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) setInlineZoom(prev => Math.min(prev + 0.1, 3));
      else setInlineZoom(prev => Math.max(prev - 0.1, 1));
    };
    inlineEl.addEventListener("wheel", handleInlineWheel, { passive: false });
    return () => inlineEl.removeEventListener("wheel", handleInlineWheel);
  }, [inlineEl]);

  React.useEffect(() => {
    if (!fullScreenEl) return;
    const handleFullScreenWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) setZoom(prev => Math.min(Math.max(prev + 0.1, 0.5), 5));
      else setZoom(prev => Math.min(Math.max(prev - 0.1, 0.5), 5));
    };
    fullScreenEl.addEventListener("wheel", handleFullScreenWheel, { passive: false });
    return () => fullScreenEl.removeEventListener("wheel", handleFullScreenWheel);
  }, [fullScreenEl]);

  React.useEffect(() => {
    if (!carouselApi) return;
    setCurrentSlide(carouselApi.selectedScrollSnap());
    carouselApi.on("select", () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
      setInlineZoom(1);
      setInlineRotation(0);
    });
  }, [carouselApi]);

  const handleZoom = (delta: number) => {
    setZoom(prev => Math.min(Math.max(prev + delta, 0.5), 5));
  };

  // itemDecisions now defaults to PENDING (Explicit Verification Pattern)
  const [itemDecisions, setItemDecisions] = React.useState<Record<number, "APPROVED" | "REJECTED" | "WITH_CONCERN" | "PENDING">>({});
  const [showItemRemarks, setShowItemRemarks] = React.useState<Record<number, string>>({});


  React.useEffect(() => {
    if (open && detail) {
      setRemarks("");
      setEditedAmounts({});

      const initialRemarks: Record<number, string> = {};

      const isDraftApproved = detail.draft.status === "Approved";

      // Initialize with APPROVED state if the draft is already fully approved,
      // otherwise default to PENDING for regular items.
      const payableInit = detail.payables.reduce(
        (acc: Record<number, "APPROVED" | "REJECTED" | "WITH_CONCERN" | "PENDING">, p: DraftPayable) => {
          initialRemarks[p.id] = p.feedback || "";
          const defaultStatus = p.is_rejected ? "REJECTED" : (isDraftApproved ? "APPROVED" : "PENDING");
          return {
            ...acc,
            [p.id]: p.is_concern ? ("WITH_CONCERN" as const) : (defaultStatus as "APPROVED" | "REJECTED" | "PENDING")
          };
        }, {}
      ) || {};

      const concernInit = (detail.concern_items || []).reduce(
        (acc: Record<number, "APPROVED" | "REJECTED" | "WITH_CONCERN" | "PENDING">, ci: ConcernItemResponse) => {
          initialRemarks[-ci.expense_id] = ci.feedback || "";
          const isStillConcern = ci.status === "With Concern";
          const defaultStatus = ci.status === "Rejected" ? "REJECTED" : (isDraftApproved ? "APPROVED" : "PENDING");
          return { ...acc, [-ci.expense_id]: isStillConcern ? ("WITH_CONCERN" as const) : (defaultStatus as "APPROVED" | "REJECTED" | "PENDING") };
        }, {}
      ) || {};

      setItemDecisions({ ...payableInit, ...concernInit });
      setShowItemRemarks(initialRemarks);
    }
  }, [open, detail]);

  const combinedItems = React.useMemo(() => {
    if (!detail) return [];
    const items = detail.payables.map((p: import("../type").DraftPayable) => ({
      ...p,
      is_concern: p.is_concern || false,
      feedback: p.feedback || null
    }));
    const existingIds = new Set(items.map((i: { id: number }) => i.id));
    (detail.concern_items || []).forEach((ci: import("../type").ConcernItemResponse) => {
      const negId = -ci.expense_id;
      if (!existingIds.has(negId)) {
        items.push({
          id: negId, coa_id: -1, coa_name: ci.coa_name, amount: ci.amount, remarks: ci.remarks,
          date: ci.transaction_date, reference_no: null, attachment_url: ci.attachment_url,
          is_concern: ci.status === "With Concern",
          is_rejected: ci.status === "Rejected",
          feedback: ci.feedback
        });
      }
    });
    return items as (DraftPayable & { is_concern: boolean; is_rejected?: boolean; feedback: string | null })[];
  }, [detail]);

  // Total amount ONLY for APPROVED items (Verified Only)
  const currentTotalAmount = React.useMemo(() => {
    return combinedItems.reduce((acc: number, p) => {
      if (itemDecisions[p.id] !== "APPROVED") return acc;
      const val = editedAmounts[p.id];
      return acc + (val !== undefined && val !== "" ? Number(val) : Number(p.amount));
    }, 0);
  }, [combinedItems, editedAmounts, itemDecisions]);

  const approvedCount = React.useMemo(() => {
    return Object.values(itemDecisions).filter(s => s === "APPROVED").length;
  }, [itemDecisions]);

  const setItemStatus = (id: number, status: "APPROVED" | "REJECTED" | "WITH_CONCERN" | "PENDING") => {
    const item = combinedItems.find(i => i.id === id);
    if (item?.is_concern || item?.is_rejected) return; // Hard lock for persistent states

    setItemDecisions(prev => ({ ...prev, [id]: prev[id] === status ? "PENDING" : status }));
  };



  const uncheckAll = () => {
    const next = { ...itemDecisions };
    combinedItems.forEach(item => { if (item.id > 0) next[item.id] = "PENDING"; });
    setItemDecisions(next);
  };

  const groupedPayables = React.useMemo(() => {
    const groups: Record<string, { coa_name: string; coa_id: number; weeks: Record<string, DraftPayable[]> }> = {};
    combinedItems.forEach(p => {
      const gk = p.coa_name || `COA #${p.coa_id}`;
      if (!groups[gk]) groups[gk] = { coa_name: gk, coa_id: p.coa_id, weeks: {} };
      let wk = "undated";
      if (p.date) {
        const d = new Date(p.date + "T00:00:00");
        const ws = new Date(d); ws.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        wk = format(ws, "yyyy-MM-dd");
      }
      if (!groups[gk].weeks[wk]) groups[gk].weeks[wk] = [];
      groups[gk].weeks[wk].push(p);
    });
    return Object.values(groups).map(g => ({
      coa_name: g.coa_name, coa_id: g.coa_id,
      weeks: Object.entries(g.weeks).map(([wk, items]) => {
        if (wk === "undated") return { weekKey: "undated", weekLabel: "Undated", weekStart: null, items };
        const s = new Date(wk); const e = new Date(s); e.setDate(s.getDate() + 6);
        return { weekKey: wk, weekLabel: `${format(s, "MMM d")} - ${format(e, "MMM d, yyyy")}`, weekStart: s, items };
      }).sort((a, b) => (b.weekStart?.getTime() ?? 0) - (a.weekStart?.getTime() ?? 0)),
    }));
  }, [combinedItems]);

  const activeGroup = React.useMemo(() => {
    if (!selectedGroupId) return null;
    for (const g of groupedPayables)
      for (const w of g.weeks)
        if (`${g.coa_name}-${w.weekKey}` === selectedGroupId) return { ...w, coa_name: g.coa_name };
    return null;
  }, [selectedGroupId, groupedPayables]);

  React.useEffect(() => {
    if (!selectedGroupId && groupedPayables.length > 0) {
      const firstGroup = groupedPayables[0];
      if (firstGroup.weeks.length > 0) setSelectedGroupId(`${firstGroup.coa_name}-${firstGroup.weeks[0].weekKey}`);
    }
  }, [groupedPayables, selectedGroupId]);

  const derivedStatus = React.useMemo(() => {
    const vals = Object.entries(itemDecisions).filter(([id]) => Number(id) > 0).map(([, s]) => s);
    if (vals.some(s => s === "WITH_CONCERN")) return "WITH_CONCERN";
    if (vals.length > 0 && vals.every(s => s === "REJECTED")) return "REJECTED";
    return "APPROVED";
  }, [itemDecisions]);

  const hasPendingItems = React.useMemo(() => {
    return Object.values(itemDecisions).some(s => s === "PENDING");
  }, [itemDecisions]);

  const hasMissingFeedback = React.useMemo(() => {
    if (!detail) return false;
    return combinedItems.some(p =>
      (itemDecisions[p.id] === "REJECTED" || itemDecisions[p.id] === "WITH_CONCERN") &&
      !(showItemRemarks[p.id]?.trim())
    );
  }, [combinedItems, itemDecisions, showItemRemarks, detail]);

  const [processingItem] = React.useState<number | null>(null);

  if (!detail) return null;
  const { draft, payables } = detail;
  const currentTier = draft.current_tier || 1;
  const isInteractionDisabled = !!detail.my_vote || !detail.can_vote;

  const handleSingleItemVote = async (p: DraftPayable) => {
    const status = itemDecisions[p.id];
    const feedback = showItemRemarks[p.id];

    if (status === "PENDING" || !status) return;
    if ((status === "WITH_CONCERN" || status === "REJECTED") && !feedback?.trim()) {
      return toast.warning("Feedback is required for this decision.");
    }

    // Single-item batch: auto-post the full vote immediately.
    // Pass the item feedback as batch remarks so the user doesn't have
    // to fill two separate fields for a single-line decision.
    if (combinedItems.length === 1) {
      const batchRemarks = remarks.trim() || feedback?.trim() || "";
      setRemarks(batchRemarks);
      handleVote(batchRemarks);
      return;
    }

    // Multi-item batch: local staging only. The backend vote endpoint is
    // submitted once per draft by the main Submit Decision button;
    // calling it per line would cause subsequent lines to fail with "Already voted".
    toast.success(`Decision for item #${p.id} staged. Submit the batch to finalize.`);
  };

  async function handleVote(overrideRemarks?: string) {
    if (!detail) return;
    const cleanOverride = typeof overrideRemarks === "string" ? overrideRemarks : undefined;
    const effectiveRemarks = cleanOverride ?? remarks;
    if (!effectiveRemarks.trim()) return toast.warning("Approval remarks are required for the audit trail.");

    const missingFeedback = combinedItems
      .filter((p: { id: number }) => (itemDecisions[p.id] === "REJECTED" || itemDecisions[p.id] === "WITH_CONCERN"))
      .filter((p: { id: number }) => !(showItemRemarks[p.id]?.trim()))
      .map((p: { id: number; coa_name: string }) => ({ id: p.id, coa_name: p.coa_name, status: itemDecisions[p.id] as "REJECTED" | "WITH_CONCERN" }));

    if (missingFeedback.length > 0) {
      toast.error(`Please provide feedback for ${missingFeedback.length} items.`);
      return;
    }

    // Store remarks for use by confirmation dialogs
    pendingRemarks.current = effectiveRemarks;

    const hasWithConcern = combinedItems.some(p => itemDecisions[p.id] === "WITH_CONCERN");
    if (hasWithConcern) {
      setShowConcernWarning(true);
      return;
    }

    const hasRejected = combinedItems.some(p => itemDecisions[p.id] === "REJECTED");
    if (hasRejected) {
      setShowRejectWarning(true);
      return;
    }

    executeSubmit(effectiveRemarks);
  }

  async function executeSubmit(overrideRemarks?: string) {
    setSubmitting(true);
    setShowConcernWarning(false);
    setShowRejectWarning(false);
    const cleanOverride = typeof overrideRemarks === "string" ? overrideRemarks : undefined;
    const effectiveRemarks = cleanOverride ?? pendingRemarks.current ?? remarks;
    try {
      const payloadEditedPayables = payables
        .map((p) => {
          if (itemDecisions[p.id] !== "APPROVED") return null;
          const edited = editedAmounts[p.id];
          if (edited !== undefined && edited !== "" && Number(edited) !== Number(p.amount)) {
            return { id: p.id, amount: Number(edited) };
          }
          return null;
        })
        .filter((item: { id: number; amount: number } | null): item is { id: number; amount: number } => item !== null);

      const payloadItemDecisions: Record<number, { status: "APPROVED" | "REJECTED" | "WITH_CONCERN"; remarks: string }> = {};

      Object.entries(itemDecisions).forEach(([idStr, status]) => {
        const id = Number(idStr);
        if (status === "PENDING") return;
        const isVirtualOrConcernItem = id < 0;
        const shouldSendDecision = status !== "APPROVED" || isVirtualOrConcernItem;
        if (!shouldSendDecision) return;

        payloadItemDecisions[id] = {
          status,
          remarks: showItemRemarks[id]?.trim() || (status === "REJECTED" ? "Item rejected." : status === "WITH_CONCERN" ? "Concern raised." : "Cleared."),
        };
      });

      const result = await api.submitVote({
        draft_id: draft.id,
        status: derivedStatus,
        remarks: effectiveRemarks.trim(),
        edited_payables: payloadEditedPayables.length > 0 ? payloadEditedPayables : undefined,
        item_decisions: Object.keys(payloadItemDecisions).length > 0 ? payloadItemDecisions : undefined,
      });

      if (result.result === "APPROVED") toast.success("Draft fully approved!");
      else if (result.result === "TIER_ADVANCED") toast.success(`Advanced to Level ${result.next_tier}.`);
      else toast.info("Vote recorded.");

      onVoteComplete(draft.id, derivedStatus, result.next_tier);
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "An error occurred"); } finally { setSubmitting(false); }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent showCloseButton={false} className="sm:!max-w-[98vw] sm:!w-[98vw] h-[95vh] bg-transparent border-none shadow-none flex items-center justify-center gap-4 p-0 overflow-visible">
          <DialogTitle className="sr-only">Bulk Approval Review</DialogTitle>
          <DialogDescription className="sr-only">Review and verify expense items before submitting your decision</DialogDescription>

          {/* Supporting Evidence Pane (Outside main modal but in split view) */}
          {showCoverage && detail?.attachments && detail.attachments.length > 0 && (
            <div className="w-[35vw] h-full bg-[#0f172a] rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] border border-white/5 flex flex-col overflow-hidden animate-in slide-in-from-left duration-500 relative">
              <div className="p-8 pb-4 flex items-center justify-between">
                <div>
                  <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] mb-2">
                    Evidence Registry
                  </Badge>
                  <h3 className="text-xl font-black text-white tracking-tight">Supporting Evidence</h3>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white/40 hover:text-white hover:bg-white/10 rounded-full"
                    onClick={() => {
                      if (detail?.attachments?.[currentSlide]) {
                        setPreviewUrl(`/api/fm/expense-assets?id=${detail.attachments[currentSlide].file_url}`);
                      }
                    }}
                    title="View Full Screen"
                  >
                    <Maximize2 size={20} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white/40 hover:text-white hover:bg-white/10 rounded-full"
                    onClick={() => setShowCoverage(false)}
                  >
                    <X size={20} />
                  </Button>
                </div>
              </div>

              <div ref={setInlineEl} className="flex-1 relative flex items-center justify-center p-8">
                <Carousel setApi={setCarouselApi} opts={{ watchDrag: false }} className="w-full h-full">
                  <CarouselContent className="h-full">
                    {detail.attachments.map((at: { file_url: string; file_name: string }, i: number) => (
                      <CarouselItem key={i} className="flex items-center justify-center h-full">
                        <div className="relative w-full h-full flex flex-col items-center justify-center gap-6">
                          <div
                            className="relative group/img max-w-full h-[65vh] w-full flex items-center justify-center bg-black/40 rounded-3xl overflow-hidden border border-white/10 shadow-2xl select-none"
                          >
                            <motion.div
                              drag={inlineZoom > 1}
                              dragMomentum={false}
                              className="relative flex items-center justify-center w-full h-full select-none"
                              style={{ scale: inlineZoom, rotate: inlineRotation }}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={`/api/fm/expense-assets?id=${at.file_url}`}
                                alt={at.file_name}
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
                            <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">{at.file_name}</p>
                            <p className="text-white/30 text-[9px] font-medium mt-1">ATTACHMENT {i + 1} OF {detail.attachments?.length}</p>
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

          {/* Main Modal Pane */}
          <div className={`flex flex-col bg-white dark:bg-slate-950 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden h-full transition-all duration-500 border border-slate-200 dark:border-slate-800 ${showCoverage ? "w-[60vw]" : "w-[85vw]"}`}>
            {!loading && detail && (
              <div className="shrink-0">
                {detail.my_vote ? (
                  <div className="bg-emerald-500/10 border-b border-emerald-500/20 px-6 py-2.5 flex items-center justify-between animate-in slide-in-from-top duration-300">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-black text-emerald-700 leading-none">Decision Recorded</p>
                        <p className="text-[11px] text-emerald-600 font-medium mt-0.5">
                          You already approved/rejected items in Round {detail.my_vote.version} on {format(new Date(detail.my_vote.created_at), "MMM d, h:mm a")}.
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-500 text-white border-none px-3 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm shadow-emerald-200">
                      {detail.my_vote.status}
                    </Badge>
                  </div>
                ) : (
                  null
                )}
              </div>
            )}

            {/* Header Section (Blue Pattern) */}
            <div className="px-[2vw] py-[2.5vh] bg-[#1e40af] text-white shrink-0 relative overflow-hidden">
              <div className="flex items-center justify-between relative z-10">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black tracking-tight flex items-center gap-3">
                    <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
                      <ShieldCheck size={26} />
                    </div>
                    Expense Batch Review & Approval
                  </h2>
                  <p className="text-[10px] text-white/70 font-black uppercase tracking-[0.2em]">
                    Review salesmen submittals and submit approval decisions for the current approval level.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {detail?.attachments && detail.attachments.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className={`bg-white/10 text-white border-white/20 hover:bg-white/20 text-[10px] font-black uppercase tracking-widest gap-2 h-10 px-6 rounded-2xl transition-all ${showCoverage ? "bg-white/30 border-white/40" : ""}`}
                      onClick={() => setShowCoverage(!showCoverage)}
                    >
                      <FileText size={16} />
                      {showCoverage ? "Hide Attachments" : "Show Supporting Evidence"}
                    </Button>
                  )}
                  <Badge className="bg-white/20 text-white border-white/30 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm shadow-xl h-10 flex items-center justify-center rounded-2xl">
                    {currentTier >= 999 ? "Finalized" : `Level ${currentTier}`}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="bg-blue-600/10 dark:bg-blue-900/20 border-b border-blue-600/20 dark:border-blue-800/50 px-6 py-2.5 flex items-center gap-3 animate-in slide-in-from-top duration-300">
              <div className="h-8 w-8 rounded-full bg-blue-600/20 dark:bg-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <ShieldCheck size={18} />
              </div>
              <div>
                <p className="text-sm font-black text-blue-700 dark:text-blue-400 leading-none">Approval Review Context</p>
                <p className="text-[11px] text-blue-600 dark:text-blue-400/70 font-medium mt-0.5">
                  Review the batch, verify each line item, then submit your approval decision.
                </p>
              </div>
            </div>
            {/* Stats Bar Section */}
            <div className="grid grid-cols-5 gap-4 px-[1.5vw] py-[2vh] bg-white dark:bg-slate-900 border-b dark:border-slate-800 shadow-sm shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800 shadow-inner">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-[8px] uppercase font-black text-muted-foreground dark:text-slate-500 tracking-widest leading-none mb-1">Salesman</p>
                  <p className="font-black text-xs text-foreground dark:text-slate-200 truncate max-w-[12vw]">{draft.payee_name || "Unknown"}</p>
                  <p className="text-[9px] text-muted-foreground dark:text-slate-500 font-mono">ID: {draft.payee_user_id || "N/A"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-4 border-l border-muted/50 dark:border-slate-800">
                <div className="h-10 w-10 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800 shadow-inner">
                  <Building2 size={20} />
                </div>
                <div>
                  <p className="text-[8px] uppercase font-black text-muted-foreground dark:text-slate-500 tracking-widest leading-none mb-1">Context</p>
                  <p className="font-black text-xs text-foreground dark:text-slate-200 truncate max-w-[10vw]">{draft.division_name || "N/A"}</p>
                  <p className="text-[9px] text-muted-foreground dark:text-slate-500 uppercase tracking-tighter truncate max-w-[10vw]">BATCH: {draft.doc_no}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-4 border-l border-muted/50 dark:border-slate-800">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 shadow-inner">
                  <Wallet size={20} />
                </div>
                <div>
                  <p className="text-[8px] uppercase font-black text-muted-foreground dark:text-slate-500 tracking-widest leading-none mb-1">Total Amount</p>
                  <p className="font-black text-xs text-emerald-700 dark:text-emerald-400">{formatCurrency(currentTotalAmount)}</p>
                  <p className="text-[9px] text-muted-foreground dark:text-slate-500 italic">Target Value</p>
                </div>
              </div>
              {/* Current Tier Approvers Card */}
              <div className="flex items-center gap-3 pl-4 border-l border-muted/50 dark:border-slate-800">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800 shadow-inner shrink-0">
                  <ShieldCheck size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[8px] uppercase font-black text-muted-foreground dark:text-slate-500 tracking-widest leading-none mb-1.5">Current Approver</p>
                  <div className="flex flex-col gap-0.5">
                    {(detail?.approvers_by_level?.[currentTier] ?? []).length > 0
                      ? (detail?.approvers_by_level?.[currentTier] ?? []).map((a) => (
                          <div key={a.approver_id} className="flex items-center gap-1.5">
                            <span className="font-black text-[10px] text-indigo-700 dark:text-indigo-400 truncate max-w-[10vw]">{a.name}</span>
                            {a.vote
                              ? <Badge className="text-[8px] px-1 py-0 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 font-black shrink-0">Voted</Badge>
                              : <Badge className="text-[8px] px-1 py-0 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 font-black shrink-0">Pending</Badge>
                            }
                          </div>
                        ))
                      : <span className="text-[10px] text-muted-foreground dark:text-slate-500">—</span>
                    }
                  </div>
                </div>
              </div>
              {/* Progress Card */}
              <div className="flex items-center gap-3 pl-4 border-l border-muted/50 dark:border-slate-800">
                <div className="flex flex-col gap-1 w-full">
                  <p className="text-[8px] uppercase font-black text-muted-foreground dark:text-slate-500 tracking-widest leading-none mb-1 text-right">Progress</p>
                  <div className="flex justify-end gap-1.5 flex-wrap">
                    <Badge className="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[9px] font-black px-1.5 py-0">Approved: {approvedCount}</Badge>
                    <Badge className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 text-[9px] font-black px-1.5 py-0">Pending: {Object.values(itemDecisions).filter(v => v === "PENDING").length}</Badge>
                  </div>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-pulse">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <span className="font-black text-xs uppercase tracking-[0.3em] text-muted-foreground">Syncing Details...</span>
              </div>
            ) : (
              <>
                {/* Toolbar Pattern */}
                <div className="px-[2vw] py-4 bg-muted/5 dark:bg-slate-900/50 border-b dark:border-slate-800 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-8">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-slate-800 dark:text-slate-200">
                      <FileText className="h-4 w-4 text-primary" />
                      Verification Registry
                    </h3>
                    <div className="flex items-center gap-3">
                      {/* <button
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isInteractionDisabled ? "opacity-30 cursor-not-allowed" : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"}`}
                        onClick={() => !isInteractionDisabled && approveAll()}
                        disabled={isInteractionDisabled}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Approve All</span>
                      </button> */}
                      <button
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${isInteractionDisabled ? "opacity-30 cursor-not-allowed" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"}`}
                        onClick={() => !isInteractionDisabled && uncheckAll()}
                        disabled={isInteractionDisabled}
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Reset</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest">
                    <span className="flex items-center gap-2 text-amber-600 dark:text-amber-500 animate-pulse"><Info size={14} /> Approval Action</span>
                  </div>
                </div>

                <div className="flex-1 flex min-h-0 bg-slate-50/50">
                  {/* Sidebar: COA Groups */}
                  <div style={{ width: sidebarWidth, minWidth: 200, maxWidth: "50vw" }} className="bg-white dark:bg-slate-950 overflow-y-auto shrink-0 relative flex flex-col">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 pl-8 text-slate-800 dark:text-slate-400">Account / Period</TableHead>
                          <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-right pr-4 text-slate-800 dark:text-slate-400">Amount</TableHead>
                          {/* <TableHead className="text-[10px] font-black uppercase tracking-widest py-4 text-center text-slate-800 dark:text-slate-400">Action</TableHead> */}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {groupedPayables.map(g => g.weeks.map(w => {
                          const gid = `${g.coa_name}-${w.weekKey}`;
                          const isSelected = selectedGroupId === gid;
                          const total = w.items.reduce((acc, p) => acc + Number(p.amount), 0);
                          return (
                            <TableRow key={gid}
                              className={`cursor-pointer group transition-all ${isSelected ? "bg-blue-50 dark:bg-blue-900/40" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"}`}
                              onClick={() => setSelectedGroupId(gid)}
                            >
                              <TableCell className="pl-4 py-3 relative">
                                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />}
                                <div className="flex items-center gap-2">
                                  <div className={`h-6 w-6 shrink-0 rounded-lg flex items-center justify-center text-[8px] font-black shadow-sm ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"}`}>
                                    #
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-tight text-slate-800 dark:text-slate-200 leading-none mb-1 truncate">{g.coa_name}</p>
                                    <p className="text-[8px] font-bold text-muted-foreground dark:text-slate-500 truncate">{w.weekLabel}</p>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-3 pr-2">
                                <p className="text-[10px] font-black tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(total)}</p>
                                <p className="text-[8px] text-muted-foreground dark:text-slate-500 font-bold italic">{w.items.length} units</p>
                              </TableCell>
                              {/* <TableCell className="text-center py-3">
                                <Button
                                  variant="ghost"
                                  className={`h-7 px-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${isVerified ? "bg-emerald-500/10 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-800" : "bg-blue-600 dark:bg-blue-700 text-white hover:bg-blue-700 dark:hover:bg-blue-600"}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!isInteractionDisabled) {
                                      toggleGroupStatus(w.items, "APPROVED");
                                    }
                                  }}
                                  disabled={submitting || isInteractionDisabled}
                                >
                                  {isVerified ? <CheckCircle2 size={12} /> : <CheckSquare size={12} />}
                                </Button>
                              </TableCell> */}
                            </TableRow>
                          );
                        }))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Vertical Drag Resizer */}
                  <div
                    className="w-1 cursor-col-resize bg-slate-200 dark:bg-slate-800 hover:bg-blue-500 active:bg-blue-600 shrink-0 z-20 transition-colors"
                    onMouseDown={(e) => {
                      isDraggingSidebar.current = true;
                      const startX = e.clientX;
                      const startWidth = sidebarWidth;
                      const onMouseMove = (moveEvent: MouseEvent) => {
                        if (!isDraggingSidebar.current) return;
                        const newWidth = Math.min(Math.max(startWidth + (moveEvent.clientX - startX), 200), window.innerWidth * 0.5);
                        setSidebarWidth(newWidth);
                      };
                      const onMouseUp = () => {
                        isDraggingSidebar.current = false;
                        document.removeEventListener("mousemove", onMouseMove);
                        document.removeEventListener("mouseup", onMouseUp);
                      };
                      document.addEventListener("mousemove", onMouseMove);
                      document.addEventListener("mouseup", onMouseUp);
                    }}
                  />

                  {/* Detail Table Area */}
                  <div className="flex-1 bg-white dark:bg-slate-950 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-auto p-8 pt-0">
                      <Table className="border dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/50 sticky top-0 z-10 backdrop-blur-sm border-b dark:border-slate-800">
                          <TableRow>
                            <TableHead className="w-10 text-center text-[9px] font-black text-slate-800 dark:text-slate-400">#</TableHead>
                            <TableHead className="text-[9px] font-black uppercase tracking-widest py-3 text-slate-800 dark:text-slate-400">Remarks</TableHead>
                            <TableHead className="text-center text-[9px] font-black uppercase tracking-widest py-3 w-24 text-slate-800 dark:text-slate-400">Amount</TableHead>
                            <TableHead className="text-center text-[9px] font-black uppercase tracking-widest py-3 w-12 text-slate-800 dark:text-slate-400">Docs</TableHead>
                            <TableHead className="text-center text-[9px] font-black uppercase tracking-widest py-3 w-24 text-slate-800 dark:text-slate-400">Date</TableHead>
                            <TableHead className="text-center text-[9px] font-black uppercase tracking-widest py-3 w-20 text-slate-800 dark:text-slate-400">Status</TableHead>
                            <TableHead className="text-center text-[9px] font-black uppercase tracking-widest py-3 w-32 text-slate-800 dark:text-slate-400">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {activeGroup?.items.map((p, idx) => {
                            const status = itemDecisions[p.id] || "PENDING";
                            const isPersistentLocked = p.is_concern || p.is_rejected;
                            const isStatusLocked = isPersistentLocked || isInteractionDisabled;
                            return (
                              <React.Fragment key={p.id}>
                                <TableRow className="group hover:bg-slate-50/50 dark:hover:bg-slate-900/50 border-b border-slate-100 dark:border-slate-800">
                                  <TableCell className="text-center py-3 text-[9px] font-black text-slate-300 dark:text-slate-700 italic">{(idx + 1).toString().padStart(2, '0')}</TableCell>
                                  <TableCell className="py-3">
                                    <p className="text-[10px] font-black text-slate-800 dark:text-slate-200 leading-none mb-1 line-clamp-1">{p.remarks || "No remarks"}</p>
                                    <p className="text-[8px] text-muted-foreground dark:text-slate-500 font-mono">REF: {p.reference_no || "N/A"}</p>
                                  </TableCell>
                                  <TableCell className="py-3 text-center">
                                    <Input
                                      type="number"
                                      className="h-7 w-20 text-center text-[10px] font-black tabular-nums bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
                                      value={editedAmounts[p.id] || p.amount}
                                      onChange={(e) => setEditedAmounts(prev => ({ ...prev, [p.id]: e.target.value }))}
                                      disabled={processingItem === p.id || submitting || isStatusLocked}
                                    />
                                  </TableCell>
                                  <TableCell className="py-4 text-center">
                                    {p.attachment_url && (
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40"
                                        onClick={() => setPreviewUrl(`/api/fm/expense-assets?id=${p.attachment_url}`)}
                                        disabled={processingItem === p.id || submitting || isStatusLocked}
                                      >
                                        <ExternalLink size={14} />
                                      </Button>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-4 text-center text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{formatDate(p.date)}</TableCell>
                                  <TableCell className="py-4 text-center">
                                    <Badge className={`text-[9px] font-black h-5 px-2 uppercase shadow-sm ${status === "APPROVED" ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800" : status === "REJECTED" ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800" : status === "WITH_CONCERN" ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`}>
                                      {status === "PENDING" ? "Pending" : status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <Button size="icon" className={`h-7 w-7 rounded-lg shadow-sm ${status === "APPROVED" ? "bg-emerald-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/40"}`} onClick={() => setItemStatus(p.id, "APPROVED")} disabled={processingItem === p.id || submitting || isStatusLocked}>
                                        <Check size={14} strokeWidth={3} />
                                      </Button>
                                      <Button size="icon" className={`h-7 w-7 rounded-lg shadow-sm ${status === "WITH_CONCERN" ? "bg-amber-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-amber-50 dark:hover:bg-amber-900/40"}`} onClick={() => setItemStatus(p.id, "WITH_CONCERN")} disabled={processingItem === p.id || submitting || isStatusLocked}>
                                        <AlertTriangle size={12} />
                                      </Button>
                                      <Button size="icon" className={`h-7 w-7 rounded-lg shadow-sm ${status === "REJECTED" ? "bg-rose-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:bg-rose-50 dark:hover:bg-rose-900/40"}`} onClick={() => setItemStatus(p.id, "REJECTED")} disabled={processingItem === p.id || submitting || isStatusLocked}>
                                        <X size={14} strokeWidth={3} />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                                {(status === "REJECTED" || status === "WITH_CONCERN") && (
                                  <TableRow className={`${status === "REJECTED" ? "bg-rose-50/30 dark:bg-rose-900/10" : "bg-amber-50/30 dark:bg-amber-900/10"}`}>
                                    <TableCell colSpan={7} className="px-8 py-3">
                                      <div className="flex items-center gap-4 pl-12 flex-1">
                                        <span className={`text-[10px] font-black uppercase tracking-widest ${status === "REJECTED" ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"} shrink-0`}>Audit Feedback:</span>
                                        <Input
                                          placeholder="Provide mandatory feedback for decision..."
                                          className="h-8 text-xs font-medium border-2 focus:border-primary bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-inner flex-1"
                                          value={showItemRemarks[p.id] || ""}
                                          onChange={(e) => setShowItemRemarks(prev => ({ ...prev, [p.id]: e.target.value }))}
                                          disabled={processingItem === p.id || submitting || isPersistentLocked || isInteractionDisabled}
                                        />
                                        <Button
                                          size="sm"
                                          className="h-8 px-4 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-lg shadow-md gap-2 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:border-none disabled:shadow-none disabled:cursor-not-allowed"
                                          disabled={processingItem === p.id || !showItemRemarks[p.id]?.trim() || isPersistentLocked}
                                          onClick={() => handleSingleItemVote(p)}
                                        >
                                          {processingItem === p.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                                          Submit Decision
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Footer Section Pattern */}
                    <div className="p-8 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-end justify-between gap-12 relative">
                      <div className="flex-1 space-y-3">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400 flex items-center gap-2">
                          <Info size={14} className="text-blue-500 dark:text-blue-400" />
                          Approval Remarks <span className="text-red-500 font-black">*</span>
                        </label>
                        <Textarea
                          rows={4}
                          className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-2xl p-4 text-sm font-medium shadow-inner resize-none focus:ring-2 focus:ring-blue-500/20"
                          placeholder={hasPendingItems ? "Resolve all pending items first..." : "State your decision remarks for this batch..."}
                          value={remarks}
                          onChange={(e) => setRemarks(e.target.value)}
                          disabled={submitting || isInteractionDisabled}
                        />
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 italic">
                          Your remarks will be saved in the approval audit trail.
                        </p>
                      </div>

                      <div className="w-80 flex flex-col gap-4">
                        <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                            <span>Decision Summary</span>
                            <span className="text-blue-600 dark:text-blue-400">{approvedCount} units</span>
                          </div>
                          <div className="h-[1px] bg-slate-100 dark:bg-slate-800 w-full" />
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Total Value:</span>
                            <span className="text-2xl font-black tabular-nums text-blue-700 dark:text-blue-400 tracking-tighter">{formatCurrency(currentTotalAmount)}</span>
                          </div>
                          <Button
                            disabled={submitting || hasPendingItems || hasMissingFeedback || !remarks.trim() || !!detail.my_vote || !detail.can_vote}
                            className="w-full h-14 relative bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg border-t border-white/20 gap-3 active:scale-[0.98] transition-all disabled:bg-slate-100 dark:disabled:bg-slate-850 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:border-none disabled:shadow-none disabled:cursor-not-allowed"
                            onClick={() => handleVote()}
                          >
                            {submitting ? (
                              <Loader2 className="animate-spin h-5 w-5" />
                            ) : (
                              <ShieldCheck size={22} />
                            )}
                            <span>Submit Decision</span>
                          </Button>
                        </div>
                        <button className="w-full py-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 hover:text-slate-600 transition-colors" onClick={onClose}>
                          Cancel Review
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!previewUrl} onOpenChange={(v) => { if (!v) { setPreviewUrl(null); setZoom(1); setRotation(0); } }}>
        <DialogContent showCloseButton={false} className="max-w-[95vw] w-[95vw] h-[90vh] p-0 overflow-hidden bg-[#020617] border-none shadow-2xl flex flex-col">
          <DialogTitle className="sr-only">Evidence Preview</DialogTitle>
          <DialogDescription className="sr-only">Detailed view of the attached evidence document</DialogDescription>

          {/* Preview Header */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-black/40 backdrop-blur-xl border border-white/10 p-2 rounded-2xl shadow-2xl">
            <Button variant="ghost" size="icon" className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10" onClick={() => handleZoom(0.25)} title="Zoom In">
              <ZoomIn size={20} />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10" onClick={() => handleZoom(-0.25)} title="Zoom Out">
              <ZoomOut size={20} />
            </Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setRotation(prev => (prev + 90) % 360)} title="Rotate Clockwise">
              <RotateCw size={20} />
            </Button>
            <div className="w-px h-6 bg-white/10 mx-1" />
            <Button variant="ghost" size="icon" className="h-10 w-10 text-white/70 hover:text-white hover:bg-white/10" onClick={() => { setZoom(1); setRotation(0); }} title="Reset View">
              <RotateCcw size={20} />
            </Button>
            <div className="px-3 text-[10px] font-black text-white/40 uppercase tracking-widest border-l border-white/10 ml-1">
              {Math.round(zoom * 100)}%
            </div>
          </div>

          <Button variant="ghost" size="icon" className="absolute top-6 right-6 z-50 h-12 w-12 text-white bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 rounded-full border border-white/10 backdrop-blur-md" onClick={() => setPreviewUrl(null)}>
            <X size={24} />
          </Button>

          {/* Interactive Image Container */}
          <div
            ref={setFullScreenEl}
            className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
          >
            <AnimatePresence mode="wait">
              {previewUrl && (
                <motion.div
                  key={previewUrl}
                  className="w-full h-full flex items-center justify-center p-12"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                >
                  <motion.div
                    drag
                    dragMomentum={false}
                    className="relative select-none"
                    style={{ scale: zoom, rotate: rotation }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Evidence"
                      className="max-w-[85vw] max-h-[80vh] object-contain shadow-[0_0_80px_rgba(0,0,0,0.5)] rounded-lg pointer-events-none"
                      draggable={false}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/20 text-[9px] font-black uppercase tracking-[0.3em] flex items-center gap-3">
              <Move size={12} />
              Drag to Navigate • Scroll to Zoom
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showConcernWarning} onOpenChange={(v) => !v && setShowConcernWarning(false)}>
        <DialogContent className="max-w-sm p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl">
          <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100 text-base font-semibold">
            <AlertTriangle size={16} className="text-amber-500 shrink-0" />
            Confirm Submission
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mt-2">
            Some items are marked as <span className="text-amber-600 dark:text-amber-400 font-medium">With Concern</span> and will be routed separately. The remaining approved items will proceed through the approval flow.
            <br /><br />
            Do you want to continue?
          </DialogDescription>
          <div className="flex items-center justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setShowConcernWarning(false)} className="text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
              Go Back
            </Button>
            <Button onClick={() => executeSubmit(pendingRemarks.current)} className="bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-sm font-semibold px-5 rounded-lg shadow-sm">
              Confirm & Submit
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showRejectWarning} onOpenChange={(v) => !v && setShowRejectWarning(false)}>
        <DialogContent className="max-w-sm p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl">
          <DialogTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-100 text-base font-semibold">
            <X size={16} className="text-rose-500 shrink-0" />
            Confirm Rejection
          </DialogTitle>
          <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mt-2">
            You are about to <span className="text-rose-600 dark:text-rose-400 font-medium">reject</span> one or more items in this batch. This action will be recorded in the audit trail and cannot be undone without re-submitting.
            <br /><br />
            Do you want to proceed?
          </DialogDescription>
          <div className="flex items-center justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setShowRejectWarning(false)} className="text-slate-500 dark:text-slate-400 text-sm hover:bg-slate-100 dark:hover:bg-slate-800">
              Go Back
            </Button>
            <Button onClick={() => executeSubmit(pendingRemarks.current)} className="bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-700 text-white text-sm font-semibold px-5 rounded-lg shadow-sm">
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
