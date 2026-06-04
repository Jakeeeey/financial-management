import React, { useState, useMemo } from "react";
import { format, parseISO } from "date-fns";
import { Wallet, CheckCircle2, Clock, Landmark, FileText, Scale, Banknote, CornerDownRight, ArrowRight, Search, ChevronUp, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PouchReportDto, SettledInvoiceDto } from "../hooks/useCollectionReport";

interface PouchDetailSheetProps {
    pouch: PouchReportDto | null;
    isOpen: boolean;
    onClose: () => void;
}

type SortKey = keyof SettledInvoiceDto;

export function PouchDetailSheet({ pouch, isOpen, onClose }: PouchDetailSheetProps) {
    // 🚀 MODAL STATES (Search & Sort)
    const [inlineSearch, setInlineSearch] = useState("");
    const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: "asc" | "desc" }>({
        key: "invoiceNo",
        direction: "asc" // Default Ascending Sort Sequence
    });

    const handleSort = (key: SortKey) => {
        setSortConfig((prev) => ({
            key,
            direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
        }));
    };

    // 🚀 REAL-TIME FILTERING & SORTING FOR INVOICES
    const processedInvoices = useMemo(() => {
        if (!pouch?.invoices) return [];

        const filtered = pouch.invoices.filter((inv) => {
            const term = inlineSearch.toLowerCase();
            return inv.invoiceNo.toLowerCase().includes(term) || inv.customerName.toLowerCase().includes(term);
        });

        filtered.sort((a, b) => {
            const valA = a[sortConfig.key];
            const valB = b[sortConfig.key];
            if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1;
            if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [pouch, inlineSearch, sortConfig]);

    const renderSortIcon = (key: SortKey) => {
        if (sortConfig.key !== key) return <ChevronUp size={12} className="opacity-20 ml-1 inline" />;
        return sortConfig.direction === "asc"
            ? <ChevronUp size={12} className="text-primary ml-1 inline" />
            : <ChevronDown size={12} className="text-primary ml-1 inline" />;
    };

    if (!pouch) return null;
    const netVariance = pouch.overage - pouch.shortage;

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-[750px] sm:w-[65vw] overflow-hidden flex flex-col bg-background/95 backdrop-blur-xl p-0 border-l border-border shadow-2xl">

                {/* HEADER */}
                <div className="relative border-b border-border/60 p-6 shrink-0 z-20 bg-card overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
                    <SheetHeader className="relative z-10">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1.5">
                                <SheetTitle className="text-3xl font-black text-foreground flex items-center gap-3 font-mono tracking-tight">
                                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><Wallet size={24} /></div>
                                    {pouch.docNo}
                                </SheetTitle>
                                <SheetDescription className="font-medium text-sm flex items-center gap-2 text-muted-foreground ml-14">
                                    Collection Date: <strong className="text-foreground">{pouch.date ? format(parseISO(pouch.date), "MMMM do, yyyy") : "N/A"}</strong>
                                </SheetDescription>
                            </div>
                            <div className="pt-2">
                                {pouch.isPosted ? (
                                    <Badge className="bg-emerald-500/15 text-emerald-700 px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest text-[10px] border-none"><CheckCircle2 size={14} className="mr-1.5"/> Posted</Badge>
                                ) : (
                                    <Badge className="bg-orange-500/15 text-orange-700 px-3 py-1.5 rounded-lg font-bold uppercase tracking-widest text-[10px] border-none"><Clock size={14} className="mr-1.5"/> Draft</Badge>
                                )}
                            </div>
                        </div>
                    </SheetHeader>
                </div>

                {/* TABS */}
                <div className="flex-1 overflow-hidden p-6 bg-slate-50/50 dark:bg-zinc-950/50">
                    <Tabs defaultValue="settled" className="h-full flex flex-col">
                        <TabsList className="grid w-full grid-cols-3 mb-6 shrink-0 bg-muted/60 p-1.5 rounded-xl border border-border/50 h-12 shadow-sm">
                            <TabsTrigger value="assets" className="rounded-lg text-xs font-bold tracking-wider uppercase transition-all data-[state=active]:bg-background"><Landmark size={14} className="mr-2"/> Assets</TabsTrigger>
                            <TabsTrigger value="settled" className="rounded-lg text-xs font-bold tracking-wider uppercase transition-all data-[state=active]:bg-background"><FileText size={14} className="mr-2"/> Settled</TabsTrigger>
                            <TabsTrigger value="variances" className="rounded-lg text-xs font-bold tracking-wider uppercase transition-all data-[state=active]:bg-background"><Scale size={14} className="mr-2"/> Variances</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto scrollbar-thin pr-2 pb-8">

                            {/* TAB 1: ASSETS */}
                            <TabsContent value="assets" className="space-y-5 m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <Card className="shadow-sm border-border/60 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-50/80 to-background dark:from-emerald-950/30">
                                    <div className="p-5 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-100 dark:bg-emerald-900 rounded-lg text-emerald-600 dark:text-emerald-400">
                                                <Banknote size={20}/>
                                            </div>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">Physical Cash</h3>
                                        </div>
                                        <span className="text-2xl font-mono text-emerald-700 dark:text-emerald-400 font-black tracking-tight">
                                            ₱{pouch.totalCash.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                </Card>

                                <Card className="shadow-sm border-border/60 rounded-2xl overflow-hidden bg-background">
                                    <div className="bg-blue-50/50 dark:bg-blue-950/20 py-3 px-5 border-b border-border/50 flex justify-between items-center">
                                        <div className="flex items-center gap-2.5">
                                            <Landmark size={16} className="text-blue-600"/>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-400">Deposits (Checks)</h3>
                                        </div>
                                        <span className="font-mono text-blue-700 dark:text-blue-400 font-black text-sm">
                                            Total: ₱{pouch.totalCheck.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </span>
                                    </div>
                                    <table className="text-xs w-full border-collapse">
                                        <thead className="bg-muted/30"><tr><th className="pl-5 text-left font-medium">Bank</th><th className="text-left font-medium">Check No.</th><th className="text-left font-medium">Customer</th><th className="text-right pr-5 font-medium">Amount</th></tr></thead>
                                        <tbody>
                                            {pouch.checks.length === 0 ? (
                                                <tr><td colSpan={4} className="text-center italic text-muted-foreground py-10">No checks recorded.</td></tr>
                                            ) : pouch.checks.map((chk, i) => (
                                                <tr key={i} className="hover:bg-muted/40 transition-colors border-b border-border/40">
                                                    <td className="font-bold pl-5">{chk.bankName}</td>
                                                    <td className="font-mono text-muted-foreground">{chk.checkNo}</td>
                                                    <td className="text-muted-foreground">{chk.customerName}</td>
                                                    <td className="text-right font-mono font-bold text-foreground pr-5">₱{chk.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Card>
                            </TabsContent>

                            {/* TAB 2: SETTLED (Hierarchical Ledger with Search & Sort) */}
                            <TabsContent value="settled" className="space-y-4 m-0 animate-in fade-in slide-in-from-bottom-2 duration-300 flex flex-col h-full">

                                {/* 🚀 INLINE SEARCH BAR */}
                                <div className="relative shrink-0">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        placeholder="Filter by Invoice Number or Customer Name..."
                                        value={inlineSearch}
                                        onChange={(e) => setInlineSearch(e.target.value)}
                                        className="pl-9 h-11 rounded-xl shadow-sm bg-background border-border/60 text-xs font-medium"
                                    />
                                </div>

                                <Card className="shadow-sm border-border/60 rounded-2xl overflow-hidden bg-background flex-1 flex flex-col">
                                    <div className="bg-primary/5 py-4 px-5 border-b border-primary/10 flex justify-between items-center shrink-0">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-1.5 bg-primary/20 rounded-md text-primary"><FileText size={16}/></div>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-primary">Accounts Settled Breakdown</h3>
                                        </div>
                                        <div className="text-right flex flex-col">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Net Receivable Generated</span>
                                            <span className="font-mono text-primary font-black text-xl tracking-tight leading-none mt-1">
                                                ₱{pouch.invoiceNetTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </span>
                                        </div>
                                    </div>

                                    {/* 🚀 SORTABLE TABLE WITH STICKY HEADER */}
                                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                                        <table className="text-xs w-full border-collapse">
                                            <thead className="bg-muted/90 backdrop-blur-md sticky top-0 z-10 shadow-sm border-b border-border/60">
                                                <tr>
                                                    <th className="pl-5 cursor-pointer hover:bg-muted/50 select-none font-bold uppercase tracking-wider text-[10px] text-left" onClick={() => handleSort("invoiceNo")}>
                                                        Invoice / Application Details {renderSortIcon("invoiceNo")}
                                                    </th>
                                                    <th className="text-right pr-5 cursor-pointer hover:bg-muted/50 select-none font-bold uppercase tracking-wider text-[10px]" onClick={() => handleSort("invoiceTotal")}>
                                                        Amount Applied {renderSortIcon("invoiceTotal")}
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {processedInvoices.length === 0 ? (
                                                    <tr><td colSpan={2} className="text-center italic text-muted-foreground py-10">No matching invoices found.</td></tr>
                                                ) : processedInvoices.map((inv, i) => {
                                                    const hasCreditMemo = inv.memoAmount > 0;

                                                    return (
                                                        <React.Fragment key={i}>
                                                            {/* Parent Invoice Row (Gross) */}
                                                            <tr className="bg-muted/10 hover:bg-muted/20 border-b border-border/40 transition-colors">
                                                                <td className="pt-4 pl-5">
                                                                    <div className="font-black text-foreground text-sm font-mono tracking-tight">{inv.invoiceNo}</div>
                                                                    <div className="text-[11px] text-muted-foreground font-medium mt-0.5">{inv.customerName}</div>
                                                                </td>
                                                                <td className="text-right font-mono font-bold text-muted-foreground align-top pt-4 pr-5">
                                                                    ₱{inv.invoiceTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                                </td>
                                                            </tr>

                                                            {/* Child Row: Memos */}
                                                            {inv.memoAmount !== 0 && (
                                                                <tr className="border-none hover:bg-transparent">
                                                                    <td className="pl-5 py-2">
                                                                        <div className={`flex items-center gap-2.5 text-[11px] font-semibold ml-4 pl-3 border-l-2 ${hasCreditMemo ? 'text-indigo-600 border-indigo-200' : 'text-orange-600 border-orange-200'}`}>
                                                                            <CornerDownRight size={14} className="opacity-60"/>
                                                                            {hasCreditMemo ? 'Credit Memo Applied' : 'Debit Memo Applied'}
                                                                        </div>
                                                                    </td>
                                                                    <td className={`text-right py-2 pr-5 font-mono font-medium text-[11px] ${hasCreditMemo ? 'text-indigo-600' : 'text-orange-600'}`}>
                                                                        {hasCreditMemo ? '- ' : '+ '}₱{Math.abs(inv.memoAmount).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                                    </td>
                                                                </tr>
                                                            )}

                                                            {/* Child Row: Returns */}
                                                            {inv.returnAmount > 0 && (
                                                                <tr className="border-none hover:bg-transparent">
                                                                    <td className="pl-5 py-2">
                                                                        <div className="flex items-center gap-2.5 text-pink-600 text-[11px] font-semibold ml-4 pl-3 border-l-2 border-pink-200">
                                                                            <CornerDownRight size={14} className="opacity-60"/> Sales Return Applied
                                                                        </div>
                                                                    </td>
                                                                    <td className="text-right py-2 pr-5 font-mono text-pink-600 font-medium text-[11px]">
                                                                        - ₱{inv.returnAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                                    </td>
                                                                </tr>
                                                            )}

                                                            {/* Child Row: Net Receivable */}
                                                            <tr className="border-b border-border/60">
                                                                <td className="pl-5 py-3">
                                                                    <div className="flex items-center gap-2.5 text-emerald-700 text-[11px] font-black ml-4 pl-3 border-l-2 border-emerald-300">
                                                                        <ArrowRight size={14} className="opacity-80"/> Net Receivable Generated
                                                                    </div>
                                                                </td>
                                                                <td className="text-right py-3 pr-5 font-mono font-black text-emerald-700 bg-emerald-50/30">
                                                                    ₱{inv.netAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                                </td>
                                                            </tr>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </Card>
                            </TabsContent>

                            {/* TAB 3: VARIANCES */}
                            <TabsContent value="variances" className="space-y-5 m-0 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <Card className="shadow-sm border-border/60 rounded-2xl overflow-hidden bg-background">
                                    <div className="bg-muted/40 py-4 px-5 border-b border-border/50 flex justify-between items-center">
                                        <div className="flex items-center gap-2.5">
                                            <Scale size={16} className="text-muted-foreground"/>
                                            <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Adjustments & Variances</h3>
                                        </div>
                                        <div className="text-right flex flex-col">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Net Impact</span>
                                            <span className={`font-mono font-black text-lg tracking-tight mt-0.5 ${netVariance < 0 ? 'text-red-600' : netVariance > 0 ? 'text-purple-600' : 'text-foreground'}`}>
                                                {netVariance < 0 ? '-' : netVariance > 0 ? '+' : ''}₱{Math.abs(netVariance).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </span>
                                        </div>
                                    </div>
                                    <table className="text-xs w-full border-collapse">
                                        <thead className="bg-muted/20"><tr><th className="pl-5 text-left font-medium">Type</th><th className="text-left font-medium">Account / Reason</th><th className="text-right pr-5 font-medium">Amount</th></tr></thead>
                                        <tbody>
                                            {pouch.variances.length === 0 ? (
                                                <tr><td colSpan={3} className="text-center italic text-muted-foreground py-10">No variances logged.</td></tr>
                                            ) : pouch.variances.map((v, i) => (
                                                <tr key={i} className="hover:bg-muted/40 transition-colors border-b border-border/40">
                                                    <td className="pl-5">
                                                        <Badge variant="secondary" className={`text-[10px] px-2.5 py-1 uppercase tracking-widest font-bold border-none ${v.type.includes('Shortage') ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'}`}>
                                                            {v.type}
                                                        </Badge>
                                                    </td>
                                                    <td>
                                                        <div className="font-bold text-foreground text-sm">{v.accountTitle}</div>
                                                        <div className="text-[11px] text-muted-foreground mt-0.5 max-w-[300px] leading-relaxed">{v.remarks}</div>
                                                    </td>
                                                    <td className="text-right font-mono font-black text-foreground pr-5">
                                                        ₱{v.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Card>
                            </TabsContent>

                        </div>
                    </Tabs>
                </div>
            </SheetContent>
        </Sheet>
    );
}