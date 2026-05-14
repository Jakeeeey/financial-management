"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis,
} from "@/components/ui/pagination";
import type { UserExpenseLimit } from "../types";
import { formatPeso } from "../utils";

const PAGE_SIZE = 10;

function getPageNumbers(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "ellipsis", total];
  if (current >= total - 3) return [1, "ellipsis", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "ellipsis", current - 1, current, current + 1, "ellipsis", total];
}

interface LimitTableProps {
  limits:  UserExpenseLimit[];
  loading: boolean;
  error:   string | null;
  onEdit:  (limit: UserExpenseLimit) => void;
}

export function LimitTable({ limits, loading, error, onEdit }: LimitTableProps) {
  const [page,   setPage]   = useState(1);

  const filtered = limits;
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage    = Math.min(page, totalPages || 1);
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageNumbers = getPageNumbers(safePage, totalPages);

  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm font-bold uppercase shrink-0">Expense Limits</CardTitle>
        <span className="text-xs text-muted-foreground shrink-0 ml-auto">
          {filtered.length} result{filtered.length !== 1 ? "s" : ""} — page {safePage} of {totalPages || 1}
        </span>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-bold py-3 pl-6 w-[5%]">No.</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[20%]">Name</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[18%]">Department</TableHead>
              <TableHead className="text-xs font-bold py-3 text-right w-[13%]">Amount Limit</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[14%]">Created By</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[14%]">Updated By</TableHead>
              <TableHead className="text-xs font-bold py-3 pr-6 text-right w-[8%]">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i} className="border-border/40">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j} className="py-3">
                      <div className="h-4 bg-muted rounded animate-pulse" style={{ width: j === 1 ? "140px" : "80px" }} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : error ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-sm text-destructive">
                  {error}
                </TableCell>
              </TableRow>
            ) : paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-sm text-muted-foreground">
                  No expense limits found. Click &quot;Add Limit&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              paged.map((l, i) => (
                <TableRow key={l.id} className="border-border/40 hover:bg-muted/20">
                  <TableCell className="text-xs text-muted-foreground py-3 pl-6">
                    {(safePage - 1) * PAGE_SIZE + i + 1}
                  </TableCell>
                  <TableCell className="py-3">
                    <p className="text-xs font-medium text-foreground">
                      {l.user_name ?? (l.user_id ? String(l.user_id) : "—")}
                    </p>
                    {l.user_email && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{l.user_email}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-3">
                    {l.user_department ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-primary py-3 text-right whitespace-nowrap">
                    {formatPeso(l.expense_limit)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-3">
                    {l.created_by_name ?? (l.created_by ? String(l.created_by) : "—")}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground py-3">
                    {l.updated_by_name ?? (l.updated_by ? String(l.updated_by) : "—")}
                  </TableCell>
                  <TableCell className="py-3 pr-6 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(l)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="py-4 border-t border-border/50">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={e => { e.preventDefault(); setPage(p => Math.max(1, p - 1)); }}
                    aria-disabled={safePage === 1}
                    className={safePage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {pageNumbers.map((num, idx) =>
                  num === "ellipsis" ? (
                    <PaginationItem key={`e-${idx}`}><PaginationEllipsis /></PaginationItem>
                  ) : (
                    <PaginationItem key={num}>
                      <PaginationLink
                        href="#"
                        isActive={safePage === num}
                        onClick={e => { e.preventDefault(); setPage(num); }}
                      >
                        {num}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={e => { e.preventDefault(); setPage(p => Math.min(totalPages, p + 1)); }}
                    aria-disabled={safePage === totalPages}
                    className={safePage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </CardContent>
    </Card>
  );
}