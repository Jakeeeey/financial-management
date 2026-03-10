"use client";

// CWTModule.tsx
// Main module — layout and composition only. Filters drive all charts + table.

import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LayoutDashboard, TrendingUp, BarChart2, X, Download } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useCWT } from './hooks/useCWT';
import { MetricCard } from './components/MetricCard';
import { CWTPieChart } from './components/CWTPieChart';
import { CWTTrendChart } from './components/CWTTrendChart';
import { CWTBarChart } from './components/CWTBarChart';
import { TransactionTable } from './components/TransactionTable';
import { buildPieData, buildTrendData, buildBarData, formatDate } from './utils';
import type { CWTMetrics } from './types';

export default function CWTModule() {
  const { loading, error, records, metrics, pieData, trendData, barData } = useCWT();

  const [page, setPage]         = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [supplier, setSupplier] = useState('');

  const isFiltered = !!(dateFrom || dateTo || supplier);

  const supplierOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.customerName).filter(Boolean))).sort(),
    [records]
  );

  const filtered = useMemo(() => {
    if (!isFiltered) return records;
    return records.filter((r) => {
      if (dateFrom && r.dateObj < new Date(dateFrom))             return false;
      if (dateTo   && r.dateObj > new Date(dateTo + 'T23:59:59')) return false;
      if (supplier && r.customerName !== supplier)                 return false;
      return true;
    });
  }, [records, dateFrom, dateTo, supplier, isFiltered]);

  const filteredMetrics = useMemo((): CWTMetrics => {
    if (!isFiltered) return metrics;
    return {
      totalAmount:       filtered.reduce((s, r) => s + r.displayAmount, 0),
      totalTransactions: filtered.length,
    };
  }, [filtered, isFiltered, metrics]);

  const filteredPieData   = useMemo(() => isFiltered ? buildPieData(filtered)   : pieData,   [filtered, isFiltered, pieData]);
  const filteredTrendData = useMemo(() => isFiltered ? buildTrendData(filtered)  : trendData, [filtered, isFiltered, trendData]);
  const filteredBarData   = useMemo(() => isFiltered ? buildBarData(filtered)    : barData,   [filtered, isFiltered, barData]);

  const displayMetrics   = filteredMetrics;
  const displayPieData   = filteredPieData;
  const displayTrendData = filteredTrendData;
  const displayBarData   = filteredBarData;
  const displayRecords   = isFiltered ? filtered : records;

  const clearFilters = () => { setDateFrom(''); setDateTo(''); setSupplier(''); setPage(1); };

  const exportToPDF = () => {
    const doc   = new jsPDF({ orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();
    const total = displayMetrics.totalAmount;
    const formattedTotal = `PHP ${total.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    // ── Title left ─────────────────────────────────────────────────────────
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('CWT Report (Men2 Corp)', 14, 16);

    // ── Total top-right ────────────────────────────────────────────────────
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const totalLabel  = `Grand Total: ${formattedTotal}`;
    const totalLabelX = Math.max(pageW / 2, pageW - 14 - doc.getTextWidth(totalLabel));
    doc.text(totalLabel, totalLabelX, 16);

    // ── Divider ────────────────────────────────────────────────────────────
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(14, 20, pageW - 14, 20);

    // ── Filter summary ─────────────────────────────────────────────────────
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `From: ${dateFrom || 'N/A'}   To: ${dateTo || 'N/A'}   Supplier: ${supplier || 'All'}`,
      14, 26
    );
    doc.text(
      `Exported: ${new Date().toLocaleString('en-PH')}   Total Records: ${displayRecords.length}`,
      14, 31
    );
    doc.setTextColor(0);

    // ── Data table ─────────────────────────────────────────────────────────
    autoTable(doc, {
      startY: 36,
      headStyles: { fillColor: [24, 24, 27], fontSize: 7, textColor: 255 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      head: [['Doc No.', 'Supplier', 'Gross Amount (PHP)', 'Taxable Amount (PHP)', 'CWT Amount (PHP)', 'Transaction Date']],
      body: displayRecords.map((r) => [
        r.invoiceNo,
        r.customerName,
        r.grossAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 }),
        r.taxableAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 }),
        r.displayAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 }),
        formatDate(r.invoiceDate),
      ]),
      margin: { left: 14, right: 14 },
    });

    // ── Grand Total box ────────────────────────────────────────────────────
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
    doc.text('Grand Total:', boxX + 4, boxY + 7.5);

    const amtW = doc.getTextWidth(formattedTotal);
    doc.text(formattedTotal, boxX + boxW - 4 - amtW, boxY + 7.5);

    doc.save(`cwt-export-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) return (
    <div className="p-8 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );

  if (error) return (
    <div className="p-8 text-center m-8 border border-red-500/20 bg-red-500/5 rounded-lg">
      <p className="text-red-500 font-medium">Error: {error}</p>
      <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
        Retry Connection
      </Button>
    </div>
  );

  return (
    <div className="p-8 bg-background text-foreground min-h-screen space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Creditable Withholding Tax (CWT)</h1>
        <p className="text-sm text-muted-foreground mt-1">Comprehensive analysis of tax credits, supplier distribution, and monthly trends</p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 h-9">
          <span className="text-xs font-medium text-muted-foreground shrink-0">From</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-auto border-0 p-0 text-xs focus-visible:ring-0 shadow-none w-[130px] bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 h-9">
          <span className="text-xs font-medium text-muted-foreground shrink-0">To</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-auto border-0 p-0 text-xs focus-visible:ring-0 shadow-none w-[130px] bg-transparent"
          />
        </div>
        <Select
          value={supplier || '__all__'}
          onValueChange={(val) => { setSupplier(val === '__all__' ? '' : val); setPage(1); }}
        >
          <SelectTrigger className="h-9 w-[240px] text-xs">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__all__" className="text-xs text-muted-foreground">All Suppliers</SelectItem>
            {supplierOptions.map((name) => (
              <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={clearFilters}
            className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5">
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={exportToPDF}
          className="h-9 px-3 text-xs gap-1.5 ml-auto"
        >
          <Download className="h-3.5 w-3.5" />
          Export PDF
        </Button>
      </div>

      {/* Result count */}
      {isFiltered && (
        <p className="text-xs text-muted-foreground -mt-4">
          Showing <span className="font-semibold text-foreground">{displayRecords.length}</span> of{' '}
          <span className="font-semibold text-foreground">{records.length}</span> records
        </p>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Report Period"
          value={dateFrom || dateTo ? `${dateFrom || '—'} → ${dateTo || '—'}` : 'All Dates'}
          icon={<LayoutDashboard className="h-4 w-4 text-primary" />}
        />
        <MetricCard
          title="Total Transactions"
          value={displayMetrics.totalTransactions}
          sub={`${displayMetrics.totalTransactions} records loaded`}
          icon={<BarChart2 className="h-4 w-4 text-primary" />}
        />
        <MetricCard
          title="Total CWT Amount"
          value={`₱${displayMetrics.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
          sub={`Across ${displayMetrics.totalTransactions} transactions`}
          icon={<TrendingUp className="h-4 w-4 text-primary" />}
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CWTPieChart data={displayPieData} totalAmount={displayMetrics.totalAmount} />
        <CWTTrendChart data={displayTrendData} />
      </div>

      {/* Charts Row 2 */}
      <CWTBarChart data={displayBarData} />

      {/* Table */}
      <TransactionTable records={displayRecords} page={page} setPage={setPage} />

    </div>
  );
}