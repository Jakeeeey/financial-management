"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
    Search, RefreshCw, FileSpreadsheet, SlidersHorizontal, X, ChevronDown, ChevronUp,
    FileText, Calendar, Wallet, ArrowDownRight, HelpCircle
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import { disbursementProvider } from "../providers/fetchProvider";
import { Disbursement, DashboardFilters, COADto, SupplierDto, DivisionDto, DepartmentDto } from "../types";
import { generateReportExcel } from "../utils/reportExcelGenerator";
import { DisbursementViewSheet } from "../components/DisbursementViewSheet";
import { StickyTableWrapper } from "../components/StickyTableWrapper";

interface SearchSelectProps<T extends string | number> {
    options: { label: string; value: T }[];
    value: T | "";
    onSelect: (val: T) => void;
    placeholder: string;
    className?: string;
}

function SearchSelect<T extends string | number>({ options, value, onSelect, placeholder, className }: SearchSelectProps<T>) {
    const [open, setOpen] = useState(false);
    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || placeholder;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className={cn("justify-between w-full h-9 text-xs font-bold uppercase bg-background px-2.5", className)}>
                    <span className="truncate text-left">{selectedLabel}</span>
                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-55" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0 shadow-lg border-border" align="start">
                <Command filter={(val, search) => {
                    if (val.toLowerCase().includes(search.toLowerCase())) return 1;
                    return 0;
                }}>
                    <CommandInput placeholder="Search..." className="h-9 text-xs" />
                    <CommandList className="max-h-[220px] scrollbar-thin">
                        <CommandEmpty className="py-3 text-center text-xs text-muted-foreground font-bold">No matches found.</CommandEmpty>
                        <CommandGroup>
                            {options.map((opt, idx) => (
                                <CommandItem
                                    key={`${opt.value}-${idx}`}
                                    value={opt.label}
                                    onSelect={() => {
                                        onSelect(opt.value);
                                        setOpen(false);
                                    }}
                                    className="text-xs cursor-pointer py-2 font-bold uppercase"
                                >
                                    <Check className={cn("mr-2 h-4.5 w-4.5 text-primary", String(value) === String(opt.value) ? "opacity-100" : "opacity-0")} />
                                    {opt.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default function LedgerSubmodule() {
    // Grid type tabs
    // Core data states
    const [vouchers, setVouchers] = useState<Disbursement[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(0);
    const [size, setSize] = useState(20);
    const [totalPages, setTotalPages] = useState(0);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [totalElements, setTotalElements] = useState(0);

    // Filter states
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [docNoSearch, setDocNoSearch] = useState("");
    const [supplierSearch, setSupplierSearch] = useState("");
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [typeFilter, setTypeFilter] = useState("All");
    const [divisionFilter, setDivisionFilter] = useState("");
    const [departmentFilter, setDepartmentFilter] = useState("");
    const [coaFilter, setCoaFilter] = useState("All");
    const [minAmount, setMinAmount] = useState<number | "">("");
    const [maxAmount, setMaxAmount] = useState<number | "">("");
    const [remarksSearch, setRemarksSearch] = useState("");

    // Lookups
    const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
    const [divisions, setDivisions] = useState<DivisionDto[]>([]);
    const [departments, setDepartments] = useState<DepartmentDto[]>([]);
    const [coas, setCoas] = useState<COADto[]>([]);
    const [isSupplierComboOpen, setIsSupplierComboOpen] = useState(false);
    const [isCoaComboOpen, setIsCoaComboOpen] = useState(false);

    // Details view state
    const [selectedDisbursement, setSelectedDisbursement] = useState<Disbursement | null>(null);
    const [isViewOpen, setIsViewOpen] = useState(false);
    const [exportLoading, setExportLoading] = useState(false);

    // Load lookup data
    useEffect(() => {
        const loadLookups = async () => {
            try {
                const [trade, nonTrade, divs, depts, coaList] = await Promise.all([
                    disbursementProvider.getSuppliers("Trade").catch(() => []),
                    disbursementProvider.getSuppliers("Non-Trade").catch(() => []),
                    disbursementProvider.getDivisions().catch(() => []),
                    disbursementProvider.getDepartments().catch(() => []),
                    disbursementProvider.getCOAs().catch(() => [])
                ]);
                setSuppliers([...trade, ...nonTrade].sort((a, b) => a.supplier_name.localeCompare(b.supplier_name)));
                setDivisions(divs);
                setDepartments(depts);
                setCoas(coaList);
            } catch (err) {
                console.error("Failed to load lookups", err);
            }
        };
        loadLookups();
    }, []);

    // Main fetch routine
    const fetchLedger = useCallback(async () => {
        setLoading(true);
        try {
            // Standard fetch uses the same parameters as general search
            const res = await disbursementProvider.getDisbursements(
                page,
                size,
                typeFilter, // All types (Trade/Non-Trade)
                supplierSearch,
                startDate,
                endDate,
                statusFilter,
                divisionFilter,
                departmentFilter,
                docNoSearch
            );

            // Client side filtering for filters not supported natively by simple disbursements fetch (COA, min/max amount, remarks)
            let filteredContent = res.content;

            if (coaFilter && coaFilter !== "All") {
                const coaId = Number(coaFilter);
                filteredContent = filteredContent.filter(item => 
                    item.payables.some(p => p.coaId === coaId) || 
                    item.payments.some(p => p.coaId === coaId)
                );
            }

            if (minAmount !== "") {
                filteredContent = filteredContent.filter(item => item.totalAmount >= Number(minAmount));
            }

            if (maxAmount !== "") {
                filteredContent = filteredContent.filter(item => item.totalAmount <= Number(maxAmount));
            }

            if (remarksSearch.trim()) {
                const q = remarksSearch.toLowerCase();
                filteredContent = filteredContent.filter(item => 
                    (item.remarks || "").toLowerCase().includes(q) ||
                    item.payables.some(p => (p.remarks || "").toLowerCase().includes(q)) ||
                    item.payments.some(p => (p.remarks || "").toLowerCase().includes(q))
                );
            }

            setVouchers(filteredContent);
            setTotalElements(res.totalElements);
            setTotalPages(res.totalPages);
        } catch (err) {
            console.error("Failed to load ledger data", err);
            toast.error("Failed to fetch ledger rows");
        } finally {
            setLoading(false);
        }
    }, [page, size, typeFilter, supplierSearch, startDate, endDate, statusFilter, divisionFilter, departmentFilter, docNoSearch, coaFilter, minAmount, maxAmount, remarksSearch]);

    useEffect(() => {
        fetchLedger();
    }, [fetchLedger, page, size]);

    // Apply & Clear triggers
    const handleApplyFilters = () => {
        setPage(0);
        fetchLedger();
    };

    const handleClearFilters = () => {
        setDocNoSearch("");
        setSupplierSearch("");
        setStartDate("");
        setEndDate("");
        setStatusFilter("All");
        setTypeFilter("All");
        setDivisionFilter("");
        setDepartmentFilter("");
        setCoaFilter("All");
        setMinAmount("");
        setMaxAmount("");
        setRemarksSearch("");
        setPage(0);
        toast.info("Filters cleared");
    };

    // Quick presets
    const handleDatePreset = (preset: "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "clear") => {
        const today = new Date();
        let start = "";
        let end = today.toISOString().split("T")[0];

        if (preset === "thisMonth") {
            start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
        } else if (preset === "lastMonth") {
            start = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split("T")[0];
            end = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split("T")[0];
        } else if (preset === "thisQuarter") {
            const quarter = Math.floor(today.getMonth() / 3);
            start = new Date(today.getFullYear(), quarter * 3, 1).toISOString().split("T")[0];
        } else if (preset === "thisYear") {
            start = new Date(today.getFullYear(), 0, 1).toISOString().split("T")[0];
        } else {
            start = "";
            end = "";
        }

        setStartDate(start);
        setEndDate(end);
    };

    // Calculate aggregated stats on current rows for the top stats deck
    const statsSummary = useMemo(() => {
        let totalVouchered = 0;
        let totalPaid = 0;
        let totalRefunds = 0;
        let activeVouchers = 0;

        vouchers.forEach(v => {
            totalVouchered += v.totalAmount || 0;
            totalPaid += v.paidAmount || 0;
            activeVouchers += 1;

            // Sum negative check/payment amounts as refunds
            (v.payments || []).forEach(p => {
                if (p.amount < 0) {
                    totalRefunds += Math.abs(p.amount);
                }
            });
        });

        const payoutRate = totalVouchered > 0 ? (totalPaid / totalVouchered) * 100 : 0;

        return {
            totalVouchered,
            totalPaid,
            totalRefunds,
            payoutRate,
            activeVouchers
        };
    }, [vouchers]);

    // Excel export triggers
    const handleExportExcel = async () => {
        setExportLoading(true);
        try {
            // Set up DashboardFilters structure
            const filterPayload: DashboardFilters = {
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                status: statusFilter !== "All" ? statusFilter : undefined,
                payeeId: supplierSearch ? suppliers.find(s => s.supplier_name === supplierSearch)?.id?.toString() : undefined,
                coaId: coaFilter !== "All" ? coaFilter : undefined,
                minAmount: minAmount !== "" ? Number(minAmount) : undefined,
                maxAmount: maxAmount !== "" ? Number(maxAmount) : undefined,
                remarks: remarksSearch || undefined,
                transactionType: typeFilter === "Trade" ? "1" : typeFilter === "Non-Trade" ? "2" : undefined
            };

            // Fetch the dashboard summary block dynamically for comprehensive excel details
            const dashboardData = await disbursementProvider.getDashboardData(filterPayload);
            await generateReportExcel(dashboardData, filterPayload);
        } catch (err) {
            console.error("Export failed", err);
            toast.error("Failed to generate Excel report");
        } finally {
            setExportLoading(false);
        }
    };

    const handleRowClick = (voucher: Disbursement) => {
        setSelectedDisbursement(voucher);
        setIsViewOpen(true);
    };

    const formatCurrency = (val: number) => {
        return new Intl.NumberFormat("en-PH", {
            style: "currency",
            currency: "PHP"
        }).format(val);
    };

    const getStatusColor = (status: string) => {
        switch (status.toUpperCase()) {
            case "DRAFT": return "bg-gray-500/10 text-gray-400 border-gray-500/20";
            case "SUBMITTED": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
            case "APPROVED": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
            case "RELEASED": return "bg-indigo-500/10 text-indigo-400 border-indigo-500/20";
            case "POSTED": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
            case "RETURNED FOR REVISION":
            case "REJECTED":
                return "bg-rose-500/10 text-rose-400 border-rose-500/20";
            default: return "bg-muted text-muted-foreground border-border";
        }
    };

    return (
        <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {/* 🌟 PAGE HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-2 border-b border-border/50">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-[0_0_15px_-3px_rgba(16,185,129,0.2)] shrink-0">
                        <FileText className="h-6 w-6" />
                    </div>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-foreground">Ledger Register</h1>
                        <p className="text-xs text-muted-foreground font-medium mt-1">Audit complete double-entry logs, checks details, and refunds trail</p>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={fetchLedger}
                        disabled={loading}
                        className="h-9 px-3 text-xs font-bold uppercase tracking-wider bg-background/50 border-border/50 hover:bg-muted/50 transition-all"
                    >
                        <RefreshCw className={cn("w-3.5 h-3.5 mr-2", loading && "animate-spin")} />
                        Refresh
                    </Button>

                    <Button
                        size="sm"
                        disabled={exportLoading || vouchers.length === 0}
                        onClick={handleExportExcel}
                        className="h-9 px-4 text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10 transition-all active:scale-95"
                    >
                        {exportLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 mr-2 animate-spin" />
                        ) : (
                            <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />
                        )}
                        Export Excel
                    </Button>
                </div>
            </div>

            {/* 📊 KPI SUMMARY ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="rounded-xl border border-border shadow-sm p-4 bg-card/60 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Ledger Volume</span>
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <FileText className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2.5">
                        <div className="text-2xl font-black">{statsSummary.activeVouchers}</div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Vouchers Loaded</p>
                    </div>
                </Card>

                <Card className="rounded-xl border border-border shadow-sm p-4 bg-card/60 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Vouchered (Liabilities)</span>
                        <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                            <Calendar className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2.5">
                        <div className="text-2xl font-black text-amber-500">{formatCurrency(statsSummary.totalVouchered)}</div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Accounts Payable Balance</p>
                    </div>
                </Card>

                <Card className="rounded-xl border border-border shadow-sm p-4 bg-card/60 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Disbursed (Paid Outflow)</span>
                        <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-500">
                            <Wallet className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2.5">
                        <div className="text-2xl font-black text-indigo-400">{formatCurrency(statsSummary.totalPaid)}</div>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-[9px] font-black text-muted-foreground uppercase">Payout Rate</span>
                            <span className="text-[9px] font-black text-indigo-400">{statsSummary.payoutRate.toFixed(1)}%</span>
                        </div>
                    </div>
                </Card>

                <Card className="rounded-xl border border-border shadow-sm p-4 bg-card/60 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Total Refunds (Cash-In)</span>
                        <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                            <ArrowDownRight className="w-4 h-4" />
                        </div>
                    </div>
                    <div className="mt-2.5">
                        <div className="text-2xl font-black text-emerald-400">{formatCurrency(statsSummary.totalRefunds)}</div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1">Emerald Refund Highlights</p>
                    </div>
                </Card>
            </div>

            {/* 🔍 FILTER MATRIX PANEL */}
            <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-border/50">
                    <div className="flex items-center gap-3">
                        <Search className="w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by Voucher No..."
                            value={docNoSearch}
                            onChange={e => setDocNoSearch(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleApplyFilters()}
                            className="h-9 text-xs font-bold uppercase bg-muted/20 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/30 w-[240px] sm:w-[320px] rounded-lg"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowAdvanced(!showAdvanced)}
                            className={cn(
                                "h-9 px-3 text-[10px] font-black uppercase tracking-wider rounded-lg",
                                showAdvanced ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <SlidersHorizontal className="w-3.5 h-3.5 mr-2" />
                            {showAdvanced ? "Hide Advanced" : "Advanced Filters"}
                            {showAdvanced ? <ChevronUp className="w-3 h-3 ml-1.5" /> : <ChevronDown className="w-3 h-3 ml-1.5" />}
                        </Button>

                        <div className="h-5 w-px bg-border mx-1"></div>

                        <Button
                            onClick={handleApplyFilters}
                            size="sm"
                            className="h-9 px-5 text-[10px] font-black uppercase tracking-wider bg-foreground text-background hover:bg-foreground/90 rounded-lg"
                        >
                            Apply
                        </Button>
                        <Button
                            onClick={handleClearFilters}
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                            title="Clear Filters"
                        >
                            <X className="w-4 h-4"/>
                        </Button>
                    </div>
                </div>

                {/* Collapsible Filter Form */}
                {showAdvanced && (
                    <div className="p-5 border-b border-border/30 bg-muted/5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 animate-in slide-in-from-top duration-300">
                        {/* Supplier search */}
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">Payee / Supplier</Label>
                            <Popover open={isSupplierComboOpen} onOpenChange={setIsSupplierComboOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" aria-expanded={isSupplierComboOpen} className="w-full h-9 text-xs font-bold justify-between bg-background px-3 rounded-lg border-border/50 shadow-sm">
                                        <span className="truncate uppercase text-foreground">{supplierSearch || "All Suppliers"}</span>
                                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0 shadow-xl border-border rounded-lg" align="start">
                                    <Command>
                                        <CommandInput placeholder="Type supplier name..." className="h-9 text-xs font-medium" />
                                        <CommandList className="max-h-[220px]">
                                            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No supplier found.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem onSelect={() => { setSupplierSearch(""); setIsSupplierComboOpen(false); }} className="text-[10px] font-black uppercase text-muted-foreground cursor-pointer py-1.5">-- Clear Selection --</CommandItem>
                                                {suppliers.map((sup) => (
                                                    <CommandItem key={sup.id} value={sup.supplier_name} onSelect={() => { setSupplierSearch(sup.supplier_name); setIsSupplierComboOpen(false); }} className="text-xs font-bold uppercase cursor-pointer py-1.5">
                                                        <Check className={cn("mr-2 h-3.5 w-3.5 text-primary", supplierSearch === sup.supplier_name ? "opacity-100" : "opacity-0")} />
                                                        {sup.supplier_name}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* COA Filter */}
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">Chart of Account (COA)</Label>
                            <Popover open={isCoaComboOpen} onOpenChange={setIsCoaComboOpen}>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" aria-expanded={isCoaComboOpen} className="w-full h-9 text-xs font-bold justify-between bg-background px-3 rounded-lg border-border/50 shadow-sm">
                                        <span className="truncate uppercase text-foreground">
                                            {coaFilter === "All" ? "All Accounts" : coas.find(c => String(c.coaId) === coaFilter)?.accountTitle || coaFilter}
                                        </span>
                                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[320px] p-0 shadow-xl border-border rounded-lg" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search account..." className="h-9 text-xs font-medium" />
                                        <CommandList className="max-h-[220px]">
                                            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No accounts found.</CommandEmpty>
                                            <CommandGroup>
                                                <CommandItem onSelect={() => { setCoaFilter("All"); setIsCoaComboOpen(false); }} className="text-[10px] font-black uppercase text-muted-foreground cursor-pointer py-1.5">-- Clear Selection --</CommandItem>
                                                {coas.map((c) => (
                                                    <CommandItem key={c.coaId} value={`${c.glCode} ${c.accountTitle}`} onSelect={() => { setCoaFilter(String(c.coaId)); setIsCoaComboOpen(false); }} className="text-xs font-bold uppercase cursor-pointer py-1.5">
                                                        <Check className={cn("mr-2 h-3.5 w-3.5 text-primary", coaFilter === String(c.coaId) ? "opacity-100" : "opacity-0")} />
                                                        <span className="text-[10px] text-muted-foreground mr-1.5">{c.glCode}</span> {c.accountTitle}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Date Preset Ranges */}
                        <div className="space-y-1.5 col-span-1 md:col-span-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">Date Presets</Label>
                            <div className="flex flex-wrap gap-1.5">
                                <Button variant="outline" size="sm" onClick={() => handleDatePreset("thisMonth")} className="h-7 text-[9px] font-black uppercase px-2.5 rounded-md">This Month</Button>
                                <Button variant="outline" size="sm" onClick={() => handleDatePreset("lastMonth")} className="h-7 text-[9px] font-black uppercase px-2.5 rounded-md">Last Month</Button>
                                <Button variant="outline" size="sm" onClick={() => handleDatePreset("thisQuarter")} className="h-7 text-[9px] font-black uppercase px-2.5 rounded-md">This Quarter</Button>
                                <Button variant="outline" size="sm" onClick={() => handleDatePreset("thisYear")} className="h-7 text-[9px] font-black uppercase px-2.5 rounded-md">This Year</Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDatePreset("clear")} className="h-7 text-[9px] font-black text-rose-500 uppercase px-2 rounded-md">Reset Range</Button>
                            </div>
                        </div>

                        {/* Transaction Date Inputs */}
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">Custom Date Range</Label>
                            <div className="flex items-center gap-2">
                                <Input type="date" className="h-9 text-xs font-bold uppercase bg-background border-border/50 shadow-sm flex-1 px-2.5 rounded-lg" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                <span className="text-[9px] font-black text-muted-foreground/50 uppercase">TO</span>
                                <Input type="date" className="h-9 text-xs font-bold uppercase bg-background border-border/50 shadow-sm flex-1 px-2.5 rounded-lg" value={endDate} onChange={e => setEndDate(e.target.value)} />
                            </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">Approval Status</Label>
                            <select className="h-9 w-full rounded-lg border border-border/50 bg-background px-3 text-xs font-bold uppercase text-foreground shadow-sm focus:ring-1 focus:ring-primary/30 outline-none cursor-pointer" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                                <option value="All">All Statuses</option>
                                <option value="Draft">Draft</option>
                                <option value="Submitted">Submitted</option>
                                <option value="Approved">Approved</option>
                                <option value="Released">Released</option>
                                <option value="Posted">Posted</option>
                                <option value="Returned for Revision">Returned</option>
                            </select>
                        </div>

                        {/* Voucher Type */}
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">Voucher Type</Label>
                            <select className="h-9 w-full rounded-lg border border-border/50 bg-background px-3 text-xs font-bold uppercase text-foreground shadow-sm focus:ring-1 focus:ring-primary/30 outline-none cursor-pointer" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                                <option value="All">All Types</option>
                                <option value="Trade">Trade</option>
                                <option value="Non-Trade">Non-Trade</option>
                            </select>
                        </div>

                        {/* Division */}
                        <div className="space-y-1.5 flex flex-col justify-end">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">Cost Division</Label>
                            <SearchSelect
                                options={divisions.map(d => ({ label: d.divisionName || "N/A", value: d.divisionId }))}
                                value={divisionFilter !== "" ? Number(divisionFilter) : ""}
                                onSelect={val => setDivisionFilter(String(val))}
                                placeholder="All Divisions"
                                className="h-9 text-xs font-bold bg-background border-border/50 rounded-lg shadow-sm"
                            />
                        </div>

                        {/* Department */}
                        <div className="space-y-1.5 flex flex-col justify-end">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">Cost Department</Label>
                            <SearchSelect
                                options={departments.map(d => ({ label: d.departmentName || "N/A", value: d.departmentId }))}
                                value={departmentFilter !== "" ? Number(departmentFilter) : ""}
                                onSelect={val => setDepartmentFilter(String(val))}
                                placeholder="All Departments"
                                className="h-9 text-xs font-bold bg-background border-border/50 rounded-lg shadow-sm"
                            />
                        </div>

                        {/* Min / Max Amount */}
                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">Minimum Amount (PHP)</Label>
                            <Input type="number" min={0} placeholder="Min Amount" value={minAmount} onChange={e => setMinAmount(e.target.value === "" ? "" : Number(e.target.value))} className="h-9 text-xs font-bold bg-background border-border/50 rounded-lg" />
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">Maximum Amount (PHP)</Label>
                            <Input type="number" min={0} placeholder="Max Amount" value={maxAmount} onChange={e => setMaxAmount(e.target.value === "" ? "" : Number(e.target.value))} className="h-9 text-xs font-bold bg-background border-border/50 rounded-lg" />
                        </div>

                        {/* Wildcard Remarks */}
                        <div className="space-y-1.5 col-span-1 md:col-span-2">
                            <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/85">Wildcard Remarks Search</Label>
                            <Input placeholder="Type key phrase inside remarks..." value={remarksSearch} onChange={e => setRemarksSearch(e.target.value)} className="h-9 text-xs font-bold bg-background border-border/50 rounded-lg" />
                        </div>
                    </div>
                )}
            </div>

            {/* 📊 GRID VIEWS */}
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Disbursement Headers
                    </div>
                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                        Showing {vouchers.length} Records
                    </div>
                </div>

                <div className="bg-card border border-border shadow-sm rounded-xl overflow-hidden min-h-[400px] flex flex-col justify-between">
                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24">
                            <RefreshCw className="w-8 h-8 text-primary animate-spin" />
                            <span className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Loading registry files...</span>
                        </div>
                    ) : vouchers.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
                            <HelpCircle className="w-10 h-10 text-muted-foreground/45" />
                            <span className="text-xs font-black uppercase tracking-widest">No ledger records found matching filters</span>
                        </div>
                    ) : (
                        /* VOUCHER HEADER LIST */
                        <StickyTableWrapper className="max-h-[640px]">
                            <Table>
                                <TableHeader className="bg-muted/80 backdrop-blur-md sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                                    <TableRow className="hover:bg-transparent border-b border-border/80">
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground pl-6 w-[120px]">Date</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground w-[130px]">Doc No</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground min-w-[220px]">Payee</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right w-[150px]">Payable Amount</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right w-[150px]">Paid Amount</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-right w-[130px]">Variance</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground text-center w-[120px]">Status</TableHead>
                                        <TableHead className="text-[9px] font-black uppercase tracking-widest text-muted-foreground min-w-[220px] pr-6">Remarks</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {vouchers.map((v) => {
                                        const variance = Math.max(0, (v.totalAmount || 0) - (v.paidAmount || 0));
                                        return (
                                            <TableRow
                                                key={v.id}
                                                onClick={() => handleRowClick(v)}
                                                className="cursor-pointer group hover:bg-muted/40 transition-colors border-b border-border/40"
                                            >
                                                <TableCell className="text-xs font-bold text-foreground">
                                                    {v.transactionDate ? new Date(v.transactionDate).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" }) : "N/A"}
                                                </TableCell>
                                                <TableCell className="text-xs font-black uppercase text-foreground group-hover:text-primary transition-colors">
                                                    {v.docNo}
                                                </TableCell>
                                                <TableCell className="text-xs font-bold uppercase text-foreground max-w-[220px] truncate">
                                                    {v.payeeName || "N/A"}
                                                </TableCell>
                                                <TableCell className="text-xs font-black text-right text-foreground">
                                                    {formatCurrency(v.totalAmount)}
                                                </TableCell>
                                                <TableCell className="text-xs font-black text-right text-foreground">
                                                    {formatCurrency(v.paidAmount)}
                                                </TableCell>
                                                <TableCell className={cn(
                                                    "text-xs font-black text-right",
                                                    variance > 0 ? "text-amber-500" : "text-muted-foreground"
                                                )}>
                                                    {formatCurrency(variance)}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <Badge className={cn("px-2 py-0.5 text-[8px] font-black uppercase tracking-wider border", getStatusColor(v.status))}>
                                                        {v.status}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs font-medium text-muted-foreground truncate max-w-[200px] pr-6">
                                                    {v.remarks || "-"}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </StickyTableWrapper>
                    )}

                    {/* Pagination */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-border/50 bg-card/95 backdrop-blur-md sticky bottom-0 z-10">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Rows per page:</span>
                            <select 
                                className="h-8 rounded-lg border border-border/50 bg-background px-2.5 text-[10px] font-black uppercase text-foreground shadow-sm focus:ring-1 focus:ring-primary/30 outline-none cursor-pointer"
                                value={size}
                                onChange={(e) => {
                                    setSize(Number(e.target.value));
                                    setPage(0);
                                }}
                            >
                                <option value={10}>10 rows</option>
                                <option value={20}>20 rows</option>
                                <option value={50}>50 rows</option>
                                <option value={100}>100 rows</option>
                            </select>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest border-border/50"
                                disabled={page === 0 || loading}
                                onClick={() => setPage(p => p - 1)}
                            >
                                Previous
                            </Button>
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-3 py-1 rounded-full bg-muted/50 border border-border/30">
                                Page {page + 1} of {totalPages || 1}
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest border-border/50"
                                disabled={page >= totalPages - 1 || loading || totalPages === 0}
                                onClick={() => setPage(p => p + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* GLOBAL DETAIL VIEW SHEET */}
            <DisbursementViewSheet
                open={isViewOpen}
                onOpenChange={setIsViewOpen}
                disbursement={selectedDisbursement}
                onUpdateStatus={async (id, status) => {
                    try {
                        await disbursementProvider.updateStatus(id, status);
                        toast.success(`Status updated to ${status}`);
                        fetchLedger();
                        return true;
                    } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : "Status update failed";
                        toast.error(msg);
                        return false;
                    }
                }}
                onEdit={() => {}} // Read-only from Ledger submodule, edit not permitted
                loading={false}
                readOnly={true}
            />
        </div>
    );
}
