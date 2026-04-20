"use client";

import React, { useState } from "react";
import {
    Plus,
    Calculator,
    Receipt,
    ShieldCheck,
    Check as CheckIcon,
    ChevronsUpDown,
    Landmark,
    Wallet,
    AlertCircle,
    Trash2,
    Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { CashieringState } from "../../types";

export default function CashieringSheet({ state }: { state: CashieringState }) {
    const {
        isSheetOpen, setIsSheetOpen,
        salesmen, salesmanId, setSalesmanId,
        banks, coas,
        collectionDate, setCollectionDate,
        remarks, setRemarks,
        denominations, handleDenomChange,
        denominationMaster,
        checks, addCheck, updateCheck, removeCheck,
        totalCash, totalChecks, grandTotal, handleSubmit,
        isSheetLoading, isSubmitting,
        editingId,
        masterList
    } = state;

    const [openSalesman, setOpenSalesman] = useState(false);
    const [openBankIdx, setOpenBankIdx] = useState<number | null>(null);
    const [openCoaIdx, setOpenCoaIdx] = useState<number | null>(null);

    const currentPouch = editingId ? masterList.find(m => m.id === editingId) : null;
    const displayDocNo = currentPouch ? currentPouch.docNo : "AUTO-GENERATED";

    const isFormValid = salesmanId !== "" && grandTotal > 0;

    return (
        <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
            <SheetContent
                className="sm:max-w-[1000px] w-full p-0 flex flex-col gap-0 border-l border-border bg-background">

                {/* --- HEADER --- */}
                <SheetHeader
                    className="p-6 bg-card border-b border-border shrink-0 flex flex-row justify-between items-center z-10 shadow-sm">
                    <div className="space-y-1.5">
                        <SheetTitle
                            className="text-2xl font-black tracking-tight flex items-center gap-2 text-foreground">
                            <ShieldCheck className="text-primary h-6 w-6" /> {editingId ? "Edit Pouch" : "Receive Pouch"}
                        </SheetTitle>
                        <SheetDescription
                            className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                            {editingId ? `Updating record for ${displayDocNo}` : "Count physical assets and encode the pouch"}
                        </SheetDescription>
                    </div>
                    <div className="text-right bg-muted/50 p-3 rounded-lg border border-border">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1">Total Pouch Value</p>
                        <p className="text-2xl font-black text-emerald-600 dark:text-emerald-500 leading-none tracking-tighter">
                            ₱{grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                </SheetHeader>

                {/* --- BODY --- */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-muted/10 custom-scrollbar">
                    {isSheetLoading ? (
                        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground space-y-3">
                            <Loader2 className="animate-spin h-8 w-8 text-primary" />
                            <span className="text-sm font-bold uppercase tracking-widest">Hydrating data...</span>
                        </div>
                    ) : (
                        <>
                            {/* 1. Header Information Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-card rounded-xl border border-border shadow-sm">
                                <div className="space-y-2 md:col-span-1">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                        Route Owner <span className="text-destructive">*</span>
                                    </label>
                                    <Popover open={openSalesman} onOpenChange={setOpenSalesman}>
                                        <PopoverTrigger asChild>
                                            <Button variant="outline" role="combobox"
                                                    className={cn("w-full h-10 justify-between text-xs font-bold bg-background", !salesmanId && "text-muted-foreground border-dashed border-primary/50")}>
                                                <span className="truncate">
                                                    {salesmanId ? salesmen.find((s) => s.id.toString() === salesmanId)?.salesmanName : "Select Owner..."}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Type code or name..." className="text-xs" />
                                                <CommandList>
                                                    <CommandEmpty>No salesman found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {salesmen.map((s) => (
                                                            <CommandItem key={s.id}
                                                                         value={`${s.salesmanCode} ${s.salesmanName}`}
                                                                         onSelect={() => {
                                                                             setSalesmanId(s.id.toString());
                                                                             setOpenSalesman(false);
                                                                         }} className="text-xs cursor-pointer">
                                                                <CheckIcon
                                                                    className={cn("mr-2 h-4 w-4 text-primary", salesmanId === s.id.toString() ? "opacity-100" : "opacity-0")} />
                                                                <span className="font-mono font-bold text-muted-foreground mr-2">[{s.salesmanCode}]</span>
                                                                {s.salesmanName}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2 md:col-span-1">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Collection Date</label>
                                    <Input type="date" className="h-10 text-xs font-bold bg-background"
                                           value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
                                </div>

                                <div className="space-y-2 md:col-span-1">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest flex justify-between">
                                        Doc No {editingId && <span className="text-primary">PREFILLED</span>}
                                    </label>
                                    <Input
                                        type="text"
                                        className={cn("h-10 text-xs font-black font-mono disabled:opacity-100", editingId ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground")}
                                        value={displayDocNo}
                                        disabled
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-1">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Remarks</label>
                                    <Input type="text"
                                           className="h-10 text-xs bg-background placeholder:text-muted-foreground/50"
                                           placeholder="Optional notes..." value={remarks}
                                           onChange={(e) => setRemarks(e.target.value)} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                                {/* 2. Cash Counter */}
                                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col lg:col-span-5">
                                    <div className="bg-emerald-500/10 p-4 border-b border-emerald-500/20 flex justify-between items-center">
                                        <span className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                                            <Calculator size={16} /> Cash Denominations
                                        </span>
                                        <span className="text-sm font-black tracking-tight text-foreground">
                                            ₱{totalCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    <div className="p-4 space-y-2">
                                        {denominationMaster.sort((a, b) => b.amount - a.amount).map((denom) => (
                                            <div key={denom.id}
                                                 className="grid grid-cols-[2fr_auto_3fr_4fr] items-center gap-2 group hover:bg-muted/30 p-1.5 rounded-md transition-colors">
                                                <span className="text-right font-bold text-xs text-muted-foreground whitespace-nowrap">
                                                    {denom.amount >= 1 ? `₱${denom.amount}` : `${denom.amount * 100}¢`}
                                                </span>
                                                <span className="text-muted-foreground/30 text-[10px] font-black px-1">X</span>
                                                <Input
                                                    type="number"
                                                    className="h-9 text-center text-xs font-bold bg-background shadow-inner w-full"
                                                    value={denominations[denom.id] || ""}
                                                    onChange={(e) => handleDenomChange(denom.id, e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    placeholder="0"
                                                    min="0"
                                                />
                                                <span className="text-right font-black text-sm text-foreground tracking-tight truncate">
                                                    ₱{(denom.amount * (denominations[denom.id] || 0)).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* 3. Non-Cash Ledger */}
                                <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col lg:col-span-7">
                                    <div className="bg-blue-500/10 p-4 border-b border-blue-500/20 flex justify-between items-center">
                                        <span className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                            <Wallet size={16} /> Non-Cash Assets
                                        </span>
                                        <span className="text-sm font-black tracking-tight text-foreground">
                                            ₱{totalChecks.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>

                                    <div className="p-4 flex flex-col gap-4">
                                        {checks.length === 0 && (
                                            <div className="py-10 flex flex-col items-center justify-center text-center border-2 border-dashed border-border rounded-xl bg-muted/20">
                                                <Receipt className="w-10 h-10 text-muted-foreground/30 mb-3" />
                                                <p className="text-sm font-bold text-muted-foreground">No checks or transfers added.</p>
                                                <p className="text-xs text-muted-foreground/70 mb-4">Add non-cash payments like GCash or Checks here.</p>
                                            </div>
                                        )}

                                        {checks.map((check, i) => (
                                            <div key={check.tempId} className="bg-background p-4 rounded-xl border border-border shadow-sm space-y-4 relative group hover:border-blue-500/30 transition-all animate-in fade-in slide-in-from-bottom-2 duration-300">

                                                {/* Delete Button - Wrapped to prevent overlap! */}
                                                <div className="absolute top-3 right-3 z-10 bg-background rounded-full">
                                                    <Button variant="ghost" size="icon" onClick={() => removeCheck(i)}
                                                            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive">
                                                        <Trash2 size={15} />
                                                    </Button>
                                                </div>

                                                {/* 🚀 FIX: min-w-0 prevents truncation failure, pr-10 clears the trash button! */}
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-10">
                                                    <div className="space-y-1.5 min-w-0">
                                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                                                            Asset Type <span className="text-destructive">*</span>
                                                        </label>
                                                        <Popover open={openCoaIdx === i} onOpenChange={(open) => setOpenCoaIdx(open ? i : null)}>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline"
                                                                        className={cn("w-full h-9 text-[11px] justify-between px-3 font-bold", !check.coaId && "border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-900/10")}>
                                                                    <div className="flex items-center gap-2 truncate pr-2">
                                                                        <Landmark size={14} className={check.coaId ? "text-blue-500 shrink-0" : "text-amber-500 shrink-0"} />
                                                                        <span className="truncate">
                                                                            {check.coaId ? coas.find(c => c.coaId?.toString() === check.coaId || c.id?.toString() === check.coaId)?.accountTitle : "Select Type"}
                                                                        </span>
                                                                    </div>
                                                                    <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50 shrink-0" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[300px] p-0" align="start">
                                                                <Command>
                                                                    <CommandInput placeholder="Find payment method..." className="h-9 text-xs" />
                                                                    <CommandList>
                                                                        <CommandEmpty>No accounts found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {coas.map((c) => {
                                                                                const validId = c.coaId || c.id;
                                                                                return (
                                                                                    <CommandItem
                                                                                        key={validId || c.accountTitle}
                                                                                        onSelect={() => {
                                                                                            updateCheck(i, "coaId", validId?.toString() || "");
                                                                                            setOpenCoaIdx(null);
                                                                                        }}
                                                                                        className="text-xs cursor-pointer py-2">
                                                                                        {c.accountTitle}
                                                                                    </CommandItem>
                                                                                );
                                                                            })}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>

                                                    <div className="space-y-1.5 min-w-0">
                                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Target Bank</label>
                                                        <Popover open={openBankIdx === i} onOpenChange={(open) => setOpenBankIdx(open ? i : null)}>
                                                            <PopoverTrigger asChild>
                                                                <Button variant="outline" className="w-full h-9 text-[11px] font-bold justify-between px-3 text-muted-foreground">
                                                                    <span className="truncate pr-2">
                                                                        {check.bankId ? banks.find(b => b.id.toString() === check.bankId)?.bankName : "Optional"}
                                                                    </span>
                                                                    <ChevronsUpDown className="ml-1 h-3 w-3 opacity-50 shrink-0" />
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-[250px] p-0" align="start">
                                                                <Command>
                                                                    <CommandInput placeholder="Find bank..." className="h-9 text-xs" />
                                                                    <CommandList>
                                                                        <CommandEmpty>No bank found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {banks.map((bank) => (
                                                                                <CommandItem key={bank.id}
                                                                                             onSelect={() => {
                                                                                                 updateCheck(i, "bankId", bank.id.toString());
                                                                                                 setOpenBankIdx(null);
                                                                                             }}
                                                                                             className="text-xs cursor-pointer py-2">
                                                                                    {bank.bankName}
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </div>

                                                {/* Bottom Row: Ref, Date, Amount */}
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-border/60 pt-4">
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Ref / Check No</label>
                                                        <Input className="h-9 text-xs font-bold placeholder:font-normal"
                                                               placeholder="00001234" value={check.checkNo}
                                                               onChange={(e) => updateCheck(i, "checkNo", e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Date on Check</label>
                                                        <Input type="date"
                                                               className="h-9 text-[11px] font-bold text-muted-foreground uppercase"
                                                               value={check.chequeDate}
                                                               onChange={(e) => updateCheck(i, "chequeDate", e.target.value)} />
                                                    </div>
                                                    <div className="space-y-1.5">
                                                        <label className="text-[10px] font-black text-primary uppercase tracking-widest block">Amount</label>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-2.5 text-[10px] font-black text-muted-foreground">₱</span>
                                                            <Input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                className="h-9 pl-6 text-sm font-black text-right text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/60"
                                                                placeholder="0.00"
                                                                value={check.amount}
                                                                onChange={(e) => updateCheck(i, "amount", e.target.value)}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}

                                        <Button variant="outline" size="sm" onClick={addCheck}
                                                className="w-full text-xs font-black uppercase tracking-widest h-10 border-dashed border-primary/40 text-primary hover:bg-primary/10 mt-2">
                                            <Plus size={16} className="mr-2" /> Add Non-Cash Asset
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* --- FOOTER --- */}
                <SheetFooter
                    className="p-4 sm:p-5 bg-card border-t border-border shrink-0 flex flex-col sm:flex-row justify-between items-center gap-4 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <div className="flex items-center w-full sm:w-auto">
                        {!isFormValid && !isSheetLoading && (
                            <span className="flex items-center justify-center w-full sm:w-auto gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 rounded-md">
                                <AlertCircle size={14} /> Owner and &gt; ₱0.00 required
                            </span>
                        )}
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                        <Button variant="ghost" onClick={() => setIsSheetOpen(false)}
                                className="flex-1 sm:flex-none text-xs font-bold uppercase tracking-wider h-10">Cancel</Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || !isFormValid}
                            className="flex-1 sm:flex-none px-8 text-xs font-black uppercase tracking-widest shadow-md transition-all active:scale-95 h-10"
                        >
                            {isSubmitting ? (
                                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...</>
                            ) : (
                                editingId ? "Update Pouch" : "Secure Pouch"
                            )}
                        </Button>
                    </div>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}