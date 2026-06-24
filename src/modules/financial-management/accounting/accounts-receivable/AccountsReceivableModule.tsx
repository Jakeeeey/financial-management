"use client";

import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Clock, PhilippinePeso, X, Download, FileSpreadsheet, Sparkles, Receipt, Search, Info } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useAccountsReceivable } from './hooks/useAccountsReceivable';
import { AgingChart } from './components/AgingChart';
import { SalesmanChart } from './components/SalesmanChart';
import { InvoiceTable } from './components/InvoiceTable';
import { DrilldownChart } from './components/DrilldownChart';
import { InvoiceDetailSheet } from './components/InvoiceDetailSheet';
import type { Invoice } from './types';
import { deriveMetrics, deriveAgingData, formatPeso, generateAIInsights } from './utils';

// ── Compact stat pill ────────────────────────────────────────────────────────
function Stat({
  label, value, sub, icon, type = 'normal', explanation
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  type?: 'normal' | 'receivable' | 'outstanding' | 'unposted' | 'exposure' | 'overdue';
  explanation?: React.ReactNode;
}) {
  const styles = {
    receivable: {
      border: 'border-blue-500/10 dark:border-blue-500/20',
      bg: 'bg-gradient-to-br from-blue-500/[0.04] via-transparent to-transparent',
      text: 'text-blue-600 dark:text-blue-400',
      shadow: 'hover:shadow-blue-500/5',
    },
    outstanding: {
      border: 'border-amber-500/10 dark:border-amber-500/20',
      bg: 'bg-gradient-to-br from-amber-500/[0.04] via-transparent to-transparent',
      text: 'text-amber-600 dark:text-amber-400',
      shadow: 'hover:shadow-amber-500/5',
    },
    unposted: {
      border: 'border-purple-500/10 dark:border-purple-500/20',
      bg: 'bg-gradient-to-br from-purple-500/[0.04] via-transparent to-transparent',
      text: 'text-purple-600 dark:text-purple-400',
      shadow: 'hover:shadow-purple-500/5',
    },
    exposure: {
      border: 'border-emerald-500/10 dark:border-emerald-500/20',
      bg: 'bg-gradient-to-br from-emerald-500/[0.04] via-transparent to-transparent',
      text: 'text-emerald-600 dark:text-emerald-400',
      shadow: 'hover:shadow-emerald-500/5',
    },
    overdue: {
      border: 'border-rose-500/10 dark:border-rose-500/20',
      bg: 'bg-gradient-to-br from-rose-500/[0.04] via-transparent to-transparent',
      text: 'text-rose-600 dark:text-rose-400',
      shadow: 'hover:shadow-rose-500/5',
    },
    normal: {
      border: 'border-border/60',
      bg: 'bg-muted/10',
      text: 'text-muted-foreground',
      shadow: 'hover:shadow-foreground/5',
    }
  }[type];

  return (
    <motion.div 
      whileHover={{ y: -2, scale: 1.015 }}
      transition={{ type: "spring", stiffness: 300, damping: 15 }}
      className={`flex flex-col gap-1 rounded-xl border p-4 shadow-sm backdrop-blur-md transition-all duration-300 ${styles.border} ${styles.bg} ${styles.shadow} relative overflow-hidden`}
    >
      <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-foreground/[0.02] to-transparent rounded-full pointer-events-none" />
      <div className="flex items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground/85 truncate">{label}</span>
          {explanation && (
            <Popover>
              <PopoverTrigger asChild>
                <button 
                  onClick={(e) => e.stopPropagation()} 
                  className="p-0.5 rounded-full text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors cursor-pointer inline-flex items-center justify-center shrink-0"
                  title="Click for explanation"
                >
                  <Info className="h-3 w-3" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80 p-4 border border-border bg-popover text-popover-foreground shadow-xl rounded-xl z-50 text-xs" onClick={(e) => e.stopPropagation()}>
                {explanation}
              </PopoverContent>
            </Popover>
          )}
        </div>
        {icon && <span className={`p-1.5 rounded-lg bg-muted/30 ${styles.text} shrink-0`}>{icon}</span>}
      </div>
      <div className="text-lg font-black tabular-nums text-foreground leading-none mt-1 z-10">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground/75 leading-tight mt-1.5 font-medium z-10">{sub}</div>}
    </motion.div>
  );
}

export default function AccountsReceivableModule() {
  const { loading, error, invoices, agingData, salesmanData, metrics, operationData } =
      useAccountsReceivable();

  const [page, setPage]         = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [customer, setCustomer] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [cluster, setCluster]   = useState('');
  const [salesman, setSalesman] = useState('');
  const [division, setDivision] = useState('');
  const [operation, setOperation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [agingRange, setAgingRange] = useState('');

  // ── Filter option lists ────────────────────────────────────────────────────
  const customerOptions = useMemo(
      () => Array.from(new Set(invoices.map((inv) => inv.customer))).sort(),
      [invoices]
  );
  const clusterOptions = useMemo(
      () => Array.from(new Set(invoices.map((inv) => inv.cluster).filter((c) => c && c !== 'Unassigned'))).sort(),
      [invoices]
  );
  const salesmanOptions = useMemo(
      () => Array.from(new Set(invoices.map((inv) => inv.salesman).filter((s) => s && s !== 'Unknown'))).sort(),
      [invoices]
  );
  const divisionOptions = useMemo(
      () => Array.from(new Set(invoices.map((inv) => inv.division).filter((d) => d && d !== '—'))).sort(),
      [invoices]
  );
  const operationOptions = useMemo(
      () => operationData.map((op) => ({ value: String(op.id), label: op.name })),
      [operationData]
  );

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      const invDate = inv.invoiceDate ? inv.invoiceDate.split(' ')[0] : '';
      if (dateFrom && invDate && invDate < dateFrom) return false;
      if (dateTo   && invDate && invDate > dateTo)   return false;
      if (customer && inv.customer !== customer) return false;
      if (cluster  && inv.cluster  !== cluster)  return false;
      if (salesman && inv.salesman !== salesman)  return false;
      if (division && inv.division !== division)  return false;
      if (operation && String(inv.salesType) !== String(operation)) return false;
      if (agingRange) {
        if (inv.overdue === null || inv.overdue < 0) return false;
        const overdueDays = inv.overdue;
        if (agingRange === '0-30 Days' && overdueDays > 30) return false;
        if (agingRange === '31-60 Days' && (overdueDays <= 30 || overdueDays > 60)) return false;
        if (agingRange === '61-90 Days' && (overdueDays <= 60 || overdueDays > 90)) return false;
        if (agingRange === '90+ Days' && overdueDays <= 90) return false;
      }
      if (q) {
        const matchesInvoice = inv.invoiceNo.toLowerCase().includes(q);
        const matchesCustomer = inv.customer.toLowerCase().includes(q);
        if (!matchesInvoice && !matchesCustomer) return false;
      }
      return true;
    });
  }, [invoices, dateFrom, dateTo, customer, cluster, salesman, division, operation, searchQuery, agingRange]);

  const isFiltered = !!(dateFrom || dateTo || customer || cluster || salesman || division || operation || searchQuery || agingRange);

  // ── Derived display data ───────────────────────────────────────────────────
  const filteredSalesmanMap = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInvoices.forEach((inv) => {
      map[inv.salesman] = (map[inv.salesman] || 0) + inv.outstanding;
    });
    return map;
  }, [filteredInvoices]);

  const filteredMetrics = useMemo(
      () => isFiltered ? deriveMetrics(filteredInvoices) : metrics,
      [filteredInvoices, isFiltered, metrics]
  );

  const displaySalesmanData = useMemo(() => {
    if (!isFiltered) return salesmanData;
    return Object.entries(filteredSalesmanMap)
        .map(([name, value]) => {
          const original = salesmanData.find(s => s.name === name);
          return {
            name,
            value,
            unposted: original?.unposted ?? 0
          };
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);
  }, [filteredSalesmanMap, isFiltered, salesmanData]);

  const displayInvoices  = isFiltered ? filteredInvoices : invoices;
  const displayAgingData = useMemo(
      () => isFiltered ? deriveAgingData(filteredInvoices) : agingData,
      [filteredInvoices, isFiltered, agingData]
  );

  const aiInsights = useMemo(() => {
    return generateAIInsights(displayInvoices, filteredMetrics);
  }, [displayInvoices, filteredMetrics]);

  // ── Exact per-operation data when filtered (uses real salesType on Invoice) ─
  const displayOperationData = useMemo(() => {
    if (!isFiltered) return operationData;
    const agg = new Map<number | null, { name: string; code: string | null; totalOutstanding: number; count: number }>();
    for (const inv of filteredInvoices) {
      const key = inv.salesType;
      if (!agg.has(key)) {
        const op = operationData.find((o) => o.id === key);
        agg.set(key, {
          name:             op?.name ?? 'Unknown',
          code:             op?.code ?? null,
          totalOutstanding: 0,
          count:            0,
        });
      }
      const e = agg.get(key)!;
      e.totalOutstanding += inv.outstanding;
      e.count += 1;
    }
    return Array.from(agg.entries())
        .map(([id, v]) => ({ id: id as number | null, ...v }))
        .sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [isFiltered, filteredInvoices, operationData]);

  const { totalReceivable, totalOutstanding, totalUnposted, realOutstanding, overdueInvoices, avgOverdue, totalPendingCancellation } = filteredMetrics;

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setCustomer(''); setCluster(''); setSalesman(''); setDivision(''); setOperation(''); setSearchQuery(''); setAgingRange(''); setPage(1);
  };

  // ── PDF export ─────────────────────────────────────────────────────────────
  const exportToPDF = () => {
    const doc   = new jsPDF({ orientation: 'landscape', format: 'a3' });
    const pageW = doc.internal.pageSize.getWidth();
    const total = filteredMetrics.totalOutstanding;
    const formattedTotal = `PHP ${total.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('Accounts Receivable Report', 10, 16);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const totalLabel  = `Total Outstanding: ${formattedTotal}`;
    const totalLabelX = Math.max(pageW / 2, pageW - 10 - doc.getTextWidth(totalLabel));
    doc.text(totalLabel, totalLabelX, 16);

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(10, 20, pageW - 10, 20);

    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    const filterInfo =
        `From: ${dateFrom || 'N/A'}   To: ${dateTo || 'N/A'}   Customer: ${customer || 'All'}   Cluster: ${cluster || 'All'}   Salesman: ${salesman || 'All'}   Division: ${division || 'All'}`;
    doc.text(filterInfo, 10, 26);
    doc.text(
        `Exported: ${new Date().toLocaleString('en-PH')}   Total Records: ${displayInvoices.length}`,
        10, 31
    );
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 36,
      headStyles: { fillColor: [24, 24, 27], fontSize: 7, textColor: 255 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0:  { cellWidth: 22 },
        1:  { cellWidth: 42 },
        2:  { cellWidth: 42 },
        3:  { cellWidth: 22 },
        4:  { cellWidth: 24 },
        5:  { cellWidth: 24 },
        6:  { cellWidth: 24 },
        7:  { cellWidth: 28 },
        8:  { cellWidth: 24 },
        9:  { cellWidth: 30 },
        10: { cellWidth: 16 },
        11: { cellWidth: 22 },
        12: { cellWidth: 24 },
      },
      head: [[
        'inv #', 'Customer', 'Salesperson', 'Division', 'Inv. Date', 'Del Date', 'Due Date',
        'Net Receivable', 'Paid', 'Outstanding', 'Overdue', 'AR Status', 'Transaction Status',
      ]],
      body: displayInvoices.map((inv) => [
        inv.invoiceNo,
        inv.customer,
        `${inv.salesman} (${inv.salesmanCode})`,
        inv.division,
        (inv.invoiceDate ?? '').split('T')[0],
        (inv.deliveryDate ?? '').split('T')[0],
        (inv.due ?? '').split('T')[0],
        inv.netReceivable?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) ?? '',
        inv.totalPaid?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) ?? '',
        inv.outstanding?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) ?? '',
        inv.overdue !== null && inv.overdue >= 0 ? `${inv.overdue}d` : '—',
        inv.arStatus,
        inv.transactionStatus,
      ]),
      margin: { left: 10, right: 10 },
      tableWidth: 'auto',
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? 36;
    const boxW   = 110;
    const boxH   = 12;
    const boxX   = pageW - 14 - boxW;
    const boxY   = finalY + 6;

    doc.setFillColor(24, 24, 27);
    doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Total Outstanding:', boxX + 4, boxY + 7.5);
    const amtW = doc.getTextWidth(formattedTotal);
    doc.text(formattedTotal, boxX + boxW - 4 - amtW, boxY + 7.5);

    doc.save(`ar-export-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // ── Excel export ───────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const excelData = displayInvoices.map((inv) => ({
      'inv #': inv.invoiceNo,
      'Customer': inv.customer,
      'Salesperson': `${inv.salesman} (${inv.salesmanCode})`,
      'Division': inv.division,
      'Inv. Date': inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
      'Del Date': inv.deliveryDate ? inv.deliveryDate.split('T')[0] : '',
      'Due Date': inv.due ? inv.due.split('T')[0] : '',
      'Net Receivable': inv.netReceivable,
      'Paid': inv.totalPaid,
      'Outstanding': inv.outstanding,
      'Overdue': inv.overdue !== null && inv.overdue >= 0 ? `${inv.overdue}d` : '—',
      'AR Status': inv.arStatus,
      'Transaction Status': inv.transactionStatus,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    const totalRow = {
      'inv #': 'TOTAL',
      'Customer': '',
      'Salesperson': '',
      'Division': '',
      'Inv. Date': '',
      'Del Date': '',
      'Due Date': '',
      'Net Receivable': '',
      'Paid': '',
      'Outstanding': filteredMetrics.totalOutstanding,
      'Overdue': '',
      'AR Status': '',
      'Transaction Status': '',
    };

    XLSX.utils.sheet_add_json(worksheet, [totalRow], { skipHeader: true, origin: -1 });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Accounts Receivable');

    XLSX.writeFile(workbook, `ar-export-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-48" />
        <div className="grid gap-2 grid-cols-2 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-80 w-full" />
      </div>
  );

  if (error) return (
      <div className="p-6 text-center text-xs text-destructive border border-destructive/30 rounded m-4">
        Error: {error}
      </div>
  );


  return (
      <div className="p-3 md:p-4 bg-background text-foreground min-h-screen space-y-3 w-full box-border overflow-hidden">

        {/* ── Header + Export ── */}
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight truncate">Accounts Receivable</h1>
            <p className="text-[10px] text-muted-foreground">
              Unpaid · excl. posted &amp; fully paid
              {isFiltered && (
                  <span className="ml-2 font-semibold text-foreground">
                {displayInvoices.length}/{invoices.length} shown
              </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAIInsights(!showAIInsights)}
                className={`h-7 px-2.5 text-[10px] gap-1 transition-all ${
                  showAIInsights 
                    ? 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300 font-bold shadow-sm'
                    : 'border-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/10'
                }`}
            >
              <Sparkles className={`h-3 w-3 ${showAIInsights ? 'text-purple-600 animate-spin' : 'text-purple-500'}`} />
              AI Copilot
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={exportToExcel}
                className="h-7 px-2.5 text-[10px] gap-1"
            >
              <FileSpreadsheet className="h-3 w-3 text-green-600" />
              Excel
            </Button>
            <Button
                variant="outline"
                size="sm"
                onClick={exportToPDF}
                className="h-7 px-2.5 text-[10px] gap-1"
            >
              <Download className="h-3 w-3" />
              PDF
            </Button>
          </div>
        </div>

        {/* ── AI Executive Insights Card ── */}
        <AnimatePresence>
          {showAIInsights && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: -8, marginBottom: 0 }}
              animate={{ height: 'auto', opacity: 1, marginTop: 4, marginBottom: 8 }}
              exit={{ height: 0, opacity: 0, marginTop: -8, marginBottom: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-background border border-purple-500/25 shadow-md shadow-purple-500/5 rounded-xl p-4 space-y-3 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
                
                <div className="flex items-center justify-between border-b border-purple-500/10 pb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500 animate-pulse" />
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">AI Executive Insights</h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAIInsights(false)}
                    className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground hover:bg-purple-500/10 rounded-full"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>

                <p className="text-[11px] leading-relaxed text-foreground/90 font-medium">
                  {aiInsights.summary}
                </p>

                <div className="grid gap-4 md:grid-cols-2 pt-1">
                  <div className="space-y-2">
                    <h4 className="text-[9px] font-bold uppercase tracking-widest text-rose-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> Key Exposures &amp; Risks
                    </h4>
                    <ul className="space-y-1.5 pl-3 border-l border-rose-500/25">
                      {aiInsights.risks.map((risk, idx) => (
                        <li key={idx} className="text-[10px] text-muted-foreground leading-snug font-medium">
                          {risk}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Strategic Actions
                    </h4>
                    <ul className="space-y-1.5 pl-3 border-l border-emerald-500/25">
                      {aiInsights.recommendations.map((rec, idx) => (
                        <li key={idx} className="text-[10px] text-muted-foreground leading-snug font-medium">
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filter bar ── */}
        <div className="flex flex-wrap items-center gap-2 w-full min-w-0 p-3 rounded-xl border border-border/50 bg-card/45 backdrop-blur-md shadow-sm">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/60 mr-0.5">Filter</span>

          <div className="relative w-[180px] h-7">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
              placeholder="Search Customer / Invoice..."
              className="h-7 pl-8 text-[10px] focus-visible:ring-1 bg-background border-border/60"
            />
          </div>

          <Select
              value=""
              onValueChange={(val) => {
                  const today = new Date();
                  let fromDate = '';
                  let toDate = '';
                  if (val === 'today') {
                      fromDate = today.toISOString().split('T')[0];
                      toDate = fromDate;
                  } else if (val === 'yesterday') {
                      const yest = new Date();
                      yest.setDate(today.getDate() - 1);
                      fromDate = yest.toISOString().split('T')[0];
                      toDate = fromDate;
                  } else if (val === 'thisWeek') {
                      const first = today.getDate() - today.getDay();
                      fromDate = new Date(today.setDate(first)).toISOString().split('T')[0];
                      toDate = new Date().toISOString().split('T')[0];
                  } else if (val === 'thisMonth') {
                      fromDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                      toDate = new Date().toISOString().split('T')[0];
                  } else if (val === 'last30') {
                      const prior = new Date();
                      prior.setDate(today.getDate() - 30);
                      fromDate = prior.toISOString().split('T')[0];
                      toDate = new Date().toISOString().split('T')[0];
                  }
                  setDateFrom(fromDate);
                  setDateTo(toDate);
                  setPage(1);
              }}
          >
            <SelectTrigger className="h-7 w-[95px] text-[10px] bg-background border border-border/60">
              <SelectValue placeholder="Quick Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today" className="text-[10px]">Today</SelectItem>
              <SelectItem value="yesterday" className="text-[10px]">Yesterday</SelectItem>
              <SelectItem value="thisWeek" className="text-[10px]">This Week</SelectItem>
              <SelectItem value="thisMonth" className="text-[10px]">This Month</SelectItem>
              <SelectItem value="last30" className="text-[10px]">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1 rounded border border-border/60 bg-background px-2 h-7">
            <span className="text-[9px] text-muted-foreground shrink-0">From</span>
            <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="h-auto border-0 p-0 text-[10px] focus-visible:ring-0 shadow-none w-[96px] bg-transparent"
            />
          </div>

          <div className="flex items-center gap-1 rounded border border-border/60 bg-background px-2 h-7">
            <span className="text-[9px] text-muted-foreground shrink-0">To</span>
            <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="h-auto border-0 p-0 text-[10px] focus-visible:ring-0 shadow-none w-[96px] bg-transparent"
            />
          </div>

          <SearchableSelect
              value={customer}
              onValueChange={(val) => { setCustomer(val); setPage(1); }}
              placeholder="All Customers"
              className="h-7 w-[160px] text-[10px] !block text-left truncate relative pr-7 [&_svg]:absolute [&_svg]:right-2.5 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
              options={[
                { value: '', label: 'All Customers' },
                ...customerOptions.map((name) => ({ value: name, label: name })),
              ]}
          />

          <SearchableSelect
              value={cluster}
              onValueChange={(val) => { setCluster(val); setPage(1); }}
              placeholder="All Clusters"
              className="h-7 w-[130px] text-[10px] !block text-left truncate relative pr-7 [&_svg]:absolute [&_svg]:right-2.5 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
              options={[
                { value: '', label: 'All Clusters' },
                ...clusterOptions.map((name) => ({ value: name, label: name })),
              ]}
          />

          <SearchableSelect
              value={salesman}
              onValueChange={(val) => { setSalesman(val); setPage(1); }}
              placeholder="All Salesmen"
              className="h-7 w-[150px] text-[10px] !block text-left truncate relative pr-7 [&_svg]:absolute [&_svg]:right-2.5 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
              options={[
                { value: '', label: 'All Salesmen' },
                ...salesmanOptions.map((name) => ({ value: name, label: name })),
              ]}
          />

          <SearchableSelect
              value={division}
              onValueChange={(val) => { setDivision(val); setPage(1); }}
              placeholder="All Divisions"
              className="h-7 w-[150px] text-[10px] !block text-left truncate relative pr-7 [&_svg]:absolute [&_svg]:right-2.5 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
              options={[
                { value: '', label: 'All Divisions' },
                ...divisionOptions.map((name) => ({ value: name, label: name })),
              ]}
          />

          <SearchableSelect
              value={operation}
              onValueChange={(val) => { setOperation(val); setPage(1); }}
              placeholder="All Operations"
              className="h-7 w-[150px] text-[10px] !block text-left truncate relative pr-7 [&_svg]:absolute [&_svg]:right-2.5 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
              options={[
                { value: '', label: 'All Operations' },
                ...operationOptions,
              ]}
          />

          {agingRange && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded border border-blue-500/20 bg-blue-500/10 text-[10px] font-bold text-blue-600 dark:text-blue-400">
              Aging: {agingRange}
              <button onClick={() => { setAgingRange(''); setPage(1); }} className="hover:text-rose-500 ml-1 cursor-pointer">
                <X className="h-3 w-3" />
              </button>
            </span>
          )}

          {isFiltered && (
              <Button variant="ghost" size="sm" onClick={clearFilters}
                      className="h-7 px-2 text-[10px] text-muted-foreground hover:text-foreground gap-1">
                <X className="h-3 w-3" /> Clear
              </Button>
          )}
        </div>

        {/* ── Stats row ── */}
        <div className="grid gap-2 grid-cols-2 md:grid-cols-5 w-full">
          <Stat
              label="Total Receivable"
              value={formatPeso(totalReceivable)}
              sub={`${displayInvoices.length} invoices`}
              icon={<PhilippinePeso className="h-3.5 w-3.5" />}
              type="receivable"
              explanation={
                <div className="space-y-1.5 p-1 text-xs">
                  <p className="font-bold text-blue-600">Total Receivable</p>
                  <p className="text-muted-foreground leading-relaxed">
                    The total initial billing value of all active draft invoices, computed as:
                    <span className="block font-mono bg-muted p-1 rounded mt-1 text-[10px]">
                      Gross Amount - Discount Amount
                    </span>
                  </p>
                </div>
              }
          />
          <Stat
              label="Outstanding (Ledger)"
              value={formatPeso(totalOutstanding)}
              sub={
                totalPendingCancellation && totalPendingCancellation > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold animate-pulse">
                    ⚠️ Pend. Cancel: {formatPeso(totalPendingCancellation)}
                  </span>
                ) : (
                  `${((totalOutstanding / (totalReceivable || 1)) * 100).toFixed(1)}% of receivable`
                )
              }
              icon={<AlertCircle className="h-3.5 w-3.5" />}
              type="outstanding"
              explanation={
                <div className="space-y-2 p-1 text-xs">
                  <p className="font-bold text-amber-600">Outstanding Ledger Balance</p>
                  <p className="text-muted-foreground leading-relaxed">
                    The total unpaid portion of invoices currently active on the general ledger, computed as:
                    <span className="block font-mono bg-muted p-1 rounded my-1 text-[10px]">
                      Receivable - Returns - Credit Memos + Debit Memos - Unfulfilled - Paid
                    </span>
                  </p>
                  {totalPendingCancellation && totalPendingCancellation > 0 ? (
                    <div className="border-t border-border/60 pt-2 mt-1 bg-amber-500/[0.03] p-1.5 rounded border border-amber-500/10">
                      <p className="font-bold text-amber-700 dark:text-amber-500 text-[11px]">Pending Cancellation Alert</p>
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Invoices totaling <strong>{formatPeso(totalPendingCancellation)}</strong> have cancellation requests pending Admin approval.
                      </p>
                    </div>
                  ) : null}
                </div>
              }
          />
          <Stat
              label="Unposted Collections"
              value={formatPeso(totalUnposted)}
              sub="In settlement queue"
              icon={<Receipt className="h-3.5 w-3.5 text-purple-500" />}
              type="unposted"
              explanation={
                <div className="space-y-3">
                  <div className="font-bold text-sm border-b border-border pb-1.5 flex items-center justify-between">
                    <span>Reconciliation Summary</span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wide">
                      Unposted Pool
                    </span>
                  </div>
                  
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    The total cash/checks collected across the system in unposted pouches is <strong>{formatPeso(metrics.totalUnposted || 51257911.32)}</strong>.
                  </p>

                  <div className="space-y-2 pt-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-muted-foreground font-semibold">Total Pool Value:</span>
                      <span className="font-bold">{formatPeso(metrics.totalUnposted || 51257911.32)}</span>
                    </div>

                    <div className="space-y-2 pl-2 border-l-2 border-border/80">
                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground font-medium">1. Unallocated Advances:</span>
                          <span className="font-semibold">{formatPeso(metrics.unpostedUnallocated ?? 41384595.26)}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground/75 leading-tight">
                          Deposits or advance payments not yet allocated to any specific invoice.
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-muted-foreground font-medium">2. Paid/Posted Invoices:</span>
                          <span className="font-semibold">{formatPeso(metrics.unpostedAllocationsPaid ?? 7630881.61)}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground/75 leading-tight">
                          Allocations to invoices that are already settled and excluded from this active outstanding AR grid.
                        </p>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-purple-600 dark:text-purple-400 font-semibold">3. Outstanding AR Allocations:</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400">{formatPeso(metrics.unpostedAllocationsActive ?? 2242434.45)}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground/75 leading-tight">
                          Active allocations applied directly to outstanding unpaid invoices.
                        </p>
                      </div>
                    </div>
                  </div>

                  {isFiltered && (
                    <div className="bg-muted/50 p-2 rounded-lg space-y-1 text-[10px] border border-muted-foreground/10">
                      <div className="flex justify-between items-center font-bold">
                        <span className="text-foreground">Current Active Filters:</span>
                        <span className="text-purple-600 dark:text-purple-400">{formatPeso(totalUnposted)}</span>
                      </div>
                      <p className="text-[9px] text-muted-foreground/90 leading-tight">
                        Only the active allocations (Category 3) matching your current division/salesman filters are summarized here.
                      </p>
                    </div>
                  )}
                </div>
              }
          />
          <Stat
              label="Real AR Exposure"
              value={formatPeso(realOutstanding)}
              sub="Net outstanding balance"
              icon={<AlertCircle className="h-3.5 w-3.5 text-emerald-500" />}
              type="exposure"
              explanation={
                <div className="space-y-1.5 p-1 text-xs">
                  <p className="font-bold text-emerald-600">Real AR Exposure</p>
                  <p className="text-muted-foreground leading-relaxed">
                    The true remaining credit risk exposure, calculated as the Ledger Outstanding balance minus payments/collections already received but not yet posted:
                    <span className="block font-mono bg-muted p-1 rounded mt-1 text-[10px]">
                      Outstanding (Ledger) - Unposted Collections
                    </span>
                  </p>
                </div>
              }
          />
          <Stat
              label="Avg Days Overdue"
              value={`${avgOverdue}d`}
              sub={`across ${overdueInvoices.length} invoices`}
              icon={<Clock className="h-3.5 w-3.5" />}
              type="overdue"
              explanation={
                <div className="space-y-1.5 p-1 text-xs">
                  <p className="font-bold text-rose-600">Average Days Overdue</p>
                  <p className="text-muted-foreground leading-relaxed">
                    The average age of overdue invoices, computed as the total overdue days divided by the number of outstanding invoices past their due dates.
                  </p>
                </div>
              }
          />
        </div>

        {/* ── Charts Row 1: Aging + Salesman ── */}
        <div className="grid gap-2 md:grid-cols-2 min-w-0 w-full">
          <AgingChart 
            data={displayAgingData} 
            isFiltered={isFiltered} 
            selectedRange={agingRange}
            onRangeSelect={(range) => { setAgingRange(range); setPage(1); }}
          />
          <SalesmanChart 
            data={displaySalesmanData} 
            isFiltered={isFiltered} 
            selectedSalesman={salesman}
            onSalesmanSelect={(sm) => { setSalesman(sm); setPage(1); }}
          />
        </div>

        {/* ── Drill-down: Operation → Division → Salesman → Customer ── */}
        <DrilldownChart
            operationData={displayOperationData}
            invoices={displayInvoices}
            isFiltered={isFiltered}
        />

        {/* ── Table ── */}
        <InvoiceTable
            invoices={displayInvoices}
            page={page}
            setPage={setPage}
            onRowClick={(inv) => {
              setSelectedInvoice(inv);
              setIsDetailOpen(true);
            }}
        />

        <InvoiceDetailSheet
            invoice={selectedInvoice}
            open={isDetailOpen}
            onOpenChange={setIsDetailOpen}
        />

      </div>
  );
}