"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    Loader2, CheckCircle, Wallet, Building2, AlertTriangle, FileText,
    CheckCircle2, CircleDashed, ChevronRight, ChevronDown, Paperclip, ExternalLink,
    Search, ArrowLeftRight
} from "lucide-react";
import { Disbursement } from "../types";
import { useDisbursement } from "../hooks/useDisbursement";
import { formatCurrency, VOUCHER_STEPS } from "../utils/disbursement-utils";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// Attachment preview sub-component
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
            <div className="bg-card rounded-xl border border-border p-3 shadow-sm flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Paperclip className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-0.5">Attachment / Supporting Docs</p>
                        <p className="text-xs font-bold text-foreground truncate max-w-[200px]">
                            {docUrl.split("/").pop() || "view_attachment"}
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" asChild className="text-[9px] font-black uppercase tracking-widest h-8 px-2.5 shrink-0">
                    <a href={viewUrl} target="_blank" rel="noopener noreferrer">
                        Open <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                </Button>
            </div>

            {/* Inline Preview */}
            <div className="overflow-hidden rounded-xl border border-border bg-muted/10">
                <div className="px-3 py-1.5 bg-muted/30 border-b border-border text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center justify-between">
                    <span>Attachment Preview</span>
                </div>
                <div className="p-2 flex justify-center items-center bg-card max-h-[300px] overflow-hidden">
                    {isPdf ? (
                        <iframe 
                            src={viewUrl} 
                            className="w-full h-[250px] border-0 rounded-lg" 
                            title="Supporting Document PDF" 
                        />
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                            src={viewUrl} 
                            alt="Supporting Document" 
                            className="max-h-[250px] max-w-full object-contain rounded-lg shadow-sm"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const parent = e.currentTarget.parentElement;
                                if (parent) {
                                    parent.innerHTML = '<div class="text-[9px] font-black uppercase tracking-widest text-muted-foreground p-4 text-center">Preview not available. Click "Open" above to view.</div>';
                                }
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// Tree view node sub-component
interface TreeNodeProps {
    title: string;
    icon: React.ReactNode;
    defaultExpanded?: boolean;
    children: React.ReactNode;
}

function TreeNode({ title, icon, defaultExpanded = true, children }: TreeNodeProps) {
    const [expanded, setExpanded] = useState(defaultExpanded);

    return (
        <div className="border border-border/60 rounded-xl bg-card overflow-hidden shadow-sm">
            <button 
                onClick={() => setExpanded(!expanded)} 
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/10 transition-colors text-left"
            >
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-[10px] font-black uppercase tracking-wider text-foreground">{title}</span>
                </div>
                {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </button>
            {expanded && (
                <div className="px-4 pb-4 border-t border-border/30 bg-muted/5 divide-y divide-border/30 animate-in slide-in-from-top-1 duration-150">
                    {children}
                </div>
            )}
        </div>
    );
}

export default function ApprovalSubmodule() {
    const {
        data, loading, changeStatus, actionLoading, refresh,
        docNoSearch, setDocNoSearch,
        startDate, setStartDate,
        endDate, setEndDate,
        supplierSearch, setSupplierSearch,
        filterSuppliers,
        applyFilters, clearFilters
    } = useDisbursement();

    // Limit approval workspace to 'Submitted' vouchers primarily, but support selecting others
    const [selectedDisbursement, setSelectedDisbursement] = useState<Disbursement | null>(null);

    // checklist checkbox states
    const [checkPayee, setCheckPayee] = useState(false);
    const [checkCostCenter, setCheckCostCenter] = useState(false);
    const [checkGLAccount, setCheckGLAccount] = useState(false);
    const [checkRemarks, setCheckRemarks] = useState(false);
    const [checkAttachments, setCheckAttachments] = useState(false);

    // Reset checklists when selecting a different voucher
    useEffect(() => {
        setCheckPayee(false);
        setCheckCostCenter(false);
        setCheckGLAccount(false);
        setCheckRemarks(false);
        setCheckAttachments(false);
    }, [selectedDisbursement]);

    // Force filters to "Submitted" status when loading
    const submittedVouchers = useMemo(() => {
        return data.filter(v => v.status === "Submitted");
    }, [data]);

    // Group payables by division
    const groupedPayables = useMemo(() => {
        if (!selectedDisbursement || !selectedDisbursement.payables) return {};
        const groups: Record<string, typeof selectedDisbursement.payables> = {};
        selectedDisbursement.payables.forEach(line => {
            const divKey = line.divisionName || "No Division / General";
            if (!groups[divKey]) {
                groups[divKey] = [];
            }
            groups[divKey].push(line);
        });
        return groups;
    }, [selectedDisbursement]);

    const isChecklistComplete = checkPayee && checkCostCenter && checkGLAccount && checkRemarks && (selectedDisbursement?.supportingDocumentsUrl ? checkAttachments : true);
    const [actionLocked, setActionLocked] = useState(false);
    const actionLockRef = useRef(false);

    const handleAction = async (status: string) => {
        if (!selectedDisbursement || actionLoading || actionLockRef.current) return;
        actionLockRef.current = true;
        setActionLocked(true);
        try {
            const success = await changeStatus(selectedDisbursement.id, status);
            if (success) {
                setSelectedDisbursement(null);
                refresh();
            }
        } finally {
            actionLockRef.current = false;
            setActionLocked(false);
        }
    };

    const isActionBusy = actionLoading || actionLocked;

    return (
        <div className="flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto min-h-[calc(100vh-140px)] animate-in fade-in duration-500">
            {/* LEFT COLUMN: PENDING VOUCHERS LIST */}
            <div className="w-full lg:w-[400px] shrink-0 flex flex-col gap-4">
                <Card className="rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden relative bg-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
                    <CardHeader className="py-4 border-b border-border bg-card">
                        <CardTitle className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                            <CircleDashed className="w-4 h-4 text-primary animate-spin-slow" />
                            Submitted Vouchers
                        </CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-1">
                            Pending your validation and review
                        </CardDescription>
                    </CardHeader>

                    {/* Quick Filters */}
                    <div className="p-3 bg-muted/10 border-b border-border space-y-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="VOUCHER NO..."
                                value={docNoSearch}
                                onChange={(e) => setDocNoSearch(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                                className="pl-8 h-8 text-[10px] font-bold uppercase bg-background"
                            />
                        </div>

                        {/* Date Range Filters */}
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">Start Date</Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                                    className="h-8 text-[9px] font-bold bg-background border-border/60"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">End Date</Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                                    className="h-8 text-[9px] font-bold bg-background border-border/60"
                                />
                            </div>
                        </div>

                        {/* Payee Filter */}
                        <div className="space-y-1">
                            <Label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground/80">Filter Payee</Label>
                            <select
                                className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-[9px] font-bold uppercase outline-none focus:ring-1 focus:ring-primary/20 cursor-pointer text-foreground"
                                value={supplierSearch}
                                onChange={(e) => setSupplierSearch(e.target.value)}
                            >
                                <option value="">All Payees</option>
                                {filterSuppliers.map(s => (
                                    <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex gap-2 pt-1">
                            <Button onClick={applyFilters} size="sm" className="flex-1 h-8 text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary/95 text-white">
                                Apply Filters
                            </Button>
                            <Button onClick={clearFilters} variant="outline" size="sm" className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-destructive hover:bg-destructive/5 border-border">
                                Clear
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto divide-y divide-border/60 max-h-[500px] lg:max-h-[600px] scrollbar-thin">
                        {loading ? (
                            <div className="py-12 flex flex-col justify-center items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                                <Loader2 className="animate-spin text-primary" /> Loading vouchers...
                            </div>
                        ) : submittedVouchers.length === 0 ? (
                            <div className="py-16 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">
                                No pending vouchers for approval
                            </div>
                        ) : (
                            submittedVouchers.map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => setSelectedDisbursement(v)}
                                    className={cn(
                                        "w-full p-4 flex flex-col text-left hover:bg-muted/15 transition-all outline-none",
                                        selectedDisbursement?.id === v.id ? "bg-muted/20 border-l-4 border-primary pl-3" : ""
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
                                        <Badge variant="outline" className="text-[8px] px-1.5 py-0 font-bold uppercase bg-blue-500/10 text-blue-600 border-blue-500/20">
                                            Submitted
                                        </Badge>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* RIGHT COLUMN: DETAIL WORKSPACE */}
            <div className="flex-1 min-w-0">
                {selectedDisbursement ? (
                    <Card className="rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col bg-card relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
                        <CardHeader className="py-5 px-6 border-b border-border bg-card">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div>
                                    <CardTitle className="text-xl font-black uppercase text-foreground flex items-center gap-2">
                                        <FileText className="w-5 h-5 text-primary opacity-70" />
                                        Reviewing: {selectedDisbursement.docNo}
                                    </CardTitle>
                                    <CardDescription className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                        Vouchered Date: {selectedDisbursement.transactionDate ? format(new Date(selectedDisbursement.transactionDate), "MMMM dd, yyyy") : "N/A"}
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/10 p-5 rounded-xl border border-border">
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-1">Payee / Supplier</span>
                                        <div className="flex items-center gap-2 text-sm font-black text-foreground uppercase">
                                            <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                                            {selectedDisbursement.payeeName}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-1">Voucher Amount</span>
                                        <div className="flex items-center gap-2 text-lg font-black text-emerald-600 dark:text-emerald-500">
                                            <Wallet className="w-4 h-4 shrink-0" />
                                            {formatCurrency(selectedDisbursement.totalAmount)}
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-1">Department</span>
                                        <span className="text-xs font-bold text-foreground uppercase">{selectedDisbursement.departmentName || "N/A"}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-1">Prepared By</span>
                                            <span className="text-xs font-bold text-foreground uppercase">{selectedDisbursement.submittedByName || selectedDisbursement.encoderName || "N/A"}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-1">Date Prepared</span>
                                            <span className="text-xs font-bold text-foreground uppercase">
                                                {selectedDisbursement.dateSubmitted ? format(new Date(selectedDisbursement.dateSubmitted), "MMM dd, yyyy HH:mm") : "Draft"}
                                            </span>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-1">Particulars / Remarks</span>
                                         <p className="text-xs font-semibold text-foreground bg-background p-2 rounded border border-border/80 break-words whitespace-pre-wrap">
                                             {selectedDisbursement.remarks || "No remarks provided."}
                                         </p>
                                    </div>
                                </div>
                            </div>

                            {/* Two-Column Details & Audit Verification Checklist */}
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {/* Tree View & Supporting Attachment details */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-foreground font-black uppercase tracking-widest text-[11px] pb-1 border-b border-border/50">
                                        <ArrowLeftRight className="w-4 h-4 text-orange-500" /> Voucher Tree Allocation View
                                    </div>

                                    <TreeNode 
                                        title="Voucher Debit Allocations" 
                                        icon={<ArrowLeftRight className="w-4 h-4 text-orange-500" />}
                                    >
                                        {!selectedDisbursement.payables?.length ? (
                                            <p className="text-xs text-muted-foreground py-2 font-bold uppercase text-center">No payables allocation lines found.</p>
                                        ) : (
                                            <div className="space-y-4 divide-y divide-border/40">
                                                {Object.entries(groupedPayables).map(([divisionName, lines]) => {
                                                    const subtotal = lines.reduce((sum, line) => sum + (line.amount || 0), 0);
                                                    return (
                                                        <div key={divisionName} className="space-y-2 pt-3 first:pt-0 first:border-t-0">
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                                    <Building2 className="w-3.5 h-3.5 text-primary/70" />
                                                                    {divisionName}
                                                                </span>
                                                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-500 font-mono">
                                                                    Subtotal: {formatCurrency(subtotal)}
                                                                </span>
                                                            </div>
                                                            <div className="divide-y divide-border/10 pl-3">
                                                                {lines.map((line, idx) => (
                                                                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                                                                        <div className="min-w-0">
                                                                            <span className="font-bold text-foreground block truncate">
                                                                                {line.accountTitle || `COA Code: ${line.coaId}`}
                                                                            </span>
                                                                            <span className="text-[9px] font-medium text-muted-foreground mt-0.5 block uppercase tracking-wide">
                                                                                Ref: {line.referenceNo || "N/A"} {line.remarks ? `· ${line.remarks}` : ""}
                                                                            </span>
                                                                        </div>
                                                                        <span className="font-black text-foreground font-mono shrink-0 ml-3">
                                                                            {formatCurrency(line.amount)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </TreeNode>

                                    {/* Supporting doc preview */}
                                    {selectedDisbursement.supportingDocumentsUrl ? (
                                        <AttachmentPreview docUrl={selectedDisbursement.supportingDocumentsUrl} />
                                    ) : (
                                        <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted/5">
                                            No attachments uploaded for this voucher.
                                        </div>
                                    )}
                                </div>

                                {/* Approver validation checklist */}
                                <div className="space-y-4 border-t xl:border-t-0 xl:border-l border-border/50 pt-4 xl:pt-0 xl:pl-6">
                                    <div className="flex items-center gap-2 text-foreground font-black uppercase tracking-widest text-[11px] pb-1 border-b border-border/50">
                                        <CheckCircle className="w-4 h-4 text-primary" /> Verification Checklist
                                    </div>

                                    <div className="p-4 rounded-xl border border-blue-200/50 bg-blue-50/10 dark:border-blue-800/20 text-xs font-semibold text-blue-800 dark:text-blue-400 uppercase tracking-wide leading-relaxed">
                                        Perform the visual audits below. You must physically verify each condition and check all items before approval is enabled.
                                    </div>

                                    <div className="space-y-3.5 pt-2">
                                        <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-muted/5 transition-colors">
                                            <Checkbox 
                                                id="check-payee" 
                                                checked={checkPayee} 
                                                onCheckedChange={(checked) => setCheckPayee(checked === true)}
                                                className="mt-0.5"
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <Label htmlFor="check-payee" className="text-xs font-black uppercase text-foreground cursor-pointer">
                                                    Payee & Supplier Registry Check
                                                </Label>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                                    The payee name matches the supplier registry and the invoice billing details.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-muted/5 transition-colors">
                                            <Checkbox 
                                                id="check-costcenter" 
                                                checked={checkCostCenter} 
                                                onCheckedChange={(checked) => setCheckCostCenter(checked === true)}
                                                className="mt-0.5"
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <Label htmlFor="check-costcenter" className="text-xs font-black uppercase text-foreground cursor-pointer">
                                                    Cost Center Alignment Check
                                                </Label>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                                    The cost division and department mapped in the header are correct.
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-muted/5 transition-colors">
                                            <Checkbox 
                                                id="check-glaccount" 
                                                checked={checkGLAccount} 
                                                onCheckedChange={(checked) => setCheckGLAccount(checked === true)}
                                                className="mt-0.5"
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <Label htmlFor="check-glaccount" className="text-xs font-black uppercase text-foreground cursor-pointer">
                                                    GL Account Allocations
                                                </Label>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                                    Every debit allocation line is mapped to the correct chart of accounts (COA).
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-muted/5 transition-colors">
                                            <Checkbox 
                                                id="check-remarks" 
                                                checked={checkRemarks} 
                                                onCheckedChange={(checked) => setCheckRemarks(checked === true)}
                                                className="mt-0.5"
                                            />
                                            <div className="grid gap-1.5 leading-none">
                                                <Label htmlFor="check-remarks" className="text-xs font-black uppercase text-foreground cursor-pointer">
                                                    Audit Trail Description Validation
                                                </Label>
                                                <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                                    Remarks clearly express the business purpose of the transaction.
                                                </p>
                                            </div>
                                        </div>

                                        {selectedDisbursement.supportingDocumentsUrl && (
                                            <div className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-muted/5 transition-colors">
                                                <Checkbox 
                                                    id="check-attachments" 
                                                    checked={checkAttachments} 
                                                    onCheckedChange={(checked) => setCheckAttachments(checked === true)}
                                                    className="mt-0.5"
                                                />
                                                <div className="grid gap-1.5 leading-none">
                                                    <Label htmlFor="check-attachments" className="text-xs font-black uppercase text-foreground cursor-pointer">
                                                        Attachment Validation
                                                    </Label>
                                                    <p className="text-[10px] font-bold text-muted-foreground uppercase">
                                                        Supporting documents have been visually inspected and match billing details.
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CardContent>

                        {/* Audit actions footer */}
                        <div className="p-6 bg-card border-t border-border shrink-0 flex justify-between items-center z-10">
                            <Button 
                                variant="destructive" 
                                onClick={() => handleAction("Returned for Revision")} 
                                disabled={isActionBusy}
                                className="h-11 px-6 text-xs font-black uppercase tracking-widest"
                            >
                                {isActionBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4 mr-2" />}
                                Return for Revision
                            </Button>

                            <Button 
                                onClick={() => handleAction("Approved")} 
                                disabled={isActionBusy || !isChecklistComplete}
                                className="h-11 px-10 text-xs font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/10 disabled:opacity-50"
                            >
                                {isActionBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                                Approve Voucher
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <Card className="rounded-2xl border border-dashed border-border/80 shadow-sm min-h-[400px] flex flex-col justify-center items-center text-center p-6 bg-card/30">
                        <div className="h-16 w-16 rounded-2xl bg-muted border border-border/50 flex items-center justify-center text-muted-foreground/60 mb-4 animate-pulse">
                            <FileText className="h-8 w-8" />
                        </div>
                        <h3 className="text-sm font-black uppercase text-foreground tracking-wider">No Voucher Selected</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2 max-w-[280px]">
                            Select a submitted voucher from the list on the left to start the verification checklist.
                        </p>
                    </Card>
                )}
            </div>
        </div>
    );
}
