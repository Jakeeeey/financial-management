"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
// Using a direct button for edit action instead of dropdown menu
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { PaymentTerm } from "../types";

interface PaymentTermsTableProps {
  terms: PaymentTerm[];
  isLoading: boolean;
  onEdit: (term: PaymentTerm) => void; // Added for functionality
  searchQuery?: string;
}

export function PaymentTermsTable({ terms, isLoading, onEdit, searchQuery = "" }: PaymentTermsTableProps) {
  "use no memo";
  const columns: ColumnDef<PaymentTerm>[] = [
    {
      id: "no",
      header: "No.",
      cell: ({ row }) => <span className="font-medium">{row.original.id}</span>,
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.getValue("name")}</span>,
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ row }) => {
        const raw = (row.getValue("description") as string) ?? "";
        const text = raw ?? "";
        if (!text) return "-";

        const max = 80;
        const needsTruncate = text.length > max;
        const preview = needsTruncate ? `${text.substring(0, max)}...` : text;

        if (!needsTruncate) return <span>{text}</span>;

        return (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block max-w-[320px] truncate cursor-help">{preview}</span>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[300px] sm:max-w-[400px]">
                <p className="text-xs leading-relaxed whitespace-pre-wrap break-words">{text}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      },
    },
    {
      accessorKey: "createdByName",
      header: "Created By",
      cell: ({ row }) => row.original.createdByName || "-",
    },
    {
      accessorKey: "days",
      header: "Days",
      cell: ({ row }) => {
        const days = row.getValue("days") as number;
        return <span>{days} day{days !== 1 ? "s" : ""}</span>;
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const paymentTerm = row.original;
        return (
          <div className="flex justify-end relative z-10">
            <Button
              variant="ghost"
              className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
              onClick={() => onEdit(paymentTerm)}
              aria-label={`Edit ${paymentTerm.name}`}
            >
              <span className="sr-only">Edit</span>
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: terms,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (isLoading) {
    return (
      <div className="rounded-md border">
        <Table className="table-auto">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[48px] text-left">No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="max-w-[40ch]">Description</TableHead>
              <TableHead>Created By</TableHead>
              <TableHead>Days</TableHead>
              <TableHead className="min-w-[48px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell className="text-left min-w-[48px]"><Skeleton className="h-4 w-6" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[100px]" /></TableCell>
                <TableCell className="max-w-[40ch]"><Skeleton className="h-4 w-[200px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[90px]" /></TableCell>
                <TableCell><Skeleton className="h-4 w-[50px]" /></TableCell>
                <TableCell className="text-right min-w-[48px]"><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (terms.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center">
        <p className="text-muted-foreground">
          {searchQuery.trim() ? "No payment terms match your search." : "No payment terms found."}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {searchQuery.trim() ? "Try another name or number." : 'Click "Add Payment Term" to create one.'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table className="table-auto group/table">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  className={
                    header.column.id === "actions"
                      ? "min-w-[48px] text-right"
                      : header.column.id === "no"
                      ? "min-w-[48px] text-left"
                      : header.column.id === "description"
                      ? "max-w-[40ch]"
                      : undefined
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className="group/row hover:bg-muted/50 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <TableCell
                    key={cell.id}
                    className={`group/cell ${
                      cell.column.id === "actions"
                        ? "text-right min-w-[48px]"
                        : cell.column.id === "no"
                        ? "text-left min-w-[48px]"
                        : cell.column.id === "description"
                        ? "max-w-[40ch]"
                        : ""
                    }`}
                  >
                    <div className="group-hover/cell:text-primary transition-colors">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}