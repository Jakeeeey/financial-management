import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/ui/new-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { FinancialAccount } from "../types";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { DrillDownModal } from "./DrillDownModal";

import { useBalanceSheet } from "../hooks/useBalanceSheet";

export function InteractiveStatementTable() {
    const { accounts, isLoading, isInitialLoad } = useBalanceSheet();
    const [selectedAccount, setSelectedAccount] = useState<FinancialAccount | null>(null);
    const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);

    const handleDrillDown = (account: FinancialAccount) => {
        setSelectedAccount(account);
        setIsDrillDownOpen(true);
    };
    const formatCurrency = (value: number) => {
        return `\u20B1${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    const formatVariance = (variance: number, percentage: number) => {
        const isPositive = variance > 0;
        const colorClass = isPositive ? "text-success" : (variance < 0 ? "text-destructive" : "text-muted-foreground");
        const prefix = isPositive ? "+" : "";
        
        return (
            <div className="flex flex-col items-end">
                <span className={cn("font-medium", colorClass)}>
                    {prefix}{formatCurrency(variance)}
                </span>
                <span className={cn("text-xs", colorClass)}>
                    {Math.abs(percentage)}%
                </span>
            </div>
        );
    };

    const columns: ColumnDef<FinancialAccount>[] = [
        {
            accessorKey: "account",
            header: "Account",
            cell: ({ row }) => {
                const item = row.original;
                return (
                    <div className="flex flex-col mt-1 mb-1">
                        <span className="font-medium">{item.account}</span>
                        <span className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
                            {item.type} &bull; {item.group}
                        </span>
                    </div>
                );
            }
        },
        {
            accessorKey: "code",
            header: "Code",
            cell: ({ row }) => <span className="text-muted-foreground font-medium">{row.original.code}</span>
        },
        {
            accessorKey: "currentPeriod",
            header: () => <div className="text-right">Current Period</div>,
            cell: ({ row }) => (
                <div className="text-right font-medium">
                    {formatCurrency(row.original.currentPeriod)}
                </div>
            )
        },
        {
            accessorKey: "priorPeriod",
            header: () => <div className="text-right">Prior Period</div>,
            cell: ({ row }) => (
                <div className="text-right text-muted-foreground font-medium">
                    {formatCurrency(row.original.priorPeriod)}
                </div>
            )
        },
        {
            accessorKey: "variance",
            header: () => <div className="text-right">Variance</div>,
            cell: ({ row }) => {
                return (
                    <div className="text-right">
                        {formatVariance(row.original.variance, row.original.variancePercentage)}
                    </div>
                );
            }
        },
        {
            id: "actions",
            header: () => <div className="text-right">Action</div>,
            cell: ({ row }) => (
                <div className="text-right">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 rounded-full text-xs font-normal"
                        onClick={() => handleDrillDown(row.original)}
                    >
                        Drill Down
                    </Button>
                </div>
            )
        }
    ];

    if (isLoading) {
        return (
            <Card className="shadow-none border mt-4 h-[400px] flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading statement data...</p>
                </div>
            </Card>
        );
    }

    if (isInitialLoad) {
        return (
            <Card className="shadow-none border border-dashed mt-4 h-[400px] flex flex-col items-center justify-center bg-muted/20">
                <div className="bg-muted p-4 rounded-full mb-4">
                    <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                </div>
                <h3 className="text-lg font-bold text-foreground mb-1">No Statement Generated</h3>
                <p className="text-muted-foreground text-sm max-w-xs text-center">
                    Please adjust the filters above and click "Generate Report" to view the Statement of Financial Position.
                </p>
            </Card>
        );
    }

    return (
        <Card className="shadow-none border mt-4">
            <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <CardTitle className="text-base font-semibold">Interactive Statement</CardTitle>
                            <Badge variant="secondary" className="font-normal border">Sorted by Variance</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            As of 2026-03-31 &middot; Comparison: Linked to current date selection
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-4 pt-6">
                <DataTable 
                    columns={columns} 
                    data={accounts} 
                    searchKey="account" 
                    emptyTitle="No accounts found."
                    emptyDescription="Try adjusting your filters or search."
                />
            </CardContent>
            
            <DrillDownModal 
                isOpen={isDrillDownOpen}
                onOpenChange={setIsDrillDownOpen}
                account={selectedAccount}
            />
        </Card>
    );
}
