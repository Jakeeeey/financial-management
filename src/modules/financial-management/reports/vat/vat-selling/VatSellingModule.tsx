"use client";

// VatSellingModule.tsx
// Main module — layout and composition only. Filters drive all charts + table.

import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { DollarSign, TrendingUp, FileText, X, Download } from 'lucide-react';
import { useVATSelling } from './hooks/useVATSelling';
import { VATSaleLineChart } from './components/VATSaleLineChart';
import { VATSupplierPieChart } from './components/VATSupplierPieChart';
import { VATCustomerComparison } from './components/VATCustomerComparison';
import { VATSalesTransactionsTable } from './components/VATSalesTransactionsTable';
import { formatPeso, COLORS } from './utils';
import type { VATCustomerEntry, VATSaleBarEntry, VATSaleChartPoint, VATSaleMetrics } from './types';

export default function VatSellingModule() {
  const { loading, transactions, metrics, pieData, barData } = useVATSelling();

  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [customer, setCustomer] = useState('');
  const [supplier, setSupplier] = useState('');

  const customerOptions = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.customer).filter((c) => c !== '-'))).sort(),
    [transactions]
  );

  const supplierOptions = useMemo(
    () => Array.from(new Set(transactions.map((t) => t.supplier).filter((s) => s !== '-'))).sort(),
    [transactions]
  );

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (dateFrom && t.date !== '-' && new Date(t.date) < new Date(dateFrom)) return false;
      if (dateTo && t.date !== '-' && new Date(t.date) > new Date(dateTo)) return false;
      if (customer && t.customer !== customer) return false;
      if (supplier && t.supplier !== supplier) return false;
      return true;
    });
  }, [transactions, dateFrom, dateTo, customer, supplier]);

  const isFiltered = !!(dateFrom || dateTo || customer || supplier);

  const filteredMetrics = useMemo((): VATSaleMetrics => {
    if (!isFiltered) return metrics;
    const totalVat = filtered.reduce((s, t) => s + t.rawAmount, 0);
    return {
      totalVat,
      avgVat: filtered.length ? totalVat / filtered.length : 0,
      highestVat: filtered.reduce((m, t) => Math.max(m, t.rawAmount), 0),
      count: filtered.length,
    };
  }, [filtered, isFiltered, metrics]);

  const filteredLineData = useMemo((): VATSaleChartPoint[] =>
    filtered.map((t) => ({ date: t.date, amount: t.rawAmount })),
    [filtered]
  );

  // Always derive from all transactions for unfiltered state
  const allLineData = useMemo((): VATSaleChartPoint[] =>
    transactions.map((t) => ({ date: t.date, amount: t.rawAmount })),
    [transactions]
  );

  const filteredPieData = useMemo((): VATCustomerEntry[] => {
    const map: Record<string, number> = {};
    filtered.forEach((t) => { map[t.supplier] = (map[t.supplier] || 0) + t.rawAmount; });
    return Object.entries(map)
      .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
      .sort((a, b) => b.value - a.value);
  }, [filtered]);

  const filteredBarData = useMemo((): VATSaleBarEntry[] =>
    filteredPieData.map(({ name, value }) => ({ name, total: value })),
    [filteredPieData]
  );

  const displayMetrics = isFiltered ? filteredMetrics : metrics;
  const displayLineData = isFiltered ? filteredLineData : allLineData;
  const displayPieData = isFiltered ? filteredPieData : pieData;
  const displayBarData = isFiltered ? filteredBarData : barData;
  const displayTx = isFiltered ? filtered : transactions;

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setCustomer(''); setSupplier(''); setPage(1);
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();
    const total = displayMetrics.totalVat;
    const formattedTotal = `PHP ${total.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    // ── Title left: "VAT Sales Report (Men2)" ─────────────────────────────
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('VAT Sales Report (Men2 Corp)', 14, 16);

    // ── Total top-right ────────────────────────────────────────────────────
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const totalLabel = ` Grand Total: ${formattedTotal}`;
    const totalLabelX = Math.max(pageW / 2, pageW - 14 - doc.getTextWidth(totalLabel));
    doc.text(totalLabel, totalLabelX, 16);

    // ── Divider line ───────────────────────────────────────────────────────
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(14, 20, pageW - 14, 20);

    // ── Filter summary ─────────────────────────────────────────────────────
    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `From: ${dateFrom || 'N/A'}   To: ${dateTo || 'N/A'}   Customer: ${customer || 'All'}   Supplier: ${supplier || 'All'}`,
      14, 26
    );
    doc.text(
      `Exported: ${new Date().toLocaleString('en-PH')}   Total Records: ${displayTx.length}`,
      14, 31
    );
    doc.setTextColor(0);

    // ── Data table ─────────────────────────────────────────────────────────
    autoTable(doc, {
      startY: 36,
      headStyles: { fillColor: [24, 24, 27], fontSize: 7, textColor: 255 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      head: [['Invoice No.', 'Customer', 'Supplier', 'VAT Amount (PHP)', 'Invoice Date']],
      body: displayTx.map((tr) => [
        tr.id,
        tr.customer,
        tr.supplier,
        tr.rawAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 }),
        tr.date,
      ]),
      margin: { left: 14, right: 14 },
    });

    // ── Grand Total box ────────────────────────────────────────────────────
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? 36;
    const boxW = 110;
    const boxH = 12;
    const boxX = pageW - 14 - boxW;
    const boxY = finalY + 6;

    doc.setFillColor(24, 24, 27);
    doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'F');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('Grand Total:', boxX + 4, boxY + 7.5);

    const amtW = doc.getTextWidth(formattedTotal);
    doc.text(formattedTotal, boxX + boxW - 4 - amtW, boxY + 7.5);

    doc.save(`vat-sales-export-${new Date().toISOString().split('T')[0]}.pdf`);
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

  const statCards = [
    { title: 'Total VAT Sales', value: formatPeso(displayMetrics.totalVat), icon: <DollarSign className="h-4 w-4 text-primary" /> },
    { title: 'Average VAT', value: formatPeso(displayMetrics.avgVat), icon: <TrendingUp className="h-4 w-4 text-primary" /> },
    { title: 'Highest VAT', value: formatPeso(displayMetrics.highestVat), icon: <TrendingUp className="h-4 w-4 text-primary" /> },
    { title: 'Transactions', value: String(displayMetrics.count), icon: <FileText className="h-4 w-4 text-primary" /> },
  ];

  return (
    <div className="p-8 bg-background text-foreground min-h-screen space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">VAT Sales Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of VAT sales transactions and analytics</p>
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
          value={customer || '__all__'}
          onValueChange={(val) => { setCustomer(val === '__all__' ? '' : val); setPage(1); }}
        >
          <SelectTrigger className="h-9 w-[220px] text-xs">
            <SelectValue placeholder="All Customers" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__all__" className="text-xs text-muted-foreground">All Customers</SelectItem>
            {customerOptions.map((name) => (
              <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={supplier || '__all__'}
          onValueChange={(val) => { setSupplier(val === '__all__' ? '' : val); setPage(1); }}
        >
          <SelectTrigger className="h-9 w-[220px] text-xs">
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

        {/* Export */}
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
          Showing <span className="font-semibold text-foreground">{displayTx.length}</span> of{' '}
          <span className="font-semibold text-foreground">{transactions.length}</span> transactions
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Card key={i} className="shadow-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className="p-2 rounded-full">{stat.icon}</div>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <VATSaleLineChart data={displayLineData} isFiltered={isFiltered} />
        <VATSupplierPieChart data={displayPieData} />
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
        <VATCustomerComparison data={displayBarData} />
      </div>

      {/* Table */}
      <VATSalesTransactionsTable transactions={displayTx} page={page} setPage={setPage} />

    </div>
  );
}