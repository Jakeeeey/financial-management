"use client";

import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle, Send, SendIcon, Wallet, Building2, Printer, Pencil, Lock, AlertTriangle, FileText, Receipt } from "lucide-react";
import { Disbursement } from "../types";
import { format } from "date-fns";
// 🚀 IMPORT THE NEW UTIL HERE (Adjust path if needed based on where you saved it)
import { generateDisbursementPDF } from "../utils/pdfGenerator";

interface DisbursementViewSheetProps {
    disbursement: Disbursement | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdateStatus: (id: number, status: string) => Promise<boolean>;
    onEdit?: (d: Disbursement) => void;
    loading: boolean;
}

export function DisbursementViewSheet({ disbursement, open, onOpenChange, onUpdateStatus, onEdit, loading }: DisbursementViewSheetProps) {
    const [showPrintOptions, setShowPrintOptions] = useState(false);

    if (!disbursement) return null;

    const formatCurrency = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount || 0);

    const handleAction = async (status: string) => {
        const success = await onUpdateStatus(disbursement.id, status);
        if (success) onOpenChange(false);
    };

    const handlePrint = (size: "A4" | "58mm") => {
        generateDisbursementPDF(disbursement, size);
        setShowPrintOptions(false);
    };

    const totalPayables = disbursement.payables?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const totalPayments = disbursement.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    const isBalanced = Math.abs(totalPayables - totalPayments) < 0.01;

    return (
        <Sheet open={open} onOpenChange={(val) => { onOpenChange(val); setShowPrintOptions(false); }}>
            <SheetContent className="sm:max-w-[750px] w-full p-0 flex flex-col bg-background border-l border-border overflow-hidden">

                <SheetHeader className="p-6 border-b border-border bg-card shrink-0 shadow-sm relative z-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <SheetTitle className="text-2xl font-black uppercase text-foreground tracking-tight flex items-center gap-2">
                                Voucher No: {disbursement.docNo}
                                {disbursement.isPosted === 1 && (
                                    <span title="Locked & Posted to GL"><Lock className="w-5 h-5 text-destructive" /></span>
                                )}
                            </SheetTitle>
                            <SheetDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                Date: {disbursement.transactionDate ? format(new Date(disbursement.transactionDate), "MMMM dd, yyyy") : "No Date Recorded"}
                            </SheetDescription>
                        </div>
                        <Badge variant="outline" className={`text-[10px] uppercase font-black px-3 py-1 shadow-sm ${
                            disbursement.status === 'Draft' ? 'bg-muted text-muted-foreground border-border' :
                                disbursement.status === 'Approved' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200' :
                                    disbursement.status === 'Posted' ? 'bg-primary text-primary-foreground border-primary' :
                                        'bg-blue-100/50 text-blue-700 border-blue-200'
                        }`}>
                            {disbursement.status}
                        </Badge>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">
                    <div className="grid grid-cols-2 gap-4 p-5 bg-card rounded-xl border border-border shadow-sm relative overflow-hidden">
                        <div className={`absolute top-0 left-0 w-1 h-full ${disbursement.isPosted ? 'bg-muted-foreground' : 'bg-primary'}`} />
                        <div>
                            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                                <Building2 className="w-3 h-3" /> Payee
                            </p>
                            <p className="text-sm font-black text-foreground uppercase">{disbursement.payeeName || "N/A"}</p>
                        </div>
                        <div className="text-right">
                            <p className="flex items-center justify-end gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">
                                <Wallet className="w-3 h-3" /> Total Amount
                            </p>
                            <p className="text-xl font-black text-emerald-600 dark:text-emerald-500">{formatCurrency(disbursement.totalAmount)}</p>
                        </div>
                        <div className="col-span-2 border-t border-border pt-3 mt-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Particulars / Remarks</p>
                            <p className="text-xs font-bold text-foreground bg-muted p-2 rounded-md">{disbursement.remarks || "No remarks provided."}</p>
                        </div>
                        <div className="grid grid-cols-2 col-span-2 mt-1 gap-2">
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Division</p>
                                <p className="text-xs font-bold text-foreground">{disbursement.divisionName || "N/A"}</p>
                            </div>
                            <div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Department</p>
                                <p className="text-xs font-bold text-foreground">{disbursement.departmentName || "N/A"}</p>
                            </div>
                        </div>
                    </div>

                    {/* PAYABLES */}
                    <div className="space-y-2">
                        <h3 className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
                            <span>Payables Breakdown (Debits)</span>
                            <span className="text-emerald-600 dark:text-emerald-500">Total: {formatCurrency(totalPayables)}</span>
                        </h3>
                        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="border-border">
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ref No</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Account</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Remarks</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-right text-muted-foreground">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!disbursement.payables || disbursement.payables.length === 0 ? (
                                        <TableRow><TableCell colSpan={4} className="text-center text-[10px] text-muted-foreground py-6 font-bold border-border">No payables attached.</TableCell></TableRow>
                                    ) : disbursement.payables.map((p, i) => (
                                        <TableRow key={i} className="hover:bg-muted/50 border-border">
                                            <TableCell className="text-xs font-bold uppercase text-foreground">{p.referenceNo || "N/A"}</TableCell>
                                            <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{p.accountTitle || `COA: ${p.coaId}`}</TableCell>
                                            <TableCell className="text-[10px] font-medium text-muted-foreground">{p.remarks || "-"}</TableCell>
                                            <TableCell className="text-xs font-black text-right text-foreground">{formatCurrency(p.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* PAYMENTS */}
                    <div className="space-y-2">
                        <h3 className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">
                            <span>Payment Details (Credits)</span>
                            <span className="text-emerald-600 dark:text-emerald-500">Total: {formatCurrency(totalPayments)}</span>
                        </h3>
                        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="border-border">
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Check / Ref</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Bank Acct</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-right text-muted-foreground">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!disbursement.payments || disbursement.payments.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="text-center text-[10px] text-muted-foreground py-6 font-bold border-border">No payments processed yet.</TableCell></TableRow>
                                    ) : disbursement.payments.map((p, i) => (
                                        <TableRow key={i} className="hover:bg-muted/50 border-border">
                                            <TableCell className="text-xs font-bold uppercase text-foreground">{p.checkNo || "N/A"}</TableCell>
                                            <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{p.accountTitle || `Bank/COA: ${p.coaId}`}</TableCell>
                                            <TableCell className="text-xs font-black text-emerald-600 dark:text-emerald-500 text-right">{formatCurrency(p.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {!isBalanced && disbursement.status !== "Posted" && (
                            <div className="bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded-md text-[10px] font-black uppercase tracking-widest text-center mt-2">
                                Warning: Debits do not match Credits. This voucher cannot be submitted or posted.
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 bg-card border-t border-border shrink-0 flex justify-between items-center z-10">
                    <div className="relative">
                        {showPrintOptions ? (
                            <div className="flex items-center gap-2 animate-in slide-in-from-left-4 fade-in">
                                <Button variant="outline" onClick={() => handlePrint("A4")} className="text-[10px] font-black uppercase tracking-widest h-10 px-4 border-input bg-background hover:bg-slate-100 hover:text-slate-900">
                                    <FileText className="w-4 h-4 mr-2 text-blue-500" /> A4 (Bond)
                                </Button>
                                <Button variant="outline" onClick={() => handlePrint("58mm")} className="text-[10px] font-black uppercase tracking-widest h-10 px-4 border-input bg-background hover:bg-slate-100 hover:text-slate-900">
                                    <Receipt className="w-4 h-4 mr-2 text-amber-500" /> 58mm (Thermal)
                                </Button>
                                <Button variant="ghost" onClick={() => setShowPrintOptions(false)} className="h-10 px-2 text-muted-foreground">✕</Button>
                            </div>
                        ) : (
                            <Button variant="outline" onClick={() => setShowPrintOptions(true)} className="text-[10px] font-black uppercase tracking-widest h-10 px-6 border-input">
                                <Printer className="w-4 h-4 mr-2" /> Print Voucher
                            </Button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {disbursement.status !== "Draft" && disbursement.status !== "Posted" && (
                            <Button onClick={() => handleAction("Draft")} disabled={loading} className="text-[10px] font-black uppercase tracking-widest h-10 px-6 bg-destructive/10 hover:bg-destructive/20 text-destructive shadow-sm border border-destructive/20">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                                Return to Draft
                            </Button>
                        )}
                        {disbursement.status === "Draft" && onEdit && (
                            <Button onClick={() => onEdit(disbursement)} className="text-[10px] font-black uppercase tracking-widest h-10 px-6 bg-amber-500 hover:bg-amber-600 text-white shadow-md">
                                <Pencil className="w-4 h-4 mr-2" /> Edit Draft
                            </Button>
                        )}
                        {disbursement.status === "Draft" && (
                            <Button onClick={() => handleAction("Submitted")} disabled={loading || !isBalanced} className="text-[10px] font-black uppercase tracking-widest h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-md disabled:opacity-50">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <SendIcon className="w-4 h-4 mr-2" />}
                                Submit for Approval
                            </Button>
                        )}
                        {disbursement.status === "Submitted" && (
                            <Button onClick={() => handleAction("Approved")} disabled={loading} className="text-[10px] font-black uppercase tracking-widest h-10 px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                Approve Voucher
                            </Button>
                        )}
                        {disbursement.status === "Approved" && (
                            <Button onClick={() => handleAction("Released")} disabled={loading} className="text-[10px] font-black uppercase tracking-widest h-10 px-6 bg-purple-600 hover:bg-purple-700 text-white shadow-md">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                Release Check
                            </Button>
                        )}
                        {disbursement.status === "Released" && (
                            <Button onClick={() => handleAction("Posted")} disabled={loading || !isBalanced} className="text-[10px] font-black uppercase tracking-widest h-10 px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md disabled:opacity-50">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                                Post to GL
                            </Button>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}