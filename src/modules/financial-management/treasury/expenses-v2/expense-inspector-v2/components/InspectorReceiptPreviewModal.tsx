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
  ExpenseItem,
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
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  RefreshCw,
  ImageOff,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface InspectorReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ExpenseItem | null;
  suppliers: SupplierOption[];
  coas: ChartOfAccountOption[];
  divisions: DivisionInfo[];
  departments: DepartmentOption[];
}

export const InspectorReceiptPreviewModal: React.FC<InspectorReceiptPreviewModalProps> = ({
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
          `/api/fm/treasury/expenses-v2/expense-inspector-v2/logs?expense_id=${item.id}`
        );
        if (res.ok) {
          const json = await res.json();
          setLogs(json.data || []);
        }
      } catch (e) {
        console.error("Error fetching expense logs in Inspector:", e);
      } finally {
        setLoadingLogs(false);
      }
    };

    fetchLogs();
  }, [item?.id, isOpen]);

  if (!isOpen || !item) return null;

  const supplier = suppliers.find((s) => s.id === item.payee);
  const coa = coas.find((c) => c.coa_id === item.coa_id);
  const division = divisions.find((d) => d.division_id === item.division_id);
  const department = departments.find((d) => d.department_id === item.department_id);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(val || 0);
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
      const monthName = months[month] || "";
      return `${monthName} ${day}, ${year}`;
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
    } catch {}
    setIsDragging(true);
    setDragStart({ x: e.clientX - panPosition.x, y: e.clientY - panPosition.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    e.stopPropagation();

    const rawX = e.clientX - dragStart.x;
    const rawY = e.clientY - dragStart.y;

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
      } catch {}
      setIsDragging(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Submitted To Disbursement":
        return <Badge className="bg-emerald-600 text-white font-semibold">Approved</Badge>;
      case "Pending Approval":
        return <Badge className="bg-blue-600 text-white font-semibold">Pending</Badge>;
      case "With Concern":
        return <Badge className="bg-amber-600 text-white font-semibold">With Concern</Badge>;
      case "Rejected":
        return <Badge className="bg-rose-600 text-white font-semibold">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[96vw] lg:max-w-6xl max-h-[92vh] h-[92vh] p-0 flex flex-col overflow-hidden bg-card border-border">
        {/* Compact Header */}
        <DialogHeader className="px-5 py-3 border-b border-border bg-muted/40 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Receipt Inspector</span>
                <span className="font-mono text-primary text-sm font-semibold">
                  {item.doc_no}
                </span>
                {getStatusBadge(item.status)}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inspect high-resolution receipt attachment, accounting tags, and complete audit history.
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Modal Body: 2-Column Responsive Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-0 overflow-hidden">
          {/* LEFT COLUMN: RECEIPT VIEWER (7 cols) */}
          <div className="lg:col-span-7 flex flex-col h-full bg-zinc-950 min-h-0 relative select-none border-r border-border">
            {/* Viewer Controls */}
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 bg-black/60 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-white/10 shadow-lg">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleZoomIn}
                className="h-7 w-7 text-white hover:bg-white/20 cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleZoomOut}
                className="h-7 w-7 text-white hover:bg-white/20 cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleRotate}
                className="h-7 w-7 text-white hover:bg-white/20 cursor-pointer"
                title="Rotate 90°"
              >
                <RotateCw className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleResetImage}
                className="h-7 w-7 text-white hover:bg-white/20 cursor-pointer"
                title="Reset View"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <div className="w-[1px] h-4 bg-white/20 mx-1" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsFullscreen(true)}
                className="h-7 w-7 text-white hover:bg-white/20 cursor-pointer"
                title="Fullscreen Lightbox"
              >
                <Maximize2 className="w-4 h-4" />
              </Button>
            </div>

            {/* Interactive Image Container */}
            <div
              className={`flex-1 w-full h-full flex items-center justify-center overflow-hidden touch-none relative ${
                zoomLevel > 1 ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
              }`}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUpOrCancel}
              onPointerCancel={handlePointerUpOrCancel}
            >
              {item.receipt_url ? (
                <div
                  style={{
                    transform: `translate(${panPosition.x}px, ${panPosition.y}px) scale(${zoomLevel}) rotate(${rotation}deg)`,
                    transition: isDragging ? "none" : "transform 0.15s ease-out",
                    transformOrigin: "center center",
                  }}
                  className="max-w-[90%] max-h-[90%] flex items-center justify-center"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getAssetUrl(item.receipt_url)}
                    alt={`Receipt ${item.doc_no}`}
                    draggable={false}
                    className="max-w-full max-h-[80vh] object-contain rounded shadow-2xl pointer-events-none"
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 text-zinc-500 text-sm">
                  <ImageOff className="w-10 h-10" />
                  <span>No receipt attachment uploaded.</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: DETAILS & AUDIT TIMELINE (5 cols) */}
          <div className="lg:col-span-5 flex flex-col h-full bg-card min-h-0 overflow-y-auto p-5 space-y-5">
            {/* Amount Banner */}
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Total Expense Amount
                </span>
                <span className="text-2xl font-black font-mono text-primary">
                  {formatCurrency(Number(item.amount || 0))}
                </span>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-semibold px-2.5 py-1">
                {formatDisplayDate(item.expense_date)}
              </Badge>
            </div>

            {/* Information Grid */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Receipt Information
              </h4>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/80">
                  <span className="text-[10px] text-muted-foreground block">Payee</span>
                  <span className="font-semibold text-foreground truncate block">
                    {supplier?.supplier_name || `Supplier #${item.payee}`}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/80">
                  <span className="text-[10px] text-muted-foreground block">COA (Account)</span>
                  <span className="font-semibold text-foreground truncate block" title={coa?.account_title}>
                    {coa ? `${coa.gl_code || ""} ${coa.account_title}` : `COA #${item.coa_id}`}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/80">
                  <span className="text-[10px] text-muted-foreground block">Division</span>
                  <span className="font-semibold text-foreground truncate block">
                    {division?.division_name || "-"}
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-muted/40 border border-border/80">
                  <span className="text-[10px] text-muted-foreground block">Department</span>
                  <span className="font-semibold text-foreground truncate block">
                    {department?.department_name || "-"}
                  </span>
                </div>

                <div className="col-span-2 p-2.5 rounded-lg bg-muted/40 border border-border/80">
                  <span className="text-[10px] text-muted-foreground block">Encoded By</span>
                  <span className="font-semibold text-foreground truncate block">
                    {typeof item.created_by === "object" && item.created_by !== null
                      ? `${item.created_by.user_fname} ${item.created_by.user_lname}`
                      : "System"}
                  </span>
                </div>

                {item.remarks && (
                  <div className="col-span-2 p-2.5 rounded-lg bg-muted/40 border border-border/80">
                    <span className="text-[10px] text-muted-foreground block">Encoder Remarks</span>
                    <span className="text-xs text-foreground italic block">
                      &ldquo;{item.remarks}&rdquo;
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Audit History Timeline */}
            <div className="space-y-3 pt-2 border-t border-border/80 flex-1">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <History className="w-3.5 h-3.5" /> Audit History Logs
              </h4>

              {loadingLogs ? (
                <div className="p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Loading audit logs...
                </div>
              ) : logs.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted-foreground bg-muted/20 rounded-xl border border-border/60">
                  No previous audit actions recorded.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {logs.map((log) => {
                    const isConcern = log.action === "With Concern";
                    const isApproved = log.action === "Approved";
                    const isRejected = log.action === "Rejected";

                    return (
                      <div
                        key={log.id}
                        className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                          isConcern
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                            : isApproved
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                            : isRejected
                            ? "bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200"
                            : "bg-muted/40 border-border/80 text-foreground"
                        }`}
                      >
                        <div className="flex items-center justify-between font-bold text-[11px]">
                          <span className="flex items-center gap-1.5">
                            {isConcern ? (
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                            ) : isApproved ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {log.action}
                          </span>
                          <span className="font-mono text-[10px] text-muted-foreground font-normal">
                            {formatDateLog(log.created_at)}
                          </span>
                        </div>
                        {log.remarks && (
                          <p className="text-[11px] italic mt-0.5">
                            &ldquo;{log.remarks}&rdquo;
                          </p>
                        )}
                        {log.created_by && typeof log.created_by === "object" && (
                          <div className="text-[10px] text-muted-foreground/80 flex items-center gap-1 pt-0.5">
                            <User className="w-2.5 h-2.5" />
                            <span>
                              {log.created_by.user_fname} {log.created_by.user_lname}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fullscreen Image Overlay */}
        {isFullscreen && item.receipt_url && (
          <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-4 right-4 text-white hover:bg-zinc-800 cursor-pointer"
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
      </DialogContent>
    </Dialog>
  );
};
