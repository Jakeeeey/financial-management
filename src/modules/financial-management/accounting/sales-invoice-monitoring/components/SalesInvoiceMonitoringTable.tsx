import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { formatAmount, formatDate, getPageNumbers } from "../utils";
import type { SalesInvoiceMonitoringRow } from "../types";

type SortKey = "invoiceNo" | "customerName" | "salesman" | "amount" | "deliveryDate" | "daysLapses";
type SortOrder = "asc" | "desc";

interface SalesInvoiceMonitoringTableProps {
  rows: SalesInvoiceMonitoringRow[];
  loading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  totalRows: number;
  sortBy: SortKey;
  sortOrder: SortOrder;
  onSortChange: (key: SortKey) => void;
  onPageChange: (value: number | ((prev: number) => number)) => void;
}

export function SalesInvoiceMonitoringTable({
  rows,
  loading,
  error,
  page,
  totalPages,
  totalRows,
  sortBy,
  sortOrder,
  onSortChange,
  onPageChange,
}: SalesInvoiceMonitoringTableProps) {
  const renderSortIcon = (key: SortKey) => {
    if (sortBy !== key) return <ArrowUpDown className="h-3.5 w-3.5 opacity-60" />;
    if (sortOrder === "asc") return <ArrowUp className="h-3.5 w-3.5" />;
    return <ArrowDown className="h-3.5 w-3.5" />;
  };

  const renderSortHeader = (label: string, column: SortKey, align: "left" | "right" = "left") => {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={`h-8 px-1 text-xs font-semibold ${align === "right" ? "ml-auto" : ""}`}
        onClick={() => onSortChange(column)}
      >
        <span>{label}</span>
        <span className="ml-1">{renderSortIcon(column)}</span>
      </Button>
    );
  };

  if (loading) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice No</TableHead>
              <TableHead>Customer Name</TableHead>
              <TableHead>Salesman</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Delivery Date</TableHead>
              <TableHead className="text-right">Days Lapses</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell className="text-right"><Skeleton className="ml-auto h-4 w-12" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="rounded-md border overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead className="whitespace-nowrap">
                {renderSortHeader("Invoice No", "invoiceNo")}
              </TableHead>
              <TableHead className="whitespace-nowrap">
                {renderSortHeader("Customer Name", "customerName")}
              </TableHead>
              <TableHead className="whitespace-nowrap">
                {renderSortHeader("Salesman", "salesman")}
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                {renderSortHeader("Amount", "amount", "right")}
              </TableHead>
              <TableHead className="whitespace-nowrap">
                {renderSortHeader("Delivery Date", "deliveryDate")}
              </TableHead>
              <TableHead className="whitespace-nowrap text-right">
                {renderSortHeader("Days Lapses", "daysLapses", "right")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {error ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-red-500">
                  {error}
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No sales invoices found for the selected filters.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs font-medium">{row.invoiceNo}</TableCell>
                  <TableCell className="text-xs">{row.customerName}</TableCell>
                  <TableCell className="text-xs">{row.salesman}</TableCell>
                  <TableCell className="text-xs text-right">₱{formatAmount(row.amount)}</TableCell>
                  <TableCell className="text-xs">{formatDate(row.deliveryDate)}</TableCell>
                  <TableCell className="text-xs text-right">{row.daysLapses}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && !error && (
        <div className="flex flex-col gap-2 border-t p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {totalRows} result{totalRows !== 1 ? "s" : ""} • Page {page} of {totalPages}
          </p>

          <Pagination className="mx-0 w-auto justify-start sm:justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    onPageChange((prev) => Math.max(1, prev - 1));
                  }}
                  aria-disabled={page === 1}
                  className={page === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>

              {getPageNumbers(page, totalPages).map((pageNo, index) =>
                pageNo === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={pageNo}>
                    <PaginationLink
                      href="#"
                      isActive={page === pageNo}
                      onClick={(event) => {
                        event.preventDefault();
                        onPageChange(pageNo);
                      }}
                    >
                      {pageNo}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}

              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(event) => {
                    event.preventDefault();
                    onPageChange((prev) => Math.min(totalPages, prev + 1));
                  }}
                  aria-disabled={page === totalPages}
                  className={page === totalPages ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  );
}
