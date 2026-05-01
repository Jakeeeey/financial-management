"use client";

import { useState, useMemo } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle, Clock, PhilippinePeso, X, Download } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { useAccountsReceivable } from './hooks/useAccountsReceivable';
import { MetricCard } from './components/MetricCard';
import { AgingChart } from './components/AgingChart';
import { SalesmanChart } from './components/SalesmanChart';
import { BranchProgressList } from './components/BranchprogressList';
import { InvoiceTable } from './components/InvoiceTable';
import { CustomerOutstandingChart } from './components/CustomerOutstandingChart';
import { deriveMetrics, mapToSortedArray, deriveAgingData } from './utils';

export default function AccountsReceivableModule() {
  const { loading, error, invoices, agingData, branchData, salesmanData, metrics } =
    useAccountsReceivable();

  const [page, setPage]         = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo]     = useState('');
  const [customer, setCustomer] = useState('');
  const [branch, setBranch]     = useState('');
  const [salesman, setSalesman] = useState('');
  const [division, setDivision] = useState('');

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

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Strip time component — invoiceDate may be "2025-11-29 17:58:02"
      const invDate = inv.invoiceDate ? inv.invoiceDate.split(' ')[0] : '';
      if (dateFrom && invDate && invDate < dateFrom) return false;
      if (dateTo   && invDate && invDate > dateTo)   return false;
      if (customer && inv.customer !== customer) return false;
      if (branch   && inv.branch   !== branch)   return false;
      if (salesman && inv.salesman !== salesman)  return false;
      if (division && inv.division !== division)  return false;
      return true;
    });
  }, [invoices, dateFrom, dateTo, customer, branch, salesman, division]);

  const isFiltered = !!(dateFrom || dateTo || customer || branch || salesman || division);

  const filteredCustomerMap = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInvoices.forEach((inv) => {
      map[inv.customer] = (map[inv.customer] || 0) + inv.outstanding;
    });
    return map;
  }, [filteredInvoices]);

  const filteredMetrics = useMemo(
    () => isFiltered ? deriveMetrics(filteredInvoices, filteredCustomerMap) : metrics,
    [filteredInvoices, filteredCustomerMap, isFiltered, metrics]
  );

  const customerData = useMemo(
    () => mapToSortedArray(filteredCustomerMap, 10),
    [filteredCustomerMap]
  );

  const filteredBranchMap = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInvoices.forEach((inv) => {
      map[inv.branch] = (map[inv.branch] || 0) + inv.outstanding;
    });
    return map;
  }, [filteredInvoices]);

  const filteredSalesmanMap = useMemo(() => {
    const map: Record<string, number> = {};
    filteredInvoices.forEach((inv) => {
      map[inv.salesman] = (map[inv.salesman] || 0) + inv.outstanding;
    });
    return map;
  }, [filteredInvoices]);

  const displayBranchData = useMemo(
    () => isFiltered ? mapToSortedArray(filteredBranchMap, 8) : branchData,
    [filteredBranchMap, isFiltered, branchData]
  );

  const displaySalesmanData = useMemo(() => {
    if (!isFiltered) return salesmanData;
    return Object.entries(filteredSalesmanMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [filteredSalesmanMap, isFiltered, salesmanData]);

  const displayInvoices  = isFiltered ? filteredInvoices : invoices;
  const displayAgingData = useMemo(
    () => isFiltered ? deriveAgingData(filteredInvoices) : agingData,
    [filteredInvoices, isFiltered, agingData]
  );
  const { totalReceivable, totalOutstanding, overdueInvoices, avgOverdue } = filteredMetrics;

  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setCustomer(''); setBranch(''); setSalesman(''); setDivision(''); setPage(1);
  };

  const exportToPDF = () => {
    const doc   = new jsPDF({ orientation: 'landscape', format: 'a3' });
    const pageW = doc.internal.pageSize.getWidth();
    const total = filteredMetrics.totalReceivable;
    const formattedTotal = `PHP ${total.toLocaleString('en-PH', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

    // ── Title left ─────────────────────────────────────────────────────────
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(20, 20, 20);
    doc.text('Accounts Receivable Report (Men2 Corp)', 10, 16);

    // ── Total top-right ────────────────────────────────────────────────────
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const totalLabel  = `Grand Total: ${formattedTotal}`;
    const totalLabelX = Math.max(pageW / 2, pageW - 10 - doc.getTextWidth(totalLabel));
    doc.text(totalLabel, totalLabelX, 16);

    // ── Divider ────────────────────────────────────────────────────────────
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.line(10, 20, pageW - 10, 20);

    // ── Filter summary ─────────────────────────────────────────────────────
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

    // ── Data table ─────────────────────────────────────────────────────────
    autoTable(doc, {
      startY: 36,
      headStyles: { fillColor: [24, 24, 27], fontSize: 7, textColor: 255 },
      bodyStyles: { fontSize: 7 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0:  { cellWidth: 28 },  // Invoice No.
        1:  { cellWidth: 32 },  // Order ID
        2:  { cellWidth: 55 },  // Customer
        3:  { cellWidth: 36 },  // Salesman
        4:  { cellWidth: 32 },  // Division
        5:  { cellWidth: 36 },  // Branch
        6:  { cellWidth: 24 },  // Inv. Date
        7:  { cellWidth: 24 },  // Due Date
        8:  { cellWidth: 28 },  // Net Recv.
        9:  { cellWidth: 24 },  // Total Paid
        10: { cellWidth: 30 },  // Outstanding
        11: { cellWidth: 18 },  // Days OD
        12: { cellWidth: 20 },  // Status
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
        (inv.invoiceDate ?? '').split(' ')[0],
        (inv.due ?? '').split(' ')[0],
        inv.netReceivable?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) ?? '',
        inv.totalPaid?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) ?? '',
        inv.outstanding?.toLocaleString('en-PH', { minimumFractionDigits: 2 }) ?? '',
        inv.overdue ?? '',
        inv.status,
      ]),
      margin: { left: 10, right: 10 },
      tableWidth: 'auto',
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

    doc.save(`ar-export-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (loading) return (
    <div className="p-8 space-y-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );

  if (error) return (
    <div className="p-8 text-center text-red-500">Error: {error}</div>
  );

  return (
    <div className="p-4 md:p-6 bg-background text-foreground min-h-screen space-y-6 w-full box-border overflow-hidden">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accounts Receivable Monitoring</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of accounts receivable and outstanding balances
        </p>
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2 w-full min-w-0">

        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 h-9">
          <span className="text-xs font-medium text-muted-foreground shrink-0">From</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="h-auto border-0 p-0 text-xs focus-visible:ring-0 shadow-none w-[110px] bg-transparent"
          />
        </div>

        <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 h-9">
          <span className="text-xs font-medium text-muted-foreground shrink-0">To</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="h-auto border-0 p-0 text-xs focus-visible:ring-0 shadow-none w-[110px] bg-transparent"
          />
        </div>

        {/* Customer (searchable) */}
        <SearchableSelect
          value={customer}
          onValueChange={(val) => { setCustomer(val); setPage(1); }}
          placeholder="All Customers"
          className="h-9 w-[180px] text-xs !block text-left truncate relative pr-8 [&_svg]:absolute [&_svg]:right-3 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
          options={[
            { value: '', label: 'All Customers' },
            ...customerOptions.map((name) => ({ value: name, label: name })),
          ]}
        />

        <Select
          value={branch || '__all__'}
          onValueChange={(val) => { setBranch(val === '__all__' ? '' : val); setPage(1); }}
        >
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue placeholder="All Branches" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="__all__" className="text-xs text-muted-foreground">All Branches</SelectItem>
            {branchOptions.map((name) => (
              <SelectItem key={name} value={name} className="text-xs">{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Salesman (searchable) */}
        <SearchableSelect
          value={salesman}
          onValueChange={(val) => { setSalesman(val); setPage(1); }}
          placeholder="All Salesmen"
          className="h-9 w-[180px] text-xs !block text-left truncate relative pr-8 [&_svg]:absolute [&_svg]:right-3 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
          options={[
            { value: '', label: 'All Salesmen' },
            ...salesmanOptions.map((name) => ({ value: name, label: name })),
          ]}
        />

        {/* Division (searchable) */}
        <SearchableSelect
          value={division}
          onValueChange={(val) => { setDivision(val); setPage(1); }}
          placeholder="All Divisions"
          className="h-9 w-[180px] text-xs !block text-left truncate relative pr-8 [&_svg]:absolute [&_svg]:right-3 [&_svg]:top-1/2 [&_svg]:-translate-y-1/2"
          options={[
            { value: '', label: 'All Divisions' },
            ...divisionOptions.map((name) => ({ value: name, label: name })),
          ]}
        />

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
          Showing <span className="font-semibold text-foreground">{displayInvoices.length}</span>{' '}
          of <span className="font-semibold text-foreground">{invoices.length}</span> invoices
        </p>
      )}

      {/* ── Metrics ── */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 w-full">
        <MetricCard
          title="Total Receivable"
          value={`₱${totalReceivable.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`${displayInvoices.length} total invoices`}
          icon={<PhilippinePeso className="h-4 w-4 text-primary" />}
        />
        <MetricCard
          title="Outstanding Balance"
          value={`₱${totalOutstanding.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          sub={`${((totalOutstanding / totalReceivable) * 100 || 0).toFixed(1)}% of total`}
          icon={<AlertCircle className="h-4 w-4 text-primary" />}
        />
        <MetricCard
          title="Overdue Invoices"
          value={overdueInvoices.length}
          sub={`Avg ${avgOverdue} days overdue`}
          icon={<Clock className="h-4 w-4 text-primary" />}
        />
      </div>

      {/* ── Charts Row 1 ── */}
      <div className="grid gap-4 md:grid-cols-2 min-w-0 w-full">
        <AgingChart data={displayAgingData} isFiltered={isFiltered} />
        <SalesmanChart data={displaySalesmanData} isFiltered={isFiltered} />
      </div>

      {/* ── Charts Row 2 ── */}
      <div className="grid gap-4 md:grid-cols-2 min-w-0 w-full">
        <CustomerOutstandingChart data={customerData} isFiltered={isFiltered} />
        <BranchProgressList data={displayBranchData} isFiltered={isFiltered} />
      </div>

      {/* ── Table ── */}
      <InvoiceTable invoices={displayInvoices} page={page} setPage={setPage} />

    </div>
  );
}