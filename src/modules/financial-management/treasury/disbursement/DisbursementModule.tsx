"use client";

import React, { useState } from "react";
import { useDisbursement } from "./hooks/useDisbursement";
import { DisbursementTable } from "./components/DisbursementTable";
import { DisbursementCreateSheet } from "./components/DisbursementCreateSheet";
import { DisbursementViewSheet } from "./components/DisbursementViewSheet";
import { DisbursementDashboardTab } from "./components/DisbursementDashboardTab";
import { Disbursement } from "./types";
import { AddPayeeModal } from "@/modules/financial-management/payee-registration/components/modals/add-payee-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
    Plus, RefreshCw, FileText, Search, Check, ChevronsUpDown,
    X, UserPlus, BarChart3, Receipt, SlidersHorizontal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
    const [isAddPayeeOpen, setIsAddPayeeOpen] = useState(false);
    const [isComboboxOpen, setIsComboboxOpen] = useState(false);
    const [selectedDisbursement, setSelectedDisbursement] = useState<Disbursement | null>(null);
    const [formMode, setFormMode] = useState<"create" | "edit">("create");

    // 🚀 State to toggle the advanced filters!
    const [showFilters, setShowFilters] = useState(false);

    const addPayeeSupplierType = activeType === "Non-Trade" ? "NON-TRADE" : "TRADE";

    const handleView = (d: Disbursement) => { setSelectedDisbursement(d); setIsViewOpen(true); };
    const handleEdit = (d: Disbursement) => { setSelectedDisbursement(d); setFormMode("edit"); setIsViewOpen(false); setIsCreateOpen(true); };
    const handleNewVoucherClick = () => { setSelectedDisbursement(null); setFormMode("create"); setIsCreateOpen(true); };

    const handleAddPayeeSuccess = () => {
        refresh();
        toast.success("Payee created successfully");
        setIsAddPayeeOpen(false);
    };

    return (
        <div className="flex flex-col gap-8 p-4 sm:p-8 animate-in fade-in duration-700 max-w-[1600px] mx-auto min-h-screen" style={{ background: 'linear-gradient(180deg, hsl(var(--muted) / 0.15) 0%, transparent 600px)' }}>

            {/* 🌟 PREMIUM GLOBAL HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2 border-b border-border/50">
                <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center text-primary shadow-[0_0_20px_-5px_rgba(var(--primary),0.2)] shrink-0">
                        <FileText className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-foreground">Disbursements</h1>
                        <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1 tracking-wide">Manage vouchers, treasury payments, and expense tracking</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        disabled={loading}
                        className="h-10 px-4 text-xs font-bold uppercase tracking-widest bg-background/50 backdrop-blur-sm border-border/50 hover:bg-muted/50 transition-all"
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-2", loading && "animate-spin")} />
                        Refresh Data
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsAddPayeeOpen(true)}
                        className="h-10 px-4 font-bold uppercase tracking-wider text-[10px]"
                    >
                        <UserPlus className="w-4 h-4 mr-2" /> New Payee
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleNewVoucherClick}
                        className="h-10 px-5 font-black uppercase tracking-widest text-xs shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95"
                    >
                        <Plus className="w-4 h-4 mr-2" /> New Voucher
                    </Button>
                </div>
            </div>

            {/* 🚀 MASTER MODULE TABS (Modern Line Style) */}
            <Tabs defaultValue="management" className="w-full flex flex-col gap-6">
                <TabsList className="bg-transparent h-auto p-0 flex gap-8 border-b border-border w-full justify-start rounded-none">
                    <TabsTrigger
                        value="management"
                        className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-2 py-3 font-black uppercase tracking-widest text-xs transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <Receipt size={16} className="mr-2 mb-0.5"/> Voucher Management
                    </TabsTrigger>
                    <TabsTrigger
                        value="dashboard"
                        className="data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-2 py-3 font-black uppercase tracking-widest text-xs transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <BarChart3 size={16} className="mr-2 mb-0.5"/> BI Dashboard & Reports
                    </TabsTrigger>
                </TabsList>

                {/* TAB 1: EXISTING VOUCHER MANAGEMENT */}
                <TabsContent value="management" className="flex flex-col gap-6 m-0 focus-visible:outline-none focus-visible:ring-0">

                    {/* 🔍 THE IMMACULATE COLLAPSIBLE FILTER BAR */}
                    <div className="flex flex-col bg-card rounded-2xl border border-border shadow-sm shadow-black/5 overflow-hidden transition-all duration-300">

                        {/* Primary Search Row */}
                        <div className="flex flex-col sm:flex-row items-center justify-between p-3 gap-3">
                            <div className="flex items-center flex-1 w-full relative group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <Input
                                    placeholder="Search by Voucher No... (Press Enter)"
                                    value={docNoSearch}
                                    onChange={e => setDocNoSearch(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && applyFilters()}
                                    className="pl-11 h-10 text-xs font-bold uppercase bg-muted/30 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:bg-background rounded-xl w-full transition-all"
                                />
                            </div>

                            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                                <Button
                                    variant={showFilters ? "secondary" : "ghost"}
                                    size="sm"
                                    onClick={() => setShowFilters(!showFilters)}
                                    className={cn(
                                        "h-10 px-4 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all",
                                        showFilters ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                                    {showFilters ? "Hide Filters" : "Advanced"}
                                </Button>

                                <div className="h-6 w-px bg-border mx-1 hidden sm:block"></div>

                                <Button
                                    onClick={applyFilters}
                                    size="sm"
                                    className="h-10 px-6 text-[10px] font-black uppercase tracking-widest bg-foreground text-background hover:bg-foreground/90 shadow-sm rounded-xl"
                                >
                                    Apply
                                </Button>
                                <Button
                                    onClick={clearFilters}
                                    variant="ghost"
                                    size="icon"
                                    className="h-10 w-10 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl"
                                    title="Clear All Filters"
                                >
                                    <X className="w-4 h-4"/>
                                </Button>
                            </div>
                        </div>

                        {/* Secondary Row (Advanced Filters) */}
                        <div className={cn(
                            "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 px-5 pb-5 border-t border-border/50 bg-muted/10 transition-all duration-300 ease-in-out overflow-hidden",
                            showFilters ? "pt-5 opacity-100 max-h-[500px]" : "pt-0 opacity-0 max-h-0 border-transparent pb-0"
                        )}>
                            {/* Supplier Combobox */}
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Supplier / Payee</Label>
                                <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" role="combobox" aria-expanded={isComboboxOpen} className="w-full h-9 text-xs font-bold justify-between bg-background hover:bg-muted/50 px-3 rounded-lg border-border/50 shadow-sm">
                                            <span className="truncate text-foreground uppercase">{supplierSearch || "All Suppliers"}</span>
                                            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0 shadow-xl border-border rounded-xl" align="start">
                                        <Command>
                                            <CommandInput placeholder="Type to filter..." className="h-10 text-xs font-medium" />
                                            <CommandList className="max-h-[250px] scrollbar-thin">
                                                <CommandEmpty className="py-6 text-center text-xs text-muted-foreground font-medium">No supplier found.</CommandEmpty>
                                                <CommandGroup>
                                                    <CommandItem onSelect={() => { setSupplierSearch(""); setIsComboboxOpen(false); }} className="text-[10px] font-black uppercase text-muted-foreground cursor-pointer py-2">-- Clear Selection --</CommandItem>
                                                    {filterSuppliers.map((sup) => (
                                                        <CommandItem key={sup.id} value={sup.supplier_name} onSelect={() => { setSupplierSearch(sup.supplier_name); setIsComboboxOpen(false); }} className="text-xs font-bold uppercase cursor-pointer py-2">
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
                            <div className="space-y-2 col-span-1 sm:col-span-2 lg:col-span-1">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Transaction Date</Label>
                                <div className="flex items-center gap-2">
                                    <Input type="date" className="h-9 text-xs font-bold uppercase bg-background border-border/50 shadow-sm flex-1 px-2 rounded-lg" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                                    <span className="text-[9px] font-black text-muted-foreground/50 uppercase">TO</span>
                                    <Input type="date" className="h-9 text-xs font-bold uppercase bg-background border-border/50 shadow-sm flex-1 px-2 rounded-lg" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                                </div>
                            </div>

                            {/* Status */}
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Approval Status</Label>
                                <select className="h-9 w-full rounded-lg border border-border/50 bg-background px-3 text-xs font-bold uppercase text-foreground shadow-sm focus:ring-1 focus:ring-primary/30 transition-all outline-none" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
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
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Cost Division</Label>
                                <select className="h-9 w-full rounded-lg border border-border/50 bg-background px-3 text-xs font-bold uppercase text-foreground shadow-sm focus:ring-1 focus:ring-primary/30 transition-all outline-none" value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)}>
                                    <option value="">All Divisions</option>
                                    {divisions.map((d, idx) => (
                                        <option key={`f-div-${d.divisionId|| idx}`} value={d.divisionId}>
                                            {d.divisionName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Department */}
                            <div className="space-y-2">
                                <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">Cost Department</Label>
                                <select className="h-9 w-full rounded-lg border border-border/50 bg-background px-3 text-xs font-bold uppercase text-foreground shadow-sm focus:ring-1 focus:ring-primary/30 transition-all outline-none" value={departmentFilter} onChange={e => setDepartmentFilter(e.target.value)}>
                                    <option value="">All Departments</option>
                                    {departments.map((d, idx) => (
                                        <option key={`f-dept-${d.departmentId || idx}`} value={d.departmentId}>
                                            {d.departmentName}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* 📊 DATA TABLE SECTION */}
                    <div className="flex flex-col gap-4">
                        <Tabs value={activeType} onValueChange={handleTabChange} className="w-full">
                            <div className="flex items-center justify-between mb-4">
                                <TabsList className="bg-muted/50 p-1 rounded-xl h-10 shadow-inner">
                                    <TabsTrigger value="All" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">All Types</TabsTrigger>
                                    <TabsTrigger value="Trade" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">Trade</TabsTrigger>
                                    <TabsTrigger value="Non-Trade" className="rounded-lg text-[10px] font-black uppercase tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm px-4">Non-Trade</TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden transition-all duration-300">
                                <DisbursementTable data={data} loading={loading} onView={handleView} />
                            </div>
                        </Tabs>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-2 pt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border-border/50 hover:bg-muted/50"
                                disabled={page === 0 || loading}
                                onClick={() => setPage(p => p - 1)}
                            >
                                Previous
                            </Button>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-4 py-1.5 rounded-full bg-muted/50 border border-border/30">
                                Page {page + 1} of {totalPages || 1}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-4 rounded-xl text-[10px] font-bold uppercase tracking-widest border-border/50 hover:bg-muted/50"
                                disabled={page >= totalPages - 1 || loading || totalPages === 0}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </TabsContent>

                {/* TAB 2: DASHBOARD & REPORTS */}
                <TabsContent value="dashboard" className="m-0 focus-visible:outline-none focus-visible:ring-0">
                    <DisbursementDashboardTab />
                </TabsContent>
            </Tabs>

            {/* GLOBAL MODALS - Rendered exactly once */}
            <DisbursementCreateSheet
                open={isCreateOpen}
                onOpenChange={setIsCreateOpen}
                onSubmit={(payload) => formMode === "edit" ? update(selectedDisbursement!.id, payload) : create(payload)}
                editData={formMode === "edit" ? selectedDisbursement : null}
                loading={actionLoading}
            />

            <DisbursementViewSheet
                open={isViewOpen}
                onOpenChange={setIsViewOpen}
                disbursement={selectedDisbursement}
                onUpdateStatus={changeStatus}
                onEdit={handleEdit}
                loading={actionLoading}
            />

            <AddPayeeModal
                open={isAddPayeeOpen}
                onClose={() => setIsAddPayeeOpen(false)}
                onSuccess={handleAddPayeeSuccess}
                supplierType={addPayeeSupplierType}
                allowSupplierTypeSelect
            />
        </div>
    );
}