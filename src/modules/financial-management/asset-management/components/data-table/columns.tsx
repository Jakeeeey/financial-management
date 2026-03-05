"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPHP } from "@/lib/utils";
import { ColumnDef } from "@tanstack/react-table";
import {
  AlertTriangle,
  Ban,
  Building,
  Calendar,
  EllipsisVertical,
  Eye,
  Package,
  ShieldCheck,
  SquarePen,
  Tag,
  Wrench,
} from "lucide-react";
import { AssetTableData } from "../../types";
import { getDepreciatedValue } from "../../utils/lib";
import { DataTableColumnHeader } from "./table-column-header";

// --- Sub-components ---

const AssetCell = ({
  imageId,
  itemName,
}: {
  imageId: string | null;
  itemName: string;
}) => (
  <div className="flex items-center gap-3">
    <div className="h-10 w-10 overflow-hidden rounded-md border bg-muted flex items-center justify-center shrink-0">
      {imageId ? (
        <img
          src={`/api/fm/asset-management/asset-image-view?id=${imageId}`}
          alt={itemName}
          className="h-full w-full object-cover transition-all hover:scale-110"
        />
      ) : (
        <Package className="h-5 w-5 text-muted-foreground/50" />
      )}
    </div>
  </div>
);

const ConditionBadge = ({ condition }: { condition: string }) => {
  const variants: Record<
    string,
    "default" | "destructive" | "outline" | "secondary"
  > = {
    Good: "default",
    Bad: "destructive",
    "Under Maintenance": "secondary",
    Discontinued: "outline",
  };
  return <Badge variant={variants[condition] || "outline"}>{condition}</Badge>;
};

const ProjectedValueHeader = ({ table }: any) => {
  const meta = table.options.meta;
  return (
    <Select
      defaultValue="now"
      onValueChange={(val) => {
        const newDate = new Date();
        if (val === "1d") newDate.setDate(newDate.getDate() + 1);
        else if (val === "1m") newDate.setMonth(newDate.getMonth() + 1);
        else if (val === "1y") newDate.setFullYear(newDate.getFullYear() + 1);
        meta?.setProjectionDate(newDate);
      }}
    >
      <SelectTrigger className="h-7 w-fit border-none bg-transparent p-0 focus:ring-0 font-bold text-muted-foreground hover:text-foreground transition-colors">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="now">Projected Value</SelectItem>
        <SelectItem value="1d">In 1 Day</SelectItem>
        <SelectItem value="1m">In 1 Month</SelectItem>
        <SelectItem value="1y">In 1 Year</SelectItem>
      </SelectContent>
    </Select>
  );
};

// --- Column Definitions ---

export const columns: ColumnDef<AssetTableData>[] = [
  {
    accessorKey: "item_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Asset" />
    ),
    meta: {
      label: "Item Name",
      placeholder: "Search assets...",
      variant: "text",
    },
    cell: ({ row }) => {
      const name = row.original.item_name;
      const isValid = name && name !== "N/A";
      return (
        <div className="flex items-center gap-3 group max-w-62.5">
          <AssetCell imageId={row.original.item_image} itemName={name} />
          <div className="flex flex-col min-w-0">
            <span
              className={`font-semibold truncate ${!isValid ? "text-muted-foreground italic" : "text-foreground"}`}
            >
              {name || "Unnamed Asset"}
            </span>
            {!isValid && (
              <span className="text-[10px] text-orange-600 font-bold uppercase tracking-tight">
                Missing Item Link
              </span>
            )}
          </div>
        </div>
      );
    },
  },
  {
    accessorKey: "classification_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Classification" />
    ),
    meta: {
      label: "Classification",
      variant: "text",
      icon: Tag,
    },
    cell: ({ row }) =>
      row.getValue("classification_name") || (
        <span className="text-muted-foreground italic">N/A</span>
      ),
  },
  {
    accessorKey: "department_name",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Department" />
    ),
    meta: {
      label: "Department",
      variant: "text",
      icon: Building,
    },
    cell: ({ row }) =>
      (row.getValue("department_name") as string) || (
        <span className="text-muted-foreground italic">Unassigned</span>
      ),
  },
  {
    accessorKey: "condition",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Condition" />
    ),
    meta: {
      label: "Condition",
      variant: "multiSelect",
      options: [
        { label: "Good", value: "Good", icon: ShieldCheck },
        { label: "Bad", value: "Bad", icon: AlertTriangle },
        { label: "Maintenance", value: "Under Maintenance", icon: Wrench },
        { label: "Discontinued", value: "Discontinued", icon: Ban },
      ],
    },
    filterFn: "arrIncludesSome",
    cell: ({ row }) => <ConditionBadge condition={row.getValue("condition")} />,
  },
  {
    accessorKey: "quantity",
    header: ({ table }) => (
      <DataTableColumnHeader
        column={table.getColumn("quantity")!}
        label="Qty"
      />
    ),
    cell: ({ row }) => (
      <div className="font-medium text-center">{row.getValue("quantity")}</div>
    ),
  },
  {
    accessorKey: "cost_per_item",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Cost per Item" />
    ),
    cell: ({ row }) => <div>{formatPHP(row.getValue("cost_per_item"))}</div>,
  },
  {
    accessorKey: "total_value",
    header: ({ table }) => <ProjectedValueHeader table={table} />,
    cell: ({ row, table }) => {
      const asset = row.original;
      const meta = table.options.meta as any;
      const viewDate = meta?.projectionDate || new Date();

      const projectedValue = getDepreciatedValue(
        Number(asset.cost_per_item),
        Number(asset.quantity),
        Number(asset.life_span),
        asset.date_acquired,
        viewDate,
      );

      return <span className="text-primary ">{formatPHP(projectedValue)}</span>;
    },
  },
  {
    accessorKey: "date_acquired",
    header: ({ column }) => (
      <DataTableColumnHeader column={column} label="Acquired" />
    ),
    cell: ({ row }) => {
      const date = row.getValue("date_acquired") as string;
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground/80" />
          <span className="text-xs font-medium">
            {date
              ? new Intl.DateTimeFormat("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                }).format(new Date(date))
              : "—"}
          </span>
        </div>
      );
    },
  },
  {
    id: "actions",
    cell: ({ row, table }) => {
      const meta = table.options.meta as any;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0" size="icon">
              <EllipsisVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => meta?.onEdit(row.original)}>
              <SquarePen className="mr-2 h-4 w-4" /> Edit Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => meta?.onView(row.original)}>
              <Eye className="mr-2 h-4 w-4" /> View Details
            </DropdownMenuItem>
            {/* <DropdownMenuSeparator /> */}
            {/* <DropdownMenuItem variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Delete Asset
            </DropdownMenuItem> */}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
