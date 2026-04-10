import { Card, CardContent } from "@/components/ui/card";
import { ValidationStatus } from "../types";
import { BarChart3, ShieldCheck, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
    validation: ValidationStatus;
}

export function SummaryCards({ validation }: Props) {
    const formatCurrency = (value: number) => {
        return `\u20B1${Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Assets */}
            <Card className="shadow-none border flex flex-col justify-between p-5 py-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Total Assets</p>
                        <h3 className="text-2xl font-bold">{formatCurrency(validation.totalAssets)}</h3>
                    </div>
                    <div className="p-2 bg-muted rounded-full">
                        <BarChart3 className="w-5 h-5 text-muted-foreground" />
                    </div>
                </div>
                <div className="mt-4">
                    <button className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                        View breakdown <span className="text-[10px]">▼</span>
                    </button>
                </div>
            </Card>

            {/* Total Liabilities */}
            <Card className="shadow-none border flex flex-col justify-between p-5 py-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Total Liabilities</p>
                        <h3 className="text-2xl font-bold">{formatCurrency(validation.totalLiabilities)}</h3>
                    </div>
                    <div className="p-2 bg-muted rounded-full">
                        <ShieldCheck className="w-5 h-5 text-muted-foreground" />
                    </div>
                </div>
                <div className="mt-4">
                    <button className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                        View breakdown <span className="text-[10px]">▼</span>
                    </button>
                </div>
            </Card>

            {/* Total Equity */}
            <Card className="shadow-none border flex flex-col justify-between p-5 py-6">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Total Equity</p>
                        <h3 className="text-2xl font-bold">{formatCurrency(validation.totalEquity)}</h3>
                    </div>
                    <div className="p-2 bg-muted rounded-full">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                    </div>
                </div>
                <div className="mt-4">
                    <button className="text-xs text-primary hover:underline flex items-center gap-1 font-medium invisible">
                        View breakdown <span className="text-[10px]">▼</span>
                    </button>
                </div>
            </Card>

            {/* Balance Variance */}
            <Card className={cn("shadow-none border flex flex-col justify-between p-5 py-6", !validation.isBalanced && "border-destructive/30 bg-destructive/10")}>
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground mb-1">Balance Variance</p>
                        <h3 className={cn("text-2xl font-bold", !validation.isBalanced && "text-destructive")}>
                            {validation.variance < 0 && "-"}{formatCurrency(validation.variance)}
                        </h3>
                    </div>
                    <div className={cn("p-2 rounded-full", validation.isBalanced ? "bg-muted" : "bg-destructive/10")}>
                        <AlertCircle className={cn("w-5 h-5", validation.isBalanced ? "text-muted-foreground" : "text-destructive")} />
                    </div>
                </div>
                <div className="mt-4">
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                        Difference between Assets and Liabilities + Equity
                    </p>
                </div>
            </Card>

        </div>
    );
}
