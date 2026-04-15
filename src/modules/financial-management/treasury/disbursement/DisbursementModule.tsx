"use client";

import React, { useState } from "react";
import { useDisbursement } from "./hooks/useDisbursement";
import { DisbursementTable } from "./components/DisbursementTable";
import { DisbursementCreateSheet } from "./components/DisbursementCreateSheet";
import { DisbursementViewSheet } from "./components/DisbursementViewSheet";
import { Disbursement } from "./types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Plus, RefreshCw, FileText, Search, Check, ChevronsUpDown, X, Filter } from "lucide-react"; // 🚀 Added Filter Icon
import { cn } from "@/lib/utils";

export default function DisbursementModule() {
    const {
        data, loading, page, setPage, totalPages,
        activeType, handleTabChange, refresh,
        create, update, changeStatus, actionLoading,
        supplierSearch, setSupplierSearch, startDate, setStartDate, endDate, setEndDate,
        statusFilter, setStatusFilter, divisionFilter, setDivisionFilter, departmentFilter, setDepartmentFilter, docNoSearch, setDocNoSearch,
        applyFilters, clearFilters, filterSuppliers, divisions, departments
    } = useDisbursement();

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [selectedDisbursement, setSelectedDisbursement] = useState<Disbursement | null>(null);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");

    // 🚀 NEW: State to toggle the advanced filters!
    const [showFilters, setShowFilters] = useState(false);

    const handleView = (d: Disbursement) => { setSelectedDisbursement(d); setIsViewOpen(true); };
    const handleEdit = (d: Disbursement) => { setSelectedDisbursement(d); setFormMode("edit"); setIsViewOpen(false); setIsCreateOpen(true); };
    const handleNewVoucherClick = () => { setSelectedDisbursement(null); setFormMode("create"); setIsCreateOpen(true); };

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
                        <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                    <Button size="sm" onClick={handleNewVoucherClick} className="h-9 font-bold uppercase tracking-wider text-[10px]">
                        <Plus className="w-4 h-4 mr-2" /> New Voucher
                    </Button>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                {/* 🚀 THE IMMACULATE COLLAPSIBLE FILTER BAR */}
                <div className="flex flex-col bg-card rounded-lg border border-border shadow-sm z-10 overflow-hidden">

                    {/* Primary Row (Always Visible) */}
                    <div className="flex flex-col sm:flex-row items-center justify-between p-2 gap-2">
                        <div className="flex items-center flex-1 w-full relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search Voucher No... (Press Enter)"
                                value={docNoSearch}
                                onChange={e => setDocNoSearch(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && applyFilters()}
                                className="pl-9 h-9 text-xs font-bold uppercase bg-transparent border-none shadow-none focus-visible:ring-0 w-full sm:max-w-[400px]"
                            />
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button
                                variant={showFilters ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setShowFilters(!showFilters)}
                                className="h-9 text-[10px] font-bold uppercase tracking-widest"
                            >
                                <Filter className="w-3.5 h-3.5 mr-2" />
                                {showFilters ? "Hide Filters" : "Advanced Filters"}
                            </Button>
                            <div className="h-5 w-px bg-border mx-1 hidden sm:block"></div>
                            <Button onClick={applyFilters} size="sm" className="h-9 px-6 text-[10px] font-black uppercase tracking-widest bg-primary text-primary-foreground shadow-sm">
                                Search
                            </Button>
                            <Button onClick={clearFilters} variant="ghost" size="sm" className="h-9 px-2 text-destructive hover:bg-destructive/10" title="Clear Filters">
                                <X className="w-4 h-4"/>
                            </Button>
                        </div>
                    </div>

                    {/* Secondary Row (Collapsible Advanced Filters) */}
                    <div className={cn(
                        "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 px-4 pb-4 border-t border-border pt-4 transition-all duration-300 ease-in-out",
                        showFilters ? "block animate-in fade-in slide-in-from-top-2" : "hidden"
                    )}>

                        {/* Supplier Combobox */}
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Supplier / Payee</Label>
                            <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" aria-expanded={isComboboxOpen} className="w-full h-8 text-xs font-medium justify-between border-input bg-background hover:bg-muted px-2">
                                        <span className="truncate text-foreground">{supplierSearch || "All Suppliers"}</span>
                                        <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0 shadow-lg border-border" align="start">
                                    <Command>
                                        <CommandInput placeholder="Type to filter..." className="h-8 text-xs" />
                                        <CommandList className="max-h-[250px] scrollbar-thin">
                                            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground font-medium">No supplier found.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem onSelect={() => { setSupplierSearch(""); setIsComboboxOpen(false); }} className="text-[10px] font-black uppercase text-muted-foreground cursor-pointer">-- Clear Selection --</CommandItem>
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
                        </div>

                        {/* Date Range */}
                        <div className="space-y-1.5 col-span-1 sm:col-span-2 lg:col-span-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Transaction Date</Label>
                            <div className="flex items-center gap-1">
                                <Input type="date" className="h-8 text-xs font-medium bg-background border-input flex-1 px-1" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                <span className="text-[9px] font-black text-muted-foreground uppercase mx-1">TO</span>
                                <Input type="date" className="h-8 text-xs font-medium bg-background border-input flex-1 px-1" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                            </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Approval Status</Label>
                            <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase text-foreground shadow-sm" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                <option value="All">All Statuses</option>
                                <option value="Draft">Draft</option>
                                <option value="Submitted">Submitted</option>
                                <option value="Approved">Approved</option>
                                <option value="Released">Released</option>
                                <option value="Posted">Posted</option>
                                <option value="Returned for Revision">Returned</option>
                            </select>
                        </div>

                        {/* Division */}
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cost Division</Label>
                            <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase text-foreground shadow-sm" value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)}>
                                <option value="">All Divisions</option>
                                {divisions.map((d, idx) => (
                                    <option key={`f-div-${d.id || idx}`} value={d.id}>
                                        {d.divisionName}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Department */}
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Cost Department</Label>
                            <select className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs font-bold uppercase text-foreground shadow-sm" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}>
                                <option value="">All Departments</option>
                                {departments.map((d, idx) => (
                                    <option key={`f-dept-${d.id || idx}`} value={d.id}>
                                        {d.departmentName}
                                    </option>
                                ))}
                            </select>
                        </div>

                    </div>
                </div>

                <Tabs value={activeType} onValueChange={handleTabChange} className="w-full mt-2">
                    <TabsList className="grid w-full sm:w-[400px] grid-cols-3 h-10 mb-3 bg-card border border-border shadow-sm">
                        <TabsTrigger value="All" className="text-[10px] font-black uppercase tracking-widest">All Types</TabsTrigger>
                        <TabsTrigger value="Trade" className="text-[10px] font-black uppercase tracking-widest">Trade</TabsTrigger>
                        <TabsTrigger value="Non-Trade" className="text-[10px] font-black uppercase tracking-widest">Non-Trade</TabsTrigger>
                    </TabsList>
                    <DisbursementTable data={data} loading={loading} onView={handleView} />
                </Tabs>

                <div className="flex items-center justify-between px-1 mt-2">
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase" disabled={page === 0 || loading} onClick={() => setPage(p => p - 1)}>Previous</Button>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted px-3 py-1 rounded-full">Page {page + 1} of {totalPages || 1}</span>
                    <Button variant="outline" size="sm" className="h-8 text-[10px] font-bold uppercase" disabled={page >= totalPages - 1 || loading || totalPages === 0} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
            </div>

            <DisbursementCreateSheet open={isCreateOpen} onOpenChange={setIsCreateOpen} onSubmit={(payload) => formMode === "edit" ? update(selectedDisbursement!.id, payload) : create(payload)} editData={formMode === "edit" ? selectedDisbursement : null} loading={actionLoading} />
            <DisbursementViewSheet open={isViewOpen} onOpenChange={setIsViewOpen} disbursement={selectedDisbursement} onUpdateStatus={changeStatus} onEdit={handleEdit} loading={actionLoading} />
        </div>
    );
}