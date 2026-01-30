"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { AssetTableData } from "../../types";

export const columns: ColumnDef<AssetTableData>[] = [
  {
    accessorKey: "item_name",
    header: "Item Name",
    cell: ({ row }) => {
      const name = row.original.item_name;
      const isValid = name && name !== "N/A";
      return (
        <div className="flex flex-col">
          <span
            className={`font-medium ${!isValid ? "text-muted-foreground" : ""}`}
          >
            {name || "N/A"}
          </span>
          {!isValid && (
            <span className="text-[10px] text-orange-500 font-mono">
              Missing Item Link
            </span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "barcode",
    header: "Barcode",
    cell: ({ row }) => {
      const barcode = row.getValue("barcode") as string | null;
      return barcode || <span className="text-muted-foreground">—</span>;
    },
  },
  {
    accessorKey: "department_name",
    header: "Department",
    cell: ({ row }) => {
      const dept = row.getValue("department_name") as string;
      return dept || <span className="text-muted-foreground">Unassigned</span>;
    },
  },
  {
    accessorKey: "condition",
    header: "Condition",
    cell: ({ row }) => {
      const condition = row.getValue("condition") as string;
      const variants: Record<
        string,
        "default" | "destructive" | "outline" | "secondary"
      > = {
        Good: "default",
        Bad: "destructive",
        "Under Maintenance": "secondary",
        Discontinued: "outline",
      };
      return (
        <Badge variant={variants[condition] || "outline"}>{condition}</Badge>
      );
    },
  },
  {
    accessorKey: "quantity",
    header: "Qty",
    cell: ({ row }) => {
      const qty = row.getValue("quantity") as number;
      return <div className="text-center font-medium">{qty}</div>;
    },
  },
  {
    accessorKey: "cost_per_item",
    header: "Unit Cost",
    cell: ({ row }) => {
      const cost = row.getValue("cost_per_item") as number;
      return (
        <div className="font-mono">
          ₱{cost.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </div>
      );
    },
  },
  {
    accessorKey: "total",
    header: "Total Value",
    cell: ({ row }) => {
      const total = row.getValue("total") as number;
      return (
        <div className="font-mono font-semibold">
          ₱{total.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
        </div>
      );
    },
  },
  {
    accessorKey: "assigned_to_name",
    header: "Assigned To",
    cell: ({ row }) => {
      const name = row.original.assigned_to_name;
      const isAssigned = name && name !== "Unassigned";
      return (
        <span className={!isAssigned ? "text-muted-foreground italic" : ""}>
          {name || "Unassigned"}
        </span>
      );
    },
  },
  {
    accessorKey: "date_acquired",
    header: "Date Acquired",
    cell: ({ row }) => {
      const date = row.getValue("date_acquired") as string;
      if (!date) return <span className="text-muted-foreground">—</span>;

      const formatted = new Date(date).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
      return <span className="text-sm">{formatted}</span>;
    },
  },
];
