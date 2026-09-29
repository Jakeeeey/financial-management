"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ExpenseItem,
  SupplierOption,
  ChartOfAccountOption,
  DivisionInfo,
  DepartmentOption,
} from "../types";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Calendar,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  RefreshCw,
  ImageOff,
  History,
  User,
  ExternalLink,
  FileText,
} from "lucide-react";

interface ExpenseLogItem {
  id: number;
  action: string;
  remarks?: string | null;
  created_at: string;
  created_by?: {
    user_id: number;
    user_fname: string;
    user_lname: string;
    user_email?: string;
  } | null;
}

interface ApprovalActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ExpenseItem | null;
  suppliers: SupplierOption[];
  coas: ChartOfAccountOption[];
  divisions: DivisionInfo[];
  departments: DepartmentOption[];
  onConfirmAction: (payload: {
    expense_id: number;
    action: "Approve" | "With Concern" | "Reject";
    remarks?: string;
    created_at: string;
  }) => Promise<void>;
}

type ActionType = "Approve" | "With Concern" | "Reject";

export const ApprovalActionModal: React.FC<ApprovalActionModalProps> = ({
  isOpen,
  onClose,
  item,
  suppliers,
  coas,
  divisions,
  departments,
  onConfirmAction,
}) => {
  const [activeConfirmAction, setActiveConfirmAction] = useState<ActionType | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Image viewer state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Audit logs state
  const [logs, setLogs] = useState<ExpenseLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Fetch logs when item changes
  useEffect(() => {
    if (item && isOpen) {
      setZoomLevel(1);
      setRotation(0);
      setPanPosition({ x: 0, y: 0 });
      setIsFullscreen(false);
      fetchLogs(item.id);
    }
  }, [item, isOpen]);

  const fetchLogs = async (expenseId: number) => {
    try {
      setLoadingLogs(true);
      const res = await fetch(
        `/api/fm/treasury/expenses-v2/expense-approval-v2/logs?expense_id=${expenseId}`
      );
      if (res.ok) {
        const json = await res.json();
        setLogs(json.data || []);
      }
    } catch {
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  };

  if (!item) return null;

  const getSupplierName = (id: number) => {
    return suppliers.find((s) => s.id === id)?.supplier_name || `Supplier #${id}`;
  };

  const getCoaName = (id: number) => {
    const found = coas.find((c) => c.coa_id === id);
    return found ? `${found.gl_code || ""} - ${found.account_title || ""}` : `COA #${id}`;
  };

  const getDivisionName = (id?: number | null) => {
    if (!id) return "-";
    return divisions.find((d) => d.division_id === id)?.division_name || `Division #${id}`;
  };

  const getDepartmentName = (id?: number | null) => {
    if (!id) return "-";
    return departments.find((d) => d.department_id === id)?.department_name || `Department #${id}`;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
  };

  const formatDateLog = (dateStr?: string | null) => {
    if (!dateStr) return "";
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2}):(\d{2})/);
    if (!match) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? dateStr : d.toLocaleString();
    }

    const [, yearStr, monthStr, dayStr, hourStr, minStr] = match;
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    const day = parseInt(dayStr, 10);
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minStr, 10);

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
    const monthName = months[month] || "";

    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const displayMin = String(minute).padStart(2, "0");

    return `${monthName} ${day}, ${year}, ${displayHour}:${displayMin} ${period}`;
  };

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3));
  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next <= 1) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  };
  const handleResetImage = () => {
    setZoomLevel(1);
    setRotation(0);
    setPanPosition({ x: 0, y: 0 });
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoomLevel <= 1 && rotation === 0) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore pointer capture errors
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();

    const rawX = e.clientX - dragStart.x;
    const rawY = e.clientY - dragStart.y;

    const maxOffset = Math.max(150, (zoomLevel - 1) * 450);
    const clampedX = Math.max(-maxOffset, Math.min(maxOffset, rawX));
    const clampedY = Math.max(-maxOffset, Math.min(maxOffset, rawY));

    setPanPosition({ x: clampedX, y: clampedY });
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore pointer capture release errors
      }
      setIsDragging(false);
    }
  };

  const openConfirmation = (action: ActionType) => {
    setErrorMsg(null);
    setFeedbackNote("");
    setActiveConfirmAction(action);
  };

  const closeConfirmation = () => {
    setActiveConfirmAction(null);
    setFeedbackNote("");
    setErrorMsg(null);
  };

  const handleExecuteFinalAction = async () => {
    if (!activeConfirmAction) return;

    // Direct literal PH timestamp format: YYYY-MM-DD HH:mm:ss (without +8h shift)
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const literalPhTimestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    try {
      setIsSubmitting(true);
      await onConfirmAction({
        expense_id: item.id,
        action: activeConfirmAction,
        remarks: feedbackNote.trim() || undefined,
        created_at: literalPhTimestamp,
      });
      setIsSubmitting(false);
      closeConfirmation();
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      const message = err instanceof Error ? err.message : "Failed to process approval action.";
      setErrorMsg(message);
    }
  };

  return (
    <>
      {/* MAIN EXPENSE REVIEW SPLIT-PANE MODAL */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="w-[95vw] sm:max-w-[95vw] max-w-none h-[95vh] max-h-[95vh] bg-card border border-border dark:border-zinc-700 dark:bg-zinc-950 shadow-2xl text-foreground p-5 flex flex-col overflow-hidden"
        >
          {/* Header */}
          <DialogHeader className="border-b border-border dark:border-zinc-700/80 pb-3 shrink-0">
            <div className="flex items-center justify-between gap-2 pr-2">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Review Expense:</span>
                <span className="font-mono text-primary">{item.doc_no}</span>
              </DialogTitle>
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border border-amber-500/30 dark:border-amber-500/50 text-xs font-semibold">
                {item.status}
              </Badge>
            </div>
          </DialogHeader>

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 dark:border-rose-500/50 rounded-lg text-rose-500 flex items-center gap-2 text-xs shrink-0 my-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* SPLIT-PANE BODY */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0 py-3 overflow-hidden">
            {/* LEFT PANE: RECEIPT IMAGE VIEWER PANEL */}
            <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 rounded-xl p-3.5 flex flex-col justify-between overflow-hidden shadow-xs">
              <div className="flex items-center justify-between pb-2.5 border-b border-border/80 dark:border-zinc-700/80 text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-primary" /> Receipt Attachment Image
                </span>

                {item.receipt_url && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={handleZoomOut}
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-[10px] font-mono text-muted-foreground w-9 text-center font-bold">
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={handleZoomIn}
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={handleRotate}
                      title="Rotate 90°"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={handleResetImage}
                      title="Reset Zoom & Rotation"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setIsFullscreen(true)}
                      title="Fullscreen Preview"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                    </Button>
                    <a
                      href={item.receipt_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                      title="Open Original Image in New Tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>

              {/* Image Preview Canvas */}
              <div
                className={`flex-1 min-h-[280px] bg-muted/40 dark:bg-black border border-border dark:border-zinc-700/90 rounded-lg my-2 flex items-center justify-center overflow-hidden relative p-2 select-none touch-none ${
                  zoomLevel > 1 || rotation !== 0
                    ? isDragging
                      ? "cursor-grabbing"
                      : "cursor-grab"
                    : "cursor-default"
                }`}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUpOrCancel}
                onPointerCancel={handlePointerUpOrCancel}
              >
                {item.receipt_url ? (
                  <div
                    className={`origin-center flex items-center justify-center will-change-transform ${
                      isDragging ? "transition-none" : "transition-transform duration-200 ease-out"
                    }`}
                    style={{
                      transform: `translate3d(${panPosition.x}px, ${panPosition.y}px, 0px) scale(${zoomLevel}) rotate(${rotation}deg)`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.receipt_url}
                      alt="Receipt Attachment"
                      className="max-h-[70vh] w-auto object-contain rounded-sm shadow-md pointer-events-none select-none"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-2">
                    <ImageOff className="w-10 h-10 text-muted-foreground/40" />
                    <span className="text-xs font-medium">No Receipt Attachment Uploaded</span>
                    <span className="text-[10px] italic text-muted-foreground/70">
                      This expense entry was submitted without an attached receipt photo.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANE: EXPENSE DETAILS & AUDIT LOGS TIMELINE */}
            <div className="flex flex-col space-y-3 min-h-0 overflow-hidden">
              {/* Expense Summary Grid */}
              <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 rounded-xl p-4 space-y-3 text-xs shrink-0 shadow-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-muted-foreground block text-[11px] font-medium">Payee / Supplier</span>
                    <span className="font-bold text-sm text-foreground block truncate">
                      {getSupplierName(item.payee)}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-muted-foreground block text-[11px] font-medium">Amount</span>
                    <span className="font-mono font-bold text-xl text-emerald-500 block">
                      {formatCurrency(Number(item.amount))}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/80 dark:border-zinc-700/70 font-mono">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Expense Date</span>
                    <span className="text-foreground font-semibold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-primary" /> {item.expense_date}
                    </span>
                  </div>

                  <div>
                    <span className="text-muted-foreground block text-[10px]">Division / Dept</span>
                    <span className="text-foreground font-semibold truncate block">
                      {getDivisionName(item.division_id)} / {getDepartmentName(item.department_id)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border/80 dark:border-zinc-700/70">
                  <span className="text-muted-foreground block text-[10px] font-mono">Chart of Accounts (GL)</span>
                  <span className="text-foreground font-semibold block truncate">
                    {getCoaName(item.coa_id)}
                  </span>
                </div>

                {item.remarks ? (
                  <div className="pt-3 border-t border-border/80 dark:border-zinc-700/70 text-[11px] text-muted-foreground italic bg-muted/40 dark:bg-zinc-950/40 p-2 rounded border border-border/60 dark:border-zinc-700/50">
                    &quot;{item.remarks}&quot;
                  </div>
                ) : null}
              </div>

              {/* Audit History Logs Panel */}
              <div className="bg-card border border-border dark:border-zinc-700/80 dark:bg-zinc-900/80 rounded-xl p-4 flex-1 flex flex-col min-h-0 overflow-hidden text-xs shadow-xs">
                <div className="flex items-center justify-between pb-2.5 border-b border-border dark:border-zinc-700/80 shrink-0">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <History className="w-4 h-4 text-primary" /> Audit History Logs
                  </span>
                  <Badge variant="secondary" className="text-[10px] font-mono border border-border/60 dark:border-zinc-700/80">
                    {logs.length} {logs.length === 1 ? "entry" : "entries"}
                  </Badge>
                </div>

                <div className="flex-1 overflow-y-auto pr-1 pt-3 space-y-3">
                  {loadingLogs ? (
                    <div className="py-8 text-center text-muted-foreground text-xs italic">
                      Loading audit logs...
                    </div>
                  ) : logs.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-xs italic">
                      No audit history entries found.
                    </div>
                  ) : (
                    logs.map((log) => {
                      const userName = log.created_by
                        ? `${log.created_by.user_fname} ${log.created_by.user_lname}`
                        : "System Encoder";

                      return (
                        <div key={log.id} className="relative pl-4 border-l-4 border-primary space-y-1.5 bg-muted/40 dark:bg-zinc-900/90 p-3 rounded-r-xl border border-border/70 dark:border-zinc-700/80 shadow-xs">
                          <div className="absolute -left-[6px] top-3.5 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-card dark:ring-zinc-950" />
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-foreground flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-primary" /> {userName}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {formatDateLog(log.created_at)}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-mono bg-background dark:bg-zinc-950 border border-border dark:border-zinc-700 font-semibold">
                            {log.action}
                          </Badge>
                          {log.remarks ? (
                            <p className="text-[11px] text-muted-foreground italic bg-background/80 dark:bg-zinc-950/80 p-2 rounded-lg border border-border/50 dark:border-zinc-700/70">
                              &quot;{log.remarks}&quot;
                            </p>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <DialogFooter className="border-t border-border/50 pt-3 shrink-0 flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs sm:mr-auto"
            >
              Close
            </Button>

            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => openConfirmation("Reject")}
              className="text-xs bg-rose-500 hover:bg-rose-600 gap-1 font-semibold"
            >
              <XCircle className="w-3.5 h-3.5" /> Reject
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openConfirmation("With Concern")}
              className="text-xs border-amber-500/50 text-amber-600 hover:bg-amber-500/10 gap-1 font-semibold"
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Return to Encoder
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={() => openConfirmation("Approve")}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* FULLSCREEN LIGHTBOX PREVIEW OVERLAY */}
      {isFullscreen && item.receipt_url && (
        <Dialog open={isFullscreen} onOpenChange={(open) => !open && setIsFullscreen(false)}>
          <DialogContent
            showCloseButton={false}
            className="w-[95vw] sm:max-w-[95vw] max-w-none h-[95vh] max-h-[95vh] bg-black/90 border-none text-white p-4 flex flex-col justify-between z-[300]"
          >
            <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-white/20 text-xs">
              <DialogTitle className="text-xs font-bold text-white">
                Receipt Lightbox - {item.doc_no}
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFullscreen(false)}
                className="h-8 text-xs bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                Close Lightbox
              </Button>
            </DialogHeader>

            <div className="flex-1 flex items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.receipt_url}
                alt="Full Receipt Attachment"
                className="max-h-[85vh] max-w-[90vw] object-contain rounded shadow-2xl"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ACTION CONFIRMATION MODAL */}
      <Dialog open={!!activeConfirmAction} onOpenChange={(open) => !open && closeConfirmation()}>
        <DialogContent showCloseButton={false} className="sm:max-w-md bg-card border-border/80 text-foreground z-[250]">
          <DialogHeader>
            {activeConfirmAction === "Approve" && (
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5 shrink-0" /> Approve Receipt
              </DialogTitle>
            )}
            {activeConfirmAction === "With Concern" && (
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-600">
                <AlertTriangle className="w-5 h-5 shrink-0" /> Return to Encoder
              </DialogTitle>
            )}
            {activeConfirmAction === "Reject" && (
              <DialogTitle className="text-base font-bold flex items-center gap-2 text-rose-600">
                <XCircle className="w-5 h-5 shrink-0" /> Reject Receipt
              </DialogTitle>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Confirmation Plain English Message */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border/40 space-y-1">
              <p className="text-xs text-foreground font-medium">
                {activeConfirmAction === "Approve" && (
                  <>Are you sure you want to approve receipt <span className="font-mono font-bold text-primary">{item.doc_no}</span> with an amount of <span className="font-mono font-bold text-emerald-600">{formatCurrency(Number(item.amount))}</span>?</>
                )}
                {activeConfirmAction === "With Concern" && (
                  <>Are you sure you want to return receipt <span className="font-mono font-bold text-primary">{item.doc_no}</span> to the encoder for revision?</>
                )}
                {activeConfirmAction === "Reject" && (
                  <>Are you sure you want to reject receipt <span className="font-mono font-bold text-primary">{item.doc_no}</span>?</>
                )}
              </p>
            </div>

            {/* Optional Feedback Note */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {activeConfirmAction === "Approve" && "Notes / Remarks (Optional)"}
                {activeConfirmAction === "With Concern" && "Reason for returning (Optional)"}
                {activeConfirmAction === "Reject" && "Reason for rejection (Optional)"}
              </Label>
              <Textarea
                placeholder={
                  activeConfirmAction === "Approve"
                    ? "Add an optional note..."
                    : activeConfirmAction === "With Concern"
                    ? "Specify what needs to be revised by the encoder..."
                    : "Specify reason for rejecting this receipt..."
                }
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                className="bg-background/60 border-border/60 text-xs min-h-[70px]"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSubmitting}
              onClick={closeConfirmation}
              className="text-xs"
            >
              Cancel
            </Button>

            {activeConfirmAction === "Approve" && (
              <Button
                type="button"
                size="sm"
                disabled={isSubmitting}
                onClick={handleExecuteFinalAction}
                className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
              >
                {isSubmitting ? "Approving..." : "Yes, Approve"}
              </Button>
            )}

            {activeConfirmAction === "With Concern" && (
              <Button
                type="button"
                size="sm"
                disabled={isSubmitting}
                onClick={handleExecuteFinalAction}
                className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold gap-1"
              >
                {isSubmitting ? "Returning..." : "Yes, Return"}
              </Button>
            )}

            {activeConfirmAction === "Reject" && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isSubmitting}
                onClick={handleExecuteFinalAction}
                className="text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold gap-1"
              >
                {isSubmitting ? "Rejecting..." : "Yes, Reject"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
