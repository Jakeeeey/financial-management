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
  Loader2,
  ListChecks,
  ZoomIn,
  ZoomOut,
  RotateCw,
  RefreshCw,
  Maximize2,
  ImageOff,
  History,
  User,
  X,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

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

interface BulkApprovalActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedItems: ExpenseItem[];
  suppliers: SupplierOption[];
  coas: ChartOfAccountOption[];
  divisions?: DivisionInfo[];
  departments?: DepartmentOption[];
  onConfirmAction: (payload: {
    expense_id?: number;
    expense_ids?: number[];
    action: "Approve" | "With Concern" | "Reject";
    remarks?: string;
    created_at: string;
  }) => Promise<void>;
  onSuccess: (succeededIds?: number[]) => void;
}

export const BulkApprovalActionModal: React.FC<BulkApprovalActionModalProps> = ({
  isOpen,
  onClose,
  selectedItems,
  suppliers,
  coas,
  divisions = [],
  departments = [],
  onConfirmAction,
  onSuccess,
}) => {
  const [activeItemId, setActiveItemId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"Approve" | "With Concern" | "Reject" | null>(null);
  const [remarks, setRemarks] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Active item image viewer state
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [panPosition, setPanPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Active item audit logs state
  const [logs, setLogs] = useState<ExpenseLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Set default active item when selectedItems change or modal opens
  useEffect(() => {
    if (selectedItems.length > 0 && (!activeItemId || !selectedItems.some((i) => i.id === activeItemId))) {
      setActiveItemId(selectedItems[0].id);
    }
  }, [selectedItems, activeItemId]);

  const activeItem = selectedItems.find((i) => i.id === activeItemId) || selectedItems[0] || null;

  // Fetch logs when activeItem changes
  useEffect(() => {
    if (activeItem && isOpen) {
      setLoadingLogs(true);
      fetch(`/api/fm/treasury/expenses-v2/expense-approval-v2/logs?expense_id=${activeItem.id}`)
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then((json) => {
          setLogs(Array.isArray(json.data) ? json.data : []);
        })
        .catch(() => {
          setLogs([]);
        })
        .finally(() => {
          setLoadingLogs(false);
        });
    } else {
      setLogs([]);
    }
  }, [activeItem, isOpen]);

  // Reset state when modal opens or active item changes
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      setRotation(0);
      setPanPosition({ x: 0, y: 0 });
    } else {
      setActionType(null);
      setRemarks("");
      setIsProcessing(false);
    }
  }, [isOpen, activeItem]);

  if (!isOpen || selectedItems.length === 0) return null;

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

  const formatDisplayDate = (dateStr?: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const year = parts[0];
      const monthIdx = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
      const monthName = months[monthIdx] || parts[1];
      return `${monthName} ${day}, ${year}`;
    }
    return dateStr;
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
  };

  const totalAmount = selectedItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

  // Image controls & Pointer Event Pan Drag Handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 0.25, 3.5));
  const handleZoomOut = () => {
    setZoomLevel((prev) => {
      const next = Math.max(prev - 0.25, 0.5);
      if (next <= 1) setPanPosition({ x: 0, y: 0 });
      return next;
    });
  };
  const handleRotate = () => setRotation((prev) => (prev + 90) % 360);
  const handleResetImage = () => {
    setZoomLevel(1);
    setRotation(0);
    setPanPosition({ x: 0, y: 0 });
  };

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

    // Boundary math adjusted for zoom level and rotation angles
    const isRotated90or270 = rotation === 90 || rotation === 270;
    const baseOffset = isRotated90or270 ? 300 : 250;
    const maxOffset = Math.max(baseOffset, Math.max(1, zoomLevel - 1) * 450);

    const clampedX = Math.max(-maxOffset, Math.min(maxOffset, rawX));
    const clampedY = Math.max(-maxOffset, Math.min(maxOffset, rawY));

    setPanPosition({ x: clampedX, y: clampedY });
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore capture release errors
      }
      setIsDragging(false);
    }
  };

  // Single batch execution call (Shared Disbursement Header)
  const handleExecuteBatch = async () => {
    if (!actionType || isProcessing) return;

    if ((actionType === "With Concern" || actionType === "Reject") && !remarks.trim()) {
      toast.error(
        actionType === "With Concern"
          ? "Feedback note is required when returning expenses with concern."
          : "Reason is required when rejecting expenses."
      );
      return;
    }

    try {
      setIsProcessing(true);
      const timestamp = new Date().toISOString();
      const allItemIds = selectedItems.map((item) => item.id);

      await onConfirmAction({
        expense_ids: allItemIds,
        action: actionType,
        remarks: remarks.trim() || undefined,
        created_at: timestamp,
      });

      toast.success(
        actionType === "Approve"
          ? `Successfully approved ${allItemIds.length} expense receipt(s)!`
          : actionType === "With Concern"
          ? `Successfully returned ${allItemIds.length} expense receipt(s) with concern!`
          : `Successfully rejected ${allItemIds.length} expense receipt(s)!`
      );

      onSuccess(allItemIds);
      setActionType(null);
      setRemarks("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to execute batch approval action.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <DialogContent className="max-w-[98vw] sm:max-w-[96vw] max-h-[96vh] h-[96vh] border-border bg-card p-0 flex flex-col overflow-hidden">
        {/* Compact Header */}
        <DialogHeader className="px-4 py-2.5 border-b border-border/80 flex items-center justify-between shrink-0 bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <ListChecks className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold flex items-center gap-2">
                Batch Expense Review
                <Badge variant="secondary" className="font-mono text-[11px] px-1.5 py-0">
                  {selectedItems.length} Selected
                </Badge>
              </DialogTitle>
            </div>
          </div>

          <div className="flex items-center gap-3 pr-6">
            <span className="text-xs font-mono font-bold text-emerald-500">
              Total Amount: {formatCurrency(totalAmount)}
            </span>
          </div>
        </DialogHeader>

        {/* Workspace Body - 2 Columns Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden min-h-0">
          {/* LEFT SIDEBAR: Selected Item List & Batch Action Form (3.5 cols - ~30%) */}
          <div className="lg:col-span-4 xl:col-span-3 border-r border-border/80 p-3 flex flex-col h-full bg-muted/20 min-h-0 overflow-hidden">
            <div className="flex flex-col flex-1 min-h-0 space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                <span>Selected Receipts ({selectedItems.length})</span>
                <span className="text-[10px] text-primary font-normal">Click to inspect</span>
              </div>

              {/* Scrollable Receipt Cards Container */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0">
                {selectedItems.map((item) => {
                  const isSelected = activeItem?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setActiveItemId(item.id)}
                      className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col gap-1 ${
                        isSelected
                          ? "bg-primary/15 border-2 border-primary shadow-xs"
                          : "bg-card dark:bg-zinc-900/80 border-slate-300 dark:border-zinc-700 shadow-2xs hover:border-primary/60 hover:shadow-xs hover:bg-muted/50"
                      }`}
                    >
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
                        <span className="font-mono font-medium shrink-0">{formatDisplayDate(item.expense_date)}</span>
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
                  );
                })}
              </div>
            </div>

            {/* Batch Action Decision Panel */}
            <div className="border-t border-border/80 pt-3 space-y-2.5 shrink-0 mt-2">
              <Label className="text-xs font-bold text-foreground">Select Batch Action</Label>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActionType("Approve")}
                  className={`h-10 text-xs font-bold flex-col gap-0 border shadow-2xs transition-all px-1 ${
                    actionType === "Approve"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500 ring-2 ring-emerald-500/30"
                      : "bg-card dark:bg-zinc-900/80 border-slate-300 dark:border-zinc-700 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/50"
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px]">Approve All</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActionType("With Concern")}
                  className={`h-10 text-xs font-bold flex-col gap-0 border shadow-2xs transition-all px-1 ${
                    actionType === "With Concern"
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
                  onClick={() => setActionType("Reject")}
                  className={`h-10 text-xs font-bold flex-col gap-0 border shadow-2xs transition-all px-1 ${
                    actionType === "Reject"
                      ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500 ring-2 ring-red-500/30"
                      : "bg-card dark:bg-zinc-900/80 border-slate-300 dark:border-zinc-700 hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/50"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-[10px]">Reject All</span>
                </Button>
              </div>

              {actionType && (
                <div className="space-y-1 pt-1 animate-in fade-in duration-200">
                  <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>
                      {actionType === "Approve"
                        ? "Optional Approval Remarks"
                        : actionType === "With Concern"
                        ? "Feedback / Concern Note"
                        : "Rejection Reason"}
                    </span>
                    {(actionType === "With Concern" || actionType === "Reject") && (
                      <Badge variant="destructive" className="text-[9px] py-0 px-1.5">
                        Required
                      </Badge>
                    )}
                  </Label>
                  <Textarea
                    placeholder={
                      actionType === "Approve"
                        ? "Add optional batch approval notes for audit trail..."
                        : actionType === "With Concern"
                        ? "Specify feedback or reason for returning these receipts..."
                        : "Specify clear reason for rejecting these expense receipts..."
                    }
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="text-xs min-h-[65px] max-h-[85px] bg-background"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={isProcessing}
                  className="w-1/3 text-xs font-semibold h-8 border-slate-300 dark:border-zinc-700 bg-card dark:bg-zinc-900/80"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!actionType || isProcessing}
                  onClick={handleExecuteBatch}
                  className={`w-2/3 text-xs font-semibold text-white h-8 ${
                    actionType === "Approve"
                      ? "bg-emerald-600 hover:bg-emerald-700"
                      : actionType === "With Concern"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-red-600 hover:bg-red-700"
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Executing Batch...
                    </>
                  ) : actionType === "Approve" ? (
                    `Confirm Approve (${selectedItems.length})`
                  ) : actionType === "With Concern" ? (
                    `Confirm Return (${selectedItems.length})`
                  ) : actionType === "Reject" ? (
                    `Confirm Reject (${selectedItems.length})`
                  ) : (
                    "Select Action"
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* RIGHT DETAIL INSPECTOR: Active Item Photo + Audit Logs (8.5 cols - ~70%) */}
          <div className="lg:col-span-8 xl:col-span-9 p-3 flex flex-col space-y-2 overflow-hidden bg-background h-full min-h-0">
            {activeItem ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 h-full min-h-0">
                {/* Photo Viewer (7 cols) */}
                <div className="md:col-span-7 flex flex-col border border-slate-300 dark:border-zinc-700 rounded-xl overflow-hidden bg-muted/20 h-full min-h-0">
                  <div className="p-2 border-b border-slate-300 dark:border-zinc-700 bg-card flex items-center justify-between text-xs font-semibold shrink-0">
                    <span className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-primary" /> Receipt Attachment
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleZoomIn}
                        className="h-7 w-7"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleZoomOut}
                        className="h-7 w-7"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleRotate}
                        className="h-7 w-7"
                        title="Rotate"
                      >
                        <RotateCw className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleResetImage}
                        className="h-7 w-7"
                        title="Reset"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsFullscreen(!isFullscreen)}
                        className="h-7 w-7"
                        title="Fullscreen"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </Button>
                    </div>
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
                    {activeItem.receipt_url ? (
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
                          src={activeItem.receipt_url}
                          alt={`Receipt for ${activeItem.doc_no}`}
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

                {/* Audit History Logs (5 cols) */}
                <div className="md:col-span-5 flex flex-col border border-slate-300 dark:border-zinc-700 rounded-xl overflow-hidden bg-card h-full min-h-0">
                  <div className="p-2 border-b border-slate-300 dark:border-zinc-700 bg-muted/40 flex items-center justify-between text-xs font-semibold shrink-0">
                    <span className="flex items-center gap-1.5">
                      <History className="w-4 h-4 text-primary" /> Audit History Logs
                    </span>
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {logs.length} entries
                    </Badge>
                  </div>

                  <div className="flex-1 p-3 overflow-y-auto min-h-0 space-y-2.5 text-xs">
                    {loadingLogs ? (
                      <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
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
                                {new Date(log.created_at).toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            <div className="font-bold text-xs flex items-center justify-between">
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
              </div>
            ) : null}
          </div>
        </div>

        {/* Fullscreen Image Overlay */}
        {isFullscreen && activeItem?.receipt_url && (
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
              src={activeItem.receipt_url}
              alt={`Fullscreen receipt ${activeItem.doc_no}`}
              className="max-h-[92vh] max-w-[92vw] object-contain"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
