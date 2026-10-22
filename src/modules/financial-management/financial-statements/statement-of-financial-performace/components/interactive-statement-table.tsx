"use client";

import { Fragment, useState } from "react";
import { useFinancialPerformance } from "../hooks/useFinancialPerformance";
import { FinancialPerformanceEntry, FinancialPerformanceResponse } from "../types";
import { Card } from "@/components/ui/card";
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

// Format helper
const formatAccAmount = (amount?: number, isNegativeFormat: boolean = false) => {
    if (amount === undefined) return "₱0.00";
    
    // For specific deduction rows, we might want to display them as negative
    // even if the backend returns them as positive (or vice-versa) based on isNegativeFormat
    const displayAmount = isNegativeFormat ? -Math.abs(amount) : amount;
    
    const isNegative = displayAmount < 0;
    const absValue = Math.abs(displayAmount);
    
    const formatter = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
    });
    
    const formatted = formatter.format(absValue);
    return isNegative ? `-${formatted}` : formatted;
};

// Simple variance format
const formatVarianceAmount = (variance: number) => {
    const isNegative = variance < 0;
    const isNeutral = variance === 0;
    
    const formatter = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
    });
    
    const formatted = formatter.format(Math.abs(variance));
    
    if (isNeutral) return { elem: <span className="text-muted-foreground">{formatted}</span> };
    
    if (isNegative) {
        return { 
            elem: <span className="text-destructive font-bold flex items-center gap-1 justify-end">▼ {formatted}</span> 
        };
    }
    
    return { 
        elem: <span className="text-success font-bold flex items-center gap-1 justify-end">▲ {formatted}</span> 
    };
};

export function InteractiveStatementTable() {
    const { data, appliedCriteria, isLoading, isInitialLoad, filters, updateFilters } = useFinancialPerformance();
    const [activeTab, setActiveTab] = useState("summary");

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
    const includeComparison = appliedCriteria.includeComparison && !!comparisonSummary;
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

    // Helper to get total of a specific section in entries
    const getSectionTotal = (sourceData: FinancialPerformanceResponse | undefined, sectionName: string) => {
        if (!sourceData || !sourceData.entries) return undefined;
        return sourceData.entries
            .filter(e => e.reportSection === sectionName)
            .reduce((acc, curr) => acc + curr.amount, 0);
    };

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
    }) => {
        const variance = currentValue !== undefined && priorValue !== undefined ? currentValue - priorValue : undefined;
        
        return (
            <TableRow className={cn("hover:bg-muted/30 transition-colors border-0", {
                "border-t border-border": hasBorderTop,
                "border-b-2 border-foreground": hasBorderBottom && isBold,
                "border-b border-border": hasBorderBottom && !isBold,
            })}>
                <TableCell className={cn("py-3 px-4 font-medium", {
                    "font-bold text-foreground": isBold,
                    "text-muted-foreground": !isBold,
                    "pl-12": isIndented,
                    "pl-20 text-xs": isDoubleIndented,
                    "cursor-pointer hover:text-foreground transition-colors": expandable
                })} onClick={expandable ? () => toggleSection(sectionKey) : undefined}>
                    <div className="flex items-center gap-2">
                        {label}
                        {expandable && (
                            expandedSections[sectionKey] ? 
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : 
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                    </div>
                </TableCell>
                <TableCell className={cn("py-3 px-4 text-right tabular-nums", {
                    "font-bold text-foreground": isBold,
                    "font-medium": !isBold,
                })}>
                    {formatAccAmount(currentValue, isNegativeFormat)}
                </TableCell>
                {includeComparison && (
                    <>
                        <TableCell className={cn("py-3 px-4 text-right tabular-nums text-muted-foreground", {
                            "font-bold": isBold,
                            "font-medium": !isBold,
                        })}>
                            {formatAccAmount(priorValue, isNegativeFormat)}
                        </TableCell>
                        <TableCell className="py-3 px-4 text-right tabular-nums">
                            {variance !== undefined ? formatVarianceAmount(variance).elem : "-"}
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
                    <TableCell colSpan={5} className="py-2 px-4 font-bold text-foreground text-xs uppercase tracking-wider">
                        {typeLabel}
                    </TableCell>
                </TableRow>
                {filteredEntries.map((entry: FinancialPerformanceEntry, idx: number) => (
                    <TableRow key={`${entry.glCode}-${idx}`} className="border-0 hover:bg-muted/30">
                        <TableCell className="py-3 px-4 text-muted-foreground font-medium">{entry.reportSection}</TableCell>
                        <TableCell className="py-3 px-4 font-bold text-foreground">{entry.accountTitle}</TableCell>
                        <TableCell className="py-3 px-4 text-muted-foreground">{entry.division || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-muted-foreground">{entry.department || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-right tabular-nums font-medium">
                            {formatAccAmount(entry.amount, entry.amount < 0)}
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
                {isLoading && <p role="status" aria-live="polite" className="text-xs text-muted-foreground">Generating report; showing the last successful results.</p>}
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full min-w-0">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted p-1 rounded-full w-full sm:w-fit mb-6 shadow-inner">
                    <TabsList className="bg-transparent h-10 p-0 shadow-none border-0 w-full sm:w-auto">
                        <TabsTrigger 
                            value="summary" 
                            className="rounded-full px-6 data-[state=active]:bg-zinc-950 data-[state=active]:text-zinc-50 data-[state=active]:shadow-md transition-all font-bold text-xs"
                        >
                            Summary View
                        </TabsTrigger>
                        <TabsTrigger 
                            value="detail" 
                            className="rounded-full px-6 data-[state=active]:bg-zinc-950 data-[state=active]:text-zinc-50 data-[state=active]:shadow-md transition-all font-bold text-xs"
                        >
                            Detail View
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="summary" className="m-0 mt-0">
                    <Card className="min-w-0 max-w-full overflow-hidden border-border bg-card shadow-sm">
                        <div className="p-5 sm:p-6 lg:p-8 bg-card border-b border-border">
                            <h2 className="text-xl font-bold tracking-tight text-foreground">Statement of Financial Performance</h2>
                        </div>
                        
                        <div className="w-full min-w-0 max-w-full overflow-x-auto">
                            <Table className="min-w-[800px] w-full text-sm">
                                <TableHeader className="bg-background sticky top-0 z-10 border-b border-border shadow-sm">
                                    <TableRow className="hover:bg-background border-0">
                                        <TableHead className="py-4 px-4 font-bold text-muted-foreground w-[40%]">Particulars</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-foreground text-right w-[20%]">Current</TableHead>
                                        {includeComparison && (
                                            <>
                                                <TableHead className="py-4 px-4 font-bold text-muted-foreground text-right w-[20%]">{getComparisonLabel()}</TableHead>
                                                <TableHead className="py-4 px-4 font-bold text-muted-foreground text-right w-[20%]">Variance</TableHead>
                                            </>
                                        )}
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="bg-card">
                                    {/* --- SALES --- */}
                                    {renderSummaryRow({ label: "Gross Sales", currentValue: summary.totalRevenue, priorValue: comparisonSummary?.totalRevenue, isBold: true, hasBorderTop: false })}
                                    
                                    {data.entries.filter((e: FinancialPerformanceEntry) => e.reportSection === "Contra Revenue").map((entry: FinancialPerformanceEntry, idx: number) => {
                                        const compEntry = comparisonSummary?.entries.find((c: FinancialPerformanceEntry) => c.accountTitle === entry.accountTitle);
                                        return (
                                            <Fragment key={`sales-${entry.glCode}-${idx}`}>
                                                {renderSummaryRow({
                                                    label: `Less: ${entry.accountTitle}`, 
                                                    currentValue: entry.amount, 
                                                    priorValue: compEntry?.amount, 
                                                    isIndented: true, 
                                                    isNegativeFormat: true 
                                                })}
                                            </Fragment>
                                        );
                                    })}

                                    {renderSummaryRow({
                                        label: "Total Deductions", 
                                        currentValue: getSectionTotal(summary, "Contra Revenue"), 
                                        priorValue: getSectionTotal(comparisonSummary, "Contra Revenue"), 
                                        isBold: true, hasBorderTop: true, isNegativeFormat: true 
                                    })}
                                    
                                    {renderSummaryRow({
                                        label: "Net Sales", 
                                        currentValue: summary.totalRevenue - Math.abs(getSectionTotal(summary, "Contra Revenue") || 0),
                                        priorValue: comparisonSummary ? comparisonSummary.totalRevenue - Math.abs(getSectionTotal(comparisonSummary, "Contra Revenue") || 0) : undefined,
                                        isBold: true, hasBorderTop: true, hasBorderBottom: true 
                                    })}
                                    
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
                                            {data.entries.filter((e: FinancialPerformanceEntry) => e.reportSection === "Purchases / Cost of Sales").map((entry: FinancialPerformanceEntry, idx: number) => {
                                                const compEntry = comparisonSummary?.entries.find((c: FinancialPerformanceEntry) => c.accountTitle === entry.accountTitle);
                                                return (
                                                    <Fragment key={`cogs-${entry.glCode}-${idx}`}>
                                                        {renderSummaryRow({
                                                            label: entry.accountTitle, 
                                                            currentValue: entry.amount, 
                                                            priorValue: compEntry?.amount, 
                                                            isIndented: true 
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
                                            {data.entries.filter((e: FinancialPerformanceEntry) => e.reportSection === "Operating Expenses").map((entry: FinancialPerformanceEntry, idx: number) => {
                                                const compEntry = comparisonSummary?.entries.find((c: FinancialPerformanceEntry) => c.accountTitle === entry.accountTitle);
                                                return (
                                                    <Fragment key={`opex-${entry.glCode}-${idx}`}>
                                                        {renderSummaryRow({
                                                            label: entry.accountTitle, 
                                                            currentValue: entry.amount, 
                                                            priorValue: compEntry?.amount, 
                                                            isIndented: true 
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
                                            {data.entries.filter((e: FinancialPerformanceEntry) => e.reportSection === "Other Expense").map((entry: FinancialPerformanceEntry, idx: number) => {
                                                const compEntry = comparisonSummary?.entries.find((c: FinancialPerformanceEntry) => c.accountTitle === entry.accountTitle);
                                                return (
                                                    <Fragment key={`oexp-${entry.glCode}-${idx}`}>
                                                        {renderSummaryRow({
                                                            label: entry.accountTitle, 
                                                            currentValue: entry.amount, 
                                                            priorValue: compEntry?.amount, 
                                                            isIndented: true 
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
                                            {data.entries.filter((e: FinancialPerformanceEntry) => e.reportSection === "Other Income").map((entry: FinancialPerformanceEntry, idx: number) => {
                                                const compEntry = comparisonSummary?.entries.find((c: FinancialPerformanceEntry) => c.accountTitle === entry.accountTitle);
                                                return (
                                                    <Fragment key={`oinc-${entry.glCode}-${idx}`}>
                                                        {renderSummaryRow({
                                                            label: entry.accountTitle, 
                                                            currentValue: entry.amount, 
                                                            priorValue: compEntry?.amount, 
                                                            isIndented: true 
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
                                    {renderSummaryRow({ label: `Tax (${appliedCriteria.taxRate}%)`, currentValue: summary.incomeTaxExpense, priorValue: comparisonSummary?.incomeTaxExpense, isIndented: true, isNegativeFormat: true, hasBorderBottom: true })}
                                    
                                    {/* Final output table row custom style */}
                                    <TableRow className="bg-zinc-950 hover:bg-zinc-900 border-0 shadow-lg group transition-colors">
                                        <TableCell className="py-4 px-4 font-bold text-zinc-50 text-base">Net Income</TableCell>
                                        <TableCell className="py-4 px-4 text-right tabular-nums text-zinc-50 font-bold text-base">
                                            {formatAccAmount(summary.netIncome)}
                                        </TableCell>
                                        {includeComparison && (
                                            <>
                                                <TableCell className="py-4 px-4 text-right tabular-nums text-zinc-400 font-bold">
                                                    {formatAccAmount(comparisonSummary?.netIncome)}
                                                </TableCell>
                                                <TableCell className="py-4 px-4 text-right tabular-nums">
                                                    {summary.netIncome !== undefined && comparisonSummary?.netIncome !== undefined ? 
                                                        formatVarianceAmount(summary.netIncome - comparisonSummary.netIncome).elem : 
                                                    "-"}
                                                </TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="detail" className="m-0 mt-0">
                    <Card className="flex min-h-[600px] min-w-0 max-w-full flex-col overflow-hidden border-border bg-card shadow-sm">
                        <div className="flex min-w-0 flex-col justify-between gap-4 border-b border-border bg-card p-4 sm:flex-row sm:items-start sm:p-5">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">Detail View</h2>
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
                            <Table className="min-w-[1000px] w-full text-sm">
                                <TableHeader className="bg-background sticky top-0 z-10 shadow-sm border-b border-border">
                                    <TableRow className="hover:bg-background border-0">
                                        <TableHead className="py-4 px-4 font-bold text-muted-foreground w-[15%]">Section</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-muted-foreground w-[35%]">Account</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-muted-foreground w-[15%]">Division</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-muted-foreground w-[15%]">Department</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-foreground text-right w-[20%]">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="bg-card">
                                    {filteredDetailEntries.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                                                {normalizedSearchQuery ? "No account rows match this search." : "No account rows are available in this report."}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {renderDetailGroup("Sales", "Sales")}
                                    {renderDetailGroup("Contra Revenue", "Contra Revenue")}
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
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
