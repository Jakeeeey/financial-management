"use client";

import React, { useState } from "react";
import { Plus, Search, Filter, RefreshCcw, ChevronsUpDown, Check as CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCashiering } from "./hooks/useCashiering";
import CashieringSheet from "./components/CashieringSheet";
import CashieringMasterList from "./components/CashieringMasterList";
import { CurrentUser } from "../types";
import { cn } from "@/lib/utils";

interface ModuleProps {
    currentUser: CurrentUser;
}

export default function CollectionCashieringModule({ currentUser }: ModuleProps) {
    const state = useCashiering(currentUser);

    // 🚀 NEW: Filter States
    const [showFilters, setShowFilters] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [salesmanFilter, setSalesmanFilter] = useState("all");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [openSalesmanFilter, setOpenSalesmanFilter] = useState(false);

    // 🚀 NEW: Filter Execution Logic
    const filteredList = state.masterList.filter(col => {
        const matchesSearch = !searchQuery ||
            col.docNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            col.salesmanName?.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesSalesman = salesmanFilter === "all" || col.salesmanCode === salesmanFilter;

        let matchesDate = true;
        if (dateFrom || dateTo) {
            const colDate = new Date(col.date);
            if (dateFrom && new Date(dateFrom) > colDate) matchesDate = false;
            if (dateTo && new Date(dateTo) < colDate) matchesDate = false;
        }

        return matchesSearch && matchesSalesman && matchesDate;
    });

    return (
        <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto animate-in fade-in duration-500">

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                        Collection Cashiering
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Receive and manage physical remittance pouches.
                    </p>
                </div>
                <Button
                    onClick={() => {
                        state.resetForm();
                        state.setIsSheetOpen(true);
                    }}
                    className="gap-2 shadow-md bg-primary hover:bg-primary/90"
                >
                    <Plus size={16} /> Receive New Pouch
                </Button>
            </div>

            {/* 🚀 NEW: Advanced Filter Bar */}
            <div className="flex flex-col bg-card rounded-lg border border-border shadow-sm z-10 overflow-hidden">
                {/* Primary Row */}
                <div className="flex flex-col sm:flex-row items-center justify-between p-2 gap-2">
                    <div className="flex items-center flex-1 w-full relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by CP number or salesman..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 h-9 text-xs font-bold uppercase bg-transparent border-none shadow-none focus-visible:ring-0 w-full"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button variant={showFilters ? "secondary" : "ghost"} size="sm" onClick={() => setShowFilters(!showFilters)} className="h-9 text-[10px] font-bold uppercase tracking-widest">
                            <Filter className="w-3.5 h-3.5 mr-2" /> {showFilters ? "Hide Filters" : "Advanced Filters"}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => window.location.reload()}>
                            <RefreshCcw size={14} className={state.isLoading ? "animate-spin" : ""} />
                        </Button>
                    </div>
                </div>

                {/* Secondary Row (Collapsible) */}
                <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-4 pb-4 border-t border-border pt-4 transition-all duration-300", showFilters ? "block animate-in fade-in slide-in-from-top-2" : "hidden")}>
                    {/* Salesman Combobox */}
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Salesman</Label>
                        <Popover open={openSalesmanFilter} onOpenChange={setOpenSalesmanFilter}>
                            <PopoverTrigger asChild>
                                <Button variant="outline" role="combobox" aria-expanded={openSalesmanFilter} className="w-full h-8 text-xs font-medium justify-between border-input bg-background hover:bg-muted px-2">
                                    <span className="truncate text-foreground">
                                        {salesmanFilter === "all" ? "All Salesmen" : state.salesmen.find(s => s.salesmanCode === salesmanFilter)?.salesmanName || salesmanFilter}
                                    </span>
                                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[300px] p-0 shadow-lg border-border" align="start">
                                <Command>
                                    <CommandInput placeholder="Type to filter..." className="h-8 text-xs" />
                                    <CommandList>
                                        <CommandEmpty>No salesman found.</CommandEmpty>
                                        <CommandGroup>
                                            <CommandItem onSelect={() => { setSalesmanFilter("all"); setOpenSalesmanFilter(false); }} className="text-[10px] font-black uppercase text-muted-foreground cursor-pointer">-- All Salesmen --</CommandItem>
                                            {state.salesmen.map((sup) => (
                                                <CommandItem key={sup.id} value={sup.salesmanName} onSelect={() => { setSalesmanFilter(sup.salesmanCode); setOpenSalesmanFilter(false); }} className="text-xs font-medium cursor-pointer">
                                                    <CheckIcon className={cn("mr-2 h-4 w-4 text-primary", salesmanFilter === sup.salesmanCode ? "opacity-100" : "opacity-0")} />
                                                    {sup.salesmanName}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Date Range */}
                    <div className="space-y-1.5 col-span-1 lg:col-span-2">
                        <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Date Range</Label>
                        <div className="flex items-center gap-1">
                            <Input type="date" className="h-8 text-xs font-medium bg-background border-input flex-1 px-1" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                            <span className="text-[9px] font-black text-muted-foreground uppercase mx-1">TO</span>
                            <Input type="date" className="h-8 text-xs font-medium bg-background border-input flex-1 px-1" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                        </div>
                    </div>
                </div>
            </div>

            {/* 🚀 Render the List with the FILTERED data */}
            <CashieringMasterList
                data={filteredList}
                isLoading={state.isLoading}
                state={state}
            />

            <CashieringSheet state={state} />

        </div>
    );
}