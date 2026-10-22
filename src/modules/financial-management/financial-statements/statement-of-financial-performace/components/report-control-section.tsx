"use client";

import { useEffect, useState } from "react";
import { useFinancialPerformance } from "../hooks/useFinancialPerformance";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ChevronDown, X } from "lucide-react";
import { CertificationModal } from "./CertificationModal";
import { exportToExcel, exportToPdf } from "../services/export.service";
import {
    formatFinancialPerformanceDateRange,
    getFinancialPerformanceComparisonLabel,
    getFinancialPerformancePeriodRange,
    getFinancialPerformanceToday,
    getFinancialPerformanceYears,
} from "../utils/periods";
import { getFinancialPerformanceAppliedFilterChips, toFinancialPerformanceReportCriteria } from "../utils/report-state";
import {
    describeFinancialPerformanceStatus,
    FINANCIAL_PERFORMANCE_SOURCE_MODULES,
} from "../utils/report-coverage";
import {
    getFinancialPerformanceDepartments,
    getFinancialPerformanceDivisions,
    type FinancialPerformanceDepartmentOption,
    type FinancialPerformanceDivisionOption,
} from "../services/financial-performance.service";

export function ReportControlSection() {
    const { refresh, resetFilters, removeAppliedFilter, isLoading, isInitialLoad, filters, updateFilters: updateFilter, data, validation, appliedCriteria, hasPendingChanges, periodError } = useFinancialPerformance();
    const [isCertifyModalOpen, setIsCertifyModalOpen] = useState(false);
    const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
    const [divisions, setDivisions] = useState<FinancialPerformanceDivisionOption[]>([]);
    const [departments, setDepartments] = useState<FinancialPerformanceDepartmentOption[]>([]);
    const [divisionLoading, setDivisionLoading] = useState(true);
    const [departmentLoading, setDepartmentLoading] = useState(true);
    const [divisionLoadError, setDivisionLoadError] = useState(false);
    const [departmentLoadError, setDepartmentLoadError] = useState(false);
    const [divisionRetry, setDivisionRetry] = useState(0);
    const [departmentRetry, setDepartmentRetry] = useState(0);

    useEffect(() => {
        let active = true;
        void getFinancialPerformanceDivisions()
            .then(options => { if (active) setDivisions(options); })
            .catch(() => { if (active) setDivisionLoadError(true); })
            .finally(() => { if (active) setDivisionLoading(false); });
        return () => { active = false; };
    }, [divisionRetry]);

    useEffect(() => {
        let active = true;
        void getFinancialPerformanceDepartments()
            .then(options => { if (active) setDepartments(options); })
            .catch(() => { if (active) setDepartmentLoadError(true); })
            .finally(() => { if (active) setDepartmentLoading(false); });
        return () => { active = false; };
    }, [departmentRetry]);

    const today = getFinancialPerformanceToday();
    const selectedYear = Number(filters.startDate.slice(0, 4)) || Number(today.slice(0, 4));
    const selectedMonth = Number(filters.startDate.slice(5, 7)) || Number(today.slice(5, 7));
    const years = getFinancialPerformanceYears([
        selectedYear, Number(filters.endDate.slice(0, 4)),
        Number(filters.comparisonStartDate.slice(0, 4)), Number(filters.comparisonEndDate.slice(0, 4)),
    ]);
    const presets = [
        { label: "This month", basis: "monthly" as const, ...getFinancialPerformancePeriodRange("monthly", today) },
        { label: "This quarter", basis: "quarterly" as const, ...getFinancialPerformancePeriodRange("quarterly", today) },
        { label: "Year to date", basis: "yearToDate" as const, ...getFinancialPerformancePeriodRange("yearToDate", today) },
    ];
    const appliedFilterChips = appliedCriteria ? getFinancialPerformanceAppliedFilterChips(appliedCriteria) : [];
    const draftFilterChipKeys = new Set(getFinancialPerformanceAppliedFilterChips(toFinancialPerformanceReportCriteria(filters)).map(chip => chip.key));
    const canExport = !!data && !!appliedCriteria && !isInitialLoad && !isLoading && !hasPendingChanges;
    const divisionNames = [...new Set(divisions.map(option => option.divisionName).filter((name): name is string => typeof name === "string" && name.trim().length > 0))];
    const departmentNames = [...new Set(departments.map(option => option.departmentName).filter((name): name is string => typeof name === "string" && name.trim().length > 0))];

    const handleBasisChange = (basis: typeof filters.dataBasis) => {
        updateFilter(basis === "manual"
            ? { dataBasis: basis }
            : { dataBasis: basis, ...getFinancialPerformancePeriodRange(basis, filters.startDate) });
    };

    const handleYearChange = (year: string) => {
        if (filters.dataBasis === "monthly" || filters.dataBasis === "quarterly" || filters.dataBasis === "annually") {
            updateFilter(getFinancialPerformancePeriodRange(filters.dataBasis, year + "-" + String(selectedMonth).padStart(2, "0") + "-01"));
        }
    };

    const getComparisonLabel = () => {
        return appliedCriteria ? getFinancialPerformanceComparisonLabel(appliedCriteria) : "";
    };

    const getDateRangeText = () => {
        return appliedCriteria ? formatFinancialPerformanceDateRange(appliedCriteria.startDate, appliedCriteria.endDate) : "";
    };

    const retryDivisionLookup = () => {
        setDivisionLoading(true);
        setDivisionLoadError(false);
        setDivisionRetry(value => value + 1);
    };

    const retryDepartmentLookup = () => {
        setDepartmentLoading(true);
        setDepartmentLoadError(false);
        setDepartmentRetry(value => value + 1);
    };

    const handleExportPdf = () => {
        if (!canExport || !data || !appliedCriteria) {
            toast.error("Please generate a report first");
            return;
        }
        exportToPdf(
            data,
            getDateRangeText(),
            appliedCriteria.includeComparison,
            getComparisonLabel(),
            appliedCriteria.taxRate
        );
    };

    const handleExportExcel = () => {
        if (!canExport || !data || !appliedCriteria) {
            toast.error("Please generate a report first");
            return;
        }
        exportToExcel(
            data,
            getDateRangeText(),
            appliedCriteria.includeComparison,
            getComparisonLabel(),
            appliedCriteria.taxRate
        );
    };

    return (
        <Card className="mb-0 w-full min-w-0 overflow-hidden border border-border bg-card shadow-none">
            <CardContent className="p-0">
                {/* ─── ROW 1: Module Name + Action Buttons (full width) ─── */}
                <div className="flex min-w-0 shrink-0 flex-col justify-between gap-4 bg-card p-4 transition-colors sm:flex-row sm:items-center sm:p-5">
                    <div className="min-w-0">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-bold truncate">Business Analytics / Financial Management</p>
                        <h2 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">Statement of Financial Performance</h2>
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
                            disabled={!canExport}
                        >
                            Export PDF
                        </Button>
                        <Button 
                            variant="outline" 
                            className="rounded-xl shadow-sm h-9 px-4 text-xs font-bold"
                            onClick={handleExportExcel}
                            disabled={!canExport}
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

                <section aria-label="Report criteria" className="min-w-0 space-y-4 p-4 sm:p-5">
                    <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                        <div className="min-w-0 flex-1 space-y-3">
                            <div className="text-sm font-semibold tracking-tight text-foreground">Reporting period</div>

                            <div className="flex flex-wrap gap-2" aria-label="Reporting period shortcuts">
                                {presets.map(preset => (
                                    <Button
                                        key={preset.basis}
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        aria-pressed={filters.dataBasis === preset.basis && filters.startDate === preset.startDate && filters.endDate === preset.endDate}
                                        onClick={() => updateFilter({ dataBasis: preset.basis, startDate: preset.startDate, endDate: preset.endDate })}
                                    >
                                        {preset.label}
                                    </Button>
                                ))}
                                <Button type="button" size="sm" variant="outline" aria-pressed={filters.dataBasis === "manual"} onClick={() => handleBasisChange("manual")}>
                                    Custom
                                </Button>
                            </div>

                            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="sfp-period-basis" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Period type</Label>
                                    <Select value={filters.dataBasis} onValueChange={handleBasisChange}>
                                        <SelectTrigger id="sfp-period-basis" className="h-10 w-full text-sm">
                                            <SelectValue placeholder="Select period..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="manual">Custom date range</SelectItem>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                            <SelectItem value="quarterly">Quarterly</SelectItem>
                                            <SelectItem value="annually">Annually</SelectItem>
                                            <SelectItem value="yearToDate">Year to date</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {filters.dataBasis === "manual" && (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="sfp-start-date" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date from</Label>
                                            <Input id="sfp-start-date" type="date" value={filters.startDate}
                                                onChange={e => updateFilter({ startDate: e.target.value })}
                                                aria-describedby={periodError ? "sfp-period-error" : undefined}
                                                className="h-10 w-full text-sm" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="sfp-end-date" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Date to</Label>
                                            <Input id="sfp-end-date" type="date" value={filters.endDate}
                                                onChange={e => updateFilter({ endDate: e.target.value })}
                                                aria-describedby={periodError ? "sfp-period-error" : undefined}
                                                className="h-10 w-full text-sm" />
                                        </div>
                                    </>
                                )}

                                {filters.dataBasis === "monthly" && (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="sfp-month" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Month</Label>
                                            <Select value={String(selectedMonth).padStart(2, "0")}
                                                onValueChange={month => updateFilter(getFinancialPerformancePeriodRange("monthly", selectedYear + "-" + month + "-01"))}>
                                                <SelectTrigger id="sfp-month" className="h-10 w-full text-sm">
                                                    <SelectValue placeholder="Month" />
                                                </SelectTrigger>
                                                <SelectContent className="max-h-[300px]">
                                                    {Array.from({ length: 12 }, (_, index) => (
                                                        <SelectItem key={index} value={String(index + 1).padStart(2, "0")}>
                                                            {new Intl.DateTimeFormat("en-PH", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(selectedYear, index, 1)))}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="sfp-year" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Year</Label>
                                            <Select value={String(selectedYear)} onValueChange={handleYearChange}>
                                                <SelectTrigger id="sfp-year" className="h-10 w-full text-sm">
                                                    <SelectValue placeholder="Year" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {years.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                )}

                                {filters.dataBasis === "quarterly" && (
                                    <>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="sfp-quarter" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Quarter</Label>
                                            <Select value={String(Math.ceil(selectedMonth / 3))}
                                                onValueChange={quarter => updateFilter(getFinancialPerformancePeriodRange("quarterly", selectedYear + "-" + String((Number(quarter) - 1) * 3 + 1).padStart(2, "0") + "-01"))}>
                                                <SelectTrigger id="sfp-quarter" className="h-10 w-full text-sm">
                                                    <SelectValue placeholder="Quarter" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[1, 2, 3, 4].map(quarter => <SelectItem key={quarter} value={String(quarter)}>Q{quarter}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="sfp-year" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Year</Label>
                                            <Select value={String(selectedYear)} onValueChange={handleYearChange}>
                                                <SelectTrigger id="sfp-year" className="h-10 w-full text-sm">
                                                    <SelectValue placeholder="Year" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {years.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </>
                                )}

                                {filters.dataBasis === "annually" && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="sfp-year" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Year</Label>
                                        <Select value={String(selectedYear)} onValueChange={handleYearChange}>
                                            <SelectTrigger id="sfp-year" className="h-10 w-full text-sm">
                                                <SelectValue placeholder="Year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {years.map(year => <SelectItem key={year} value={String(year)}>{year}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-muted-foreground">
                                Selected reporting period: {formatFinancialPerformanceDateRange(filters.startDate, filters.endDate)}
                            </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap gap-2 xl:pb-0.5">
                            <Button variant="default" className="h-10 px-5 text-sm font-medium" onClick={() => refresh()} disabled={isLoading || !!periodError}>
                                {isLoading ? "Generating..." : "Generate Report"}
                            </Button>
                            <Button variant="outline" className="h-10 px-4 text-sm" onClick={() => resetFilters()} disabled={isLoading}>
                                Reset filters
                            </Button>
                        </div>
                    </div>

                    <div className="min-w-0 border-t border-border pt-3">
                        <Button
                            type="button"
                            variant="ghost"
                            aria-expanded={isMoreFiltersOpen}
                            aria-controls="sfp-more-filters-content"
                            onClick={() => setIsMoreFiltersOpen(open => !open)}
                            className="h-auto min-h-9 px-2 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <ChevronDown aria-hidden="true" className={cn("mr-2 h-4 w-4 transition-transform", isMoreFiltersOpen && "rotate-180")} />
                            More filters
                        </Button>

                        <div id="sfp-more-filters-content" hidden={!isMoreFiltersOpen} className="mt-3 min-w-0 rounded-lg border border-border bg-muted/20 p-3 sm:p-4">
                            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="sfp-division" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Division</Label>
                                    <Select value={filters.divisionName || "all"} onValueChange={val => updateFilter({ divisionName: val === "all" ? "" : val })} disabled={divisionLoading}>
                                        <SelectTrigger id="sfp-division" className="h-10 w-full text-sm">
                                            <SelectValue placeholder="All Divisions" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Divisions</SelectItem>
                                            {filters.divisionName && filters.divisionName !== "all" && !divisionNames.includes(filters.divisionName) && (
                                                <SelectItem value={filters.divisionName}>Unavailable — {filters.divisionName}</SelectItem>
                                            )}
                                            {divisionNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {divisionLoading && <p role="status" className="text-xs text-muted-foreground">Loading divisions…</p>}
                                    {divisionLoadError && (
                                        <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">
                                            <span>Could not load divisions.</span>
                                            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={retryDivisionLookup}>Retry</Button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="sfp-department" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Department</Label>
                                    <Select value={filters.departmentName || "all"} onValueChange={val => updateFilter({ departmentName: val === "all" ? "" : val })} disabled={departmentLoading}>
                                        <SelectTrigger id="sfp-department" className="h-10 w-full text-sm">
                                            <SelectValue placeholder="All Departments" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Departments</SelectItem>
                                            {filters.departmentName && filters.departmentName !== "all" && !departmentNames.includes(filters.departmentName) && (
                                                <SelectItem value={filters.departmentName}>Unavailable — {filters.departmentName}</SelectItem>
                                            )}
                                            {departmentNames.map(name => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {departmentLoading && <p role="status" className="text-xs text-muted-foreground">Loading departments…</p>}
                                    {departmentLoadError && (
                                        <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">
                                            <span>Could not load departments.</span>
                                            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={retryDepartmentLookup}>Retry</Button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="sfp-tax-rate" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Tax rate</Label>
                                    <div className="relative">
                                        <Input
                                            id="sfp-tax-rate"
                                            type="number"
                                            value={filters.taxRate}
                                            onChange={e => updateFilter({ taxRate: Number(e.target.value) || 0 })}
                                            className="h-10 w-full pl-4 pr-8 text-sm"
                                        />
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                                            <span className="text-sm font-medium text-muted-foreground">%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comparison</Label>
                                    <div className="flex h-10 items-center rounded-md border border-input bg-background px-3">
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="comparison"
                                                checked={filters.includeComparison}
                                                onCheckedChange={checked => updateFilter({ includeComparison: !!checked })}
                                            />
                                            <Label htmlFor="comparison" className="cursor-pointer text-sm">
                                                Include comparison
                                            </Label>
                                        </div>
                                    </div>
                                </div>

                                {filters.includeComparison && (
                                    <>
                                        <div className="space-y-1.5 lg:col-span-2">
                                            <Label htmlFor="sfp-comparison-mode" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Compare with</Label>
                                            <Select value={filters.comparisonMode}
                                                onValueChange={value => updateFilter({ comparisonMode: value as typeof filters.comparisonMode })}>
                                                <SelectTrigger id="sfp-comparison-mode" className="h-10 w-full text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="previousPeriod">Previous period</SelectItem>
                                                    <SelectItem value="samePeriodLastYear">Same period last year</SelectItem>
                                                    <SelectItem value="custom">Custom dates</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {filters.comparisonMode === "custom" && (
                                            <>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="sfp-comparison-start" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comparison from</Label>
                                                    <Input id="sfp-comparison-start" type="date" value={filters.comparisonStartDate}
                                                        onChange={e => updateFilter({ comparisonStartDate: e.target.value })}
                                                        aria-describedby={periodError ? "sfp-period-error" : undefined}
                                                        className="h-10 w-full text-sm" />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label htmlFor="sfp-comparison-end" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Comparison to</Label>
                                                    <Input id="sfp-comparison-end" type="date" value={filters.comparisonEndDate}
                                                        onChange={e => updateFilter({ comparisonEndDate: e.target.value })}
                                                        aria-describedby={periodError ? "sfp-period-error" : undefined}
                                                        className="h-10 w-full text-sm" />
                                                </div>
                                            </>
                                        )}
                                        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-4">
                                            Selected comparison period: {formatFinancialPerformanceDateRange(filters.comparisonStartDate, filters.comparisonEndDate)}
                                        </p>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {periodError && <p id="sfp-period-error" role="alert" className="text-sm text-destructive">{periodError}</p>}

                    {isLoading && (
                        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
                            {data ? "Generating report. The last successful report remains displayed." : "Generating report…"}
                        </p>
                    )}
                    {hasPendingChanges && (
                        <p role="status" aria-live="polite" className="text-sm font-medium text-amber-700 dark:text-amber-400">
                            Changes pending — Generate report to apply. The displayed report still uses its applied criteria.
                        </p>
                    )}
                    {appliedCriteria && (
                        <section aria-label="Applied report coverage" className="flex min-w-0 flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3 text-xs">
                            <p>
                                <span className="font-medium text-muted-foreground">Transaction status: </span>
                                {describeFinancialPerformanceStatus(appliedCriteria.status)}
                            </p>
                            <p className="min-w-0">
                                <span className="font-medium text-muted-foreground">Source coverage: </span>
                                {FINANCIAL_PERFORMANCE_SOURCE_MODULES.join(", ")}
                            </p>
                        </section>
                    )}
                    {appliedCriteria && (
                        <section aria-label="Applied report filters" className="flex min-w-0 flex-wrap items-center gap-2 border-t border-border pt-3">
                            <span className="mr-1 text-xs font-medium text-muted-foreground">Applied filters:</span>
                            {appliedFilterChips.length ? appliedFilterChips.map(chip => {
                                const pendingRemoval = !draftFilterChipKeys.has(chip.key);
                                return (
                                    <button
                                        key={chip.key}
                                        type="button"
                                        onClick={() => removeAppliedFilter(chip.key)}
                                        disabled={pendingRemoval}
                                        aria-label={pendingRemoval ? `${chip.label} pending removal on next report` : `Remove ${chip.label} from the next report`}
                                        className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-left text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-70"
                                    >
                                        <span className="min-w-0 [overflow-wrap:anywhere]">{chip.label}</span>
                                        {pendingRemoval
                                            ? <span className="shrink-0 text-[10px] text-amber-700 dark:text-amber-400">Pending removal</span>
                                            : <X aria-hidden="true" className="h-3 w-3 shrink-0" />}
                                    </button>
                                );
                            }) : (
                                <span className="text-xs text-muted-foreground">Default report criteria</span>
                            )}
                        </section>
                    )}
                </section>
            </CardContent>
            <CertificationModal 
                isOpen={isCertifyModalOpen} 
                onOpenChange={setIsCertifyModalOpen} 
            />
        </Card>
    );
}
