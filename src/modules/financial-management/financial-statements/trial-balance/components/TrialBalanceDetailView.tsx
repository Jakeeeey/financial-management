"use client";

import { DataTable } from "@/components/ui/new-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { TrialBalanceAccount } from "../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formatCurrency = (val: number) => {
  if (val === 0) return "—";
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(val);
};

export const columns: ColumnDef<TrialBalanceAccount>[] = [
  {
    accessorKey: "code",
    header: "Code",
    cell: ({ row }) => <span className="font-mono font-medium">{row.original.code}</span>,
  },
  {
    accessorKey: "title",
    header: "Account Title",
    cell: ({ row }) => (
      <div className="flex flex-col">
        <span className="font-semibold">{row.original.title}</span>
        <span className="text-xs text-muted-foreground">
          {row.original.branch} • {row.original.division} • {row.original.module} • {row.original.status} • {row.original.date}
        </span>
      </div>
    ),
  },
  {
    accessorKey: "debit",
    header: () => <div className="text-right">Debit</div>,
    cell: ({ row }) => (
      <div className={cn("text-right font-medium", row.original.debit < 0 && "text-destructive")}>
        {formatCurrency(row.original.debit)}
      </div>
    ),
  },
  {
    accessorKey: "credit",
    header: () => <div className="text-right">Credit</div>,
    cell: ({ row }) => (
      <div className={cn("text-right font-medium", row.original.credit < 0 && "text-destructive")}>
        {formatCurrency(row.original.credit)}
      </div>
    ),
  },
  {
    accessorKey: "reviewFlag",
    header: "Review Flag",
    cell: ({ row }) => {
      const flag = row.original.reviewFlag;
      return (
        <Badge
          variant={
            flag === "critical" ? "destructive" : flag === "high" ? "outline" : "secondary"
          }
          className={cn(
            "capitalize",
            flag === "high" && "border-orange-500 text-orange-500 bg-orange-50"
          )}
        >
          {flag}
        </Badge>
      );
    },
  },
];

export function TrialBalanceDetailView({ data }: { data: TrialBalanceAccount[] }) {
  return (
    <div className="space-y-4">
      <DataTable
        columns={columns}
        data={data}
        searchKey="title"
        emptyTitle="No Accounts Found"
        emptyDescription="Try adjusting your filters to see more results."
        actionComponent={
          <Badge variant="outline" className="h-8 px-3 font-medium">
            {data.length} Accounts Displayed
          </Badge>
        }
      />
    </div>
  );
}
