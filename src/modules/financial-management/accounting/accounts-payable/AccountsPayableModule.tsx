"use client";

// AccountsPayableModule.tsx — Main module layout and composition.

import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { PhilippinePeso, TrendingDown, FileText, X, Download } from 'lucide-react';
import { useAccountsPayable } from './hooks/useAccountsPayable';
import { MetricCard }       from './components/MetricCard';
import { APAgingChart }     from './components/APAgingChart';
import { APSupplierChart }  from './components/APSupplierChart';
import { APStatusPieChart } from './components/APStatusPieChart';
import { APTable }          from './components/APTable';
import {
  buildAgingBuckets, buildSupplierData, buildStatusData, deriveMetrics, formatPeso,
} from './utils';
import type { APStatus } from './types';

const STATUS_OPTIONS: APStatus[] = [
  'Paid', 'Unpaid', 'Partially Paid', 'Unpaid | Overdue', 'Partially Paid | Overdue',
];

type TxType = 'All' | 'Trade' | 'Non-Trade';

function getTxType(refNo: string): 'Trade' | 'Non-Trade' {
  return refNo.toUpperCase().startsWith('NT') ? 'Non-Trade' : 'Trade';
}

const TX_TABS: TxType[] = ['All', 'Trade', 'Non-Trade'];

export default function AccountsPayableModule() {
  const { loading, error, records } = useAccountsPayable();

  const [page,     setPage]     = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [supplier, setSupplier] = useState('');
  const [status,   setStatus]   = useState('');
  const [txType,   setTxType]   = useState<TxType>('All');

  const supplierOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.supplier).filter(Boolean))).sort(),
    [records]
  );

  // Step 1 — filter by transaction type (NT prefix = Non-Trade, everything else = Trade)
  const byType = useMemo(() =>
    txType === 'All' ? records : records.filter(r => getTxType(r.refNo) === txType),
    [records, txType]
  );

  // Step 2 — filter by date / supplier / status
  const isFiltered = !!(dateFrom || dateTo || supplier || status || txType !== 'All');

  const filteredRecords = useMemo(() => {
    return byType.filter((r) => {
      const recDate = (r.invoiceDate || r.dueDate || '').split(' ')[0];
      if (dateFrom && recDate && recDate < dateFrom) return false;
      if (dateTo   && recDate && recDate > dateTo)   return false;
      if (supplier && r.supplier !== supplier)        return false;
      if (status   && r.status   !== status)          return false;
      return true;
    });
  }, [byType, dateFrom, dateTo, supplier, status]);

  const displayRecords      = filteredRecords;
  const displayMetrics      = useMemo(() => deriveMetrics(filteredRecords),       [filteredRecords]);
  const displayAgingData    = useMemo(() => buildAgingBuckets(filteredRecords),   [filteredRecords]);
  const displaySupplierData = useMemo(() => buildSupplierData(filteredRecords),   [filteredRecords]);
  const displayStatusData   = useMemo(() => buildStatusData(filteredRecords),     [filteredRecords]);

  const tradeCount    = records.filter(r => getTxType(r.refNo) === 'Trade').length;
  const nonTradeCount = records.filter(r => getTxType(r.refNo) === 'Non-Trade').length;

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setSupplier(''); setStatus('');
    setTxType('All'); setPage(1);
  };

  const handleTxType = (t: TxType) => { setTxType(t); setPage(1); };

  const exportToPDF = () => {
    const doc   = new jsPDF({ orientation: 'landscape' });
    const pageW = doc.internal.pageSize.getWidth();
    const total = displayMetrics.totalPayable;
    const formattedTotal = `PHP ${total.toLocaleString('en-PH', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('Accounts Payable Report (Men2 Corp)', 14, 16);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const totalLabel  = `Grand Total: ${formattedTotal}`;
    const totalLabelX = Math.max(pageW / 2, pageW - 14 - doc.getTextWidth(totalLabel));
    doc.text(totalLabel, totalLabelX, 16);

    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(14, 20, pageW - 14, 20);

    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Type: ${txType}   From: ${dateFrom || 'N/A'}   To: ${dateTo || 'N/A'}   Supplier: ${supplier || 'All'}   Status: ${status || 'All'}`,
      14, 26
    );
    doc.text(
      `Exported: ${new Date().toLocaleString('en-PH')}   Total Records: ${displayRecords.length}`,
      14, 31
    );
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 36,
      headStyles: { fillColor: [24, 24, 27], fontSize: 7, textColor: 255 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      head: [[
        'Ref. No.', 'Type', 'Supplier', 'Invoice No.', 'Invoice Date', 'Due Date',
        'Amount Payable (PHP)', 'Amount Paid (PHP)', 'Outstanding Balance (PHP)', 'Aging (Days)', 'Status',
      ]],
      body: displayRecords.map((r) => [
        r.refNo,
        getTxType(r.refNo),
        r.supplier,
        r.invoiceNo !== '—' ? r.invoiceNo : '',
        r.invoiceDate ? r.invoiceDate.split(' ')[0] : '—',
        r.dueDate     ? r.dueDate.split(' ')[0]     : '—',
        r.amountPayable.toLocaleString('en-PH',      { minimumFractionDigits: 2 }),
        r.amountPaid.toLocaleString('en-PH',         { minimumFractionDigits: 2 }),
        r.outstandingBalance.toLocaleString('en-PH', { minimumFractionDigits: 2 }),
        r.aging > 0 ? r.aging : 0,
        r.status,
      ]),
      margin: { left: 14, right: 14 },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? 36;
    const boxW = 110, boxH = 12;
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

    doc.save(`ap-export-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) return (
    <div className="p-8 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-6 w-1/2" />
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-64 w-full" />
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
    <div className="p-4 md:p-6 bg-background text-foreground min-h-screen space-y-6 w-full box-border overflow-hidden">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accounts Payable Monitoring</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of outstanding payables and supplier balances
        </p>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 w-full min-w-0">

        {/* Transaction type toggle — All / Trade / Non-Trade */}
        <div className="flex items-center rounded-md border border-border bg-background h-9 p-1 gap-0.5 shrink-0">
          {TX_TABS.map(t => {
            const isActive = txType === t;
            const count    = t === 'All' ? records.length : t === 'Trade' ? tradeCount : nonTradeCount;
            return (
              <button
                key={t}
                onClick={() => handleTxType(t)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {t}
                <span className={`text-[10px] font-semibold ${isActive ? 'opacity-70' : 'opacity-50'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Date From */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 h-9">
          <span className="text-xs font-medium text-muted-foreground shrink-0">From</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-auto border-0 p-0 text-xs focus-visible:ring-0 shadow-none w-[110px] bg-transparent"
          />
        </div>

        {/* Date To */}
        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 h-9">
          <span className="text-xs font-medium text-muted-foreground shrink-0">To</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-auto border-0 p-0 text-xs focus-visible:ring-0 shadow-none w-[110px] bg-transparent"
          />
        </div>

        {/* Supplier */}
        <Select
          value={supplier || '__all__'}
          onValueChange={(val) => { setSupplier(val === '__all__' ? '' : val); setPage(1); }}
        >
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__all__" className="text-xs text-muted-foreground">All Suppliers</SelectItem>
            {supplierOptions.map((name) => (
              <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={status || '__all__'}
          onValueChange={(val) => { setStatus(val === '__all__' ? '' : val); setPage(1); }}
        >
          <SelectTrigger className="h-9 w-[160px] text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-xs text-muted-foreground">All Statuses</SelectItem>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear */}
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}

        {/* Export PDF */}
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
          Showing <span className="font-semibold text-foreground">{displayRecords.length}</span>{' '}
          of <span className="font-semibold text-foreground">{records.length}</span> records
        </p>
      )}

      {/* Metrics */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 w-full">
        <MetricCard
          title="Total Payable"
          value={formatPeso(displayMetrics.totalPayable)}
          sub={`${displayMetrics.totalRecords} total records`}
          icon={<PhilippinePeso className="h-4 w-4 text-primary" />}
        />
        <MetricCard
          title="Total Paid"
          value={formatPeso(displayMetrics.totalPaid)}
          sub={`${((displayMetrics.totalPaid / (displayMetrics.totalPayable || 1)) * 100).toFixed(1)}% of total`}
          icon={<FileText className="h-4 w-4 text-primary" />}
        />
        <MetricCard
          title="Outstanding Balance"
          value={formatPeso(displayMetrics.totalOutstanding)}
          sub={`${((displayMetrics.totalOutstanding / (displayMetrics.totalPayable || 1)) * 100).toFixed(1)}% of total`}
          icon={<TrendingDown className="h-4 w-4 text-primary" />}
        />
      </div>

      {/* Charts Row 1 — Aging (2/3) + Status Pie (1/3) */}
      <div className="grid gap-4 md:grid-cols-3 w-full min-w-0 items-stretch">
        <div className="md:col-span-2 h-full">
          <APAgingChart data={displayAgingData} isFiltered={isFiltered} />
        </div>
        <div className="md:col-span-1 h-full">
          <APStatusPieChart data={displayStatusData} isFiltered={isFiltered} />
        </div>
      </div>

      {/* Charts Row 2 — Supplier full width */}
      <APSupplierChart data={displaySupplierData} isFiltered={isFiltered} />

      {/* Table — type filter already applied above, no tabs needed inside */}
      <APTable records={displayRecords} page={page} setPage={setPage} />

    </div>
  );
}