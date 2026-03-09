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
import ViewAssetModal from "../modals/AssetViewModal";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

import { AssetTableData } from "../../types";

interface DataTableProps<TData extends AssetTableData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange?: OnChangeFn<ColumnFiltersState>;
  data: TData[];
  tableMeta?: Record<string, unknown>;
}

export function AssetDataTable<TData extends AssetTableData, TValue>({
  columns,
  data,
  columnFilters,
  onColumnFiltersChange,
  tableMeta,
}: DataTableProps<TData, TValue>) {
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [selectedAsset, setSelectedAsset] = useState<TData | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // eslint-disable-next-line react-hooks/incompatible-library
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

  const currentProjectionDate = (tableMeta?.projectionDate as Date) || new Date();

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          type="search"
          placeholder={"Search items..."}
          value={
            (table.getColumn("item_name")?.getFilterValue() as string) ?? ""
          }
          onChange={(event) =>
            table.getColumn("item_name")?.setFilterValue(event.target.value)
          }
          className="pl-8"
        />
      </div>
      {/* Table */}
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
      {/* Pagination */}
      <DataTablePagination table={table} />

      <ViewAssetModal
        asset={selectedAsset as TData}
        isOpen={isViewOpen}
        onOpenChange={setIsViewOpen}
        projectionDate={currentProjectionDate}
      />
    </div>
  );
}
