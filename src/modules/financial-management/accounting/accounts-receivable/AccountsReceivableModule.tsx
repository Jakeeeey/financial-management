"use client";

import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Clock, PhilippinePeso, X, Download, FileSpreadsheet, Sparkles, Receipt, Search } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
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
                label, value, sub, icon, accent = false,
              }: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
      <div className={`flex flex-col gap-0.5 rounded border px-3 py-2 ${accent ? 'border-destructive/40 bg-destructive/5' : 'border-border/60 bg-muted/20'}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
          {icon && <span className="text-muted-foreground/50">{icon}</span>}
        </div>
        <div className="text-sm font-bold tabular-nums text-foreground leading-tight">{value}</div>
        {sub && <div className="text-[9px] text-muted-foreground/70 leading-tight">{sub}</div>}
      </div>
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
  const [branch, setBranch]     = useState('');
  const [salesman, setSalesman] = useState('');
  const [division, setDivision] = useState('');
  const [operation, setOperation] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAIInsights, setShowAIInsights] = useState(false);

  // ── Filter option lists ────────────────────────────────────────────────────
  const customerOptions = useMemo(
      () => Array.from(new Set(invoices.map((inv) => inv.customer))).sort(),
      [invoices]
  );
  const branchOptions = useMemo(
      () => Array.from(new Set(invoices.map((inv) => inv.branch).filter((b) => b && b !== 'Unknown'))).sort(),
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

  // ── Filtered invoices ──────────────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      const invDate = inv.invoiceDate ? inv.invoiceDate.split(' ')[0] : '';
      if (dateFrom && invDate && invDate < dateFrom) return false;
      if (dateTo   && invDate && invDate > dateTo)   return false;
      if (customer && inv.customer !== customer) return false;
      if (branch   && inv.branch   !== branch)   return false;
      if (salesman && inv.salesman !== salesman)  return false;
      if (division && inv.division !== division)  return false;
      if (operation && String(inv.salesType) !== String(operation)) return false;
      if (q) {
        const matchesInvoice = inv.invoiceNo.toLowerCase().includes(q);
        const matchesCustomer = inv.customer.toLowerCase().includes(q);
        if (!matchesInvoice && !matchesCustomer) return false;
      }
      return true;
    });
  }, [invoices, dateFrom, dateTo, customer, branch, salesman, division, operation, searchQuery]);

  const isFiltered = !!(dateFrom || dateTo || customer || branch || salesman || division || operation || searchQuery);

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

  const { totalReceivable, totalOutstanding, totalUnposted, realOutstanding, overdueInvoices, avgOverdue } = filteredMetrics;

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setCustomer(''); setBranch(''); setSalesman(''); setDivision(''); setOperation(''); setSearchQuery(''); setPage(1);
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
    doc.text(
        `From: ${dateFrom || 'N/A'}   To: ${dateTo || 'N/A'}   Customer: ${customer || 'All'}   Branch: ${branch || 'All'}   Salesman: ${salesman || 'All'}   Division: ${division || 'All'}`,
        10, 26
    );
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
        0:  { cellWidth: 28 },
        1:  { cellWidth: 32 },
        2:  { cellWidth: 55 },
        3:  { cellWidth: 36 },
        4:  { cellWidth: 32 },
        5:  { cellWidth: 36 },
        6:  { cellWidth: 24 },
        7:  { cellWidth: 24 },
        8:  { cellWidth: 28 },
        9:  { cellWidth: 24 },
        10: { cellWidth: 30 },
        11: { cellWidth: 18 },
        12: { cellWidth: 20 },
      },
      head: [[
        'Invoice No.', 'Order ID', 'Customer', 'Salesman', 'Division', 'Branch', 'Inv. Date', 'Due Date',
        'Net Recv. (PHP)', 'Total Paid', 'Outstanding (PHP)',
        'Days OD', 'Status',
      ]],
      body: displayInvoices.map((inv) => [
        inv.invoiceNo,
        inv.orderId,
        inv.customer,
        inv.salesman,
        inv.division,
        inv.branch,
        (inv.invoiceDate ?? '').split('T')[0],
        (inv.due ?? '').split('T')[0],
        inv.netReceivable?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) ?? '',
        inv.totalPaid?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) ?? '',
        inv.outstanding?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) ?? '',
        inv.overdue !== null && inv.overdue >= 0 ? inv.overdue : '—',
        inv.status,
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
      'Invoice No.': inv.invoiceNo,
      'Order ID': inv.orderId,
      'Customer': inv.customer,
      'Salesman': inv.salesman,
      'Division': inv.division,
      'Branch': inv.branch,
      'Inv. Date': inv.invoiceDate ? inv.invoiceDate.split('T')[0] : '',
      'Due Date': inv.due ? inv.due.split('T')[0] : '',
      'Net Receivable (PHP)': inv.netReceivable,
      'Total Paid (PHP)': inv.totalPaid,
      'Outstanding (PHP)': inv.outstanding,
      'Days OD': inv.overdue !== null && inv.overdue >= 0 ? inv.overdue : '—',
      'Status': inv.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);

    const totalRow = {
      'Invoice No.': 'TOTAL',
      'Order ID': '',
      'Customer': '',
      'Salesman': '',
      'Division': '',
      'Branch': '',
      'Inv. Date': '',
      'Due Date': '',
      'Net Receivable (PHP)': '',
      'Total Paid (PHP)': '',
      'Outstanding (PHP)': filteredMetrics.totalOutstanding,
      'Days OD': '',
      'Status': '',
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
        <div className="flex flex-wrap items-center gap-1.5 w-full min-w-0 p-2 rounded border border-border/50 bg-muted/10">
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
              value={branch}
              onValueChange={(val) => { setBranch(val); setPage(1); }}
              placeholder="All Branches"
              className="h-7 w-[130px] text-[10px] !block text-left truncate relative pr-7 [&_svg]:absolute [&_svg]:right-2.5 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
              options={[
                { value: '', label: 'All Branches' },
                ...branchOptions.map((name) => ({ value: name, label: name })),
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
              icon={<PhilippinePeso className="h-3 w-3" />}
          />
          <Stat
              label="Outstanding (Ledger)"
              value={formatPeso(totalOutstanding)}
              sub={`${((totalOutstanding / (totalReceivable || 1)) * 100).toFixed(1)}% of receivable`}
              icon={<AlertCircle className="h-3 w-3" />}
          />
          <Stat
              label="Unposted Collections"
              value={formatPeso(totalUnposted)}
              sub="In settlement queue"
              icon={<Receipt className="h-3 w-3 text-purple-500" />}
              accent={totalUnposted > 0}
          />
          <Stat
              label="Real AR Exposure"
              value={formatPeso(realOutstanding)}
              sub="Net outstanding balance"
              icon={<AlertCircle className="h-3 w-3 text-emerald-500" />}
          />
          <Stat
              label="Avg Days Overdue"
              value={`${avgOverdue}d`}
              sub={`across ${overdueInvoices.length} invoices`}
              icon={<Clock className="h-3 w-3" />}
              accent={avgOverdue > 30}
          />
        </div>

        {/* ── Charts Row 1: Aging + Salesman ── */}
        <div className="grid gap-2 md:grid-cols-2 min-w-0 w-full">
          <AgingChart data={displayAgingData} isFiltered={isFiltered} />
          <SalesmanChart data={displaySalesmanData} isFiltered={isFiltered} />
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