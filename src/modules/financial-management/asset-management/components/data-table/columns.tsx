"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { AssetTableData } from "../../types";
import { formatPHP, getDepreciatedValue } from "../../utils/lib";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Package } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";

export const columns: ColumnDef<AssetTableData>[] = [
  {
    accessorKey: "item_image",
    header: "Asset",
    cell: ({ row }) => {
      const imageId = row.getValue("item_image") as string | null;
      const itemName = row.original.item_name;

      const proxyUrl = imageId
        ? `/api/fm/asset-image-view?id=${imageId}`
        : null;

      return (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-md border bg-muted flex items-center justify-center">
            {proxyUrl ? (
              <img
                src={proxyUrl}
                alt={itemName}
                className="h-full w-full object-cover transition-all hover:scale-110"
              />
            ) : (
              <Package className="h-5 w-5 text-muted-foreground/50" />
            )}
          </div>
        </div>
      );
    },
  },
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
    accessorKey: "rfid_code",
    header: "RFID Code",
    cell: ({ row }) => {
      const rfid = row.getValue("rfid_code") as string | null;
      return rfid || <span className="text-muted-foreground">—</span>;
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
    accessorKey: "total_value",
    header: ({ table }) => {
      const meta = table.options.meta as any;
      const setProjectionDate = meta?.setProjectionDate;

      return (
        <div className="flex items-center gap-2">
          <span>Projected Value</span>
          <Select
            defaultValue="now"
            onValueChange={(val) => {
              const newDate = new Date();
              if (val === "1d") newDate.setDate(newDate.getDate() + 1);
              else if (val === "1m") newDate.setMonth(newDate.getMonth() + 1);
              else if (val === "1y")
                newDate.setFullYear(newDate.getFullYear() + 1);
              setProjectionDate?.(newDate);
            }}
          >
            <SelectTrigger className="h-7 w-25 border-none bg-transparent hover:bg-muted/50 transition-colors">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="now">Current</SelectItem>
              <SelectItem value="1d">In 1 Day</SelectItem>
              <SelectItem value="1m">In 1 Month</SelectItem>
              <SelectItem value="1y">In 1 Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    },
    cell: ({ row, table }) => {
      const asset = row.original;
      const meta = table.options.meta as any;
      const projectionDate = meta?.projectionDate || new Date();

      const projectedValue = getDepreciatedValue(
        Number(asset.cost_per_item),
        Number(asset.quantity),
        Number(asset.life_span),
        asset.date_acquired,
        projectionDate,
      );

      return (
        <span className="font-mono font-medium text-primary whitespace-nowrap">
          {formatPHP(projectedValue)}
        </span>
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
