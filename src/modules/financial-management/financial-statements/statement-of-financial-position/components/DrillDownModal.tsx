import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/new-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { FinancialAccount } from "../types";
import { useBalanceSheet } from "../hooks/useBalanceSheet";
import { BalanceSheetDrillDownResponse, DrillDownEntry } from "../types/balance-sheet.schema";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
    account: FinancialAccount | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DrillDownModal({ account, isOpen, onOpenChange }: Props) {
    const { appliedFilters } = useBalanceSheet();
    const [data, setData] = useState<BalanceSheetDrillDownResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [retryCount, setRetryCount] = useState(0);

    useEffect(() => {
        if (!isOpen || !account || !appliedFilters) return;

        let isMounted = true;
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            setData(null);
            try {
                const query = new URLSearchParams({
                    coaId: String(account.coaId ?? Number(account.id)),
                    startDate: appliedFilters.startDate,
                    endDate: appliedFilters.endDate,
                    status: appliedFilters.status,
                });
                if (appliedFilters.divisionName) query.set("divisionName", appliedFilters.divisionName);
                if (appliedFilters.departmentName) query.set("departmentName", appliedFilters.departmentName);
                const res = await fetch(`/api/fm/financial-statements/balance-sheet/drill-down?${query.toString()}`);
                if (!res.ok) {
                    throw new Error("Failed to fetch drill-down data");
                }
                const result = await res.json();

                if (isMounted) {
                    setData(result as BalanceSheetDrillDownResponse);
                }
            } catch (err: unknown) {
                if (isMounted) setError(err instanceof Error ? err.message : "An error occurred");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData();
        return () => {
            isMounted = false;
        };
    }, [isOpen, account, appliedFilters, retryCount]);

    const formatCurrency = (val: number | null | undefined) => {
        if (val === null || val === undefined) return "—";
        const magnitude = Math.abs(val).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return val < 0 ? `-₱${magnitude}` : `₱${magnitude}`;
    };

    const formatReportDate = (value?: string) => value
        ? new Intl.DateTimeFormat("en-PH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
            .format(new Date(`${value}T00:00:00Z`))
        : "date unavailable";

    const formatTransactionDate = (value: string) => {
        try {
            return new Intl.DateTimeFormat("en-PH", {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: "Asia/Manila",
            }).format(new Date(value));
        } catch {
            return value;
        }
    };

    const formatScopeValue = (value: string) => value || "All";
    const reportDifference = data && account
        ? Math.round((account.currentPeriod - data.closingBalance) * 100) / 100
        : null;

    const columns: ColumnDef<DrillDownEntry>[] = [
        {
            accessorKey: "source",
            header: "Source",
            cell: ({ row }) => <span className="font-bold">{row.original.source}</span>
        },
        {
            accessorKey: "reference",
            header: "Reference",
            cell: ({ row }) => <span className="text-muted-foreground font-medium">{row.original.reference}</span>
        },
        {
            accessorKey: "date",
            header: "Date",
            cell: ({ row }) => <span className="text-muted-foreground font-medium">{formatTransactionDate(row.original.date)}</span>
        },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => <span className="font-medium text-foreground/80">{row.original.description}</span>
        },
        {
            accessorKey: "amount",
            header: () => <div className="text-right">Amount</div>,
            cell: ({ row }) => (
                <div className="text-right font-bold">
                    {formatCurrency(row.original.amount)}
                </div>
            )
        }
    ];

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            {/* 1. Modal constrained to viewport (`max-h-[90vh]`), uses `flex flex-col` to control internal layout instead of grid */}
            <DialogContent className="!max-w-[1200px] w-[95vw] sm:max-w-[1200px] p-6 gap-4 bg-card border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-0 shrink-0">
                    <DialogTitle className="text-3xl font-bold tracking-tight">
                        {account?.account || "Account Details"}
                    </DialogTitle>
                </DialogHeader>

                {/* Summary Section - `shrink-0` ensures this fixed header doesn't get crushed when table grows */}
                <div className="grid shrink-0 grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <Card className="shadow-none border bg-muted/5 transition-colors hover:bg-muted/10">
                        <CardContent className="p-4 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Statement balance as of {formatReportDate(appliedFilters?.endDate)}</span>
                            <span className="text-2xl font-black tracking-tighter">{formatCurrency(account?.currentPeriod)}</span>
                        </CardContent>
                    </Card>
                    <Card className="shadow-none border bg-muted/5 transition-colors hover:bg-muted/10">
                        <CardContent className="p-4 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Opening balance before {formatReportDate(appliedFilters?.startDate)}</span>
                            <span className="text-2xl font-black tracking-tighter">{formatCurrency(data?.openingBalance)}</span>
                        </CardContent>
                    </Card>
                    <Card className="shadow-none border bg-muted/5 transition-colors hover:bg-muted/10">
                        <CardContent className="p-4 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Net movement · {formatReportDate(appliedFilters?.startDate)} to {formatReportDate(appliedFilters?.endDate)}</span>
                            <span className="text-2xl font-black tracking-tighter">{formatCurrency(data?.periodMovement)}</span>
                            <span className="text-xs text-muted-foreground">All transactions matching the applied scope</span>
                        </CardContent>
                    </Card>
                    <Card className="shadow-none border bg-muted/5 transition-colors hover:bg-muted/10">
                        <CardContent className="p-4 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Ledger balance as of {formatReportDate(appliedFilters?.endDate)}</span>
                            <span className="text-2xl font-black tracking-tighter">{formatCurrency(data?.closingBalance)}</span>
                        </CardContent>
                    </Card>
                    <Card className="shadow-none border bg-muted/5 transition-colors hover:bg-muted/10">
                        <CardContent className="p-4 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Reconciliation difference</span>
                            <span className="text-2xl font-black tracking-tighter">{formatCurrency(data?.reconciliationDifference)}</span>
                            <span className="text-xs text-muted-foreground">Closing balance minus opening balance and net movement</span>
                        </CardContent>
                    </Card>
                </div>

                {appliedFilters && (
                    <p className="shrink-0 text-xs text-muted-foreground">
                        Applied scope: {appliedFilters.status || "All statuses"} · Division {formatScopeValue(appliedFilters.divisionName)} · Department {formatScopeValue(appliedFilters.departmentName)}
                    </p>
                )}

                {reportDifference !== null && Math.abs(reportDifference) >= 0.005 && (
                    <p role="status" className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700">
                        The inspected ledger balance differs from the displayed statement balance by {formatCurrency(reportDifference)}.
                    </p>
                )}

                {/* Main Table - `flex-1 overflow-y-auto` restricts height and enables smooth internal-level scrolling */}
                <div className="mt-0 flex-1 overflow-y-auto min-h-0 pr-2 pb-2 scrollbar-thin">
                    {isLoading ? (
                        <div className="h-[300px] flex items-center justify-center border rounded-xl bg-muted/5">
                            <div className="flex flex-col items-center gap-3 text-muted-foreground">
                                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm font-bold uppercase tracking-widest animate-pulse">Loading transaction history...</span>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-destructive border rounded-xl bg-destructive/5">
                            <span className="text-sm font-bold">{error}</span>
                            <Button type="button" variant="outline" onClick={() => setRetryCount(count => count + 1)}>
                                Retry inspection
                            </Button>
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={data?.transactions ?? []}
                            searchKey="description"
                            emptyTitle="No transactions found"
                            emptyDescription="There are no transactions for this account in the applied activity range."
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

