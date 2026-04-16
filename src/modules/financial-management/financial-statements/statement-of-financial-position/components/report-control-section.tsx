"use client";

import { useState, useMemo } from "react";
import { useBalanceSheet } from "../hooks/useBalanceSheet";
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
import { Filter, CalendarIcon, CheckCircle2, AlertTriangle, Download, FileSpreadsheet, Lock } from "lucide-react";
import { ValidationStatus, KeyRatios } from "../types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CertificationModal } from "./CertificationModal";

interface Props {
    validation: ValidationStatus;
    ratios: KeyRatios;
}

export function ReportControlSection({ validation, ratios }: Props) {
    const isBalanced = validation.isBalanced;
    const { refresh, resetFilters, isLoading, filters, setFilters } = useBalanceSheet();
    const [isCertifyModalOpen, setIsCertifyModalOpen] = useState(false);

    const updateFilter = (updates: Partial<typeof filters>) => {
        setFilters(prev => ({ ...prev, ...updates }));
    };

    const handleBasisChange = (basis: typeof filters.dataBasis) => {
        const today = new Date();
        const year = today.getFullYear();
        let startDate = filters.startDate;
        let endDate = filters.endDate;

        if (basis === "as-of") {
            startDate = `${year}-01-01`;
            endDate = today.toISOString().split("T")[0];
        } else if (basis === "annually") {
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

        const newFilters: Partial<typeof filters> = { dataBasis: basis, startDate, endDate };
        
        // If comparison is set to match, sync comparison dates too
        if (filters.comparisonBasis === "match") {
            const priorYear = parseInt(startDate.split("-")[0]) - 1;
            newFilters.comparisonStartDate = startDate.replace(startDate.split("-")[0], String(priorYear));
            newFilters.comparisonEndDate = endDate.replace(endDate.split("-")[0], String(priorYear));
        }

        updateFilter(newFilters);
    };

    const handleComparisonBasisChange = (basis: typeof filters.comparisonBasis) => {
        let updates: Partial<typeof filters> = { comparisonBasis: basis };
        
        if (basis === "match") {
            const yearStr = filters.startDate.split("-")[0];
            const priorYear = parseInt(yearStr) - 1;
            updates.comparisonStartDate = filters.startDate.replace(yearStr, String(priorYear));
            updates.comparisonEndDate = filters.endDate.replace(yearStr, String(priorYear));
        }
        
        updateFilter(updates);
    };

    const formatVariance = (variance: number) => {
        if (variance > 0) return `+${variance.toFixed(2)}`;
        return variance.toFixed(2);
    };

    const RatioItem = ({ title, subtitle, value, priorValue, variance }: { title: string; subtitle: string; value: number; priorValue: number; variance: number }) => {
        const isPositive = variance > 0;
        const isNegative = variance < 0;
        const isNeutral = variance === 0;

        return (
            <div className="flex flex-col gap-1">
                <span className="text-sm font-bold tracking-tight">{title}</span>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{subtitle}</span>
                <span className="text-2xl font-bold tracking-tight text-primary mt-1">
                    {value.toFixed(2)}x
                </span>
                <span
                    className={cn("text-xs font-bold flex items-center gap-1 transition-colors", {
                        "text-success": isPositive,
                        "text-destructive": isNegative,
                        "text-muted-foreground": isNeutral,
                    })}
                >
                    {isPositive ? "↑" : isNegative ? "↓" : "→"} vs prior {priorValue.toFixed(2)}x ({formatVariance(variance)}x)
                </span>
            </div>
        );
    };

    return (
        <Card className="shadow-none border border-border overflow-hidden bg-card">
            <CardContent className="p-0">
                {/* ─── ROW 1: Module Name + Action Buttons (full width) ─── */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 lg:px-8 bg-card transition-colors">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-bold">Business Analytics / Financial Management</p>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Statement of Financial Position</h2>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[700px] leading-relaxed">
                            Dynamic balance sheet prototype with period selection, comparison view, validation checks, managerial certification, and account-level drill-down.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {false && (
                            <Badge variant="secondary" className="rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider">
                                Validated
                            </Badge>
                        )}
                        <Button 
                            variant="ghost" 
                            className="rounded-lg shadow-sm h-9 px-4 text-xs font-bold bg-zinc-950 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                            onClick={() => toast.info("Feature is coming soon")}
                        >
                            <Download className="w-3.5 h-3.5 mr-2" />
                            Export PDF
                        </Button>
                        <Button 
                            variant="ghost" 
                            className="rounded-lg shadow-sm h-9 px-4 text-xs font-bold bg-zinc-950 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                            onClick={() => toast.info("Feature is coming soon")}
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />
                            Export Excel
                        </Button>
                        {false && (
                            <Button 
                                variant="default" 
                                className="rounded-lg shadow-sm h-9 px-4 text-xs font-bold"
                                onClick={() => setIsCertifyModalOpen(true)}
                            >
                                <Lock className="w-3.5 h-3.5 mr-2" />
                                Certify Statement
                            </Button>
                        )}
                    </div>
                </div>

                <Separator />

                {/* ─── ROW 2: Two-column Grid (lg and up) ─── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

                    {/* ── LEFT: Filters ── */}
                    <div className="p-5 sm:p-6 lg:px-8 flex flex-col justify-between gap-8 bg-card">
                        <div>
                            <div className="text-xs font-bold flex items-center gap-2 mb-6 uppercase tracking-wider text-muted-foreground">
                                <Filter className="w-3.5 h-3.5" />
                                Report Initialization
                            </div>

                            <div className="space-y-6">
                                {/* Date Selection */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold text-foreground">Date Selection</Label>
                                        <Select value={filters.dataBasis} onValueChange={handleBasisChange}>
                                            <SelectTrigger className="w-full sm:w-[280px] h-9 text-xs font-bold border-input bg-card">
                                                <SelectValue placeholder="Select basis..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="as-of">As of Date</SelectItem>
                                                <SelectItem value="manual">Manual Date Range</SelectItem>
                                                <SelectItem value="monthly">Monthly</SelectItem>
                                                <SelectItem value="quarterly">Quarterly</SelectItem>
                                                <SelectItem value="annually">Annually</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Conditional Sub-inputs for Data Selection */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {filters.dataBasis === "manual" && (
                                            <>
                                                <div className="relative w-full sm:w-[150px]">
                                                    <Input 
                                                        type="date"
                                                        value={filters.startDate} 
                                                        onChange={(e) => updateFilter({ startDate: e.target.value })}
                                                        className="h-9 text-xs font-medium border-input bg-card" 
                                                    />
                                                </div>
                                                <div className="relative w-full sm:w-[150px]">
                                                    <Input 
                                                        type="date"
                                                        value={filters.endDate} 
                                                        onChange={(e) => updateFilter({ endDate: e.target.value })}
                                                        className="h-9 text-xs font-medium border-input bg-card" 
                                                    />
                                                </div>
                                            </>
                                        )}

                                        {filters.dataBasis === "as-of" && (
                                            <div className="relative w-full sm:w-[220px]">
                                                <Input 
                                                    type="date"
                                                    value={filters.endDate} 
                                                    onChange={(e) => updateFilter({ endDate: e.target.value })}
                                                    className="h-9 text-xs font-medium border-input bg-card" 
                                                />
                                            </div>
                                        )}

                                        {filters.dataBasis === "monthly" && (
                                            <>
                                                <Select 
                                                    value={filters.endDate.split("-")[1]} 
                                                    onValueChange={(val) => {
                                                        const year = filters.endDate.split("-")[0];
                                                        const lastDay = new Date(parseInt(year), parseInt(val), 0).getDate();
                                                        updateFilter({ 
                                                            startDate: `${year}-${val}-01`,
                                                            endDate: `${year}-${val}-${lastDay}` 
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[120px] h-9 text-xs font-medium border-input bg-card">
                                                        <SelectValue placeholder="Month" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(m => (
                                                            <SelectItem key={m} value={m}>
                                                                {new Date(2000, parseInt(m)-1).toLocaleString('default', { month: 'long' })}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Select 
                                                    value={filters.endDate.split("-")[0]} 
                                                    onValueChange={(val) => {
                                                        const month = filters.endDate.split("-")[1];
                                                        const lastDay = new Date(parseInt(val), parseInt(month), 0).getDate();
                                                        updateFilter({ 
                                                            startDate: `${val}-${month}-01`,
                                                            endDate: `${val}-${month}-${lastDay}` 
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[100px] h-9 text-xs font-medium border-input bg-card">
                                                        <SelectValue placeholder="Year" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {["2024", "2025", "2026", "2027"].map(y => (
                                                            <SelectItem key={y} value={y}>{y}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </>
                                        )}

                                        {filters.dataBasis === "quarterly" && (
                                            <>
                                                <Select 
                                                    value={`q${Math.ceil(parseInt(filters.endDate.split("-")[1])/3)}`}
                                                    onValueChange={(val) => {
                                                        const q = parseInt(val.charAt(1));
                                                        const year = filters.endDate.split("-")[0];
                                                        const startMonth = String((q - 1) * 3 + 1).padStart(2, "0");
                                                        const endMonth = String(q * 3).padStart(2, "0");
                                                        const lastDay = new Date(parseInt(year), q * 3, 0).getDate();
                                                        updateFilter({
                                                            startDate: `${year}-${startMonth}-01`,
                                                            endDate: `${year}-${endMonth}-${lastDay}`
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[140px] h-9 text-xs font-medium border-input bg-card">
                                                        <SelectValue placeholder="Quarter" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="q1">1st Quarter</SelectItem>
                                                        <SelectItem value="q2">2nd Quarter</SelectItem>
                                                        <SelectItem value="q3">3rd Quarter</SelectItem>
                                                        <SelectItem value="q4">4th Quarter</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <Select 
                                                    value={filters.endDate.split("-")[0]}
                                                    onValueChange={(val) => {
                                                        const startMonth = filters.startDate.split("-")[1];
                                                        const endMonth = filters.endDate.split("-")[1];
                                                        const lastDay = new Date(parseInt(val), parseInt(endMonth), 0).getDate();
                                                        updateFilter({
                                                            startDate: `${val}-${startMonth}-01`,
                                                            endDate: `${val}-${endMonth}-${lastDay}`
                                                        });
                                                    }}
                                                >
                                                    <SelectTrigger className="w-[100px] h-9 text-xs font-medium border-input bg-card">
                                                        <SelectValue placeholder="Year" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {["2024", "2025", "2026", "2027"].map(y => (
                                                            <SelectItem key={y} value={y}>{y}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </>
                                        )}

                                        {filters.dataBasis === "annually" && (
                                            <Select 
                                                value={filters.endDate.split("-")[0]}
                                                onValueChange={(val) => updateFilter({ 
                                                    startDate: `${val}-01-01`, 
                                                    endDate: `${val}-12-31` 
                                                })}
                                            >
                                                <SelectTrigger className="w-[120px] h-9 text-xs font-medium border-input bg-card">
                                                    <SelectValue placeholder="Year" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {["2024", "2025", "2026", "2027"].map(y => (
                                                        <SelectItem key={y} value={y}>{y}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}
                                    </div>
                                </div>

                                {/* Division */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-foreground">Division</Label>
                                    <Select value={filters.divisionName || "all"} onValueChange={(val) => updateFilter({ divisionName: val === "all" ? "" : val })}>
                                        <SelectTrigger className="w-full sm:w-[220px] h-9 text-xs font-medium border-input">
                                            <SelectValue placeholder="All Divisions" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Divisions</SelectItem>
                                            <SelectItem value="Main Office">Main Office</SelectItem>
                                            <SelectItem value="Branch A">Branch A</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Department */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-foreground">Department</Label>
                                    <Select value={filters.departmentName || "all"} onValueChange={(val) => updateFilter({ departmentName: val === "all" ? "" : val })}>
                                        <SelectTrigger className="w-full sm:w-[150px] h-9 text-xs font-medium border-input">
                                            <SelectValue placeholder="All Departments" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Departments</SelectItem>
                                            <SelectItem value="Finance">Finance</SelectItem>
                                            <SelectItem value="Operations">Operations</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Comparison Toggle */}
                                <div className="flex items-center gap-2 pt-2">
                                    <Checkbox
                                        id="comparison"
                                        checked={filters.includeComparison}
                                        onCheckedChange={(checked) => updateFilter({ includeComparison: !!checked })}
                                        className="h-4 w-4 rounded border-input data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary"
                                    />
                                    <Label
                                        htmlFor="comparison"
                                        className={cn(
                                            "text-xs font-bold cursor-pointer transition-colors",
                                            filters.includeComparison ? "text-primary font-bold" : "text-muted-foreground"
                                        )}
                                    >
                                        Enable comparison
                                    </Label>
                                </div>

                                {filters.includeComparison ? (
                                    <div className="space-y-4 p-4 bg-muted/20 border border-border rounded-lg animate-in fade-in slide-in-from-top-2 duration-300">
                                        {/* Comparison Period Basis Selector */}
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Comparison Period</Label>
                                            <Select value={filters.comparisonBasis} onValueChange={handleComparisonBasisChange}>
                                                <SelectTrigger className="w-full sm:w-[280px] h-9 text-xs font-bold border-input bg-card">
                                                    <SelectValue placeholder="Select basis..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="match">Match Current Date Selection (Prior Year)</SelectItem>
                                                    <SelectItem value="as-of">As of Date</SelectItem>
                                                    <SelectItem value="manual">Manual Date Range</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Conditional Sub-inputs based on selection */}
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {filters.comparisonBasis === "manual" && (
                                                <>
                                                    <div className="relative w-full sm:w-[150px]">
                                                        <Input 
                                                            type="date"
                                                            value={filters.comparisonStartDate} 
                                                            onChange={(e) => updateFilter({ comparisonStartDate: e.target.value })}
                                                            className="h-9 text-xs font-medium border-input bg-card" 
                                                        />
                                                    </div>
                                                    <div className="relative w-full sm:w-[150px]">
                                                        <Input 
                                                            type="date"
                                                            value={filters.comparisonEndDate} 
                                                            onChange={(e) => updateFilter({ comparisonEndDate: e.target.value })}
                                                            className="h-9 text-xs font-medium border-input bg-card" 
                                                        />
                                                    </div>
                                                </>
                                            )}

                                            {filters.comparisonBasis === "as-of" && (
                                                <div className="relative w-full sm:w-[220px]">
                                                    <Input 
                                                        type="date"
                                                        value={filters.comparisonEndDate} 
                                                        onChange={(e) => updateFilter({ comparisonEndDate: e.target.value })}
                                                        className="h-9 text-xs font-medium border-input bg-card" 
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground leading-relaxed p-4 bg-muted/10 border border-border rounded-lg mt-2 transition-colors">
                                        Comparison is disabled. The report will show current-period balances only.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-3 pt-6 border-t border-border mt-2 mt-auto">
                            <Button variant="default" className="rounded-lg px-8 h-9 text-xs font-bold shadow-sm transition-all focus-visible:ring-primary/50" onClick={() => refresh()} disabled={isLoading}>
                                {isLoading ? "Loading..." : "Generate Report"}
                            </Button>
                            <Button variant="outline" className="rounded-lg px-8 h-9 text-xs font-bold border-input text-foreground hover:bg-accent transition-all" onClick={() => resetFilters()} disabled={isLoading}>
                                Clear Filters
                            </Button>
                        </div>
                    </div>

                    {/* ── RIGHT: Vertical Stack — Top: Equation | Bottom: Ratios ── */}
                    <div className="flex flex-col bg-card divide-y divide-border">
                        {/* Accounting Equation Check */}
                        <div className={cn("p-5 sm:p-6 lg:px-8 flex-none transition-colors", isBalanced ? "bg-success/5" : "bg-destructive/10")}>
                            <div className="flex gap-4 items-start">
                                {isBalanced ? (
                                    <CheckCircle2 className="w-5 h-5 text-success shrink-0 mt-0.5" />
                                ) : (
                                    <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                                )}
                                <div>
                                    <h4 className="font-bold text-sm tracking-tight text-foreground">Accounting Equation Check</h4>
                                    <p className="text-xs text-muted-foreground mt-1 mb-2 font-medium">
                                        Total Assets &ndash; (Total Liabilities + Equity) = {validation.variance < 0 ? "-" : ""}
                                        &#8369;{Math.abs(validation.variance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className={cn("text-xs font-bold uppercase tracking-wider", isBalanced ? "text-success" : "text-destructive")}>
                                        {isBalanced ? "Report is balanced and ready for review." : "The Financial Statement Generated is not Balanced."}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Key Ratios */}
                        <div className="p-5 sm:p-6 lg:px-8 flex-1 flex flex-col bg-card">
                            <h4 className="font-bold mb-8 text-xs uppercase tracking-widest text-muted-foreground">Key Ratios</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-12">
                                <RatioItem
                                    title="Current Ratio"
                                    subtitle="Current Assets / Current Liabilities"
                                    value={ratios.currentRatio.current}
                                    priorValue={ratios.currentRatio.prior}
                                    variance={ratios.currentRatio.variance}
                                />
                                <RatioItem
                                    title="Debt to Equity"
                                    subtitle="Total Liabilities / Total Equity"
                                    value={ratios.debtToEquity.current}
                                    priorValue={ratios.debtToEquity.prior}
                                    variance={ratios.debtToEquity.variance}
                                />
                                <RatioItem
                                    title="Quick Ratio"
                                    subtitle="(CA - Inventory) / CL"
                                    value={ratios.quickRatio.current}
                                    priorValue={ratios.quickRatio.prior}
                                    variance={ratios.quickRatio.variance}
                                />
                                <RatioItem
                                    title="Debt Ratio"
                                    subtitle="Total Liabilities / Total Assets"
                                    value={ratios.debtRatio.current}
                                    priorValue={ratios.debtRatio.prior}
                                    variance={ratios.debtRatio.variance}
                                />
                            </div>
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
