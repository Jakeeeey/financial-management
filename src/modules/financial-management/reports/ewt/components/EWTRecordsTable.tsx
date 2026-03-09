// components/EWTRecordsTable.tsx
// Paginated EWT records table with invoice breakdown — with search bar.

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis,
} from '@/components/ui/pagination';
import { Search } from 'lucide-react';
import { getPageNumbers } from '../utils';
import type { EWTRecord } from '../types';

const PAGE_SIZE = 10;

interface EWTRecordsTableProps {
  records: EWTRecord[];
  page: number;
  setPage: (p: number | ((prev: number) => number)) => void;
}

const fmt = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function EWTRecordsTable({ records, page, setPage }: EWTRecordsTableProps) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? records.filter((r) =>
        r.id.toLowerCase().includes(q)            ||
        r.customer.toLowerCase().includes(q)      ||
        r.date.toLowerCase().includes(q)          ||
        r.amount.toString().includes(q)           ||
        r.grossAmount.toString().includes(q)      ||
        r.taxableAmount.toString().includes(q)
      )
    : records;

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
        <div className="shrink-0">
          <CardTitle className="text-sm font-bold uppercase">EWT Records</CardTitle>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search invoice, customer, date…"
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
              <TableHead className="text-xs font-bold py-4 text-right">Gross Amount</TableHead>
              <TableHead className="text-xs font-bold py-4 text-right">Taxable Amount</TableHead>
              <TableHead className="text-xs font-bold py-4 text-right">EWT Amount</TableHead>
              <TableHead className="text-xs font-bold py-4 pr-6">Invoice Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-sm">
                  {q ? `No results for "${search}".` : 'No records found.'}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((row) => (
                <TableRow key={row.id} className="border-border/40 hover:bg-muted/20">
                  <TableCell className="font-bold text-primary text-xs py-4 pl-6">{row.id}</TableCell>
                  <TableCell className="text-xs font-medium py-4">{row.customer}</TableCell>
                  <TableCell className="text-xs py-4 text-right">{fmt(row.grossAmount)}</TableCell>
                  <TableCell className="text-xs py-4 text-right">{fmt(row.taxableAmount)}</TableCell>
                  <TableCell className="text-xs font-bold text-primary py-4 text-right">{fmt(row.amount)}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground py-4 pr-6">{row.date}</TableCell>
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