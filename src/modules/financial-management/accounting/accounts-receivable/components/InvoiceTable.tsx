// components/InvoiceTable.tsx
// Paginated invoice details table — with search bar across all columns.

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from '@/components/ui/input';
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis,
} from '@/components/ui/pagination';
import { Search } from 'lucide-react';
import { formatPeso, formatDate, getPageNumbers } from '../utils';
import type { Invoice } from '../types';

const PAGE_SIZE = 10;

interface InvoiceTableProps {
  invoices: Invoice[];
  page: number;
  setPage: (p: number | ((prev: number) => number)) => void;
}

export function InvoiceTable({ invoices, page, setPage }: InvoiceTableProps) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? invoices.filter((inv) =>
        inv.invoiceNo.toLowerCase().includes(q)   ||
        inv.orderId.toLowerCase().includes(q)     ||
        inv.customer.toLowerCase().includes(q)    ||
        inv.branch.toLowerCase().includes(q)      ||
        inv.salesman.toLowerCase().includes(q)    ||
        inv.status.toLowerCase().includes(q)      ||
        inv.invoiceDate.toLowerCase().includes(q) ||
        inv.due.toLowerCase().includes(q)
      )
    : invoices;

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage    = Math.min(page, totalPages || 1);
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageNumbers = getPageNumbers(safePage, totalPages);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  return (
    <Card className="dark:bg-zinc-950 border-border overflow-hidden w-full">
      <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm font-bold uppercase shrink-0">Invoice Details</CardTitle>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search invoice, customer, branch, status…"
            className="h-8 pl-8 text-xs focus-visible:ring-1"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} &mdash; page {safePage} of {totalPages || 1}
        </span>
      </CardHeader>
      <CardContent className="p-0">
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-bold py-3 pl-4 w-[9%]">Invoice No.</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[7%]">Order ID</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[13%]">Customer</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[8%]">Inv. Date</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[8%]">Due Date</TableHead>
              <TableHead className="text-xs font-bold py-3 text-right w-[9%]">Net Recv.</TableHead>
              <TableHead className="text-xs font-bold py-3 text-right w-[8%]">Paid</TableHead>
              <TableHead className="text-xs font-bold py-3 text-right w-[9%]">Outstanding</TableHead>
              <TableHead className="text-xs font-bold py-3 text-center w-[6%]">Overdue</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[10%]">Branch</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[10%]">Salesman</TableHead>
              <TableHead className="text-xs font-bold py-3 pr-4 w-[6%]">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-10 text-muted-foreground text-sm">
                  {q ? `No results for "${search}".` : 'No invoices found.'}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((inv, i) => (
                <TableRow key={`${inv.invoiceNo ?? ''}-${i}`} className="border-border/40 hover:bg-muted/20">
                  <TableCell className="py-3 pl-4">
                    <span className="font-bold text-primary text-xs truncate block w-full" title={inv.invoiceNo}>
                      {inv.invoiceNo}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs text-muted-foreground truncate block w-full" title={inv.orderId}>
                      {inv.orderId}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-xs font-medium truncate block w-full" title={inv.customer}>
                      {inv.customer}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap block">
                      {formatDate(inv.invoiceDate)}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap block">
                      {formatDate(inv.due)}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <span className="text-xs font-medium">{formatPeso(inv.netReceivable)}</span>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <span className="text-xs font-medium">{formatPeso(inv.totalPaid)}</span>
                  </TableCell>
                  <TableCell className="py-3 text-right">
                    <span className="text-xs font-bold text-primary">{formatPeso(inv.outstanding)}</span>
                  </TableCell>
                  <TableCell className="py-3 text-center">
                    {inv.overdue !== null && inv.overdue > 0 ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                        {inv.overdue}d
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.branch}>
                      {inv.branch}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.salesman}>
                      {inv.salesman}
                    </span>
                  </TableCell>
                  <TableCell className="py-3 pr-4">
                    <Badge
                      variant="secondary"
                      className={
                        inv.status === 'Paid'
                          ? 'text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border-0'
                          : inv.status === 'Overdue'
                          ? 'text-[10px] px-1.5 py-0.5 bg-red-500/10 text-red-400 border-0'
                          : 'text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border-0'
                      }
                    >
                      {inv.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="w-full py-4 border-t border-border/50">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage(p => Math.max(1, p - 1)); }}
                    aria-disabled={safePage === 1}
                    className={safePage === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {pageNumbers.map((num, i) =>
                  num === 'ellipsis' ? (
                    <PaginationItem key={`ellipsis-${i}`}><PaginationEllipsis /></PaginationItem>
                  ) : (
                    <PaginationItem key={num}>
                      <PaginationLink
                        href="#"
                        isActive={safePage === num}
                        onClick={(e) => { e.preventDefault(); setPage(num); }}
                      >
                        {num}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage(p => Math.min(totalPages, p + 1)); }}
                    aria-disabled={safePage === totalPages}
                    className={safePage === totalPages ? 'pointer-events-none opacity-50' : ''}
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