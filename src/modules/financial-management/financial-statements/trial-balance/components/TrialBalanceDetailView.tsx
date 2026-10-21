"use client";

import { DataTable } from "@/components/ui/new-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { TrialBalanceItem } from "../types/trial-balance.schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTrialBalanceAmount, getPeriodMovementLabel } from "../utils/money";

export const columns: ColumnDef<TrialBalanceItem>[] = [
  {
    accessorKey: "glCode",
    header: "Code",
    cell: ({ row }) => <span className="font-mono font-medium">{row.original.glCode}</span>,
  },
  {
    accessorKey: "accountTitle",
    header: "Account Title",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-semibold">{row.original.accountTitle}</span>
        <span className="text-xs text-muted-foreground">
          {row.original.accountCategory} • {row.original.accountType}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "totalDebit",
    header: () => <div className="text-right">Period debit activity</div>,
    cell: ({ row }) => (
      <div className={cn("text-right font-medium font-mono tabular-nums whitespace-nowrap", row.original.totalDebit < 0 && "text-destructive")}>
        {formatTrialBalanceAmount(row.original.totalDebit)}
      </div>
    ),
  },
  {
    accessorKey: "totalCredit",
    header: () => <div className="text-right">Period credit activity</div>,
    cell: ({ row }) => (
      <div className={cn("text-right font-medium font-mono tabular-nums whitespace-nowrap", row.original.totalCredit < 0 && "text-destructive")}>
        {formatTrialBalanceAmount(row.original.totalCredit)}
      </div>
    ),
  },
  {
    accessorKey: "netBalance",
    header: () => <div className="text-right">Net period movement</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <span className="font-bold font-mono tabular-nums whitespace-nowrap">
          {formatTrialBalanceAmount(row.original.netBalance)}
        </span>
        <span className="block text-xs text-muted-foreground">{getPeriodMovementLabel(row.original)}</span>
      </div>
    ),
  },
  {
    accessorKey: "reviewFlag",
    header: "Review Flag",
    cell: ({ row }) => {
      const flag = row.original.reviewFlag;
      const flagLower = flag.toLowerCase();
      return (
        <Badge
          variant={
            flagLower === "critical" ? "destructive" : flagLower === "high" ? "outline" : "secondary"
          }
          className={cn(
            "capitalize",
            flagLower === "high" && "border-orange-500 text-orange-500 bg-orange-50"
          )}
        >
          {flag}
        </Badge>
      );
    },
  },
];

export function TrialBalanceDetailView({
  data,
  isLoading,
}: {
  data: TrialBalanceItem[];
  isLoading: boolean;
}) {
  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        emptyTitle="No Accounts Found"
        emptyDescription="Try adjusting your filters or date range to see results."
        actionComponent={
          <Badge variant="outline" className="h-8 px-3 font-medium">
            {data.length} Accounts
          </Badge>
        }
      />
    </div>
  );
}
