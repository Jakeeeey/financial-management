"use client";

import React, { useEffect, useState, useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    FilterX, CheckCircle2, Loader2, Hourglass, Layers, Search, Calendar, Activity,
    ChevronRight, LayoutDashboard, CircleDashed, ArrowUp, ArrowDown, ArrowUpDown
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchProvider } from "../../providers/fetchProvider";
import { format, isWithinInterval, subDays, startOfDay, endOfDay, parseISO, isValid } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// 🚀 IMPORT the Command Center component
import SettlementCommandCenter from "./SettlementCommandCenter";

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

// Helper to determine status purely from data
const getCollectionStatus = (col: SettlementQueueItem) => {
    const remaining = Math.abs(col.discrepancy || 0);
    const isBalanced = remaining <= 0.01;
    const isStarted = (col.receivableAmount || 0) > 0 || (col.adjustments || 0) > 0;

    if (isBalanced) return "Balanced";
    if (isStarted) return "In Progress";
    return "Pending";
};

export default function SettlementMasterList() {
    const [collections, setCollections] = useState<SettlementQueueItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const [sortField, setSortField] = useState<keyof SettlementQueueItem | null>("date");
    const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

    const [dateRangeMode, setDateRangeMode] = useState("all");
    const [customStart, setCustomStart] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
    const [customEnd, setCustomEnd] = useState(format(new Date(), "yyyy-MM-dd"));

    const [activeOperationTab, setActiveOperationTab] = useState<string>("All");

    const [isCommandCenterOpen, setIsCommandCenterOpen] = useState(false);
    const [selectedPouchId, setSelectedPouchId] = useState<number | null>(null);

    useEffect(() => {
        const fetchSettlementQueue = async () => {
            setIsLoading(true);
            try {
                const data = await fetchProvider.get<SettlementQueueItem[]>("/api/fm/treasury/collections/settlement-queue");
                setCollections(data || []);
            } catch (error: unknown) {
                console.error("Fetch Error:", error instanceof Error ? error.message : "Unknown error");
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettlementQueue();
    }, [isCommandCenterOpen]);

    const parseAnyDate = (col: SettlementQueueItem): Date | null => {
        const val = col.date || col.collectionDate || col.collection_date;
        if (!val) return null;
        if (Array.isArray(val)) return new Date(val[0], val[1] - 1, val[2], val[3] || 0, val[4] || 0);
        const d = new Date(val as string | number);
        return isValid(d) ? d : null;
    };


    const handleSort = (field: keyof SettlementQueueItem) => {
        if (sortField === field) {
            setSortDirection(sortDirection === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDirection("asc");
        }
    };

    const uniqueOperations = useMemo(() => {
        const ops = new Set(collections.map(col => col.operationName || "Unassigned Operation"));
        return Array.from(ops).sort();
    }, [collections]);

    const filteredCollections = useMemo(() => {
        return collections.filter(col => {
            const docNo = (col.docNo || "").toLowerCase();
            const salesman = (col.salesmanName || "Unknown").toLowerCase();
            const opName = col.operationName || "Unassigned Operation";
            const term = searchTerm.toLowerCase();

            // 1. Text Search
            const matchesSearch = docNo.includes(term) || salesman.includes(term);

            // 2. Operation Filter
            const matchesOperation = activeOperationTab === "All" || opName === activeOperationTab;

            // 3. Status Filter
            const status = getCollectionStatus(col);
            const matchesStatus = statusFilter === "all" || status === statusFilter;

            if (!matchesSearch || !matchesOperation || !matchesStatus) return false;

            // 4. Date Filter
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
    }, [collections, searchTerm, statusFilter, dateRangeMode, customStart, customEnd, activeOperationTab]);

    const sortedCollections = useMemo(() => {
        if (!sortField) return filteredCollections;

        return [...filteredCollections].sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            // Special handling for date fields
            if (sortField === "date" || sortField === "collectionDate" || sortField === "collection_date") {
                const aDate = parseAnyDate(a);
                const bDate = parseAnyDate(b);
                if (!aDate && !bDate) return 0;
                if (!aDate) return 1;
                if (!bDate) return -1;
                const modifier = sortDirection === "asc" ? 1 : -1;
                return (aDate.getTime() - bDate.getTime()) * modifier;
            }

            // Special handling for numeric fields
            if (typeof aVal === "number" && typeof bVal === "number") {
                const modifier = sortDirection === "asc" ? 1 : -1;
                return (aVal - bVal) * modifier;
            }

            // String comparison
            const modifier = sortDirection === "asc" ? 1 : -1;
            const aStr = String(aVal).toLowerCase();
            const bStr = String(bVal).toLowerCase();
            return aStr > bStr ? modifier : -modifier;
        });
    }, [filteredCollections, sortField, sortDirection]);

    const stats = useMemo(() => {
        return sortedCollections.reduce((acc, col) => {
            acc.totalFloat += col.pouchAmount || 0;
            acc.unsettledFloat += Math.abs(col.discrepancy || 0);
            return acc;
        }, { totalFloat: 0, unsettledFloat: 0 });
    }, [sortedCollections]);

    const handleOpenSettlement = (id: number) => {
        setSelectedPouchId(id);
        setIsCommandCenterOpen(true);
    };

    return (
        <div className="h-[calc(100vh-80px)] flex flex-col bg-muted/10 p-6 space-y-5 overflow-hidden">

            <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-end shrink-0">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-foreground flex items-center gap-2">
                        <LayoutDashboard className="text-primary" /> Pouch Settlement Queue
                    </h1>
                    <p className="text-sm text-muted-foreground font-medium mt-1">
                        Manage and allocate physical collections to accounts receivable.
                    </p>
                </div>

                <div className="flex gap-4 bg-card border border-border p-3 rounded-xl shadow-sm">
                    <div className="flex flex-col px-4 border-r border-border/50">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Pouches</span>
                        <span className="text-lg font-mono font-black text-foreground">{sortedCollections.length}</span>
                    </div>
                    <div className="flex flex-col px-4 border-r border-border/50">
                        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Total Pouch Value</span>
                        <span className="text-lg font-mono font-black text-primary">₱{stats.totalFloat.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                    <div className="flex flex-col pl-4 pr-2">
                        <span className="text-[10px] font-black uppercase text-orange-600 tracking-widest">Unsettled Float</span>
                        <span className="text-lg font-mono font-black text-orange-600">₱{stats.unsettledFloat.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border p-4 rounded-xl shadow-sm flex flex-wrap gap-4 items-center shrink-0 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                    <Input
                        placeholder="Search Doc No or Salesman..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-10 pl-9 bg-background font-bold shadow-inner border-muted-foreground/20"
                    />
                </div>

                <div className="w-[180px] relative">
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-10 bg-background font-bold border-muted-foreground/20">
                            <Activity size={14} className="mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="Pending">Pending</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Balanced">Balanced</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-[180px] relative">
                    <Select value={dateRangeMode} onValueChange={setDateRangeMode}>
                        <SelectTrigger className="h-10 bg-background font-bold border-muted-foreground/20">
                            <Calendar size={14} className="mr-2 text-muted-foreground" />
                            <SelectValue placeholder="Timeline" />
                        </SelectTrigger>
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
                        <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="h-10 w-[140px] font-mono text-xs" />
                        <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="h-10 w-[140px] font-mono text-xs" />
                    </div>
                )}

                <Button variant="ghost" size="icon" onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setDateRangeMode("all");
                    setActiveOperationTab("All");
                }} className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Clear Filters">
                    <FilterX size={18}/>
                </Button>
            </div>

            {collections.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none shrink-0 mask-edges">
                    <div className="flex items-center gap-1.5 text-muted-foreground pr-3 border-r border-border shrink-0">
                        <Layers size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Operations:</span>
                    </div>

                    <button
                        onClick={() => setActiveOperationTab("All")}
                        className={`px-4 py-1.5 rounded-full text-[11px] font-black tracking-wider transition-all border ${
                            activeOperationTab === "All"
                                ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                                : 'bg-background hover:bg-muted text-muted-foreground border-border hover:border-foreground/20'
                        }`}
                    >
                        All ({collections.length})
                    </button>

                    {uniqueOperations.map(operation => {
                        const count = collections.filter(col => (col.operationName || "Unassigned Operation") === operation).length;
                        return (
                            <button
                                key={operation}
                                onClick={() => setActiveOperationTab(operation)}
                                className={`px-4 py-1.5 rounded-full text-[11px] font-black tracking-wider transition-all border whitespace-nowrap ${
                                    activeOperationTab === operation
                                        ? 'bg-primary text-primary-foreground border-primary shadow-md scale-105'
                                        : 'bg-background hover:bg-muted text-muted-foreground border-border hover:border-foreground/20'
                                }`}
                            >
                                {operation} ({count})
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 🚀 Main Data Table */}
            <div className="flex-1 bg-card rounded-xl border border-border shadow-xl overflow-hidden flex flex-col min-h-0">
                {/* 🚀 FIX: Shattering the hidden boundary to allow the table header to stick! */}
                <div className="flex-1 overflow-y-auto scrollbar-thin relative [&_div.relative.w-full.overflow-auto]:!overflow-visible">
                    <Table className="relative min-w-[800px]">
                        <TableHeader className="bg-muted/90 backdrop-blur-md sticky top-0 z-20 shadow-sm outline outline-1 outline-border">
                            <TableRow>
                                <TableHead className="font-black text-[10px] uppercase pl-6 py-4 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort("docNo")}>
                                    <div className="flex items-center gap-1">
                                        <span>Doc No</span>
                                        {sortField === "docNo" ? (
                                            sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                                        ) : (
                                            <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                                        )}
                                    </div>
                                </TableHead>
                                <TableHead className="font-black text-[10px] uppercase cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort("salesmanName")}>
                                    <div className="flex items-center gap-1">
                                        <span>Route Owner</span>
                                        {sortField === "salesmanName" ? (
                                            sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                                        ) : (
                                            <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                                        )}
                                    </div>
                                </TableHead>
                                <TableHead className="font-black text-[10px] uppercase cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort("discrepancy")}>
                                    <div className="flex items-center gap-1">
                                        <span>Settlement Status</span>
                                        {sortField === "discrepancy" ? (
                                            sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                                        ) : (
                                            <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                                        )}
                                    </div>
                                </TableHead>
                                <TableHead className="text-right font-black text-[10px] uppercase cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort("pouchAmount")}>
                                    <div className="flex items-center gap-1 justify-end">
                                        <span>Pouch Value</span>
                                        {sortField === "pouchAmount" ? (
                                            sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                                        ) : (
                                            <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                                        )}
                                    </div>
                                </TableHead>
                                <TableHead className="text-right font-black text-[10px] uppercase pr-10 cursor-pointer hover:bg-muted/80 transition-colors" onClick={() => handleSort("discrepancy")}>
                                    <div className="flex items-center gap-1 justify-end">
                                        <span>Remaining Float</span>
                                        {sortField === "discrepancy" ? (
                                            sortDirection === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />
                                        ) : (
                                            <ArrowUpDown className="h-3 w-3 text-muted-foreground opacity-50" />
                                        )}
                                    </div>
                                </TableHead>
                                <TableHead className="w-[120px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-[40vh] text-center">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-3">
                                            <Loader2 className="animate-spin text-primary" size={32} />
                                            <p className="font-bold tracking-widest uppercase text-xs animate-pulse">Loading Settlements...</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : sortedCollections.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-[40vh] text-center">
                                        <div className="flex flex-col items-center justify-center text-muted-foreground gap-3 opacity-60">
                                            <CircleDashed size={48} strokeWidth={1.5} />
                                            <p className="font-bold tracking-widest uppercase text-sm text-foreground">No Pouches Found</p>
                                            <p className="text-xs">Try adjusting your filters or search term.</p>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : sortedCollections.map((col) => {
                                const pouchTotal = col.pouchAmount || 0;
                                const remaining = Math.abs(col.discrepancy || 0);
                                const status = getCollectionStatus(col);

                                let statusColor = "bg-slate-100 text-slate-600 border-slate-200";
                                let rowBg = "hover:bg-muted/50";
                                let icon = <Hourglass size={12} className="mr-1.5"/>;

                                if (status === "Balanced") {
                                    statusColor = "bg-emerald-100 text-emerald-700 border-emerald-300 shadow-[inset_0_1px_2px_rgba(0,0,0,0.05)]";
                                    rowBg = "bg-emerald-50/20 hover:bg-emerald-50/50 dark:bg-emerald-950/10 dark:hover:bg-emerald-950/20";
                                    icon = <CheckCircle2 size={12} className="mr-1.5 text-emerald-600" strokeWidth={3}/>;
                                } else if (status === "In Progress") {
                                    statusColor = "bg-orange-100 text-orange-700 border-orange-300";
                                    rowBg = "bg-orange-50/20 hover:bg-orange-50/50 dark:bg-orange-950/10 dark:hover:bg-orange-950/20";
                                    icon = <Loader2 size={12} className="mr-1.5 animate-spin text-orange-600" strokeWidth={3}/>;
                                }

                                return (
                                    <TableRow key={col.id} className={`transition-all group border-b border-border/40 ${rowBg} cursor-pointer`} onClick={() => handleOpenSettlement(col.id)}>
                                        <TableCell className="pl-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-1.5 h-8 rounded-full ${status === 'Balanced' ? 'bg-emerald-500' : (status === 'In Progress' ? 'bg-orange-500' : 'bg-slate-300')}`} />
                                                <span className="font-mono font-black text-primary text-sm">{col.docNo}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-black text-sm text-foreground">{col.salesmanName}</span>
                                                <span className="text-[10px] text-muted-foreground font-bold tracking-wide uppercase">
                                                    {parseAnyDate(col) ? format(parseAnyDate(col)!, "MMM dd, yyyy") : "No Date"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`font-black uppercase text-[10px] px-2.5 py-1 tracking-widest ${statusColor}`}>
                                                {icon} {status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className="font-mono font-bold text-muted-foreground text-xs">₱</span>
                                            <span className="font-mono font-black text-sm text-foreground">{pouchTotal.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </TableCell>
                                        <TableCell className="text-right pr-10">
                                            <span className={`font-mono font-bold text-xs ${status === 'Balanced' ? 'text-emerald-600/70' : 'text-orange-600/70'}`}>₱</span>
                                            <span className={`font-mono font-black text-sm ${status === 'Balanced' ? 'text-emerald-600' : 'text-orange-600'}`}>
                                                {remaining.toLocaleString(undefined, {minimumFractionDigits: 2})}
                                            </span>
                                        </TableCell>
                                        <TableCell className="pr-6">
                                            <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-200">
                                                <Button size="icon" variant="ghost" className={`h-8 w-8 rounded-full ${status === 'Balanced' ? 'text-emerald-600 hover:bg-emerald-100' : 'text-primary hover:bg-primary/10'}`}>
                                                    <ChevronRight size={16} strokeWidth={3}/>
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Dialog open={isCommandCenterOpen} onOpenChange={setIsCommandCenterOpen}>
                <DialogContent
                    className="!p-0 !rounded-xl !border !border-border !bg-background !flex !flex-col !shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] !overflow-hidden transition-all duration-300"
                    style={{
                        width: '95vw',
                        maxWidth: '1400px',
                        height: '92vh',
                        maxHeight: '900px'
                    }}
                    showCloseButton={false}>
                    <DialogTitle className="sr-only">Settlement Command Center</DialogTitle>
                    {selectedPouchId && (
                        <SettlementCommandCenter
                            id={selectedPouchId}
                            onClose={() => setIsCommandCenterOpen(false)}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}