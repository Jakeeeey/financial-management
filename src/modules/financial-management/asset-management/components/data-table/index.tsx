"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  ColumnFiltersState,
  useReactTable,
  OnChangeFn,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataTablePagination } from "./table-pagination";
import { useState } from "react";
import ViewAssetModal from "../AssetViewModal";
import { Input } from "@/components/ui/input";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  data: TData[];
  tableMeta?: any;
}

export function AssetDataTable<TData, TValue>({
  columns,
  data,
  columnFilters,
  onColumnFiltersChange,
  tableMeta, // FIX: Destructure here
}: DataTableProps<TData, TValue>) {
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [selectedAsset, setSelectedAsset] = useState<TData | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const table = useReactTable({
    data,
    state: {
      pagination,
      sorting,
      columnFilters,
    },
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: onColumnFiltersChange,
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: setPagination,
    getSortedRowModel: getSortedRowModel(),
    meta: {
      ...tableMeta,
      onView: (asset: TData) => {
        setSelectedAsset(asset);
        setIsViewOpen(true);
      },
    },
  });

  const currentProjectionDate = tableMeta?.projectionDate || new Date();

  return (
    <div className="space-y-4">
      <div className="flex max-w-lg items-start sm:items-center justify-between gap-2">
        <Input
          placeholder="Search assets name..."
          className="w-full"
          value={
            (table.getColumn("item_name")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("item_name")?.setFilterValue(event.target.value)
          }
        />
        
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader className="bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="font-semibold">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No assets found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
      <ViewAssetModal
        asset={selectedAsset as any}
        isOpen={isViewOpen}
        onOpenChange={setIsViewOpen}
        projectionDate={currentProjectionDate}
      />
    </div>
  );
}
