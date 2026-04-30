"use client";

import React, { useState, useMemo } from "react";
import {
    Search, ChevronDown, X, Loader2, History, Info, Percent, Wand2,
    CheckCircle2, FileText, ArrowUp, ArrowDown, ArrowUpDown, Wallet, Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UnpaidInvoice, SettlementAllocation } from "../../types";
import { WalletItem } from "../hooks/useSettlement";
import { cn } from "@/lib/utils";

function AllocatorPopover({
                              inv, appliedSession, wallet, credits, allocations, handleAllocate, getUsedAmount
                          }: {
    inv: UnpaidInvoice;
    appliedSession: number;
    wallet: WalletItem[];
    credits: WalletItem[];
    allocations: SettlementAllocation[];
    handleAllocate: (invoiceId: number, sourceId: string, amountInput: number) => void;
    getUsedAmount: (sourceId: string) => number;
}) {
    const [localSearch, setLocalSearch] = useState("");
    const hasEWTApplied = allocations.some(a => a.invoiceId === inv.id && a.allocationType === "EWT" && a.amountApplied > 0);

    return (
        <Popover onOpenChange={(open) => { if (!open) setLocalSearch(""); }}>
            <PopoverTrigger asChild>
                <Button size="sm"
                        variant={appliedSession > 0 ? "outline" : "default"}
                        className={`h-6 text-[8px] font-black uppercase tracking-widest px-2 shrink-0 ${appliedSession > 0 ? 'border-emerald-500 text-emerald-600 bg-emerald-50 hover:bg-emerald-100' : ''}`}>
                    {appliedSession > 0 ? "Edit" : "Apply"} <ChevronDown size={10} className="ml-1"/>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[95vw] sm:w-[350px] p-0 shadow-2xl border-border" align="end">
                <div className="bg-muted/30 p-3 border-b border-border/50 flex justify-between items-center">
                    <div>
                        <h4 className="font-black text-xs text-foreground leading-none">{inv.invoiceNo}</h4>
                        <p className="text-[10px] font-bold text-muted-foreground mt-1 leading-none">Target: ₱{inv.remainingBalance.toLocaleString()}</p>
                    </div>
                </div>

                <div className="p-3 max-h-[280px] overflow-y-auto space-y-4 scrollbar-thin" onWheelCapture={(e) => e.stopPropagation()}>
                    <div className="space-y-2">
                        <h5 className="text-[9px] font-black uppercase tracking-widest text-emerald-600 flex items-center border-b pb-1">
                            <Wallet size={10} className="mr-1"/> Physical Funds & EWT
                        </h5>
                        {wallet.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic">No funds available.</p>
                        ) : wallet.map(w => {
                            const existingAlloc = allocations.find(a => a.invoiceId === inv.id && a.sourceTempId === w.id);
                            const usedElsewhere = getUsedAmount(w.id) - (existingAlloc?.amountApplied || 0);
                            const remaining = w.originalAmount - usedElsewhere;
                            const unmetBalance = inv.remainingBalance - appliedSession + (existingAlloc?.amountApplied || 0);
                            let targetMax = unmetBalance > 0 ? unmetBalance : inv.remainingBalance;
                            targetMax = Math.min(targetMax, remaining);

                            const isExactMatch = w.invoiceId === inv.id;
                            const isEWT = w.type === 'EWT';
                            const isThisEWTApplied = (existingAlloc?.amountApplied || 0) > 0;
                            const isEWTDisabled = isEWT && hasEWTApplied && !isThisEWTApplied;

                            return (
                                <div key={`apply-${inv.id}-${w.id}`} className={cn(
                                    "flex flex-col gap-1 py-1.5 border-b border-border/50 last:border-0 transition-all",
                                    isExactMatch ? "bg-blue-50/30 dark:bg-blue-950/10 px-2 -mx-2 rounded-md" : "",
                                    isEWTDisabled ? "opacity-40 grayscale pointer-events-none" : ""
                                )}>
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1 flex-wrap">
                                                <span className={cn("text-[9px] font-black uppercase leading-tight break-words", w.type === 'ADJUSTMENT' ? 'text-purple-600' : (w.type === 'EWT' ? 'text-teal-600' : 'text-foreground'))}>{w.label}</span>
                                                {isExactMatch && <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 text-[6px] px-1 h-3 leading-none tracking-widest uppercase shadow-sm">Pre-Linked</Badge>}
                                                {isEWTDisabled && <Badge variant="outline" className="text-[6px] px-1 h-3 leading-none tracking-widest uppercase bg-muted text-muted-foreground border-dashed">Limit Reached</Badge>}
                                            </div>
                                            {w.type === "CHECK" && w.customerName && <span className="text-[7px] font-bold text-muted-foreground uppercase mt-0.5 truncate" title={w.customerName}>{w.customerName}</span>}
                                        </div>
                                        <div className="flex flex-col items-end shrink-0 text-right">
                                            <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">Rem: ₱{remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            <span className="text-[7px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-tight">Orig: ₱{w.originalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                    </div>
                                    <div className="relative mt-0.5">
                                        <span className="absolute left-2.5 top-1.5 text-[10px] font-black text-muted-foreground">₱</span>
                                        <Input
                                            type="number"
                                            disabled={isEWTDisabled}
                                            className={cn("h-7 pl-5 pr-12 text-xs font-black text-right shadow-inner", isEWTDisabled && "bg-muted/50")}
                                            placeholder="0.00"
                                            value={existingAlloc?.amountApplied || ""}
                                            onChange={(e) => { const val = e.target.value === "" ? 0 : parseFloat(e.target.value); handleAllocate(inv.id, w.id, val); }}
                                        />
                                        <button disabled={isEWTDisabled} onClick={() => handleAllocate(inv.id, w.id, targetMax)} className="absolute right-1 top-1 h-5 px-1.5 bg-muted text-[7px] font-black tracking-widest uppercase rounded hover:bg-emerald-100 hover:text-emerald-700 transition-colors">MAX</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="space-y-2">
                        <h5 className="text-[9px] font-black uppercase tracking-widest text-purple-600 flex items-center border-b pb-1">
                            <Percent size={10} className="mr-1"/> Credits (Memos/Returns)
                        </h5>
                        <div className="relative flex w-full">
                            <Input type="text" placeholder="Search doc no..." className="h-7 pr-7 border-purple-200 focus-visible:ring-purple-500 text-[10px]" value={localSearch} onChange={(e) => setLocalSearch(e.target.value)} onKeyDown={(e) => e.stopPropagation()}/>
                            <Search size={12} className="absolute right-2 top-1.5 text-muted-foreground"/>
                        </div>

                        {credits.filter(c => c.customerName === inv.customerName && c.label.toLowerCase().includes(localSearch.toLowerCase())).length === 0 ? (
                            <p className="text-[10px] text-muted-foreground italic">No matching credits.</p>
                        ) : credits.map(c => {
                            if (c.customerName !== inv.customerName || !c.label.toLowerCase().includes(localSearch.toLowerCase())) return null;
                            const existingAlloc = allocations.find(a => a.invoiceId === inv.id && a.sourceTempId === c.id);
                            const usedElsewhere = getUsedAmount(c.id) - (existingAlloc?.amountApplied || 0);
                            const remaining = c.originalAmount - usedElsewhere;
                            const unmetBalance = inv.remainingBalance - appliedSession + (existingAlloc?.amountApplied || 0);
                            let targetMax = unmetBalance > 0 ? unmetBalance : inv.remainingBalance;
                            targetMax = Math.min(targetMax, remaining);

                            return (
                                <div key={`apply-${inv.id}-${c.id}`} className="flex flex-col gap-1 py-1.5 border-b border-border/50 last:border-0">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="flex flex-col min-w-0"><span className="text-[9px] font-black uppercase text-foreground leading-tight break-words">{c.label}</span></div>
                                        <div className="flex flex-col items-end shrink-0 text-right">
                                            <span className="text-[7px] font-bold text-muted-foreground uppercase tracking-widest leading-tight">Rem: ₱{remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                            <span className="text-[7px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-tight">Orig: ₱{c.originalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                    </div>
                                    <div className="relative mt-0.5">
                                        <span className="absolute left-2.5 top-1.5 text-[10px] font-black text-muted-foreground">₱</span>
                                        <Input type="number" className="h-7 pl-5 pr-12 text-xs font-black text-right shadow-inner border-purple-200 focus-visible:ring-purple-500" placeholder="0.00" value={existingAlloc?.amountApplied || ""} onChange={(e) => handleAllocate(inv.id, c.id, parseFloat(e.target.value) || 0)} />
                                        <button onClick={() => handleAllocate(inv.id, c.id, targetMax)} className="absolute right-1 top-1 h-5 px-1.5 bg-purple-50 text-[7px] font-black text-purple-600 tracking-widest uppercase rounded hover:bg-purple-200 transition-colors">MAX</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
}

export interface SettlementInvoiceCartTableProps {
    isPosted: boolean;
    cartInvoices: UnpaidInvoice[];
    allocations: SettlementAllocation[];
    wallet: WalletItem[];
    credits: WalletItem[];
    combinedSources: WalletItem[];
    cartTotalBalance: number;
    cartTotalAppliedSession: number;
    removeFromCart: (invoiceId: number) => void;
    handleInvoiceDiscrepancy: (inv: UnpaidInvoice) => void;
    handleAutoCalculateEWT: (inv: UnpaidInvoice) => void;
    handleAllocate: (invoiceId: number, sourceId: string, amountInput: number) => void;
    getInvoiceApplied: (invoiceId: number) => number;
    getUsedAmount: (sourceId: string) => number;
}

export default function SettlementInvoiceCartTable({
                                                       isPosted, cartInvoices, allocations, wallet, credits, combinedSources,
                                                       cartTotalBalance, cartTotalAppliedSession, removeFromCart, handleInvoiceDiscrepancy,
                                                       handleAutoCalculateEWT, handleAllocate, getInvoiceApplied, getUsedAmount
                                                   }: SettlementInvoiceCartTableProps) {
    const [cartSortField, setCartSortField] = useState<keyof UnpaidInvoice | null>(null);
    const [cartSortDir, setCartSortDir] = useState<"asc" | "desc">("asc");

    const handleCartSort = (field: keyof UnpaidInvoice) => {
        if (cartSortField === field) setCartSortDir(cartSortDir === "asc" ? "desc" : "asc");
        else { setCartSortField(field); setCartSortDir("asc"); }
    };

    const sortedCartInvoices = useMemo(() => {
        if (!cartSortField) return cartInvoices;
        return [...cartInvoices].sort((a, b) => {
            const aVal = a[cartSortField];
            const bVal = b[cartSortField];
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            const modifier = cartSortDir === "asc" ? 1 : -1;
            return aVal > bVal ? modifier : -modifier;
        });
    }, [cartInvoices, cartSortField, cartSortDir]);

    return (
        <div className="relative w-full h-full overflow-y-auto scrollbar-thin [&>div]:!overflow-visible">
            <Table className="relative min-w-[800px]">
                <TableHeader className="bg-muted/90 backdrop-blur-md sticky top-0 z-20 shadow-sm outline outline-1 outline-border">
                    <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-muted/80 h-8 px-4" onClick={() => handleCartSort("invoiceNo")}>
                            <div className="flex items-center gap-1">
                                <span>Invoice Info</span>
                                {cartSortField === "invoiceNo" ? (cartSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                            </div>
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right cursor-pointer hover:bg-muted/80 h-8" onClick={() => handleCartSort("originalAmount")}>
                            <div className="flex items-center justify-end gap-1">
                                <span>Balance Breakdown</span>
                                {cartSortField === "originalAmount" ? (cartSortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-50" />}
                            </div>
                        </TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest text-right h-8">Applying Now</TableHead>
                        <TableHead className="w-[120px] h-8"></TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {sortedCartInvoices.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={4} className="h-[40vh] text-center">
                                <div className="flex flex-col items-center justify-center text-muted-foreground gap-2">
                                    <Receipt size={36} className="opacity-20"/>
                                    <p className="font-bold tracking-widest uppercase text-xs">Cart is Empty</p>
                                    <p className="text-[10px]">{isPosted ? "This pouch has no allocations." : "Search and select an invoice above to begin allocation."}</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : sortedCartInvoices.map(inv => {
                        const appliedSession = getInvoiceApplied(inv.id);
                        const invoiceAllocations = allocations.filter(a => a.invoiceId === inv.id && a.amountApplied > 0);
                        const appliedAdj = invoiceAllocations.filter(a => a.allocationType === "ADJUSTMENT").reduce((sum, a) => sum + a.amountApplied, 0);
                        const appliedCredits = invoiceAllocations.filter(a => a.allocationType === "MEMO" || a.allocationType === "RETURN").reduce((sum, a) => sum + a.amountApplied, 0);

                        const hasEWTApplied = invoiceAllocations.some(a => a.allocationType === "EWT");

                        const isFullySettled = appliedSession >= (inv.remainingBalance - 0.01);
                        const isPartiallySettled = appliedSession > 0 && !isFullySettled;

                        let rowStatus = ""; let badgeColor = ""; let rowBg = "bg-background"; let IconComponent = null;

                        if (isFullySettled) {
                            if (appliedAdj > 0) { rowStatus = "ADJUSTED"; badgeColor = "border-orange-200 text-orange-700 bg-orange-100"; rowBg = "bg-orange-50/30 dark:bg-orange-950/10"; IconComponent = <Wand2 size={8} className="mr-1"/>; }
                            else if (appliedCredits > 0) { rowStatus = "CREDITED"; badgeColor = "border-purple-200 text-purple-700 bg-purple-100"; rowBg = "bg-purple-50/30 dark:bg-purple-950/10"; IconComponent = <Percent size={8} className="mr-1"/>; }
                            else { rowStatus = "PAID"; badgeColor = "border-emerald-200 text-emerald-700 bg-emerald-100"; rowBg = "bg-emerald-50/30 dark:bg-emerald-950/10"; IconComponent = <CheckCircle2 size={8} className="mr-1"/>; }
                        } else if (isPartiallySettled) { rowStatus = "PARTIAL"; badgeColor = "border-blue-200 text-blue-700 bg-blue-100"; rowBg = "bg-blue-50/10 dark:bg-blue-950/5"; IconComponent = <Loader2 size={8} className="mr-1 animate-spin"/>; }

                        return (
                            // 🚀 THE FIX: Reduced padding `py-2` to make rows ultra-compact!
                            <TableRow key={`cart-row-${inv.id}`} className={`group hover:bg-muted/30 transition-all ${rowBg}`}>
                                <TableCell className="align-top py-2 px-4 min-w-[180px]">
                                    <div className="flex items-start gap-1.5">
                                        {!isPosted && ( <button onClick={() => removeFromCart(inv.id)} className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0"><X size={12} strokeWidth={3}/></button> )}
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`font-mono font-black text-xs truncate leading-none ${isFullySettled ? 'text-primary/70' : 'text-primary'}`}>{inv.invoiceNo}</span>
                                                {rowStatus && <Badge variant="outline" className={`text-[7px] px-1 py-0 h-3.5 leading-none shrink-0 uppercase tracking-widest ${badgeColor}`}>{IconComponent}{rowStatus}</Badge>}
                                            </div>
                                            <span className="text-[9px] font-bold text-muted-foreground leading-tight mt-1">{inv.customerName}</span>
                                        </div>
                                    </div>
                                </TableCell>

                                <TableCell className="align-top py-2">
                                    <div className="flex flex-col items-end gap-0.5">
                                        <div className="flex justify-between w-full max-w-[150px] text-[8px] font-bold text-muted-foreground uppercase leading-none"><span>Original:</span><span className="text-foreground">₱{(inv.originalAmount || 0).toLocaleString()}</span></div>
                                        {(inv.totalPayments || 0) > 0 && (<div className="flex justify-between w-full max-w-[150px] text-[8px] font-bold text-blue-600 leading-none mt-0.5"><span>Payments:</span><span>-₱{inv.totalPayments.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>)}
                                        {(inv.totalMemos || 0) > 0 && (<div className="flex justify-between w-full max-w-[150px] text-[8px] font-bold text-purple-600 leading-none mt-0.5"><span>Memos:</span><span>-₱{inv.totalMemos.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>)}
                                        {(inv.totalReturns || 0) > 0 && (<div className="flex justify-between w-full max-w-[150px] text-[8px] font-bold text-orange-600 leading-none mt-0.5"><span>Returns:</span><span>-₱{inv.totalReturns.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div>)}

                                        <div className="border-t border-border pt-1 mt-0.5 w-full max-w-[150px] flex justify-between items-center">
                                            <span className="text-[9px] font-black text-primary uppercase leading-none">Balance:</span>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <button className="font-mono font-black text-xs hover:underline decoration-double flex items-center gap-1 group leading-none">
                                                        ₱{inv.remainingBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                        <History size={10} className="text-muted-foreground group-hover:text-primary transition-colors"/>
                                                    </button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-72 p-0 shadow-2xl border-primary/20" align="end">
                                                    <div className="bg-primary p-2 text-white flex justify-between items-center"><h4 className="font-black text-[10px] uppercase tracking-widest flex items-center gap-1.5"><History size={12}/> Audit Trail</h4><Badge variant="outline" className="text-white border-white/50 text-[8px] h-4 py-0 leading-none">{inv.invoiceNo}</Badge></div>
                                                    <div className="p-2 space-y-1.5 max-h-[250px] overflow-y-auto scrollbar-thin" onWheelCapture={(e) => e.stopPropagation()}>
                                                        <div className="flex justify-between text-[8px] font-black uppercase text-muted-foreground border-b pb-1"><span>Date / Ref</span><span>Applied</span></div>
                                                        {inv.history && inv.history.length > 0 ? ( inv.history.map((h, i) => ( <div key={`hist-${inv.id}-${i}`} className="flex justify-between items-center py-1.5 border-b border-muted/30 last:border-0"><div className="flex flex-col"><span className="text-[9px] font-mono font-bold text-foreground leading-none">{h.date}</span><span className="text-[7px] font-black uppercase text-muted-foreground mt-0.5 leading-none">{h.type} • {h.reference}</span></div><span className="text-[10px] font-black text-emerald-600">₱{h.amount.toLocaleString()}</span></div>)) ) : ( <div className="py-6 text-center flex flex-col items-center gap-2 text-muted-foreground"><Info size={20} className="opacity-20"/><p className="text-[9px] font-bold uppercase italic">No Historical Records</p></div>)}
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </div>
                                </TableCell>

                                <TableCell className="text-right align-top py-2">
                                    <div className={`font-mono font-black text-xs leading-none ${appliedSession > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{appliedSession > 0 ? `₱${appliedSession.toLocaleString(undefined, {minimumFractionDigits: 2})}` : "—"}</div>
                                    <div className="mt-1 flex flex-col gap-0.5">
                                        {invoiceAllocations.map((alloc, idx) => (
                                            <div key={`alloc-${inv.id}-${alloc.sourceTempId}-${idx}`} className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest flex gap-1 justify-end leading-none">
                                                <span>{combinedSources.find(w => w.id === alloc.sourceTempId)?.type || 'ADJ'}:</span>
                                                <span className="text-foreground font-mono">₱{alloc.amountApplied.toLocaleString()}</span>
                                            </div>
                                        ))}
                                    </div>
                                </TableCell>

                                <TableCell className="text-right align-top py-2 pr-4">
                                    {!isPosted && (
                                        <div className="flex justify-end gap-1 items-center">
                                            <Button size="icon" variant="ghost" onClick={() => handleInvoiceDiscrepancy(inv)} title="Resolve Variance" className="h-6 w-6 text-orange-600 hover:text-orange-700 hover:bg-orange-100 shrink-0"><Wand2 size={10} strokeWidth={3}/></Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleAutoCalculateEWT(inv)}
                                                disabled={hasEWTApplied}
                                                title={hasEWTApplied ? "Only 1 EWT allowed" : "Auto-Generate 2307"}
                                                className={cn("h-6 w-6 shrink-0", hasEWTApplied ? "opacity-30 cursor-not-allowed" : "text-teal-600 hover:text-teal-700 hover:bg-teal-100")}
                                            >
                                                <FileText size={10} strokeWidth={3}/>
                                            </Button>
                                            <AllocatorPopover inv={inv} appliedSession={appliedSession} wallet={wallet} credits={credits} allocations={allocations} handleAllocate={handleAllocate} getUsedAmount={getUsedAmount} />
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>

                {sortedCartInvoices.length > 0 && (
                    <TableFooter className="bg-muted/90 backdrop-blur-md sticky bottom-0 z-20 outline outline-1 outline-border shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                        <TableRow>
                            <TableCell colSpan={2} className="text-right py-2"><span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mr-4">Cart Balance:</span><span className="font-mono font-black text-xs">₱{cartTotalBalance.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></TableCell>
                            <TableCell className="text-right py-2 border-l border-border/50"><div className="flex flex-col items-end"><span className="text-[8px] font-black uppercase tracking-widest text-emerald-600 mb-0.5 leading-none">Total Applied</span><span className="font-mono font-black text-emerald-600 text-xs leading-none">₱{cartTotalAppliedSession.toLocaleString(undefined, {minimumFractionDigits: 2})}</span></div></TableCell>
                            <TableCell></TableCell>
                        </TableRow>
                    </TableFooter>
                )}
            </Table>
        </div>
    );
}