/* eslint-disable react-hooks/incompatible-library */
// src/modules/financial-management/accounting/accounts-receivable/components/InvoiceTable.tsx

import React, { useMemo, useState, Fragment, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { ChevronDown, ChevronUp, ChevronRight, ChevronsUpDown, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { formatPeso, formatDate, getPageNumbers, mapARRowToInvoice, sortCustomerGroups } from '../utils';
import type { Invoice, CustomerGroup } from '../types';

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
  const showDot = ['Paid', 'Fully Paid', 'Overdue', 'Due', 'Unpaid', 'Partially Paid'].includes(status);
  const dotColors: Record<string, string> = {
    'Paid': 'bg-emerald-500',
    'Fully Paid': 'bg-emerald-500',
    'Overdue': 'bg-rose-500 animate-pulse',
    'Due': 'bg-blue-500',
    'Unpaid': 'bg-slate-400',
    'Partially Paid': 'bg-amber-500 animate-pulse',
  };

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border border-current/10 whitespace-nowrap"
      style={{ background: style.bg, color: style.color }}
    >
      {showDot && (
        <span className={`w-1 h-1 rounded-full ${dotColors[status] || 'bg-slate-400'}`} />
      )}
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
  invoices?: Invoice[];
  customerGroups?: CustomerGroup[];
  serverMode?: boolean;
  page:     number;
  setPage:  (p: number | ((prev: number) => number)) => void;
  totalPages?: number;
  totalInvoiceCount?: number;
  totalGroupCount?: number;
  tableLoading?: boolean;
  truncated?: boolean;
  sortKey?: keyof Invoice | null;
  sortOrder?: 'asc' | 'desc' | null;
  onSortChange?: (key: keyof Invoice | null, order: 'asc' | 'desc' | null) => void;
  onRowClick?: (invoice: Invoice) => void;
}

const VIRTUALIZE_THRESHOLD = 15;
const INVOICE_ROW_HEIGHT = 44;
const MAX_VIRTUAL_LIST_HEIGHT = 320;

const INVOICE_TABLE_COL_WIDTHS = [
  '8%', '10%', '8%', '6%', '6%', '6%', '6%', '6%',
  '7%', '6%', '7%', '5%', '6%', '6%', '7%',
] as const;

function InvoiceTableColGroup() {
  return (
    <colgroup>
      {INVOICE_TABLE_COL_WIDTHS.map((width, i) => (
        <col key={i} style={{ width }} />
      ))}
    </colgroup>
  );
}

function VirtualInvoiceRows({
  invoices,
  onRowClick,
}: {
  invoices: Invoice[];
  onRowClick?: (invoice: Invoice) => void;
}) {
  "use no memo";

  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: invoices.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => INVOICE_ROW_HEIGHT,
    overscan: 5,
  });

  if (invoices.length <= VIRTUALIZE_THRESHOLD) {
    return (
      <>
        {invoices.map((inv, idx) => (
          <InvoiceChildRow
            key={`${inv.invoiceNo}-${idx}`}
            inv={inv}
            isLast={idx === invoices.length - 1}
            onRowClick={onRowClick}
          />
        ))}
      </>
    );
  }

  const listHeight = Math.min(
    invoices.length * INVOICE_ROW_HEIGHT,
    MAX_VIRTUAL_LIST_HEIGHT,
  );

  return (
    <TableRow className="hover:bg-transparent border-0">
      <TableCell colSpan={15} className="p-0">
        <div
          ref={parentRef}
          className="overflow-auto"
          style={{ height: listHeight }}
        >
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const inv = invoices[virtualRow.index];
              return (
                <div
                  key={virtualRow.key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <table className="w-full table-fixed">
                    <InvoiceTableColGroup />
                    <tbody>
                      <InvoiceChildRow inv={inv} isLast={virtualRow.index === invoices.length - 1} onRowClick={onRowClick} asTableRow />
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

function InvoiceChildRow({
  inv,
  isLast,
  onRowClick,
  asTableRow = false,
}: {
  inv: Invoice;
  isLast: boolean;
  onRowClick?: (invoice: Invoice) => void;
  asTableRow?: boolean;
}) {
  const row = (
    <>
      <TableCell className="py-2 pl-8 relative">
        {isLast ? (
          <div className="absolute left-5 top-0 h-[22px] w-px bg-border/80 dark:bg-border/45" />
        ) : (
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border/80 dark:bg-border/45" />
        )}
        <div className="absolute left-5 top-[22px] w-3 h-px bg-border/80 dark:bg-border/45" />
        <div className="flex flex-col gap-0.5 min-w-0 pl-2.5">
          <span className="font-bold text-primary/95 text-xs truncate block w-full" title={inv.invoiceNo}>{inv.invoiceNo}</span>
          {inv.isPosted ? (
            <span className="inline-flex items-center w-max px-1.5 py-0.25 rounded-[3px] text-[8px] font-semibold tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15 uppercase">Posted</span>
          ) : (
            <span className="inline-flex items-center w-max px-1.5 py-0.25 rounded-[3px] text-[8px] font-semibold tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/15 uppercase">Draft</span>
          )}
        </div>
      </TableCell>
      <TableCell className="py-2 text-muted-foreground/45 text-[10px] italic">└─ detail</TableCell>
      <TableCell className="py-2"><span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.salesman}>{inv.salesman || <span className="text-muted-foreground/30">—</span>}</span></TableCell>
      <TableCell className="py-2"><span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.division}>{inv.division || <span className="text-muted-foreground/30">—</span>}</span></TableCell>
      <TableCell className="py-2"><span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.salesmanCode}>{inv.salesmanCode || <span className="text-muted-foreground/30">—</span>}</span></TableCell>
      <TableCell className="py-2"><span className="text-[11px] text-muted-foreground whitespace-nowrap block">{formatDate(inv.invoiceDate)}</span></TableCell>
      <TableCell className="py-2"><span className="text-[11px] text-muted-foreground whitespace-nowrap block">{formatDate(inv.deliveryDate)}</span></TableCell>
      <TableCell className="py-2"><span className="text-[11px] text-muted-foreground whitespace-nowrap block">{formatDate(inv.due)}</span></TableCell>
      <TableCell className="py-2 text-right"><span className="text-xs font-medium text-muted-foreground/90">{formatPeso(inv.netReceivable)}</span></TableCell>
      <TableCell className="py-2 text-right"><span className="text-xs font-medium text-muted-foreground/90">{formatPeso(inv.totalPaid)}</span></TableCell>
      <TableCell className="py-2 text-right font-semibold tabular-nums text-foreground/90">{formatPeso(inv.outstanding)}</TableCell>
      <TableCell className="py-2 text-center">
        {inv.overdue !== null && inv.overdue >= 0 ? (
          <span className={`text-xs ${inv.overdue > 30 ? 'font-semibold' : ''}`} style={{ color: agingColor(inv.overdue) }}>{inv.overdue}d</span>
        ) : (
          <span className="text-[11px] text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="py-2"><StatusPill status={inv.arStatus} /></TableCell>
      <TableCell className="py-2"><StatusPill status={inv.paymentStatus} /></TableCell>
      <TableCell className="py-2 pr-4"><StatusPill status={inv.transactionStatus} /></TableCell>
    </>
  );

  if (asTableRow) {
    return (
      <TableRow className="border-b border-border/20 hover:bg-muted/15 cursor-pointer bg-card/45 transition-colors active:bg-muted/25" onClick={() => onRowClick?.(inv)}>
        {row}
      </TableRow>
    );
  }

  return (
    <TableRow className="border-b border-border/20 hover:bg-muted/15 cursor-pointer bg-card/45 transition-colors active:bg-muted/25" onClick={() => onRowClick?.(inv)}>
      {row}
    </TableRow>
  );
}

export function InvoiceTable({
  invoices = [],
  customerGroups: serverGroups,
  serverMode = false,
  page,
  setPage,
  totalPages: serverTotalPages,
  totalInvoiceCount,
  totalGroupCount,
  tableLoading = false,
  truncated = false,
  sortKey: controlledSortKey,
  sortOrder: controlledSortOrder,
  onSortChange,
  onRowClick,
}: InvoiceTableProps) {
  const [localSortKey, setLocalSortKey] = useState<keyof Invoice | null>(null);
  const [localSortOrder, setLocalSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

  const isControlledSort = serverMode && onSortChange != null;
  const sortKey = isControlledSort ? (controlledSortKey ?? null) : localSortKey;
  const sortOrder = isControlledSort ? (controlledSortOrder ?? null) : localSortOrder;

  const handleSort = (key: keyof Invoice, order: 'asc' | 'desc' | null) => {
    if (isControlledSort) {
      onSortChange!(key, order);
    } else {
      setLocalSortKey(key);
      setLocalSortOrder(order);
    }
  };

  const mappedServerGroups = useMemo(() => {
    if (!serverGroups) return [];
    return serverGroups.map((g) => ({
      customerName: g.customerName,
      customerCode: g.customerCode,
      netReceivable: g.netReceivable,
      totalPaid: g.totalPaid,
      outstanding: g.outstanding,
      maxOverdue: g.maxOverdue,
      invoices: g.invoices.map(mapARRowToInvoice),
    }));
  }, [serverGroups]);

  const filtered = useMemo(() => serverMode ? [] as Invoice[] : invoices, [serverMode, invoices]);

  const customerGroups = useMemo(() => {
    if (serverMode) return mappedServerGroups;

    const groupsMap: Record<string, Invoice[]> = {};
    filtered.forEach((inv) => {
      const name = inv.customer || '—';
      if (!groupsMap[name]) groupsMap[name] = [];
      groupsMap[name].push(inv);
    });

    const groups = Object.entries(groupsMap).map(([name, invs]) => {
      const netReceivable = invs.reduce((sum, inv) => sum + inv.netReceivable, 0);
      const totalPaid = invs.reduce((sum, inv) => sum + inv.totalPaid, 0);
      const outstanding = invs.reduce((sum, inv) => sum + inv.outstanding, 0);

      let maxOverdue: number | null = null;
      invs.forEach((inv) => {
        if (inv.overdue !== null && inv.overdue >= 0) {
          if (maxOverdue === null || inv.overdue > maxOverdue) {
            maxOverdue = inv.overdue;
          }
        }
      });

      return {
        customerName: name,
        customerCode: invs[0]?.customerCode || '—',
        netReceivable,
        totalPaid,
        outstanding,
        maxOverdue,
        invoices: invs,
      };
    });

    return sortCustomerGroups(groups, { sortKey, sortOrder });
  }, [serverMode, mappedServerGroups, filtered, sortKey, sortOrder]);

  const totalPages  = serverMode ? (serverTotalPages ?? 1) : Math.ceil(customerGroups.length / PAGE_SIZE);
  const safePage    = Math.min(page, totalPages || 1);
  const pagedGroups = serverMode ? customerGroups : customerGroups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const displayInvoiceCount = serverMode ? (totalInvoiceCount ?? 0) : filtered.length;
  const displayGroupCount = serverMode ? (totalGroupCount ?? customerGroups.length) : customerGroups.length;
  const pageNumbers = getPageNumbers(safePage, totalPages);

  const isAllExpanded = pagedGroups.length > 0 && pagedGroups.every(g => expandedCustomers[g.customerName] !== false);
  const toggleAll = () => {
    if (isAllExpanded) {
      const newExpanded: Record<string, boolean> = {};
      pagedGroups.forEach(g => {
        newExpanded[g.customerName] = false;
      });
      setExpandedCustomers(newExpanded);
    } else {
      setExpandedCustomers({});
    }
  };

  return (
    <Card className="dark:bg-zinc-950 border-border overflow-hidden w-full">
      <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-sm font-bold uppercase shrink-0">Invoice Details</CardTitle>
        <div className="flex items-center gap-2 max-w-sm w-full justify-end">
          <button
            type="button"
            onClick={toggleAll}
            className="h-8 px-2.5 text-[10px] font-bold uppercase tracking-wider border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors whitespace-nowrap"
          >
            {isAllExpanded ? "Collapse Page" : "Expand Page"}
          </button>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {tableLoading ? 'Loading…' : (
            <>{displayInvoiceCount} invoice{displayInvoiceCount !== 1 ? 's' : ''} ({displayGroupCount} customer{displayGroupCount !== 1 ? 's' : ''}) &mdash; page {safePage} of {totalPages || 1}</>
          )}
        </span>
      </CardHeader>

      {truncated ? (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800">
          Data truncated — showing partial results. Narrow the date range or use supplier/customer filters to see all records.
        </div>
      ) : null}

      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-auto relative w-full">
          <Table className="w-full table-fixed">
            <InvoiceTableColGroup />
            <TableHeader className="sticky top-0 bg-background dark:bg-zinc-950 z-20 shadow-sm">
              <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="py-3 pl-4 w-[8%] whitespace-nowrap"><SortableHeader<Invoice> label="inv #" sortKey="invoiceNo" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[10%] whitespace-nowrap"><SortableHeader<Invoice> label="Customer" sortKey="customer" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[8%] whitespace-nowrap"><SortableHeader<Invoice> label="Salesman" sortKey="salesman" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[6%] whitespace-nowrap"><SortableHeader<Invoice> label="Division" sortKey="division" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[6%] whitespace-nowrap"><SortableHeader<Invoice> label="SCode" sortKey="salesmanCode" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[6%] whitespace-nowrap"><SortableHeader<Invoice> label="Inv. Date" sortKey="invoiceDate" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[6%] whitespace-nowrap"><SortableHeader<Invoice> label="Del Date" sortKey="deliveryDate" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[6%] whitespace-nowrap"><SortableHeader<Invoice> label="Due Date" sortKey="due" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 text-right w-[7%] whitespace-nowrap"><SortableHeader<Invoice> label="Net Receivable" sortKey="netReceivable" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold justify-end w-full" /></TableHead>
              <TableHead className="py-3 text-right w-[6%] whitespace-nowrap"><SortableHeader<Invoice> label="Paid" sortKey="totalPaid" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold justify-end w-full" /></TableHead>
              <TableHead className="py-3 text-right w-[7%] whitespace-nowrap"><SortableHeader<Invoice> label="Outstanding" sortKey="outstanding" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold justify-end w-full" /></TableHead>
              <TableHead className="py-3 text-center w-[5%] whitespace-nowrap"><SortableHeader<Invoice> label="Overdue" sortKey="overdue" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold justify-center w-full" /></TableHead>
              <TableHead className="py-3 w-[6%] whitespace-nowrap"><SortableHeader<Invoice> label="AR Status" sortKey="arStatus" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 w-[6%] whitespace-nowrap"><SortableHeader<Invoice> label="Payment Status" sortKey="paymentStatus" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
              <TableHead className="py-3 pr-4 w-[7%] whitespace-nowrap"><SortableHeader<Invoice> label="Transaction Status" sortKey="transactionStatus" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-xs font-bold" /></TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {pagedGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={15} className="text-center py-10 text-muted-foreground text-sm">
                  {tableLoading ? 'Loading invoices…' : 'No invoices found.'}
                </TableCell>
              </TableRow>
            ) : (
              pagedGroups.map((group) => {
                const isExpanded = expandedCustomers[group.customerName] !== false;
                const toggleExpand = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  setExpandedCustomers((prev) => ({
                    ...prev,
                    [group.customerName]: !isExpanded,
                  }));
                };

                return (
                  <Fragment key={group.customerName}>
                    {/* Customer Group Row */}
                    <TableRow
                      className="bg-muted/35 hover:bg-muted/50 border-b border-border/40 cursor-pointer transition-colors active:bg-muted/60 font-semibold border-l-4 border-l-primary/60 dark:border-l-primary/45"
                      onClick={(e) => toggleExpand(e)}
                    >
                      <TableCell className="py-2.5 pl-4 flex items-center gap-1.5 font-bold text-xs text-primary">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate block max-w-[80px]" title="Customer Group Header">
                          Group
                        </span>
                        <span className="text-[10px] font-normal text-muted-foreground">
                          ({group.invoices.length})
                        </span>
                      </TableCell>

                      <TableCell className="py-2.5 font-black text-xs text-foreground truncate" colSpan={7}>
                        {group.customerName} <span className="font-semibold text-[10px] text-muted-foreground ml-1">({group.customerCode})</span>
                      </TableCell>

                      {/* Net Receivable */}
                      <TableCell className="py-2.5 text-right font-bold text-xs text-foreground">
                        {formatPeso(group.netReceivable)}
                      </TableCell>

                      {/* Paid */}
                      <TableCell className="py-2.5 text-right font-bold text-xs text-emerald-600 dark:text-emerald-400">
                        {formatPeso(group.totalPaid)}
                      </TableCell>

                      {/* Outstanding */}
                      <TableCell className="py-2.5 text-right font-black text-xs text-primary">
                        {formatPeso(group.outstanding)}
                      </TableCell>

                      {/* Overdue */}
                      <TableCell className="py-2.5 text-center">
                        {group.maxOverdue !== null && group.maxOverdue >= 0 ? (
                          <span
                            className={`text-xs ${group.maxOverdue > 30 ? 'font-black' : 'font-semibold'}`}
                            style={{ color: agingColor(group.maxOverdue) }}
                          >
                            {group.maxOverdue}d
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      {/* AR Status */}
                      <TableCell className="py-2.5">
                        <StatusPill status={group.maxOverdue !== null && group.maxOverdue >= 0 ? 'Overdue' : 'Due'} />
                      </TableCell>

                      {/* Payment Status & Transaction Status empty at Group level */}
                      <TableCell className="py-2.5">
                        <span className="text-[11px] text-muted-foreground">—</span>
                      </TableCell>
                      <TableCell className="py-2.5 pr-4">
                        <span className="text-[11px] text-muted-foreground">—</span>
                      </TableCell>
                    </TableRow>

                    {/* Child Invoice Rows */}
                    {isExpanded && (
                      <VirtualInvoiceRows
                        invoices={group.invoices}
                        onRowClick={onRowClick}
                      />
                    )}
                  </Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
        </div>

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