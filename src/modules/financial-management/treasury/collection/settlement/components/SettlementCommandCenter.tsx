"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSettlement } from "../hooks/useSettlement";
import {
    Receipt, ShieldCheck, Wallet, Save, ChevronDown, Plus, X, Loader2,
    Percent, Trash2, Lock, Printer, Wand2, Truck, ChevronsUpDown, Check, Layers, MapPin, Calendar, FileText, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { fetchProvider } from "../../providers/fetchProvider";
import { UnpaidInvoice } from "../../types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// 🚀 IMPORTS OF MODULAR FILES
import SettlementInvoiceCartTable from "./SettlementInvoiceCartTable";
import WalletAssetCard from "./WalletAssetCard";
import InvoiceSearchPopover from "./InvoiceSearchPopover";

export interface SettlementCommandCenterProps {
    id: string | number;
    onClose?: () => void;
}

export default function SettlementCommandCenter({ id, onClose }: SettlementCommandCenterProps) {
    const {
        isLoading, wallet, credits, cartInvoices, allocations, salesmanName, salesmanId, findings, docNo, isPosted,
        isLoadingRoute, loadRouteInvoices, addToCart, removeFromCart, clearCart,
        getUsedAmount, getInvoiceApplied, handleAllocate, createAdjustment, createEwt, submitSettlement,
        deleteWalletItem, editWalletItem,
        dispatchPlans, isLoadingPlans, loadDispatchPlanInvoices, dispatchDate, setDispatchDate
    } = useSettlement(id);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<UnpaidInvoice[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [creditSearch, setCreditSearch] = useState("");

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editAmt, setEditAmt] = useState("");
    const [editRef, setEditRef] = useState("");
    const [editBalType, setEditBalType] = useState<number>(2);

    const [editCoaId, setEditCoaId] = useState<number | "">("");
    const [editCoaOpen, setEditCoaOpen] = useState(false);
    const [editFId, setEditFId] = useState<number | "">("");
    const [editAccountOpen, setEditAccountOpen] = useState(false);

    const [adjOpen, setAdjOpen] = useState(false);
    const [adjCoaId, setAdjCoaId] = useState<number | "">("");
    const [adjCoaOpen, setAdjCoaOpen] = useState(false);
    const [adjFindingId, setAdjFindingId] = useState<number | "">("");
    const [adjAccountOpen, setAdjAccountOpen] = useState(false);
    const [adjAmount, setAdjAmount] = useState<string>("");
    const [adjRemarks, setAdjRemarks] = useState("");
    const [adjInvoiceId, setAdjInvoiceId] = useState<number | null>(null);
    const [adjBalanceType, setAdjBalanceType] = useState<number>(2);
    const [isCreatingAdj, setIsCreatingAdj] = useState(false);

    const [ewtOpen, setEwtOpen] = useState(false);
    const [globalEwtAmount, setGlobalEwtAmount] = useState("");
    const [globalEwtRef, setGlobalEwtRef] = useState("");

    const [routePopoverOpen, setRoutePopoverOpen] = useState(false);

    const uniqueCategories = useMemo(() => {
        const coaMap = new Map<number, {id: number, title: string}>();
        findings.forEach(f => {
            if (f.chartOfAccount) {
                const cId = f.chartOfAccount.coaId || f.chartOfAccount.id;
                if (cId && !coaMap.has(cId)) coaMap.set(cId, { id: cId, title: f.chartOfAccount.accountTitle });
            }
        });
        return Array.from(coaMap.values()).sort((a, b) => a.title.localeCompare(b.title));
    }, [findings]);

    const filteredFindings = useMemo(() => {
        if (!adjCoaId) return [];
        return findings.filter(f => (f.chartOfAccount?.coaId || f.chartOfAccount?.id) === adjCoaId);
    }, [findings, adjCoaId]);

    const editFilteredFindings = useMemo(() => {
        if (!editCoaId) return [];
        return findings.filter(f => (f.chartOfAccount?.coaId || f.chartOfAccount?.id) === editCoaId);
    }, [findings, editCoaId]);

    useEffect(() => {
        if (!searchQuery || searchQuery.trim().length < 2 || isPosted) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const data = await fetchProvider.get<UnpaidInvoice[]>(
                    `/api/fm/treasury/collections/search-unpaid?salesmanId=${salesmanId || 0}&query=${encodeURIComponent(searchQuery)}`
                );
                const cleanResults = (data || []).filter(inv => !cartInvoices.some(cartInv => cartInv.id === inv.id));
                setSearchResults(cleanResults);
            } catch (error) {
                console.error("Search failed:", error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, salesmanId, cartInvoices, isPosted]);

    // 🚀 THE FIX: We split them into THREE distinct pillars of truth!
    const pouchTotal = useMemo(() => wallet.filter(w => w.type === 'CASH' || w.type === 'CHECK').reduce((sum, w) => sum + w.originalAmount, 0), [wallet]);
    const ewtTotal = useMemo(() => wallet.filter(w => w.type === 'EWT').reduce((sum, w) => sum + w.originalAmount, 0), [wallet]);
    const varianceTotal = useMemo(() => wallet.filter(w => w.type === 'ADJUSTMENT').reduce((sum, w) => w.balanceTypeId === 1 ? sum - w.originalAmount : sum + w.originalAmount, 0), [wallet]);

    const totalAllocated = useMemo(() => allocations.filter(a => wallet.some(w => w.id === a.sourceTempId)).reduce((sum, a) => {
        const source = wallet.find(w => w.id === a.sourceTempId);
        return source?.balanceTypeId === 1 ? sum - a.amountApplied : sum + a.amountApplied;
    }, 0), [allocations, wallet]);

    // Unallocated dynamically combines all three pillars
    const remainingToAllocate = (pouchTotal + ewtTotal + varianceTotal) - totalAllocated;

    const cartTotalBalance = useMemo(() => cartInvoices.reduce((sum, inv) => sum + (inv.remainingBalance || 0), 0), [cartInvoices]);
    const cartTotalAppliedSession = useMemo(() => allocations.reduce((sum, a) => sum + a.amountApplied, 0), [allocations]);

    const handleMasterSave = async () => {
        setIsSubmitting(true);
        const success = await submitSettlement();
        if (success) {
            setIsSuccess(true);
            setTimeout(() => { if (onClose) onClose(); }, 1200);
        } else {
            setIsSubmitting(false);
        }
    };

    const handleCreateAdjustment = async () => {
        const parsedAmount = Math.abs(parseFloat(adjAmount));
        const validFindingId = Number(adjFindingId);
        if (!validFindingId || validFindingId <= 0 || isNaN(parsedAmount) || parsedAmount === 0) return toast.error("Please select a valid Ledger Account.");
        setIsCreatingAdj(true);
        await createAdjustment(validFindingId, parsedAmount, adjBalanceType, adjRemarks, adjInvoiceId);
        setIsCreatingAdj(false);
        setAdjOpen(false);
        setAdjCoaId(""); setAdjFindingId(""); setAdjAmount(""); setAdjRemarks(""); setAdjBalanceType(2); setAdjInvoiceId(null);
    };

    const handleCreateGlobalEwt = () => {
        const amt = parseFloat(globalEwtAmount);
        if (isNaN(amt) || amt <= 0 || !globalEwtRef) return toast.error("Invalid amount or reference.");
        createEwt(amt, globalEwtRef, null);
        setEwtOpen(false); setGlobalEwtAmount(""); setGlobalEwtRef("");
    };

    const handleAutoBalance = () => {
        const requiredAdjustment = -remainingToAllocate;
        setAdjAmount(Math.abs(requiredAdjustment).toFixed(2));
        setAdjRemarks(requiredAdjustment > 0 ? "Auto-balance: Shortage / Variance" : "Auto-balance: Overage");
        setAdjBalanceType(requiredAdjustment > 0 ? 2 : 1);
        setAdjCoaId(""); setAdjFindingId(""); setAdjInvoiceId(null); setAdjOpen(true);
    };

    const handleInvoiceDiscrepancy = (inv: UnpaidInvoice) => {
        const appliedSession = getInvoiceApplied(inv.id);
        const remaining = Number(inv.remainingBalance ?? inv.originalAmount ?? 0);
        const discrepancy = remaining - appliedSession;
        if (discrepancy <= 0.01) return toast.error(`Cannot accept a variance adjustment. Variance: ₱${discrepancy.toFixed(2)}`);
        setAdjAmount(Math.abs(discrepancy).toFixed(2));
        setAdjBalanceType(2);
        setAdjRemarks(`Variance for ${inv.invoiceNo}`);
        setAdjCoaId(""); setAdjFindingId(""); setAdjInvoiceId(inv.id); setAdjOpen(true);
    };

    const handleAutoCalculateEWT = (inv: UnpaidInvoice) => {
        const netOfVat = inv.remainingBalance / 1.12;
        const refNo = prompt(`Generate Form 2307 for ${inv.invoiceNo}\n\nEnter Reference Number:`, `2307-${inv.invoiceNo}`);
        if (refNo) createEwt(netOfVat * 0.01, refNo, inv.id);
    };

    if (isLoading) return <div className="p-10 flex h-full items-center justify-center text-center animate-pulse font-bold text-muted-foreground uppercase tracking-widest">Initializing Command Center...</div>;

    const combinedSources = [...wallet, ...credits];
    const filteredCredits = credits.filter(c => !creditSearch || c.label.toLowerCase().includes(creditSearch.toLowerCase()) || (c.customerName && c.customerName.toLowerCase().includes(creditSearch.toLowerCase())));

    return (
        <div className="w-full h-full flex flex-col bg-muted/10 overflow-hidden relative">

            {/* TOP NAVBAR */}
            <div className="bg-card border-b border-border py-2.5 px-4 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 shadow-sm shrink-0 relative z-20">
                <div className="flex items-start lg:items-center gap-3 w-full lg:w-auto">
                    {onClose && <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting || isSuccess} className="shrink-0 h-8 w-8 rounded-full hover:bg-muted border border-border/50 disabled:opacity-50"><X size={16} className="text-muted-foreground hover:text-foreground"/></Button>}
                    <div className="min-w-0">
                        <h1 className="text-lg font-black flex items-center gap-1.5 truncate leading-none"><ShieldCheck className="text-primary shrink-0" size={16}/><span className="truncate">Settlement Console</span>{isPosted && <Badge variant="destructive" className="ml-2 bg-red-600 tracking-widest shadow-sm text-[8px] shrink-0 h-4 py-0"><Lock size={8} className="mr-1"/> LOCKED</Badge>}</h1>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5 truncate leading-none">Doc No: <span className="font-mono text-primary">{docNo}</span> • Collector: <span className="text-primary">{salesmanName}</span></p>
                    </div>
                </div>

                <div className="flex flex-wrap lg:flex-nowrap items-center gap-2 lg:gap-3 bg-muted/50 p-1.5 px-2.5 rounded-lg border border-border w-full lg:w-auto overflow-x-auto scrollbar-none">

                    {/* PILLAR 1: Physical Pouch */}
                    <div className="flex flex-col border-r pr-2 lg:pr-3 border-border/50 shrink-0">
                        <span className="text-[8px] font-black uppercase text-muted-foreground tracking-tighter leading-none mb-0.5">Physical Pouch</span>
                        <span className="text-sm font-black font-mono text-foreground truncate leading-none">₱{pouchTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>

                    {/* PILLAR 2: EWT Holdings */}
                    {ewtTotal > 0 && (
                        <div className="flex flex-col border-r pr-2 lg:pr-3 border-border/50 shrink-0 animate-in fade-in slide-in-from-left-2">
                            <span className="text-[8px] font-black uppercase text-teal-600 tracking-tighter leading-none mb-0.5">EWT Holdings</span>
                            <span className="text-sm font-black font-mono text-teal-600 truncate leading-none">
                                +₱{ewtTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                        </div>
                    )}

                    {/* PILLAR 3: Session Variance */}
                    {Math.abs(varianceTotal) > 0.001 && (
                        <div className="flex flex-col border-r pr-2 lg:pr-3 border-border/50 shrink-0 animate-in fade-in slide-in-from-left-2">
                            <span className={cn("text-[8px] font-black uppercase tracking-tighter leading-none mb-0.5", varianceTotal > 0 ? "text-purple-600" : "text-red-600")}>
                                {varianceTotal > 0 ? "Shortage Credit" : "Overage Debit"}
                            </span>
                            <span className={cn("text-sm font-black font-mono truncate leading-none", varianceTotal > 0 ? "text-purple-600" : "text-red-600")}>
                                {varianceTotal < 0 ? '-' : '+'}₱{Math.abs(varianceTotal).toLocaleString(undefined, {minimumFractionDigits: 2})}
                            </span>
                        </div>
                    )}

                    <div className="flex flex-col border-r pr-2 lg:pr-3 border-border/50 shrink-0">
                        <span className="text-[8px] font-black uppercase text-emerald-600 tracking-tighter leading-none mb-0.5">Allocated</span>
                        <span className="text-sm font-black font-mono text-emerald-600 truncate leading-none">₱{totalAllocated.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex flex-col pr-1 shrink-0">
                        <span className="text-[8px] font-black uppercase tracking-tighter text-muted-foreground leading-none mb-0.5">Unallocated</span>
                        <span className={`text-sm font-black font-mono truncate leading-none ${Math.abs(remainingToAllocate) < 0.01 ? 'text-muted-foreground' : 'text-orange-500'}`}>₱{remainingToAllocate.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto shrink-0">
                    {!isPosted && Math.abs(remainingToAllocate) > 0.01 && (
                        <Button onClick={handleAutoBalance} disabled={isSubmitting || isSuccess} variant="outline" size="sm" className="flex-1 lg:flex-none font-black text-[10px] uppercase tracking-widest shadow-sm border-orange-500 text-orange-600 hover:bg-orange-50 h-8">
                            <Wand2 size={12} className="mr-1.5"/> Auto-Balance
                        </Button>
                    )}

                    {isPosted ? (
                        <Button onClick={() => window.print()} variant="outline" size="sm" className="flex-1 lg:flex-none font-black text-[10px] uppercase tracking-widest shadow-sm border-primary text-primary hover:bg-primary/10 h-8">
                            <Printer size={12} className="mr-1.5"/> Print Receipt
                        </Button>
                    ) : (
                        <Button
                            onClick={handleMasterSave}
                            disabled={remainingToAllocate < -0.01 || isSubmitting || isSuccess}
                            size="sm"
                            className={cn(
                                "flex-1 lg:flex-none font-black text-[10px] uppercase tracking-widest shadow-sm transition-all duration-300 h-8 overflow-hidden relative",
                                isSuccess ? "bg-emerald-500 hover:bg-emerald-600 text-white scale-105 shadow-emerald-500/50" :
                                    isSubmitting ? "bg-primary/80 cursor-wait" :
                                        remainingToAllocate < -0.01 ? 'bg-destructive hover:bg-destructive/90 text-white' :
                                            (remainingToAllocate > 0.01 ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-primary')
                            )}
                        >
                            {isSuccess ? (
                                <span className="flex items-center gap-1.5 animate-in zoom-in-50 duration-200"><CheckCircle2 className="w-3.5 h-3.5 animate-bounce"/> Saved!</span>
                            ) : isSubmitting ? (
                                <span className="flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin"/> Processing...</span>
                            ) : (
                                <span className="flex items-center gap-1.5">
                                    <Save className="w-3.5 h-3.5" />
                                    {remainingToAllocate < -0.01 ? "Over-Allocated!" : (remainingToAllocate > 0.01 ? "Save Partial" : "Commit")}
                                </span>
                            )}
                            {isSubmitting && <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />}
                        </Button>
                    )}
                </div>
            </div>

            {/* MAIN WORKSPACE - Ultra-compact styling applied here */}
            <div className={cn(
                "flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-3 p-3 lg:p-4 overflow-y-auto lg:overflow-hidden transition-all duration-500",
                (isSubmitting || isSuccess) ? "opacity-60 blur-[1px] pointer-events-none grayscale-[20%]" : "opacity-100"
            )}>
                {/* LEFT SIDEBAR: WALLET & CREDITS */}
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-3 overflow-hidden lg:h-full">
                    <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="bg-emerald-500/10 py-2 px-3 border-b border-emerald-500/20 flex justify-between items-center shrink-0">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"><Wallet size={12}/> Liquidation Pool</span>
                            {!isPosted && (
                                <div className="flex gap-1.5">
                                    <Popover open={ewtOpen} onOpenChange={setEwtOpen}>
                                        <PopoverTrigger asChild><Button size="sm" variant="outline" className="h-5 text-[8px] px-1.5 font-black uppercase tracking-widest text-teal-600 border-teal-200 hover:bg-teal-50 gap-1"><Plus size={8} strokeWidth={3}/> Form 2307</Button></PopoverTrigger>
                                        <PopoverContent className="w-[280px] p-4 space-y-3 shadow-xl border-teal-200" align="start">
                                            <div className="space-y-0.5 mb-2 border-b border-border/50 pb-2"><h4 className="font-black text-xs text-foreground flex items-center gap-1.5"><FileText size={14} className="text-teal-500"/> Pooled EWT</h4><p className="text-[9px] font-bold text-muted-foreground leading-tight">Add a Form 2307 that can be distributed across multiple invoices.</p></div>
                                            <div className="space-y-2">
                                                <div className="flex flex-col gap-1"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Amount (₱)</label><Input type="number" placeholder="0.00" value={globalEwtAmount} onChange={(e) => setGlobalEwtAmount(e.target.value)} className="h-7 text-xs"/></div>
                                                <div className="flex flex-col gap-1"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Reference No.</label><Input placeholder="E.g. 2307-XXX" value={globalEwtRef} onChange={(e) => setGlobalEwtRef(e.target.value)} className="h-7 text-xs"/></div>
                                                <Button className="w-full mt-1 h-7 text-[9px] font-black uppercase tracking-widest bg-teal-600 hover:bg-teal-700 text-white" onClick={handleCreateGlobalEwt}>Add to Pouch</Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <Popover open={adjOpen} onOpenChange={setAdjOpen}>
                                        <PopoverTrigger asChild><Button onClick={() => { setAdjInvoiceId(null); setAdjAmount(""); setAdjRemarks(""); setAdjBalanceType(2); setAdjCoaId(""); }} size="sm" variant="outline" className="h-5 text-[8px] px-1.5 font-black uppercase tracking-widest text-purple-600 border-purple-200 hover:bg-purple-50 gap-1"><Plus size={8} strokeWidth={3}/> Variance</Button></PopoverTrigger>
                                        <PopoverContent className="w-[280px] p-4 space-y-3 shadow-xl border-purple-200" align="start">
                                            <div className="space-y-0.5 mb-2 border-b border-border/50 pb-2"><h4 className="font-black text-xs text-foreground flex items-center gap-1.5"><Wallet size={14} className="text-purple-500"/> Record Variance</h4><p className="text-[9px] font-bold text-muted-foreground leading-tight">Select whether this increases assets or decreases them.</p></div>
                                            <div className="space-y-2">
                                                <div className="flex flex-col gap-1">
                                                    <label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Type</label>
                                                    <div className="flex gap-1.5">
                                                        <Button variant={adjBalanceType === 2 ? "default" : "outline"} onClick={() => setAdjBalanceType(2)} className={`h-7 w-1/2 text-[10px] font-bold ${adjBalanceType === 2 ? 'bg-purple-600 text-white' : 'text-muted-foreground'}`}>Shortage (Cr)</Button>
                                                        <Button variant={adjBalanceType === 1 ? "default" : "outline"} onClick={() => setAdjBalanceType(1)} className={`h-7 w-1/2 text-[10px] font-bold ${adjBalanceType === 1 ? 'bg-red-600 text-white' : 'text-muted-foreground'}`}>Overage (Dr)</Button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Category</label><Popover open={adjCoaOpen} onOpenChange={setAdjCoaOpen}><PopoverTrigger asChild><Button variant="outline" role="combobox" className={cn("w-full h-7 justify-between text-xs font-bold bg-background", !adjCoaId && "text-muted-foreground border-dashed border-primary/50")}><span className="truncate flex items-center gap-1.5"><Layers size={12}/>{adjCoaId ? uniqueCategories.find((c) => c.id === adjCoaId)?.title : "Select..."}</span><ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50"/></Button></PopoverTrigger><PopoverContent className="w-[260px] p-0" align="start"><Command><CommandInput placeholder="Search..." className="text-xs h-7"/><CommandList className="max-h-[200px] overflow-y-auto" onWheelCapture={(e) => e.stopPropagation()}><CommandEmpty>No categories found.</CommandEmpty><CommandGroup>{uniqueCategories.map((coa) => ( <CommandItem key={coa.id} value={coa.title} onSelect={() => { setAdjCoaId(coa.id); setAdjFindingId(""); setAdjCoaOpen(false); }} className="text-[11px] cursor-pointer py-1"><Check className={cn("mr-1.5 h-3 w-3 text-primary", adjCoaId === coa.id ? "opacity-100" : "opacity-0")}/>{coa.title}</CommandItem> ))}</CommandGroup></CommandList></Command></PopoverContent></Popover></div>
                                                <div className="flex flex-col gap-1"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Reason</label><Popover open={adjAccountOpen} onOpenChange={setAdjAccountOpen}><PopoverTrigger asChild><Button variant="outline" role="combobox" disabled={!adjCoaId} className={cn("w-full h-7 justify-between text-xs font-bold bg-background", !adjFindingId && "text-muted-foreground border-dashed border-primary/50")}><span className="truncate pl-5">{adjFindingId ? filteredFindings.find((f) => f.id === adjFindingId)?.findingName : "Select reason..."}</span><ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50"/></Button></PopoverTrigger><PopoverContent className="w-[260px] p-0" align="start"><Command><CommandInput placeholder="Search reason..." className="text-xs h-7"/><CommandList className="max-h-[250px] overflow-y-auto" onWheelCapture={(e) => e.stopPropagation()}><CommandEmpty>No findings under this category.</CommandEmpty><CommandGroup>{filteredFindings.map((f) => ( <CommandItem key={f.id} value={f.findingName} onSelect={() => { setAdjFindingId(f.id); setAdjAccountOpen(false); }} className="text-[11px] cursor-pointer py-1"><Check className={cn("mr-1.5 h-3 w-3 text-primary", adjFindingId === f.id ? "opacity-100" : "opacity-0")}/>{f.findingName}</CommandItem> ))}</CommandGroup></CommandList></Command></PopoverContent></Popover></div>
                                                <div className="flex flex-col gap-1"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Amount (₱)</label><Input type="number" placeholder="0.00" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} className="h-7 text-xs"/></div>
                                                <div className="flex flex-col gap-1"><label className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Remarks</label><Input placeholder="Reason for variance" value={adjRemarks} onChange={(e) => setAdjRemarks(e.target.value)} className="h-7 text-xs"/></div>
                                                <Button className="w-full mt-1 h-7 text-[9px] font-black uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white" disabled={!adjFindingId || adjAmount === "" || parseFloat(adjAmount) === 0 || isNaN(parseFloat(adjAmount)) || isCreatingAdj} onClick={handleCreateAdjustment}>{isCreatingAdj ? <Loader2 size={12} className="animate-spin"/> : "Inject into Pouch"}</Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}
                        </div>

                        <div className="p-2 flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
                            {wallet.map(w => (
                                <WalletAssetCard
                                    key={w.id} item={w} getUsedAmount={getUsedAmount}
                                    editingId={editingId} setEditingId={setEditingId} editAmt={editAmt} setEditAmt={setEditAmt}
                                    editRef={editRef} setEditRef={setEditRef} editBalType={editBalType} setEditBalType={setEditBalType}
                                    editCoaId={editCoaId} setEditCoaId={setEditCoaId} editFId={editFId} setEditFId={setEditFId}
                                    editCoaOpen={editCoaOpen} setEditCoaOpen={setEditCoaOpen} editAccountOpen={editAccountOpen} setEditAccountOpen={setEditAccountOpen}
                                    uniqueCategories={uniqueCategories} editFilteredFindings={editFilteredFindings} findings={findings}
                                    editWalletItem={editWalletItem} deleteWalletItem={deleteWalletItem} isPosted={isPosted} cartInvoices={cartInvoices}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="bg-purple-500/10 py-2 px-3 border-b border-purple-500/20 flex flex-col gap-1.5 shrink-0">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-400 flex items-center gap-1.5"><Percent size={12}/> Available Credits</span><Badge variant="outline" className="text-[7px] font-black bg-purple-50 border-purple-200 text-purple-700 py-0 h-3.5 leading-none">OPTIONAL</Badge></div>
                            <Input placeholder="Search by customer, memo no..." value={creditSearch} onChange={(e) => setCreditSearch(e.target.value)} className="h-6 text-[10px] font-bold shadow-inner bg-background border-purple-200 focus-visible:ring-purple-500 px-2"/>
                        </div>
                        <div className="p-2 flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
                            {filteredCredits.length === 0 ? <p className="text-[10px] text-center text-muted-foreground font-bold uppercase pt-6 italic">No matching credits</p> : filteredCredits.map(c => {
                                const used = c.originalAmount > 0 ? getUsedAmount(c.id) : 0;
                                const remaining = c.originalAmount - used;
                                const isExhausted = c.originalAmount > 0 && remaining <= 0;
                                return (
                                    <div key={`source-${c.id}`} className={`p-2 rounded-md border shadow-sm transition-all group ${isExhausted ? 'bg-muted/30 border-dashed opacity-60' : 'bg-background border-border border-l-[3px] border-l-purple-500'}`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[10px] font-black uppercase tracking-widest truncate pr-2 leading-tight">{c.label}</span>
                                            <Badge variant="outline" className="text-[7px] uppercase px-1 py-0 h-3.5 leading-none border-purple-200 text-purple-700 bg-purple-50">{c.type}</Badge>
                                        </div>
                                        {c.customerName && <div className="text-[8px] font-bold text-muted-foreground truncate mb-1 leading-tight" title={c.customerName}>{c.customerName}</div>}
                                        <div className={`flex justify-between gap-2 text-[10px] ${c.customerName ? 'mt-1 border-t border-border/50 pt-1' : 'mt-1.5'}`}>
                                            <div className="min-w-0 flex-1"><p className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-0.5">Original</p><p className="font-mono truncate leading-none">₱{c.originalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                                            <div className="text-right min-w-0 flex-1"><p className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-0.5">Remaining</p><p className={`font-mono font-black truncate leading-none ${isExhausted ? 'text-muted-foreground' : 'text-emerald-600'}`}>₱{remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* RIGHT PANEL: CART TABLE */}
                <div className="col-span-1 lg:col-span-8 bg-card rounded-xl border border-border shadow-sm flex flex-col overflow-hidden lg:h-full min-h-0">
                    <div className="bg-blue-500/10 py-2.5 px-4 border-b border-blue-500/20 flex flex-col gap-2 shrink-0">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 flex items-center gap-1.5"><Receipt size={14}/> Active Cart</span>
                            <div className="flex gap-1.5 items-center">
                                {!isPosted && (
                                    <>
                                        <Button onClick={loadRouteInvoices} disabled={isLoadingRoute} variant="secondary" size="sm" className="h-6 text-[8px] uppercase font-black tracking-widest bg-blue-100 hover:bg-blue-200 text-blue-700 px-2.5">{isLoadingRoute ? <Loader2 size={10} className="mr-1 animate-spin"/> : <Truck size={10} className="mr-1"/>}Load Route</Button>
                                        <Popover open={routePopoverOpen} onOpenChange={setRoutePopoverOpen}>
                                            <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-6 text-[8px] uppercase font-black tracking-widest border-blue-200 text-blue-700 hover:bg-blue-50 px-2.5">{isLoadingPlans ? <Loader2 size={10} className="mr-1 animate-spin"/> : <MapPin size={10} className="mr-1"/>}Dispatch Plan <ChevronDown size={10} className="ml-1" /></Button></PopoverTrigger>
                                            <PopoverContent align="end" className="w-64 p-0 shadow-xl border-blue-200">
                                                <div className="p-2.5 border-b bg-blue-50/50">
                                                    <h4 className="font-black text-[10px] uppercase tracking-widest text-blue-800">Select Source</h4>
                                                    <div className="mt-1.5 flex items-center gap-1.5 bg-background border rounded-md px-1.5">
                                                        <Calendar size={10} className="text-muted-foreground" />
                                                        <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} className="h-7 border-none shadow-none text-[10px] font-bold px-0 focus-visible:ring-0"/>
                                                    </div>
                                                </div>
                                                <div className="p-1.5 max-h-[200px] overflow-y-auto scrollbar-thin" onWheelCapture={(e) => e.stopPropagation()}>
                                                    {dispatchPlans.length > 0 ? (
                                                        <div className="space-y-0.5 mb-1">
                                                            {dispatchPlans.map(plan => (
                                                                <button key={plan.id} onClick={() => { loadDispatchPlanInvoices(plan.id); setRoutePopoverOpen(false); }} className="w-full flex flex-col items-start p-1.5 rounded-md hover:bg-blue-50 transition-colors text-left">
                                                                    <span className="font-mono font-bold text-[11px] text-primary flex items-center gap-1.5"><MapPin size={10}/> {plan.docNo}</span>
                                                                    <span className="text-[9px] text-muted-foreground mt-0.5 font-medium">{plan.vehicleName} • {plan.driverName}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (<div className="px-2 py-3 text-center text-muted-foreground text-[9px] italic bg-muted/20 rounded-md">No plans found.</div>)}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </>
                                )}
                                {!isPosted && cartInvoices.length > 0 && <Button onClick={clearCart} variant="ghost" size="sm" className="h-6 text-[8px] uppercase font-black tracking-widest text-destructive hover:bg-destructive/10 px-2.5"><Trash2 size={10} className="mr-1"/> Clear Cart</Button>}
                            </div>
                        </div>

                        {!isPosted && (
                            <InvoiceSearchPopover searchOpen={searchOpen} setSearchOpen={setSearchOpen} searchQuery={searchQuery} setSearchQuery={setSearchQuery} isSearching={isSearching} searchResults={searchResults} addToCart={addToCart} />
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-thin bg-muted/5 relative [&_div.relative.w-full.overflow-auto]:!overflow-visible">
                        <SettlementInvoiceCartTable
                            isPosted={isPosted} cartInvoices={cartInvoices} allocations={allocations} wallet={wallet} credits={credits} combinedSources={combinedSources}
                            cartTotalBalance={cartTotalBalance} cartTotalAppliedSession={cartTotalAppliedSession} removeFromCart={removeFromCart} handleInvoiceDiscrepancy={handleInvoiceDiscrepancy}
                            handleAutoCalculateEWT={handleAutoCalculateEWT} handleAllocate={handleAllocate} getInvoiceApplied={getInvoiceApplied} getUsedAmount={getUsedAmount}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}