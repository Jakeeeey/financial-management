"use client";

import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, TrendingUp, Receipt, X, Download } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useEWT } from './hooks/useEWT';
import { EWTBarChart } from './components/EWTBarChart';
import { EWTPieChart } from './components/EWTPieChart';
import { EWTRecordsTable } from './components/EWTRecordsTable';
import { aggregateByCustomer, deriveMetrics } from './utils';
import type { EWTMetrics } from './types';

export default function EWTModule() {
  const { loading, error, records, metrics, aggregated } = useEWT();

  const [page, setPage]         = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [customer, setCustomer] = useState('');

  const isFiltered = !!(dateFrom || dateTo || customer);

  const customerOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.customer).filter((c) => c && c !== 'Unknown'))).sort(),
    [records]
  );

  const filtered = useMemo(() => {
    if (!isFiltered) return records;
    return records.filter((r) => {
      // r.date is already stripped to YYYY-MM-DD by transformEWTRows
      if (r.date !== '-') {
        if (dateFrom && r.date < dateFrom) return false;
        if (dateTo   && r.date > dateTo)   return false;
      }
      if (customer && r.customer !== customer) return false;
      return true;
    });
  }, [records, dateFrom, dateTo, customer, isFiltered]);

  const filteredMetrics    = useMemo((): EWTMetrics => isFiltered ? deriveMetrics(filtered)        : metrics,    [filtered, isFiltered, metrics]);
  const filteredAggregated = useMemo(()              => isFiltered ? aggregateByCustomer(filtered) : aggregated, [filtered, isFiltered, aggregated]);

  const displayMetrics    = filteredMetrics;
  const displayAggregated = filteredAggregated;
  const displayRecords    = isFiltered ? filtered : records;
  const pieTotal          = displayAggregated.reduce((s, d) => s + d.value, 0);

  const clearFilters = () => { setDateFrom(''); setDateTo(''); setCustomer(''); setPage(1); };

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
    doc.text('EWT Report (Men2 Corp)', 14, 16);

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
      `From: ${dateFrom || 'N/A'}   To: ${dateTo || 'N/A'}   Customer: ${customer || 'All'}`,
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
      head: [['Invoice No.', 'Customer', 'Gross Amount (PHP)', 'Taxable Amount (PHP)', 'EWT Amount (PHP)', 'Date']],
      body: displayRecords.map((r) => [
        r.id,
        r.customer,
        r.grossAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 }),
        r.taxableAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 }),
        r.amount.toLocaleString('en-PH', { minimumFractionDigits: 2 }),
        r.date,
      ]),
      margin: { left: 14, right: 14 },
    });

    // ── Grand Total box ────────────────────────────────────────────────────
    const finalY = (doc as any).lastAutoTable.finalY ?? 36;
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

    doc.save(`ewt-export-${new Date().toISOString().split('T')[0]}.pdf`);
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
    <div className="p-8 m-8 border border-red-500/20 bg-red-500/5 rounded-lg text-center">
      <p className="text-red-500 font-medium text-sm">Error: {error}</p>
    </div>
  );

  return (
    <div className="p-8 bg-background text-foreground min-h-screen space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Expanded Withholding Tax (EWT)</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of withholding tax deductions from invoices
        </p>
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

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{displayMetrics.totalRecords}</div>
            <p className="text-[10px] text-muted-foreground mt-1">Total records loaded</p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total EWT Amount</CardTitle>
            <Receipt className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              ₱{displayMetrics.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Across {displayMetrics.totalRecords} invoices
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Average EWT</CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">
              ₱{(displayMetrics.totalRecords > 0
                ? Math.round((displayMetrics.totalAmount / displayMetrics.totalRecords) * 100) / 100
                : 0
              ).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">Per invoice average</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <EWTBarChart data={displayAggregated} />
        <EWTPieChart data={displayAggregated} pieTotal={pieTotal} />
      </div>

      {/* Table */}
      <EWTRecordsTable records={displayRecords} page={page} setPage={setPage} />

    </div>
  );
}