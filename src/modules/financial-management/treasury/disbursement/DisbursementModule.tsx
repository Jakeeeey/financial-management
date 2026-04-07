"use client";

import React, { useState } from "react";
import { useDisbursement } from "./hooks/useDisbursement";
import { DisbursementTable } from "./components/DisbursementTable";
import { DisbursementCreateSheet } from "./components/DisbursementCreateSheet";
import { DisbursementViewSheet } from "./components/DisbursementViewSheet";
import { Disbursement } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, RefreshCw, FileText, Search, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function DisbursementModule() {
    const {
        data, loading, page, setPage, totalPages,
        activeType, handleTabChange, refresh,
        create, update, changeStatus, actionLoading,
        supplierSearch, setSupplierSearch,
        startDate, setStartDate, endDate, setEndDate,
        applyFilters, filterSuppliers
    } = useDisbursement();

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [selectedDisbursement, setSelectedDisbursement] = useState<Disbursement | null>(null);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");

    const handleView = (d: Disbursement) => {
        setSelectedDisbursement(d);
        setIsViewOpen(true);
    };

    const handleEdit = (d: Disbursement) => {
        setSelectedDisbursement(d);
        setFormMode("edit");
        setIsViewOpen(false);
        setIsCreateOpen(true);
    };

    const handleNewVoucherClick = () => {
        setSelectedDisbursement(null);
        setFormMode("create");
        setIsCreateOpen(true);
    };

    return (
        <div className="flex flex-col gap-6 p-2 sm:p-6 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner shrink-0">
                        <FileText className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground">Voucher Management</h1>
                        <p className="text-[11px] sm:text-sm text-muted-foreground font-medium">Treasury Disbursements & Payables</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={refresh} disabled={loading} className="h-9">
                        <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={handleNewVoucherClick} className="h-9 font-bold uppercase tracking-wider text-[10px]">
                        <Plus className="w-4 h-4 mr-2" />
                        New Voucher
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {/* 🚀 Dark Mode Filter Bar */}
                <div className="flex flex-col xl:flex-row items-center gap-3 bg-card p-3 rounded-lg border border-border shadow-sm z-10">
                    <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={isComboboxOpen}
                                className="w-full xl:w-[350px] h-9 text-xs font-medium justify-between border-input bg-background hover:bg-muted"
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="truncate text-foreground">
                                        {supplierSearch || "Search Payee / Supplier..."}
                                    </span>
                                </div>
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[350px] p-0 shadow-lg border-border" align="start">
                            <Command>
                                <CommandInput placeholder="Type to filter suppliers..." className="h-9 text-xs" />
                                <CommandList className="max-h-[250px] scrollbar-thin">
                                    <CommandEmpty className="py-4 text-center text-xs text-muted-foreground font-medium">
                                        No supplier found.
                                    </CommandEmpty>
                                    <CommandGroup>
                                        <CommandItem value="clear-selection-action" onSelect={() => { setSupplierSearch(""); setIsComboboxOpen(false); }} className="text-[10px] font-black uppercase tracking-widest text-muted-foreground cursor-pointer">
                                            -- Clear Selection --
                                        </CommandItem>
                                        {filterSuppliers.map((sup) => (
                                            <CommandItem key={sup.id} value={sup.supplier_name} onSelect={() => { setSupplierSearch(sup.supplier_name); setIsComboboxOpen(false); }} className="text-xs font-medium cursor-pointer">
                                                <Check className={cn("mr-2 h-4 w-4 text-primary", supplierSearch === sup.supplier_name ? "opacity-100" : "opacity-0")} />
                                                {sup.supplier_name}
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                        </PopoverContent>
                    </Popover>

                    <div className="flex items-center gap-2 w-full xl:w-auto ml-auto">
                        <Input type="date" className="h-9 text-xs w-[130px] font-medium bg-background border-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        <span className="text-[10px] font-black text-muted-foreground uppercase">TO</span>
                        <Input type="date" className="h-9 text-xs w-[130px] font-medium bg-background border-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        <Button onClick={applyFilters} size="sm" className="h-9 text-[10px] font-bold uppercase tracking-widest ml-2 px-6">Apply</Button>
                    </div>
                </div>

                <Tabs value={activeType} onValueChange={handleTabChange} className="w-full">
                    <TabsList className="grid w-full sm:w-[400px] grid-cols-3 h-10 mb-2">
                        <TabsTrigger value="All" className="text-[10px] font-black uppercase tracking-widest">All</TabsTrigger>
                        <TabsTrigger value="Trade" className="text-[10px] font-black uppercase tracking-widest">Trade</TabsTrigger>
                        <TabsTrigger value="Non-Trade" className="text-[10px] font-black uppercase tracking-widest">Non-Trade</TabsTrigger>
                    </TabsList>
                    <DisbursementTable data={data} loading={loading} onView={handleView} />
                </Tabs>

                <div className="flex items-center justify-between px-1 mt-2">
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Page {page + 1} of {totalPages || 1}</span>
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase" disabled={page >= totalPages - 1 || loading || totalPages === 0} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
            </div>

            <DisbursementCreateSheet open={isCreateOpen} onOpenChange={setIsCreateOpen} onSubmit={(payload) => formMode === "edit" ? update(selectedDisbursement!.id, payload) : create(payload)} editData={formMode === "edit" ? selectedDisbursement : null} loading={actionLoading} />
            <DisbursementViewSheet open={isViewOpen} onOpenChange={setIsViewOpen} disbursement={selectedDisbursement} onUpdateStatus={changeStatus} onEdit={handleEdit} loading={actionLoading} />
        </div>
    );
}