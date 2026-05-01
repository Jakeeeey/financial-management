// src/modules/financial-management/accounting/accounts-receivable/components/InvoiceTable.tsx

import { useMemo, useState } from 'react';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, ChevronDown, ChevronUp, ChevronsUpDown, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { formatPeso, formatDate, getPageNumbers } from '../utils';
import type { Invoice } from '../types';

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  'Paid':           { bg: 'rgba(16,185,129,0.1)',  color: '#059669' },
  'Overdue':        { bg: 'rgba(239,68,68,0.1)',   color: '#dc2626' },
  'Partially Paid': { bg: 'rgba(245,158,11,0.1)',  color: '#d97706' },
  'Unpaid':         { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
  'Due':            { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
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

/**
 * Color for the aging day count.
 *
 * Only called when aging >= 0 (i.e. actually overdue).
 *   0 days  → amber  (due today — overdue but freshest)
 *   1–30    → slate  (default muted)
 *   31–60   → amber
 *   61–90   → orange-red
 *   91+     → red
 */
function agingColor(aging: number): string {
  if (aging === 0)  return '#f59e0b';
  if (aging > 90)   return '#dc2626';
  if (aging > 60)   return '#ef4444';
  if (aging > 30)   return '#f59e0b';
  return '#64748b'; // 1–30 days: slate
}

function SortableHeader<T>({
  label,
  sortKey,
  currentSortKey,
  currentSortOrder,
  onSort,
  className,
}: {
  label: string;
  sortKey: keyof T;
  currentSortKey: keyof T | null;
  currentSortOrder: 'asc' | 'desc' | null;
  onSort: (key: keyof T, order: 'asc' | 'desc' | null) => void;
  className?: string;
}) {
  const isSorted = currentSortKey === sortKey;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex items-center gap-1.5 focus:outline-none hover:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground whitespace-nowrap",
          className
        )}
      >
        {label}
        {isSorted && currentSortOrder === "desc" ? (
          <ChevronDown />
        ) : isSorted && currentSortOrder === "asc" ? (
          <ChevronUp />
        ) : (
          <ChevronsUpDown />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-28">
        <DropdownMenuCheckboxItem
          checked={isSorted && currentSortOrder === "asc"}
          onClick={() => onSort(sortKey, "asc")}
        >
          <ChevronUp className="mr-2 h-4 w-4 text-muted-foreground" />
          Asc
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={isSorted && currentSortOrder === "desc"}
          onClick={() => onSort(sortKey, "desc")}
        >
          <ChevronDown className="mr-2 h-4 w-4 text-muted-foreground" />
          Desc
        </DropdownMenuCheckboxItem>
        {isSorted && (
          <DropdownMenuItem onClick={() => onSort(sortKey, null)}>
            <X className="mr-2 h-4 w-4 text-muted-foreground" />
            Reset
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface InvoiceTableProps {
  invoices: Invoice[];
  page:     number;
  setPage:  (p: number | ((prev: number) => number)) => void;
}

export function InvoiceTable({ invoices, page, setPage }: InvoiceTableProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof Invoice | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);

  const handleSort = (key: keyof Invoice, order: 'asc' | 'desc' | null) => {
    setSortKey(key);
    setSortOrder(order);
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? invoices.filter((inv) =>
        inv.invoiceNo.toLowerCase().includes(q)   ||
        inv.orderId.toLowerCase().includes(q)     ||
        inv.customer.toLowerCase().includes(q)    ||
        inv.salesman.toLowerCase().includes(q)    ||
        inv.division.toLowerCase().includes(q)    ||
        inv.branch.toLowerCase().includes(q)      ||
        inv.status.toLowerCase().includes(q)      ||
        inv.invoiceDate.toLowerCase().includes(q) ||
        inv.due.toLowerCase().includes(q)
      )
    : invoices;

  const sorted = useMemo(() => {
    if (!sortKey || !sortOrder) return filtered;
    return [...filtered].sort((a, b) => {
      let aVal = a[sortKey];
      let bVal = b[sortKey];

      if (aVal == null) aVal = '';
      if (bVal == null) bVal = '';

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const compare = aVal.localeCompare(bVal);
        return sortOrder === 'asc' ? compare : -compare;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [filtered, sortKey, sortOrder]);

  const totalPages  = Math.ceil(sorted.length / PAGE_SIZE);
  const safePage    = Math.min(page, totalPages || 1);
  const paged       = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
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
        <Table className="w-full table-fixed">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="py-3 pl-4 w-[8%] whitespace-nowrap"><SortableHeader<Invoice> label="Invoice #" sortKey="invoiceNo" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[7%] whitespace-nowrap"><SortableHeader<Invoice> label="Order No." sortKey="orderId" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[12%] whitespace-nowrap"><SortableHeader<Invoice> label="Customer" sortKey="customer" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[9%] whitespace-nowrap"><SortableHeader<Invoice> label="Salesman" sortKey="salesman" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[8%] whitespace-nowrap"><SortableHeader<Invoice> label="Division" sortKey="division" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[8%] whitespace-nowrap"><SortableHeader<Invoice> label="Branch" sortKey="branch" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[8%] whitespace-nowrap"><SortableHeader<Invoice> label="Invoice Date" sortKey="invoiceDate" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[8%] whitespace-nowrap"><SortableHeader<Invoice> label="Due Date" sortKey="due" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 text-right w-[7%] whitespace-nowrap"><SortableHeader<Invoice> label="Net Recv." sortKey="netReceivable" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold justify-end w-full" /></TableHead>
              <TableHead className="py-3 text-right w-[7%] whitespace-nowrap"><SortableHeader<Invoice> label="Paid" sortKey="totalPaid" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold justify-end w-full" /></TableHead>
              <TableHead className="py-3 text-right w-[8%] whitespace-nowrap"><SortableHeader<Invoice> label="Outstanding" sortKey="outstanding" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold justify-end w-full" /></TableHead>
              <TableHead className="py-3 text-center w-[5%] whitespace-nowrap"><SortableHeader<Invoice> label="Overdue" sortKey="overdue" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold justify-center w-full" /></TableHead>
              <TableHead className="py-3 pr-4 w-[5%] whitespace-nowrap"><SortableHeader<Invoice> label="Status" sortKey="status" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="text-center py-10 text-muted-foreground text-sm">
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
                      {inv.orderId || <span className="text-muted-foreground/40">—</span>}
                    </span>
                  </TableCell>

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

                  <TableCell className="py-3">
                    <span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.salesman}>
                      {inv.salesman || <span className="text-muted-foreground/40">—</span>}
                    </span>
                  </TableCell>

                  <TableCell className="py-3">
                    <span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.division}>
                      {inv.division || <span className="text-muted-foreground/40">—</span>}
                    </span>
                  </TableCell>

                  <TableCell className="py-3">
                    <span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.branch}>
                      {inv.branch || <span className="text-muted-foreground/40">—</span>}
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

                  {/*
                    Overdue column display rules:
                    - null         → no due date at all → show dash
                    - negative     → due in the future → show dash (not yet overdue)
                    - 0            → due today → show "0d" in amber
                    - positive     → N days past due → show Nd with escalating color
                  */}
                  <TableCell className="py-3 text-center">
                    {inv.overdue !== null && inv.overdue >= 0 ? (
                      <span
                        className={`text-xs ${inv.overdue > 30 ? 'font-semibold' : ''}`}
                        style={{ color: agingColor(inv.overdue) }}
                      >
                        {inv.overdue}d
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">—</span>
                    )}
                  </TableCell>

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