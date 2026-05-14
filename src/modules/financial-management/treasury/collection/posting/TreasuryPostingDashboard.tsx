"use client";

import React, { useState, useMemo } from "react";
import { Loader2, Layers, Search, Calendar as CalendarIcon, Check, ChevronsUpDown, FilterX } from "lucide-react";
import { usePosting } from "./hooks/usePosting";
import { Header } from "./components/Header";
import { QueueTable } from "./components/QueueTable";
import { ReviewSheet } from "./components/ReviewSheet";
import { PostingQueueItem } from "./hooks/usePosting";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface TreasuryPostingDashboardProps {
    currentUser: {
        name: string;
        email: string;
        avatar: string;
        id: string;
    };
}

export default function TreasuryPostingDashboard({}: TreasuryPostingDashboardProps) {
    const {
        queue, isLoading, isPosting, refreshQueue,
        selectedPouch, isLoadingDetails, isReviewSheetOpen, setIsReviewSheetOpen,
        openReviewSheet, handlePostPouch
    } = usePosting();

    const [activeOperationTab, setActiveOperationTab] = useState<string>("All");

    // 🚀 NEW FILTER STATES
    const [searchTerm, setSearchTerm] = useState("");
    const [salesman, setSalesman] = useState("all");
    const [salesmanOpen, setSalesmanOpen] = useState(false);
    const [cashier, setCashier] = useState("all");
    const [cashierOpen, setCashierOpen] = useState(false);
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    // 🚀 NEW SORTING STATES
    const [sortField, setSortField] = useState<keyof PostingQueueItem>("docNo");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

    const uniqueOperations = useMemo(() => {
        const ops = new Set(queue.map(item => item.operationName));
        return Array.from(ops).sort();
    }, [queue]);

    // Extract unique salesmen & cashiers for comboboxes
    const uniqueSalesmen = useMemo(() => Array.from(new Set(queue.map(q => q.salesmanName))).filter(Boolean).sort(), [queue]);
    const uniqueCashiers = useMemo(() => Array.from(new Set(queue.map(q => q.encoderName))).filter(Boolean).sort(), [queue]);

    // 🚀 THE MASTER FILTER & SORT ENGINE
    const processedQueue = useMemo(() => {
        let result = [...queue];

        // 1. Tab Filter
        if (activeOperationTab !== "All") {
            result = result.filter(q => q.operationName === activeOperationTab);
        }

        // 2. Search Box Filter (Doc No or Amount)
        if (searchTerm) {
            const lowerSearch = searchTerm.toLowerCase();
            result = result.filter(q =>
                (q.docNo && q.docNo.toLowerCase().includes(lowerSearch)) ||
                (q.pouchAmount && q.pouchAmount.toString().includes(lowerSearch))
            );
        }

        // 3. Date Filters
        if (dateFrom) {
            result = result.filter(q => new Date(q.collectionDate) >= new Date(dateFrom));
        }
        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            result = result.filter(q => new Date(q.collectionDate) <= to);
        }

        // 4. Combobox Filters
        if (salesman !== "all") result = result.filter(q => q.salesmanName === salesman);
        if (cashier !== "all") result = result.filter(q => q.encoderName === cashier);

        // 5. Column Sort
        result.sort((a, b) => {
            const aVal = a[sortField];
            const bVal = b[sortField];

            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;

            if (typeof aVal === "number" && typeof bVal === "number") {
                return sortDir === "asc" ? aVal - bVal : bVal - aVal;
            }

            const strA = String(aVal).toLowerCase();
            const strB = String(bVal).toLowerCase();
            return sortDir === "asc" ? strA.localeCompare(strB) : strB.localeCompare(strA);
        });

        return result;
    }, [queue, activeOperationTab, searchTerm, dateFrom, dateTo, salesman, cashier, sortField, sortDir]);

    const handleSort = (field: keyof PostingQueueItem) => {
        if (sortField === field) {
            setSortDir(sortDir === "asc" ? "desc" : "asc");
        } else {
            setSortField(field);
            setSortDir("asc");
        }
    };

    if (isLoading) {
        return (
            <div className="p-10 flex flex-col items-center justify-center text-muted-foreground min-h-[50vh] gap-4">
                <Loader2 className="animate-spin" size={32} />
                <span className="font-black uppercase tracking-widest text-xs">Loading Audit Queue...</span>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <Header onRefresh={refreshQueue} />

            {/* 🚀 THE FILTER CONTROL PANEL */}
            <div className="bg-card border border-border p-4 rounded-xl shadow-sm grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

                <div className="relative xl:col-span-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input
                        placeholder="Search Doc No or Amount..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="h-9 pl-9 bg-background text-xs font-bold shadow-inner"
                    />
                </div>

                <div className="relative xl:col-span-2">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        className="h-9 pl-9 bg-background text-xs font-bold shadow-inner text-muted-foreground"
                    />
                </div>

                <div className="relative xl:col-span-2">
                    <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        className="h-9 pl-9 bg-background text-xs font-bold shadow-inner text-muted-foreground"
                    />
                </div>

                <Popover open={salesmanOpen} onOpenChange={setSalesmanOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="h-9 justify-between text-xs font-bold bg-background xl:col-span-2 text-muted-foreground truncate">
                            <span className="truncate">{salesman === "all" ? "All Route Codes" : salesman}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search code..." className="text-xs" />
                            <CommandList className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-foreground/20">
                                <CommandEmpty>No route found.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem onSelect={() => { setSalesman("all"); setSalesmanOpen(false); }} className="text-xs font-bold">
                                        <Check className={cn("mr-2 h-4 w-4", salesman === "all" ? "opacity-100 text-primary" : "opacity-0")} />
                                        All Route Codes
                                    </CommandItem>
                                    {uniqueSalesmen.map(s => (
                                        <CommandItem key={s} onSelect={() => { setSalesman(s); setSalesmanOpen(false); }} className="text-xs font-bold">
                                            <Check className={cn("mr-2 h-4 w-4", salesman === s ? "opacity-100 text-primary" : "opacity-0")} />
                                            {s}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                <Popover open={cashierOpen} onOpenChange={setCashierOpen}>
                    <PopoverTrigger asChild>
                        <Button variant="outline" role="combobox" className="h-9 justify-between text-xs font-bold bg-background xl:col-span-2 text-muted-foreground truncate">
                            <span className="truncate">{cashier === "all" ? "All Cashiers" : cashier}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50"/>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[200px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search cashier..." className="text-xs" />
                            <CommandList className="max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border hover:scrollbar-thumb-foreground/20">
                                <CommandEmpty>No cashier found.</CommandEmpty>
                                <CommandGroup>
                                    <CommandItem onSelect={() => { setCashier("all"); setCashierOpen(false); }} className="text-xs font-bold">
                                        <Check className={cn("mr-2 h-4 w-4", cashier === "all" ? "opacity-100 text-primary" : "opacity-0")} />
                                        All Cashiers
                                    </CommandItem>
                                    {uniqueCashiers.map(c => (
                                        <CommandItem key={c} onSelect={() => { setCashier(c); setCashierOpen(false); }} className="text-xs font-bold">
                                            <Check className={cn("mr-2 h-4 w-4", cashier === c ? "opacity-100 text-primary" : "opacity-0")} />
                                            {c}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </CommandList>
                        </Command>
                    </PopoverContent>
                </Popover>

                <Button variant="ghost" size="icon" onClick={() => {
                    setSearchTerm(""); setDateFrom(""); setDateTo(""); setSalesman("all"); setCashier("all");
                }} className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors xl:col-span-1 ml-auto" title="Clear Filters">
                    <FilterX size={16}/>
                </Button>
            </div>

            {queue.length > 0 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin">
                    <div className="flex items-center gap-2 text-muted-foreground pr-2 border-r border-border shrink-0">
                        <Layers size={16} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Filter by Operation:</span>
                    </div>

                    <Button
                        variant={activeOperationTab === "All" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setActiveOperationTab("All")}
                        className="rounded-full h-8 text-xs font-bold tracking-wide shrink-0 transition-all"
                    >
                        All Operations ({queue.length})
                    </Button>

                    {uniqueOperations.map(operation => {
                        const count = queue.filter(q => q.operationName === operation).length;
                        return (
                            <Button
                                key={operation}
                                variant={activeOperationTab === operation ? "default" : "outline"}
                                size="sm"
                                onClick={() => setActiveOperationTab(operation)}
                                className={`rounded-full h-8 text-xs font-bold tracking-wide shrink-0 transition-all ${
                                    activeOperationTab !== operation ? 'bg-background hover:bg-muted text-muted-foreground' : ''
                                }`}
                            >
                                {operation} ({count})
                            </Button>
                        );
                    })}
                </div>
            )}

            {/* 🚀 Pass the FILTERED and SORTED queue and sort props to the table */}
            <QueueTable
                queue={processedQueue}
                onReview={openReviewSheet}
                sortField={sortField}
                sortDir={sortDir}
                onSort={handleSort}
            />

            <ReviewSheet
                isOpen={isReviewSheetOpen}
                onOpenChange={setIsReviewSheetOpen}
                isLoading={isLoadingDetails}
                pouch={selectedPouch}
                isPosting={isPosting}
                onPost={handlePostPouch}
            />
        </div>
    );
}