"use client";

import React, {useState, useEffect, useMemo} from "react";
import {useSettlement, WalletItem} from "../hooks/useSettlement";
import {
    Receipt, ShieldCheck, Wallet, Save, Search, ChevronDown, Plus, X,
    Loader2, History, Info, Percent, Trash2, Lock, Printer, Wand2, Truck, CheckCircle2, FileText, ChevronsUpDown, Check
} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter} from "@/components/ui/table";
import {Popover, PopoverContent, PopoverTrigger} from "@/components/ui/popover";
import {Input} from "@/components/ui/input";
import {Badge} from "@/components/ui/badge";
import {Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList} from "@/components/ui/command";
import {fetchProvider} from "../../providers/fetchProvider";
import {UnpaidInvoice} from "../../types";
import {cn} from "@/lib/utils";

interface SettlementCommandCenterProps {
    id: string | number;
    onClose?: () => void;
}

export default function SettlementCommandCenter({id, onClose}: SettlementCommandCenterProps) {
    const {
        isLoading,
        wallet,
        credits,
        cartInvoices,
        allocations,
        salesmanName,
        salesmanId,
        findings,
        docNo,
        isPosted,
        isLoadingRoute,
        loadRouteInvoices,
        addToCart,
        removeFromCart,
        clearCart,
        getUsedAmount,
        getInvoiceApplied,
        handleAllocate,
        createAdjustment,
        createEwt,
        submitSettlement,
        deleteWalletItem
    } = useSettlement(id);

    const [searchOpen, setSearchOpen] = useState(false);

    // Adj State
    const [adjOpen, setAdjOpen] = useState(false);
    const [adjFindingId, setAdjFindingId] = useState<number | "">("");
    const [adjAccountOpen, setAdjAccountOpen] = useState(false);
    const [adjAmount, setAdjAmount] = useState<string>("");
    const [adjRemarks, setAdjRemarks] = useState("");
    const [adjInvoiceId, setAdjInvoiceId] = useState<number | null>(null);
    const [adjBalanceType, setAdjBalanceType] = useState<number>(2);
    const [isCreatingAdj, setIsCreatingAdj] = useState(false);

    // Global EWT State
    const [ewtOpen, setEwtOpen] = useState(false);
    const [globalEwtAmount, setGlobalEwtAmount] = useState("");
    const [globalEwtRef, setGlobalEwtRef] = useState("");

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<UnpaidInvoice[]>([]);
    const [isSearching, setIsSearching] = useState(false);

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

    const pouchTotal = useMemo(() => {
        return wallet.reduce((sum, w) => {
            if (w.balanceTypeId === 1) return sum - w.originalAmount;
            return sum + w.originalAmount;
        }, 0);
    }, [wallet]);

    const totalAllocated = useMemo(() => {
        return allocations
            .filter(a => wallet.some(w => w.id === a.sourceTempId))
            .reduce((sum, a) => {
                const source = wallet.find(w => w.id === a.sourceTempId);
                if (source?.balanceTypeId === 1) return sum - a.amountApplied;
                return sum + a.amountApplied;
            }, 0);
    }, [allocations, wallet]);

    const remainingToAllocate = pouchTotal - totalAllocated;

    const cartTotalBalance = useMemo(() => cartInvoices.reduce((sum, inv) => sum + (inv.remainingBalance || 0), 0), [cartInvoices]);
    const cartTotalAppliedSession = useMemo(() => allocations.reduce((sum, a) => sum + a.amountApplied, 0), [allocations]);

    const handleCreateAdjustment = async () => {
        const parsedAmount = Math.abs(parseFloat(adjAmount));
        const validFindingId = Number(adjFindingId);

        if (!validFindingId || validFindingId <= 0 || isNaN(parsedAmount) || parsedAmount === 0) {
            alert("Please select a valid Ledger Account / Finding Type from the dropdown before injecting.");
            return;
        }

        setIsCreatingAdj(true);
        await createAdjustment(validFindingId, parsedAmount, adjBalanceType, adjRemarks, adjInvoiceId);
        setIsCreatingAdj(false);
        setAdjOpen(false);
        setAdjFindingId("");
        setAdjAmount("");
        setAdjRemarks("");
        setAdjBalanceType(2);
        setAdjInvoiceId(null);
    };

    const handleCreateGlobalEwt = () => {
        const amt = parseFloat(globalEwtAmount);
        if (isNaN(amt) || amt <= 0 || !globalEwtRef) {
            alert("Please enter a valid amount and Form 2307 Reference Number.");
            return;
        }
        createEwt(amt, globalEwtRef, null);
        setEwtOpen(false);
        setGlobalEwtAmount("");
        setGlobalEwtRef("");
    };

    const handleAutoBalance = () => {
        const requiredAdjustment = -remainingToAllocate;
        setAdjAmount(Math.abs(requiredAdjustment).toFixed(2));
        setAdjRemarks(requiredAdjustment > 0 ? "Auto-balance: Shortage / Variance" : "Auto-balance: Overage");
        setAdjBalanceType(requiredAdjustment > 0 ? 2 : 1);
        setAdjFindingId("");
        setAdjInvoiceId(null);
        setAdjOpen(true);
    };

    const handleInvoiceDiscrepancy = (inv: UnpaidInvoice) => {
        const safeId = inv.id;
        const appliedSession = getInvoiceApplied(safeId as number);
        const remaining = Number(inv.remainingBalance ?? inv.originalAmount ?? 0);
        const discrepancy = remaining - appliedSession;

        if (discrepancy <= 0.01) {
            alert(`This invoice cannot accept a variance adjustment.\n\nTarget Balance: ₱${remaining.toFixed(2)}\nApplying Now: ₱${appliedSession.toFixed(2)}\nCalculated Variance: ₱${discrepancy.toFixed(2)}`);
            return;
        }

        setAdjAmount(Math.abs(discrepancy).toFixed(2));
        setAdjBalanceType(2);
        setAdjRemarks(`Variance for ${inv.invoiceNo}`);
        setAdjFindingId("");
        setAdjInvoiceId(safeId as number);
        setAdjOpen(true);
    };

    const handleAutoCalculateEWT = (inv: UnpaidInvoice) => {
        const netOfVat = inv.remainingBalance / 1.12;
        const defaultEwtAmount = netOfVat * 0.01;

        const refNo = prompt(`Generate Form 2307 for ${inv.invoiceNo}\n\nEnter the Form 2307 Reference Number:`, `2307-${inv.invoiceNo}`);

        if (refNo) {
            createEwt(defaultEwtAmount, refNo, inv.id);
        }
    };

    const renderWalletCard = (w: WalletItem) => {
        const used = w.originalAmount > 0 ? getUsedAmount(w.id) : 0;
        const remaining = w.originalAmount - used;
        const isExhausted = w.originalAmount > 0 && remaining <= 0;

        let borderLeft = "border-l-emerald-500";
        let badgeColor = "default";
        if (w.type === "CHECK") {
            borderLeft = "border-l-blue-500";
            badgeColor = "secondary";
        }
        if (w.type === "MEMO") {
            borderLeft = "border-l-purple-500";
            badgeColor = "outline";
        }
        if (w.type === "RETURN") {
            borderLeft = "border-l-orange-500";
            badgeColor = "destructive";
        }
        if (w.type === "EWT") {
            borderLeft = "border-l-teal-500";
            badgeColor = "secondary";
        }
        if (w.type === "ADJUSTMENT") {
            borderLeft = w.balanceTypeId === 1 ? "border-l-red-500 border-dashed" : "border-l-purple-400 border-dashed";
            badgeColor = w.balanceTypeId === 1 ? "destructive" : "outline";
        }

        return (
            <div key={`source-${w.id}`}
                 className={`p-3 rounded-lg border shadow-sm transition-all ${isExhausted ? 'bg-muted/30 border-dashed opacity-60' : `bg-background border-border border-l-4 ${borderLeft}`}`}>
                <div className="flex justify-between items-start mb-1">
                    <span
                        className={`text-[11px] font-black uppercase tracking-widest truncate pr-2 ${w.type === 'ADJUSTMENT' ? (w.balanceTypeId === 1 ? 'text-red-700' : 'text-purple-700') : ''}`}>{w.label}</span>
                    <div className="flex items-center gap-1 shrink-0">
                        <Badge variant={badgeColor as "default" | "secondary" | "destructive" | "outline"}
                               className={`text-[8px] uppercase px-1.5 py-0 h-4 ${w.type === 'ADJUSTMENT' && w.balanceTypeId === 2 ? 'border-purple-200 text-purple-700 bg-purple-50' : (w.type === 'EWT' ? 'border-teal-200 text-teal-700 bg-teal-50' : '')}`}>{w.type}
                        </Badge>
                        {w.isLocal && !isPosted && (
                            <button onClick={() => deleteWalletItem(w.id)}
                                    className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                                    title="Remove Item">
                                <Trash2 size={12}/>
                            </button>
                        )}
                    </div>
                </div>
                {w.customerName && (
                    <div className="text-[9px] font-bold text-muted-foreground truncate mb-1.5"
                         title={w.customerName}>{w.customerName}</div>
                )}
                <div
                    className={`flex justify-between gap-4 text-xs ${w.customerName ? 'mt-1.5 border-t border-border/50 pt-1.5' : 'mt-2'}`}>
                    <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Original</p>
                        <p className="font-mono truncate">₱{w.originalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</p>
                    </div>
                    <div className="text-right min-w-0 flex-1">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Remaining</p>
                        <p className={`font-mono font-black truncate ${isExhausted ? 'text-muted-foreground' : (w.balanceTypeId === 1 ? 'text-red-600' : 'text-emerald-600')}`}>
                            ₱{remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </p>
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return <div
            className="p-10 flex h-full items-center justify-center text-center animate-pulse font-bold text-muted-foreground uppercase tracking-widest">Initializing
            Command Center...</div>;
    }

    const combinedSources = [...wallet, ...credits];

    return (
        <div className="w-full h-full flex flex-col bg-muted/10 overflow-hidden">
            {/* Header / Balance Bar */}
            <div
                className="bg-card border-b border-border p-5 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 shadow-sm shrink-0">

                <div className="flex items-start lg:items-center gap-4 w-full lg:w-auto">
                    {onClose && (
                        <Button variant="ghost" size="icon" onClick={onClose}
                                className="shrink-0 h-10 w-10 rounded-full hover:bg-muted border border-border/50">
                            <X size={20} className="text-muted-foreground hover:text-foreground"/>
                        </Button>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-xl font-black flex items-center gap-2 truncate">
                            <ShieldCheck className="text-primary shrink-0" size={20}/>
                            <span className="truncate">Settlement Console</span>
                            {isPosted && (
                                <Badge variant="destructive"
                                       className="ml-2 bg-red-600 tracking-widest shadow-sm text-[10px] shrink-0">
                                    <Lock size={10} className="mr-1"/> POSTED & LOCKED
                                </Badge>
                            )}
                        </h1>
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mt-1 truncate">
                            Doc No: <span className="font-mono text-primary">{docNo}</span> • Route: <span
                            className="text-primary">{salesmanName}</span>
                        </p>
                    </div>
                </div>

                <div
                    className="flex flex-wrap lg:flex-nowrap items-center gap-3 lg:gap-5 bg-muted/50 p-2.5 rounded-lg border border-border w-full lg:w-auto">
                    <div className="flex flex-col border-r pr-3 lg:pr-5 border-border/50 flex-1 lg:flex-none">
                        <span className="text-[9px] font-black uppercase text-muted-foreground tracking-tighter">Pouch Value</span>
                        <span
                            className="text-base font-black font-mono truncate">₱{pouchTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex flex-col border-r pr-3 lg:pr-5 border-border/50 flex-1 lg:flex-none">
                        <span
                            className="text-[9px] font-black uppercase text-emerald-600 tracking-tighter">Allocated</span>
                        <span
                            className="text-base font-black font-mono text-emerald-600 truncate">₱{totalAllocated.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex flex-col pr-2 flex-1 lg:flex-none">
                        <span
                            className="text-[9px] font-black uppercase tracking-tighter text-muted-foreground">Unallocated</span>
                        <span
                            className={`text-base font-black font-mono truncate ${Math.abs(remainingToAllocate) < 0.01 ? 'text-muted-foreground' : 'text-orange-500'}`}>
                            ₱{remainingToAllocate.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                    {!isPosted && Math.abs(remainingToAllocate) > 0.01 && (
                        <Button onClick={handleAutoBalance} variant="outline" size="sm"
                                className="flex-1 lg:flex-none font-black uppercase tracking-widest shadow-sm border-orange-500 text-orange-600 hover:bg-orange-50 h-10">
                            <Wand2 size={14} className="mr-2"/> Auto-Balance
                        </Button>
                    )}

                    {isPosted ? (
                        <Button onClick={() => window.print()} variant="outline" size="sm"
                                className="flex-1 lg:flex-none font-black uppercase tracking-widest shadow-md border-primary text-primary hover:bg-primary/10 h-10">
                            <Printer size={14} className="mr-2"/> Print Receipt
                        </Button>
                    ) : (
                        <Button
                            onClick={async () => {
                                await submitSettlement();
                                if (onClose) onClose();
                            }}
                            disabled={remainingToAllocate < -0.01}
                            size="sm"
                            className={`flex-1 lg:flex-none font-black uppercase tracking-widest shadow-md transition-all active:scale-95 h-10 ${
                                remainingToAllocate < -0.01 ? 'bg-destructive hover:bg-destructive/90 text-white' :
                                    (remainingToAllocate > 0.01 ? 'bg-orange-600 hover:bg-orange-700 text-white' : 'bg-primary')
                            }`}
                        >
                            <Save size={14} className="mr-2"/>
                            {remainingToAllocate < -0.01 ? "Over-Allocated!" : (remainingToAllocate > 0.01 ? "Save Partial" : "Commit to Ledger")}
                        </Button>
                    )}
                </div>
            </div>

            {/* 🚀 THE FLEX FIX: flex-1 min-h-0 allows the grid children to actually scroll instead of breaking the page height! */}
            <div
                className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 lg:p-6 overflow-y-auto lg:overflow-hidden">

                {/* LEFT SIDE: SPLIT WALLET AND CREDITS */}
                <div className="col-span-1 lg:col-span-4 flex flex-col gap-4 overflow-hidden lg:h-full">
                    {/* SECTION 1: ACTUAL POUCH FUNDS */}
                    <div
                        className="bg-card rounded-xl border border-border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div
                            className="bg-emerald-500/10 p-3 border-b border-emerald-500/20 flex justify-between items-center shrink-0">
                            <span
                                className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                                <Wallet size={14}/> Funds to Liquidate
                            </span>

                            {!isPosted && (
                                <div className="flex gap-2">
                                    <Popover open={ewtOpen} onOpenChange={setEwtOpen}>
                                        <PopoverTrigger asChild>
                                            <Button size="sm" variant="outline"
                                                    className="h-6 text-[9px] font-black uppercase tracking-widest text-teal-600 border-teal-200 hover:bg-teal-50 px-2 gap-1">
                                                <Plus size={10} strokeWidth={3}/> Form 2307
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80 p-5 space-y-4 shadow-xl border-teal-200"
                                                        align="start">
                                            <div className="space-y-1 mb-4 border-b border-border/50 pb-3">
                                                <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                                                    <FileText size={16} className="text-teal-500"/> Pooled EWT
                                                </h4>
                                                <p className="text-[11px] font-bold text-muted-foreground leading-tight">
                                                    Add a Form 2307 (EWT) that can be distributed across multiple
                                                    invoices.
                                                </p>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <label
                                                        className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount
                                                        (₱)</label>
                                                    <Input type="number" placeholder="0.00" value={globalEwtAmount}
                                                           onChange={(e) => setGlobalEwtAmount(e.target.value)}/>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label
                                                        className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reference
                                                        No.</label>
                                                    <Input placeholder="E.g. 2307-XXX" value={globalEwtRef}
                                                           onChange={(e) => setGlobalEwtRef(e.target.value)}/>
                                                </div>
                                                <Button
                                                    className="w-full mt-2 font-black uppercase tracking-widest bg-teal-600 hover:bg-teal-700 text-white"
                                                    onClick={handleCreateGlobalEwt}>
                                                    Add to Pouch
                                                </Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>

                                    <Popover open={adjOpen} onOpenChange={setAdjOpen}>
                                        <PopoverTrigger asChild>
                                            <Button onClick={() => {
                                                setAdjInvoiceId(null);
                                                setAdjAmount("");
                                                setAdjRemarks("");
                                                setAdjBalanceType(2);
                                            }} size="sm" variant="outline"
                                                    className="h-6 text-[9px] font-black uppercase tracking-widest text-purple-600 border-purple-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 px-2 gap-1">
                                                <Plus size={10} strokeWidth={3}/> Variance
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-80 p-5 space-y-4 shadow-xl border-purple-200"
                                                        align="start">
                                            <div className="space-y-1 mb-4 border-b border-border/50 pb-3">
                                                <h4 className="font-black text-sm text-foreground flex items-center gap-2">
                                                    <Wallet size={16} className="text-purple-500"/> Record Variance
                                                </h4>
                                                <p className="text-[11px] font-bold text-muted-foreground leading-tight">
                                                    Select whether this variance increases the physical assets
                                                    (Shortage) or
                                                    decreases them (Overage).
                                                </p>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="flex flex-col gap-1.5">
                                                    <label
                                                        className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Variance
                                                        Type</label>
                                                    <div className="flex gap-2">
                                                        <Button
                                                            variant={adjBalanceType === 2 ? "default" : "outline"}
                                                            onClick={() => setAdjBalanceType(2)}
                                                            className={`h-8 w-1/2 text-xs font-bold ${adjBalanceType === 2 ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'text-muted-foreground'}`}
                                                        >
                                                            Shortage (Debit)
                                                        </Button>
                                                        <Button
                                                            variant={adjBalanceType === 1 ? "default" : "outline"}
                                                            onClick={() => setAdjBalanceType(1)}
                                                            className={`h-8 w-1/2 text-xs font-bold ${adjBalanceType === 1 ? 'bg-red-600 hover:bg-red-700 text-white' : 'text-muted-foreground'}`}
                                                        >
                                                            Overage (Credit)
                                                        </Button>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col gap-1.5">
                                                    <label
                                                        className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Adjustment
                                                        Account</label>
                                                    <Popover open={adjAccountOpen} onOpenChange={setAdjAccountOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button variant="outline" role="combobox"
                                                                    className={cn("w-full h-9 justify-between text-sm font-bold bg-background", !adjFindingId && "text-muted-foreground border-dashed border-primary/50")}>
                                                                <span className="truncate">
                                                                    {adjFindingId ? findings?.find((f) => f.id.toString() === adjFindingId.toString())?.findingName : "Select Ledger Account..."}
                                                                </span>
                                                                <ChevronsUpDown
                                                                    className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-[300px] p-0" align="start">
                                                            <Command>
                                                                <CommandInput placeholder="Type account name..."
                                                                              className="text-sm"/>
                                                                <CommandList>
                                                                    <CommandEmpty>No account found.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {findings?.map((f) => (
                                                                            <CommandItem key={f.id}
                                                                                         value={f.findingName}
                                                                                         onSelect={() => {
                                                                                             setAdjFindingId(f.id);
                                                                                             setAdjAccountOpen(false);
                                                                                         }}
                                                                                         className="text-sm cursor-pointer">
                                                                                <Check
                                                                                    className={cn("mr-2 h-4 w-4 text-primary", adjFindingId === f.id ? "opacity-100" : "opacity-0")}/>
                                                                                {f.findingName}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label
                                                        className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Amount
                                                        (₱)</label>
                                                    <Input type="number" placeholder="0.00" value={adjAmount}
                                                           onChange={(e) => setAdjAmount(e.target.value)}/>
                                                </div>
                                                <div className="flex flex-col gap-1.5">
                                                    <label
                                                        className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Reference
                                                        / Remarks</label>
                                                    <Input placeholder="E.g. Reason for variance" value={adjRemarks}
                                                           onChange={(e) => setAdjRemarks(e.target.value)}/>
                                                </div>
                                                <Button
                                                    className="w-full mt-2 font-black uppercase tracking-widest bg-purple-600 hover:bg-purple-700 text-white"
                                                    disabled={!adjFindingId || adjAmount === "" || parseFloat(adjAmount) === 0 || isNaN(parseFloat(adjAmount)) || isCreatingAdj}
                                                    onClick={handleCreateAdjustment}>
                                                    {isCreatingAdj ?
                                                        <Loader2 size={16}
                                                                 className="animate-spin"/> : "Inject into Pouch"}
                                                </Button>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            )}
                        </div>
                        <div className="p-3 flex-1 overflow-y-auto space-y-2.5 scrollbar-thin">
                            {wallet.map(w => renderWalletCard(w))}
                        </div>
                    </div>

                    {/* SECTION 2: CUSTOMER CREDITS */}
                    <div
                        className="bg-card rounded-xl border border-border shadow-sm flex flex-col flex-1 min-h-0 overflow-hidden">
                        <div
                            className="bg-purple-500/10 p-3 border-b border-purple-500/20 flex justify-between items-center shrink-0">
                            <span
                                className="text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-400 flex items-center gap-2">
                                <Percent size={14}/> Available Credits
                            </span>
                            <Badge variant="outline"
                                   className="text-[9px] font-black bg-purple-50 border-purple-200 text-purple-700">OPTIONAL</Badge>
                        </div>
                        <div className="p-3 flex-1 overflow-y-auto space-y-2.5 scrollbar-thin">
                            {credits.length === 0 ? (
                                <p className="text-[10px] text-center text-muted-foreground font-bold uppercase pt-10 italic">No
                                    available credits</p>
                            ) : credits.map(c => renderWalletCard(c))}
                        </div>
                    </div>
                </div>

                {/* RIGHT SIDE: THE INVOICE CART */}
                <div
                    className="col-span-1 lg:col-span-8 bg-card rounded-xl border border-border shadow-sm flex flex-col overflow-hidden lg:h-full min-h-0">
                    <div className="bg-blue-500/10 p-4 border-b border-blue-500/20 flex flex-col gap-3 shrink-0">
                        <div className="flex justify-between items-center">
                            <span
                                className="text-[11px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                <Receipt size={16}/> Active Settlement Cart
                            </span>

                            <div className="flex gap-2 items-center">
                                {!isPosted && (
                                    <Button onClick={loadRouteInvoices} disabled={isLoadingRoute} variant="secondary"
                                            size="sm"
                                            className="h-7 text-[10px] uppercase font-black tracking-widest bg-blue-100 hover:bg-blue-200 text-blue-700 px-3">
                                        {isLoadingRoute ? <Loader2 size={12} className="mr-1.5 animate-spin"/> :
                                            <Truck size={12} className="mr-1.5"/>}
                                        Load Route
                                    </Button>
                                )}

                                {!isPosted && cartInvoices.length > 0 && (
                                    <Button onClick={clearCart} variant="ghost" size="sm"
                                            className="h-7 text-[10px] uppercase font-black tracking-widest text-destructive hover:bg-destructive/10 px-3">
                                        <Trash2 size={12} className="mr-1.5"/> Clear Cart
                                    </Button>
                                )}
                            </div>
                        </div>

                        {!isPosted && (
                            <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" aria-expanded={searchOpen}
                                            className="w-full justify-between h-9 font-mono text-sm font-bold bg-background text-muted-foreground hover:text-foreground">
                                        <span className="flex items-center gap-2"><Search size={14}/> Add Invoice from Remittance Report...</span>
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[90vw] sm:w-[800px] p-0" align="start">
                                    <Command shouldFilter={false}>
                                        <CommandInput placeholder="Type Invoice No. or Customer Name..."
                                                      value={searchQuery} onValueChange={setSearchQuery}/>
                                        <CommandList>
                                            <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                                                {isSearching ?
                                                    <span className="flex items-center justify-center gap-2"><Loader2
                                                        size={16}
                                                        className="animate-spin"/> Searching...</span> : "No results."}
                                            </CommandEmpty>
                                            <CommandGroup heading={searchResults.length > 0 ? "Database Results" : ""}>
                                                {searchResults.map((inv) => (
                                                    <CommandItem key={`search-${inv.id}`} onSelect={() => {
                                                        addToCart(inv);
                                                        setSearchOpen(false);
                                                    }}
                                                                 className="flex justify-between items-center cursor-pointer py-3">
                                                        <div className="flex flex-col">
                                                            <span
                                                                className="font-mono font-black text-primary">{inv.invoiceNo}</span>
                                                            <span
                                                                className="text-xs text-muted-foreground font-medium">{inv.customerName}</span>
                                                        </div>
                                                        <span
                                                            className="font-mono font-black text-emerald-600">₱{inv.remainingBalance.toLocaleString()}</span>
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto scrollbar-thin bg-muted/5 relative">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm border-b">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest">Invoice
                                        Info</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Balance
                                        Breakdown</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest text-right">Applying
                                        Now</TableHead>
                                    <TableHead className="w-[120px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cartInvoices.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-[40vh] text-center">
                                            <div
                                                className="flex flex-col items-center justify-center text-muted-foreground gap-3">
                                                <Receipt size={48} className="opacity-20"/>
                                                <p className="font-bold tracking-widest uppercase text-xs">Cart is
                                                    Empty</p>
                                                <p className="text-[11px]">
                                                    {isPosted ? "This pouch has no allocations." : "Search and select an invoice above to begin allocation."}
                                                </p>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : cartInvoices.map(inv => {
                                    const appliedSession = getInvoiceApplied(inv.id);
                                    const invoiceAllocations = allocations.filter(a => a.invoiceId === inv.id && a.amountApplied > 0);

                                    const appliedAdj = invoiceAllocations.filter(a => a.allocationType === "ADJUSTMENT").reduce((sum, a) => sum + a.amountApplied, 0);
                                    const appliedCredits = invoiceAllocations.filter(a => a.allocationType === "MEMO" || a.allocationType === "RETURN").reduce((sum, a) => sum + a.amountApplied, 0);

                                    const isFullySettled = appliedSession >= (inv.remainingBalance - 0.01);
                                    const isPartiallySettled = appliedSession > 0 && !isFullySettled;

                                    let rowStatus = "";
                                    let badgeColor = "";
                                    let rowBg = "bg-background";
                                    let IconComponent = null;

                                    if (isFullySettled) {
                                        if (appliedAdj > 0) {
                                            rowStatus = "ADJUSTED";
                                            badgeColor = "border-orange-200 text-orange-700 bg-orange-100";
                                            rowBg = "bg-orange-50/30 dark:bg-orange-950/10";
                                            IconComponent = <Wand2 size={10} className="mr-1"/>;
                                        } else if (appliedCredits > 0) {
                                            rowStatus = "CREDITED";
                                            badgeColor = "border-purple-200 text-purple-700 bg-purple-100";
                                            rowBg = "bg-purple-50/30 dark:bg-purple-950/10";
                                            IconComponent = <Percent size={10} className="mr-1"/>;
                                        } else {
                                            rowStatus = "PAID";
                                            badgeColor = "border-emerald-200 text-emerald-700 bg-emerald-100";
                                            rowBg = "bg-emerald-50/30 dark:bg-emerald-950/10";
                                            IconComponent = <CheckCircle2 size={10} className="mr-1"/>;
                                        }
                                    } else if (isPartiallySettled) {
                                        rowStatus = "PARTIAL";
                                        badgeColor = "border-blue-200 text-blue-700 bg-blue-100";
                                        rowBg = "bg-blue-50/10 dark:bg-blue-950/5";
                                        IconComponent = <Loader2 size={10} className="mr-1"/>;
                                    }

                                    return (
                                        <TableRow key={`cart-row-${inv.id}`}
                                                  className={`group hover:bg-muted/30 transition-all ${rowBg}`}>
                                            <TableCell className="align-top pt-4 min-w-[180px]">
                                                <div className="flex items-start gap-2">
                                                    {!isPosted && (
                                                        <button onClick={() => removeFromCart(inv.id)}
                                                                className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0">
                                                            <X size={14} strokeWidth={3}/></button>
                                                    )}
                                                    <div className="flex flex-col min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <span
                                                                className={`font-mono font-black truncate ${isFullySettled ? 'text-primary/70' : 'text-primary'}`}>{inv.invoiceNo}</span>
                                                            {rowStatus && <Badge variant="outline"
                                                                                 className={`text-[8px] px-1.5 py-0 shrink-0 ${badgeColor}`}>{IconComponent}{rowStatus}</Badge>}
                                                        </div>
                                                        <span
                                                            className="text-[10px] font-bold text-muted-foreground leading-tight mt-1">{inv.customerName}</span>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell className="align-top pt-4">
                                                <div className="flex flex-col items-end gap-1">
                                                    <div
                                                        className="flex justify-between w-full max-w-[170px] text-[9px] font-bold text-muted-foreground uppercase">
                                                        <span>Original Net:</span>
                                                        <span
                                                            className="text-foreground">₱{(inv.originalAmount || 0).toLocaleString()}</span>
                                                    </div>

                                                    {(inv.totalPayments || 0) > 0 && (
                                                        <div
                                                            className="flex justify-between w-full max-w-[170px] text-[9px] font-bold text-blue-600">
                                                            <span>Prev Payments:</span>
                                                            <span>-₱{inv.totalPayments.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                        </div>
                                                    )}
                                                    {(inv.totalMemos || 0) > 0 && (
                                                        <div
                                                            className="flex justify-between w-full max-w-[170px] text-[9px] font-bold text-purple-600">
                                                            <span>Applied Memos:</span>
                                                            <span>-₱{inv.totalMemos.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                        </div>
                                                    )}
                                                    {(inv.totalReturns || 0) > 0 && (
                                                        <div
                                                            className="flex justify-between w-full max-w-[170px] text-[9px] font-bold text-orange-600">
                                                            <span>Linked Returns:</span>
                                                            <span>-₱{inv.totalReturns.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                                        </div>
                                                    )}

                                                    <div
                                                        className="border-t border-border pt-1 mt-1 w-full max-w-[170px] flex justify-between items-center">
                                                        <span
                                                            className="text-[10px] font-black text-primary uppercase">Balance:</span>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <button
                                                                    className="font-mono font-black text-sm hover:underline decoration-double flex items-center gap-1 group">
                                                                    ₱{inv.remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                                    <History size={12}
                                                                             className="text-muted-foreground group-hover:text-primary transition-colors"/>
                                                                </button>
                                                            </PopoverTrigger>
                                                            <PopoverContent
                                                                className="w-80 p-0 shadow-2xl border-primary/20"
                                                                align="end">
                                                                <div
                                                                    className="bg-primary p-3 text-white flex justify-between items-center">
                                                                    <h4 className="font-black text-xs uppercase tracking-widest flex items-center gap-2">
                                                                        <History size={14}/> Audit Trail</h4>
                                                                    <Badge variant="outline"
                                                                           className="text-white border-white/50 text-[9px]">{inv.invoiceNo}</Badge>
                                                                </div>
                                                                <div
                                                                    className="p-3 space-y-2 max-h-[300px] overflow-y-auto scrollbar-thin">
                                                                    <div
                                                                        className="flex justify-between text-[9px] font-black uppercase text-muted-foreground border-b pb-1">
                                                                        <span>Date / Reference</span>
                                                                        <span>Applied Amount</span>
                                                                    </div>
                                                                    {inv.history && inv.history.length > 0 ? (
                                                                        inv.history.map((h, i) => (
                                                                            <div key={`hist-${inv.id}-${i}`}
                                                                                 className="flex justify-between items-center py-2 border-b border-muted/30 last:border-0">
                                                                                <div className="flex flex-col">
                                                                                    <span
                                                                                        className="text-[10px] font-mono font-bold text-foreground">{h.date}</span>
                                                                                    <span
                                                                                        className="text-[8px] font-black uppercase text-muted-foreground">{h.type} • {h.reference}</span>
                                                                                </div>
                                                                                <span
                                                                                    className="text-xs font-black text-emerald-600">₱{h.amount.toLocaleString()}</span>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div
                                                                            className="py-8 text-center flex flex-col items-center gap-2 text-muted-foreground">
                                                                            <Info size={24} className="opacity-20"/>
                                                                            <p className="text-[10px] font-bold uppercase italic">No
                                                                                Historical Records</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell className="text-right align-top pt-4">
                                                <div
                                                    className={`font-mono font-black ${appliedSession > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                                    {appliedSession > 0 ? `₱${appliedSession.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}
                                                </div>
                                                {invoiceAllocations.map((alloc, idx) => (
                                                    <div key={`alloc-${inv.id}-${alloc.sourceTempId}-${idx}`}
                                                         className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex gap-1 justify-end">
                                                        <span>{combinedSources.find(w => w.id === alloc.sourceTempId)?.type || 'ADJ'}:</span>
                                                        <span
                                                            className="text-foreground">₱{alloc.amountApplied.toLocaleString()}</span>
                                                    </div>
                                                ))}
                                            </TableCell>

                                            <TableCell className="text-right align-top pt-3 pr-4">
                                                {!isPosted && (
                                                    <div className="flex justify-end gap-1.5 items-center">
                                                        <Button size="icon" variant="ghost"
                                                                onClick={() => handleInvoiceDiscrepancy(inv)}
                                                                title="Resolve Invoice Variance"
                                                                className="h-7 w-7 text-orange-600 hover:text-orange-700 hover:bg-orange-100 shrink-0">
                                                            <Wand2 size={12} strokeWidth={3}/>
                                                        </Button>

                                                        {/* 🚀 Legacy Auto-Calculate EWT */}
                                                        <Button size="icon" variant="ghost"
                                                                onClick={() => handleAutoCalculateEWT(inv)}
                                                                title="Auto-Generate Form 2307"
                                                                className="h-7 w-7 text-teal-600 hover:text-teal-700 hover:bg-teal-100 shrink-0">
                                                            <FileText size={12} strokeWidth={3}/>
                                                        </Button>

                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <Button size="sm"
                                                                        variant={appliedSession > 0 ? "outline" : "default"}
                                                                        className={`h-7 text-[9px] font-black uppercase tracking-widest px-2 shrink-0 ${appliedSession > 0 ? 'border-emerald-500 text-emerald-600' : ''}`}>
                                                                    {appliedSession > 0 ? "Edit" : "Apply"} <ChevronDown
                                                                    size={10} className="ml-1"/>
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent
                                                                className="w-[90vw] sm:w-80 p-0 shadow-2xl border-border"
                                                                align="end">
                                                                <div
                                                                    className="bg-muted/30 p-4 border-b border-border/50">
                                                                    <h4 className="font-black text-sm text-foreground">Allocate
                                                                        for {inv.invoiceNo}</h4>
                                                                    <p className="text-xs font-bold text-muted-foreground">Target:
                                                                        ₱{inv.remainingBalance.toLocaleString()}</p>
                                                                </div>

                                                                <div
                                                                    className="p-4 max-h-[350px] overflow-y-auto space-y-5">
                                                                    <div className="space-y-3">
                                                                        <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center border-b pb-1">
                                                                            <Wallet size={12}
                                                                                    className="mr-1"/> Physical Funds &
                                                                            EWT</h5>
                                                                        {wallet.length === 0 ? (
                                                                            <p className="text-[10px] text-muted-foreground italic">No
                                                                                funds available.</p>
                                                                        ) : wallet.map(w => {
                                                                            const existingAlloc = invoiceAllocations.find(a => a.sourceTempId === w.id);
                                                                            const maxCanApply = (w.originalAmount - getUsedAmount(w.id)) + (existingAlloc?.amountApplied || 0);
                                                                            if (maxCanApply <= 0 && !existingAlloc) return null;

                                                                            return (
                                                                                <div key={`apply-${inv.id}-${w.id}`}
                                                                                     className="flex flex-col gap-1">
                                                                                    <label
                                                                                        className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex justify-between">
                                                                                        <span
                                                                                            className={`truncate w-3/5 ${w.type === 'ADJUSTMENT' ? 'text-purple-600' : (w.type === 'EWT' ? 'text-teal-600' : '')}`}>{w.label}</span>
                                                                                        <span
                                                                                            className="text-emerald-600 shrink-0">Avail: ₱{maxCanApply.toLocaleString()}</span>
                                                                                    </label>
                                                                                    <div className="relative">
                                                                                        <span
                                                                                            className="absolute left-3 top-2 text-xs font-black text-muted-foreground">₱</span>
                                                                                        <Input
                                                                                            type="number"
                                                                                            className="h-8 pl-6 pr-12 text-sm font-black text-right shadow-inner"
                                                                                            placeholder="0.00"
                                                                                            value={existingAlloc?.amountApplied || ""}
                                                                                            onChange={(e) => {
                                                                                                const val = e.target.value === "" ? 0 : parseFloat(e.target.value);
                                                                                                handleAllocate(inv.id, w.id, val);
                                                                                            }}
                                                                                        />
                                                                                        <button
                                                                                            onClick={() => handleAllocate(inv.id, w.id, maxCanApply)}
                                                                                            className="absolute right-1.5 top-1.5 h-5 px-1.5 bg-muted text-[8px] font-black tracking-widest uppercase rounded hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                                                                                        >
                                                                                            MAX
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        <h5 className="text-[10px] font-black uppercase tracking-widest text-purple-600 flex items-center border-b pb-1">
                                                                            <Percent size={12}
                                                                                     className="mr-1"/> Credits
                                                                            (Memos/Returns)</h5>
                                                                        {credits.filter(c => c.customerName === inv.customerName).length === 0 ? (
                                                                            <p className="text-[10px] text-muted-foreground italic">No
                                                                                credits for this customer.</p>
                                                                        ) : credits.map(c => {
                                                                            if (c.customerName !== inv.customerName) return null;
                                                                            const existingAlloc = invoiceAllocations.find(a => a.sourceTempId === c.id);
                                                                            const maxCanApply = (c.originalAmount - getUsedAmount(c.id)) + (existingAlloc?.amountApplied || 0);
                                                                            if (maxCanApply <= 0 && !existingAlloc) return null;

                                                                            return (
                                                                                <div key={`apply-${inv.id}-${c.id}`}
                                                                                     className="flex flex-col gap-1">
                                                                                    <label
                                                                                        className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex justify-between">
                                                                                        <span
                                                                                            className="truncate w-3/5">{c.label}</span>
                                                                                        <span
                                                                                            className="text-emerald-600 shrink-0">Avail: ₱{maxCanApply.toLocaleString()}</span>
                                                                                    </label>
                                                                                    <div className="relative">
                                                                                        <span
                                                                                            className="absolute left-3 top-2 text-xs font-black text-muted-foreground">₱</span>
                                                                                        <Input
                                                                                            type="number"
                                                                                            className="h-8 pl-6 pr-12 text-sm font-black text-right shadow-inner border-purple-200 focus-visible:ring-purple-500"
                                                                                            placeholder="0.00"
                                                                                            value={existingAlloc?.amountApplied || ""}
                                                                                            onChange={(e) => handleAllocate(inv.id, c.id, parseFloat(e.target.value) || 0)}
                                                                                        />
                                                                                        <button
                                                                                            onClick={() => handleAllocate(inv.id, c.id, maxCanApply)}
                                                                                            className="absolute right-1.5 top-1.5 h-5 px-1.5 bg-purple-50 text-[8px] font-black text-purple-600 tracking-widest uppercase rounded hover:bg-purple-200 transition-colors"
                                                                                        >
                                                                                            MAX
                                                                                        </button>
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>

                            {cartInvoices.length > 0 && (
                                <TableFooter
                                    className="bg-muted/80 sticky bottom-0 border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                                    <TableRow>
                                        <TableCell colSpan={2} className="text-right py-3">
                                            <span
                                                className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-4">Total Cart Balance:</span>
                                            <span
                                                className="font-mono font-black text-sm">₱{cartTotalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </TableCell>
                                        <TableCell className="text-right py-3 border-l border-border/50">
                                            <div className="flex flex-col items-end">
                                                <span
                                                    className="text-[9px] font-black uppercase tracking-widest text-emerald-600 mb-0.5">Total Applied</span>
                                                <span
                                                    className="font-mono font-black text-emerald-600 text-sm">₱{cartTotalAppliedSession.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell></TableCell>
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    </div>
                </div>
            </div>
        </div>
    );
}