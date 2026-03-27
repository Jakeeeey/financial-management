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
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Search Input */}
      <div className="relative max-w-sm shrink-0">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search salesman by name or code..."
          className="pl-9"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {/* Flexible Height Container */}
      <div className="flex-1 overflow-auto rounded-md border shadow-inner bg-background relative">
        <Table className="relative min-w-max w-full">
          <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-sm shadow-sm">
            <TableRow className="bg-muted/50">
              <TableHead className="w-12 text-center">No.</TableHead>
              <TableHead>Name</TableHead>
              <TableHead className="text-center">Draft</TableHead>
              <TableHead className="text-center">Rejected</TableHead>
              <TableHead className="text-center">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-[360px] text-center">
                  <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <FolderOpen className="h-10 w-10 opacity-40" />
                    <p className="text-sm">No salesmen with pending expenses.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  className="hover:bg-muted/30 transition-colors h-[72px]"
                >
                  <TableCell className="text-center text-muted-foreground text-sm">
                    {(page - 1) * 5 + idx + 1}
                  </TableCell>
                  <TableCell className="font-medium">{row.salesman_name}</TableCell>
                  <TableCell className="text-center">
                    {row.draft_count > 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-amber-100 text-amber-800 border-amber-200"
                      >
                        {row.draft_count}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {row.rejected_count > 0 ? (
                      <Badge
                        variant="secondary"
                        className="bg-red-100 text-red-700 border-red-200"
                      >
                        {row.rejected_count}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer text-xs"
                      onClick={() => onAction(row)}
                    >
                      View & Approve
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between shrink-0 py-2 border-t pt-2">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{rows.length}</span> of{" "}
          <span className="font-medium text-foreground">{totalItems}</span> salesman
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
          <div className="text-sm font-medium">
            Page {page} of {pageCount}
          </div>
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

