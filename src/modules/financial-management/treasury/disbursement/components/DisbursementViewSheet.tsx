"use client";

import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, CheckCircle, Send, SendIcon, Wallet, Building2, Printer, Pencil, Lock, AlertTriangle, FileText, Receipt } from "lucide-react";
import { Disbursement } from "../types";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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

    // 🚀 NEW: The jsPDF AutoTable Generation Logic
    const handleGeneratePDF = (paperSize: "A4" | "58mm") => {
        // 58mm thermal printers usually use a continuous roll, we set a long dummy height (e.g., 250mm)
        // A4 standard is 210 x 297 mm
        const doc = new jsPDF({
            orientation: "portrait",
            unit: "mm",
            format: paperSize === "A4" ? "a4" : [58, 250]
        });

        const isA4 = paperSize === "A4";
        const marginX = isA4 ? 15 : 3;
        const center = isA4 ? 105 : 29;

        // --- HEADER ---
        doc.setFontSize(isA4 ? 14 : 9);
        doc.setFont("helvetica", "bold");
        doc.text("MEN2 Marketing", center, isA4 ? 15 : 8, { align: "center" });

        doc.setFontSize(isA4 ? 11 : 7);
        doc.setFont("helvetica", "normal");
        doc.text("Disbursement Voucher", center, isA4 ? 22 : 12, { align: "center" });

        // --- META INFO ---
        let startY = isA4 ? 35 : 20;
        doc.setFontSize(isA4 ? 10 : 7);

        doc.setFont("helvetica", "bold");
        doc.text(`Voucher No:`, marginX, startY);
        doc.setFont("helvetica", "normal");
        doc.text(`${disbursement.docNo}`, marginX + (isA4 ? 25 : 17), startY);

        doc.setFont("helvetica", "bold");
        doc.text(`Date:`, marginX, startY + 6);
        doc.setFont("helvetica", "normal");
        doc.text(`${disbursement.transactionDate ? format(new Date(disbursement.transactionDate), "MMM dd, yyyy") : "N/A"}`, marginX + (isA4 ? 25 : 17), startY + 6);

        doc.setFont("helvetica", "bold");
        doc.text(`Payee:`, marginX, startY + 12);
        doc.setFont("helvetica", "normal");
        // Split text if payee name is too long for 58mm
        const payeeText = doc.splitTextToSize(disbursement.payeeName || "N/A", isA4 ? 150 : 35);
        doc.text(payeeText, marginX + (isA4 ? 25 : 17), startY + 12);

        doc.setFont("helvetica", "bold");
        doc.text(`Total:`, marginX, startY + 18 + ((payeeText.length - 1) * 4));
        doc.setFont("helvetica", "normal");
        doc.text(`Php ${disbursement.totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2})}`, marginX + (isA4 ? 25 : 17), startY + 18 + ((payeeText.length - 1) * 4));

        startY += 28 + ((payeeText.length - 1) * 4);

        // --- PAYABLES TABLE ---
        autoTable(doc, {
            startY: startY,
            margin: { left: marginX, right: marginX },
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], fontSize: isA4 ? 9 : 6, halign: 'center' },
            bodyStyles: { fontSize: isA4 ? 9 : 6 },
            head: [['Ref No', 'Account', 'Amount']],
            body: (disbursement.payables || []).map(p => [
                p.referenceNo || 'N/A',
                p.accountTitle || `COA: ${p.coaId}`,
                { content: p.amount.toLocaleString('en-US', {minimumFractionDigits: 2}), styles: { halign: 'right' } }
            ])
        });

        // @ts-expect-error - jspdf-autotable attaches lastAutoTable to doc
        startY = doc.lastAutoTable.finalY + (isA4 ? 10 : 5);

        // --- PAYMENTS TABLE ---
        autoTable(doc, {
            startY: startY,
            margin: { left: marginX, right: marginX },
            theme: 'grid',
            headStyles: { fillColor: [15, 23, 42], fontSize: isA4 ? 9 : 6, halign: 'center' },
            bodyStyles: { fontSize: isA4 ? 9 : 6 },
            head: [['Check No', 'Bank/COA', 'Amount']],
            body: (disbursement.payments || []).map(p => [
                p.checkNo || 'N/A',
                p.accountTitle || `COA: ${p.coaId}`,
                { content: p.amount.toLocaleString('en-US', {minimumFractionDigits: 2}), styles: { halign: 'right' } }
            ])
        });

        // @ts-expect-error - di ko din alam
        startY = doc.lastAutoTable.finalY + (isA4 ? 20 : 15);

        // --- SIGNATURES ---
        doc.setFontSize(isA4 ? 9 : 6);
        if (isA4) {
            // Horizontal layout for A4
            doc.text("Prepared By:", 20, startY);
            doc.setFont("helvetica", "bold");
            doc.text(disbursement.encoderName || "System", 20, startY + 10);

            doc.setFont("helvetica", "normal");
            doc.text("Approved By:", 80, startY);
            doc.setFont("helvetica", "bold");
            doc.text(disbursement.approverName || "________________", 80, startY + 10);

            doc.setFont("helvetica", "normal");
            doc.text("Received By:", 140, startY);
            doc.text("________________", 140, startY + 10);
        } else {
            // Stacked layout for 58mm
            doc.setFont("helvetica", "normal");
            doc.text("Prepared By:", marginX, startY);
            doc.setFont("helvetica", "bold");
            doc.text(disbursement.encoderName || "System", marginX, startY + 4);

            doc.setFont("helvetica", "normal");
            doc.text("Approved By:", marginX, startY + 12);
            doc.setFont("helvetica", "bold");
            doc.text(disbursement.approverName || "______________", marginX, startY + 16);

            doc.setFont("helvetica", "normal");
            doc.text("Received By:", marginX, startY + 24);
            doc.text("______________", marginX, startY + 28);
        }

        // Open the generated PDF in a new browser tab safely!
        const pdfBlobUrl = doc.output('bloburl');
        window.open(pdfBlobUrl, '_blank');

        // Hide the print menu after generating
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
                                    <span title="Locked & Posted to GL">
                                        <Lock className="w-5 h-5 text-destructive" />
                                    </span>
                                )}
                            </SheetTitle>
                            <SheetDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                Date: {disbursement.transactionDate ? format(new Date(disbursement.transactionDate), "MMMM dd, yyyy") : "No Date Recorded"}
                            </SheetDescription>
                        </div>
                        <Badge variant="outline" className={`text-[10px] uppercase font-black px-3 py-1 shadow-sm ${
                            disbursement.status === 'Draft' ? 'bg-muted text-muted-foreground border-border' :
                                disbursement.status === 'Approved' ? 'bg-emerald-100/50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800' :
                                    disbursement.status === 'Posted' ? 'bg-primary text-primary-foreground border-primary' :
                                        'bg-blue-100/50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800'
                        }`}>
                            {disbursement.status}
                        </Badge>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin space-y-6">
                    {/* INFO GRID */}
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
                    </div>

                    {/* PAYABLES (DEBITS) */}
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
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-right text-muted-foreground">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!disbursement.payables || disbursement.payables.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="text-center text-[10px] text-muted-foreground py-6 font-bold border-border">No payables attached.</TableCell></TableRow>
                                    ) : disbursement.payables.map((p, i) => (
                                        <TableRow key={i} className="hover:bg-muted/50 border-border">
                                            <TableCell className="text-xs font-bold uppercase text-foreground">{p.referenceNo || "N/A"}</TableCell>
                                            <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{p.accountTitle || `COA: ${p.coaId}`}</TableCell>
                                            <TableCell className="text-xs font-black text-right text-foreground">{formatCurrency(p.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* PAYMENTS (CREDITS) */}
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
                                Warning: Debits do not match Credits. This voucher cannot be posted.
                            </div>
                        )}
                    </div>
                </div>

                {/* DYNAMIC ACTION FOOTER */}
                <div className="p-6 bg-card border-t border-border shrink-0 flex justify-between items-center z-10">

                    {/* 🚀 UPGRADED PRINT UI */}
                    <div className="relative">
                        {showPrintOptions ? (
                            <div className="flex items-center gap-2 animate-in slide-in-from-left-4 fade-in">
                                <Button variant="outline" onClick={() => handleGeneratePDF("A4")} className="text-[10px] font-black uppercase tracking-widest h-10 px-4 border-input bg-background hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
                                    <FileText className="w-4 h-4 mr-2 text-blue-500" /> A4 (Bond)
                                </Button>
                                <Button variant="outline" onClick={() => handleGeneratePDF("58mm")} className="text-[10px] font-black uppercase tracking-widest h-10 px-4 border-input bg-background hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white">
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
                            <Button onClick={() => handleAction("Submitted")} disabled={loading} className="text-[10px] font-black uppercase tracking-widest h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white shadow-md">
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