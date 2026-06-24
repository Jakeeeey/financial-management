// src/modules/financial-management/accounting/accounts-receivable/components/InvoiceTable.tsx
import React, { useMemo, useState, Fragment } from 'react';
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
import { formatPeso, formatDate, getPageNumbers } from '../utils';
import type { Invoice } from '../types';

const PAGE_SIZE = 10;

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  'Paid':           { bg: 'rgba(16,185,129,0.1)',  color: '#059669' },
  'Overdue':        { bg: 'rgba(239,68,68,0.1)',   color: '#dc2626' },
  'Partially Paid': { bg: 'rgba(245,158,11,0.1)',  color: '#d97706' },
  'Unpaid':         { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
  'Due':            { bg: 'rgba(100,116,139,0.1)', color: '#64748b' },
  'Cancellation Requested': { bg: 'rgba(245,158,11,0.12)', color: '#d97706' },
};

function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? { bg: 'rgba(100,116,139,0.1)', color: '#64748b' };
  const showDot = ['Paid', 'Fully Paid', 'Overdue', 'Due', 'Unpaid', 'Partially Paid', 'Cancellation Requested'].includes(status);
  const dotColors: Record<string, string> = {
    'Paid': 'bg-emerald-500',
    'Fully Paid': 'bg-emerald-500',
    'Overdue': 'bg-rose-500 animate-pulse',
    'Due': 'bg-blue-500',
    'Unpaid': 'bg-slate-400',
    'Partially Paid': 'bg-amber-500 animate-pulse',
    'Cancellation Requested': 'bg-amber-500 animate-pulse',
  };

  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-current/10 whitespace-nowrap shadow-sm"
      style={{ background: style.bg, color: style.color }}
    >
      {showDot && (
        <span className={`w-1 h-1 rounded-full ${dotColors[status] || 'bg-slate-400'}`} />
      )}
      {status}
    </span>
  );
}

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
          "flex items-center gap-1.5 focus:outline-none hover:text-foreground [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-muted-foreground whitespace-nowrap font-bold",
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
  const [sortKey, setSortKey] = useState<keyof Invoice | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [expandedCustomers, setExpandedCustomers] = useState<Record<string, boolean>>({});

  const handleSort = (key: keyof Invoice, order: 'asc' | 'desc' | null) => {
    setSortKey(key);
    setSortOrder(order);
  };

  const customerGroups = useMemo(() => {
    const groupsMap: Record<string, Invoice[]> = {};
    invoices.forEach((inv) => {
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

      // Sort child invoices
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
      groups.sort((a, b) => a.customerName.localeCompare(b.customerName));
    }

    return groups;
  }, [invoices, sortKey, sortOrder]);

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
    <Card className="dark:bg-zinc-950 border-border overflow-hidden w-full shadow-md">
      <CardHeader className="bg-muted/30 border-b border-border/50 flex flex-row items-center justify-between gap-4 py-3">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground/90 shrink-0">Invoice Ledger Details</CardTitle>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={toggleAll}
            className="h-7 px-3 text-[10px] font-bold uppercase tracking-wider border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-all active:scale-95 whitespace-nowrap shadow-sm"
          >
            {isAllExpanded ? "Collapse All Groups" : "Expand All Groups"}
          </button>
          <span className="text-[10px] font-bold text-muted-foreground bg-muted border border-border/60 px-2 py-0.5 rounded-md shrink-0">
            {invoices.length} Invoices &bull; {customerGroups.length} Customers
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="max-h-[600px] overflow-auto relative w-full">
          <Table className="w-full table-fixed">
            <TableHeader className="sticky top-0 bg-background dark:bg-zinc-950 z-20 shadow-sm">
              <TableRow className="bg-muted/40 hover:bg-muted/40 border-b border-border/50">
                <TableHead className="py-2.5 pl-4 w-[13%] whitespace-nowrap"><SortableHeader<Invoice> label="Invoice No" sortKey="invoiceNo" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-[10px]" /></TableHead>
                <TableHead className="py-2.5 w-[15%] whitespace-nowrap"><SortableHeader<Invoice> label="Salesperson" sortKey="salesman" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-[10px]" /></TableHead>
                <TableHead className="py-2.5 w-[10%] whitespace-nowrap"><SortableHeader<Invoice> label="Division" sortKey="division" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-[10px]" /></TableHead>
                <TableHead className="py-2.5 w-[9%] whitespace-nowrap"><SortableHeader<Invoice> label="Inv. Date" sortKey="invoiceDate" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-[10px]" /></TableHead>
                <TableHead className="py-2.5 w-[9%] whitespace-nowrap"><SortableHeader<Invoice> label="Del. Date" sortKey="deliveryDate" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-[10px]" /></TableHead>
                <TableHead className="py-2.5 w-[9%] whitespace-nowrap"><SortableHeader<Invoice> label="Due Date" sortKey="due" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-[10px]" /></TableHead>
                <TableHead className="py-2.5 text-right w-[11%] whitespace-nowrap"><SortableHeader<Invoice> label="Receivable" sortKey="netReceivable" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-[10px] justify-end w-full" /></TableHead>
                <TableHead className="py-2.5 text-right w-[9%] whitespace-nowrap"><SortableHeader<Invoice> label="Paid" sortKey="totalPaid" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-[10px] justify-end w-full" /></TableHead>
                <TableHead className="py-2.5 text-right w-[11%] whitespace-nowrap"><SortableHeader<Invoice> label="Outstanding" sortKey="outstanding" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-[10px] justify-end w-full" /></TableHead>
                <TableHead className="py-2.5 text-center w-[7%] whitespace-nowrap"><SortableHeader<Invoice> label="Aging" sortKey="overdue" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-[10px] justify-center w-full" /></TableHead>
                <TableHead className="py-2.5 w-[10%] whitespace-nowrap"><SortableHeader<Invoice> label="AR Status" sortKey="arStatus" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-[10px]" /></TableHead>
                <TableHead className="py-2.5 pr-4 w-[12%] whitespace-nowrap"><SortableHeader<Invoice> label="TX Status" sortKey="transactionStatus" currentSortKey={sortKey} currentSortOrder={sortOrder} onSort={handleSort} className="text-[10px]" /></TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {pagedGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-12 text-muted-foreground text-xs font-medium">
                    No active invoices match the selected search or filter options.
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
                      {/* Unified 100% Full-Width Group Header Card */}
                      <TableRow
                        className="bg-muted/40 hover:bg-muted/65 border-b border-border/40 cursor-pointer select-none font-semibold transition-colors active:bg-muted/50 border-l-4 border-l-primary/60 dark:border-l-primary/45"
                        onClick={(e) => toggleExpand(e)}
                      >
                        <TableCell colSpan={12} className="py-2.5 pl-4 pr-4">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            {/* Chevron + Customer identification */}
                            <div className="flex items-center gap-2.5 min-w-0">
                              {isExpanded ? (
                                <ChevronDown className="h-4.5 w-4.5 text-primary shrink-0 transition-transform duration-200" />
                              ) : (
                                <ChevronRight className="h-4.5 w-4.5 text-muted-foreground/60 shrink-0 transition-transform duration-200" />
                              )}
                              <div className="truncate flex items-center gap-2 flex-wrap">
                                <span className="font-extrabold text-xs text-foreground tracking-tight">{group.customerName}</span>
                                <span className="text-[9px] font-bold text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border/60">
                                  {group.customerCode}
                                </span>
                                <span className="text-[9px] font-bold text-primary/75">
                                  ({group.invoices.length} Invoice{group.invoices.length !== 1 ? 's' : ''})
                                </span>
                              </div>
                            </div>
                            
                            {/* Aggregated totals in compact layout */}
                            <div className="flex items-center gap-4 text-[10px] shrink-0 self-end sm:self-auto font-mono">
                              <div className="text-right">
                                <span className="text-[8px] block text-muted-foreground font-sans font-bold uppercase tracking-wider leading-none">Receivable</span>
                                <span className="font-bold text-muted-foreground/90">{formatPeso(group.netReceivable)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[8px] block text-muted-foreground font-sans font-bold uppercase tracking-wider leading-none">Paid</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatPeso(group.totalPaid)}</span>
                              </div>
                              <div className="text-right bg-primary/[0.04] px-2 py-0.5 rounded border border-primary/10">
                                <span className="text-[8px] block text-primary font-sans font-black uppercase tracking-wider leading-none">Outstanding</span>
                                <span className="font-black text-primary">{formatPeso(group.outstanding)}</span>
                              </div>
                              {group.maxOverdue !== null && group.maxOverdue >= 0 && (
                                <div className="text-center bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/15">
                                  <span className="text-[8px] block text-rose-600 dark:text-rose-400 font-sans font-bold uppercase tracking-wider leading-none">Overdue</span>
                                  <span className="font-bold text-rose-600 dark:text-rose-400">{group.maxOverdue}d</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Child Invoice Rows (Expanded state) */}
                      {isExpanded &&
                        group.invoices.map((inv, idx) => {
                          const isLast = idx === group.invoices.length - 1;
                          return (
                            <TableRow
                              key={`${inv.invoiceNo}-${idx}`}
                              className="border-b border-border/20 hover:bg-muted/15 cursor-pointer bg-card/25 transition-colors active:bg-muted/20"
                              onClick={() => onRowClick?.(inv)}
                            >
                              {/* Invoice identification (with vertical and horizontal layout connectors) */}
                              <TableCell className="py-2 pl-8 relative">
                                {isLast ? (
                                  <div className="absolute left-5 top-0 h-[22px] w-px bg-border/80 dark:bg-border/45" />
                                ) : (
                                  <div className="absolute left-5 top-0 bottom-0 w-px bg-border/80 dark:bg-border/45" />
                                )}
                                <div className="absolute left-5 top-[22px] w-3 h-px bg-border/80 dark:bg-border/45" />
                                
                                <div className="flex flex-col gap-0.5 min-w-0 pl-2.5">
                                  <span className="font-bold text-primary/95 text-[11px] truncate block w-full" title={inv.invoiceNo}>
                                    {inv.invoiceNo}
                                  </span>
                                  {inv.isPosted ? (
                                    <span className="inline-flex items-center w-max px-1.5 py-0.25 rounded-[3px] text-[8px] font-bold tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15 uppercase">
                                      Posted
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center w-max px-1.5 py-0.25 rounded-[3px] text-[8px] font-bold tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/15 uppercase">
                                      Draft
                                    </span>
                                  )}
                                </div>
                              </TableCell>

                              {/* Consolidated Salesperson Column (contains SCode as subtitle) */}
                              <TableCell className="py-2">
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-bold text-foreground/95 truncate block" title={inv.salesman}>
                                    {inv.salesman}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground/80 font-semibold uppercase tracking-wider">
                                    Code: {inv.salesmanCode}
                                  </span>
                                </div>
                              </TableCell>

                              <TableCell className="py-2">
                                <span className="text-[11px] text-muted-foreground font-medium block">
                                  {inv.division || <span className="text-muted-foreground/30">&mdash;</span>}
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
                                <span className="text-[11px] text-muted-foreground whitespace-nowrap block font-medium">
                                  {formatDate(inv.due)}
                                </span>
                              </TableCell>

                              <TableCell className="py-2 text-right font-medium text-muted-foreground/90 tabular-nums">
                                {formatPeso(inv.netReceivable)}
                              </TableCell>

                              <TableCell className="py-2 text-right font-medium text-muted-foreground/90 tabular-nums">
                                {formatPeso(inv.totalPaid)}
                              </TableCell>

                              <TableCell className="py-2 text-right font-black text-xs tabular-nums text-foreground/90">
                                {formatPeso(inv.outstanding)}
                              </TableCell>

                              <TableCell className="py-2 text-center">
                                {inv.overdue !== null && inv.overdue >= 0 ? (
                                  <span
                                    className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-muted border border-border/40"
                                    style={{ color: agingColor(inv.overdue) }}
                                  >
                                    {inv.overdue}d
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground/45">&mdash;</span>
                                )}
                              </TableCell>

                              <TableCell className="py-2">
                                <StatusPill status={inv.arStatus} />
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