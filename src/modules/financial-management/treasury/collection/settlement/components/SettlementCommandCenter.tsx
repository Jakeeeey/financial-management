"use client";

import React, {useState, useEffect, useMemo} from "react";
import {useSettlement} from "../hooks/useSettlement";
import {
    Receipt, ShieldCheck, Wallet, Save, Search, ChevronDown, Plus, X, Loader2,
    Percent, Trash2, Lock, Printer, Wand2, Truck, ChevronsUpDown, Check, Edit2, Layers, MapPin, Calendar, FileText, CheckCircle2, User
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Input} from "@/components/ui/input";
import {Badge} from "@/components/ui/badge";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from "@/components/ui/command";
import {fetchProvider} from "../../providers/fetchProvider";
import {UnpaidInvoice} from "../../types";
import {cn} from "@/lib/utils";
import SettlementInvoiceCartTable from "./SettlementInvoiceCartTable";
import { toast } from "sonner";

interface SettlementCommandCenterProps {
    id: string | number;
    onClose?: () => void;
}

export default function SettlementCommandCenter({id, onClose}: SettlementCommandCenterProps) {
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

    const pouchTotal = useMemo(() => wallet.reduce((sum, w) => w.balanceTypeId === 1 ? sum - w.originalAmount : sum + w.originalAmount, 0), [wallet]);
    const totalAllocated = useMemo(() => allocations.filter(a => wallet.some(w => w.id === a.sourceTempId)).reduce((sum, a) => wallet.find(w => w.id === a.sourceTempId)?.balanceTypeId === 1 ? sum - a.amountApplied : sum + a.amountApplied, 0), [allocations, wallet]);
    const remainingToAllocate = pouchTotal - totalAllocated;
    const cartTotalBalance = useMemo(() => cartInvoices.reduce((sum, inv) => sum + (inv.remainingBalance || 0), 0), [cartInvoices]);
    const cartTotalAppliedSession = useMemo(() => allocations.reduce((sum, a) => sum + a.amountApplied, 0), [allocations]);

    const handleMasterSave = async () => {
        setIsSubmitting(true);
        const success = await submitSettlement();

        if (success) {
            setIsSuccess(true);
            setTimeout(() => {
                if (onClose) onClose();
            }, 1200);
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

            <div className="bg-card border-b border-border p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-sm shrink-0 relative z-20">
                <div className="flex items-start lg:items-center gap-4 w-full lg:w-auto">
                    {onClose && <Button variant="ghost" size="icon" onClick={onClose} disabled={isSubmitting || isSuccess} className="shrink-0 h-10 w-10 rounded-full hover:bg-muted border border-border/50 disabled:opacity-50"><X size={20} className="text-muted-foreground hover:text-foreground"/></Button>}
                    <div className="min-w-0">
                        <h1 className="text-xl font-black flex items-center gap-2 truncate"><ShieldCheck className="text-primary shrink-0" size={20}/><span className="truncate">Settlement Console</span>{isPosted && <Badge variant="destructive" className="ml-2 bg-red-600 tracking-widest shadow-sm text-[10px] shrink-0"><Lock size={10} className="mr-1"/> POSTED & LOCKED</Badge>}</h1>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1 truncate">Doc No: <span className="font-mono text-primary">{docNo}</span> • Collector: <span className="text-primary">{salesmanName}</span></p>
                    </div>
                </div>

                <div className="flex flex-wrap lg:flex-nowrap items-center gap-3 lg:gap-5 bg-muted/50 p-2.5 rounded-lg border border-border w-full lg:w-auto">
                    <div className="flex flex-col border-r pr-3 lg:pr-5 border-border/50 flex-1 lg:flex-none"><span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Pouch Value</span><span className="text-base font-black font-mono truncate">₱{pouchTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                    <div className="flex flex-col border-r pr-3 lg:pr-5 border-border/50 flex-1 lg:flex-none"><span className="text-[9px] font-black uppercase text-emerald-600 tracking-tighter">Allocated</span><span className="text-base font-black font-mono text-emerald-600 truncate">₱{totalAllocated.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                    <div className="flex flex-col pr-2 flex-1 lg:flex-none"><span className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground">Unallocated</span><span className={`text-base font-black font-mono truncate ${Math.abs(remainingToAllocate) < 0.01 ? 'text-muted-foreground' : 'text-orange-500'}`}>₱{remainingToAllocate.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                    {!isPosted && Math.abs(remainingToAllocate) > 0.01 && (
                        <Button onClick={handleAutoBalance} disabled={isSubmitting || isSuccess} variant="outline" size="sm" className="flex-1 lg:flex-none font-black uppercase tracking-widest shadow-sm border-orange-500 text-orange-600 hover:bg-orange-50 h-10">
                            <Wand2 size={14} className="mr-2"/> Auto-Balance
                        </Button>
                    )}

                    {isPosted ? (
                        <Button onClick={() => window.print()} variant="outline" size="sm" className="flex-1 lg:flex-none font-black uppercase tracking-widest shadow-md border-primary text-primary hover:bg-primary/10 h-10">
                            <Printer size={14} className="mr-2"/> Print Receipt
                        </Button>
                    ) : (
                        <Button
                            onClick={handleMasterSave}
                            disabled={remainingToAllocate < -0.01 || isSubmitting || isSuccess}
                            size="sm"
                            className={cn(
                                "flex-1 lg:flex-none font-black uppercase tracking-widest shadow-md transition-all duration-300 h-10 overflow-hidden relative",
                                isSuccess ? "bg-emerald-500 hover:bg-emerald-600 text-white scale-105 shadow-emerald-500/50 shadow-lg" :
                                    isSubmitting ? "bg-primary/80 cursor-wait" :
                                        remainingToAllocate < -0.01 ? 'bg-destructive hover:bg-destructive/90 text-white' :
                                            (remainingToAllocate > 0.01 ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-primary')
                            )}
                        >
                            {isSuccess ? (
                                <span className="flex items-center gap-2 animate-in zoom-in-50 duration-200"><CheckCircle2 className="w-4 h-4 animate-bounce"/> Saved!</span>
                            ) : isSubmitting ? (
                                <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin"/> Processing...</span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <Save className="w-4 h-4" />
                                    {remainingToAllocate < -0.01 ? "Over-Allocated!" : (remainingToAllocate > 0.01 ? "Save Partial" : "Commit to Ledger")}
                                </span>
                            )}

                            {isSubmitting && <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />}
                        </Button>
                    )}
                </div>
            </div>

            <div className={cn(
                "flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-6 overflow-y-auto lg:overflow-hidden transition-all duration-500",
                (isSubmitting || isSuccess) ? "opacity-60 blur-[1px] pointer-events-none grayscale-[20%]" : "opacity-100"
            )}>
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-4 overflow-hidden lg:h-full">
                    <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="bg-emerald-500/10 p-3 border-b border-emerald-500/20 flex justify-between items-center shrink-0">
                            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><Wallet size={14}/> Funds to Liquidate</span>
                            {!isPosted && (
                                <div className="flex gap-2">
                                    <Popover open={ewtOpen} onOpenChange={setEwtOpen}>
                                        <PopoverTrigger asChild><Button size="sm" variant="outline" className="h-6 text-[9px] font-black uppercase tracking-widest text-teal-600 border-teal-200 hover:bg-teal-50 px-2 gap-1"><Plus size={10} strokeWidth={3}/> Form 2307</Button></PopoverTrigger>
                                        <PopoverContent className="w-80 p-5 space-y-4 shadow-xl border-teal-200" align="start">
                                            <div className="space-y-1 mb-4 border-b border-border/50 pb-3"><h4 className="font-black text-sm text-foreground flex items-center gap-2"><FileText size={16} className="text-teal-500"/> Pooled EWT</h4><p className="text-[11px] font-bold text-muted-foreground leading-tight">Add a Form 2307 (EWT) that can be distributed across multiple invoices.</p></div>
                                            <div className="space-y-3">
                                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount (₱)</label><Input type="number" placeholder="0.00" value={globalEwtAmount} onChange={(e) => setGlobalEwtAmount(e.target.value)}/></div>
                                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reference No.</label><Input placeholder="E.g. 2307-XXX" value={globalEwtRef} onChange={(e) => setGlobalEwtRef(e.target.value)}/></div>
                                                <Button className="w-full mt-2 font-black uppercase tracking-widest bg-teal-600 hover:bg-teal-700 text-white" onClick={handleCreateGlobalEwt}>Add to Pouch</Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <Popover open={adjOpen} onOpenChange={setAdjOpen}>
                                        <PopoverTrigger asChild><Button onClick={() => { setAdjInvoiceId(null); setAdjAmount(""); setAdjRemarks(""); setAdjBalanceType(2); setAdjCoaId(""); }} size="sm" variant="outline" className="h-6 text-[9px] font-black uppercase tracking-widest text-purple-600 border-purple-200 hover:bg-purple-50 px-2 gap-1"><Plus size={10} strokeWidth={3}/> Variance</Button></PopoverTrigger>
                                        <PopoverContent className="w-[320px] p-5 space-y-4 shadow-xl border-purple-200" align="start">
                                            <div className="space-y-1 mb-4 border-b border-border/50 pb-3"><h4 className="font-black text-sm text-foreground flex items-center gap-2"><Wallet size={16} className="text-purple-500"/> Record Variance</h4><p className="text-[11px] font-bold text-muted-foreground leading-tight">Select whether this variance increases physical assets or decreases them.</p></div>
                                            <div className="space-y-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Variance Type</label>
                                                    <div className="flex gap-2">
                                                        <Button variant={adjBalanceType === 2 ? "default" : "outline"} onClick={() => setAdjBalanceType(2)} className={`h-8 w-1/2 text-xs font-bold ${adjBalanceType === 2 ? 'bg-purple-600 text-white' : 'text-muted-foreground'}`}>Shortage (Credit)</Button>
                                                        <Button variant={adjBalanceType === 1 ? "default" : "outline"} onClick={() => setAdjBalanceType(1)} className={`h-8 w-1/2 text-xs font-bold ${adjBalanceType === 1 ? 'bg-red-600 text-white' : 'text-muted-foreground'}`}>Overage (Debit)</Button>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Category</label><Popover open={adjCoaOpen} onOpenChange={setAdjCoaOpen}><PopoverTrigger asChild><Button variant="outline" role="combobox" className={cn("w-full h-9 justify-between text-sm font-bold bg-background", !adjCoaId && "text-muted-foreground border-dashed border-primary/50")}><span className="truncate flex items-center gap-2"><Layers size={14}/>{adjCoaId ? uniqueCategories.find((c) => c.id === adjCoaId)?.title : "Select Category..."}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/></Button></PopoverTrigger><PopoverContent className="w-[280px] p-0" align="start"><Command><CommandInput placeholder="Search category..." className="text-sm"/><CommandList className="max-h-[200px] overflow-y-auto" onWheelCapture={(e) => e.stopPropagation()}><CommandEmpty>No categories found.</CommandEmpty><CommandGroup>{uniqueCategories.map((coa) => ( <CommandItem key={coa.id} value={coa.title} onSelect={() => { setAdjCoaId(coa.id); setAdjFindingId(""); setAdjCoaOpen(false); }} className="text-sm cursor-pointer"><Check className={cn("mr-2 h-4 w-4 text-primary", adjCoaId === coa.id ? "opacity-100" : "opacity-0")}/>{coa.title}</CommandItem> ))}</CommandGroup></CommandList></Command></PopoverContent></Popover></div>
                                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Specific Reason</label><Popover open={adjAccountOpen} onOpenChange={setAdjAccountOpen}><PopoverTrigger asChild><Button variant="outline" role="combobox" disabled={!adjCoaId} className={cn("w-full h-9 justify-between text-sm font-bold bg-background", !adjFindingId && "text-muted-foreground border-dashed border-primary/50")}><span className="truncate pl-6">{adjFindingId ? filteredFindings.find((f) => f.id === adjFindingId)?.findingName : "Select specific reason..."}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/></Button></PopoverTrigger><PopoverContent className="w-[280px] p-0" align="start"><Command><CommandInput placeholder="Search reason..." className="text-sm"/><CommandList className="max-h-[250px] overflow-y-auto" onWheelCapture={(e) => e.stopPropagation()}><CommandEmpty>No findings under this category.</CommandEmpty><CommandGroup>{filteredFindings.map((f) => ( <CommandItem key={f.id} value={f.findingName} onSelect={() => { setAdjFindingId(f.id); setAdjAccountOpen(false); }} className="text-sm cursor-pointer"><Check className={cn("mr-2 h-4 w-4 text-primary", adjFindingId === f.id ? "opacity-100" : "opacity-0")}/>{f.findingName}</CommandItem> ))}</CommandGroup></CommandList></Command></PopoverContent></Popover></div>
                                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount (₱)</label><Input type="number" placeholder="0.00" value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)}/></div>
                                                <div className="flex flex-col gap-1.5"><label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reference / Remarks</label><Input placeholder="E.g. Reason for variance" value={adjRemarks} onChange={(e) => setAdjRemarks(e.target.value)}/></div>
                                                <Button className="w-full mt-2 font-black uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white" disabled={!adjFindingId || adjAmount === "" || parseFloat(adjAmount) === 0 || isNaN(parseFloat(adjAmount)) || isCreatingAdj} onClick={handleCreateAdjustment}>{isCreatingAdj ? <Loader2 size={16} className="animate-spin"/> : "Inject into Pouch"}</Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}
                        </div>

                        <div className="p-3 flex-1 overflow-y-auto space-y-2.5 scrollbar-thin">
                            {wallet.map(w => {
                                const used = w.originalAmount > 0 ? getUsedAmount(w.id) : 0;
                                const remaining = w.originalAmount - used;
                                const isExhausted = w.originalAmount > 0 && remaining <= 0;

                                let borderLeft = "border-l-emerald-500"; let badgeColor = "default";
                                if (w.type === "CHECK") { borderLeft = "border-l-blue-500"; badgeColor = "secondary"; }
                                if (w.type === "MEMO") { borderLeft = "border-l-purple-500"; badgeColor = "outline"; }
                                if (w.type === "RETURN") { borderLeft = "border-l-orange-500"; badgeColor = "destructive"; }
                                if (w.type === "EWT") { borderLeft = "border-l-teal-500"; badgeColor = "secondary"; }
                                if (w.type === "ADJUSTMENT") { borderLeft = w.balanceTypeId === 1 ? "border-l-red-500 border-dashed" : "border-l-purple-400 border-dashed"; badgeColor = w.balanceTypeId === 1 ? "destructive" : "outline"; }

                                if (editingId === w.id) {
                                    return (
                                        <div key={`edit-${w.id}`} className="p-3 rounded-xl border shadow-md bg-card border-primary/40 space-y-3 animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden">
                                            <div className="flex justify-between items-center pb-2 border-b border-border/50">
                                                <span className="text-[11px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5"><Edit2 size={12}/> Edit {w.type}</span>
                                                <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setEditingId(null)}><X size={12}/></Button>
                                            </div>

                                            <div className="space-y-2.5">
                                                {w.type === "ADJUSTMENT" && (
                                                    <>
                                                        <div className="flex gap-2">
                                                            <Button size="sm" variant={editBalType === 2 ? "default" : "outline"} onClick={() => setEditBalType(2)} className={`h-7 w-1/2 text-[10px] font-black tracking-widest uppercase ${editBalType === 2 ? 'bg-purple-600 text-white' : 'text-muted-foreground'}`}>Shortage (Credit)</Button>
                                                            <Button size="sm" variant={editBalType === 1 ? "default" : "outline"} onClick={() => setEditBalType(1)} className={`h-7 w-1/2 text-[10px] font-black tracking-widest uppercase ${editBalType === 1 ? 'bg-red-600 text-white' : 'text-muted-foreground'}`}>Overage (Debit)</Button>
                                                        </div>
                                                        <Popover open={editCoaOpen} onOpenChange={setEditCoaOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" role="combobox" className={cn("w-full h-8 justify-between text-xs font-bold bg-muted/30", !editCoaId && "text-muted-foreground border-dashed")}>
                                                                    <span className="truncate flex items-center gap-2"><Layers size={14}/>{editCoaId ? uniqueCategories.find((c) => c.id === editCoaId)?.title : "Select Category..."}</span>
                                                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50"/>
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[280px] p-0 shadow-xl" align="start">
                                                                <Command>
                                                                    <CommandInput placeholder="Search category..." className="text-xs h-8"/>
                                                                    <CommandList className="max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-foreground/20">
                                                                        <CommandEmpty className="py-2 text-xs text-center text-muted-foreground">No categories found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {uniqueCategories.map((coa) => (
                                                                                <CommandItem key={coa.id} value={coa.title} onSelect={() => { setEditCoaId(coa.id); setEditFId(""); setEditCoaOpen(false); }} className="text-xs cursor-pointer py-1.5">
                                                                                    <Check className={cn("mr-2 h-3 w-3 text-primary", editCoaId === coa.id ? "opacity-100" : "opacity-0")}/>{coa.title}
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>

                                                        <Popover open={editAccountOpen} onOpenChange={setEditAccountOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" role="combobox" disabled={!editCoaId} className={cn("w-full h-8 justify-between text-xs font-bold bg-muted/30", !editFId && "text-muted-foreground border-dashed")}>
                                                                    <span className="truncate">{editFId ? editFilteredFindings.find((f) => f.id === editFId)?.findingName : "Select specific reason..."}</span>
                                                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50"/>
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[280px] p-0 shadow-xl" align="start">
                                                                <Command>
                                                                    <CommandInput placeholder="Search reason..." className="text-xs h-8"/>
                                                                    <CommandList className="max-h-[250px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-foreground/20">
                                                                        <CommandEmpty className="py-2 text-xs text-center text-muted-foreground">No account found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {editFilteredFindings.map((f) => (
                                                                                <CommandItem key={f.id} value={f.findingName} onSelect={() => { setEditFId(f.id); setEditAccountOpen(false); }} className="text-xs cursor-pointer py-1.5">
                                                                                    <Check className={cn("mr-2 h-3 w-3 text-primary", editFId === f.id ? "opacity-100" : "opacity-0")}/>{f.findingName}
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </>
                                                )}
                                                <div className="relative">
                                                    <span className="absolute left-2.5 top-2 text-[10px] font-black text-muted-foreground">₱</span>
                                                    <Input type="number" value={editAmt} onChange={e => setEditAmt(e.target.value)} placeholder="0.00" className="h-8 pl-6 text-xs font-mono font-black shadow-inner bg-muted/20"/>
                                                </div>
                                                <Input value={editRef} onChange={e => setEditRef(e.target.value)} placeholder={w.type === "EWT" ? "Form 2307 Reference No." : "Remarks / Reason"} className="h-8 text-xs bg-muted/20 shadow-inner"/>
                                            </div>

                                            <Button size="sm" className="w-full h-8 text-[10px] font-black tracking-widest uppercase bg-primary text-white mt-1 shadow-md transition-transform active:scale-95"
                                                    onClick={() => {
                                                        const numAmt = parseFloat(editAmt);
                                                        if (isNaN(numAmt) || numAmt <= 0) return toast.error("Please enter a valid amount greater than 0.");
                                                        if (w.type === "ADJUSTMENT" && !editFId) return toast.error("Please select a specific reason from the dropdown.");

                                                        const label = w.type === "EWT" ? `Form 2307: ${editRef}` : (findings.find(f => f.id === editFId)?.findingName || "Adjustment");
                                                        editWalletItem(w.id, { originalAmount: numAmt, customerName: editRef, findingId: w.type === "ADJUSTMENT" ? Number(editFId) : undefined, balanceTypeId: w.type === "ADJUSTMENT" ? editBalType : 2, label });
                                                        setEditingId(null);
                                                    }}>
                                                <Save size={12} className="mr-1.5"/> Confirm Update
                                            </Button>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={`source-${w.id}`} className={`p-3 rounded-lg border shadow-sm transition-all group ${isExhausted ? 'bg-muted/30 border-dashed opacity-60' : `bg-background border-border border-l-4 ${borderLeft}`}`}>
                                        <div className="flex justify-between items-start mb-2">
                                            <span className={`text-[11px] font-black uppercase tracking-widest truncate pr-2 ${w.type === 'ADJUSTMENT' ? (w.balanceTypeId === 1 ? 'text-red-700' : 'text-purple-700') : ''}`}>{w.label}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <Badge variant={badgeColor as "default" | "secondary" | "destructive" | "outline"} className={`text-[8px] uppercase px-1.5 py-0 h-4 ${w.type === 'ADJUSTMENT' && w.balanceTypeId === 2 ? 'border-purple-200 text-purple-700 bg-purple-50' : (w.type === 'EWT' ? 'border-teal-200 text-teal-700 bg-teal-50' : '')}`}>{w.type}</Badge>
                                                {!isPosted && (w.type === "ADJUSTMENT" || w.type === "EWT") && (
                                                    <div className="flex items-center ml-1 border-l border-border/50 pl-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => {
                                                            setEditingId(w.id); setEditAmt(w.originalAmount.toString()); setEditRef(w.customerName || "");
                                                            const matchedFinding = findings?.find(f => f.id === w.findingId || f.findingName === w.label);
                                                            const cId = matchedFinding?.chartOfAccount?.coaId || matchedFinding?.chartOfAccount?.id;
                                                            setEditCoaId(cId || ""); setEditFId(matchedFinding?.id || w.findingId || ""); setEditBalType(w.balanceTypeId || 2);
                                                        }} className="text-muted-foreground hover:text-blue-500 transition-colors p-0.5" title="Edit Item"><Edit2 size={12}/></button>
                                                        <button onClick={() => deleteWalletItem(w.id, w.type)} className="text-muted-foreground hover:text-destructive transition-colors p-0.5" title="Remove Item"><Trash2 size={12}/></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {(w.customerName || w.invoiceId) && (
                                            <div className="bg-muted/40 rounded px-2 py-1.5 mb-2 flex flex-col gap-1 border border-border/50">
                                                {w.customerName && (
                                                    <div className="flex items-center gap-1.5 text-[9px] font-bold text-muted-foreground truncate" title={w.customerName}>
                                                        <User size={10} className="shrink-0"/> {w.customerName}
                                                    </div>
                                                )}
                                                {w.invoiceId && (
                                                    <div className="flex items-center gap-1.5 text-[9px] font-black text-blue-600 dark:text-blue-400 truncate" title="Pre-linked Invoice">
                                                        <Receipt size={10} className="shrink-0"/>
                                                        {cartInvoices.find(inv => inv.id === w.invoiceId)?.invoiceNo || `Invoice ID: ${w.invoiceId}`}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className={`flex justify-between gap-4 text-xs ${w.customerName || w.invoiceId ? 'mt-1.5 border-t border-border/50 pt-1.5' : 'mt-2'}`}>
                                            <div className="min-w-0 flex-1"><p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Original</p><p className="font-mono truncate">₱{w.originalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                                            <div className="text-right min-w-0 flex-1"><p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Remaining</p><p className={`font-mono font-black truncate ${isExhausted ? 'text-muted-foreground' : (w.balanceTypeId === 1 ? 'text-red-600' : 'text-emerald-600')}`}>₱{remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div className="bg-purple-500/10 p-3 border-b border-purple-500/20 flex flex-col gap-2 shrink-0">
                            <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-400 flex items-center gap-2"><Percent size={14}/> Available Credits</span><Badge variant="outline" className="text-[9px] font-black bg-purple-50 border-purple-200 text-purple-700">OPTIONAL</Badge></div>
                            <Input placeholder="Search by customer, memo no..." value={creditSearch} onChange={(e) => setCreditSearch(e.target.value)} className="h-7 text-[10px] font-bold shadow-inner bg-background border-purple-200 focus-visible:ring-purple-500"/>
                        </div>
                        <div className="p-3 flex-1 overflow-y-auto space-y-2.5 scrollbar-thin">
                            {filteredCredits.length === 0 ? <p className="text-[10px] text-center text-muted-foreground font-bold uppercase pt-10 italic">No matching credits</p> : filteredCredits.map(c => {
                                const used = c.originalAmount > 0 ? getUsedAmount(c.id) : 0;
                                const remaining = c.originalAmount - used;
                                const isExhausted = c.originalAmount > 0 && remaining <= 0;
                                return (
                                    <div key={`source-${c.id}`} className={`p-3 rounded-lg border shadow-sm transition-all group ${isExhausted ? 'bg-muted/30 border-dashed opacity-60' : 'bg-background border-border border-l-4 border-l-purple-500'}`}>
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-[11px] font-black uppercase tracking-widest truncate pr-2">{c.label}</span>
                                            <Badge variant="outline" className="text-[8px] uppercase px-1.5 py-0 h-4 border-purple-200 text-purple-700 bg-purple-50">{c.type}</Badge>
                                        </div>
                                        {c.customerName && <div className="text-[9px] font-bold text-muted-foreground truncate mb-1.5" title={c.customerName}>{c.customerName}</div>}
                                        <div className={`flex justify-between gap-4 text-xs ${c.customerName ? 'mt-1.5 border-t border-border/50 pt-1.5' : 'mt-2'}`}>
                                            <div className="min-w-0 flex-1"><p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Original</p><p className="font-mono truncate">₱{c.originalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                                            <div className="text-right min-w-0 flex-1"><p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Remaining</p><p className={`font-mono font-black truncate ${isExhausted ? 'text-muted-foreground' : 'text-emerald-600'}`}>₱{remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}</p></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="col-span-1 lg:col-span-8 bg-card rounded-xl border border-border shadow-sm flex flex-col overflow-hidden lg:h-full min-h-0">
                    <div className="bg-blue-500/10 p-4 border-b border-blue-500/20 flex flex-col gap-3 shrink-0">
                        <div className="flex justify-between items-center">
                            <span className="text-[11px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 flex items-center gap-2"><Receipt size={16}/> Active Settlement Cart</span>
                            <div className="flex gap-2 items-center">
                                {!isPosted && (
                                    <>
                                        <Button onClick={loadRouteInvoices} disabled={isLoadingRoute} variant="secondary" size="sm" className="h-7 text-[10px] uppercase font-black tracking-widest bg-blue-100 hover:bg-blue-200 text-blue-700 px-3">{isLoadingRoute ? <Loader2 size={12} className="mr-1.5 animate-spin"/> : <Truck size={12} className="mr-1.5"/>}Load Route</Button>
                                        <Popover open={routePopoverOpen} onOpenChange={setRoutePopoverOpen}>
                                            <PopoverTrigger asChild><Button variant="outline" size="sm" className="h-7 text-[10px] uppercase font-black tracking-widest border-blue-200 text-blue-700 hover:bg-blue-50 px-3">{isLoadingPlans ? <Loader2 size={12} className="mr-1.5 animate-spin"/> : <MapPin size={12} className="mr-1.5"/>}Dispatch Plan <ChevronDown size={12} className="ml-1" /></Button></PopoverTrigger>
                                            <PopoverContent align="end" className="w-72 p-0 shadow-xl border-blue-200">
                                                <div className="p-3 border-b bg-blue-50/50">
                                                    <h4 className="font-black text-[11px] uppercase tracking-widest text-blue-800">Select Source</h4>
                                                    <p className="text-[10px] text-muted-foreground mt-0.5">Load specific deliveries from a plan.</p>
                                                    <div className="mt-2 flex items-center gap-2 bg-background border rounded-md px-2">
                                                        <Calendar size={12} className="text-muted-foreground" />
                                                        <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} className="h-8 border-none shadow-none text-xs font-bold px-0 focus-visible:ring-0"/>
                                                    </div>
                                                </div>
                                                <div className="p-2 max-h-[250px] overflow-y-auto scrollbar-thin" onWheelCapture={(e) => e.stopPropagation()}>
                                                    {dispatchPlans.length > 0 ? (
                                                        <div className="space-y-1 mb-2">
                                                            <p className="text-[9px] font-black uppercase text-muted-foreground px-2 py-1">Available Dispatch Plans</p>
                                                            {dispatchPlans.map(plan => (
                                                                <button key={plan.id} onClick={() => { loadDispatchPlanInvoices(plan.id); setRoutePopoverOpen(false); }} className="w-full flex flex-col items-start p-2 rounded-md hover:bg-blue-50 transition-colors text-left">
                                                                    <span className="font-mono font-bold text-sm text-primary flex items-center gap-2"><MapPin size={12}/> {plan.docNo}</span>
                                                                    <span className="text-[10px] text-muted-foreground mt-0.5 font-medium">{plan.vehicleName} • {plan.driverName}</span>
                                                                </button>
                                                            ))}
                                                        </div>
                                                    ) : (<div className="px-2 py-4 text-center text-muted-foreground text-[10px] italic bg-muted/20 rounded-md mb-2">No dispatch plans found for this date.</div>)}
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </>
                                )}
                                {!isPosted && cartInvoices.length > 0 && <Button onClick={clearCart} variant="ghost" size="sm" className="h-7 text-[10px] uppercase font-black tracking-widest text-destructive hover:bg-destructive/10 px-3"><Trash2 size={12} className="mr-1.5"/> Clear Cart</Button>}
                            </div>
                        </div>

                        {!isPosted && (
                            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" aria-expanded={searchOpen} className="w-full justify-between h-9 font-mono text-sm font-bold bg-background text-muted-foreground hover:text-foreground"><span className="flex items-center gap-2"><Search size={14}/> Add Invoice from Remittance Report...</span></Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[90vw] sm:w-[800px] p-0" align="start">
                                    <Command shouldFilter={false}>
                                        <CommandInput placeholder="Type Invoice No. or Customer Name..." value={searchQuery} onValueChange={setSearchQuery}/>
                                        <CommandList className="max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-foreground/20">
                                            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">{isSearching ? <span className="flex items-center justify-center gap-2"><Loader2 size={16} className="animate-spin"/> Searching...</span> : "No results."}</CommandEmpty>
                                            <CommandGroup heading={searchResults.length > 0 ? "Database Results" : ""}>
                                                {searchResults.map((inv) => (
                                                    <CommandItem key={`search-${inv.id}`} onSelect={() => { addToCart(inv); setSearchOpen(false); }} className="flex justify-between items-center cursor-pointer py-3">
                                                        <div className="flex flex-col"><span className="font-mono font-black text-primary">{inv.invoiceNo}</span><span className="text-xs text-muted-foreground font-medium">{inv.customerName}</span></div>
                                                        <span className="font-mono font-black text-emerald-600">₱{inv.remainingBalance.toLocaleString()}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-thin bg-muted/5 relative [&_div.relative.w-full.overflow-auto]:!overflow-visible">
                        <SettlementInvoiceCartTable
                            isPosted={isPosted}
                            cartInvoices={cartInvoices}
                            allocations={allocations}
                            wallet={wallet}
                            credits={credits}
                            combinedSources={combinedSources}
                            cartTotalBalance={cartTotalBalance}
                            cartTotalAppliedSession={cartTotalAppliedSession}
                            removeFromCart={removeFromCart}
                            handleInvoiceDiscrepancy={handleInvoiceDiscrepancy}
                            handleAutoCalculateEWT={handleAutoCalculateEWT}
                            handleAllocate={handleAllocate}
                            getInvoiceApplied={getInvoiceApplied}
                            getUsedAmount={getUsedAmount}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}