"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { AssetTableData } from "../../types";

export const columns: ColumnDef<AssetTableData>[] = [
  {
    accessorKey: "item_name", // Directly use the key from your merged API response
    header: "Item Name",
    cell: ({ row }) => {
      const name = row.original.item_name;
      return (
        <div className="flex flex-col">
          <span className="font-medium">{name || "N/A"}</span>
          {!name && (
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
    cell: ({ row }) => row.getValue("barcode") || "—",
  },
  {
    accessorKey: "department_name",
    header: "Department",
    cell: ({ row }) => row.getValue("department_name") || "—",
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
    header: "Quantity",
  },
  {
    accessorKey: "assigned_to_name", // Use the key we created in route.ts
    header: "Assigned To",
    cell: ({ row }) => {
      const name = row.original.assigned_to_name;
      return <span>{name || "Unassigned"}</span>;
    },
  },
];
