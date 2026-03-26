// src/modules/financial-management/accounting/accounts-receivable/components/InvoiceTable.tsx
// Paginated invoice details table — with search bar across all columns.

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Pagination, PaginationContent, PaginationItem,
  PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis,
} from '@/components/ui/pagination';
import { Search } from 'lucide-react';
import { formatPeso, formatDate, getPageNumbers } from '../utils';
import type { Invoice } from '../types';

const PAGE_SIZE = 10;

// Inline styles to avoid Tailwind JIT purging dynamic classes
const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  'Paid':             { bg: 'rgba(16,185,129,0.1)',  color: '#059669' },
  'Overdue':          { bg: 'rgba(239,68,68,0.1)',   color: '#dc2626' },
  'Partially Paid':   { bg: 'rgba(245,158,11,0.1)',  color: '#d97706' },
  'Unpaid':           { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
};

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { bg: 'rgba(100,116,139,0.1)', color: '#64748b' };
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ background: style.bg, color: style.color }}
    >
      {status}
    </span>
  );
}

interface InvoiceTableProps {
  invoices: Invoice[];
  page:     number;
  setPage:  (p: number | ((prev: number) => number)) => void;
}

export function InvoiceTable({ invoices, page, setPage }: InvoiceTableProps) {
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filtered = q
    ? invoices.filter((inv) =>
        inv.invoiceNo.toLowerCase().includes(q)   ||
        inv.orderId.toLowerCase().includes(q)     ||
        inv.customer.toLowerCase().includes(q)    ||
        inv.salesman.toLowerCase().includes(q)    ||
        inv.branch.toLowerCase().includes(q)      ||
        inv.status.toLowerCase().includes(q)      ||
        inv.invoiceDate.toLowerCase().includes(q) ||
        inv.due.toLowerCase().includes(q)
      )
    : invoices;

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const safePage    = Math.min(page, totalPages || 1);
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageNumbers = getPageNumbers(safePage, totalPages);

  return (
    <Card className="dark:bg-zinc-950 border-border overflow-hidden w-full">
      <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm font-bold uppercase shrink-0">Invoice Details</CardTitle>
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search invoice, order, customer, branch, status…"
            className="h-8 pl-8 text-xs focus-visible:ring-1"
          />
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {filtered.length} result{filtered.length !== 1 ? 's' : ''} &mdash; page {safePage} of {totalPages || 1}
        </span>
      </CardHeader>

      <CardContent className="p-0">
        {/* Column order matches notepad:
            Invoice # | Order no. | Customer | Salesman | Branch |
            Invoice Date | Due Date | Net Receivable | Paid | Outstanding | Overdue | Status */}
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-bold py-3 pl-4 w-[9%] whitespace-nowrap">Invoice #</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[7%] whitespace-nowrap">Order No.</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[14%] whitespace-nowrap">Customer</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[10%] whitespace-nowrap">Salesman</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[9%] whitespace-nowrap">Branch</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[8%] whitespace-nowrap">Invoice Date</TableHead>
              <TableHead className="text-xs font-bold py-3 w-[8%] whitespace-nowrap">Due Date</TableHead>
              <TableHead className="text-xs font-bold py-3 text-right w-[9%] whitespace-nowrap">Net Recv.</TableHead>
              <TableHead className="text-xs font-bold py-3 text-right w-[8%] whitespace-nowrap">Paid</TableHead>
              <TableHead className="text-xs font-bold py-3 text-right w-[9%] whitespace-nowrap">Outstanding</TableHead>
              <TableHead className="text-xs font-bold py-3 text-center w-[6%] whitespace-nowrap">Overdue</TableHead>
              <TableHead className="text-xs font-bold py-3 pr-4 w-[6%] whitespace-nowrap">Status</TableHead>
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

                  {/* Invoice # */}
                  <TableCell className="py-3 pl-4">
                    <span className="font-bold text-primary text-xs truncate block w-full" title={inv.invoiceNo}>
                      {inv.invoiceNo}
                    </span>
                  </TableCell>

                  {/* Order No. */}
                  <TableCell className="py-3">
                    <span className="text-xs text-muted-foreground truncate block w-full" title={inv.orderId}>
                      {inv.orderId || <span className="text-muted-foreground/40">—</span>}
                    </span>
                  </TableCell>

                  {/* Customer — truncated with tooltip */}
                  <TableCell className="py-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs font-medium truncate block w-full cursor-default">
                          {inv.customer}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right"><p>{inv.customer}</p></TooltipContent>
                    </Tooltip>
                  </TableCell>

                  {/* Salesman */}
                  <TableCell className="py-3">
                    <span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.salesman}>
                      {inv.salesman || <span className="text-muted-foreground/40">—</span>}
                    </span>
                  </TableCell>

                  {/* Branch */}
                  <TableCell className="py-3">
                    <span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.branch}>
                      {inv.branch || <span className="text-muted-foreground/40">—</span>}
                    </span>
                  </TableCell>

                  {/* Invoice Date */}
                  <TableCell className="py-3">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap block">
                      {formatDate(inv.invoiceDate)}
                    </span>
                  </TableCell>

                  {/* Due Date */}
                  <TableCell className="py-3">
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap block">
                      {formatDate(inv.due)}
                    </span>
                  </TableCell>

                  {/* Net Receivable */}
                  <TableCell className="py-3 text-right">
                    <span className="text-xs font-medium">{formatPeso(inv.netReceivable)}</span>
                  </TableCell>

                  {/* Paid */}
                  <TableCell className="py-3 text-right">
                    <span className="text-xs font-medium">{formatPeso(inv.totalPaid)}</span>
                  </TableCell>

                  {/* Outstanding */}
                  <TableCell className="py-3 text-right">
                    <span className="text-xs font-bold text-primary">{formatPeso(inv.outstanding)}</span>
                  </TableCell>

                  {/* Overdue (days) */}
                  <TableCell className="py-3 text-center">
                    {inv.overdue !== null && inv.overdue > 0 ? (
                      <span
                        className="text-xs font-semibold"
                        style={{
                          color: inv.overdue > 90 ? '#dc2626' :
                                 inv.overdue > 60 ? '#ef4444' :
                                 inv.overdue > 30 ? '#f59e0b' : '#64748b'
                        }}
                      >
                        {inv.overdue}d
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Status */}
                  <TableCell className="py-3 pr-4">
                    <StatusPill status={inv.status} />
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