import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/new-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { FinancialAccount } from "../types";
import { useBalanceSheet } from "../hooks/useBalanceSheet";
import { DrillDownEntry } from "../types/balance-sheet.schema";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Props {
    account: FinancialAccount | null;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
}

export function DrillDownModal({ account, isOpen, onOpenChange }: Props) {
    const { filters } = useBalanceSheet();
    const [data, setData] = useState<DrillDownEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !account) return;

        let isMounted = true;
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            setData([]);
            try {
                const query = new URLSearchParams({
                    glCode: account.code,
                    startDate: filters.startDate,
                    endDate: filters.endDate,
                });
                const res = await fetch(`/api/fm/financial-statements/balance-sheet/drill-down?${query.toString()}`);
                if (!res.ok) {
                    throw new Error("Failed to fetch drill-down data");
                }
                const result = await res.json();

                if (isMounted) {
                    // Assuming result is DrillDownEntry[]
                    setData(Array.isArray(result) ? result : []);
                }
            } catch (err: any) {
                if (isMounted) setError(err.message || "An error occurred");
            } finally {
                if (isMounted) setIsLoading(false);
            }
        };

        fetchData();
        return () => {
            isMounted = false;
        };
    }, [isOpen, account, filters.startDate, filters.endDate]);

    const formatCurrency = (val: number | undefined) => {
        if (val === undefined) return "₱0.00";
        // Show absolute magnitude as requested (remove '-' signs)
        const absoluteValue = Math.abs(val);
        return `₱${absoluteValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

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
            cell: ({ row }) => {
                const dateStr = row.original.date;
                try {
                    const dateObj = new Date(dateStr);
                    return <span className="text-muted-foreground font-medium">{format(dateObj, "yyyy-MM-dd")}</span>;
                } catch {
                    return <span className="text-muted-foreground font-medium">{dateStr}</span>;
                }
            }
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start shrink-0">
                    <Card className="shadow-none border bg-muted/5 transition-colors hover:bg-muted/10">
                        <CardContent className="p-4 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Current Balance</span>
                            <span className="text-2xl font-black tracking-tighter">{formatCurrency(account?.currentPeriod)}</span>
                        </CardContent>
                    </Card>
                    <Card className="shadow-none border bg-muted/5 transition-colors hover:bg-muted/10">
                        <CardContent className="p-4 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Prior Balance</span>
                            <span className="text-2xl font-black tracking-tighter">{formatCurrency(account?.priorPeriod)}</span>
                        </CardContent>
                    </Card>
                    <Card className="shadow-none border bg-muted/5 transition-colors hover:bg-muted/10">
                        <CardContent className="p-4 flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Variance</span>
                            <span className="text-2xl font-black tracking-tighter">{formatCurrency(account?.variance)}</span>
                        </CardContent>
                    </Card>
                </div>

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
                        <div className="h-[300px] flex items-center justify-center text-destructive border rounded-xl bg-destructive/5">
                            <span className="text-sm font-bold">{error}</span>
                        </div>
                    ) : (
                        <DataTable
                            columns={columns}
                            data={data}
                            searchKey="description"
                            emptyTitle="No transactions found"
                            emptyDescription="There are no transactions for this account in the selected period."
                        />
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}

