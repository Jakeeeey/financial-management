"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Loader2, CheckCircle2, Lock, AlertTriangle,
    CircleDashed, ArrowDownToLine, ArrowUpFromLine, Search, X,
    Paperclip, ExternalLink
} from "lucide-react";
import { Disbursement, BankAccountDto, COADto } from "../types";
import { useDisbursement } from "../hooks/useDisbursement";
import { disbursementProvider } from "../providers/fetchProvider";
import { formatCurrency, VOUCHER_STEPS, getCookie, decodeToken } from "../utils/disbursement-utils";
import { StickyTableWrapper } from "../components/StickyTableWrapper";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

function AttachmentPreview({ docUrl }: { docUrl: string }) {
    const [contentType, setContentType] = useState<string>("");
    const cleanBase = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/+$/, "");
    const token = process.env.NEXT_PUBLIC_DIRECTUS_STATIC_TOKEN || "AAKv73dkIV8DfAIA5vEt3eXVdIebzmBW";
    const viewUrl = docUrl.startsWith("http") ? docUrl : `${cleanBase}/assets/${docUrl}?access_token=${token}`;

    useEffect(() => {
        if (!viewUrl) return;
        fetch(viewUrl, { method: "HEAD" })
            .then((res) => {
                const type = res.headers.get("content-type");
                if (type) setContentType(type.toLowerCase());
            })
            .catch((err) => console.warn("Failed to fetch document headers:", err));
    }, [viewUrl]);

    const isPdf = docUrl.toLowerCase().endsWith(".pdf") || viewUrl.toLowerCase().endsWith(".pdf") || contentType.includes("pdf");

    return (
        <div className="space-y-3">
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Paperclip className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Attachment / Supporting Docs</p>
                        <p className="text-xs font-bold text-foreground truncate max-w-[220px]">
                            {docUrl.split("/").pop() || "view_attachment"}
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" asChild className="text-[10px] font-black uppercase tracking-widest h-8 px-3">
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                        View <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                    </a>
                </Button>
            </div>

            {/* Inline Preview */}
            <div className="overflow-hidden rounded-xl border border-border bg-muted/20">
                <div className="px-4 py-2 bg-muted/50 border-b border-border text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                    <span>Attachment Preview</span>
                </div>
                <div className="p-3 flex justify-center items-center bg-card max-h-[320px] overflow-hidden">
                    {isPdf ? (
                        <iframe 
                            src={viewUrl} 
                            className="w-full h-[280px] border-0 rounded-lg" 
                            title="Supporting Document PDF" 
                        />
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                            src={viewUrl} 
                            alt="Supporting Document" 
                            className="max-h-[280px] max-w-full object-contain rounded-lg shadow-sm"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                    parent.innerHTML = '<div class="text-[10px] font-black uppercase tracking-widest text-muted-foreground p-4 text-center">Preview not available. Click "View" above to open.</div>';
                                }
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default function PostingSubmodule() {
    const {
        data, loading, changeStatus, actionLoading, refresh,
        docNoSearch, setDocNoSearch, applyFilters, clearFilters
    } = useDisbursement();

    const [selectedDisbursement, setSelectedDisbursement] = useState<Disbursement | null>(null);

    // Metadata lookups
    const [banks, setBanks] = useState<BankAccountDto[]>([]);
    const [coas, setCoas] = useState<COADto[]>([]);

    useEffect(() => {
        disbursementProvider.getBanks().then(setBanks).catch(() => console.warn("Failed to fetch banks"));
        disbursementProvider.getCOAs().then(setCoas).catch(() => console.warn("Failed to fetch COAs"));
    }, []);

    // Get current user ID to enforce Segregation of Duties
    const currentUserId = useMemo(() => {
        const token = getCookie("vos_access_token");
        const payload = decodeToken(token);
        return payload?.sub || null;
    }, []);

    // Derived states
    const postableVouchers = useMemo(() => {
        return data.filter(v => v.status === "Released" || v.status === "Partially Released");
    }, [data]);

    const totalDebit = useMemo(() => {
        if (!selectedDisbursement) return 0;
        return selectedDisbursement.payables?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    }, [selectedDisbursement]);

    const totalCredit = useMemo(() => {
        if (!selectedDisbursement) return 0;
        return selectedDisbursement.payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
    }, [selectedDisbursement]);

    const balance = useMemo(() => {
        return Number((totalDebit - totalCredit).toFixed(2));
    }, [totalDebit, totalCredit]);

    const isBalanced = Math.abs(balance) < 0.01;

    const isApproverOfSelected = useMemo(() => {
        if (!selectedDisbursement || !currentUserId) return false;
        return String(selectedDisbursement.approverId) === String(currentUserId);
    }, [selectedDisbursement, currentUserId]);

    const handlePost = async () => {
        if (!selectedDisbursement) return;
        const success = await changeStatus(selectedDisbursement.id, "Posted");
        if (success) {
            setSelectedDisbursement(null);
            refresh();
        }
    };

    return (
        <div className="flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto min-h-[calc(100vh-140px)] animate-in fade-in duration-500">
            {/* LEFT COLUMN: PENDING POSTING LIST */}
            <div className="w-full lg:w-[400px] shrink-0 flex flex-col gap-4">
                <Card className="rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden relative bg-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600" />
                    <CardHeader className="py-4 border-b border-border bg-card">
                        <CardTitle className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                            <Lock className="w-4 h-4 text-indigo-500" />
                            Released / Pending Posting
                        </CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-1">
                            Vouchers awaiting ledger closure
                        </CardDescription>
                    </CardHeader>

                    {/* Quick Filters */}
                    <div className="p-3 bg-muted/10 border-b border-border space-y-2">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="VOUCHER NO..."
                                    value={docNoSearch}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDocNoSearch(e.target.value)}
                                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => e.key === "Enter" && applyFilters()}
                                    className="pl-8 h-8 text-[10px] font-bold uppercase bg-background"
                                />
                            </div>
                            <Button onClick={applyFilters} size="sm" className="h-8 px-3 text-[10px] font-black uppercase tracking-widest">
                                Filter
                            </Button>
                            <Button onClick={clearFilters} variant="outline" size="icon" className="h-8 w-8 text-destructive border-border">
                                <X className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-border/60 max-h-[500px] lg:max-h-[600px] scrollbar-thin">
                        {loading ? (
                            <div className="py-12 flex flex-col justify-center items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                                <Loader2 className="animate-spin text-primary" /> Loading postable vouchers...
                            </div>
                        ) : postableVouchers.length === 0 ? (
                            <div className="py-16 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">
                                No released vouchers pending posting
                            </div>
                        ) : (
                            postableVouchers.map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => setSelectedDisbursement(v)}
                                    className={cn(
                                        "w-full p-4 flex flex-col text-left hover:bg-muted/15 transition-all outline-none",
                                        selectedDisbursement?.id === v.id ? "bg-muted/20 border-l-4 border-indigo-600 pl-3" : ""
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-xs font-black text-foreground uppercase tracking-wider">{v.docNo}</span>
                                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 font-mono">
                                            {formatCurrency(v.totalAmount)}
                                        </span>
                                    </div>
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase mt-1 truncate max-w-[340px]">
                                        Payee: {v.payeeName || "N/A"}
                                    </span>
                                    <div className="flex items-center justify-between mt-2.5 w-full">
                                        <span className="text-[9px] font-medium text-muted-foreground/80">
                                            {v.transactionDate ? format(new Date(v.transactionDate), "MMM dd, yyyy") : ""}
                                        </span>
                                        <Badge variant="outline" className={cn(
                                            "text-[8px] px-1.5 py-0 font-bold uppercase",
                                            v.status === "Released" 
                                                ? "bg-purple-500/10 text-purple-600 border-purple-500/20" 
                                                : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                        )}>
                                            {v.status}
                                        </Badge>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* RIGHT COLUMN: POSTING DETAILS & BALANCE CHECK */}
            <div className="flex-1 min-w-0">
                {selectedDisbursement ? (
                    <Card className="rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col bg-card relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-indigo-600" />
                        <CardHeader className="py-5 px-6 border-b border-border bg-card">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl font-black uppercase text-foreground flex items-center gap-2">
                                        <Lock className="w-5 h-5 text-indigo-500 opacity-80" />
                                        Ledger Posting: {selectedDisbursement.docNo}
                                    </CardTitle>
                                    <CardDescription className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                        Double-Entry General Ledger Balance Audit
                                    </CardDescription>
                                </div>
                                <Badge variant="outline" className="px-3 py-1 bg-muted font-black uppercase tracking-widest text-[10px]">
                                    {selectedDisbursement.status}
                                </Badge>
                            </div>

                            {/* Stepper Progress */}
                            <div className="mt-6 pt-4 border-t border-border/50">
                                <div className="flex items-center justify-between relative">
                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-muted"></div>
                                    <div
                                        className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-primary transition-all duration-500"
                                        style={{ width: `${(VOUCHER_STEPS.indexOf(selectedDisbursement.status) / (VOUCHER_STEPS.length - 1)) * 100}%` }}
                                    ></div>

                                    {VOUCHER_STEPS.map((step, idx) => {
                                        const currentStepIndex = VOUCHER_STEPS.indexOf(selectedDisbursement.status);
                                        const isCompleted = idx < currentStepIndex;
                                        const isCurrent = idx === currentStepIndex;
                                        return (
                                            <div key={step} className="relative z-10 flex flex-col items-center gap-1.5 bg-card px-2">
                                                <div className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
                                                    isCompleted ? 'bg-primary text-primary-foreground' :
                                                        isCurrent ? 'bg-blue-500 text-white shadow-[0_0_10px_rgba(59,130,246,0.5)]' :
                                                            'bg-muted border border-border text-muted-foreground'
                                                }`}>
                                                    {isCompleted ? <CheckCircle2 className="w-3 h-3" /> :
                                                        isCurrent ? <CircleDashed className="w-3 h-3 animate-spin-slow" /> :
                                                            <span className="w-1 h-1 rounded-full bg-current opacity-50"></span>}
                                                </div>
                                                <span className={`text-[8px] font-black uppercase tracking-widest ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                    {step}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="p-6 space-y-6">
                            {/* Summary Metadata */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/10 p-5 rounded-xl border border-border">
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">Payee</span>
                                        <span className="text-xs font-black text-foreground uppercase">{selectedDisbursement.payeeName}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">Voucher Limit</span>
                                        <span className="text-sm font-black text-primary">{formatCurrency(selectedDisbursement.totalAmount)}</span>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">Department</span>
                                        <span className="text-xs font-bold text-foreground uppercase">{selectedDisbursement.departmentName || "N/A"}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">Voucher Approver</span>
                                            <span className="text-xs font-bold text-foreground uppercase truncate block">{selectedDisbursement.approverName || "Unknown Approver"}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">Released By</span>
                                            <span className="text-xs font-bold text-foreground uppercase truncate block">{selectedDisbursement.releasedByName || "Not Released"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Supporting Attachment Preview */}
                            {selectedDisbursement.supportingDocumentsUrl ? (
                                <AttachmentPreview docUrl={selectedDisbursement.supportingDocumentsUrl} />
                            ) : null}

                            {/* Dual Side-by-Side Tables for Debit/Credit Audit */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {/* Debits side */}
                                <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col shadow-sm">
                                    <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-foreground font-black uppercase tracking-widest text-[11px]">
                                            <ArrowDownToLine className="w-4 h-4 text-orange-500"/> Payables (Debits)
                                        </span>
                                        <Badge variant="secondary" className="h-5 px-2">{selectedDisbursement.payables?.length || 0} Lines</Badge>
                                    </div>
                                    <StickyTableWrapper className="overflow-auto max-h-[250px] custom-scrollbar">
                                        <Table>
                                            <TableHeader className="bg-muted/80 backdrop-blur-md sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                                                <TableRow className="border-border">
                                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground w-[120px]">Ref No</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Chart of Account</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-right text-muted-foreground w-[100px]">Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedDisbursement.payables?.map((p, i) => (
                                                    <TableRow key={i} className="hover:bg-muted/50 border-border">
                                                        <TableCell className="text-xs font-bold uppercase text-foreground">{p.referenceNo || "N/A"}</TableCell>
                                                        <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">{p.accountTitle || `COA: ${p.coaId}`}</TableCell>
                                                        <TableCell className="text-xs font-black text-right text-foreground">{formatCurrency(p.amount)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </StickyTableWrapper>
                                    <div className="bg-muted/50 px-4 py-2 border-t border-border flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-muted-foreground">Total Debits</span>
                                        <span className="text-foreground">{formatCurrency(totalDebit)}</span>
                                    </div>
                                </div>

                                {/* Credits side */}
                                <div className="bg-card rounded-xl border border-border overflow-hidden flex flex-col shadow-sm">
                                    <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
                                        <span className="flex items-center gap-2 text-foreground font-black uppercase tracking-widest text-[11px]">
                                            <ArrowUpFromLine className="w-4 h-4 text-emerald-500"/> Bank Checks (Credits)
                                        </span>
                                        <Badge variant="secondary" className="h-5 px-2">{selectedDisbursement.payments?.length || 0} Lines</Badge>
                                    </div>
                                    <StickyTableWrapper className="overflow-auto max-h-[250px] custom-scrollbar">
                                        <Table>
                                            <TableHeader className="bg-muted/80 backdrop-blur-md sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                                                <TableRow className="border-border">
                                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground w-[110px]">Date</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground w-[125px]">Check No.</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Bank & GL</TableHead>
                                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-right text-muted-foreground w-[100px]">Amount</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {selectedDisbursement.payments?.map((p, i) => {
                                                    const matchedBank = banks.find(b => b.bankId === p.bankId);
                                                    const displayBank = matchedBank ? matchedBank.bankName : `Bank ID: ${p.bankId}`;
                                                    const matchedCoa = coas.find(c => c.coaId === p.coaId);
                                                    const displayCoa = matchedCoa ? matchedCoa.accountTitle : `GL: ${p.coaId}`;

                                                    return (
                                                        <TableRow key={i} className="hover:bg-muted/50 border-border">
                                                            <TableCell className="text-[10px] font-bold uppercase text-muted-foreground">
                                                                {p.date ? format(new Date(p.date), "MMM dd, yyyy") : "N/A"}
                                                            </TableCell>
                                                            <TableCell className="text-xs font-bold uppercase text-foreground">{p.checkNo || "N/A"}</TableCell>
                                                            <TableCell className="text-[10px] font-bold text-muted-foreground uppercase">
                                                                <div className="flex flex-col">
                                                                    <span className="text-foreground">{displayBank}</span>
                                                                    <span className="text-[9px] text-primary/70 mt-0.5">{displayCoa}</span>
                                                                </div>
                                                            </TableCell>
                                                            <TableCell className="text-xs font-black text-right text-emerald-600 dark:text-emerald-500">{formatCurrency(p.amount)}</TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </TableBody>
                                        </Table>
                                    </StickyTableWrapper>
                                    <div className="bg-muted/50 px-4 py-2 border-t border-border flex justify-between items-center text-[10px] font-black uppercase tracking-widest">
                                        <span className="text-muted-foreground">Total Credits</span>
                                        <span className="text-emerald-600 dark:text-emerald-500">{formatCurrency(totalCredit)}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Balance check block */}
                            <div className="p-4 rounded-xl border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-muted/20">
                                <div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Double-Entry Verification Check</h4>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">Debits (calculated total payables) must equal Credits (calculated issued checks)</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black uppercase text-muted-foreground tracking-wider">Discrepancy:</span>
                                    <Badge className={cn(
                                        "h-9 px-4 rounded-lg font-mono text-xs font-black flex items-center justify-center border-none text-white",
                                        isBalanced ? "bg-emerald-600" : "bg-destructive shadow-md shadow-destructive/15"
                                    )}>
                                        {formatCurrency(balance)}
                                    </Badge>
                                </div>
                            </div>

                            {/* Warnings / Blocks */}
                            {!isBalanced && (
                                <div className="p-4 rounded-xl border border-dashed border-rose-200 bg-rose-50/10 dark:border-rose-800/20 text-rose-700 dark:text-rose-400 flex items-center gap-3 animate-in fade-in duration-300">
                                    <AlertTriangle className="w-5 h-5 shrink-0" />
                                    <div className="text-[10px] font-black uppercase tracking-wider leading-relaxed">
                                        Posting Blocked: The ledger is unbalanced by {formatCurrency(balance)}. Total debits must match credits exactly.
                                    </div>
                                </div>
                            )}

                            {isApproverOfSelected && (
                                <div className="p-4 rounded-xl border border-dashed border-rose-200 bg-rose-50/10 dark:border-rose-800/20 text-rose-700 dark:text-rose-400 flex items-center gap-3 animate-in fade-in duration-300">
                                    <AlertTriangle className="w-5 h-5 shrink-0" />
                                    <div className="text-[10px] font-black uppercase tracking-wider leading-relaxed">
                                        Segregation of Duties Violation: You signed off as the Approver for this voucher ({selectedDisbursement.approverName}). Independent review is required; you are blocked from posting it.
                                    </div>
                                </div>
                            )}
                        </CardContent>

                        {/* Audit actions footer */}
                        <div className="p-6 bg-card border-t border-border shrink-0 flex justify-between items-center z-10">
                            <Button 
                                variant="outline" 
                                onClick={() => setSelectedDisbursement(null)} 
                                disabled={actionLoading}
                                className="h-11 px-6 text-xs font-black uppercase tracking-widest border-border/80"
                            >
                                Close Details
                            </Button>

                            <Button 
                                onClick={handlePost} 
                                disabled={actionLoading || !isBalanced || isApproverOfSelected}
                                className="h-11 px-10 text-xs font-black uppercase tracking-widest bg-primary hover:bg-primary/95 text-primary-foreground shadow-md disabled:opacity-50"
                            >
                                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
                                Post to General Ledger
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <Card className="rounded-2xl border border-dashed border-border/80 shadow-sm min-h-[400px] flex flex-col justify-center items-center text-center p-6 bg-card/30">
                        <div className="h-16 w-16 rounded-2xl bg-muted border border-border/50 flex items-center justify-center text-muted-foreground/60 mb-4 animate-pulse">
                            <Lock className="h-8 w-8 text-indigo-500" />
                        </div>
                        <h3 className="text-sm font-black uppercase text-foreground tracking-wider">No Voucher Selected</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2 max-w-[280px]">
                            Select a released voucher from the list on the left to verify ledger balances and post to the General Ledger.
                        </p>
                    </Card>
                )}
            </div>
        </div>
    );
}
