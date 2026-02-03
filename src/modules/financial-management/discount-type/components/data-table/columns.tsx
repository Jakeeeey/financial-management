"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

import type { DiscountTypeRow } from "../../type";
import { DataTableColumnHeader } from "./table-column-header";
import { formatPercentCompact } from "../../type";

export const columns: ColumnDef<DiscountTypeRow>[] = [
  {
    accessorKey: "discount_type",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Discount Type" />,
    cell: ({ row }) => <span className="font-semibold">{row.original.discount_type}</span>,
  },
  {
    accessorKey: "total_percent",
    header: ({ column }) => <DataTableColumnHeader column={column} label="Total Percent" />,
    cell: ({ row }) => <span className="text-sm">{formatPercentCompact(row.original.total_percent)}</span>,
  },
  {
    id: "applied_lines",
    header: "Applied Lines (in order)",
    cell: ({ row }) => {
      const lines = row.original.applied_lines ?? [];
      if (!lines.length) return <span className="text-muted-foreground">—</span>;

      return (
        <div className="flex flex-wrap gap-2">
          {lines.map((l, idx) => (
            <Badge key={`${l.line_id}-${idx}`} variant="secondary">
              {l.code} ({Number(l.percentage).toFixed(0)}%)
            </Badge>
          ))}
        </div>
      );
    },
  },
];
