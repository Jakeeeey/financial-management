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
  data: FinalTopSheetResponse | null;
  submitting: boolean;
  lineRemarks: Record<number, string>;
  onLineRemarkChange: (expenseId: number, value: string) => void;
  onSubmitTargetDecision: (
    status: FinalHeaderDecisionStatus,
    target: FinalDecisionTarget
  ) => void | Promise<void>;
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

function statusBadgeClass(status: string) {
  const s = status.toLowerCase();
  if (s === "approved") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (s === "rejected") return "bg-rose-50 text-rose-700 border-rose-200";
  if (s.includes("concern")) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-100 text-slate-500 border-slate-200";
}

export default function AuditeeDetailSplitModal({
  open,
  onOpenChange,
  employeeId,
  data,
  submitting,
  lineRemarks,
  onLineRemarkChange,
  onSubmitTargetDecision,
  onPreviewUrl,
}: Props) {
  const [carouselApi, setCarouselApi] = React.useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [inlineZoom, setInlineZoom] = React.useState(1);
  const [inlineEl, setInlineEl] = React.useState<HTMLDivElement | null>(null);
  const [showEvidence, setShowEvidence] = React.useState(true);

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
    });
  }, [carouselApi]);

  // Reset zoom on close
  React.useEffect(() => {
    if (!open) {
      setInlineZoom(1);
      setCurrentSlide(0);
      setShowEvidence(true);
    }
  }, [open]);

  const auditeeDetails = React.useMemo<FinalTopSheetDetail[]>(() => {
    if (!data || employeeId === null) return [];
    return data.details.filter((d: FinalTopSheetDetail) => d.employee_id === employeeId);
  }, [data, employeeId]);

  const salesman = React.useMemo(() => {
    if (!data || employeeId === null) return null;
    return data.salesmen.find((s: FinalTopSheetSalesmanResponse) => s.employee_id === employeeId) ?? null;
  }, [data, employeeId]);

  const attachments = React.useMemo(() => {
    if (!data) return [];
    // 1. Get header-level attachments from the newly added data.attachments
    const headerIds = [...new Set(auditeeDetails.map(d => d.header_id))];
    const headerAttachments = (data.attachments || [])
      .filter((at: { header_id: number; file_url: string; file_name: string }) => headerIds.includes(at.header_id))
      .map((at: { header_id: number; file_url: string; file_name: string }) => ({ url: at.file_url, label: at.file_name }));

    // 2. Get line-level attachment fallbacks
    const lineAttachments = auditeeDetails
      .filter(d => !!d.attachment_url)
      .map(d => ({ url: d.attachment_url!, label: `${d.account_title} (Line Item)` }));

    // Merge and de-duplicate by URL
    const combined = [...headerAttachments, ...lineAttachments];
    const seen = new Set<string>();
    return combined.filter(at => {
      if (!at.url || seen.has(at.url)) return false;
      seen.add(at.url);
      return true;
    });
  }, [auditeeDetails, data]);

  const coaGroups = React.useMemo(() => groupByCoa(auditeeDetails), [auditeeDetails]);
  const grandTotal = auditeeDetails.reduce((sum, d) => sum + d.amount, 0);
  const salesmantName = salesman?.salesman_name ?? `Employee #${employeeId}`;

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

        {/* LEFT: Evidence Registry */}
        {showEvidence && attachments.length > 0 && (
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
                    const at = attachments[currentSlide];
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
                  {attachments.map((at, i) => (
                    <CarouselItem key={i} className="flex items-center justify-center h-full">
                      <div className="relative w-full h-full flex flex-col items-center justify-center gap-6">
                        <div className="relative group/img max-w-full h-[65vh] w-full flex items-center justify-center bg-black/40 rounded-3xl overflow-hidden border border-white/10 shadow-2xl select-none">
                          <motion.div
                            drag={inlineZoom > 1}
                            dragMomentum={false}
                            className="relative flex items-center justify-center w-full h-full select-none"
                            style={{ scale: inlineZoom }}
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
                            {inlineZoom > 1 && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-white/70 hover:text-white hover:bg-white/10" onClick={() => setInlineZoom(1)} title="Reset">
                                <RotateCcw size={16} />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-center">
                          <p className="text-blue-400 text-[10px] font-black uppercase tracking-widest">{at.label}</p>
                          <p className="text-white/30 text-[9px] font-medium mt-1">ATTACHMENT {i + 1} OF {attachments.length}</p>
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
        <div className={`flex flex-col bg-white rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.25)] overflow-hidden h-full transition-all duration-500 border border-slate-200 ${showEvidence && attachments.length > 0 ? "w-[60vw]" : "w-[85vw]"}`}>

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
                {attachments.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className={`bg-white/10 text-white border-white/20 hover:bg-white/20 text-[10px] font-black uppercase tracking-widest gap-2 h-10 px-6 rounded-2xl transition-all ${showEvidence ? "bg-white/30 border-white/40" : ""}`}
                    onClick={() => setShowEvidence(!showEvidence)}
                  >
                    <FileText size={16} />
                    {showEvidence ? "Hide Attachments" : "Show Evidence"}
                  </Button>
                )}
                <Badge className="bg-white/20 text-white border-white/30 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest backdrop-blur-sm shadow-xl h-10 flex items-center justify-center rounded-2xl">
                  {attachments.length} Docs
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
          <div className="grid grid-cols-3 gap-4 px-[1.5vw] py-[2vh] bg-white border-b shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                <ShieldCheck size={20} />
              </div>
              <div>
                <p className="text-[8px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Auditee</p>
                <p className="font-black text-xs text-foreground truncate max-w-[15vw]">{salesmantName}</p>
                <p className="text-[9px] text-muted-foreground font-mono">ID: {employeeId ?? "N/A"}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pl-4 border-l">
              <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 border border-purple-100">
                <FileText size={20} />
              </div>
              <div>
                <p className="text-[8px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Expense Lines</p>
                <p className="font-black text-xs">{auditeeDetails.length}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pl-4 border-l">
              <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <p className="text-[8px] uppercase font-black text-muted-foreground tracking-widest leading-none mb-1">Total Amount</p>
                <p className="font-black text-xs text-emerald-700">{formatCurrency(grandTotal)}</p>
              </div>
            </div>
          </div>

          {/* Toolbar */}
          <div className="px-[2vw] py-3 bg-muted/5 border-b flex items-center justify-between shrink-0">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] flex items-center gap-3 text-slate-800">
              <FileText className="h-4 w-4 text-primary" />
              Verification Registry — Grouped by COA
            </h3>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 rounded-full text-[10px] font-black uppercase tracking-widest gap-2"
              disabled={submitting}
              onClick={() =>
                void onSubmitTargetDecision("Approved", {
                  scope: "encoder",
                  employee_id: employeeId!,
                })
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Approve All for {salesmantName.split(" ")[0]}
            </Button>
          </div>

          {/* COA-Grouped Table */}
          <div className="flex-1 overflow-auto bg-slate-50/50 p-6">
            {coaGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-slate-400">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-xs font-black uppercase tracking-widest">No expense lines found.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {coaGroups.map(group => {
                  const coaTotal = group.items
                    .filter(i => !i.status.toLowerCase().includes("concern"))
                    .reduce((s, i) => s + i.amount, 0);
                  return (
                    <div key={group.coa_id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                      {/* COA Header */}
                      <div className="flex items-center justify-between px-5 py-3 bg-slate-900 text-white">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-white/50">Account</p>
                          <p className="text-sm font-black">{group.account_title}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="text-sm font-black text-emerald-400">{formatCurrency(coaTotal)}</p>
                          {/* COA-level actions */}
                          <div className="flex items-center gap-1">
                            <Button type="button" size="icon" className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white" disabled={submitting} onClick={() => void onSubmitTargetDecision("Approved", { scope: "coa", coa_id: group.coa_id })} title="Approve entire COA">
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-lg border-amber-500/30 text-amber-400 hover:bg-amber-500/20" disabled={submitting} onClick={() => void onSubmitTargetDecision("With Concern", { scope: "coa", coa_id: group.coa_id })} title="Flag entire COA with concern">
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-lg border-rose-500/30 text-rose-400 hover:bg-rose-500/20" disabled={submitting} onClick={() => void onSubmitTargetDecision("Rejected", { scope: "coa", coa_id: group.coa_id })} title="Reject entire COA">
                              <XCircle className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Line Items */}
                      <Table>
                        <TableHeader className="bg-slate-50/70">
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
                          {group.items.map((item, idx) => (
                            <TableRow key={item.expense_id} className="hover:bg-slate-50/50 border-b border-slate-100">
                              <TableCell className="py-3 pl-5 text-[9px] font-black text-slate-300 italic">{String(idx + 1).padStart(2, "0")}</TableCell>
                              <TableCell className="py-3">
                                <p className="text-[10px] font-bold text-slate-700 line-clamp-2">{item.remarks || "—"}</p>
                              </TableCell>
                              <TableCell className="py-3 text-[10px] font-medium text-slate-500">{item.payee || "—"}</TableCell>
                              <TableCell className="py-3 text-center text-[10px] font-bold text-slate-500 uppercase tabular-nums">{formatDate(item.transaction_date)}</TableCell>
                              <TableCell className="py-3 text-right text-[10px] font-black text-slate-800 tabular-nums">{formatCurrency(item.amount)}</TableCell>
                              <TableCell className="py-3 text-center">
                                <Badge className={`text-[9px] font-black border rounded-lg px-2 ${statusBadgeClass(item.status)}`}>
                                  {item.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3 px-3">
                                <Input
                                  placeholder="Feedback for rejection / concern..."
                                  className="h-7 text-[10px] font-medium border-slate-200 bg-slate-50 rounded-lg"
                                  value={lineRemarks[item.expense_id] ?? ""}
                                  onChange={e => onLineRemarkChange(item.expense_id, e.target.value)}
                                  disabled={submitting}
                                />
                              </TableCell>
                              <TableCell className="py-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <Button type="button" size="icon" className="h-7 w-7 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500 hover:text-white" disabled={submitting} onClick={() => void onSubmitTargetDecision("Approved", { scope: "expense_ids", expense_ids: [item.expense_id] })} title="Approve">
                                    <CheckCircle2 size={13} />
                                  </Button>
                                  <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-lg border-amber-200 text-amber-600 hover:bg-amber-50" disabled={submitting} onClick={() => void onSubmitTargetDecision("With Concern", { scope: "expense_ids", expense_ids: [item.expense_id] })} title="Concern">
                                    <AlertTriangle size={12} />
                                  </Button>
                                  <Button type="button" size="icon" variant="outline" className="h-7 w-7 rounded-lg border-rose-200 text-rose-600 hover:bg-rose-50" disabled={submitting} onClick={() => void onSubmitTargetDecision("Rejected", { scope: "expense_ids", expense_ids: [item.expense_id] })} title="Reject">
                                    <XCircle size={13} />
                                  </Button>
                                  {item.attachment_url && (
                                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600" onClick={() => onPreviewUrl(`/api/fm/expense-assets?id=${item.attachment_url}`)} title="View document">
                                      <FileText size={12} />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t bg-white px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
              <ShieldCheck size={14} className="text-emerald-500" />
              Audit Consensus Engine — Immutable Trail
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl border-slate-200 px-5 text-[10px] font-black uppercase tracking-widest"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
