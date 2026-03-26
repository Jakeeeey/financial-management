// src/modules/financial-management/accounting/accounts-payable/components/APTable.tsx

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationPrevious, PaginationNext, PaginationEllipsis,
} from '@/components/ui/pagination';
import { Search, Calendar } from 'lucide-react';
import { formatPeso, getPageNumbers } from '../utils';
import type { APRecord, APStatus } from '../types';

const PAGE_SIZE = 10;

function getTxType(refNo: string): 'Trade' | 'Non-Trade' {
  return refNo.toUpperCase().startsWith('NT') ? 'Non-Trade' : 'Trade';
}

// Inline styles — avoids Tailwind JIT purging dynamic class strings
const STATUS_STYLES: Record<string, { bg: string; color: string; border: string }> = {
  'Paid':                     { bg: 'rgba(16,185,129,0.1)',  color: '#059669', border: 'rgba(16,185,129,0.2)'  },
  'Unpaid':                   { bg: 'rgba(100,116,139,0.1)', color: '#64748b', border: 'rgba(100,116,139,0.2)' },
  'Partially Paid':           { bg: 'rgba(245,158,11,0.1)',  color: '#d97706', border: 'rgba(245,158,11,0.2)'  },
  'Overdue':                  { bg: 'rgba(220,38,38,0.1)',   color: '#b91c1c', border: 'rgba(220,38,38,0.2)'   },
  'Unpaid | Overdue':         { bg: 'rgba(239,68,68,0.1)',   color: '#dc2626', border: 'rgba(239,68,68,0.2)'   },
  'Partially Paid | Overdue': { bg: 'rgba(249,115,22,0.1)',  color: '#ea580c', border: 'rgba(249,115,22,0.2)'  },
};

const TX_TYPE_STYLES: Record<'Trade' | 'Non-Trade', { bg: string; color: string; border: string }> = {
  'Trade':     { bg: 'rgba(59,130,246,0.12)', color: '#2563eb', border: 'rgba(59,130,246,0.3)' },
  'Non-Trade': { bg: 'rgba(168,85,247,0.12)', color: '#7c3aed', border: 'rgba(168,85,247,0.3)' },
};

function StatusPill({ status }: { status: APStatus }) {
  const style = STATUS_STYLES[status];
  if (!style) return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border border-border bg-muted text-muted-foreground">
      {status}
    </span>
  );
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border"
      style={{ background: style.bg, color: style.color, borderColor: style.border }}
    >
      {status}
    </span>
  );
}

function TxPill({ refNo }: { refNo: string }) {
  const type  = getTxType(refNo);
  const style = TX_TYPE_STYLES[type];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border ml-1.5 shrink-0"
      style={{ background: style.bg, color: style.color, borderColor: style.border }}
    >
      {type === 'Trade' ? 'TR' : 'NT'}
    </span>
  );
}

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
        r.refNo.toLowerCase().includes(q)              ||
        r.invoiceNo.toLowerCase().includes(q)          ||
        r.supplier.toLowerCase().includes(q)           ||
        r.status.toLowerCase().includes(q)             ||
        r.amountPayable.toString().includes(q)         ||
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
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-bold py-3 pl-6 whitespace-nowrap">Ref. No.</TableHead>
              <TableHead className="text-xs font-bold py-3 whitespace-nowrap">Invoice No.</TableHead>
              <TableHead className="text-xs font-bold py-3 whitespace-nowrap">Payee</TableHead>
              <TableHead className="text-xs font-bold py-3 whitespace-nowrap">Invoice Date</TableHead>
              <TableHead className="text-xs font-bold py-3 whitespace-nowrap">Due Date</TableHead>
              <TableHead className="text-xs font-bold py-3 text-right whitespace-nowrap">Amount Payable</TableHead>
              <TableHead className="text-xs font-bold py-3 text-right whitespace-nowrap">Amount Paid</TableHead>
              <TableHead className="text-xs font-bold py-3 text-right whitespace-nowrap">Outstanding</TableHead>
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

                  {/* Ref. No. + TR/NT pill */}
                  <TableCell className="font-bold text-primary text-xs py-3 pl-6 whitespace-nowrap">
                    <span className="flex items-center">
                      {r.refNo}
                      <TxPill refNo={r.refNo} />
                    </span>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground py-3 whitespace-nowrap">
                    {r.invoiceNo && r.invoiceNo !== '—'
                      ? r.invoiceNo
                      : <span className="text-muted-foreground/40">—</span>}
                  </TableCell>

                  <TableCell className="text-xs font-medium py-3 max-w-[180px]">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block truncate cursor-default">{r.supplier}</span>
                      </TooltipTrigger>
                      <TooltipContent side="right"><p>{r.supplier}</p></TooltipContent>
                    </Tooltip>
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

                  <TableCell className="text-xs py-3 text-right whitespace-nowrap">
                    {formatPeso(r.amountPayable)}
                  </TableCell>

                  <TableCell className="text-xs py-3 text-right whitespace-nowrap">
                    {formatPeso(r.amountPaid)}
                  </TableCell>

                  <TableCell className="text-xs font-bold text-primary py-3 text-right whitespace-nowrap">
                    {formatPeso(r.outstandingBalance)}
                  </TableCell>

                  <TableCell className="text-xs py-3 text-right whitespace-nowrap">
                    <span
                      className={r.aging > 30 ? 'font-semibold' : ''}
                      style={{
                        color: r.aging > 90 ? '#dc2626' :
                               r.aging > 60 ? '#ef4444' :
                               r.aging > 30 ? '#f59e0b' : 'inherit',
                      }}
                    >
                      {r.aging > 0 ? r.aging : 0}
                    </span>
                  </TableCell>

                  <TableCell className="py-3 pr-6 whitespace-nowrap">
                    <StatusPill status={r.status} />
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