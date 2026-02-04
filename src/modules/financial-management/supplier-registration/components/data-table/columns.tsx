"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Supplier } from "@/modules/financial-management/supplier-registration/types/supplier.schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Eye, Pencil, Trash2 } from "lucide-react";
import { formatDate } from "@/modules/financial-management/supplier-registration/utils/utils";

interface ColumnsProps {
  onView: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
}

export const createColumns = ({
  onView,
  onEdit,
}: ColumnsProps): ColumnDef<Supplier>[] => [
  {
    accessorKey: "supplier_name",
    header: "Supplier Name",
    cell: ({ row }) => {
      const name = row.getValue("supplier_name") as string;
      const shortcut = row.original.supplier_shortcut;
      return (
        <div className="flex flex-col">
          <span className="font-medium">{name}</span>
          {shortcut && (
            <span className="text-xs text-muted-foreground">{shortcut}</span>
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "supplier_type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.getValue("supplier_type") as string;
      return <Badge variant="outline">{type}</Badge>;
    },
  },
  {
    accessorKey: "contact_person",
    header: "Contact Person",
  },
  {
    accessorKey: "tin_number",
    header: "TIN Number",
    cell: ({ row }) => {
      const tin = row.getValue("tin_number") as string;
      return <span className="font-mono text-sm">{tin}</span>;
    },
  },
  {
    accessorKey: "date_added",
    header: "Date Added",
    cell: ({ row }) => {
      const date = row.getValue("date_added") as string;
      return <span className="text-sm">{formatDate(date)}</span>;
    },
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => {
      const isActive = row.getValue("isActive") as number;
      return (
        <Badge variant={isActive === 1 ? "default" : "secondary"}>
          {isActive === 1 ? "Active" : "Inactive"}
        </Badge>
      );
    },
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => {
      const supplier = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onView(supplier)}>
              <Eye className="mr-2 h-4 w-4" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onEdit(supplier)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
