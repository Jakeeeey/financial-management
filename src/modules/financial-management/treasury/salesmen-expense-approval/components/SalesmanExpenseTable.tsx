// src/modules/financial-management/treasury/salesmen-expense-approval/components/SalesmanExpenseTable.tsx
"use client";

import * as React from "react";
import { Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { SalesmanExpenseRow } from "../type";

interface Props {
  rows: SalesmanExpenseRow[];
  totalItems: number;
  q: string;
  setQ: (v: string) => void;
  page: number;
  setPage: (v: number) => void;
  pageCount: number;
  loading: boolean;
  onAction: (row: SalesmanExpenseRow) => void;
}

export default function SalesmanExpenseTable(props: Props) {
  const {
    rows,
    totalItems,
    q,
    setQ,
    page,
    setPage,
    pageCount,
    loading,
    onAction,
  } = props;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading salesmen…</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {/* Search Input */}
      <div className="relative max-w-sm shrink-0">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search salesman by name or code..."
          className="pl-8 h-8 text-xs"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Flexible Height Container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden rounded-xl border shadow-inner bg-background relative">
        <Table className="w-full table-fixed">
          <colgroup>
            <col className="w-9" />
            <col className="w-[35%]" />
            <col className="w-[20%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm shadow-sm">
            <TableRow className="bg-muted/50">
              <TableHead className="text-center text-xs">#</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-tight">Name</TableHead>
              <TableHead className="text-xs font-bold uppercase tracking-tight">Division</TableHead>
              <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Draft</TableHead>
              <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Rejected</TableHead>
              <TableHead className="text-center text-xs font-bold uppercase tracking-tight">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-[340px] text-center">
                  <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                    <FolderOpen className="h-10 w-10 opacity-30" />
                    <p className="text-sm font-medium">No salesmen with pending expenses.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-muted/30 transition-colors group"
                >
                  <TableCell className="text-center text-muted-foreground text-xs font-mono">
                    {(page - 1) * 5 + idx + 1}
                  </TableCell>
                  <TableCell className="overflow-hidden">
                    <span className="font-bold text-xs truncate block" title={row.salesman_name}>
                      {row.salesman_name}
                    </span>
                  </TableCell>
                  <TableCell className="overflow-hidden">
                    {row.division_name ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] font-bold bg-muted/50 border-muted-foreground/30 px-2 py-0 max-w-full block truncate"
                        title={row.division_name}
                      >
                        {row.division_name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center overflow-hidden">
                    {row.draft_count > 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] px-1.5 py-0"
                      >
                        {row.draft_count}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center overflow-hidden">
                    {row.rejected_count > 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-red-100 text-red-700 border-red-200 text-[10px] px-1.5 py-0"
                      >
                        {row.rejected_count}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[10px]">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center overflow-hidden">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] h-7 px-2 rounded-full transition-all w-full max-w-[72px]"
                      onClick={() => onAction(row)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between shrink-0 border-t pt-3">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-bold text-foreground">{rows.length}</span> of{" "}
          <span className="font-bold text-foreground">{totalItems}</span> salesmen
        </p>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm font-medium">
            Page {page} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= pageCount}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

