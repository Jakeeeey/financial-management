import { useState } from "react";
import { Card } from "@/components/ui/card";
import { BalanceSheetComparisonStatus, ValidationStatus } from "../types";
import { BarChart3, ShieldCheck, FileText, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBalanceSheet } from "../hooks/useBalanceSheet";

interface Props {
    validation: ValidationStatus;
}

function SummaryCardItem({
    title, 
    currentValue, 
    priorValue, 
    icon, 
    isAlertCard, 
    isBalanced, 
    isComparisonEnabled, 
    comparisonStatus,
    comparisonBasis
}: {
    title: string; 
    currentValue: number; 
    priorValue: number | null;
    icon: React.ReactNode; 
    isAlertCard: boolean; 
    isBalanced: boolean; 
    isComparisonEnabled: boolean; 
    comparisonStatus: BalanceSheetComparisonStatus;
    comparisonBasis: string;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Calculate the variance between Current and Prior (Current - Prior)
    const varianceAmount = priorValue === null ? null : currentValue - priorValue;
    const isIncrease = varianceAmount !== null && varianceAmount > 0;
    const isDecrease = varianceAmount !== null && varianceAmount < 0;

    const formatCurrency = (value: number | undefined) => {
        if (value === undefined) return "₱0.00";
        const isNegative = value < 0;
        const formatted = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return isNegative ? `-₱${formatted}` : `₱${formatted}`;
    };

    return (
        <Card className={cn("min-w-0 shadow-none border flex flex-col p-4 transition-all duration-300", isAlertCard && !isBalanced && "border-destructive/30 bg-destructive/10")}>
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
                    <h3 className={cn("text-2xl font-bold", isAlertCard && !isBalanced && "text-destructive")}>
                        {formatCurrency(currentValue)}
                    </h3>
                </div>
                <div className={cn("p-2 rounded-full", isAlertCard ? (isBalanced ? "bg-muted" : "bg-destructive/10") : "bg-muted")}>
                    {icon}
                </div>
            </div>
            
            <div className="mt-4">
                <button 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={cn(
                        "text-xs hover:underline flex items-center gap-1 font-medium transition-colors",
                        isAlertCard && !isBalanced ? "text-destructive" : "text-primary"
                    )}
                >
                    View breakdown {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
            </div>

            {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border animate-in slide-in-from-top-2 fade-in duration-200">
                    <div className="flex flex-col gap-2 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Current Period</span>
                            <span className="font-medium">{formatCurrency(currentValue)}</span>
                        </div>
                        {isComparisonEnabled && comparisonStatus === "available" ? (
                            <>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Prior Period {comparisonBasis === 'match' ? '(Matched)' : ''}</span>
                                    <span className="font-medium">{formatCurrency(priorValue ?? 0)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1 mt-1 border-t border-border/50">
                                    <span className="text-muted-foreground">Variance</span>
                                    <span className={cn(
                                        "font-bold",
                                        isIncrease ? "text-success" : (isDecrease ? "text-destructive" : "")
                                    )}>
                                        {isIncrease ? "+" : ""}{formatCurrency(varianceAmount ?? 0)}
                                    </span>
                                </div>
                            </>
                        ) : isComparisonEnabled ? (
                            <div className="text-xs text-muted-foreground italic mt-2 bg-muted/30 p-2 rounded text-center">
                                Comparison unavailable. Variance is not calculated.
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground italic mt-2 bg-muted/30 p-2 rounded text-center">
                                Enable comparison in filters to see variance against a prior period.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
}

function CardSkeleton() {
    return (
        <div className="min-w-0 border border-border bg-card rounded-2xl p-4 shadow-sm animate-pulse h-[116px]">
            <div className="h-4 w-24 bg-muted rounded mb-4"></div>
            <div className="h-7 w-32 bg-muted rounded mb-6"></div>
            <div className="h-3 w-40 bg-muted rounded"></div>
        </div>
    );
}

export function SummaryCards({ validation }: Props) {
    const { summary, comparisonSummary, accounts, filters, appliedFilters, comparisonStatus, reportStatus } = useBalanceSheet();
    const isComparisonEnabled = appliedFilters?.includeComparison === true;

    if (reportStatus === "loading-initial") {
        return (
            <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>
        );
    }

    if (summary === null || accounts.length === 0 || reportStatus === "not-generated" || reportStatus === "initial-error") {
        return null;
    }

    return (
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCardItem
                title="Total Assets"
                currentValue={summary?.totalAssets || 0}
                priorValue={comparisonStatus === "available" ? comparisonSummary?.totalAssets ?? null : null}
                icon={<BarChart3 className="w-5 h-5 text-muted-foreground" />}
                isAlertCard={false}
                isBalanced={validation.isBalanced}
                isComparisonEnabled={isComparisonEnabled}
                comparisonStatus={comparisonStatus}
                comparisonBasis={appliedFilters?.comparisonBasis ?? filters.comparisonBasis}
            />
            
            <SummaryCardItem
                title="Total Liabilities"
                currentValue={summary?.totalLiabilities || 0}
                priorValue={comparisonStatus === "available" ? comparisonSummary?.totalLiabilities ?? null : null}
                icon={<ShieldCheck className="w-5 h-5 text-muted-foreground" />}
                isAlertCard={false}
                isBalanced={validation.isBalanced}
                isComparisonEnabled={isComparisonEnabled}
                comparisonStatus={comparisonStatus}
                comparisonBasis={appliedFilters?.comparisonBasis ?? filters.comparisonBasis}
            />
            
            <SummaryCardItem
                title="Total Equity"
                currentValue={summary?.totalEquity || 0}
                priorValue={comparisonStatus === "available" ? comparisonSummary?.totalEquity ?? null : null}
                icon={<FileText className="w-5 h-5 text-muted-foreground" />}
                isAlertCard={false}
                isBalanced={validation.isBalanced}
                isComparisonEnabled={isComparisonEnabled}
                comparisonStatus={comparisonStatus}
                comparisonBasis={appliedFilters?.comparisonBasis ?? filters.comparisonBasis}
            />
            
            <SummaryCardItem
                title="Balance Variance"
                currentValue={summary?.balanceVariance || 0}
                priorValue={comparisonStatus === "available" ? comparisonSummary?.balanceVariance ?? null : null}
                icon={<AlertCircle className={cn("w-5 h-5", validation.isBalanced ? "text-muted-foreground" : "text-destructive")} />}
                isAlertCard={true}
                isBalanced={validation.isBalanced}
                isComparisonEnabled={isComparisonEnabled}
                comparisonStatus={comparisonStatus}
                comparisonBasis={appliedFilters?.comparisonBasis ?? filters.comparisonBasis}
            />
        </div>
    );
}
