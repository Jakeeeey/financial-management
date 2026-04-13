"use client";

import { useState } from "react";
import { useFinancialPerformance } from "../hooks/useFinancialPerformance";
import { FinancialPerformanceEntry, FinancialPerformanceSummary } from "../types";
import { Card } from "@/components/ui/card";
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
    return isNegative ? `(${formatted})` : formatted;
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
    const { data, filters, isLoading } = useFinancialPerformance();
    const [activeTab, setActiveTab] = useState("summary");
    const [searchQuery, setSearchQuery] = useState("");

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        cogs: false,
        opex: false,
        otherExp: false,
        otherInc: false,
    });

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-10 w-48 bg-muted rounded-full animate-pulse mx-auto sm:mx-0"></div>
                <Card className="h-[600px] flex items-center justify-center border-border shadow-sm bg-card">
                    <p className="text-muted-foreground text-sm font-medium animate-pulse">Loading statement data...</p>
                </Card>
            </div>
        );
    }

    if (!data) return null;

    const summary = data.summary;
    const comparisonSummary = data.comparisonSummary;
    const includeComparison = filters.includeComparison && !!comparisonSummary;

    // ----- SUMMARY VIEW RENDERER -----
    const SummaryRow = ({
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
    }: any) => {
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
        if (!filters.includeComparison) return "";
        if (filters.comparisonBasis === "monthly") return `Past FS (${new Date(filters.comparisonStartDate).toLocaleString('default', { month: 'long' })} ${filters.comparisonStartDate.split("-")[0]})`;
        if (filters.comparisonBasis === "quarterly") {
             const startMonth = parseInt(filters.comparisonStartDate.split("-")[1]);
             const q = Math.ceil(startMonth / 3);
             return `Past FS (Q${q} ${filters.comparisonStartDate.split("-")[0]})`;
        }
        return `Past FS (${filters.comparisonStartDate.split("-")[0]})`;
    };

    // ----- DETAIL VIEW RENDERER -----
    const renderDetailGroup = (typeLabel: string, typeKey: string) => {
        const filteredEntries = data.entries.filter(e => {
            if (e.type !== typeKey) return false;
            // Search filter
            if (searchQuery) {
                const q = searchQuery.toLowerCase();
                return e.account.toLowerCase().includes(q) || 
                       e.division.toLowerCase().includes(q) || 
                       e.department.toLowerCase().includes(q);
            }
            return true;
        });

        if (filteredEntries.length === 0) return null;

        return (
            <>
                <TableRow className="bg-muted hover:bg-muted">
                    <TableCell colSpan={5} className="py-2 px-4 font-bold text-foreground text-xs uppercase tracking-wider">
                        {typeLabel}
                    </TableCell>
                </TableRow>
                {filteredEntries.map(entry => (
                    <TableRow key={entry.id} className="border-0 hover:bg-muted/30">
                        <TableCell className="py-3 px-4 text-muted-foreground font-medium">{entry.type}</TableCell>
                        <TableCell className="py-3 px-4 font-bold text-foreground">{entry.account}</TableCell>
                        <TableCell className="py-3 px-4 text-muted-foreground">{entry.division}</TableCell>
                        <TableCell className="py-3 px-4 text-muted-foreground">{entry.department}</TableCell>
                        <TableCell className="py-3 px-4 text-right tabular-nums font-medium">
                            {formatAccAmount(entry.amount, entry.amount < 0)}
                        </TableCell>
                    </TableRow>
                ))}
            </>
        );
    };


    const getHeaderLabel = () => {
         if (filters.dataBasis === "monthly") {
             const m = new Date(filters.startDate).toLocaleString('default', { month: 'long' });
             const y = filters.startDate.split("-")[0];
             return `For the Month of ${m} ${y}`;
         }
         return `For the period ending ${filters.endDate}`;
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                    <Card className="shadow-sm border-border overflow-hidden bg-card">
                        <div className="p-5 sm:p-6 lg:p-8 bg-card border-b border-border">
                            <h2 className="text-xl font-bold tracking-tight text-foreground">Statement of Financial Performance</h2>
                            <p className="text-sm text-muted-foreground mt-1 font-medium">{getHeaderLabel()}</p>
                        </div>
                        
                        <div className="overflow-x-auto w-full">
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
                                    <SummaryRow label="Gross Sales" currentValue={summary.grossSales} priorValue={comparisonSummary?.grossSales} isBold hasBorderTop={false} />
                                    <SummaryRow label="Less: Sales Returns" currentValue={summary.salesReturns} priorValue={comparisonSummary?.salesReturns} isIndented isNegativeFormat />
                                    <SummaryRow label="Less: Trade Discounts" currentValue={summary.tradeDiscounts} priorValue={comparisonSummary?.tradeDiscounts} isIndented isNegativeFormat />
                                    <SummaryRow label="Less: Bad Orders" currentValue={summary.badOrders} priorValue={comparisonSummary?.badOrders} isIndented isNegativeFormat />
                                    
                                    <SummaryRow label="Total Deductions" currentValue={summary.totalDeductions} priorValue={comparisonSummary?.totalDeductions} isBold hasBorderTop isNegativeFormat />
                                    <SummaryRow label="Net Sales" currentValue={summary.netSales} priorValue={comparisonSummary?.netSales} isBold hasBorderTop hasBorderBottom />
                                    
                                    {/* --- COGS --- */}
                                    <SummaryRow 
                                        label="Cost of Goods Sold" 
                                        currentValue={summary.costOfGoodsSold} 
                                        priorValue={comparisonSummary?.costOfGoodsSold} 
                                        isBold 
                                        expandable 
                                        sectionKey="cogs" 
                                    />
                                    {expandedSections.cogs && (
                                        <>
                                            <SummaryRow label="Beginning Inventory" currentValue={summary.cogsBreakdown.beginningInventory} priorValue={comparisonSummary?.cogsBreakdown.beginningInventory} isIndented />
                                            <SummaryRow label="Purchases" currentValue={summary.cogsBreakdown.purchases} priorValue={comparisonSummary?.cogsBreakdown.purchases} isIndented />
                                            <SummaryRow label="Add: Freight In" currentValue={summary.cogsBreakdown.freightIn} priorValue={comparisonSummary?.cogsBreakdown.freightIn} isIndented />
                                            <SummaryRow 
                                                label="Total Purchases" 
                                                currentValue={summary.cogsBreakdown.purchases + summary.cogsBreakdown.freightIn} 
                                                priorValue={comparisonSummary ? comparisonSummary.cogsBreakdown.purchases + comparisonSummary.cogsBreakdown.freightIn : undefined} 
                                                isBold isIndented hasBorderTop 
                                            />
                                            <SummaryRow label="Less: Purchase Returns" currentValue={summary.cogsBreakdown.purchaseReturns} priorValue={comparisonSummary?.cogsBreakdown.purchaseReturns} isIndented />
                                            <SummaryRow 
                                                label="Net Purchases" 
                                                currentValue={summary.cogsBreakdown.purchases + summary.cogsBreakdown.freightIn - summary.cogsBreakdown.purchaseReturns} 
                                                priorValue={comparisonSummary ? comparisonSummary.cogsBreakdown.purchases + comparisonSummary.cogsBreakdown.freightIn - comparisonSummary.cogsBreakdown.purchaseReturns : undefined} 
                                                isBold isIndented hasBorderTop 
                                            />
                                            <SummaryRow 
                                                label="Goods Available for Sale" 
                                                currentValue={summary.cogsBreakdown.beginningInventory + summary.cogsBreakdown.purchases + summary.cogsBreakdown.freightIn - summary.cogsBreakdown.purchaseReturns} 
                                                priorValue={comparisonSummary ? comparisonSummary.cogsBreakdown.beginningInventory + comparisonSummary.cogsBreakdown.purchases + comparisonSummary.cogsBreakdown.freightIn - comparisonSummary.cogsBreakdown.purchaseReturns : undefined} 
                                                isBold isIndented hasBorderTop 
                                            />
                                            <SummaryRow label="Less: Ending Inventory" currentValue={summary.cogsBreakdown.endingInventory} priorValue={comparisonSummary?.cogsBreakdown.endingInventory} isIndented isNegativeFormat />
                                        </>
                                    )}

                                    <SummaryRow label="Gross Profit" currentValue={summary.grossProfit} priorValue={comparisonSummary?.grossProfit} isBold hasBorderTop hasBorderBottom />
                                    
                                    {/* --- EXPENSES --- */}
                                    <SummaryRow 
                                        label="Operating Expenses" 
                                        currentValue={summary.operatingExpenses} 
                                        priorValue={comparisonSummary?.operatingExpenses} 
                                        isBold 
                                        expandable 
                                        sectionKey="opex" 
                                        isNegativeFormat
                                    />
                                    {expandedSections.opex && (
                                        <>
                                            {data.entries.filter(e => e.type === "Operating Expenses").map(entry => {
                                                const compEntry = data.comparisonEntries?.find(c => c.account === entry.account);
                                                return (
                                                    <SummaryRow 
                                                        key={entry.id} 
                                                        label={entry.account} 
                                                        currentValue={entry.amount} 
                                                        priorValue={compEntry?.amount} 
                                                        isIndented 
                                                    />
                                                );
                                            })}
                                        </>
                                    )}

                                    {/* --- OTHER INC/EXP --- */}
                                    <SummaryRow 
                                        label="Other Expense" 
                                        currentValue={summary.otherExpense} 
                                        priorValue={comparisonSummary?.otherExpense} 
                                        isBold 
                                        expandable 
                                        sectionKey="otherExp" 
                                        isNegativeFormat
                                    />
                                    {expandedSections.otherExp && (
                                        <>
                                            {data.entries.filter(e => e.type === "Other Expense").map(entry => {
                                                const compEntry = data.comparisonEntries?.find(c => c.account === entry.account);
                                                return (
                                                    <SummaryRow 
                                                        key={entry.id} 
                                                        label={entry.account} 
                                                        currentValue={entry.amount} 
                                                        priorValue={compEntry?.amount} 
                                                        isIndented 
                                                    />
                                                );
                                            })}
                                        </>
                                    )}

                                    <SummaryRow 
                                        label="Other Income" 
                                        currentValue={summary.otherIncome} 
                                        priorValue={comparisonSummary?.otherIncome} 
                                        isBold 
                                        expandable 
                                        sectionKey="otherInc" 
                                    />
                                    {expandedSections.otherInc && (
                                        <>
                                            {data.entries.filter(e => e.type === "Other Income").map(entry => {
                                                const compEntry = data.comparisonEntries?.find(c => c.account === entry.account);
                                                return (
                                                    <SummaryRow 
                                                        key={entry.id} 
                                                        label={entry.account} 
                                                        currentValue={entry.amount} 
                                                        priorValue={compEntry?.amount} 
                                                        isIndented 
                                                    />
                                                );
                                            })}
                                        </>
                                    )}

                                    <SummaryRow label="Net Other Income (Loss)" currentValue={summary.netOtherIncome} priorValue={comparisonSummary?.netOtherIncome} isBold hasBorderTop />
                                    
                                    {/* --- FINAL --- */}
                                    <SummaryRow label="Income Before Tax" currentValue={summary.incomeBeforeTax} priorValue={comparisonSummary?.incomeBeforeTax} isBold hasBorderTop />
                                    <SummaryRow label={`Tax (${filters.taxRate}%)`} currentValue={summary.taxExpense} priorValue={comparisonSummary?.taxExpense} isIndented isNegativeFormat hasBorderBottom />
                                    
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
                    <Card className="shadow-sm border-border overflow-hidden bg-card flex flex-col min-h-[600px]">
                        <div className="p-5 sm:p-6 lg:p-8 bg-card border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-xl font-bold tracking-tight text-foreground">Detail View</h2>
                                <p className="text-sm text-muted-foreground mt-1 font-medium">Grouped by type for review and validation</p>
                            </div>
                            <div className="w-full md:w-[350px]">
                                <Input 
                                    placeholder="Search account, type, division, or department..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="h-10 text-sm border-input rounded-xl bg-card transition-all focus-visible:ring-1 w-full"
                                />
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto bg-card">
                            <Table className="min-w-[1000px] w-full text-sm">
                                <TableHeader className="bg-background sticky top-0 z-10 shadow-sm border-b border-border">
                                    <TableRow className="hover:bg-background border-0">
                                        <TableHead className="py-4 px-4 font-bold text-muted-foreground w-[15%]">Type</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-muted-foreground w-[35%]">Account</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-muted-foreground w-[15%]">Division</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-muted-foreground w-[15%]">Department</TableHead>
                                        <TableHead className="py-4 px-4 font-bold text-foreground text-right w-[20%]">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody className="bg-card">
                                    {renderDetailGroup("Sales", "Sales")}
                                    {renderDetailGroup("Contra Revenue", "Contra Revenue")}
                                    {renderDetailGroup("Purchases / Cost of Sales", "Purchases / Cost of Sales")}
                                    {renderDetailGroup("Operating Expenses", "Operating Expenses")}
                                    {renderDetailGroup("Other Income", "Other Income")}
                                    {renderDetailGroup("Other Expense", "Other Expense")}

                                    {/* Floating specific row for Net Income to stand out */}
                                    {data.summary && (
                                        <TableRow className="bg-zinc-950 hover:bg-zinc-900 border-0 sticky bottom-0 z-10 shadow-lg shadow-zinc-900/50">
                                            <TableCell colSpan={4} className="py-4 px-4 font-bold text-zinc-50 text-base rounded-bl-lg">
                                                Net Income
                                            </TableCell>
                                            <TableCell className="py-4 px-4 text-right tabular-nums text-zinc-50 font-bold text-base rounded-br-lg">
                                                {formatAccAmount(data.summary.netIncome)}
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
