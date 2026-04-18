"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ArrowRightLeft, FilterX, CheckCircle2,Loader2, Hourglass, Layers
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchProvider } from "../../providers/fetchProvider";
import { format, isWithinInterval, subDays, startOfDay, endOfDay, parseISO, isValid } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// 🚀 NEW: Strictly defined interface for the Settlement Queue
export interface SettlementQueueItem {
    id: number;
    docNo?: string;
    salesmanName?: string;
    operationName?: string;
    date?: string | number[];
    collectionDate?: string | number[];
    collection_date?: string | number[];
    pouchAmount?: number;
    discrepancy?: number;
    receivableAmount?: number;
    adjustments?: number;
}

export default function SettlementMasterList() {
    // 🚀 FIX: Replaced any[] with SettlementQueueItem[]
    const [collections, setCollections] = useState<SettlementQueueItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");
    const [salesmanFilter, setSalesmanFilter] = useState("all");

    const [dateRangeMode, setDateRangeMode] = useState("all");
    const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
    const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"));

    // 🚀 NEW: Operation Tab State
    const [activeOperationTab, setActiveOperationTab] = useState<string>("All");

    useEffect(() => {
        const fetchSettlementQueue = async () => {
            setIsLoading(true);
            try {
                // 🚀 FIX: Replaced any[] with SettlementQueueItem[]
                const data = await fetchProvider.get<SettlementQueueItem[]>("/api/fm/treasury/collections/settlement-queue");
                setCollections(data || []);
            } catch (error: unknown) { // 🚀 FIX: Replaced 'any' with 'unknown'
                console.error("Fetch Error:", error instanceof Error ? error.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettlementQueue();
    }, []);

    // 🚀 FIX: Typed the parameter instead of using 'any'
    const parseAnyDate = (col: SettlementQueueItem): Date | null => {
        const val = col.date || col.collectionDate || col.collection_date;
        if (!val) return null;
        if (Array.isArray(val)) return new Date(val[0], val[1] - 1, val[2], val[3] || 0, val[4] || 0);
        const d = new Date(val as string | number); // Safe cast for the Date constructor
        return isValid(d) ? d : null;
    };

    // 🚀 NEW: Extract unique operations dynamically
    const uniqueOperations = useMemo(() => {
        const ops = new Set(collections.map(col => col.operationName || "Unassigned Operation"));
        return Array.from(ops).sort();
    }, [collections]);

    // 🚀 UPDATED: Added Operation Tab Filtering
    const filteredCollections = useMemo(() => {
        return collections.filter(col => {
            const docNo = (col.docNo || "").toLowerCase();
            const salesman = (col.salesmanName || "Unknown").toLowerCase();
            const opName = col.operationName || "Unassigned Operation";
            const term = searchTerm.toLowerCase();

            const matchesSearch = docNo.includes(term) || salesman.includes(term);
            const matchesSalesman = salesmanFilter === "all" || col.salesmanName === salesmanFilter;
            const matchesOperation = activeOperationTab === "All" || opName === activeOperationTab;

            if (!matchesSearch || !matchesSalesman || !matchesOperation) return false;

            if (dateRangeMode === "all") return true;

            const colDate = parseAnyDate(col);
            if (!colDate) return true;

            let start: Date;
            let end: Date = endOfDay(new Date());
            if (dateRangeMode === "custom") {
                start = startOfDay(parseISO(customStart));
                end = endOfDay(parseISO(customEnd));
            } else {
                start = startOfDay(subDays(new Date(), parseInt(dateRangeMode)));
                if (dateRangeMode === "0") start = startOfDay(new Date());
            }
            return isWithinInterval(colDate, { start, end });
        });
    }, [collections, searchTerm, salesmanFilter, dateRangeMode, customStart, customEnd, activeOperationTab]);

    const handleOpenSettlement = (id: number) => {
        const w = window.screen.availWidth;
        const h = window.screen.availHeight;
        window.open(`/fm/treasury/collection-posting/settlement/${id}`, `S_${id}`,
            `width=${w},height=${h},left=0,top=0,resizable=yes,scrollbars=yes`);
    };

    return (
        <div className="h-[calc(100vh-80px)] flex flex-col bg-muted/10 p-6 space-y-4">

            {/* Header */}
            <div className="bg-card border border-border p-6 rounded-xl flex justify-between items-center shadow-sm shrink-0">
                <div className="flex items-center gap-4">
                    <div className="bg-primary/10 p-3 rounded-lg text-primary">
                        <ArrowRightLeft size={24}/>
                    </div>
                    <div>
                        <h1 className="text-2xl font-black italic tracking-tight">VOS SETTLEMENT QUEUE</h1>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">AR Allocation & Reconciliation</p>
                    </div>
                </div>
                <Badge className="font-mono text-xs px-4 py-1" variant="secondary">
                    {filteredCollections.length} POUCHES
                </Badge>
            </div>

            {/* Filters */}
            <div className="bg-card border border-border p-5 rounded-xl shadow-sm flex flex-wrap gap-6 items-end shrink-0">
                <div className="flex-1 min-w-[250px] space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground">Search</label>
                    <Input placeholder="Doc No or Salesman..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 bg-background font-bold shadow-inner" />
                </div>

                <div className="w-[200px] space-y-2">
                    <label className="text-[10px] font-black uppercase text-muted-foreground">Timeline</label>
                    <Select value={dateRangeMode} onValueChange={setDateRangeMode}>
                        <SelectTrigger className="h-10 bg-background font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="0">Today</SelectItem>
                            <SelectItem value="7">Last 7 Days</SelectItem>
                            <SelectItem value="custom">Custom Range</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {dateRangeMode === "custom" && (
                    <div className="flex gap-2 animate-in slide-in-from-right-2">
                        <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-10 w-[140px]" />
                        <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-10 w-[140px]" />
                    </div>
                )}

                <Button variant="outline" size="icon" onClick={() => {
                    setSearchTerm("");
                    setSalesmanFilter("all");
                    setDateRangeMode("all");
                    setActiveOperationTab("All"); // Reset tab too
                }} className="h-10 w-10">
                    <FilterX size={18}/>
                </Button>
            </div>

            {collections.length > 0 && (
                <div className="flex items-center gap-3 overflow-x-auto py-1 scrollbar-thin shrink-0">
                    <div className="flex items-center gap-2 text-muted-foreground pr-2 border-r border-border shrink-0">
                        <Layers size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Filter by Operation:</span>
                    </div>

                    <Button
                        variant={activeOperationTab === "All" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveOperationTab("All")}
                        className={`rounded-full h-8 text-xs font-bold tracking-wide shrink-0 transition-all shadow-sm ${
                            activeOperationTab !== "All" ? 'bg-background hover:bg-muted text-muted-foreground' : ''
                        }`}
                    >
                        All Operations ({collections.length})
                    </Button>

                    {uniqueOperations.map(operation => {
                        const count = collections.filter(col => (col.operationName || "Unassigned Operation") === operation).length;
                        return (
                            <Button
                                key={operation}
                                variant={activeOperationTab === operation ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActiveOperationTab(operation)}
                                className={`rounded-full h-8 text-xs font-bold tracking-wide shrink-0 transition-all shadow-sm ${
                                    activeOperationTab !== operation ? 'bg-background hover:bg-muted text-muted-foreground' : ''
                                }`}
                            >
                                {operation} ({count})
                            </Button>
                        );
                    })}
                </div>
            )}

            {/* Main Table */}
            <div className="flex-1 bg-card rounded-xl border border-border shadow-xl overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                    <Table>
                        <TableHeader className="bg-muted/50 sticky top-0 z-10 border-b">
                            <TableRow>
                                <TableHead className="font-black text-[10px] uppercase pl-6">Doc No</TableHead>
                                <TableHead className="font-black text-[10px] uppercase">Route Owner</TableHead>
                                <TableHead className="font-black text-[10px] uppercase text-center">Settlement Status</TableHead>
                                <TableHead className="text-right font-black text-[10px] uppercase">Pouch Value</TableHead>
                                <TableHead className="text-right font-black text-[10px] uppercase pr-10">Remaining Float</TableHead>
                                <TableHead className="w-[120px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={6} className="h-40 text-center"><Loader2 className="animate-spin mx-auto text-primary" size={32} /></TableCell></TableRow>
                            ) : filteredCollections.length === 0 ? (
                                <TableRow><TableCell colSpan={6} className="h-40 text-center font-bold text-muted-foreground uppercase tracking-widest text-xs">No Pouches Found</TableCell></TableRow>
                            ) : filteredCollections.map((col) => {
                                const pouchTotal = col.pouchAmount || 0;
                                const remaining = Math.abs(col.discrepancy || 0);
                                const isBalanced = remaining <= 0.01;
                                const isStarted = (col.receivableAmount || 0) > 0 || (col.adjustments || 0) > 0;

                                let statusLabel = "Pending";
                                let statusColor = "bg-slate-100 text-slate-600 border-slate-200";
                                let rowBg = "hover:bg-primary/5";
                                let icon = <Hourglass size={12} className="mr-1.5"/>;

                                if (isBalanced) {
                                    statusLabel = "Balanced";
                                    statusColor = "bg-emerald-100 text-emerald-700 border-emerald-200";
                                    rowBg = "bg-emerald-50/30 hover:bg-emerald-50/50";
                                    icon = <CheckCircle2 size={12} className="mr-1.5 text-emerald-600"/>;
                                } else if (isStarted) {
                                    statusLabel = "In Progress";
                                    statusColor = "bg-orange-100 text-orange-700 border-orange-200";
                                    rowBg = "bg-orange-50/30 hover:bg-orange-50/50";
                                    icon = <Loader2 size={12} className="mr-1.5 animate-spin text-orange-600"/>;
                                }

                                return (
                                    <TableRow key={col.id} className={`transition-all group border-b border-border/50 ${rowBg}`}>
                                        <TableCell className="font-mono font-black text-primary pl-6">{col.docNo}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-black text-sm">{col.salesmanName}</span>
                                                <span className="text-[10px] text-muted-foreground font-medium">
                                                    {parseAnyDate(col) ? format(parseAnyDate(col)!, "MMMM dd, yyyy") : "N/A"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={`font-black uppercase text-[9px] px-2.5 py-0.5 tracking-tighter shadow-sm ${statusColor}`}>
                                                {icon} {statusLabel}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-black text-sm">
                                            ₱{pouchTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </TableCell>
                                        <TableCell className={`text-right font-black text-sm pr-10 ${isBalanced ? 'text-emerald-600' : 'text-orange-600'}`}>
                                            ₱{remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                        </TableCell>
                                        <TableCell className="pr-6">
                                            <Button
                                                size="sm"
                                                className={`h-8 w-full font-black uppercase text-[10px] shadow-sm transition-transform active:scale-95 ${isBalanced ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-primary'}`}
                                                onClick={() => handleOpenSettlement(col.id)}
                                            >
                                                {isBalanced ? "Review" : "Allocate"}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </div>
    );
}