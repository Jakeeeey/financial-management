"use client";

import { useEffect, useState } from "react";
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
import { Filter, ChevronDown, Download, FileSpreadsheet, Loader2, Lock, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CertificationModal } from "./CertificationModal";
import { BalanceSheetSearchableSelect } from "./BalanceSheetSearchableSelect";
import { exportBalanceSheetToExcel, exportBalanceSheetToPdf } from "../services/balance-sheet-export.service";
import {
    getBalanceSheetDepartments,
    getBalanceSheetDivisions,
    type BalanceSheetDepartmentOption,
    type BalanceSheetDivisionOption,
} from "../services/balance-sheet.service";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    getBalanceSheetAppliedFilterChips,
    getBalanceSheetMonthEnd,
    getBalanceSheetPreviousYearDate,
    getBalanceSheetTodayDate,
    getBalanceSheetYearOptions,
} from "../utils/report-state";

export function ReportControlSection() {
    const {
        refresh,
        resetFilters,
        removeAppliedFilter,
        isLoading,
        filters,
        appliedFilters,
        hasPendingChanges,
        setFilters,
        accounts,
        summary,
        comparisonSummary,
        comparisonStatus,
        ratios,
        reportStatus,
        error,
    } = useBalanceSheet();
    const [isCertifyModalOpen, setIsCertifyModalOpen] = useState(false);
    const [exporting, setExporting] = useState<"pdf" | "excel" | null>(null);
    const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
    const [divisions, setDivisions] = useState<BalanceSheetDivisionOption[]>([]);
    const [departments, setDepartments] = useState<BalanceSheetDepartmentOption[]>([]);
    const [divisionLoading, setDivisionLoading] = useState(true);
    const [departmentLoading, setDepartmentLoading] = useState(true);
    const [divisionLoadError, setDivisionLoadError] = useState(false);
    const [departmentLoadError, setDepartmentLoadError] = useState(false);
    const [divisionRetry, setDivisionRetry] = useState(0);
    const [departmentRetry, setDepartmentRetry] = useState(0);

    useEffect(() => {
        let active = true;
        void getBalanceSheetDivisions()
            .then(options => { if (active) setDivisions(options); })
            .catch(() => { if (active) setDivisionLoadError(true); })
            .finally(() => { if (active) setDivisionLoading(false); });
        return () => { active = false; };
    }, [divisionRetry]);

    useEffect(() => {
        let active = true;
        void getBalanceSheetDepartments()
            .then(options => { if (active) setDepartments(options); })
            .catch(() => { if (active) setDepartmentLoadError(true); })
            .finally(() => { if (active) setDepartmentLoading(false); });
        return () => { active = false; };
    }, [departmentRetry]);

    const divisionNames = [...new Set(divisions
        .map(option => option.divisionName)
        .filter(name => typeof name === "string" && name.trim().length > 0))];
    const departmentNames = [...new Set(departments
        .map(option => option.departmentName)
        .filter(name => typeof name === "string" && name.trim().length > 0))];

    const appliedFilterChips = appliedFilters ? getBalanceSheetAppliedFilterChips(appliedFilters) : [];
    const draftFilterChips = getBalanceSheetAppliedFilterChips(filters);
    const canExport = Boolean(appliedFilters && summary) && !isLoading && !error && !hasPendingChanges;

    const handleExport = async (format: "pdf" | "excel") => {
        if (!canExport || !appliedFilters || !summary) return;

        setExporting(format);
        try {
            await new Promise<void>(resolve => window.requestAnimationFrame(() => resolve()));
            const exportData = { accounts, summary, comparisonSummary, comparisonStatus, ratios, filters: appliedFilters };
            if (format === "pdf") {
                exportBalanceSheetToPdf(exportData);
            } else {
                exportBalanceSheetToExcel(exportData);
            }
            toast.success(`${format === "pdf" ? "PDF" : "Excel"} report downloaded`);
        } catch (exportError) {
            const message = exportError instanceof Error ? exportError.message : "Unable to create the report.";
            toast.error(message);
        } finally {
            setExporting(null);
        }
    };

    const exportUnavailableMessage = isLoading
        ? "Wait for the report to finish loading before exporting."
        : hasPendingChanges
            ? "Generate the report to apply filter changes before exporting."
            : !appliedFilters
                ? "Generate a report before exporting."
                : null;

    const updateFilter = (updates: Partial<typeof filters>) => {
        setFilters(prev => ({ ...prev, ...updates }));
    };

    const updateDateSelection = (basis: typeof filters.dataBasis, startDate: string, endDate: string) => {
        const updates: Partial<typeof filters> = { dataBasis: basis, startDate, endDate };
        if (filters.comparisonBasis === "match") {
            updates.comparisonStartDate = getBalanceSheetPreviousYearDate(startDate);
            updates.comparisonEndDate = getBalanceSheetPreviousYearDate(endDate);
        }
        updateFilter(updates);
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

    const handleBasisChange = (basis: typeof filters.dataBasis) => {
        const today = getBalanceSheetTodayDate();
        const [currentYear, currentMonth] = today.split("-").map(Number);
        let startDate = filters.startDate;
        let endDate = filters.endDate;

        if (basis === "today") {
            endDate = today;
            startDate = `${currentYear}-01-01`;
        } else if (basis === "annually") {
            startDate = `${currentYear}-01-01`;
            endDate = `${currentYear}-12-31`;
        } else if (basis === "monthly") {
            const month = String(currentMonth).padStart(2, "0");
            startDate = `${currentYear}-${month}-01`;
            endDate = getBalanceSheetMonthEnd(currentYear, currentMonth);
        } else if (basis === "quarterly") {
            const quarter = Math.ceil(currentMonth / 3);
            const startMonth = (quarter - 1) * 3 + 1;
            const endMonth = quarter * 3;
            startDate = `${currentYear}-${String(startMonth).padStart(2, "0")}-01`;
            endDate = getBalanceSheetMonthEnd(currentYear, endMonth);
        } else {
            const [selectedYear] = endDate.split("-");
            startDate = `${selectedYear}-01-01`;
        }

        updateDateSelection(basis, startDate, endDate);
    };

    const handleComparisonBasisChange = (basis: typeof filters.comparisonBasis) => {
        const updates: Partial<typeof filters> = { comparisonBasis: basis };

        if (basis === "match") {
            updates.comparisonStartDate = getBalanceSheetPreviousYearDate(filters.startDate);
            updates.comparisonEndDate = getBalanceSheetPreviousYearDate(filters.endDate);
        }

        updateFilter(updates);
    };

    const handleComparisonDateChange = (date: string) => {
        if (!date) return;
        const [year] = date.split("-");
        updateFilter({ comparisonStartDate: `${year}-01-01`, comparisonEndDate: date });
    };

    return (
        <Card className="shadow-none border border-border overflow-hidden bg-card">
            <CardContent className="p-0">
                {/* ─── Module heading and report actions occupy separate rows ─── */}
                <div className="flex flex-col gap-4 p-5 sm:p-6 lg:px-8 bg-card transition-colors">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1 font-bold">Business Analytics / Financial Management</p>
                        <h2 className="text-2xl font-bold tracking-tight text-foreground">Statement of Financial Position</h2>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[700px] leading-relaxed">
                            Dynamic balance sheet prototype with period selection, comparison view, validation checks, managerial certification, and account-level drill-down.
                        </p>
                    </div>
                    <div className="w-full space-y-3" aria-busy={exporting !== null}>
                        <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                            {false && (
                                <Badge variant="secondary" className="rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider">
                                    Validated
                                </Badge>
                            )}
                            <Button
                                variant="ghost"
                                className="rounded-lg shadow-sm h-9 px-4 text-xs font-bold bg-zinc-950 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                                onClick={() => void handleExport("pdf")}
                                disabled={!canExport || exporting !== null}
                            >
                                {exporting === "pdf" ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-2" />}
                                {exporting === "pdf" ? "Preparing PDF..." : "Export full report (PDF)"}
                            </Button>
                            <Button
                                variant="ghost"
                                className="rounded-lg shadow-sm h-9 px-4 text-xs font-bold bg-zinc-950 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                                onClick={() => void handleExport("excel")}
                                disabled={!canExport || exporting !== null}
                            >
                                {exporting === "excel" ? <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5 mr-2" />}
                                {exporting === "excel" ? "Preparing Excel..." : "Export full report (Excel)"}
                            </Button>
                        </div>
                        {appliedFilters && (
                            <p className="text-right text-xs text-muted-foreground">
                                Exports include all {accounts.length} applied report accounts; Account breakdown search does not narrow exports.
                            </p>
                        )}
                        {exportUnavailableMessage && (
                            <p className="text-right text-xs text-muted-foreground" role="status">
                                {exportUnavailableMessage}
                            </p>
                        )}
                        {hasPendingChanges && (
                            <p role="status" aria-live="polite" className="text-sm font-medium text-amber-700 dark:text-amber-400">
                                Changes pending — Generate report to apply. The displayed report still uses its applied criteria.
                            </p>
                        )}
                        {appliedFilters && (
                            <section aria-label="Applied report filters" className="flex min-w-0 flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                                <span className="mr-1 text-xs font-medium text-muted-foreground">Applied filters:</span>
                                {appliedFilterChips.length > 0 ? appliedFilterChips.map(chip => {
                                    const draftChip = draftFilterChips.find(candidate => candidate.key === chip.key);
                                    const pendingRemoval = !draftChip;
                                    const pendingUpdate = Boolean(draftChip && draftChip.label !== chip.label);

                                    return (
                                        <button
                                            key={chip.key}
                                            type="button"
                                            onClick={() => removeAppliedFilter(chip.key)}
                                            disabled={pendingRemoval}
                                            aria-label={pendingRemoval
                                                ? `${chip.label} pending removal on next report`
                                                : `Remove ${chip.label} from the next report`}
                                            className="inline-flex max-w-full items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-left text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-70"
                                        >
                                            <span className="min-w-0 [overflow-wrap:anywhere]">{chip.label}</span>
                                            {pendingRemoval ? (
                                                <span className="shrink-0 text-[10px] text-amber-700 dark:text-amber-400">Pending removal</span>
                                            ) : pendingUpdate ? (
                                                <span className="shrink-0 text-[10px] text-amber-700 dark:text-amber-400">Pending change</span>
                                            ) : (
                                                <X aria-hidden="true" className="h-3 w-3 shrink-0" />
                                            )}
                                        </button>
                                    );
                                }) : (
                                    <span className="text-xs text-muted-foreground">Default report criteria</span>
                                )}
                            </section>
                        )}
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

                <div className="min-w-0 space-y-3 bg-card p-4 sm:p-5">

                    <div className="min-w-0 space-y-3">
                        <div className="space-y-3">
                            <div className="text-xs font-bold flex items-center gap-2 uppercase tracking-wider text-muted-foreground">
                                <Filter className="w-3.5 h-3.5" />
                                Report Initialization
                            </div>

                            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                                <div className="min-w-0 flex-1">
                            <div className="space-y-4">
                                {/* Date Selection */}
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="balance-sheet-date-basis" className="text-xs font-bold text-foreground">Date Selection</Label>
                                        <Select value={filters.dataBasis} onValueChange={handleBasisChange}>
                                            <SelectTrigger id="balance-sheet-date-basis" className="w-full sm:w-[280px] h-9 text-xs font-bold border-input bg-card">
                                                <SelectValue placeholder="Select basis..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="today">As of today</SelectItem>
                                                <SelectItem value="monthly">Month end</SelectItem>
                                                <SelectItem value="quarterly">Quarter end</SelectItem>
                                                <SelectItem value="annually">Year end</SelectItem>
                                                <SelectItem value="manual">Custom as-of date</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Conditional Sub-inputs for Data Selection */}
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {filters.dataBasis === "manual" && (
                                            <div className="w-full space-y-1 sm:w-[220px]">
                                                <Label htmlFor="balance-sheet-end-date" className="text-xs">Custom as-of date</Label>
                                                <Input
                                                    id="balance-sheet-end-date"
                                                    type="date"
                                                    value={filters.endDate}
                                                    onChange={(e) => {
                                                        const date = e.target.value;
                                                        if (!date) return;
                                                        const [year] = date.split("-");
                                                        updateDateSelection("manual", `${year}-01-01`, date);
                                                    }}
                                                    className="h-9 text-xs font-medium border-input bg-card"
                                                />
                                                </div>
                                        )}

                                        {filters.dataBasis === "monthly" && (
                                            <>
                                                <div className="space-y-1">
                                                <Label htmlFor="balance-sheet-month" className="text-xs">Month</Label>
                                                <Select 
                                                    value={filters.endDate.split("-")[1]} 
                                                    onValueChange={(val) => {
                                                        const year = Number(filters.endDate.split("-")[0]);
                                                        const month = Number(val);
                                                        updateDateSelection("monthly", `${year}-${val}-01`, getBalanceSheetMonthEnd(year, month));
                                                    }}
                                                >
                                                    <SelectTrigger id="balance-sheet-month" className="w-[120px] h-9 text-xs font-medium border-input bg-card">
                                                        <SelectValue placeholder="Month" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"].map(m => (
                                                            <SelectItem key={m} value={m}>
                                                                {new Intl.DateTimeFormat("en-PH", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2000, Number(m) - 1, 1)))}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                </div>
                                                <div className="space-y-1">
                                                <Label htmlFor="balance-sheet-month-year" className="text-xs">Year</Label>
                                                <Select 
                                                    value={filters.endDate.split("-")[0]} 
                                                    onValueChange={(val) => {
                                                        const month = Number(filters.endDate.split("-")[1]);
                                                        updateDateSelection("monthly", `${val}-${String(month).padStart(2, "0")}-01`, getBalanceSheetMonthEnd(Number(val), month));
                                                    }}
                                                >
                                                    <SelectTrigger id="balance-sheet-month-year" className="w-[100px] h-9 text-xs font-medium border-input bg-card">
                                                        <SelectValue placeholder="Year" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {getBalanceSheetYearOptions(Number(filters.endDate.split("-")[0])).map(year => (
                                                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                </div>
                                            </>
                                        )}

                                        {filters.dataBasis === "quarterly" && (
                                            <>
                                                <div className="space-y-1">
                                                <Label htmlFor="balance-sheet-quarter" className="text-xs">Quarter</Label>
                                                <Select 
                                                    value={`q${Math.ceil(parseInt(filters.endDate.split("-")[1])/3)}`}
                                                    onValueChange={(val) => {
                                                        const q = parseInt(val.charAt(1));
                                                        const year = Number(filters.endDate.split("-")[0]);
                                                        const startMonth = (q - 1) * 3 + 1;
                                                        const endMonth = q * 3;
                                                        updateDateSelection("quarterly", `${year}-${String(startMonth).padStart(2, "0")}-01`, getBalanceSheetMonthEnd(year, endMonth));
                                                    }}
                                                >
                                                    <SelectTrigger id="balance-sheet-quarter" className="w-[140px] h-9 text-xs font-medium border-input bg-card">
                                                        <SelectValue placeholder="Quarter" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="q1">1st Quarter</SelectItem>
                                                        <SelectItem value="q2">2nd Quarter</SelectItem>
                                                        <SelectItem value="q3">3rd Quarter</SelectItem>
                                                        <SelectItem value="q4">4th Quarter</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                </div>
                                                <div className="space-y-1">
                                                <Label htmlFor="balance-sheet-quarter-year" className="text-xs">Year</Label>
                                                <Select 
                                                    value={filters.endDate.split("-")[0]}
                                                    onValueChange={(val) => {
                                                        const quarter = Math.ceil(Number(filters.endDate.split("-")[1]) / 3);
                                                        const startMonth = (quarter - 1) * 3 + 1;
                                                        const endMonth = quarter * 3;
                                                        updateDateSelection("quarterly", `${val}-${String(startMonth).padStart(2, "0")}-01`, getBalanceSheetMonthEnd(Number(val), endMonth));
                                                    }}
                                                >
                                                    <SelectTrigger id="balance-sheet-quarter-year" className="w-[100px] h-9 text-xs font-medium border-input bg-card">
                                                        <SelectValue placeholder="Year" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {getBalanceSheetYearOptions(Number(filters.endDate.split("-")[0])).map(year => (
                                                            <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                </div>
                                            </>
                                        )}

                                        {filters.dataBasis === "annually" && (
                                            <div className="space-y-1">
                                            <Label htmlFor="balance-sheet-year" className="text-xs">Year</Label>
                                            <Select 
                                                value={filters.endDate.split("-")[0]}
                                                onValueChange={(val) => updateDateSelection("annually", `${val}-01-01`, `${val}-12-31`)}
                                            >
                                                <SelectTrigger id="balance-sheet-year" className="w-[120px] h-9 text-xs font-medium border-input bg-card">
                                                    <SelectValue placeholder="Year" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {getBalanceSheetYearOptions(Number(filters.endDate.split("-")[0])).map(year => (
                                                        <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                </div>
                                </div>
                                <div className="flex shrink-0 flex-wrap gap-2">
                                    <Button variant="default" className="rounded-lg px-5 h-9 text-xs font-bold shadow-sm transition-all focus-visible:ring-primary/50" onClick={() => refresh()} disabled={isLoading}>
                                        {isLoading ? (reportStatus === "refreshing" ? "Refreshing..." : "Loading...") : "Generate report"}
                                    </Button>
                                    <Button variant="outline" className="rounded-lg px-4 h-9 text-xs font-bold border-input text-foreground hover:bg-accent transition-all" onClick={() => resetFilters()} disabled={isLoading}>
                                        Reset
                                    </Button>
                                </div>
                            </div>
                            <Collapsible open={isMoreFiltersOpen} onOpenChange={setIsMoreFiltersOpen} className="min-w-0">
                                <CollapsibleTrigger asChild>
                                    <Button type="button" variant="outline" aria-expanded={isMoreFiltersOpen} className="h-10 w-full justify-between gap-3 px-3 text-left focus-visible:ring-2 focus-visible:ring-ring">
                                        <span className="text-sm font-semibold">More filters</span>
                                        <ChevronDown aria-hidden="true" className={cn("h-4 w-4 shrink-0 transition-transform", isMoreFiltersOpen && "rotate-180")} />
                                    </Button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="pt-3">
                                    <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

                                {/* Division */}
                                <div className="space-y-2">
                                    <Label htmlFor="balance-sheet-division" className="text-xs font-bold text-foreground">Division</Label>
                                    <BalanceSheetSearchableSelect
                                        id="balance-sheet-division"
                                        value={filters.divisionName}
                                        options={divisionNames.map(name => ({ value: name, label: name }))}
                                        onValueChange={divisionName => updateFilter({ divisionName })}
                                        placeholder="All Divisions"
                                        disabled={divisionLoading}
                                        className="sm:w-[220px]"
                                    />
                                    {divisionLoading && <span role="status" className="text-xs text-muted-foreground">Loading divisions...</span>}
                                    {!divisionLoading && !divisionLoadError && divisionNames.length === 0 && <span role="status" className="text-xs text-muted-foreground">No divisions available.</span>}
                                    {divisionLoadError && (
                                        <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
                                            <span>Division options could not be loaded.</span>
                                            <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={retryDivisionLookup}>Retry</Button>
                                        </div>
                                    )}
                                </div>

                                {/* Department */}
                                <div className="space-y-2">
                                    <Label htmlFor="balance-sheet-department" className="text-xs font-bold text-foreground">Department</Label>
                                    <BalanceSheetSearchableSelect
                                        id="balance-sheet-department"
                                        value={filters.departmentName}
                                        options={departmentNames.map(name => ({ value: name, label: name }))}
                                        onValueChange={departmentName => updateFilter({ departmentName })}
                                        placeholder="All Departments"
                                        disabled={departmentLoading}
                                        className="sm:w-[150px]"
                                    />
                                    {departmentLoading && <span role="status" className="text-xs text-muted-foreground">Loading departments...</span>}
                                    {!departmentLoading && !departmentLoadError && departmentNames.length === 0 && <span role="status" className="text-xs text-muted-foreground">No departments available.</span>}
                                    {departmentLoadError && (
                                        <div className="flex items-center gap-2 text-xs text-destructive" role="alert">
                                            <span>Department options could not be loaded.</span>
                                            <Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={retryDepartmentLookup}>Retry</Button>
                                        </div>
                                    )}
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
                                            <Label htmlFor="balance-sheet-comparison-basis" className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Comparison Period</Label>
                                            <Select value={filters.comparisonBasis} onValueChange={handleComparisonBasisChange}>
                                                <SelectTrigger id="balance-sheet-comparison-basis" className="w-full sm:w-[280px] h-9 text-xs font-bold border-input bg-card">
                                                    <SelectValue placeholder="Select basis..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="match">Matching date last year</SelectItem>
                                                    <SelectItem value="as-of">Custom comparison as-of date</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* Conditional Sub-inputs based on selection */}
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {filters.comparisonBasis === "as-of" && (
                                                <div className="w-full space-y-1 sm:w-[220px]">
                                                    <Label htmlFor="balance-sheet-comparison-end-date" className="text-xs">Comparison as-of date</Label>
                                                    <Input 
                                                        id="balance-sheet-comparison-end-date"
                                                        type="date"
                                                        value={filters.comparisonEndDate} 
                                                        onChange={(e) => handleComparisonDateChange(e.target.value)}
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
                                </CollapsibleContent>
                            </Collapsible>
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
