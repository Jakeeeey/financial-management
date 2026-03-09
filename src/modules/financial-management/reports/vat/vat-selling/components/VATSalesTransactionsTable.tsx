// components/VATSalesTransactionsTable.tsx
// Paginated sales transactions table with search bar for VAT Selling.

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis,
} from '@/components/ui/pagination';
import { Calendar, Search } from 'lucide-react';
import { getPageNumbers, formatPeso } from '../utils';
import type { VATSaleTransaction } from '../types';

const PAGE_SIZE = 10;

interface VATSalesTransactionsTableProps {
  transactions: VATSaleTransaction[];
  page: number;
  setPage: (p: number | ((prev: number) => number)) => void;
}

export function VATSalesTransactionsTable({ transactions, page, setPage }: VATSalesTransactionsTableProps) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? transactions.filter((tr) =>
        tr.id.toLowerCase().includes(q)           ||
        tr.customer.toLowerCase().includes(q)     ||
        tr.supplier.toLowerCase().includes(q)     ||
        tr.amount.toLowerCase().includes(q)       ||
        tr.date.toLowerCase().includes(q)         ||
        tr.grossAmount.toString().includes(q)     ||
        tr.vatExclusive.toString().includes(q)
      )
    : transactions;

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage    = Math.min(page, totalPages || 1);
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageNumbers = getPageNumbers(safePage, totalPages);

  const handleSearch = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm font-bold uppercase shrink-0">Sales Transactions</CardTitle>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search invoice, customer, supplier…"
            className="h-8 pl-8 text-xs focus-visible:ring-1"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} &mdash; page {safePage} of {totalPages || 1}
        </span>
      </CardHeader>

      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-bold py-4 pl-6">Invoice No.</TableHead>
              <TableHead className="text-xs font-bold py-4">Customer</TableHead>
              <TableHead className="text-xs font-bold py-4">Supplier</TableHead>
              <TableHead className="text-xs font-bold py-4 text-right">Gross Amount</TableHead>
              <TableHead className="text-xs font-bold py-4 text-right">VAT Exclusive</TableHead>
              <TableHead className="text-xs font-bold py-4 text-right">VAT Amount</TableHead>
              <TableHead className="text-xs font-bold py-4 pr-6">Invoice Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-sm">
                  {q ? `No results for "${search}".` : 'No transactions found.'}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((tr) => (
                <TableRow key={tr.id} className="border-border/40 hover:bg-muted/20">
                  <TableCell className="font-bold text-primary text-xs py-4 pl-6">{tr.id}</TableCell>
                  <TableCell className="text-xs font-medium py-4">{tr.customer}</TableCell>
                  <TableCell className="text-xs text-muted-foreground py-4">{tr.supplier}</TableCell>
                  <TableCell className="text-xs py-4 text-right">{formatPeso(tr.grossAmount)}</TableCell>
                  <TableCell className="text-xs py-4 text-right">{formatPeso(tr.vatExclusive)}</TableCell>
                  <TableCell className="text-xs font-bold text-primary py-4 text-right">{tr.amount}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground py-4 pr-6">
                    <div className="flex items-center gap-1.5">
                      <Calendar size={12} className="text-muted-foreground" />
                      {tr.date}
                    </div>
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