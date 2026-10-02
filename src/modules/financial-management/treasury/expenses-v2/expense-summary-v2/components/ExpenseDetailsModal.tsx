"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ExpenseSummaryItem,
  ExpenseLogEntry,
  SupplierOption,
  ChartOfAccountOption,
  DivisionInfo,
  DepartmentOption,
} from "../types";
import { getAssetUrl } from "../../utils/assetUrl";
import {
  FileText,
  User,
  History,
  ShieldCheck,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  RefreshCw,
  ImageOff,
  X,
  Building2,
  Calendar,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface ExpenseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ExpenseSummaryItem | null;
  suppliers: SupplierOption[];
  coas: ChartOfAccountOption[];
  divisions: DivisionInfo[];
  departments: DepartmentOption[];
}

export const ExpenseDetailsModal: React.FC<ExpenseDetailsModalProps> = ({
  isOpen,
  onClose,
  item,
  suppliers,
  coas,
  divisions,
  departments,
}) => {
  const [logs, setLogs] = useState<ExpenseLogEntry[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Image viewer state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!item?.id || !isOpen) {
      setLogs([]);
      setZoomLevel(1);
      setRotation(0);
      setPanPosition({ x: 0, y: 0 });
      setIsFullscreen(false);
      return;
    }

    setZoomLevel(1);
    setRotation(0);
    setPanPosition({ x: 0, y: 0 });
    setIsFullscreen(false);

    const fetchLogs = async () => {
      try {
        setLoadingLogs(true);
        const res = await fetch(
          `/api/fm/treasury/expenses-v2/expense-summary-v2/logs?expense_id=${item.id}`
        );
        if (res.ok) {
          const json = await res.json();
          setLogs(json.data || []);
        }
      } catch (e) {
        console.error("Error fetching expense logs timeline:", e);
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchLogs();
  }, [item?.id, isOpen]);

  if (!item) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
  };

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

  const formatDisplayDate = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, yearStr, monthStr, dayStr] = match;
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10) - 1;
      const day = parseInt(dayStr, 10);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${months[month]} ${day}, ${year}`;
    }
    return dateStr;
  };

  const formatDateLog = (dateStr?: string | null) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
      // ignore
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
        // ignore
      }
      setIsDragging(false);
    }
  };

  const userObj =
    typeof item.created_by === "object" && item.created_by !== null
      ? item.created_by
      : null;
  const encoderName = userObj
    ? `${userObj.user_fname} ${userObj.user_lname}`
    : `Encoder #${item.created_by || "-"}`;

  const isApproved = item.status === "Submitted To Disbursement" || !!item.is_final_approved;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          showCloseButton={false}
          className="max-w-[98vw] sm:max-w-[96vw] max-h-[96vh] h-[96vh] border-border bg-card p-0 flex flex-col overflow-hidden text-foreground shadow-2xl"
        >
          {/* Header matching Expense Approval modal */}
          <DialogHeader className="px-4 py-2.5 border-b border-border/80 flex flex-row items-center justify-between shrink-0 bg-muted/40 space-y-0">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <FileText className="w-4 h-4" />
              </div>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                Expense Details & Audit Trail
                <Badge variant="secondary" className="font-mono text-[11px] px-1.5 py-0 border border-border/60">
                  {item.doc_no}
                </Badge>
                {isApproved ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Approved
                  </Badge>
                ) : item.status === "Pending Approval" ? (
                  <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Pending Review
                  </Badge>
                ) : item.status === "With Concern" ? (
                  <Badge variant="outline" className="bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 text-[10px] font-mono font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> With Concern
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {item.status}
                  </Badge>
                )}
              </DialogTitle>
            </div>

            <div className="flex items-center gap-4 pr-1">
              <span className="text-sm font-mono font-bold text-emerald-500">
                Amount: {formatCurrency(Number(item.amount))}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-7 w-7 text-muted-foreground hover:text-foreground rounded-lg"
                title="Close Modal"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </DialogHeader>

          {/* 3-Pane Inspection Workspace Body */}
          <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">

            {/* PANE 1: LEFT SIDEBAR - EXPENSE BREAKDOWN & METADATA (3 Cols - 25%) */}
            <div className="lg:col-span-4 xl:col-span-3 border-r border-border/80 p-3.5 flex flex-col h-full bg-muted/20 min-h-0 overflow-y-auto space-y-3">
              {/* Section Header */}
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                <span>Receipt Breakdown</span>
                <span className="text-[10px] text-primary font-mono font-bold">VOS-FM</span>
              </div>

              {/* Highlighted Master Info Card */}
              <div className="p-3 rounded-xl border-2 border-primary/40 bg-card dark:bg-zinc-900/90 shadow-xs flex flex-col gap-2.5 text-xs">
                <div className="flex items-center justify-between gap-1 border-b border-border/60 pb-2">
                  <span className="font-mono font-bold text-primary text-xs">{item.doc_no}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                    {formatCurrency(Number(item.amount || 0))}
                  </span>
                </div>

                {/* Payee / Supplier */}
                <div>
                  <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider">
                    Payee / Supplier
                  </span>
                  <div className="text-xs text-foreground font-bold mt-0.5 flex items-center gap-1">
                    <CreditCard className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="truncate">{getSupplierName(item.payee)}</span>
                    {item.is_employee ? (
                      <span className="text-[10px] text-muted-foreground font-normal shrink-0">(Employee)</span>
                    ) : null}
                  </div>
                </div>

                {/* Chart of Accounts */}
                <div className="pt-2 border-t border-border/40">
                  <span className="text-[10px] text-muted-foreground block font-medium uppercase tracking-wider">
                    Chart of Accounts (COA)
                  </span>
                  <div className="text-[11px] font-semibold text-foreground mt-0.5 truncate" title={getCoaName(item.coa_id)}>
                    {getCoaName(item.coa_id)}
                  </div>
                </div>

                {/* Expense Date & Division */}
                <div className="pt-2 border-t border-border/40 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-[10px] text-muted-foreground block font-medium">Expense Date</span>
                    <span className="font-mono font-medium text-foreground flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-muted-foreground" /> {formatDisplayDate(item.expense_date)}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-muted-foreground block font-medium">Division</span>
                    <span className="font-medium text-foreground flex items-center gap-1 mt-0.5 truncate">
                      <Building2 className="w-3 h-3 text-muted-foreground shrink-0" /> {getDivisionName(item.division_id)}
                    </span>
                  </div>
                </div>

                {/* Department */}
                <div className="pt-2 border-t border-border/40 text-[11px]">
                  <span className="text-[10px] text-muted-foreground block font-medium">Department</span>
                  <span className="font-medium text-foreground mt-0.5 block truncate">
                    {getDepartmentName(item.department_id)}
                  </span>
                </div>

                {/* Remarks / Purpose */}
                {item.remarks && (
                  <div className="pt-2 border-t border-border/40 text-[11px]">
                    <span className="text-[10px] text-muted-foreground block font-medium">Remarks / Purpose</span>
                    <div className="text-[11px] text-muted-foreground bg-muted/50 p-2 rounded-lg border border-border/50 italic mt-1 whitespace-pre-wrap">
                      &ldquo;{item.remarks}&rdquo;
                    </div>
                  </div>
                )}
              </div>

              {/* Submitter Encoder Identity Card */}
              <div className="bg-card border border-border/80 dark:border-zinc-700/80 p-3 rounded-xl shadow-2xs space-y-1.5 text-xs">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Encoder & Submission
                </span>
                <div className="flex items-center gap-2 pt-0.5">
                  <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-foreground truncate">{encoderName}</div>
                    {userObj?.user_email && (
                      <div className="text-[10px] text-muted-foreground truncate">{userObj.user_email}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Disbursement Handoff Box (When Approved) */}
              {(item.disbursement_id || item.disbursement_payable_id || isApproved) && (
                <div className="bg-emerald-500/10 border border-emerald-500/30 p-3 rounded-xl text-xs space-y-1.5">
                  <div className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 text-[11px]">
                    <ShieldCheck className="w-4 h-4" /> Final Approved Handoff
                  </div>
                  <div className="text-[11px] text-muted-foreground space-y-0.5 font-mono">
                    <div>Disbursement ID: <strong className="text-foreground">{item.disbursement_id || "-"}</strong></div>
                    <div>Payable ID: <strong className="text-foreground">{item.disbursement_payable_id || "-"}</strong></div>
                  </div>
                </div>
              )}
            </div>

            {/* PANE 2 & 3: CENTER PHOTO VIEWER & RIGHT AUDIT LOGS (9 Cols - 75%) */}
            <div className="lg:col-span-8 xl:col-span-9 p-3 flex flex-col overflow-hidden bg-background h-full min-h-0">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 h-full min-h-0">

                {/* CENTER: PHOTO VIEWER (7 Cols) */}
                <div className="md:col-span-7 flex flex-col border border-slate-300 dark:border-zinc-700 rounded-xl overflow-hidden bg-muted/20 h-full min-h-0">
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
                        <Button type="button" variant="ghost" size="icon" onClick={handleResetImage} className="h-7 w-7" title="Reset View">
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

                {/* RIGHT: AUDIT TIMELINE & ACTION LOGS (5 Cols) */}
                <div className="md:col-span-5 flex flex-col border border-slate-300 dark:border-zinc-700 rounded-xl overflow-hidden bg-card h-full min-h-0">
                  <div className="p-2 border-b border-slate-300 dark:border-zinc-700 bg-muted/40 flex items-center justify-between text-xs font-semibold shrink-0">
                    <span className="flex items-center gap-1.5">
                      <History className="w-4 h-4 text-primary" /> Approval Timeline & Audit Trail
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
                          log.action === "Approved" || log.action === "Final Approved" || log.action === "Submitted To Disbursement"
                            ? "border-l-emerald-500 text-emerald-600 dark:text-emerald-400"
                            : log.action === "With Concern"
                            ? "border-l-amber-500 text-amber-600 dark:text-amber-400"
                            : log.action === "Rejected"
                            ? "border-l-red-500 text-red-600 dark:text-red-400"
                            : "border-l-primary text-primary";

                        const logUser =
                          typeof log.created_by === "object" && log.created_by !== null
                            ? `${log.created_by.user_fname} ${log.created_by.user_lname}`
                            : `User #${log.created_by || "-"}`;

                        return (
                          <div
                            key={log.id}
                            className={`p-2.5 rounded-lg border border-slate-300 dark:border-zinc-700 border-l-4 bg-card dark:bg-zinc-900/80 shadow-2xs space-y-1 ${actionColor}`}
                          >
                            <div className="flex items-center justify-between font-medium text-[11px]">
                              <span className="flex items-center gap-1 text-foreground font-semibold">
                                <User className="w-3 h-3 text-muted-foreground" />
                                {logUser}
                              </span>
                              <span className="text-muted-foreground text-[10px] font-mono">
                                {formatDateLog(log.created_at)}
                              </span>
                            </div>

                            <div className="font-bold text-xs">
                              <span>{log.action}</span>
                            </div>

                            {log.remarks && (
                              <p className="text-[11px] text-muted-foreground bg-background p-1.5 rounded border border-border/40 italic whitespace-pre-wrap">
                                &ldquo;{log.remarks}&rdquo;
                              </p>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
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
