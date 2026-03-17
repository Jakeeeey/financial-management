// components/APTable.tsx — Paginated AP records table with search

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis,
} from '@/components/ui/pagination';
import { Search, Calendar } from 'lucide-react';
import { formatPeso, getPageNumbers } from '../utils';
import type { APRecord, APStatus } from '../types';

const PAGE_SIZE = 10;

const STATUS_BADGE: Record<APStatus, string> = {
  'Paid':                     'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  'Unpaid':                   'bg-slate-500/10 text-slate-500 border-slate-500/20',
  'Partially Paid':           'bg-amber-500/10 text-amber-600 border-amber-500/20',
  'Overdue':                  'bg-red-600/10 text-red-700 border-red-600/20',
  'Unpaid | Overdue':         'bg-red-500/10 text-red-600 border-red-500/20',
  'Partially Paid | Overdue': 'bg-orange-500/10 text-orange-600 border-orange-500/20',
};

interface APTableProps {
  records: APRecord[];
  page:    number;
  setPage: (p: number | ((prev: number) => number)) => void;
}

export function APTable({ records, page, setPage }: APTableProps) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? records.filter((r) =>
        r.refNo.toLowerCase().includes(q)       ||
        r.supplier.toLowerCase().includes(q)    ||
        r.invoiceNo.toLowerCase().includes(q)   ||
        r.status.toLowerCase().includes(q)      ||
        r.amountPayable.toString().includes(q)  ||
        r.outstandingBalance.toString().includes(q)
      )
    : records;

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage    = Math.min(page, totalPages || 1);
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageNumbers = getPageNumbers(safePage, totalPages);

  return (
    <Card className="shadow-none border-border overflow-hidden">
      <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm font-bold uppercase shrink-0">AP Records</CardTitle>
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search ref, supplier, remarks…"
            className="h-8 pl-8 text-xs focus-visible:ring-1"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} — page {safePage} of {totalPages || 1}
        </span>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-bold py-3 pl-6 whitespace-nowrap">Ref. No.</TableHead>
                <TableHead className="text-xs font-bold py-3 whitespace-nowrap">Supplier</TableHead>
                <TableHead className="text-xs font-bold py-3 whitespace-nowrap">Invoice No.</TableHead>
                <TableHead className="text-xs font-bold py-3 whitespace-nowrap">Invoice Date</TableHead>
                <TableHead className="text-xs font-bold py-3 whitespace-nowrap">Due Date</TableHead>
                <TableHead className="text-xs font-bold py-3 text-right whitespace-nowrap">Amount Payable</TableHead>
                <TableHead className="text-xs font-bold py-3 text-right whitespace-nowrap">Amount Paid</TableHead>
                <TableHead className="text-xs font-bold py-3 text-right whitespace-nowrap">Outstanding Balance</TableHead>
                <TableHead className="text-xs font-bold py-3 text-right whitespace-nowrap">Aging</TableHead>
                <TableHead className="text-xs font-bold py-3 pr-6 whitespace-nowrap">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-muted-foreground text-sm">
                    {q ? `No results for "${search}".` : 'No records found.'}
                  </TableCell>
                </TableRow>
              ) : (
                paged.map((r, i) => (
                  <TableRow key={`${r.id}-${i}`} className="border-border/40 hover:bg-muted/20">
                    <TableCell className="font-bold text-primary text-xs py-3 pl-6 whitespace-nowrap">{r.refNo}</TableCell>
                    <TableCell className="text-xs font-medium py-3 max-w-[160px] truncate" title={r.supplier}>{r.supplier}</TableCell>
                    <TableCell className="text-xs text-muted-foreground py-3 max-w-[140px] truncate" title={r.invoiceNo}>
                      {r.invoiceNo && r.invoiceNo !== '—'
                        ? r.invoiceNo
                        : <span className="text-muted-foreground/50 select-none">---</span>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar size={11} />
                        {r.invoiceDate ? r.invoiceDate.split(' ')[0] : '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <Calendar size={11} />
                        {r.dueDate ? r.dueDate.split(' ')[0] : '—'}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs py-3 text-right whitespace-nowrap">{formatPeso(r.amountPayable)}</TableCell>
                    <TableCell className="text-xs py-3 text-right whitespace-nowrap">{formatPeso(r.amountPaid)}</TableCell>
                    <TableCell className="text-xs font-bold text-primary py-3 text-right whitespace-nowrap">{formatPeso(r.outstandingBalance)}</TableCell>
                    <TableCell className="text-xs py-3 text-right whitespace-nowrap">
                      <span className={
                        r.aging > 90 ? 'text-red-600 font-bold' :
                        r.aging > 60 ? 'text-red-500 font-semibold' :
                        r.aging > 30 ? 'text-amber-500 font-semibold' : ''
                      } title="Days overdue based on due date (or transaction date if no due date)">
                        {r.aging > 0 ? r.aging : 0}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 pr-6 whitespace-nowrap">
                      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${STATUS_BADGE[r.status]}`}>
                        {r.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="py-4 border-t border-border/50">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
                    aria-disabled={safePage === 1}
                    className={safePage === 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {pageNumbers.map((num, idx) =>
                  num === 'ellipsis' ? (
                    <PaginationItem key={`e-${idx}`}><PaginationEllipsis /></PaginationItem>
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
                    onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
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