"use client";

import { Fragment, useState } from "react";
import { useFinancialPerformance } from "../hooks/useFinancialPerformance";
import { FinancialPerformanceEntry } from "../types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFinancialPerformanceDateRange, getFinancialPerformanceComparisonLabel } from "../utils/periods";
import { alignFinancialPerformanceEntries } from "../utils/comparison-entries";
import { formatFinancialPerformanceChange, getDisplayedFinancialPerformanceAmount, getFinancialPerformanceChange } from "../utils/variances";
import { FinancialPerformanceTransactionsDialog } from "./financial-performance-transactions-dialog";

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
}).format(amount);

// Format helper
const formatAccAmount = (amount?: number, isNegativeFormat: boolean = false) => {
    if (amount === undefined) return "₱0.00";

    const displayAmount = getDisplayedFinancialPerformanceAmount(amount, isNegativeFormat);
    
    const isNegative = displayAmount < 0;
    const absValue = Math.abs(displayAmount);
    
    const formatter = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
    });
    
    const formatted = formatter.format(absValue);
    return isNegative ? `-${formatted}` : formatted;
};

const formatVarianceAmount = (variance: number) => {
    const label = formatFinancialPerformanceChange(variance, formatCurrency);
    return <span className="text-muted-foreground font-medium">{label}</span>;
};

export function InteractiveStatementTable() {
    const { data, appliedCriteria, comparisonStatus, retryComparison, isLoading, isInitialLoad, filters, updateFilters } = useFinancialPerformance();
    const [activeTab, setActiveTab] = useState("statement");
    const [selectedTransactionAccount, setSelectedTransactionAccount] = useState<FinancialPerformanceEntry | null>(null);

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        cogs: false,
        opex: false,
        otherExp: false,
        otherInc: false,
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    if (isLoading && !data) {
        return (
            <div className="space-y-4">
                <div className="h-10 w-48 bg-muted rounded-full animate-pulse mx-auto sm:mx-0"></div>
                <Card className="h-[600px] flex items-center justify-center border-border shadow-sm bg-card">
                    <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading statement data...</p>
                </Card>
            </div>
        );
    }

    if (isInitialLoad || !data) {
        return (
            <div className="space-y-4">
                <div className="h-10 w-48 bg-muted rounded-full mx-auto sm:mx-0 opacity-50"></div>
                <Card className="h-[600px] flex flex-col items-center justify-center border-border border-dashed shadow-sm bg-card/50">
                    <div className="bg-muted p-4 rounded-full mb-4">
                        <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-xl font-bold text-foreground mb-2">No Statement Generated</h3>
                    <p className="text-muted-foreground text-sm max-w-md text-center">
                        Please adjust the filters above and click &quot;Generate Report&quot; to view the Statement of Financial Performance.
                    </p>
                </Card>
            </div>
        );
    }

    if (!appliedCriteria) return null;

    const summary = data;
    const comparisonSummary = data.comparisonData;
    const includeComparison = appliedCriteria.includeComparison;
    const comparisonAvailable = includeComparison && comparisonStatus === "available" && !!comparisonSummary;
    const comparisonState = !includeComparison
        ? "not-requested"
        : comparisonAvailable
            ? "available"
            : comparisonStatus === "loading"
                ? "loading"
                : "unavailable";
    const netIncomeChange = comparisonAvailable
        ? getFinancialPerformanceChange(summary.netIncome, comparisonSummary?.netIncome)
        : undefined;
    const alignedEntries = alignFinancialPerformanceEntries(data.entries, comparisonSummary?.entries ?? []);
    const getSectionEntries = (sectionName: string) => alignedEntries.filter(({ current, comparison }) =>
        (current ?? comparison)?.reportSection === sectionName
    );
    const normalizedSearchQuery = filters.searchQuery.trim().toLowerCase();
    const filteredDetailEntries = data.entries.filter((entry: FinancialPerformanceEntry) => {
        if (!normalizedSearchQuery) return true;

        return [
            entry.glCode,
            entry.accountTitle,
            entry.reportSection,
            entry.division,
            entry.department,
        ].some(value => (value ?? "").toLowerCase().includes(normalizedSearchQuery));
    });

    // ----- SUMMARY VIEW RENDERER -----
    const renderSummaryRow = ({
        label,
        currentValue,
        priorValue,
        isBold = false,
        isIndented = false,
        isDoubleIndented = false,
        isNegativeFormat = false,
        hasBorderTop = false,
        hasBorderBottom = false,
        expandable = false,
        sectionKey = "",
        currentZeroActivity = false,
        priorZeroActivity = false,
    }: {
        label: React.ReactNode;
        currentValue?: number;
        priorValue?: number;
        isBold?: boolean;
        isIndented?: boolean;
        isDoubleIndented?: boolean;
        isNegativeFormat?: boolean;
        hasBorderTop?: boolean;
        hasBorderBottom?: boolean;
        expandable?: boolean;
        sectionKey?: string;
        currentZeroActivity?: boolean;
        priorZeroActivity?: boolean;
    }) => {
        const variance = comparisonAvailable
            ? getFinancialPerformanceChange(currentValue, priorValue, isNegativeFormat)
            : undefined;
        const sectionExpanded = expandedSections[sectionKey] ?? false;
        const sectionName = typeof label === "string" ? label : "this section";
        
        return (
            <TableRow className={cn("hover:bg-muted/30 transition-colors border-0", {
                "bg-muted/20": expandable,
                "border-t border-border": hasBorderTop,
                "border-b-2 border-foreground": hasBorderBottom && isBold,
                "border-b border-border": hasBorderBottom && !isBold,
            })}>
                <TableCell className={cn("py-3 px-4 font-medium", {
                    "sticky left-0 z-10 bg-muted/20 shadow-[4px_0_8px_-6px_rgba(0,0,0,0.35)]": expandable,
                    "sticky left-0 z-10 bg-card shadow-[4px_0_8px_-6px_rgba(0,0,0,0.25)]": !expandable,
                    "font-bold text-foreground": isBold,
                    "text-muted-foreground": !isBold,
                    "pl-12": isIndented,
                    "pl-20 text-xs": isDoubleIndented,
                })}>
                    <div className="flex flex-wrap items-center gap-2">
                        <span>{label}</span>
                        {expandable && (
                            <>
                                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Subtotal</span>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    aria-expanded={sectionExpanded}
                                    aria-label={`${sectionExpanded ? "Hide" : "Show"} accounts for ${sectionName}`}
                                    onClick={() => toggleSection(sectionKey)}
                                    className="h-7 gap-1 px-2 text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    {sectionExpanded
                                        ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                                        : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
                                    {sectionExpanded ? "Hide accounts" : "Show accounts"}
                                </Button>
                            </>
                        )}
                    </div>
                </TableCell>
                <TableCell className={cn("py-3 px-4 text-right tabular-nums", {
                    "font-bold text-foreground": isBold,
                    "font-medium": !isBold,
                })}>
                    {formatAccAmount(currentValue, isNegativeFormat)}
                    {currentZeroActivity && <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">Zero activity</span>}
                </TableCell>
                {includeComparison && (
                    <>
                        <TableCell className={cn("py-3 px-4 text-right tabular-nums text-muted-foreground", {
                            "font-bold": isBold,
                            "font-medium": !isBold,
                        })}>
                            {comparisonState === "available" ? <>
                                {formatAccAmount(priorValue, isNegativeFormat)}
                                {priorZeroActivity && <span className="mt-0.5 block text-[10px] font-normal text-muted-foreground">Zero activity</span>}
                            </> : <span className="text-xs font-normal">{comparisonState === "loading" ? "Loading comparison…" : "Comparison unavailable"}</span>}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right tabular-nums">
                            {variance !== undefined ? formatVarianceAmount(variance) : "—"}
                        </TableCell>
                    </>
                )}
            </TableRow>
        );
    };

    const getComparisonLabel = () => {
        return getFinancialPerformanceComparisonLabel(appliedCriteria);
    };

    // ----- DETAIL VIEW RENDERER -----
    const renderDetailGroup = (typeLabel: string, typeKey: string) => {
        const filteredEntries = filteredDetailEntries.filter(entry => entry.reportSection === typeKey);

        if (filteredEntries.length === 0) return null;

        return (
            <>
                <TableRow className="bg-muted hover:bg-muted">
                    <TableCell colSpan={6} className="py-2 px-4 font-bold text-foreground text-xs uppercase tracking-wider">
                        {typeLabel}
                    </TableCell>
                </TableRow>
                {filteredEntries.map((entry: FinancialPerformanceEntry, idx: number) => (
                    <TableRow key={`${entry.coaId}-${entry.glCode}-${entry.division}-${entry.department}-${idx}`} className="border-0 hover:bg-muted/30">
                        <TableCell className="sticky left-0 z-10 w-[160px] min-w-[160px] bg-card py-3 px-4 text-muted-foreground font-medium shadow-[4px_0_8px_-6px_rgba(0,0,0,0.25)]">{entry.reportSection}</TableCell>
                        <TableCell className="sticky left-[160px] z-10 w-[280px] min-w-[280px] bg-card py-3 px-4 font-bold text-foreground shadow-[4px_0_8px_-6px_rgba(0,0,0,0.35)]">
                            <span className="block">{entry.accountTitle}</span>
                            <span className="mt-0.5 block text-xs font-medium text-muted-foreground">GL code: {entry.glCode || "Unavailable"}</span>
                        </TableCell>
                        <TableCell className="py-3 px-4 text-muted-foreground">{entry.division || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-muted-foreground">{entry.department || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-right tabular-nums font-medium">
                            {formatAccAmount(entry.amount, entry.amount < 0)}
                        </TableCell>
                        <TableCell className="py-3 px-4">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={entry.coaId == null}
                                aria-label={`View transactions for ${entry.glCode || entry.accountTitle}`}
                                onClick={() => setSelectedTransactionAccount(entry)}
                            >
                                View transactions
                            </Button>
                        </TableCell>
                    </TableRow>
                ))}
            </>
        );
    };


    return (
        <div className="min-w-0 max-w-full space-y-4 animate-in fade-in duration-500">
            <div aria-label="Generated report periods" className="rounded-xl border border-border bg-card p-4 text-sm space-y-1">
                <p><span className="font-medium">Reporting period:</span> {formatFinancialPerformanceDateRange(appliedCriteria.startDate, appliedCriteria.endDate)}</p>
                {includeComparison && (
                    <p><span className="font-medium">Comparison period:</span> {formatFinancialPerformanceDateRange(appliedCriteria.comparisonStartDate, appliedCriteria.comparisonEndDate)}</p>
                )}
                <p><span className="font-medium">Sales activity:</span> Credit less debit from included sales accounts.</p>
                <p><span className="font-medium">Income tax estimate:</span> Calculated at {(summary.taxRateUsed * 100).toFixed(2)}% when income before tax is positive.</p>
                {includeComparison && comparisonState === "loading" && <p role="status" aria-live="polite" className="text-xs text-muted-foreground">Loading comparison data…</p>}
                {includeComparison && comparisonState === "unavailable" && (
                    <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">
                        <span>Comparison unavailable. Variances are withheld; current-period results remain available.</span>
                        <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={() => void retryComparison()} className="h-7">
                            Retry comparison
                        </Button>
                    </div>
                )}
                {isLoading && comparisonState !== "loading" && <p role="status" aria-live="polite" className="text-xs text-muted-foreground">Generating report; showing the last successful results.</p>}
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted p-1 rounded-full w-full sm:w-fit mb-6 shadow-inner">
                    <TabsList className="bg-transparent h-10 p-0 shadow-none border-0 w-full sm:w-auto">
                        <TabsTrigger 
                            value="statement"
                            className="rounded-full px-6 data-[state=active]:bg-zinc-950 data-[state=active]:text-zinc-50 data-[state=active]:shadow-md transition-all font-bold text-xs"
                        >
                            Statement
                        </TabsTrigger>
                        <TabsTrigger 
                            value="account-breakdown"
                            className="rounded-full px-6 data-[state=active]:bg-zinc-950 data-[state=active]:text-zinc-50 data-[state=active]:shadow-md transition-all font-bold text-xs"
                        >
                            Account breakdown
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="statement" className="m-0 mt-0">
                    <Card className="min-w-0 max-w-full overflow-hidden border-border bg-card shadow-sm">
                        <div className="p-5 sm:p-6 lg:p-8 bg-card border-b border-border">
                            <h2 className="text-xl font-bold tracking-tight text-foreground">Statement of Financial Performance</h2>
                        </div>
                        
                        <div className="w-full min-w-0 max-w-full overflow-x-auto">
                            <Table className="min-w-[800px] w-full text-sm">
                                <TableHeader className="bg-background sticky top-0 z-10 border-b border-border shadow-sm">
                                    <TableRow className="hover:bg-background border-0">
                                        <TableHead className="sticky left-0 z-30 bg-background py-4 px-4 font-bold text-muted-foreground w-[40%] shadow-[4px_0_8px_-6px_rgba(0,0,0,0.35)]">Particulars</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-foreground text-right w-[20%]">Current</TableHead>
                                        {includeComparison && (
                                            <>
                                                <TableHead className="py-4 px-4 font-bold text-muted-foreground text-right w-[20%]">{getComparisonLabel()}</TableHead>
                                                <TableHead className="py-4 px-4 font-bold text-muted-foreground text-right w-[20%]">Change (current minus comparison)</TableHead>
                                            </>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="bg-card">
                                    {/* --- SALES --- */}
                                    {renderSummaryRow({ label: "Sales activity (credit less debit)", currentValue: summary.totalRevenue, priorValue: comparisonSummary?.totalRevenue, isBold: true, hasBorderTop: false })}
                                    
                                    {/* --- COGS --- */}
                                    {renderSummaryRow({
                                        label: "Cost of Goods Sold", 
                                        currentValue: summary.totalCostOfSales, 
                                        priorValue: comparisonSummary?.totalCostOfSales, 
                                        isBold: true, 
                                        expandable: true, 
                                        sectionKey: "cogs" 
                                    })}
                                    {expandedSections.cogs && (
                                        <>
                                            {getSectionEntries("Purchases / Cost of Sales").map(({ key, current, comparison }) => {
                                                const entry = current ?? comparison!;
                                                return (
                                                    <Fragment key={`cogs-${key}`}>
                                                        {renderSummaryRow({
                                                            label: entry.accountTitle, 
                                                            currentValue: current?.amount ?? 0,
                                                            priorValue: comparison?.amount ?? 0,
                                                            isIndented: true,
                                                            currentZeroActivity: !current,
                                                            priorZeroActivity: !comparison,
                                                        })}
                                                    </Fragment>
                                                );
                                            })}
                                        </>
                                    )}

                                    {renderSummaryRow({ label: "Gross Profit", currentValue: summary.grossProfit, priorValue: comparisonSummary?.grossProfit, isBold: true, hasBorderTop: true, hasBorderBottom: true })}
                                    
                                    {/* --- EXPENSES --- */}
                                    {renderSummaryRow({
                                        label: "Operating Expenses", 
                                        currentValue: summary.totalOperatingExpenses, 
                                        priorValue: comparisonSummary?.totalOperatingExpenses, 
                                        isBold: true, 
                                        expandable: true, 
                                        sectionKey: "opex", 
                                        isNegativeFormat: true
                                    })}
                                    {expandedSections.opex && (
                                        <>
                                            {getSectionEntries("Operating Expenses").map(({ key, current, comparison }) => {
                                                const entry = current ?? comparison!;
                                                return (
                                                    <Fragment key={`opex-${key}`}>
                                                        {renderSummaryRow({
                                                            label: entry.accountTitle, 
                                                            currentValue: current?.amount ?? 0,
                                                            priorValue: comparison?.amount ?? 0,
                                                            isIndented: true,
                                                            currentZeroActivity: !current,
                                                            priorZeroActivity: !comparison,
                                                        })}
                                                    </Fragment>
                                                );
                                            })}
                                        </>
                                    )}

                                    {/* --- OTHER INC/EXP --- */}
                                    {renderSummaryRow({
                                        label: "Other Expense", 
                                        currentValue: summary.totalOtherExpense, 
                                        priorValue: comparisonSummary?.totalOtherExpense, 
                                        isBold: true, 
                                        expandable: true, 
                                        sectionKey: "otherExp", 
                                        isNegativeFormat: true
                                    })}
                                    {expandedSections.otherExp && (
                                        <>
                                            {getSectionEntries("Other Expense").map(({ key, current, comparison }) => {
                                                const entry = current ?? comparison!;
                                                return (
                                                    <Fragment key={`oexp-${key}`}>
                                                        {renderSummaryRow({
                                                            label: entry.accountTitle, 
                                                            currentValue: current?.amount ?? 0,
                                                            priorValue: comparison?.amount ?? 0,
                                                            isIndented: true,
                                                            currentZeroActivity: !current,
                                                            priorZeroActivity: !comparison,
                                                        })}
                                                    </Fragment>
                                                );
                                            })}
                                        </>
                                    )}

                                    {renderSummaryRow({
                                        label: "Other Income", 
                                        currentValue: summary.totalOtherIncome, 
                                        priorValue: comparisonSummary?.totalOtherIncome, 
                                        isBold: true, 
                                        expandable: true, 
                                        sectionKey: "otherInc" 
                                    })}
                                    {expandedSections.otherInc && (
                                        <>
                                            {getSectionEntries("Other Income").map(({ key, current, comparison }) => {
                                                const entry = current ?? comparison!;
                                                return (
                                                    <Fragment key={`oinc-${key}`}>
                                                        {renderSummaryRow({
                                                            label: entry.accountTitle, 
                                                            currentValue: current?.amount ?? 0,
                                                            priorValue: comparison?.amount ?? 0,
                                                            isIndented: true,
                                                            currentZeroActivity: !current,
                                                            priorZeroActivity: !comparison,
                                                        })}
                                                    </Fragment>
                                                );
                                            })}
                                        </>
                                    )}

                                    {renderSummaryRow({
                                        label: "Net Other Income (Loss)", 
                                        currentValue: summary.totalOtherIncome - summary.totalOtherExpense, 
                                        priorValue: comparisonSummary ? comparisonSummary.totalOtherIncome - comparisonSummary.totalOtherExpense : undefined, 
                                        isBold: true, hasBorderTop: true 
                                    })}
                                    
                                    {/* --- FINAL --- */}
                                    {renderSummaryRow({ label: "Income Before Tax", currentValue: summary.incomeBeforeTax, priorValue: comparisonSummary?.incomeBeforeTax, isBold: true, hasBorderTop: true })}
                                    {renderSummaryRow({ label: `Estimated income tax (${(summary.taxRateUsed * 100).toFixed(2)}% of positive pre-tax income)`, currentValue: summary.incomeTaxExpense, priorValue: comparisonSummary?.incomeTaxExpense, isIndented: true, isNegativeFormat: true, hasBorderBottom: true })}
                                    
                                    {/* Final output table row custom style */}
                                    <TableRow className="bg-zinc-950 hover:bg-zinc-900 border-0 shadow-lg group transition-colors">
                                        <TableCell className="sticky left-0 z-10 bg-zinc-950 py-4 px-4 font-bold text-zinc-50 text-base shadow-[4px_0_8px_-6px_rgba(0,0,0,0.5)]">Net Income</TableCell>
                                        <TableCell className="py-4 px-4 text-right tabular-nums text-zinc-50 font-bold text-base">
                                            {formatAccAmount(summary.netIncome)}
                                        </TableCell>
                                        {includeComparison && (
                                            <>
                                                <TableCell className="py-4 px-4 text-right tabular-nums text-zinc-400 font-bold">
                                                    {comparisonState === "available"
                                                        ? formatAccAmount(comparisonSummary?.netIncome)
                                                        : comparisonState === "loading" ? "Loading comparison…" : "Comparison unavailable"}
                                                </TableCell>
                                                <TableCell className="py-4 px-4 text-right tabular-nums">
                                                    {netIncomeChange !== undefined ? formatVarianceAmount(netIncomeChange) : "—"}
                                                </TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="account-breakdown" className="m-0 mt-0">
                    <Card className="flex min-h-[600px] min-w-0 max-w-full flex-col overflow-hidden border-border bg-card shadow-sm">
                        <div className="flex min-w-0 flex-col justify-between gap-4 border-b border-border bg-card p-4 sm:flex-row sm:items-start sm:p-5">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">Account breakdown</h2>
                                <p className="text-sm text-muted-foreground mt-1 font-medium">Grouped by section for review and validation</p>
                            </div>
                            <div className="w-full min-w-0 sm:max-w-xl">
                                <Label htmlFor="sfp-detail-search" className="text-xs font-semibold">Find account or section</Label>
                                <Input
                                    id="sfp-detail-search"
                                    type="search"
                                    placeholder="Account code, title, section, division, or department"
                                    value={filters.searchQuery}
                                    onChange={event => updateFilters({ searchQuery: event.target.value })}
                                    aria-describedby="sfp-detail-search-scope"
                                    className="mt-1.5 h-10 w-full text-sm"
                                />
                                <p id="sfp-detail-search-scope" className="mt-1 text-xs text-muted-foreground">
                                    <span role="status" aria-live="polite">
                                        {normalizedSearchQuery
                                            ? `${filteredDetailEntries.length} matching account ${filteredDetailEntries.length === 1 ? "row" : "rows"}. `
                                            : `Showing all ${filteredDetailEntries.length} account ${filteredDetailEntries.length === 1 ? "row" : "rows"}. `}
                                    </span>
                                    Search only hides detail rows; summary totals, KPIs, Net Income, and exports use the full applied report.
                                </p>
                            </div>
                        </div>

                        <div className="min-w-0 max-w-full flex-1 overflow-auto bg-card">
                            <Table className="min-w-[1150px] w-full text-sm">
                                <TableHeader className="bg-background sticky top-0 z-10 shadow-sm border-b border-border">
                                    <TableRow className="hover:bg-background border-0">
                                        <TableHead className="sticky left-0 z-30 w-[160px] min-w-[160px] bg-background py-4 px-4 font-bold text-muted-foreground shadow-[4px_0_8px_-6px_rgba(0,0,0,0.25)]">Section</TableHead>
                                        <TableHead className="sticky left-[160px] z-30 w-[280px] min-w-[280px] bg-background py-4 px-4 font-bold text-muted-foreground shadow-[4px_0_8px_-6px_rgba(0,0,0,0.35)]">Account</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-muted-foreground w-[13%]">Division</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-muted-foreground w-[13%]">Department</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-foreground text-right w-[15%]">Amount</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-foreground w-[16%]">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="bg-card">
                                    {filteredDetailEntries.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                                                {normalizedSearchQuery ? "No account rows match this search." : "No account rows are available in this report."}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {renderDetailGroup("Sales", "Sales")}
                                    {renderDetailGroup("Purchases / Cost of Sales", "Purchases / Cost of Sales")}
                                    {renderDetailGroup("Operating Expenses", "Operating Expenses")}
                                    {renderDetailGroup("Other Income", "Other Income")}
                                    {renderDetailGroup("Other Expense", "Other Expense")}

                                    {/* Floating specific row for Net Income to stand out */}
                                    {data && (
                                        <TableRow className="bg-zinc-950 hover:bg-zinc-900 border-0 sticky bottom-0 z-10 shadow-lg shadow-zinc-900/50">
                                            <TableCell colSpan={4} className="py-4 px-4 font-bold text-zinc-50 text-base rounded-bl-lg">
                                                Net Income
                                            </TableCell>
                                            <TableCell className="py-4 px-4 text-right tabular-nums text-zinc-50 font-bold text-base rounded-br-lg">
                                                {formatAccAmount(data.netIncome)}
                                            </TableCell>
                                            <TableCell />
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
            <FinancialPerformanceTransactionsDialog
                open={selectedTransactionAccount !== null}
                onOpenChange={open => { if (!open) setSelectedTransactionAccount(null); }}
                account={selectedTransactionAccount}
                criteria={appliedCriteria}
            />
        </div>
    );
}
