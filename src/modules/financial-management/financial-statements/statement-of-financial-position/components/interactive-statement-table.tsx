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

const formatReportDate = (value: string) => new Intl.DateTimeFormat("en-PH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
}).format(new Date(`${value}T00:00:00Z`));

export function InteractiveStatementTable() {
    const { accounts, reportStatus, appliedFilters, comparisonStatus } = useBalanceSheet();
    const [selectedAccount, setSelectedAccount] = useState<FinancialAccount | null>(null);
    const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);
    const comparisonEnabled = appliedFilters?.includeComparison === true;

    const handleDrillDown = (account: FinancialAccount) => {
        setSelectedAccount(account);
        setIsDrillDownOpen(true);
    };
    const formatCurrency = (value: number) => {
        const magnitude = Math.abs(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return value < 0 ? `-\u20B1${magnitude}` : `\u20B1${magnitude}`;
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
                    {isPositive ? "+" : ""}{percentage}%
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
            header: () => <div className="text-right">As of {appliedFilters ? formatReportDate(appliedFilters.endDate) : "date unavailable"}</div>,
            cell: ({ row }) => (
                <div className="flex flex-col items-end font-medium">
                    <span>{formatCurrency(row.original.currentPeriod)}</span>
                    {row.original.currentBalanceStatus === "zero" && (
                        <span className="text-xs font-normal text-muted-foreground">Zero balance</span>
                    )}
                </div>
            )
        },
    ];

    if (comparisonEnabled) {
        columns.push(
            {
                accessorKey: "priorPeriod",
                header: () => <div className="text-right">As of {formatReportDate(appliedFilters!.comparisonEndDate)}</div>,
                cell: ({ row }) => (
                    <div className="flex flex-col items-end text-muted-foreground font-medium">
                        {row.original.comparisonBalanceStatus === "unavailable" ? (
                            <span className="text-sm">Comparison unavailable</span>
                        ) : (
                            <span>{formatCurrency(row.original.priorPeriod ?? 0)}</span>
                        )}
                        {row.original.comparisonBalanceStatus === "zero" && (
                            <span className="text-xs font-normal">Zero balance</span>
                        )}
                    </div>
                )
            },
            {
                accessorKey: "variance",
                header: () => <div className="text-right">Variance</div>,
                cell: ({ row }) => row.original.variance === null || row.original.variancePercentage === null
                    ? <div className="text-right text-sm text-muted-foreground">Comparison unavailable</div>
                    : <div className="text-right">{formatVariance(row.original.variance, row.original.variancePercentage)}</div>
            }
        );
    }

    columns.push({
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
    });

    if (reportStatus === "loading-initial") {
        return (
            <Card className="min-w-0 overflow-hidden shadow-none border" aria-busy="true">
                <CardHeader className="pb-3 border-b border-border/50">
                    <div className="space-y-2">
                        <div className="h-5 w-48 animate-pulse rounded bg-muted" />
                        <div className="h-4 w-64 max-w-full animate-pulse rounded bg-muted" />
                    </div>
                </CardHeader>
                <CardContent className="min-w-0 overflow-hidden p-4 pt-6">
                    <div className="overflow-x-auto">
                        <div className="min-w-[720px] space-y-3">
                            <div className="grid grid-cols-[2fr_1fr_1.2fr_1.2fr_1fr_0.8fr] gap-4 border-b pb-3">
                                {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-4 animate-pulse rounded bg-muted" />)}
                            </div>
                            {Array.from({ length: 6 }, (_, rowIndex) => (
                                <div key={rowIndex} className="grid grid-cols-[2fr_1fr_1.2fr_1.2fr_1fr_0.8fr] gap-4 border-b py-3">
                                    {Array.from({ length: 6 }, (_, columnIndex) => (
                                        <div key={columnIndex} className="h-4 animate-pulse rounded bg-muted" />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (reportStatus === "not-generated" || reportStatus === "initial-error") {
        return null;
    }
    return (
        <Card className="min-w-0 overflow-hidden shadow-none border" aria-busy={reportStatus === "refreshing"}>
            <CardHeader className="pb-3 border-b border-border/50">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <CardTitle className="text-base font-semibold">Interactive Statement</CardTitle>
                            <Badge variant="secondary" className="font-normal border">Sorted by Variance</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            As of {appliedFilters ? formatReportDate(appliedFilters.endDate) : "date unavailable"}
                            {comparisonEnabled && (
                                <> &middot; Comparison as of {formatReportDate(appliedFilters!.comparisonEndDate)}
                                    {comparisonStatus === "unavailable" && <> &middot; Comparison unavailable</>}</>
                            )}
                        </p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden p-4 pt-6">
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
