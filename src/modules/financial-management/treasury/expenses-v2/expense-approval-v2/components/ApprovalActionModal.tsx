"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ExpenseItem,
  SupplierOption,
  ChartOfAccountOption,
  DivisionInfo,
  DepartmentOption,
} from "../types";
import { getAssetUrl } from "../../utils/assetUrl";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  RefreshCw,
  ImageOff,
  History,
  User,
  FileText,
  X,
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
    expense_id?: number;
    expense_ids?: number[];
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

  // Reset state when item or open state changes
  useEffect(() => {
    if (item && isOpen) {
      setZoomLevel(1);
      setRotation(0);
      setPanPosition({ x: 0, y: 0 });
      setIsFullscreen(false);
      setActiveConfirmAction(null);
      setFeedbackNote("");
      setErrorMsg(null);
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

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sept","Oct","Nov","Dec"];
      const month = parseInt(parts[1], 10) - 1;
      return `${months[month] || ""} ${parseInt(parts[2], 10)}, ${parts[0]}`;
    }
    return dateStr;
  };

  const formatDateLog = (dateStr?: string | null): string => {
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

    const maxOffset = Math.max(250, Math.max(1, zoomLevel - 1) * 450);
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

  const handleExecuteFinalAction = async () => {
    if (!activeConfirmAction) return;

    // Direct literal PH timestamp format: YYYY-MM-DD HH:mm:ss
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

      if (activeConfirmAction === "Approve") {
        toast.success(`Expense receipt ${item.doc_no} approved successfully!`);
      } else if (activeConfirmAction === "With Concern") {
        toast.warning(`Expense receipt ${item.doc_no} flagged with concern.`);
      } else if (activeConfirmAction === "Reject") {
        toast.error(`Expense receipt ${item.doc_no} rejected.`);
      }

      setActiveConfirmAction(null);
      setFeedbackNote("");
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      const message = err instanceof Error ? err.message : "Failed to process approval action.";
      setErrorMsg(message);
      toast.error(message);
    }
  };

  return (
    <>
      {/* MAIN EXPENSE REVIEW WORKSPACE MODAL */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[98vw] sm:max-w-[96vw] max-h-[96vh] h-[96vh] border-border bg-card p-0 flex flex-col overflow-hidden text-foreground"
        >
          {/* Compact Header matching Bulk Approval Inspection Workspace */}
          <DialogHeader className="px-4 py-2.5 border-b border-border/80 flex flex-row items-center justify-between shrink-0 bg-muted/40 space-y-0">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <FileText className="w-4 h-4" />
              </div>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                Expense Inspection Workspace
                <Badge variant="secondary" className="font-mono text-[11px] px-1.5 py-0">
                  {item.doc_no}
                </Badge>
              </DialogTitle>
            </div>

            <div className="flex items-center gap-3 pr-2">
              <span className="text-xs font-mono font-bold text-emerald-500">
                Total Amount: {formatCurrency(Number(item.amount))}
              </span>
            </div>
          </DialogHeader>

          {/* Workspace Body - 3 Panes: Left=Audit Logs, Center=Photo Viewer, Right=Selected Receipt & Action */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">

            {/* LEFT SIDEBAR: Audit History Logs */}
            <div className="lg:col-span-4 xl:col-span-3 border-r border-border/80 p-3 flex flex-col h-full bg-card min-h-0 overflow-hidden">
              <div className="p-2 border-b border-slate-300 dark:border-zinc-700 bg-muted/40 flex items-center justify-between text-xs font-semibold shrink-0 rounded-t-lg">
                <span className="flex items-center gap-1.5">
                  <History className="w-4 h-4 text-primary" /> Audit History Logs
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {logs.length} {logs.length === 1 ? "entry" : "entries"}
                </Badge>
              </div>

              <div className="flex-1 p-3 overflow-y-auto min-h-0 space-y-2.5 text-xs">
                {loadingLogs ? (
                  <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <History className="w-6 h-6 animate-pulse text-primary" />
                    <span className="text-xs">Loading audit logs...</span>
                  </div>
                ) : logs.length === 0 ? (
                  <div className="py-16 text-center text-muted-foreground text-xs italic">
                    No audit history logs recorded.
                  </div>
                ) : (
                  logs.map((log) => {
                    const actionColor =
                      log.action === "Approved" || log.action === "Final Approved"
                        ? "border-l-emerald-500 text-emerald-600 dark:text-emerald-400"
                        : log.action === "With Concern"
                        ? "border-l-amber-500 text-amber-600 dark:text-amber-400"
                        : log.action === "Rejected"
                        ? "border-l-red-500 text-red-600 dark:text-red-400"
                        : "border-l-primary text-primary";

                    return (
                      <div
                        key={log.id}
                        className={`p-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 border-l-4 bg-card dark:bg-zinc-900/80 shadow-2xs space-y-1 ${actionColor}`}
                      >
                        <div className="flex items-center justify-between font-medium text-[11px]">
                          <span className="flex items-center gap-1 text-foreground font-semibold">
                            <User className="w-3 h-3 text-muted-foreground" />
                            {log.created_by
                              ? `${log.created_by.user_fname} ${log.created_by.user_lname}`
                              : "System Encoder"}
                          </span>
                          <span className="text-muted-foreground text-[10px] font-mono">
                            {formatDateLog(log.created_at)}
                          </span>
                        </div>

                        <div className="font-bold text-xs">
                          <span>{log.action}</span>
                        </div>

                        {log.remarks && (
                          <p className="text-[11px] text-muted-foreground bg-background p-1.5 rounded border border-border/40 italic">
                            &ldquo;{log.remarks}&rdquo;
                          </p>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* CENTER DETAIL INSPECTOR: Receipt Photo */}
            <div className="lg:col-span-4 xl:col-span-6 p-3 flex flex-col overflow-hidden bg-background h-full min-h-0">
              <div className="flex flex-col border border-slate-300 dark:border-zinc-700 rounded-xl overflow-hidden bg-muted/20 h-full min-h-0">
                <div className="p-2 border-b border-slate-300 dark:border-zinc-700 bg-card flex items-center justify-between text-xs font-semibold shrink-0">
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-primary" /> Receipt Attachment
                  </span>
                  {item.receipt_url && (
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="ghost" size="icon" onClick={handleZoomIn} className="h-7 w-7" title="Zoom In">
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={handleZoomOut} className="h-7 w-7" title="Zoom Out">
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={handleRotate} className="h-7 w-7" title="Rotate">
                        <RotateCw className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={handleResetImage} className="h-7 w-7" title="Reset">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setIsFullscreen(true)} className="h-7 w-7" title="Fullscreen">
                        <Maximize2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div
                  className={`flex-1 h-full min-h-0 relative overflow-hidden flex items-center justify-center bg-zinc-950/80 p-2 select-none touch-none ${
                    isDragging ? "cursor-grabbing" : "cursor-grab"
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
                        src={getAssetUrl(item.receipt_url)}
                        alt={`Receipt for ${item.doc_no}`}
                        className="max-h-[75vh] w-auto object-contain rounded-sm shadow-md pointer-events-none select-none"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 text-xs">
                      <ImageOff className="w-8 h-8" />
                      <span>No receipt attachment uploaded.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* RIGHT SIDEBAR: Single Item Info Card + Action Decision Panel */}
            <div className="lg:col-span-4 xl:col-span-3 border-l border-border/80 p-3 flex flex-col h-full bg-muted/20 min-h-0 overflow-hidden">
              <div className="flex flex-col flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">

                {/* Section Label */}
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                  <span>Selected Receipt (1)</span>
                  <span className="text-[10px] text-primary font-normal normal-case">Click to inspect</span>
                </div>

                {/* Single Item Card - always selected/highlighted */}
                <div className="p-2.5 rounded-xl border-2 border-primary bg-primary/15 shadow-xs flex flex-col gap-1 text-xs shrink-0">
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono font-bold text-primary text-xs">{item.doc_no}</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                      {formatCurrency(Number(item.amount || 0))}
                    </span>
                  </div>

                  <div className="text-[11px] text-foreground font-medium truncate">
                    {getSupplierName(item.payee)}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/40 gap-1">
                    <span className="truncate max-w-[150px]" title={getCoaName(item.coa_id)}>
                      {getCoaName(item.coa_id)}
                    </span>
                    <span className="font-mono font-medium shrink-0">
                      {formatDisplayDate(item.expense_date)}
                    </span>
                  </div>

                  {item.remarks && (
                    <div className="text-[10px] text-muted-foreground italic pt-1 border-t border-border/40 truncate">
                      &ldquo;{item.remarks}&rdquo;
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                    <span className="font-medium text-foreground">Div / Dept: </span>
                    {getDivisionName(item.division_id)} / {getDepartmentName(item.department_id)}
                  </div>
                </div>
              </div>

              {/* Action Decision Panel - bottom of sidebar */}
              <div className="border-t border-border/80 pt-3 space-y-2.5 shrink-0 mt-2">
                {/* Error Banner */}
                {errorMsg && (
                  <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 flex items-center gap-2 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <Label className="text-xs font-bold text-foreground">Select Action</Label>
                <div className="grid grid-cols-3 gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openConfirmation("Approve")}
                    className={`h-10 text-xs font-bold flex-col gap-0 border shadow-2xs transition-all px-1 ${
                      activeConfirmAction === "Approve"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500 ring-2 ring-emerald-500/30"
                        : "bg-card dark:bg-zinc-900/80 border-slate-300 dark:border-zinc-700 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/50"
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-[10px]">Approve</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openConfirmation("With Concern")}
                    className={`h-10 text-xs font-bold flex-col gap-0 border shadow-2xs transition-all px-1 ${
                      activeConfirmAction === "With Concern"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500 ring-2 ring-amber-500/30"
                        : "bg-card dark:bg-zinc-900/80 border-slate-300 dark:border-zinc-700 hover:bg-amber-500/10 hover:text-amber-600 hover:border-amber-500/50"
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-[10px]">With Concern</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openConfirmation("Reject")}
                    className={`h-10 text-xs font-bold flex-col gap-0 border shadow-2xs transition-all px-1 ${
                      activeConfirmAction === "Reject"
                        ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500 ring-2 ring-red-500/30"
                        : "bg-card dark:bg-zinc-900/80 border-slate-300 dark:border-zinc-700 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/50"
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[10px]">Reject</span>
                  </Button>
                </div>

                {activeConfirmAction && (
                  <div className="space-y-1 pt-1 animate-in fade-in duration-200">
                    <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                      <span>
                        {activeConfirmAction === "Approve"
                          ? "Optional Approval Remarks"
                          : activeConfirmAction === "With Concern"
                          ? "Feedback / Concern Note"
                          : "Rejection Reason"}
                      </span>
                      {(activeConfirmAction === "With Concern" || activeConfirmAction === "Reject") && (
                        <Badge variant="destructive" className="text-[9px] py-0 px-1.5">
                          Required
                        </Badge>
                      )}
                    </Label>
                    <Textarea
                      placeholder={
                        activeConfirmAction === "Approve"
                          ? "Add optional approval notes for audit trail..."
                          : activeConfirmAction === "With Concern"
                          ? "Specify feedback or reason for returning this receipt..."
                          : "Specify clear reason for rejecting this expense receipt..."
                      }
                      value={feedbackNote}
                      onChange={(e) => setFeedbackNote(e.target.value)}
                      className="text-xs min-h-[65px] max-h-[85px] bg-background border-slate-300 dark:border-zinc-700"
                    />
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="w-1/3 text-xs font-semibold h-8 border-slate-300 dark:border-zinc-700 bg-card dark:bg-zinc-900/80"
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!activeConfirmAction || isSubmitting}
                    onClick={handleExecuteFinalAction}
                    className={`w-2/3 text-xs font-semibold text-white h-8 ${
                      activeConfirmAction === "Approve"
                        ? "bg-emerald-600 hover:bg-emerald-700"
                        : activeConfirmAction === "With Concern"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : activeConfirmAction === "Reject"
                        ? "bg-red-600 hover:bg-red-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {isSubmitting
                      ? "Processing..."
                      : activeConfirmAction === "Approve"
                      ? "Confirm Approve"
                      : activeConfirmAction === "With Concern"
                      ? "Confirm Return"
                      : activeConfirmAction === "Reject"
                      ? "Confirm Reject"
                      : "Select Action"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* FULLSCREEN IMAGE OVERLAY */}
      {isFullscreen && item.receipt_url && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 text-white hover:bg-zinc-800"
          >
            <X className="w-6 h-6" />
          </Button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getAssetUrl(item.receipt_url)}
            alt={`Fullscreen receipt ${item.doc_no}`}
            className="max-h-[92vh] max-w-[92vw] object-contain"
          />
        </div>
      )}
    </>
  );
};
