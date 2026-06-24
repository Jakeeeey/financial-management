// src/modules/financial-management/accounting/accounts-receivable/components/InvoiceTable.tsx

import React, { useMemo, useState, Fragment } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
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
import { Search, ChevronDown, ChevronUp, ChevronRight, ChevronsUpDown, X } from 'lucide-react';
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
  invoices: Invoice[];
  page:     number;
  setPage:  (p: number | ((prev: number) => number)) => void;
  onRowClick?: (invoice: Invoice) => void;
}

export function InvoiceTable({ invoices, page, setPage, onRowClick }: InvoiceTableProps) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<keyof Invoice | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

  const handleSort = (key: keyof Invoice, order: 'asc' | 'desc' | null) => {
    setSortKey(key);
    setSortOrder(order);
  };

  const q = search.trim().toLowerCase();
  const filtered = q
    ? invoices.filter((inv) =>
        inv.invoiceNo.toLowerCase().includes(q)   ||
        inv.customer.toLowerCase().includes(q)    ||
        inv.salesman.toLowerCase().includes(q)    ||
        inv.division.toLowerCase().includes(q)    ||
        inv.customerCode.toLowerCase().includes(q) ||
        inv.invoiceDate.toLowerCase().includes(q) ||
        inv.deliveryDate.toLowerCase().includes(q) ||
        inv.due.toLowerCase().includes(q)         ||
        inv.arStatus.toLowerCase().includes(q)    ||
        inv.paymentStatus.toLowerCase().includes(q) ||
        inv.transactionStatus.toLowerCase().includes(q) ||
        inv.cluster.toLowerCase().includes(q)
      )
    : invoices;

  const customerGroups = useMemo(() => {
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

      // Sort the child invoices inside the group
      const sortedInvoices = [...invs];
      if (sortKey && sortOrder) {
        sortedInvoices.sort((a, b) => {
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
      }

      return {
        customerName: name,
        customerCode: invs[0]?.customerCode || '—',
        netReceivable,
        totalPaid,
        outstanding,
        maxOverdue,
        invoices: sortedInvoices,
      };
    });

    // Sort customer groups
    if (sortKey && sortOrder) {
      groups.sort((a, b) => {
        let aVal: string | number | null = '';
        let bVal: string | number | null = '';

        if (sortKey === 'customer') {
          aVal = a.customerName;
          bVal = b.customerName;
        } else if (sortKey === 'netReceivable') {
          aVal = a.netReceivable;
          bVal = b.netReceivable;
        } else if (sortKey === 'totalPaid') {
          aVal = a.totalPaid;
          bVal = b.totalPaid;
        } else if (sortKey === 'outstanding') {
          aVal = a.outstanding;
          bVal = b.outstanding;
        } else if (sortKey === 'overdue') {
          aVal = a.maxOverdue ?? -1;
          bVal = b.maxOverdue ?? -1;
        } else {
          // If sorting by invoice-specific fields, sort the groups by their first child invoice's value
          const aChild = a.invoices[0];
          const bChild = b.invoices[0];
          if (aChild && bChild) {
            let aChildVal = aChild[sortKey];
            let bChildVal = bChild[sortKey];
            if (aChildVal == null) aChildVal = '';
            if (bChildVal == null) bChildVal = '';
            if (typeof aChildVal === 'string' && typeof bChildVal === 'string') {
              return sortOrder === 'asc' ? aChildVal.localeCompare(bChildVal) : bChildVal.localeCompare(aChildVal);
            }
            if (typeof aChildVal === 'number' && typeof bChildVal === 'number') {
              return sortOrder === 'asc' ? aChildVal - bChildVal : bChildVal - aChildVal;
            }
          }
          return 0;
        }

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const compare = aVal.localeCompare(bVal);
          return sortOrder === 'asc' ? compare : -compare;
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
        }
        return 0;
      });
    } else {
      // Default alphabetical sort
      groups.sort((a, b) => a.customerName.localeCompare(b.customerName));
    }

    return groups;
  }, [filtered, sortKey, sortOrder]);

  const totalPages  = Math.ceil(customerGroups.length / PAGE_SIZE);
  const safePage    = Math.min(page, totalPages || 1);
  const pagedGroups = customerGroups.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
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
        <div className="flex items-center gap-2 max-w-sm w-full">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search invoice, customer, salesman, scode, cluster, status…"
              className="h-8 pl-8 text-xs focus-visible:ring-1"
            />
          </div>
          <button
            type="button"
            onClick={toggleAll}
            className="h-8 px-2.5 text-[10px] font-bold uppercase tracking-wider border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground rounded transition-colors whitespace-nowrap"
          >
            {isAllExpanded ? "Collapse Page" : "Expand Page"}
          </button>
        </div>
        <span className="text-xs text-muted-foreground shrink-0">
          {filtered.length} invoice{filtered.length !== 1 ? 's' : ''} ({customerGroups.length} customer{customerGroups.length !== 1 ? 's' : ''}) &mdash; page {safePage} of {totalPages || 1}
        </span>
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-auto relative w-full">
          <Table className="w-full table-fixed">
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
                  {q ? `No results for "${search}".` : 'No invoices found.'}
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
                    {isExpanded &&
                      group.invoices.map((inv, idx) => {
                        const isLast = idx === group.invoices.length - 1;
                        return (
                          <TableRow
                            key={`${inv.invoiceNo}-${idx}`}
                            className="border-b border-border/20 hover:bg-muted/15 cursor-pointer bg-card/45 transition-colors active:bg-muted/25"
                            onClick={() => onRowClick?.(inv)}
                          >
                            <TableCell className="py-2 pl-8 relative">
                              {/* vertical tree connector line */}
                              {isLast ? (
                                <div className="absolute left-5 top-0 h-[22px] w-px bg-border/80 dark:bg-border/45" />
                              ) : (
                                <div className="absolute left-5 top-0 bottom-0 w-px bg-border/80 dark:bg-border/45" />
                              )}
                              {/* horizontal tree connector line */}
                              <div className="absolute left-5 top-[22px] w-3 h-px bg-border/80 dark:bg-border/45" />
                              
                              <div className="flex flex-col gap-0.5 min-w-0 pl-2.5">
                                <span className="font-bold text-primary/95 text-xs truncate block w-full" title={inv.invoiceNo}>
                                  {inv.invoiceNo}
                                </span>
                                {inv.isPosted ? (
                                  <span className="inline-flex items-center w-max px-1.5 py-0.25 rounded-[3px] text-[8px] font-semibold tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15 uppercase">
                                    Posted
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center w-max px-1.5 py-0.25 rounded-[3px] text-[8px] font-semibold tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/15 uppercase">
                                    Draft
                                  </span>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="py-2 text-muted-foreground/45 text-[10px] italic">
                              └─ detail
                            </TableCell>

                            <TableCell className="py-2">
                              <span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.salesman}>
                                {inv.salesman || <span className="text-muted-foreground/30">—</span>}
                              </span>
                            </TableCell>

                            <TableCell className="py-2">
                              <span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.division}>
                                {inv.division || <span className="text-muted-foreground/30">—</span>}
                              </span>
                            </TableCell>

                            <TableCell className="py-2">
                              <span className="text-[11px] text-muted-foreground truncate block w-full" title={inv.salesmanCode}>
                                {inv.salesmanCode || <span className="text-muted-foreground/30">—</span>}
                              </span>
                            </TableCell>

                            <TableCell className="py-2">
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap block">
                                {formatDate(inv.invoiceDate)}
                              </span>
                            </TableCell>

                            <TableCell className="py-2">
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap block">
                                {formatDate(inv.deliveryDate)}
                              </span>
                            </TableCell>

                            <TableCell className="py-2">
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap block">
                                {formatDate(inv.due)}
                              </span>
                            </TableCell>

                            <TableCell className="py-2 text-right">
                              <span className="text-xs font-medium text-muted-foreground/90">{formatPeso(inv.netReceivable)}</span>
                            </TableCell>

                            <TableCell className="py-2 text-right">
                              <span className="text-xs font-medium text-muted-foreground/90">{formatPeso(inv.totalPaid)}</span>
                            </TableCell>

                            <TableCell className="py-2 text-right font-semibold tabular-nums text-foreground/90">
                              {formatPeso(inv.outstanding)}
                            </TableCell>

                            <TableCell className="py-2 text-center">
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

                            <TableCell className="py-2">
                              <StatusPill status={inv.arStatus} />
                            </TableCell>

                            <TableCell className="py-2">
                              <StatusPill status={inv.paymentStatus} />
                            </TableCell>

                            <TableCell className="py-2 pr-4">
                              <StatusPill status={inv.transactionStatus} />
                            </TableCell>
                          </TableRow>
                        );
                      })}
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