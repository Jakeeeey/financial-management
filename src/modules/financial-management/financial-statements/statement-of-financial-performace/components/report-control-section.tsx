"use client";

import { useState } from "react";
import { useFinancialPerformance } from "../hooks/useFinancialPerformance";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Filter, Download, FileSpreadsheet, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { CertificationModal } from "./CertificationModal";
import { exportToExcel, exportToPdf } from "../services/export.service";

export function ReportControlSection() {
    const { refresh, resetFilters, isLoading, isInitialLoad, filters, setFilters, data, validation } = useFinancialPerformance();
    const [isCertifyModalOpen, setIsCertifyModalOpen] = useState(false);

    const updateFilter = (updates: Partial<typeof filters>) => {
        setFilters(prev => ({ ...prev, ...updates }));
    };

    const handleBasisChange = (basis: typeof filters.dataBasis) => {
        const today = new Date();
        const year = today.getFullYear();
        let startDate = filters.startDate;
        let endDate = filters.endDate;

        if (basis === "annually") {
            startDate = `${year}-01-01`;
            endDate = `${year}-12-31`;
        } else if (basis === "monthly") {
            const month = String(today.getMonth() + 1).padStart(2, "0");
            startDate = `${year}-${month}-01`;
            const lastDay = new Date(year, today.getMonth() + 1, 0).getDate();
            endDate = `${year}-${month}-${lastDay}`;
        } else if (basis === "quarterly") {
            const quarter = Math.floor(today.getMonth() / 3) + 1;
            const startMonth = String((quarter - 1) * 3 + 1).padStart(2, "0");
            const endMonth = String(quarter * 3).padStart(2, "0");
            startDate = `${year}-${startMonth}-01`;
            const lastDay = new Date(year, quarter * 3, 0).getDate();
            endDate = `${year}-${endMonth}-${lastDay}`;
        }

        updateFilter({ dataBasis: basis, startDate, endDate });
    };

    const handleComparisonBasisChange = (basis: typeof filters.comparisonBasis) => {
        updateFilter({ comparisonBasis: basis });
    };

    const formatVariance = (variance: number) => {
        if (variance > 0) return `+${variance.toFixed(1)}`;
        return variance.toFixed(1);
    };

    const RatioItem = ({ title, subtitle, value, priorValue }: { title: string; subtitle: string; value?: number; priorValue?: number }) => {
        const current = value ?? 0;
        const prior = priorValue ?? 0;
        const variance = current - prior;
        
        const isPositive = current > prior;
        const isNegative = current < prior;
        const isNeutral = current === prior;

        return (
            <div className="flex flex-col gap-1 border border-border rounded-lg p-4 bg-card shadow-sm hover:shadow-md transition-all">
                <span className="text-[10px] font-bold tracking-tight uppercase text-muted-foreground">{title}</span>
                <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">{subtitle}</span>
                <div className="flex items-center justify-between mt-3">
                    <span className="text-2xl font-bold tracking-tight text-foreground">
                        {isInitialLoad ? "—" : `${current.toFixed(1)}%`}
                    </span>
                    {!isInitialLoad && (priorValue !== undefined || variance !== 0) && (
                        <div className="flex items-center gap-1.5">
                            {isPositive && <span className="text-foreground text-[10px]">▲</span>}
                            {isNegative && <span className="text-foreground text-[10px]">▼</span>}
                            <span
                                className={cn("text-[11px] font-bold px-2 py-0.5 rounded transition-colors", {
                                    "bg-success/10 text-success": isPositive,
                                    "bg-destructive/10 text-destructive": isNegative,
                                    "bg-muted text-muted-foreground": isNeutral,
                                })}
                            >
                                {Math.abs(variance).toFixed(1)}%
                            </span>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const getComparisonLabel = () => {
        if (!filters.includeComparison) return "";
        if (filters.comparisonBasis === "monthly") return `Past FS (${new Date(filters.comparisonStartDate).toLocaleString('default', { month: 'long' })} ${filters.comparisonStartDate.split("-")[0]})`;
        if (filters.comparisonBasis === "quarterly") {
             const startMonth = parseInt(filters.comparisonStartDate.split("-")[1]);
             const q = Math.ceil(startMonth / 3);
             return `Past FS (Q${q} ${filters.comparisonStartDate.split("-")[0]})`;
        }
        return `Past FS (${filters.comparisonStartDate.split("-")[0]})`;
    };

    const getDateRangeText = () => {
        try {
            const startStr = format(new Date(filters.startDate), "MMM d, yyyy");
            const endStr = format(new Date(filters.endDate), "MMM d, yyyy");
            return `${startStr} to ${endStr}`;
        } catch (e) {
            return `${filters.startDate} to ${filters.endDate}`;
        }
    };

    const handleExportPdf = () => {
        if (!data || isInitialLoad) {
            toast.error("Please generate a report first");
            return;
        }
        exportToPdf(
            data,
            getDateRangeText(),
            filters.includeComparison,
            getComparisonLabel(),
            filters.taxRate
        );
    };

    const handleExportExcel = () => {
        if (!data || isInitialLoad) {
            toast.error("Please generate a report first");
            return;
        }
        exportToExcel(
            data,
            getDateRangeText(),
            filters.includeComparison,
            getComparisonLabel(),
            filters.taxRate
        );
    };

    return (
        <Card className="shadow-none border border-border overflow-hidden bg-card mb-6">
            <CardContent className="p-0">
                {/* ─── ROW 1: Module Name + Action Buttons (full width) ─── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 lg:px-8 bg-card transition-colors shrink-0 min-h-0 min-w-0">
                    <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-bold truncate">Business Analytics / Financial Management</p>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground truncate">Statement of Financial Performance</h2>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[700px] leading-relaxed line-clamp-2 sm:line-clamp-none">
                            Dynamic income statement with period selection, comparison view, validation checks, and drill-down.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {false && (
                            <div className={cn(
                                "px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all shadow-sm",
                                validation.isCertified 
                                    ? "bg-success/20 text-success border-success/30 shadow-success/10" 
                                    : "bg-success/10 text-success border-success/20 shadow-success/5"
                            )}>
                                {validation.isCertified ? "Certified" : "Validated"}
                            </div>
                        )}
                        <Button 
                            variant="outline" 
                            className="rounded-xl shadow-sm h-9 px-4 text-xs font-bold"
                            onClick={handleExportPdf}
                            disabled={isInitialLoad || isLoading}
                        >
                            Export PDF
                        </Button>
                        <Button 
                            variant="outline" 
                            className="rounded-xl shadow-sm h-9 px-4 text-xs font-bold"
                            onClick={handleExportExcel}
                            disabled={isInitialLoad || isLoading}
                        >
                            Export Excel
                        </Button>
                        {false && (
                            <Button 
                                variant="default" 
                                className="rounded-xl shadow-sm h-9 px-6 text-xs font-bold"
                                onClick={() => setIsCertifyModalOpen(true)}
                                disabled={validation.isCertified}
                            >
                                Certify Statement
                            </Button>
                        )}
                    </div>
                </div>

                <Separator />

                {/* ─── ROW 2: Two-column Grid (lg and up) ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

                    {/* ── LEFT: Filters ── */}
                    <div className="p-5 sm:p-6 lg:px-8 flex flex-col justify-between gap-8 bg-card shrink-0 min-h-0 min-w-0 overflow-y-auto">
                        <div>
                            <div className="text-sm font-bold flex items-center gap-2 mb-6 tracking-tight text-foreground">
                                Report Initialization
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-6">
                                {/* Search */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Search</Label>
                                    <Input 
                                        type="text"
                                        placeholder="Search accounts or sections..."
                                        value={filters.searchQuery}
                                        onChange={(e) => updateFilter({ searchQuery: e.target.value })}
                                        className="h-10 text-sm border-input rounded-xl bg-card transition-all focus-visible:ring-1" 
                                    />
                                </div>
                                
                                {/* Date Basis */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date Basis</Label>
                                    <Select value={filters.dataBasis} onValueChange={handleBasisChange}>
                                        <SelectTrigger className="w-full h-10 text-sm border-input rounded-xl bg-card hover:bg-muted/50 transition-all">
                                            <SelectValue placeholder="Select basis..." />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="manual">Manual Date Range</SelectItem>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                            <SelectItem value="quarterly">Quarterly</SelectItem>
                                            <SelectItem value="annually">Annually</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Dynamic Fields based on Data Basis */}
                                {filters.dataBasis === "manual" && (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date From</Label>
                                            <Input 
                                                type="date"
                                                value={filters.startDate} 
                                                onChange={(e) => updateFilter({ startDate: e.target.value })}
                                                className="h-10 text-sm border-input rounded-xl bg-card" 
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date To</Label>
                                            <Input 
                                                type="date"
                                                value={filters.endDate} 
                                                onChange={(e) => updateFilter({ endDate: e.target.value })}
                                                className="h-10 text-sm border-input rounded-xl bg-card" 
                                            />
                                        </div>
                                    </>
                                )}

                                {filters.dataBasis === "monthly" && (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Month</Label>
                                            <Select 
                                                value={filters.startDate.split("-")[1] || "03"} 
                                                onValueChange={(val) => {
                                                    const year = filters.endDate.split("-")[0];
                                                    const lastDay = new Date(parseInt(year), parseInt(val), 0).getDate();
                                                    updateFilter({ 
                                                        startDate: `${year}-${val}-01`,
                                                        endDate: `${year}-${val}-${lastDay}` 
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="w-full h-10 text-sm border-input rounded-xl bg-card hover:bg-muted/50 transition-all">
                                                    <SelectValue placeholder="Month" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl max-h-[300px]">
                                                    {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(m => (
                                                        <SelectItem key={m} value={m}>
                                                            {new Date(2000, parseInt(m)-1).toLocaleString('default', { month: 'long' })}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Year</Label>
                                            <Select 
                                                value={filters.endDate.split("-")[0] || "2026"} 
                                                onValueChange={(val) => {
                                                    const month = filters.startDate.split("-")[1] || "01";
                                                    const lastDay = new Date(parseInt(val), parseInt(month), 0).getDate();
                                                    updateFilter({ 
                                                        startDate: `${val}-${month}-01`,
                                                        endDate: `${val}-${month}-${lastDay}` 
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="w-full h-10 text-sm border-input rounded-xl bg-card hover:bg-muted/50 transition-all">
                                                    <SelectValue placeholder="Year" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {["2024", "2025", "2026", "2027"].map(y => (
                                                        <SelectItem key={y} value={y}>{y}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                )}

                                {filters.dataBasis === "quarterly" && (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quarter</Label>
                                            <Select 
                                                value={`q${Math.ceil(parseInt(filters.endDate.split("-")[1] || "3")/3)}`}
                                                onValueChange={(val) => {
                                                    const q = parseInt(val.charAt(1));
                                                    const year = filters.endDate.split("-")[0] || new Date().getFullYear().toString();
                                                    const startMonth = String((q - 1) * 3 + 1).padStart(2, "0");
                                                    const endMonth = String(q * 3).padStart(2, "0");
                                                    const lastDay = new Date(parseInt(year), q * 3, 0).getDate();
                                                    updateFilter({
                                                        startDate: `${year}-${startMonth}-01`,
                                                        endDate: `${year}-${endMonth}-${lastDay}`
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="w-full h-10 text-sm border-input rounded-xl bg-card hover:bg-muted/50 transition-all">
                                                    <SelectValue placeholder="Quarter" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="q1">1st Quarter</SelectItem>
                                                    <SelectItem value="q2">2nd Quarter</SelectItem>
                                                    <SelectItem value="q3">3rd Quarter</SelectItem>
                                                    <SelectItem value="q4">4th Quarter</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Year</Label>
                                            <Select 
                                                value={filters.endDate.split("-")[0] || "2026"}
                                                onValueChange={(val) => {
                                                    const startMonth = filters.startDate.split("-")[1] || "01";
                                                    const endMonth = filters.endDate.split("-")[1] || "03";
                                                    const lastDay = new Date(parseInt(val), parseInt(endMonth), 0).getDate();
                                                    updateFilter({
                                                        startDate: `${val}-${startMonth}-01`,
                                                        endDate: `${val}-${endMonth}-${lastDay}`
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="w-full h-10 text-sm border-input rounded-xl bg-card hover:bg-muted/50 transition-all">
                                                    <SelectValue placeholder="Year" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {["2024", "2025", "2026", "2027"].map(y => (
                                                        <SelectItem key={y} value={y}>{y}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                )}

                                {filters.dataBasis === "annually" && (
                                    <div className="space-y-2 col-span-1 sm:col-span-2">
                                        <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Year</Label>
                                        <Select 
                                            value={filters.endDate.split("-")[0] || "2026"}
                                            onValueChange={(val) => updateFilter({ 
                                                startDate: `${val}-01-01`, 
                                                endDate: `${val}-12-31` 
                                            })}
                                        >
                                            <SelectTrigger className="w-full sm:w-1/2 h-10 text-sm border-input rounded-xl bg-card hover:bg-muted/50 transition-all">
                                                <SelectValue placeholder="Year" />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl">
                                                {["2024", "2025", "2026", "2027"].map(y => (
                                                    <SelectItem key={y} value={y}>{y}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Division */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Division</Label>
                                    <Select value={filters.divisionName || "all"} onValueChange={(val) => updateFilter({ divisionName: val === "all" ? "" : val })}>
                                        <SelectTrigger className="w-full h-10 text-sm border-input rounded-xl bg-card hover:bg-muted/50 transition-all">
                                            <SelectValue placeholder="All Divisions" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="all">All Divisions</SelectItem>
                                            <SelectItem value="North">North</SelectItem>
                                            <SelectItem value="South">South</SelectItem>
                                            <SelectItem value="Central">Central</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Department */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Department</Label>
                                    <Select value={filters.departmentName || "all"} onValueChange={(val) => updateFilter({ departmentName: val === "all" ? "" : val })}>
                                        <SelectTrigger className="w-full h-10 text-sm border-input rounded-xl bg-card hover:bg-muted/50 transition-all">
                                            <SelectValue placeholder="All Departments" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl">
                                            <SelectItem value="all">All Departments</SelectItem>
                                            <SelectItem value="Sales">Sales</SelectItem>
                                            <SelectItem value="Accounting">Accounting</SelectItem>
                                            <SelectItem value="Warehouse">Warehouse</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Tax Rate Settings */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tax Rate</Label>
                                    <div className="relative">
                                        <Input 
                                            type="number"
                                            value={filters.taxRate}
                                            onChange={(e) => updateFilter({ taxRate: Number(e.target.value) || 0 })}
                                            className="h-10 text-sm border-input rounded-xl bg-card pl-4 pr-8 transition-all focus-visible:ring-1" 
                                        />
                                        <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                                            <span className="text-muted-foreground text-sm font-medium">%</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Comparison Toggle */}
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comparison</Label>
                                    <div className="flex h-10 items-center justify-start rounded-xl border border-input bg-card px-4">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="comparison"
                                                checked={filters.includeComparison}
                                                onCheckedChange={(checked) => updateFilter({ includeComparison: !!checked })}
                                                className="h-5 w-5 rounded-md border-input data-[state=checked]:bg-red-500! data-[state=checked]:border-red-500! dark:data-[state=checked]:bg-red-500! transition-all shadow-sm"
                                            />
                                            <Label
                                                htmlFor="comparison"
                                                className={cn(
                                                    "text-sm cursor-pointer transition-colors pt-0.5",
                                                    filters.includeComparison ? "text-foreground font-medium" : "text-muted-foreground"
                                                )}
                                            >
                                                Include past FS comparison
                                            </Label>
                                        </div>
                                    </div>
                                </div>

                                {/* Conditional Comparison Sub-inputs */}
                                {filters.includeComparison && (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comparison Basis</Label>
                                            <Select value={filters.comparisonBasis} onValueChange={handleComparisonBasisChange}>
                                                <SelectTrigger className="w-full h-10 text-sm border-input rounded-xl bg-card hover:bg-muted/50 transition-all">
                                                    <SelectValue placeholder="Select basis..." />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    <SelectItem value="monthly">Monthly</SelectItem>
                                                    <SelectItem value="quarterly">Quarterly</SelectItem>
                                                    <SelectItem value="annually">Annually</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {filters.comparisonBasis === "monthly" && (
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comparison Month</Label>
                                                <Select 
                                                    value={filters.comparisonStartDate.split("-")[1] || "02"} 
                                                    onValueChange={(val) => {
                                                        const year = filters.comparisonStartDate.split("-")[0];
                                                        const lastDay = new Date(parseInt(year), parseInt(val), 0).getDate();
                                                        updateFilter({ 
                                                            comparisonStartDate: `${year}-${val}-01`,
                                                            comparisonEndDate: `${year}-${val}-${lastDay}` 
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full h-10 text-sm border-input rounded-xl bg-card hover:bg-muted/50 transition-all">
                                                        <SelectValue placeholder="Month" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl max-h-[300px]">
                                                        {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(m => (
                                                            <SelectItem key={m} value={m}>
                                                                {new Date(2000, parseInt(m)-1).toLocaleString('default', { month: 'long' })}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}
                                        
                                        {filters.comparisonBasis === "quarterly" && (
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comparison Quarter</Label>
                                                <Select 
                                                    value={`q${Math.ceil(parseInt(filters.comparisonEndDate.split("-")[1] || "3")/3)}`}
                                                    onValueChange={(val) => {
                                                        const q = parseInt(val.charAt(1));
                                                        const year = filters.comparisonEndDate.split("-")[0];
                                                        const startMonth = String((q - 1) * 3 + 1).padStart(2, "0");
                                                        const endMonth = String(q * 3).padStart(2, "0");
                                                        const lastDay = new Date(parseInt(year), q * 3, 0).getDate();
                                                        updateFilter({
                                                            comparisonStartDate: `${year}-${startMonth}-01`,
                                                            comparisonEndDate: `${year}-${endMonth}-${lastDay}`
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full h-10 text-sm border-input rounded-xl bg-card hover:bg-muted/50 transition-all">
                                                        <SelectValue placeholder="Quarter" />
                                                    </SelectTrigger>
                                                    <SelectContent className="rounded-xl">
                                                        <SelectItem value="q1">1st Quarter</SelectItem>
                                                        <SelectItem value="q2">2nd Quarter</SelectItem>
                                                        <SelectItem value="q3">3rd Quarter</SelectItem>
                                                        <SelectItem value="q4">4th Quarter</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        )}

                                        <div className="space-y-2">
                                            <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comparison Year</Label>
                                            <Select 
                                                value={filters.comparisonEndDate.split("-")[0] || "2025"} 
                                                onValueChange={(val) => {
                                                    const monthOrStart = filters.comparisonStartDate.split("-")[1] || "01";
                                                    const monthOrEnd = filters.comparisonEndDate.split("-")[1] || "12";
                                                    const lastDay = new Date(parseInt(val), parseInt(monthOrEnd), 0).getDate();
                                                    updateFilter({ 
                                                        comparisonStartDate: `${val}-${monthOrStart}-01`,
                                                        comparisonEndDate: `${val}-${monthOrEnd}-${lastDay}` 
                                                    });
                                                }}
                                            >
                                                <SelectTrigger className="w-full h-10 text-sm border-input rounded-xl bg-card hover:bg-muted/50 transition-all">
                                                    <SelectValue placeholder="Year" />
                                                </SelectTrigger>
                                                <SelectContent className="rounded-xl">
                                                    {["2024", "2025", "2026", "2027"].map(y => (
                                                        <SelectItem key={y} value={y}>{y}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-3 pt-6 mt-auto">
                            <Button variant="default" className="rounded-xl px-6 h-10 text-sm font-medium shadow-sm transition-all focus-visible:ring-primary/50" onClick={() => refresh()} disabled={isLoading}>
                                {isLoading ? "Loading..." : "Generate Report"}
                            </Button>
                            <Button variant="outline" className="rounded-xl px-6 h-10 text-sm font-medium border-input text-foreground hover:bg-accent transition-all" onClick={() => resetFilters()} disabled={isLoading}>
                                Clear
                            </Button>
                        </div>
                    </div>

                    {/* ── RIGHT: Key Ratios ── */}
                    <div className="p-5 sm:p-6 lg:px-8 flex flex-col bg-card shrink-0 min-h-0 min-w-0">
                        <h4 className="font-bold text-sm tracking-tight text-foreground mb-6">Key Ratios</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <RatioItem
                                title="Gross Profit Margin"
                                subtitle="Gross Profit ÷ Revenue"
                                value={data?.grossProfitMargin}
                                priorValue={data?.comparisonData?.grossProfitMargin}
                            />
                            <RatioItem
                                title="Operating Expense Ratio"
                                subtitle="Operating Expenses ÷ Revenue"
                                value={data?.operatingExpenseRatio}
                                priorValue={data?.comparisonData?.operatingExpenseRatio}
                            />
                            <RatioItem
                                title="Net Profit Margin"
                                subtitle="Net Income ÷ Revenue"
                                value={data?.netProfitMargin}
                                priorValue={data?.comparisonData?.netProfitMargin}
                            />
                            <RatioItem
                                title="Effective Tax Rate"
                                subtitle="Income Tax Expense ÷ Income Before Tax"
                                value={data?.effectiveTaxRate}
                                priorValue={data?.comparisonData?.effectiveTaxRate}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
            <CertificationModal 
                isOpen={isCertifyModalOpen} 
                onOpenChange={setIsCertifyModalOpen} 
            />
        </Card>
    );
}
