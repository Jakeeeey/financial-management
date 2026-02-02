"use client";

import * as React from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  useReactTable,
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

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  // FIX: Added tableMeta to the interface
  tableMeta?: any;
}

export function AssetDataTable<TData, TValue>({
  columns,
  data,
  tableMeta, // FIX: Destructure here
}: DataTableProps<TData, TValue>) {
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: 10,
  });

  const [selectedAsset, setSelectedAsset] = useState<TData | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onPaginationChange: setPagination,
    // FIX: Pass tableMeta into the internal meta state
    meta: {
      ...tableMeta,
      onView: (asset: TData) => {
        setSelectedAsset(asset);
        setIsViewOpen(true);
      },
    },
    state: {
      pagination,
    },
  });

  const currentProjectionDate = tableMeta?.projectionDate || new Date();

  return (
    <div className="space-y-4">
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
