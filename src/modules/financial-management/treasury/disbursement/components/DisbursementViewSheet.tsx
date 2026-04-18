"use client";

import React, { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Loader2, CheckCircle, Send, SendIcon, Wallet, Building2,
    Printer, Pencil, Lock, AlertTriangle, FileText, Receipt,
    CheckCircle2, CircleDashed, ArrowLeftRight, X
} from "lucide-react";
import { Disbursement } from "../types";
import { format } from "date-fns";
// 🚀 Adjust path if needed
import { generateDisbursementPDF } from "../utils/pdfGenerator";

interface DisbursementViewSheetProps {
    disbursement: Disbursement | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onUpdateStatus: (id: number, status: string) => Promise<boolean>;
    onEdit?: (d: Disbursement) => void;
    loading: boolean;
}

// 🚀 UPGRADE 1: Standardized Lifecycle Steps
const VOUCHER_STEPS = ["Draft", "Submitted", "Approved", "Released", "Posted"];

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

    const currentStepIndex = VOUCHER_STEPS.indexOf(disbursement.status);

    return (
        <Sheet open={open} onOpenChange={(val) => { onOpenChange(val); setShowPrintOptions(false); }}>
            <SheetContent className="sm:max-w-[750px] w-full p-0 flex flex-col bg-background border-l border-border overflow-hidden shadow-2xl">

                {/* HEADER */}
                <SheetHeader className="p-6 border-b border-border bg-card shrink-0 shadow-sm relative z-10">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <SheetTitle className="text-2xl font-black uppercase text-foreground tracking-tight flex items-center gap-2">
                                <FileText className="w-5 h-5 text-primary opacity-70" />
                                {disbursement.docNo}
                                {disbursement.isPosted === 1 && (
                                    <span title="Locked & Posted to GL"><Lock className="w-4 h-4 text-destructive" /></span>
                                )}
                            </SheetTitle>
                            <SheetDescription className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                Transaction Date: {disbursement.transactionDate ? format(new Date(disbursement.transactionDate), "MMMM dd, yyyy") : "No Date Recorded"}
                            </SheetDescription>
                        </div>
                    </div>

                    {/* 🚀 UPGRADE 1: Visual Lifecycle Timeline */}
                    <div className="mt-6 pt-4 border-t border-border/50">
                        <div className="flex items-center justify-between relative">
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-muted"></div>
                            <div
                                className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary transition-all duration-500"
                                style={{ width: `${(Math.max(0, currentStepIndex) / (VOUCHER_STEPS.length - 1)) * 100}%` }}
                            ></div>

                            {VOUCHER_STEPS.map((step, idx) => {
                                const isCompleted = idx < currentStepIndex;
                                const isCurrent = idx === currentStepIndex;
                                return (
                                    <div key={step} className="relative z-10 flex flex-col items-center gap-2 bg-card px-2">
                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                                            isCompleted ? 'bg-primary text-primary-foreground' :
                                                isCurrent ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' :
                                                    'bg-muted border-2 border-border text-muted-foreground'
                                        }`}>
                                            {isCompleted ? <CheckCircle2 className="w-3 h-3" /> :
                                                isCurrent ? <CircleDashed className="w-3 h-3 animate-spin-slow" /> :
                                                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></span>}
                                        </div>
                                        <span className={`text-[8px] font-black uppercase tracking-widest ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {step}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin bg-muted/10 space-y-6">
                    {/* INFO SUMMARY CARD */}
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

                    {!isBalanced && disbursement.status !== "Posted" && (
                        <div className="bg-destructive/10 text-destructive border border-destructive/20 p-3 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Warning: Debits do not match Credits. This voucher cannot be submitted or posted.</span>
                        </div>
                    )}

                    {/* 🚀 UPGRADE 2: Tabbed Financials to save vertical space! */}
                    <div className="bg-card p-1 rounded-xl border border-border shadow-sm">
                        <Tabs defaultValue="payables" className="w-full">
                            <div className="px-4 pt-4 pb-2 border-b border-border flex justify-between items-center bg-muted/30">
                                <TabsList className="h-9 bg-muted">
                                    <TabsTrigger value="payables" className="text-[10px] font-black uppercase tracking-widest">
                                        Payables <Badge variant="secondary" className="ml-2 h-4 px-1">{disbursement.payables?.length || 0}</Badge>
                                    </TabsTrigger>
                                    <TabsTrigger value="payments" className="text-[10px] font-black uppercase tracking-widest">
                                        Payments <Badge variant="secondary" className="ml-2 h-4 px-1">{disbursement.payments?.length || 0}</Badge>
                                    </TabsTrigger>
                                </TabsList>
                                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground hidden sm:block">
                                    <ArrowLeftRight className="w-3 h-3 inline mr-1" /> Balanced Check
                                </div>
                            </div>

                            <TabsContent value="payables" className="p-0 m-0">
                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                    <Table>
                                        <TableHeader className="bg-muted/50 sticky top-0">
                                            <TableRow className="border-border">
                                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Ref No</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Account</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Remarks</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-right text-muted-foreground">Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {!disbursement.payables?.length ? (
                                                <TableRow><TableCell colSpan={4} className="text-center text-[10px] text-muted-foreground py-8 font-bold">No payables attached.</TableCell></TableRow>
                                            ) : disbursement.payables.map((p, i) => (
                                                <TableRow key={i} className="hover:bg-muted/50 border-border">
                                                    <TableCell className="text-xs font-bold uppercase text-foreground">{p.referenceNo || "N/A"}</TableCell>
                                                    <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{p.accountTitle || `COA: ${p.coaId}`}</TableCell>
                                                    <TableCell className="text-[10px] font-medium text-muted-foreground truncate max-w-[150px]">{p.remarks || "-"}</TableCell>
                                                    <TableCell className="text-xs font-black text-right text-foreground">{formatCurrency(p.amount)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                                <div className="bg-muted p-2 border-t border-border flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-muted-foreground">Total Debits</span>
                                    <span className="text-foreground">{formatCurrency(totalPayables)}</span>
                                </div>
                            </TabsContent>

                            <TabsContent value="payments" className="p-0 m-0">
                                <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                    <Table>
                                        <TableHeader className="bg-muted/50 sticky top-0">
                                            <TableRow className="border-border">
                                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Check / Ref</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground w-full">Bank Acct & GL</TableHead>
                                                <TableHead className="text-[9px] font-black uppercase tracking-widest text-right text-muted-foreground">Amount</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {!disbursement.payments?.length ? (
                                                <TableRow><TableCell colSpan={3} className="text-center text-[10px] text-muted-foreground py-8 font-bold">No payments processed yet.</TableCell></TableRow>
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
                                <div className="bg-muted p-2 border-t border-border flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                    <span className="text-muted-foreground">Total Credits</span>
                                    <span className="text-emerald-600 dark:text-emerald-500">{formatCurrency(totalPayments)}</span>
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                {/* 🚀 UPGRADE 3: The Smart Action Footer */}
                <div className="p-4 sm:p-6 bg-card border-t border-border shrink-0 flex justify-between items-center z-10">
                    <div className="relative">
                        {showPrintOptions ? (
                            <div className="flex items-center gap-2 animate-in slide-in-from-left-4 fade-in absolute bottom-0 left-0 bg-card p-1 border border-border shadow-lg rounded-lg">
                                <Button variant="outline" onClick={() => handlePrint("A4")} className="text-[10px] font-black uppercase tracking-widest h-9 px-3 hover:bg-muted">
                                    <FileText className="w-3.5 h-3.5 mr-2 text-blue-500" /> A4
                                </Button>
                                <Button variant="outline" onClick={() => handlePrint("58mm")} className="text-[10px] font-black uppercase tracking-widest h-9 px-3 hover:bg-muted">
                                    <Receipt className="w-3.5 h-3.5 mr-2 text-amber-500" /> Thermal
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setShowPrintOptions(false)} className="h-9 w-9 text-muted-foreground"><X className="w-4 h-4"/></Button>
                            </div>
                        ) : (
                            <Button variant="outline" onClick={() => setShowPrintOptions(true)} className="text-[10px] font-black uppercase tracking-widest h-10 px-4 sm:px-6 border-input shadow-sm">
                                <Printer className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Print</span>
                            </Button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        {/* Secondary Action: Edit or Return to Draft */}
                        {disbursement.status === "Draft" && onEdit && (
                            <Button variant="outline" onClick={() => onEdit(disbursement)} className="text-[10px] font-black uppercase tracking-widest h-10 px-4 sm:px-6 text-amber-600 border-amber-200 hover:bg-amber-50 dark:hover:bg-amber-950/30">
                                <Pencil className="w-4 h-4 sm:mr-2" /> <span className="hidden sm:inline">Edit Draft</span>
                            </Button>
                        )}
                        {disbursement.status !== "Draft" && disbursement.status !== "Posted" && (
                            <Button variant="outline" onClick={() => handleAction("Draft")} disabled={loading} className="text-[10px] font-black uppercase tracking-widest h-10 px-4 sm:px-6 text-destructive border-destructive/20 hover:bg-destructive/10">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4 sm:mr-2" />}
                                <span className="hidden sm:inline">Return to Draft</span>
                            </Button>
                        )}

                        {/* Primary Pipeline Action */}
                        {disbursement.status === "Draft" && (
                            <Button onClick={() => handleAction("Submitted")} disabled={loading || !isBalanced} className="text-[10px] font-black uppercase tracking-widest h-10 px-4 sm:px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-md disabled:opacity-50">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin sm:mr-2" /> : <SendIcon className="w-4 h-4 sm:mr-2" />}
                                <span className="hidden sm:inline">Submit for Approval</span>
                                <span className="sm:hidden">Submit</span>
                            </Button>
                        )}
                        {disbursement.status === "Submitted" && (
                            <Button onClick={() => handleAction("Approved")} disabled={loading} className="text-[10px] font-black uppercase tracking-widest h-10 px-4 sm:px-8 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin sm:mr-2" /> : <CheckCircle className="w-4 h-4 sm:mr-2" />}
                                <span className="hidden sm:inline">Approve Voucher</span>
                                <span className="sm:hidden">Approve</span>
                            </Button>
                        )}
                        {disbursement.status === "Approved" && (
                            <Button onClick={() => handleAction("Released")} disabled={loading} className="text-[10px] font-black uppercase tracking-widest h-10 px-4 sm:px-8 bg-purple-600 hover:bg-purple-700 text-white shadow-md">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin sm:mr-2" /> : <Send className="w-4 h-4 sm:mr-2" />}
                                <span className="hidden sm:inline">Release Check</span>
                                <span className="sm:hidden">Release</span>
                            </Button>
                        )}
                        {disbursement.status === "Released" && (
                            <Button onClick={() => handleAction("Posted")} disabled={loading || !isBalanced} className="text-[10px] font-black uppercase tracking-widest h-10 px-4 sm:px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md disabled:opacity-50">
                                {loading ? <Loader2 className="w-4 h-4 animate-spin sm:mr-2" /> : <Lock className="w-4 h-4 sm:mr-2" />}
                                <span className="hidden sm:inline">Post to GL</span>
                                <span className="sm:hidden">Post</span>
                            </Button>
                        )}
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}