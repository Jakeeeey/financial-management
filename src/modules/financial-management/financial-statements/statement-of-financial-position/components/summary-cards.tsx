import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ValidationStatus } from "../types";
import { BarChart3, ShieldCheck, FileText, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBalanceSheet } from "../hooks/useBalanceSheet";

interface Props {
    validation: ValidationStatus;
}

function SummaryCardItem({
    id, 
    title, 
    currentValue, 
    priorValue, 
    icon, 
    isAlertCard, 
    isBalanced, 
    isComparisonEnabled, 
    comparisonBasis
}: {
    id: string; 
    title: string; 
    currentValue: number; 
    priorValue: number; 
    icon: React.ReactNode; 
    isAlertCard: boolean; 
    isBalanced: boolean; 
    isComparisonEnabled: boolean; 
    comparisonBasis: string;
}) {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Calculate the variance between Current and Prior (Current - Prior)
    const varianceAmount = currentValue - priorValue;
    const isIncrease = varianceAmount > 0;
    const isDecrease = varianceAmount < 0;

    const formatCurrency = (value: number | undefined) => {
        if (value === undefined) return "₱0.00";
        const isNegative = value < 0;
        const formatted = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return isNegative ? `-₱${formatted}` : `₱${formatted}`;
    };

    return (
        <Card className={cn("shadow-none border flex flex-col p-5 py-6 transition-all duration-300", isAlertCard && !isBalanced && "border-destructive/30 bg-destructive/10")}>
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
                        {isComparisonEnabled ? (
                            <>
                                <div className="flex justify-between items-center">
                                    <span className="text-muted-foreground">Prior Period {comparisonBasis === 'match' ? '(Matched)' : ''}</span>
                                    <span className="font-medium">{formatCurrency(priorValue)}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1 mt-1 border-t border-border/50">
                                    <span className="text-muted-foreground">Variance</span>
                                    <span className={cn(
                                        "font-bold",
                                        isIncrease ? "text-success" : (isDecrease ? "text-destructive" : "")
                                    )}>
                                        {isIncrease ? "+" : ""}{formatCurrency(varianceAmount)}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="text-[10px] text-muted-foreground italic mt-2 bg-muted/30 p-2 rounded text-center">
                                Enable comparison in filters to see variance against a prior period.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </Card>
    );
}

export function SummaryCards({ validation }: Props) {
    const { summary, comparisonSummary, filters } = useBalanceSheet();
    const isComparisonEnabled = filters.includeComparison;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCardItem
                id="assets"
                title="Total Assets"
                currentValue={summary?.totalAssets || 0}
                priorValue={comparisonSummary?.totalAssets || 0}
                icon={<BarChart3 className="w-5 h-5 text-muted-foreground" />}
                isAlertCard={false}
                isBalanced={validation.isBalanced}
                isComparisonEnabled={isComparisonEnabled}
                comparisonBasis={filters.comparisonBasis}
            />
            
            <SummaryCardItem
                id="liabilities"
                title="Total Liabilities"
                currentValue={summary?.totalLiabilities || 0}
                priorValue={comparisonSummary?.totalLiabilities || 0}
                icon={<ShieldCheck className="w-5 h-5 text-muted-foreground" />}
                isAlertCard={false}
                isBalanced={validation.isBalanced}
                isComparisonEnabled={isComparisonEnabled}
                comparisonBasis={filters.comparisonBasis}
            />
            
            <SummaryCardItem
                id="equity"
                title="Total Equity"
                currentValue={summary?.totalEquity || 0}
                priorValue={comparisonSummary?.totalEquity || 0}
                icon={<FileText className="w-5 h-5 text-muted-foreground" />}
                isAlertCard={false}
                isBalanced={validation.isBalanced}
                isComparisonEnabled={isComparisonEnabled}
                comparisonBasis={filters.comparisonBasis}
            />
            
            <SummaryCardItem
                id="variance"
                title="Balance Variance"
                currentValue={summary?.balanceVariance || 0}
                priorValue={comparisonSummary?.balanceVariance || 0}
                icon={<AlertCircle className={cn("w-5 h-5", validation.isBalanced ? "text-muted-foreground" : "text-destructive")} />}
                isAlertCard={true}
                isBalanced={validation.isBalanced}
                isComparisonEnabled={isComparisonEnabled}
                comparisonBasis={filters.comparisonBasis}
            />
        </div>
    );
}
