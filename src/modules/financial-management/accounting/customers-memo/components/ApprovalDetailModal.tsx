// src/modules/financial-management/accounting/customers-memo/components/ApprovalDetailModal.tsx

"use client";

import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, FileText, User, Receipt, CreditCard, Layers, Printer, XCircle } from "lucide-react";
import { fetchDetailedMemo, approveMemo, rejectMemo } from "../service";
import { DetailedMemo, CompanyProfile } from "../types";
import { toast } from "sonner";
import { PrintMemoSettingsDialog } from "./PrintMemoSettingsDialog";
import { Textarea } from "@/components/ui/textarea";

interface ApprovalDetailModalProps {
    memoId: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApproved?: () => void;
    readOnly?: boolean;
}

export function ApprovalDetailModal({ memoId, open, onOpenChange, onApproved, readOnly = false }: ApprovalDetailModalProps) {
    const [details, setDetails] = useState<DetailedMemo | null>(null);
    const [company, setCompany] = useState<CompanyProfile | null>(null);
    const [loading, setLoading] = useState(false);
    const [approving, setApproving] = useState(false);
    const [printSettingsOpen, setPrintSettingsOpen] = useState(false);
    
    // Rejection state
    const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [rejecting, setRejecting] = useState(false);

    useEffect(() => {
        if (open) {
            fetch("/api/pdf/company")
                .then(res => res.json())
                .then(data => {
                    const profile = data?.data?.[0];
                    if (profile) setCompany(profile);
                })
                .catch(err => console.error("Failed to fetch company profile:", err));
        }
    }, [open]);

    useEffect(() => {
        if (open && memoId) {
            setLoading(true);
            fetchDetailedMemo(memoId)
                .then(data => {
                    if (!data?.header) throw new Error("Invalid response: missing header");
                    setDetails(data);
                    setRejectionReason(data.header.reason || "");
                })
                .catch(() => toast.error("Failed to load memo details."))
                .finally(() => setLoading(false));
        } else {
            setDetails(null);
            setRejectionReason("");
        }
    }, [open, memoId]);

    const handleApprove = async () => {
        if (!memoId) return;
        setApproving(true);
        try {
            const res = await approveMemo(memoId);
            if (res.success) {
                toast.success("Customer Credit Memo has been approved.");
                onApproved?.();
                onOpenChange(false);
            } else {
                toast.error(res.error || "Approval failed.");
            }
        } catch {
            toast.error("Network error during approval.");
        } finally {
            setApproving(false);
        }
    };

    const handleReject = async () => {
        if (!memoId) return;
        const remarksTrimmed = rejectionReason.trim();
        if (!remarksTrimmed) {
            toast.error("Please enter a reason/remarks for rejection.");
            return;
        }
        setRejecting(true);

        try {
            const existingReason = details?.header.reason?.trim() || "";
            const currentDateStr = new Date().toLocaleDateString("en-US", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            });
            const rejectionEntry = `${currentDateStr} - ${remarksTrimmed}`;
            const combinedReason = existingReason ? `${existingReason} | ${rejectionEntry}` : rejectionEntry;

            const res = await rejectMemo(memoId, combinedReason);
            if (res.success) {
                toast.success("Customer Credit Memo has been rejected.");
                setRejectDialogOpen(false);
                onApproved?.();
                onOpenChange(false);
            } else {
                toast.error(res.error || "Rejection failed.");
            }
        } catch {
            toast.error("Network error during rejection.");
        } finally {
            setRejecting(false);
        }
    };

    const formatCurrency = (val: number) => 
        new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="w-[95vw] sm:max-w-5xl p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
                <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 text-white relative">
                    <DialogHeader>
                        <div className="flex items-center gap-4 mb-2">
                            <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                <FileText className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <DialogTitle className="text-2xl font-black tracking-tight text-white">
                                    Memo Details
                                </DialogTitle>
                                <DialogDescription className="text-blue-100 font-bold text-xs uppercase tracking-widest opacity-80 mt-0.5">
                                    Transaction Information
                                </DialogDescription>
                            </div>
                        </div>
                    </DialogHeader>
                    <div className="absolute top-0 right-0 p-8 opacity-10">
                        <CheckCircle className="h-32 w-32" />
                    </div>
                </div>

                <div className="p-8 max-h-[70vh] overflow-y-auto space-y-8 bg-slate-50/50">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                            <p className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Synchronizing Data...</p>
                        </div>
                    ) : details ? (
                        <>
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/60 space-y-2">
                                    <div className="flex items-center gap-2 text-blue-600">
                                        <Receipt className="h-4 w-4 shrink-0" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Memo Number</span>
                                    </div>
                                    <p className="text-xl font-black text-slate-900 tracking-tight">{details.header.memo_number}</p>
                                </div>
                                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/60 space-y-2">
                                    <div className="flex items-center gap-2 text-indigo-600">
                                        <CreditCard className="h-4 w-4 shrink-0" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Total Value</span>
                                    </div>
                                    <p className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(details.header.amount)}</p>
                                </div>
                                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/60 space-y-2">
                                    <div className="flex items-center gap-2 text-blue-600">
                                        <Layers className="h-4 w-4 shrink-0" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Applied Value</span>
                                    </div>
                                    <p className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(details.header.applied_amount || 0)}</p>
                                </div>
                                <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200/60 space-y-2">
                                    <div className="flex items-center gap-2 text-amber-600">
                                        <User className="h-4 w-4 shrink-0" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Encoder</span>
                                    </div>
                                    <p className="text-xl font-bold text-slate-900 tracking-tight">
                                        {(() => {
                                            const enc = details.header.encoder_id;
                                            if (enc && typeof enc === 'object' && 'user_fname' in enc && enc.user_fname) {
                                                return `${enc.user_fname} ${enc.user_lname || ""}`.trim();
                                            }
                                            return "System";
                                        })()}
                                    </p>
                                </div>
                            </div>

                            {/* Detailed Info */}
                            <div className="bg-white rounded-[2rem] border border-slate-200/60 shadow-sm overflow-hidden">
                                <div className="p-6 bg-slate-50 border-b border-slate-100">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-500">Transaction Details</h3>
                                </div>
                                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div className="space-y-4">
                                        <DetailItem label="Customer" value={details.header.customer_id.customer_name} />
                                        <DetailItem label="Supplier" value={details.header.supplier_id.supplier_name} />
                                        <DetailItem label="Salesman" value={`${details.header.salesman_id.salesman_code} - ${details.header.salesman_id.salesman_name}`} />
                                        <DetailItem label="Memo Type" value={details.header.type === 1 ? "Credit Memo" : details.header.type === 2 ? "Debit Memo" : "Unknown"} />
                                    </div>
                                    <div className="space-y-4">
                                        <DetailItem label="GL Account" value={details.header.chart_of_account.account_title} />
                                        <DetailItem label="Reason / Remarks" value={details.header.reason || "No reason provided"} />
                                        <DetailItem label="Date Created" value={new Date(details.header.created_at).toLocaleString()} />
                                    </div>
                                </div>
                            </div>


                        </>
                    ) : null}
                </div>

                <DialogFooter className="p-6 bg-white border-t border-slate-100 flex items-center justify-end gap-3">
                    <Button 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)}
                        className="rounded-xl font-bold text-slate-500 hover:text-slate-900"
                    >
                        Close
                    </Button>
                    {details && (
                        <Button
                            variant="outline"
                            onClick={() => setPrintSettingsOpen(true)}
                            className="rounded-xl font-bold text-slate-700 hover:text-slate-900 border-slate-200 shadow-sm"
                        >
                            <Printer className="h-4 w-4 mr-2" />
                            Print
                        </Button>
                    )}
                    {(!readOnly && details?.header.status === "FOR APPROVAL") && (
                        <>
                            <Button 
                                variant="destructive"
                                onClick={() => setRejectDialogOpen(true)} 
                                disabled={approving || rejecting || loading}
                                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-6 font-black tracking-tight shadow-lg shadow-rose-500/20 active:scale-95 transition-all h-11"
                            >
                                <XCircle className="h-4 w-4 mr-2" />
                                Reject Memo
                            </Button>
                            <Button 
                                onClick={handleApprove} 
                                disabled={approving || rejecting || loading}
                                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 font-black tracking-tight shadow-lg shadow-blue-500/20 active:scale-95 transition-all h-11"
                            >
                                {approving ? (
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>Approving...</span>
                                    </div>
                                ) : (
                                    "Approve Memo"
                                )}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
            {details && (
                <PrintMemoSettingsDialog
                    open={printSettingsOpen}
                    onOpenChange={setPrintSettingsOpen}
                    details={details}
                    company={company}
                />
            )}

            {/* Rejection Remarks Dialog */}
            <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
                <DialogContent showCloseButton={false} className="w-[95vw] sm:max-w-lg p-0 overflow-hidden rounded-[2rem] border-none shadow-2xl">
                    <div className="bg-gradient-to-br from-rose-600 to-red-700 p-6 text-white relative">
                        <DialogHeader>
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                    <XCircle className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black tracking-tight text-white">
                                        Reject Customer Memo
                                    </DialogTitle>
                                    <DialogDescription className="text-rose-100 font-bold text-xs uppercase tracking-widest opacity-80 mt-0.5">
                                        Memo #{details?.header.memo_number}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>
                    </div>

                    <div className="p-6 space-y-4 bg-slate-50">
                        {details?.header.reason && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    Original Reason
                                </label>
                                <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-700 break-words">
                                    {details.header.reason}
                                </div>
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                                Rejection Remarks <span className="text-rose-500">*</span>
                            </label>
                            <Textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                placeholder="Enter rejection reason..."
                                className="min-h-[100px] rounded-2xl bg-white border-slate-200 focus:ring-2 focus:ring-rose-500/20 font-medium text-sm"
                            />
                        </div>

                        {rejectionReason.trim() && (
                            <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100 space-y-1">
                                <span className="text-[9px] font-black uppercase tracking-widest text-rose-600">Final Reason Output Preview</span>
                                <p className="text-xs font-bold text-slate-800 break-words">
                                    {details?.header.reason?.trim() ? `${details.header.reason.trim()} | ` : ""}{new Date().toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" })} - {rejectionReason.trim()}
                                </p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-6 bg-white border-t border-slate-100 flex justify-end gap-3">
                        <Button
                            variant="ghost"
                            onClick={() => setRejectDialogOpen(false)}
                            disabled={rejecting}
                            className="rounded-xl font-bold text-slate-500 hover:text-slate-900"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleReject}
                            disabled={rejecting || !rejectionReason.trim()}
                            className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl px-6 font-black tracking-tight shadow-lg shadow-rose-500/20 active:scale-95 transition-all h-11"
                        >
                            {rejecting ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Rejecting...</span>
                                </div>
                            ) : (
                                "Confirm Rejection"
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Dialog>
    );
}

function DetailItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
            <p className="text-sm font-bold text-slate-800 leading-tight">{value}</p>
        </div>
    );
}
