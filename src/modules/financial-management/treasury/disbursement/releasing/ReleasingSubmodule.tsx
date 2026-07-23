"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Loader2, AlertTriangle, FileText,
    Search, X, Printer, Plus, Trash2, Check, ChevronsUpDown, ArrowUpFromLine
} from "lucide-react";
import { Disbursement, BankAccountDto, COADto, PaymentLine, DisbursementPayload } from "../types";
import { useDisbursement } from "../hooks/useDisbursement";
import { disbursementProvider } from "../providers/fetchProvider";
import { formatCurrency, numberToWords } from "../utils/disbursement-utils";
import { generateDisbursementPDF, generateCheckLeafPDF } from "../utils/pdfGenerator";

import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Simple custom searchable select for inline table dropdowns
interface SearchSelectProps<T extends string | number> {
    options: { label: string; value: T }[];
    value: T | "";
    onSelect: (val: T) => void;
    placeholder: string;
    className?: string;
}

function SearchSelect<T extends string | number>({ options, value, onSelect, placeholder, className }: SearchSelectProps<T>) {
    const [open, setOpen] = useState(false);
    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || placeholder;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className={cn("justify-between w-full h-8 text-[11px] font-bold uppercase bg-background px-2", className)}>
                    <span className="truncate">{selectedLabel}</span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0 shadow-lg border-border" align="start">
                <Command>
                    <CommandInput placeholder="Search..." className="h-8 text-xs" />
                    <CommandList className="max-h-[200px] scrollbar-thin">
                        <CommandEmpty className="py-3 text-center text-xs text-muted-foreground font-bold">No matches found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt, idx) => (
                                <CommandItem
                                    key={`${opt.value}-${idx}`}
                                    value={opt.label}
                                    onSelect={() => {
                                        onSelect(opt.value);
                                        setOpen(false);
                                    }}
                                    className="text-xs cursor-pointer py-1.5"
                                >
                                    <Check className={cn("mr-2 h-3.5 w-3.5 text-primary", String(value) === String(opt.value) ? "opacity-100" : "opacity-0")} />
                                    {opt.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default function ReleasingSubmodule() {
    const {
        data, loading, changeStatus, update, actionLoading, refresh,
        docNoSearch, setDocNoSearch, applyFilters, clearFilters
    } = useDisbursement();

    const [selectedDisbursement, setSelectedDisbursement] = useState<Disbursement | null>(null);

    // Metadata lookups
    const [banks, setBanks] = useState<BankAccountDto[]>([]);
    const [coas, setCoas] = useState<COADto[]>([]);
    const [loadingMetadata, setLoadingMetadata] = useState(false);

    // Check payments local state
    const [payments, setPayments] = useState<PaymentLine[]>([]);

    // Print Check states
    const [printCheckOpen, setPrintCheckOpen] = useState(false);
    const [activePrintCheck, setActivePrintCheck] = useState<PaymentLine | null>(null);
    const [calibrationX, setCalibrationX] = useState<number>(0);
    const [calibrationY, setCalibrationY] = useState<number>(0);

    // Releasing prompt state
    const [releasingPromptOpen, setReleasingPromptOpen] = useState(false);
    const [actionLocked, setActionLocked] = useState(false);
    const actionLockRef = useRef(false);
    const saveLockRef = useRef(false);

    // Fetch active banks and COAs
    useEffect(() => {
        setLoadingMetadata(true);
        Promise.all([
            disbursementProvider.getBanks().catch(() => []),
            disbursementProvider.getCOAs().catch(() => [])
        ]).then(([bankList, coaList]) => {
            setBanks(bankList);
            setCoas(coaList);
        }).finally(() => {
            setLoadingMetadata(false);
        });
    }, []);

    // Set local payments state on voucher select
    useEffect(() => {
        if (selectedDisbursement) {
            setPayments(selectedDisbursement.payments?.map(p => ({
                id: p.id,
                checkNo: p.checkNo || "",
                date: p.date ? p.date.split("T")[0] : new Date().toISOString().split("T")[0],
                amount: p.amount,
                coaId: p.coaId,
                bankId: p.bankId,
                remarks: p.remarks || ""
            })) || []);
        } else {
            setPayments([]);
        }
    }, [selectedDisbursement]);

    // Derived states
    const approvedVouchers = useMemo(() => {
        return data.filter(v => v.status === "Approved" || v.status === "Partially Released");
    }, [data]);

    const totalPaymentsAmount = useMemo(() => {
        return payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    }, [payments]);

    const paymentCoas = useMemo(() => {
        return coas.filter(c => c.isPayment);
    }, [coas]);

    const handleAddPayment = () => {
        const remaining = Number(((selectedDisbursement?.totalAmount || 0) - totalPaymentsAmount).toFixed(2));
        const autoCoaId = paymentCoas.length === 1 ? paymentCoas[0].coaId : undefined;

        setPayments([...payments, {
            checkNo: "",
            date: new Date().toISOString().split("T")[0],
            amount: remaining > 0 ? remaining : 0,
            coaId: autoCoaId,
            remarks: ""
        }]);
    };

    const handleRemovePayment = (idx: number) => {
        setPayments(payments.filter((_, i) => i !== idx));
    };

    const handlePaymentChange = <K extends keyof PaymentLine>(idx: number, key: K, val: PaymentLine[K]) => {
        const copy = [...payments];
        copy[idx] = { ...copy[idx], [key]: val };
        setPayments(copy);
    };

    // Save checks allocation to backend
    const handleSavePayments = async () => {
        if (!selectedDisbursement || actionLoading || saveLockRef.current) return false;
        saveLockRef.current = true;

        try {
            // validate payments
            for (let i = 0; i < payments.length; i++) {
                const p = payments[i];
                const selectedCoa = coas.find(c => c.coaId === p.coaId);
                const accountTitle = selectedCoa?.accountTitle || "";
                const isCashOrPetty = accountTitle.toLowerCase().includes("petty cash") ||
                                      accountTitle.toLowerCase().includes("cash") ||
                                      accountTitle.toLowerCase().includes("revolving");

                if (!isCashOrPetty && !p.checkNo) {
                    toast.error(`Please provide a check number on check row ${i + 1}`);
                    return false;
                }
                if (!p.bankId) {
                    toast.error(`Please select a bank account on check row ${i + 1}`);
                    return false;
                }
                if (!p.coaId) {
                    toast.error(`Please select a GL COA account on check row ${i + 1}`);
                    return false;
                }
            }

            const payload: DisbursementPayload = {
                docNo: selectedDisbursement.docNo,
                payeeId: selectedDisbursement.payeeId || 0,
                remarks: selectedDisbursement.remarks,
                totalAmount: selectedDisbursement.totalAmount,
                transactionDate: selectedDisbursement.transactionDate,
                divisionId: selectedDisbursement.divisionId,
                departmentId: selectedDisbursement.departmentId,
                supportingDocumentsUrl: selectedDisbursement.supportingDocumentsUrl,
                payables: selectedDisbursement.payables,
                payments: payments.map(p => ({
                    ...p,
                    coaId: Number(p.coaId),
                    bankId: Number(p.bankId)
                }))
            };

            const success = await update(selectedDisbursement.id, payload);
            if (success) {
                refresh();
                const updated = data.find(v => v.id === selectedDisbursement.id);
                if (updated) setSelectedDisbursement(updated);
                return true;
            }
            return false;
        } finally {
            saveLockRef.current = false;
        }
    };

    // Release Check button logic
    const handleReleaseVoucher = async () => {
        if (!selectedDisbursement || actionLoading || actionLockRef.current) return;
        actionLockRef.current = true;
        setActionLocked(true);

        try {
            // Save current payments state first to avoid stale release
            const saved = await handleSavePayments();
            if (!saved) return;

            const freshTotalPaymentsAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
            const diff = Math.abs(selectedDisbursement.totalAmount - freshTotalPaymentsAmount);

            if (diff < 0.01) {
                await handleCommitRelease("Released", true);
            } else {
                setReleasingPromptOpen(true);
            }
        } finally {
            actionLockRef.current = false;
            setActionLocked(false);
        }
    };

    const handleCommitRelease = async (status: string, lockAlreadyHeld = false) => {
        setReleasingPromptOpen(false);
        if (!selectedDisbursement || actionLoading || (!lockAlreadyHeld && actionLockRef.current)) return;
        if (!lockAlreadyHeld) {
            actionLockRef.current = true;
            setActionLocked(true);
        }
        try {
            const success = await changeStatus(selectedDisbursement.id, status);
            if (success) {
                setSelectedDisbursement(null);
                refresh();
            }
        } finally {
            if (!lockAlreadyHeld) {
                actionLockRef.current = false;
                setActionLocked(false);
            }
        }
    };

    const isActionBusy = actionLoading || actionLocked;

    const handlePrintCheck = (p: PaymentLine) => {
        setActivePrintCheck(p);
        setPrintCheckOpen(true);
    };

    // Load calibration from localStorage on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const savedX = localStorage.getItem("check_print_calibration_x");
            const savedY = localStorage.getItem("check_print_calibration_y");
            if (savedX !== null) setCalibrationX(Number(savedX));
            if (savedY !== null) setCalibrationY(Number(savedY));
        }
    }, []);

    // Spaced out boxed check date (MM-DD-YYYY) parsing
    const checkDateDigits = useMemo(() => {
        if (!activePrintCheck?.date) return { mm: "", dd: "", yyyy: "" };
        let dateStr = activePrintCheck.date;
        if (dateStr.includes("T")) {
            dateStr = dateStr.split("T")[0];
        }
        let mm = "";
        let dd = "";
        let yyyy = "";
        if (dateStr.includes("-")) {
            const parts = dateStr.split("-");
            if (parts.length === 3) {
                yyyy = parts[0];
                mm = parts[1];
                dd = parts[2];
            }
        }
        if (!mm || !dd || !yyyy) {
            const dObj = new Date(activePrintCheck.date);
            mm = String(dObj.getMonth() + 1).padStart(2, "0");
            dd = String(dObj.getDate()).padStart(2, "0");
            yyyy = String(dObj.getFullYear());
        }
        return { mm, dd, yyyy };
    }, [activePrintCheck]);

    return (
        <div className="flex flex-col lg:flex-row gap-6 max-w-[1600px] mx-auto min-h-[calc(100vh-140px)] animate-in fade-in duration-500">
            {/* LEFT COLUMN: APPROVED VOUCHERS LIST */}
            <div className="w-full lg:w-[400px] shrink-0 flex flex-col gap-4">
                <Card className="rounded-2xl border border-border shadow-sm flex flex-col overflow-hidden relative bg-card">
                    <div className="absolute top-0 left-0 w-full h-1 bg-purple-600" />
                    <CardHeader className="py-4 border-b border-border bg-card">
                        <CardTitle className="text-sm font-black uppercase text-foreground flex items-center gap-2">
                            <ArrowUpFromLine className="w-4 h-4 text-purple-600" />
                            Approved Vouchers
                        </CardTitle>
                        <CardDescription className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mt-1">
                            Awaiting checks issuance & release
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
                                    onChange={(e) => setDocNoSearch(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && applyFilters()}
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
                                <Loader2 className="animate-spin text-primary" /> Loading Vouchers...
                            </div>
                        ) : approvedVouchers.length === 0 ? (
                            <div className="py-16 text-center text-xs font-black text-muted-foreground uppercase tracking-widest">
                                No approved vouchers to release
                            </div>
                        ) : (
                            approvedVouchers.map((v) => (
                                <button
                                    key={v.id}
                                    onClick={() => setSelectedDisbursement(v)}
                                    className={cn(
                                        "w-full p-4 flex flex-col text-left hover:bg-muted/15 transition-all outline-none",
                                        selectedDisbursement?.id === v.id ? "bg-muted/20 border-l-4 border-purple-600 pl-3" : ""
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
                                        <Badge variant="outline" className="text-[8px] px-1.5 py-0 font-bold uppercase bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                                            Approved
                                        </Badge>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </Card>
            </div>

            {/* RIGHT COLUMN: RELEASING WORKSPACE */}
            <div className="flex-1 min-w-0">
                {selectedDisbursement ? (
                    <Card className="rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col bg-card relative">
                        <div className="absolute top-0 left-0 w-1 h-full bg-purple-600" />
                        <CardHeader className="py-5 px-6 border-b border-border bg-card flex flex-row justify-between items-center">
                            <div>
                                <CardTitle className="text-xl font-black uppercase text-foreground flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-purple-600" />
                                    Releasing Workspace: {selectedDisbursement.docNo}
                                </CardTitle>
                                <CardDescription className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                                    Approved Voucher metadata and payments matching
                                </CardDescription>
                            </div>
                            <Button 
                                variant="outline" 
                                onClick={() => generateDisbursementPDF(selectedDisbursement, "A4")} 
                                className="h-9 px-3.5 text-[9px] font-black uppercase tracking-widest border-border/80"
                            >
                                <Printer className="w-3.5 h-3.5 mr-1 text-blue-500" /> Voucher PDF
                            </Button>
                        </CardHeader>

                        <CardContent className="p-6 space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-muted/10 p-5 rounded-xl border border-border">
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">Payee</span>
                                        <span className="text-xs font-black text-foreground uppercase">{selectedDisbursement.payeeName}</span>
                                    </div>
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">Approved Payable Amount</span>
                                        <span className="text-lg font-black text-primary">{formatCurrency(selectedDisbursement.totalAmount)}</span>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <div>
                                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">Department</span>
                                        <span className="text-xs font-bold text-foreground uppercase">{selectedDisbursement.departmentName || "N/A"}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">Particulars / Remarks</span>
                                            <span className="text-xs font-semibold text-foreground truncate block">{selectedDisbursement.remarks || "No remarks provided."}</span>
                                        </div>
                                        <div>
                                            <span className="text-[9px] font-black uppercase text-muted-foreground tracking-widest block mb-0.5">Voucher Approver</span>
                                            <span className="text-xs font-bold text-foreground uppercase truncate block">{selectedDisbursement.approverName || "Unknown Approver"}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* QuickBooks Check Leafs Container */}
                            <div className="bg-card p-1 rounded-xl border border-border shadow-sm space-y-4">
                                <div className="px-4 pt-4 pb-2 border-b border-border flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-foreground font-black uppercase tracking-widest text-[11px]">
                                        <ArrowUpFromLine className="w-3.5 h-3.5 text-purple-600" /> QuickBooks Check leaves (Credits)
                                    </div>
                                    <Button onClick={handleAddPayment} disabled={loadingMetadata} size="sm" className="h-8 px-3.5 bg-purple-600 hover:bg-purple-700 text-white font-black uppercase tracking-widest text-[9px]">
                                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Check
                                    </Button>
                                </div>

                                <div className="px-4 pb-4 space-y-5 max-h-[480px] overflow-y-auto scrollbar-thin">
                                    {payments.length === 0 ? (
                                        <div className="py-16 text-center text-xs font-black text-muted-foreground uppercase tracking-widest bg-muted/5 rounded-xl border border-dashed border-border/80">
                                            No check leaves issued yet. Click &quot;Add Check&quot; above.
                                        </div>
                                    ) : (
                                        payments.map((line, idx) => {
                                            const amountInWords = numberToWords(line.amount || 0);
                                            return (
                                                <div key={idx} className="relative bg-card border border-border/80 rounded-2xl p-6 shadow-md hover:shadow-lg transition-all space-y-5">
                                                    {/* Top control bar: Header */}
                                                    <div className="flex flex-row justify-between items-center pb-3 border-b border-border">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-xs font-black text-foreground uppercase tracking-widest">Check Leaf #{idx + 1}</span>
                                                            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 hover:bg-purple-100 font-bold text-[8px] uppercase tracking-wider">Approved Queue</Badge>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <Button 
                                                                type="button"
                                                                variant="outline" 
                                                                size="sm" 
                                                                disabled={!line.checkNo || !line.bankId || !line.amount}
                                                                onClick={() => handlePrintCheck(line)}
                                                                className="h-8 text-[9px] font-black uppercase tracking-widest bg-white dark:bg-zinc-800 text-foreground border-border hover:bg-muted/50"
                                                            >
                                                                <Printer className="w-3.5 h-3.5 mr-1 text-purple-600" /> Print leaf
                                                            </Button>
                                                            <Button 
                                                                type="button"
                                                                variant="ghost" 
                                                                size="icon" 
                                                                onClick={() => handleRemovePayment(idx)} 
                                                                className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    {/* Visual Check Leaf Preview (Modernized QuickBooks style) */}
                                                    <div className="bg-gradient-to-br from-purple-50/50 via-slate-50/50 to-indigo-50/50 dark:from-zinc-900/40 dark:via-zinc-900/20 dark:to-zinc-950/40 rounded-xl p-5 border border-dashed border-border/80 relative space-y-4 shadow-inner">
                                                        {/* Top row of check */}
                                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                                            <div className="space-y-0.5">
                                                                <span className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block font-mono">DRAWEE BANK</span>
                                                                <span className="text-xs font-black text-foreground uppercase tracking-wide">
                                                                    {banks.find(b => b.bankId === line.bankId)?.bankName || "No Bank Selected"}
                                                                </span>
                                                            </div>
                                                            <div className="text-right font-mono text-[9px] text-muted-foreground/80 space-y-0.5 self-end sm:self-auto">
                                                                <div>NO: <span className="font-bold text-foreground">{line.checkNo || "------"}</span></div>
                                                                <div>DATE: <span className="font-bold text-foreground">{line.date ? format(new Date(line.date), "MM/dd/yyyy") : "--/--/----"}</span></div>
                                                            </div>
                                                        </div>

                                                        {/* Payee row */}
                                                        <div className="flex items-end gap-2 border-b border-zinc-300 dark:border-zinc-800 pb-1">
                                                            <span className="text-[8px] font-black text-muted-foreground/80 tracking-widest font-mono shrink-0 mb-1">PAY TO THE ORDER OF:</span>
                                                            <span className="text-xs font-black text-foreground uppercase tracking-wider flex-1 truncate pb-0.5">
                                                                {selectedDisbursement.payeeName}
                                                            </span>
                                                        </div>

                                                        {/* Written Amount & Numeric Box */}
                                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                                                            <div className="flex items-end gap-2 border-b border-zinc-300 dark:border-zinc-800 pb-1 flex-1 w-full">
                                                                <span className="text-[8px] font-black text-muted-foreground/80 tracking-widest font-mono shrink-0 mb-1">PESOS:</span>
                                                                <span className="text-[10px] font-bold text-zinc-600 dark:text-zinc-400 italic flex-1 pb-0.5 leading-relaxed">
                                                                    {amountInWords}
                                                                </span>
                                                            </div>
                                                            <div className="bg-white dark:bg-zinc-950 px-4 py-2 rounded-lg border border-border/80 flex items-center gap-2 font-mono shrink-0 w-full sm:w-auto shadow-sm">
                                                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">PHP</span>
                                                                <span className="text-sm font-black text-foreground">
                                                                    {line.amount ? formatCurrency(line.amount).replace("₱", "") : "0.00"}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Form Inputs Grid (modern, highly styled) */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                                                        <div>
                                                            <label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground block mb-1">Check Date</label>
                                                            <Input 
                                                                type="date"
                                                                className="h-9 text-xs font-bold bg-background border-border" 
                                                                value={line.date} 
                                                                onChange={e => handlePaymentChange(idx, "date", e.target.value)} 
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground block mb-1">Check No.</label>
                                                            <Input 
                                                                className="h-9 text-xs font-bold bg-background border-border placeholder:text-muted-foreground/30 font-mono" 
                                                                placeholder="CK-000000"
                                                                value={line.checkNo} 
                                                                onChange={e => handlePaymentChange(idx, "checkNo", e.target.value)} 
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground block mb-1">Check Amount (PHP)</label>
                                                            <Input 
                                                                type="number"
                                                                className="h-9 text-xs font-black bg-background border-border text-right font-mono text-emerald-600 dark:text-emerald-400" 
                                                                placeholder="0.00"
                                                                value={line.amount || ""} 
                                                                onChange={e => handlePaymentChange(idx, "amount", e.target.value === "" ? 0 : Number(e.target.value))} 
                                                            />
                                                        </div>
                                                        <div className="sm:col-span-2 md:col-span-1">
                                                            <div className="h-full flex items-end">
                                                                <span className="text-[8px] font-bold text-muted-foreground/50 uppercase tracking-widest block mb-2 font-mono">PHP CURRENCY</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/60">
                                                        <div>
                                                            <label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground block mb-1">Draw Bank Account</label>
                                                            <SearchSelect<number>
                                                                options={banks.map(b => ({
                                                                    value: b.bankId,
                                                                    label: `${b.bankName} - ${b.accountNumber}`
                                                                }))}
                                                                value={line.bankId || ""}
                                                                onSelect={val => handlePaymentChange(idx, "bankId", val)}
                                                                placeholder="Select Draw Bank Account..."
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-[8px] font-black uppercase tracking-wider text-muted-foreground block mb-1">GL Account (Credit)</label>
                                                            <SearchSelect<number>
                                                                options={paymentCoas.map(c => ({
                                                                    value: c.coaId,
                                                                    label: `${c.glCode} - ${c.accountTitle}`
                                                                }))}
                                                                value={line.coaId || ""}
                                                                onSelect={val => handlePaymentChange(idx, "coaId", val)}
                                                                placeholder="Select GL Account (Credit)..."
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="p-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-black uppercase tracking-widest">
                                    <div className="flex gap-4">
                                        <div>
                                            <span className="text-muted-foreground block mb-0.5">Total Vouchered</span>
                                            <span className="text-foreground">{formatCurrency(selectedDisbursement.totalAmount)}</span>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block mb-0.5">Total Check Lines</span>
                                            <span className="text-foreground">{formatCurrency(totalPaymentsAmount)}</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-muted-foreground block mb-0.5">Discrepancy</span>
                                        <span className={cn(
                                            "text-sm font-black",
                                            Math.abs(selectedDisbursement.totalAmount - totalPaymentsAmount) < 0.01 
                                                ? "text-emerald-600" 
                                                : "text-rose-500"
                                        )}>
                                            {formatCurrency(selectedDisbursement.totalAmount - totalPaymentsAmount)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>

                        {/* Audit actions footer */}
                        <div className="p-6 bg-card border-t border-border shrink-0 flex justify-between items-center z-10">
                            <Button 
                                variant="outline" 
                                onClick={handleSavePayments} 
                                disabled={isActionBusy}
                                className="h-11 px-6 text-xs font-black uppercase tracking-widest border-border/80"
                            >
                                Save Checks Allocation
                            </Button>

                            <Button 
                                onClick={handleReleaseVoucher} 
                                disabled={isActionBusy || payments.length === 0}
                                className="h-11 px-10 text-xs font-black uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/10 disabled:opacity-50"
                            >
                                {isActionBusy ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ArrowUpFromLine className="w-4 h-4 mr-2" />}
                                Release Checks
                            </Button>
                        </div>
                    </Card>
                ) : (
                    <Card className="rounded-2xl border border-dashed border-border/80 shadow-sm min-h-[400px] flex flex-col justify-center items-center text-center p-6 bg-card/30">
                        <div className="h-16 w-16 rounded-2xl bg-muted border border-border/50 flex items-center justify-center text-muted-foreground/60 mb-4 animate-pulse">
                            <ArrowUpFromLine className="h-8 w-8 text-purple-600" />
                        </div>
                        <h3 className="text-sm font-black uppercase text-foreground tracking-wider">No Voucher Selected</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2 max-w-[280px]">
                            Select an approved voucher from the list on the left to allocate checks and print check leaves.
                        </p>
                    </Card>
                )}
            </div>

            {/* DYNAMIC MISMATCH PROMPT DIALOG (Condition B) */}
            <Dialog open={releasingPromptOpen} onOpenChange={setReleasingPromptOpen}>
                <DialogContent className="sm:max-w-[460px] border-border shadow-2xl p-6 bg-background rounded-2xl text-center">
                    <DialogHeader className="flex flex-col items-center">
                        <div className="h-16 w-16 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center mb-4">
                            <AlertTriangle className="w-8 h-8 stroke-[2.5]" />
                        </div>
                        <DialogTitle className="text-lg font-black uppercase tracking-tight text-foreground">Mismatched Allocation Detected</DialogTitle>
                        <DialogDescription className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">
                            Voucher No: {selectedDisbursement?.docNo}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="my-6 p-4 rounded-xl bg-muted/40 border border-border/40 text-xs font-bold text-muted-foreground uppercase tracking-widest leading-relaxed text-left space-y-2">
                        <p>The combined check lines do not equal the total disbursement payable:</p>
                        <div className="grid grid-cols-2 gap-1 pt-1 border-t border-border/40">
                            <span>Voucher Payable:</span>
                            <span className="text-right text-foreground">{selectedDisbursement ? formatCurrency(selectedDisbursement.totalAmount) : ""}</span>
                            <span>Total Check Lines:</span>
                            <span className="text-right text-foreground">{formatCurrency(totalPaymentsAmount)}</span>
                        </div>
                    </div>

                    <DialogFooter className="sm:justify-center flex flex-col sm:flex-row gap-3">
                        <Button 
                            onClick={() => handleCommitRelease("Released")}
                            disabled={isActionBusy}
                            className="h-11 px-5 text-xs font-black uppercase bg-destructive hover:bg-destructive/90 text-white"
                        >
                            Force &apos;Released&apos;
                        </Button>
                        <Button 
                            onClick={() => handleCommitRelease("Partially Released")}
                            disabled={isActionBusy}
                            className="h-11 px-5 text-xs font-black uppercase bg-amber-500 hover:bg-amber-600 text-white"
                        >
                            Flag &apos;Partially Released&apos;
                        </Button>
                        <Button 
                            variant="outline"
                            onClick={() => setReleasingPromptOpen(false)}
                            className="h-11 px-5 text-xs font-bold uppercase border-border/60"
                        >
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PHILIPPINE CHECKS PRINTABLE DIALOG (8IN X 3IN) */}
            <Dialog open={printCheckOpen} onOpenChange={setPrintCheckOpen}>
                <DialogContent className="sm:max-w-[850px] p-6 border-border shadow-2xl bg-card rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-sm font-black uppercase text-foreground">PH Format Check Printing Preview</DialogTitle>
                        <DialogDescription className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                            Use PDF printing for pixel-perfect check alignment. Calibrate feed offset below if needed.
                        </DialogDescription>
                    </DialogHeader>

                    {/* Calibration Controls */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 border border-border bg-muted/20 rounded-xl mt-4">
                        <div>
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Horizontal Calibration Offset (mm)</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <Input 
                                    type="number" 
                                    value={calibrationX} 
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setCalibrationX(val);
                                        localStorage.setItem("check_print_calibration_x", String(val));
                                    }}
                                    className="h-9 text-xs" 
                                    placeholder="0"
                                />
                                <span className="text-[10px] text-muted-foreground font-semibold">Shift Right (+) / Left (-)</span>
                            </div>
                        </div>
                        <div>
                            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Vertical Calibration Offset (mm)</Label>
                            <div className="flex items-center gap-2 mt-1">
                                <Input 
                                    type="number" 
                                    value={calibrationY} 
                                    onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setCalibrationY(val);
                                        localStorage.setItem("check_print_calibration_y", String(val));
                                    }}
                                    className="h-9 text-xs" 
                                    placeholder="0"
                                />
                                <span className="text-[10px] text-muted-foreground font-semibold">Shift Down (+) / Up (-)</span>
                            </div>
                        </div>
                    </div>

                    {/* Check Leaf Container */}
                    <div className="flex justify-center p-6 bg-muted/40 border border-border/80 rounded-xl mt-4 overflow-hidden">
                        {/* Printable Area - styled explicitly with absolute placements in inches */}
                        <div 
                            id="print-check-area" 
                            className="w-[8.0in] h-[3.0in] border border-border/80 bg-[#FCFAF5] shadow-lg rounded-xl relative select-none overflow-hidden text-slate-800"
                            style={{ 
                                width: "8.0in", 
                                height: "3.0in"
                            }}
                        >
                            {/* === STATIC PRE-PRINTED CHECK ELEMENTS === */}
                            {/* Date Area Label */}
                            <div 
                                className="absolute text-[8px] font-black text-slate-400"
                                style={{ top: "0.26in", left: "5.7in" }}
                            >
                                DATE
                            </div>
                            {/* Date pre-printed boxes & separators */}
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => {
                                const isGap = idx === 2 || idx === 5;
                                return (
                                    <div 
                                        key={`static-date-${idx}`}
                                        className={cn(
                                            "absolute flex items-center justify-center text-slate-300 font-bold text-[8px]",
                                            isGap ? "" : "border border-slate-300 bg-white/40 rounded-sm w-[0.14in] h-[0.18in]"
                                        )}
                                        style={{ 
                                            left: `${6.05 + idx * 0.189}in`,
                                            top: "0.22in"
                                        }}
                                    >
                                        {isGap ? "-" : ""}
                                    </div>
                                );
                            })}

                            {/* Payee Row Elements */}
                            <div 
                                className="absolute text-[8px] font-bold text-slate-400 leading-tight w-[1.1in]"
                                style={{ top: "0.82in", left: "0.2in" }}
                            >
                                PAY TO THE<br/>ORDER OF
                            </div>
                            <div 
                                className="absolute border-b border-slate-300/80"
                                style={{ top: "0.98in", left: "1.4in", width: "4.6in" }}
                            />

                            {/* Amount in Figures Box */}
                            <div 
                                className="absolute text-sm font-black text-slate-400"
                                style={{ top: "0.83in", left: "6.05in" }}
                            >
                                ₱
                            </div>
                            <div 
                                className="absolute border border-slate-300/80 bg-white/40 rounded-sm"
                                style={{ top: "0.76in", left: "6.2in", width: "1.6in", height: "0.30in" }}
                            />

                            {/* Amount in Words Row */}
                            <div 
                                className="absolute text-[8px] font-bold text-slate-400"
                                style={{ top: "1.25in", left: "0.2in" }}
                            >
                                PESOS
                            </div>
                            <div 
                                className="absolute border-b border-slate-300/80"
                                style={{ top: "1.38in", left: "0.8in", width: "5.2in" }}
                            />

                            {/* Signature Box Simulation */}
                            <div 
                                className="absolute border border-dashed border-slate-300/60 bg-white/20 rounded-md flex items-end justify-center pb-1 text-[7px] font-bold text-slate-300 uppercase"
                                style={{ top: "1.85in", left: "6.2in", width: "1.6in", height: "0.45in" }}
                            >
                                Authorized Signatures
                            </div>

                            {/* MICR Simulation line at the bottom */}
                            <div 
                                className="absolute w-full text-center font-mono text-[9px] text-slate-300/60 tracking-[0.08in] uppercase"
                                style={{ bottom: "0.2in" }}
                            >
                                ⑈ 0020033183⑈ 050110018⑆ 282101003537⑈ 000
                            </div>


                            {/* === DYNAMIC DRAFT PRINTED ELEMENTS (TRANSFORMED BY CALIBRATION) === */}
                            <div 
                                className="w-full h-full absolute top-0 left-0"
                                style={{ 
                                    transform: `translate(${calibrationX}mm, ${calibrationY}mm)`,
                                    transition: "transform 0.15s ease-out"
                                }}
                            >
                                {/* Date Digits */}
                                <div 
                                    className="absolute font-mono text-[12px] font-bold w-[1.9in] h-[0.3in]"
                                    style={{ top: "0.22in", left: "6.05in" }}
                                >
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((idx) => {
                                        if (idx === 2 || idx === 5) return null;
                                        let digit = "";
                                        if (idx === 0) digit = checkDateDigits.mm[0];
                                        else if (idx === 1) digit = checkDateDigits.mm[1];
                                        else if (idx === 3) digit = checkDateDigits.dd[0];
                                        else if (idx === 4) digit = checkDateDigits.dd[1];
                                        else if (idx === 6) digit = checkDateDigits.yyyy[0];
                                        else if (idx === 7) digit = checkDateDigits.yyyy[1];
                                        else if (idx === 8) digit = checkDateDigits.yyyy[2];
                                        else if (idx === 9) digit = checkDateDigits.yyyy[3];

                                        return (
                                            <span 
                                                key={`printed-date-${idx}`}
                                                className="absolute text-center text-purple-700 w-[0.14in] h-[0.18in] text-xs font-black"
                                                style={{ 
                                                    left: `${idx * 0.189}in`,
                                                    top: "0px"
                                                }}
                                            >
                                                {digit}
                                            </span>
                                        );
                                    })}
                                </div>

                                {/* Payee Name */}
                                <div 
                                    className="absolute font-bold text-xs uppercase text-purple-700 font-sans tracking-wide"
                                    style={{ top: "0.81in", left: "1.45in" }}
                                >
                                    {selectedDisbursement?.payeeName}
                                </div>

                                {/* Amount in figures */}
                                <div 
                                    className="absolute font-black text-xs font-mono text-purple-700"
                                    style={{ top: "0.82in", left: "6.25in" }}
                                >
                                    **{activePrintCheck?.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}*
                                </div>

                                {/* Amount in words */}
                                <div 
                                    className="absolute font-bold text-[10px] uppercase text-purple-700 font-sans max-w-[5.1in] leading-none"
                                    style={{ top: "1.21in", left: "0.85in" }}
                                >
                                    {activePrintCheck ? numberToWords(activePrintCheck.amount) : ""}
                                </div>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="mt-6 border-t border-border pt-4 flex gap-3">
                        <Button 
                            onClick={() => {
                                if (activePrintCheck) {
                                    generateCheckLeafPDF(
                                        activePrintCheck,
                                        selectedDisbursement?.payeeName || "",
                                        { offsetX: calibrationX, offsetY: calibrationY }
                                    );
                                }
                            }} 
                            className="h-11 px-8 text-xs font-black uppercase bg-primary text-primary-foreground shadow-md hover:shadow-lg"
                        >
                            <Printer className="w-4 h-4 mr-2" /> Generate & Print Check
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={() => setPrintCheckOpen(false)}
                            className="h-11 px-6 text-xs font-bold uppercase border-border/60"
                        >
                            Close Preview
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
