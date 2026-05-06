"use client";

import React, { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { RefreshCcw, BarChart3, User, CreditCard, X, Tag, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useDailyCollectionReport } from "../hooks/useDailyCollectionReport";
import { fetchProvider } from "../providers/fetchProvider";
import { Salesman } from "../types";
import { generateDailyCollectionPDF } from "../utils/pdf-generator";

export const CollectionHeader = () => {
    const { dateRange, setDateRange, fetchData, isLoading, filters, setFilters, paymentMethods, reportData, stats, detailedPaymentMethodData } = useDailyCollectionReport();
    const [salesmen, setSalesmen] = useState<Salesman[]>([]);

    useEffect(() => {
        fetchProvider.get<Salesman[]>("/api/fm/treasury/salesmen")
            .then((res) => {
                if (!res) {
                    setSalesmen([]);
                    return;
                }
                setSalesmen(Array.isArray(res) ? res : (res as unknown as { data?: Salesman[] })?.data || []);
            })
            .catch(() => {});
    }, []);

    const salesmanOptions = useMemo(() => {
        const seen = new Set<string>();
        const opts: { value: string; label: string }[] = [];
        salesmen.forEach((s) => {
            const name = s.fullname || s.name || s.salesmanName || (s.firstName ? `${s.firstName} ${s.lastName}` : String(s.id));
            if (!seen.has(name)) { seen.add(name); opts.push({ value: name, label: name }); }
        });
        return [{ value: "all", label: "All Salesmen" }, ...opts];
    }, [salesmen]);


    const paymentMethodOptions = useMemo(() => {
        return [
            { value: "all", label: "All Payment Methods" },
            ...paymentMethods.map((t: string) => ({ value: t, label: t }))
        ];
    }, [paymentMethods]);

    const activeFilters = [filters.salesman, filters.isPosted, filters.paymentMethod, filters.docNo].filter(Boolean);
    const clearFilters = () => setFilters({ salesman: "", type: "", isPosted: "", paymentMethod: "", docNo: "" });

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.value) {
            setDateRange({ from: undefined, to: undefined });
            return;
        }
        // Sync both from and to dates internally to support the backend range fetch
        const [year, month, day] = e.target.value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        setDateRange({ from: date, to: date });
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Title Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Daily Collection</h1>
                        <p className="text-xs text-muted-foreground">Daily Summary · Treasury Report</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {activeFilters.length > 0 && (
                        <Button
                            variant="ghost" size="sm"
                            className="h-9 px-3 text-xs gap-1 text-muted-foreground"
                            onClick={clearFilters}
                        >
                            <X className="w-3.5 h-3.5" /> Clear filters
                        </Button>
                    )}
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            if (reportData.length === 0) {
                                toast.error("No collection data found to print.");
                                return;
                            }
                            generateDailyCollectionPDF(reportData, stats, dateRange, filters, detailedPaymentMethodData);
                        }}
                        disabled={isLoading}
                        className="gap-2 h-9 border-primary/30 hover:border-primary/60 hover:bg-primary/10 active:scale-95 transition-all"
                    >
                        <Printer className="w-4 h-4 text-primary" />
                        <span className="font-medium">Print Report</span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={fetchData}
                        disabled={isLoading}
                        className="gap-2 h-9"
                    >
                        <RefreshCcw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
                        Refresh Data
                    </Button>
                </div>
            </div>

            <Separator />

            {/* Inline Form Filters */}
            <div className="flex flex-wrap items-end gap-x-6 gap-y-4 bg-muted/30 border rounded-xl p-4">
                
                <div className="flex flex-col gap-1.5 w-[200px]">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Search className="w-3 h-3 text-muted-foreground" /> Search Doc No
                    </label>
                    <Input
                        placeholder="Search Doc No..."
                        value={filters.docNo}
                        onChange={(e) => setFilters({ ...filters, docNo: e.target.value })}
                        className="h-9 text-xs w-full"
                    />
                </div>

                {/* Single Date Component */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Date</label>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <input
                                type="date"
                                className="flex h-9 w-[135px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]"
                                value={dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""}
                                onChange={handleDateChange}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 w-[200px]">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <User className="w-3 h-3 text-muted-foreground" /> Salesman
                    </label>
                    <SearchableSelect
                        options={salesmanOptions}
                        value={filters.salesman || "all"}
                        onValueChange={(val) => setFilters({ ...filters, salesman: val === "all" ? "" : val })}
                        placeholder="All Salesmen"
                        className="h-9 text-xs w-full overflow-hidden text-ellipsis whitespace-nowrap"
                    />
                </div>

                <div className="flex flex-col gap-1.5 w-[200px]">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <CreditCard className="w-3 h-3 text-muted-foreground" /> Payment Method
                    </label>
                    <Select
                        value={filters.paymentMethod || "all"}
                        onValueChange={(val) => setFilters({ ...filters, paymentMethod: val === "all" ? "" : val })}
                    >
                        <SelectTrigger className="h-9 text-xs w-full">
                            <SelectValue placeholder="All Payment Methods" />
                        </SelectTrigger>
                        <SelectContent>
                            {paymentMethodOptions.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col gap-1.5 w-[200px]">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <Tag className="w-3 h-3 text-muted-foreground" /> Status
                    </label>
                    <Select
                        value={filters.isPosted || "all"}
                        onValueChange={(v) => setFilters({ ...filters, isPosted: v === "all" ? "" : v })}
                    >
                        <SelectTrigger className="h-9 text-xs w-full">
                            <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="1">Posted</SelectItem>
                            <SelectItem value="0">Pending</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
};
