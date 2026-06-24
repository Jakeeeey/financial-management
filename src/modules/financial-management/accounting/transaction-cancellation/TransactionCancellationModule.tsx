"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Ban, 
  AlertTriangle, 
  FileText, 
  User, 
  Clock, 
  X, 
  ThumbsUp, 
  ThumbsDown, 
  Info, 
  Calendar,
  AlertCircle,
  Shield,
  CheckCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

interface Invoice {
  invoiceId: number;
  invoiceNo: string;
  customerCode: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string;
  netAmount: number;
  paymentStatus: string;
  transactionStatus: string;
  remarks: string | null;
  previousStatus: string;
}

export default function TransactionCancellationModule() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [role, setRole] = useState<string>("USER");
  const [username, setUsername] = useState<string>("User");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "pending">("pending");
  const [pendingCount, setPendingCount] = useState(0);

  // Server-side Pagination States
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);
  const limit = 10;

  // Selection & Dialog States
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmRetrieval, setConfirmRetrieval] = useState(false);

  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // Fetch when tab, search, or page changes
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      fetchInvoices(activeTab, searchQuery, page);
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [activeTab, searchQuery, page]);

  // Reset to page 1 when search or tab changes
  useEffect(() => {
    setPage(1);
  }, [activeTab, searchQuery]);

  const fetchInvoices = async (tab: "active" | "pending", queryStr: string, pageNum: number) => {
    setLoading(true);
    try {
      const url = `/api/fm/accounting/transaction-cancellation?status=${tab}&page=${pageNum}&limit=${limit}${
        queryStr ? `&query=${encodeURIComponent(queryStr)}` : ""
      }`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to retrieve invoices");
      const data = await res.json();
      setInvoices(data.rows || []);
      setTotalPages(data.totalPages || 1);
      setTotalRows(data.totalRows || 0);
      setPendingCount(data.pendingCount || 0);
      setRole(data.role || "USER");
      setUsername(data.username || "User");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Error loading invoices: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Parsing cancellation audit details from remarks
  const parseRequestDetails = (remarks: string | null) => {
    if (!remarks) return { requester: "Unknown", reason: "No reason specified", date: "Unknown" };
    const lines = remarks.split("\n");
    const reqLine = [...lines].reverse().find(line => line.includes("CANCELLATION REQUESTED"));
    if (!reqLine) return { requester: "Unknown", reason: "No reason specified", date: "Unknown" };

    const matchRequester = reqLine.match(/by\s+([^\]]+)/);
    const matchReason = reqLine.match(/Reason:\s*(.*)$/);
    const matchDate = reqLine.match(/\[([^\]\s]+(?:\s+[^\]\s]+)*)/);

    return {
      requester: matchRequester ? matchRequester[1] : "Unknown",
      reason: matchReason ? matchReason[1] : "No reason specified",
      date: matchDate ? matchDate[1].split(" CANCELLATION")[0] : "Unknown"
    };
  };

  const getEligibility = (status: string) => {
    const s = (status || "").trim();
    if (["Completed", "Completed with Returns", "Completed with Concerns", "VOID", "Cancelled", "CANCELLED"].includes(s)) {
      return {
        tier: "blocked" as const,
        label: "Blocked",
        className: "border-slate-200 text-slate-400 bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 cursor-not-allowed",
        reason: "Finalized ledger transaction. Reconcile via memo instead."
      };
    }
    if (["En Route", "Dispatched", "Delivered"].includes(s)) {
      return {
        tier: "risk" as const,
        label: "High Risk",
        className: "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/[0.02]",
        reason: "Stock has left warehouse. Confirm physical retrieval."
      };
    }
    return {
      tier: "safe" as const,
      label: "Safe to Cancel",
      className: "",
      reason: "Safe. Stock is still in warehouse."
    };
  };

  // Actions
  const handleRequestClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setReason("");
    setConfirmRetrieval(false);
    setRequestDialogOpen(true);
  };

  const handleApproveClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setApproveDialogOpen(true);
  };

  const handleRejectClick = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const submitAction = async (action: "request" | "approve" | "reject") => {
    if (!selectedInvoice) return;
    
    const body: Record<string, unknown> = {
      action,
      invoiceId: selectedInvoice.invoiceId
    };

    if (action === "request") {
      if (selectedInvoice && getEligibility(selectedInvoice.transactionStatus).tier === "risk" && !confirmRetrieval) {
        toast.error("Please confirm physical item retrieval before requesting cancellation");
        return;
      }
      if (!reason.trim()) {
        toast.error("Please provide a reason for cancellation");
        return;
      }
      body.reason = reason.trim();
    } else if (action === "reject") {
      if (!rejectReason.trim()) {
        toast.error("Please provide a rejection reason");
        return;
      }
      body.rejectReason = rejectReason.trim();
      body.previousStatus = selectedInvoice.previousStatus;
    }

    setSubmitting(true);
    const toastId = toast.loading("Processing transaction status update...");
    try {
      const res = await fetch("/api/fm/accounting/transaction-cancellation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update transaction status");

      toast.success(
        action === "request" 
          ? "Cancellation request submitted for approval." 
          : action === "approve"
            ? "Invoice cancellation approved successfully."
            : "Cancellation request rejected.", 
        { id: toastId }
      );

      // Close all dialogs
      setRequestDialogOpen(false);
      setApproveDialogOpen(false);
      setRejectDialogOpen(false);
      setSelectedInvoice(null);

      // Refresh
      fetchInvoices(activeTab, searchQuery, page);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(msg, { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const formatPeso = (v: number): string =>
    `₱${v.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (d?: string): string => {
    if (!d) return "—";
    const date = new Date(d);
    return isNaN(date.getTime())
      ? d
      : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  };

  const isAdmin = role === "ADMIN";

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* ── Header Area ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text">
              Transaction Cancellation Manager
            </h1>
            <Badge className={isAdmin ? "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 hover:bg-purple-100 border-none font-bold uppercase tracking-wider" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 hover:bg-blue-100 border-none font-bold uppercase tracking-wider"}>
              <Shield className="h-3 w-3 mr-1 inline" />
              {role}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enforces strict two-step verification for sales document voiding. Requesters file ticket requests; Administrators review and finalize or reject.
          </p>
        </div>
        <div className="text-right text-[10px] text-muted-foreground font-semibold flex items-center gap-2 md:justify-end">
          <Clock className="h-3.5 w-3.5" />
          <span>Logged in as: <strong className="text-foreground">{username}</strong></span>
        </div>
      </div>

      {/* ── Stats Summary Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-card/40 border border-border/60 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Queue Size (Filtered)</span>
          <div className="text-2xl font-black text-foreground mt-1">{totalRows}</div>
          <span className="text-[10px] text-muted-foreground/80 italic">Matching search parameter</span>
        </div>
        <div className="bg-card/40 border border-border/60 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Valuation (Page)</span>
          <div className="text-2xl font-black text-foreground mt-1 tabular-nums">
            {formatPeso(invoices.reduce((sum, item) => sum + item.netAmount, 0))}
          </div>
          <span className="text-[10px] text-muted-foreground/80 italic">Outstanding value of this page</span>
        </div>
        <div className="bg-card/40 border border-border/60 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Active Page</span>
          <div className="text-2xl font-black text-foreground mt-1 tabular-nums">{page} of {totalPages}</div>
          <span className="text-[10px] text-muted-foreground/80 italic">Indexed navigation page</span>
        </div>
        <div className="bg-card/40 border border-border/60 rounded-xl p-4 flex flex-col gap-2 relative overflow-hidden">
          <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Limit Constraint</span>
          <div className="text-2xl font-black text-foreground mt-1 tabular-nums">{limit} per page</div>
          <span className="text-[10px] text-muted-foreground/80 italic">Database search sizing limit</span>
        </div>
      </div>

      {/* ── Tabs bar ── */}
      <div className="flex border-b border-border/40 p-1 gap-1.5 bg-muted/20 w-fit rounded-xl border">
        <Button
          variant="ghost"
          onClick={() => { setActiveTab("pending"); setSearchQuery(""); }}
          className={`h-9 px-6 rounded-lg font-bold text-xs transition-all ${
            activeTab === "pending"
              ? "bg-background text-foreground shadow-sm border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="h-3.5 w-3.5 mr-2 text-amber-500" />
          Pending Approvals Queue
          {pendingCount > 0 && (
            <Badge className="ml-2 bg-amber-500 text-slate-950 font-black h-4 px-1.5 min-w-4 text-[9px] hover:bg-amber-500">
              {pendingCount}
            </Badge>
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={() => { setActiveTab("active"); setSearchQuery(""); }}
          className={`h-9 px-6 rounded-lg font-bold text-xs transition-all ${
            activeTab === "active"
              ? "bg-background text-foreground shadow-sm border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search className="h-3.5 w-3.5 mr-2 text-blue-500" />
          Search Active Invoices
        </Button>
      </div>

      {/* ── Search Bar filter ── */}
      <div className="relative w-full p-4 rounded-xl border border-border/60 bg-card/45 backdrop-blur-md shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === "pending" ? "Filter pending cancellation requests..." : "Find invoice by number or customer name to request cancellation..."}
            className="pl-9 h-10 text-xs focus-visible:ring-1 bg-background border-border/60 rounded-lg w-full"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {activeTab === "active" && (
        <div className="bg-card/25 border border-border/50 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-4 text-[11px] backdrop-blur-sm shadow-sm animate-in fade-in duration-300">
          <div className="flex flex-col gap-0.5">
            <span className="font-bold text-foreground">Cancellation Eligibility Legend</span>
            <p className="text-[10px] text-muted-foreground">Invoices are categorized by logistical risk based on their current shipping status.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3.5">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="font-bold text-foreground">Safe to Cancel:</span>
              <span className="text-muted-foreground font-medium">Draft/Warehouse states.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
              <span className="font-bold text-foreground">High Risk:</span>
              <span className="text-muted-foreground font-medium">In-transit/Delivered. Requires inventory callback confirmation.</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
              <span className="font-bold text-foreground">Blocked:</span>
              <span className="text-muted-foreground font-medium">Completed settlements. Reconcile via credit memo.</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Main Data View ── */}
      <div className="rounded-xl border border-border/60 bg-card/30 backdrop-blur-md shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/60 bg-muted/30 text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
                <th className="p-4">Invoice Details</th>
                <th className="p-4">Customer</th>
                {activeTab === "pending" ? (
                  <th className="p-4">Request Log Details</th>
                ) : (
                  <th className="p-4">Dates</th>
                )}
                <th className="p-4 text-right">Net Value</th>
                <th className="p-4">Payment</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2.5">
                        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                        <span>Synchronizing queue details...</span>
                      </div>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-16 text-center text-xs text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="p-3 bg-muted/40 rounded-full">
                          {activeTab === "pending" ? (
                            <CheckCircle className="h-6 w-6 text-emerald-500 animate-bounce" />
                          ) : (
                            <AlertCircle className="h-6 w-6 text-muted-foreground/60" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold text-foreground">
                            {activeTab === "pending" ? "Approval queue is empty" : "No matching invoices found"}
                          </p>
                          <p className="text-[11px] text-muted-foreground/80 max-w-sm">
                            {activeTab === "pending" 
                              ? "Excellent! All cancellation requests have been processed by administrators." 
                              : "Enter an invoice number or customer name in the search bar above to look up candidates."}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const reqDetails = activeTab === "pending" ? parseRequestDetails(inv.remarks) : null;
                    return (
                      <motion.tr
                        key={inv.invoiceId}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        transition={{ duration: 0.15 }}
                        className="border-b border-border/40 hover:bg-muted/10 transition-colors text-xs"
                      >
                        {/* Invoice Details */}
                        <td className="p-4 font-bold tracking-tight">
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                            <span>{inv.invoiceNo}</span>
                          </div>
                          {activeTab === "pending" ? (
                            <div className="text-[9px] text-muted-foreground/60 font-semibold tracking-wide mt-1 uppercase flex items-center gap-1.5">
                              <Clock className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                              <span>Prev: {inv.previousStatus}</span>
                            </div>
                          ) : (
                            <div className="text-[9px] text-muted-foreground/60 font-semibold tracking-wide mt-1 uppercase flex items-center gap-1.5">
                              <Clock className="h-2.5 w-2.5 text-blue-500 shrink-0" />
                              <span>Status: {inv.transactionStatus || "NULL"}</span>
                            </div>
                          )}
                        </td>

                        {/* Customer details */}
                        <td className="p-4">
                          <div className="space-y-0.5">
                            <div className="font-bold text-foreground/90 leading-tight">{inv.customerName}</div>
                            <div className="text-[10px] text-muted-foreground tracking-wide flex items-center gap-1">
                              <User className="h-2.5 w-2.5 text-muted-foreground/60" />
                              <span>{inv.customerCode}</span>
                            </div>
                          </div>
                        </td>

                        {/* Middle dynamic column */}
                        {activeTab === "pending" && reqDetails ? (
                          <td className="p-4 max-w-[280px]">
                            <div className="p-2.5 rounded-lg bg-amber-500/[0.03] border border-amber-500/10 space-y-1 text-[11px]">
                              <div className="flex items-center gap-1 text-muted-foreground font-semibold">
                                <User className="h-3 w-3 text-amber-500/70" />
                                <span>Requested by: <strong className="text-foreground">{reqDetails.requester}</strong></span>
                              </div>
                              <div className="text-[10px] text-muted-foreground/75 leading-relaxed font-medium pl-4 border-l border-amber-500/20 italic">
                                &quot;{reqDetails.reason}&quot;
                              </div>
                              <div className="text-[9px] text-muted-foreground/60 text-right mt-1 font-semibold flex items-center gap-1 justify-end">
                                <Calendar className="h-2.5 w-2.5" />
                                <span>{reqDetails.date}</span>
                              </div>
                            </div>
                          </td>
                        ) : (
                          <td className="p-4">
                            <div className="space-y-1 text-[11px] text-muted-foreground leading-none">
                              <div>Inv: <span className="font-bold">{formatDate(inv.invoiceDate)}</span></div>
                              <div>Due: <span className="font-bold">{formatDate(inv.dueDate)}</span></div>
                            </div>
                          </td>
                        )}

                        {/* Value */}
                        <td className="p-4 text-right font-black text-foreground/90 tabular-nums">
                          {formatPeso(inv.netAmount)}
                        </td>

                        {/* Payment state */}
                        <td className="p-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            inv.paymentStatus === 'Unpaid' 
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}>
                            {inv.paymentStatus}
                          </span>
                        </td>

                        {/* Action buttons with strict RBAC toggle */}
                        <td className="p-4 text-center">
                          {activeTab === "pending" ? (
                            isAdmin ? (
                              <div className="flex items-center justify-center gap-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleApproveClick(inv)}
                                  className="h-7 text-[10px] font-bold gap-1 px-2 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 transition-all shadow-sm"
                                >
                                  <ThumbsUp className="h-3 w-3" />
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRejectClick(inv)}
                                  className="h-7 text-[10px] font-bold gap-1 px-2 border-rose-500/30 text-rose-600 hover:bg-rose-500 hover:text-white dark:hover:bg-rose-600 transition-all shadow-sm"
                                >
                                  <ThumbsDown className="h-3 w-3" />
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <div className="text-[10px] text-muted-foreground flex items-center justify-center gap-1 font-semibold italic">
                                <Info className="h-3 w-3 text-muted-foreground/75" />
                                <span>Waiting for Admin</span>
                              </div>
                            )
                          ) : (() => {
                            const elig = getEligibility(inv.transactionStatus);
                            if (elig.tier === "blocked") {
                              return (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled
                                  className={cn("h-7 text-[10px] font-semibold gap-1 px-3 cursor-not-allowed opacity-50", elig.className)}
                                  title={elig.reason}
                                >
                                  <X className="h-3 w-3" />
                                  Blocked
                                </Button>
                              );
                            }
                            if (elig.tier === "risk") {
                              return (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRequestClick(inv)}
                                  className={cn("h-7 text-[10px] font-bold gap-1 px-3 shadow-sm hover:text-white hover:bg-amber-500", elig.className)}
                                  title={elig.reason}
                                >
                                  <AlertTriangle className="h-3 w-3" />
                                  Request (Risk)
                                </Button>
                              );
                            }
                            return (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleRequestClick(inv)}
                                className="h-7 text-[10px] font-semibold gap-1 px-3 hover:shadow-md hover:shadow-destructive/10 transition-all"
                                title={elig.reason}
                              >
                                <Ban className="h-3 w-3" />
                                Request Cancel
                              </Button>
                            );
                          })()}
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </AnimatePresence>
            </tbody>
          </table>
        </div>

        {/* ── Server-Side Pagination Bar Footer ── */}
        {totalPages > 1 && (
          <div className="py-6 border-t border-slate-100 dark:border-zinc-800 bg-muted/20 flex items-center justify-center">
            <Pagination>
              <PaginationContent className="gap-1">
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    className={cn(
                      "h-9 px-3 rounded-lg bg-background border transition-all active:scale-95 text-xs font-bold",
                      page === 1 ? "opacity-30 pointer-events-none" : "hover:bg-muted cursor-pointer"
                    )}
                  />
                </PaginationItem>

                {[...Array(totalPages)].map((_, i) => {
                  const p = i + 1;
                  if (p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)) {
                    return (
                      <PaginationItem key={p}>
                        <PaginationLink
                          onClick={() => setPage(p)}
                          isActive={page === p}
                          className={cn(
                            "h-9 w-9 rounded-lg transition-all text-xs font-bold cursor-pointer",
                            page === p
                              ? "bg-slate-900 shadow-md text-white hover:bg-slate-900 dark:bg-zinc-100 dark:text-zinc-950"
                              : "bg-background border text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  } else if (p === page - 2 || p === page + 2) {
                    return (
                      <PaginationItem key={p}>
                        <PaginationEllipsis />
                      </PaginationItem>
                    );
                  }
                  return null;
                })}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    className={cn(
                      "h-9 px-3 rounded-lg bg-background border transition-all active:scale-95 text-xs font-bold",
                      page === totalPages ? "opacity-30 pointer-events-none" : "hover:bg-muted cursor-pointer"
                    )}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </div>

      {/* ── Dialog: Request Cancellation ── */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="h-10 w-10 bg-destructive/10 text-destructive rounded-full flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <DialogTitle className="text-sm font-black uppercase tracking-tight text-foreground">
              Request Invoice Cancellation
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-normal">
              You are requesting to cancel Invoice <span className="font-bold text-foreground">{selectedInvoice?.invoiceNo}</span> for <span className="font-bold text-foreground">{selectedInvoice?.customerName}</span>. This request will be routed to the administrator queue for verification.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && getEligibility(selectedInvoice.transactionStatus).tier === "risk" && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5 my-1.5">
              <input
                type="checkbox"
                id="retrieval-confirm"
                checked={confirmRetrieval}
                onChange={(e) => setConfirmRetrieval(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5 rounded border-amber-500 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <label htmlFor="retrieval-confirm" className="text-[10px] text-amber-800 dark:text-amber-400 font-bold select-none cursor-pointer leading-tight">
                Logistical Confirmation Required: I confirm that the physical items have been retrieved/returned from transit, or the delivery truck has returned the inventory.
              </label>
            </div>
          )}

          <div className="space-y-2 py-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/85">
              Cancellation Reason <span className="text-destructive font-bold">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a clear justification (e.g. Sales order double-entry, client cancellation before dispatch...)"
              className="w-full h-24 p-3 border border-border/60 bg-background rounded-xl text-xs focus:ring-1 focus:ring-ring outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRequestDialogOpen(false)}
              className="h-9 text-xs font-semibold"
              disabled={submitting}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={() => submitAction("request")}
              className="h-9 text-xs font-bold gap-1 px-4"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border border-current border-t-transparent animate-spin mr-1" />
                  Submitting...
                </>
              ) : (
                <>
                  <Ban className="h-3.5 w-3.5" />
                  Submit Request
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Approve Cancellation ── */}
      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="h-10 w-10 bg-emerald-500/10 text-emerald-600 rounded-full flex items-center justify-center shrink-0">
              <ThumbsUp className="h-5 w-5" />
            </div>
            <DialogTitle className="text-sm font-black uppercase tracking-tight text-foreground">
              Approve Cancellation Request
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-normal">
              Are you sure you want to approve the cancellation of Invoice <span className="font-bold text-foreground">{selectedInvoice?.invoiceNo}</span>?
              Approving will set its status to <span className="text-rose-500 font-bold uppercase">CANCELLED</span>, removing it permanently from Accounts Receivable ledgers.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 pt-4">
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              className="h-9 text-xs font-semibold"
              disabled={submitting}
            >
              Back
            </Button>
            <Button
              onClick={() => submitAction("approve")}
              className="h-9 text-xs font-bold gap-1 px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border border-current border-t-transparent animate-spin mr-1" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle className="h-3.5 w-3.5" />
                  Approve & Reconcile
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Reject Cancellation Request ── */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md p-6 rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl">
          <DialogHeader className="space-y-2">
            <div className="h-10 w-10 bg-rose-500/10 text-rose-600 rounded-full flex items-center justify-center shrink-0">
              <ThumbsDown className="h-5 w-5" />
            </div>
            <DialogTitle className="text-sm font-black uppercase tracking-tight text-foreground">
              Reject Cancellation Request
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground leading-normal">
              You are rejecting the cancellation request for Invoice <span className="font-bold text-foreground">{selectedInvoice?.invoiceNo}</span>. The invoice status will revert to its original state (<span className="font-bold text-foreground">{selectedInvoice?.previousStatus}</span>) and remain active in Accounts Receivable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-3">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/85">
              Rejection Comments / Feedback <span className="text-destructive font-bold">*</span>
            </label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Provide context explaining why this cancellation is rejected (e.g. Payments have already been processed, incorrect documentation, etc.)"
              className="w-full h-24 p-3 border border-border/60 bg-background rounded-xl text-xs focus:ring-1 focus:ring-ring outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              className="h-9 text-xs font-semibold"
              disabled={submitting}
            >
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={() => submitAction("reject")}
              className="h-9 text-xs font-bold gap-1 px-4"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <div className="h-3.5 w-3.5 rounded-full border border-current border-t-transparent animate-spin mr-1" />
                  Rejecting...
                </>
              ) : (
                <>
                  <ThumbsDown className="h-3.5 w-3.5" />
                  Confirm Reject
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
