"use client";

import React from "react";
import { format } from "date-fns";
import { RefreshCcw, BarChart3, X, User, CreditCard, Tag, Search } from "lucide-react";
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
import { useCollectionOverview } from "../providers/CollectionOverviewProvider";

export const OverviewHeader = () => {
    const {
        dateRange, setDateRange,
        filters, setFilters, salesmen, paymentMethods,
        fetchData, isLoading,
    } = useCollectionOverview();

    const activeFilters = [filters.salesman, filters.isPosted, filters.paymentMethod, filters.docNo].filter(Boolean);

    const clearFilters = () => setFilters({ salesman: "", type: "", isPosted: "", paymentMethod: "", docNo: "" });

    const paymentMethodOptions = [
        { value: "all", label: "All Payment Methods" },
        ...paymentMethods.map(m => ({ value: m, label: m }))
    ];

    const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.value) {
            setDateRange(dateRange ? { ...dateRange, from: undefined } : { from: undefined, to: undefined });
            return;
        }
        const [year, month, day] = e.target.value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        setDateRange(dateRange ? { ...dateRange, from: date } : { from: date, to: undefined });
    };

    const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.value) {
            setDateRange(dateRange ? { ...dateRange, to: undefined } : { from: undefined, to: undefined });
            return;
        }
        const [year, month, day] = e.target.value.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        setDateRange(dateRange ? { ...dateRange, to: date } : { from: undefined, to: date });
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Title Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-primary" />
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Collection Overview</h1>
                        <p className="text-xs text-muted-foreground">Range Summary · Treasury Report</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {activeFilters.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 px-3 text-xs gap-1 text-muted-foreground"
                            onClick={clearFilters}
                        >
                            <X className="w-3.5 h-3.5" /> Clear filters
                        </Button>
                    )}
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

                {/* Custom Date Range Component */}
                <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium text-foreground">Date Range</label>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <input
                                type="date"
                                className="flex h-9 w-[135px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]"
                                value={dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : ""}
                                onChange={handleFromChange}
                            />
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">to</span>
                        <div className="relative">
                            <input
                                type="date"
                                className="flex h-9 w-[135px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 [color-scheme:light] dark:[color-scheme:dark]"
                                value={dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : ""}
                                onChange={handleToChange}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5 w-[200px]">
                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                        <User className="w-3 h-3 text-muted-foreground" /> Salesman
                    </label>
                    <SearchableSelect
                        options={[
                            { value: "all", label: "All Salesmen" },
                            ...salesmen.map(s => ({ value: s, label: s }))
                        ]}
                        value={filters.salesman || "all"}
                        onValueChange={(v) => setFilters({ ...filters, salesman: v === "all" ? "" : v })}
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
                            <SelectValue placeholder="All Status" />
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
