/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useState, useMemo, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useCustomerBillingSummary } from "./hooks/useCustomerBillingSummary";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Store,
  Users,
  CreditCard,
  Percent,
  Receipt,
  Download,
  Building,
  User,
  Sparkles,
  X,
  Undo2,
  AlertTriangle,
  TrendingUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";


const formatCurrency = (amt: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amt);
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return isNaN(date.getTime())
    ? dateStr
    : date.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
};

const getPageNumbers = (current: number, total: number) => {
  if (total <= 5) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  if (current > 2) pages.push(1);
  if (current > 3) pages.push("...");
  for (let i = Math.max(1, current - 1); i <= Math.min(total, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  if (current < total - 1) pages.push(total);
  return pages;
};

export default function CustomerBillingSummaryModule() {
  const {
    searchQuery,
    setSearchQuery,
    searchResults,
    pagination,
    page,
    setPage,
    limit,
    setLimit,
    sortBy,
    sortOrder,
    handleSort,
    isSearching,
    selectedCustomerId,
    selectCustomer,
    clearSelection,
    details,
    isLoadingDetails,
    storeType,
    setStoreType,
    classification,
    setClassification,
    storeTypes,
    classifications,
  } = useCustomerBillingSummary();

  const renderSortIcon = (key: string) => {
    if (sortBy !== key) return <ArrowUpDown className="ml-1 h-3.5 w-3.5 text-zinc-400/70" />;
    return sortOrder === "asc"
      ? <ArrowUp className="ml-1 h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 font-bold" />
      : <ArrowDown className="ml-1 h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100 font-bold" />;
  };


  const storeTypeOptions = useMemo(() => {
    return [
      { value: "", label: "All Store Types" },
      ...storeTypes.map((st) => ({
        value: String(st.id),
        label: st.store_type || `ID ${st.id}`,
      })),
    ];
  }, [storeTypes]);

  const classificationOptions = useMemo(() => {
    return [
      { value: "", label: "All Classifications" },
      ...classifications.map((cl) => ({
        value: String(cl.id),
        label: cl.classification_name || `ID ${cl.id}`,
      })),
    ];
  }, [classifications]);

  // Search filters for inner lists
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [returnSearch, setReturnSearch] = useState("");
  const [unfulfilledSearch, setUnfulfilledSearch] = useState("");
  const [memoSearch, setMemoSearch] = useState("");
  const [paymentSearch, setPaymentSearch] = useState("");

  // Collapsible ledger states
  const [collapsedInvoices, setCollapsedInvoices] = useState(false);
  const [collapsedPayments, setCollapsedPayments] = useState(true);
  const [collapsedReturns, setCollapsedReturns] = useState(true);
  const [collapsedUnfulfilled, setCollapsedUnfulfilled] = useState(true);
  const [collapsedMemos, setCollapsedMemos] = useState(true);

  // Compute metrics for selected customer
  const metrics = useMemo(() => {
    if (!details) {
      return { totalReceivable: 0, totalPaid: 0, outstanding: 0, overdueCount: 0 };
    }
    const totalInvoiceNet = details.salesInvoices.reduce((sum, inv) => {
      const net = inv.gross_amount != null
        ? (inv.gross_amount - (inv.discount_amount || 0))
        : (inv.net_amount || inv.total_amount || 0);
      return sum + net;
    }, 0);
    const totalReturns = details.salesReturns.reduce((sum, ret) => sum + (ret.total_amount || 0), 0);
    const totalMemos = details.customerMemos.reduce((sum, m) => {
      const amt = m.amount || 0;
      if (m.type === 1) {
        return sum + amt; // Debit increases receivable
      } else {
        return sum - amt; // Credit decreases receivable
      }
    }, 0);
    const totalReceivable = Math.max(0, totalInvoiceNet - totalReturns + totalMemos);

    // Calculate total paid directly from sales_invoice_payments data source
    const totalPaid = details.payments.reduce(
      (sum, p) => sum + (p.paid_amount || 0),
      0
    );
    const outstanding = Math.max(0, totalReceivable - totalPaid);
    const overdueCount = details.transactions.filter(
      (tx) => tx.daysOverdue != null && tx.daysOverdue >= 0 && (tx.outstandingBalance || 0) > 0
    ).length;

    return { totalReceivable, totalPaid, outstanding, overdueCount };
  }, [details]);

  // AI credit predictive evaluation analysis
  const aiAnalysis = useMemo(() => {
    if (!details) return null;

    const { salesInvoices, payments, salesReturns, customerMemos, transactions } = details;

    const totalInvoiceNet = salesInvoices.reduce((sum, inv) => {
      const net = inv.gross_amount != null
        ? (inv.gross_amount - (inv.discount_amount || 0))
        : (inv.net_amount || inv.total_amount || 0);
      return sum + net;
    }, 0);
    const totalReturns = salesReturns.reduce((sum, ret) => sum + (ret.total_amount || 0), 0);
    const totalMemos = customerMemos.reduce((sum, m) => {
      const amt = m.amount || 0;
      if (m.type === 1) {
        return sum + amt; // Debit increases receivable
      } else {
        return sum - amt; // Credit decreases receivable
      }
    }, 0);
    const totalReceivable = Math.max(0, totalInvoiceNet - totalReturns + totalMemos);

    const totalPaid = payments.reduce((sum, p) => sum + (p.paid_amount || 0), 0);
    const outstanding = Math.max(0, totalReceivable - totalPaid);
    const overdueCount = transactions.filter(
      (tx) => tx.daysOverdue != null && tx.daysOverdue > 0 && (tx.outstandingBalance || 0) > 0
    ).length;

    const collectionRate = totalReceivable > 0 ? (totalPaid / totalReceivable) * 100 : 100;

    let score = Math.round(collectionRate);
    if (overdueCount > 0) {
      score -= overdueCount * 5;
    }
    score = Math.max(10, Math.min(100, score));

    let totalPaidInvoicesCount = 0;
    let totalDelayDays = 0;
    let onTimePaymentsCount = 0;

    const invoicesMap = new Map();
    salesInvoices.forEach((inv) => {
      invoicesMap.set(inv.invoice_id, inv);
      if (inv.invoice_no) {
        invoicesMap.set(inv.invoice_no, inv);
      }
    });

    payments.forEach((p) => {
      const invId = typeof p.invoice_id === "object" && p.invoice_id !== null ? p.invoice_id.invoice_id : p.invoice_id;
      const inv = invId ? invoicesMap.get(invId) : null;
      if (inv && inv.due_date && p.date_paid) {
        const dueDate = new Date(inv.due_date);
        const paidDate = new Date(p.date_paid);
        if (!isNaN(dueDate.getTime()) && !isNaN(paidDate.getTime())) {
          totalPaidInvoicesCount++;
          const diffMs = paidDate.getTime() - dueDate.getTime();
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          if (diffDays <= 0) {
            onTimePaymentsCount++;
          } else {
            totalDelayDays += diffDays;
          }
        }
      }
    });

    const averageDelay = totalPaidInvoicesCount > 0 ? Math.round(totalDelayDays / totalPaidInvoicesCount) : 0;
    const onTimeRate = totalPaidInvoicesCount > 0 ? Math.round((onTimePaymentsCount / totalPaidInvoicesCount) * 100) : 100;

    let grade = "A+";
    let status = "Exceptional";
    let themeColor = "text-emerald-600 dark:text-emerald-400 border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20";
    let riskLevel = "Very Low";

    if (score >= 95) {
      grade = "A+";
      status = "Exceptional";
      riskLevel = "Very Low";
      themeColor = "text-emerald-600 dark:text-emerald-400 border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/15";
    } else if (score >= 85) {
      grade = "A";
      status = "Reliable";
      riskLevel = "Low";
      themeColor = "text-emerald-500 dark:text-emerald-400 border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10";
    } else if (score >= 70) {
      grade = "B";
      status = "Stable";
      riskLevel = "Medium";
      themeColor = "text-amber-600 dark:text-amber-400 border-amber-200 bg-amber-50/50 dark:bg-amber-950/15";
    } else if (score >= 50) {
      grade = "C";
      status = "Watchlist";
      riskLevel = "Elevated";
      themeColor = "text-orange-600 dark:text-orange-400 border-orange-200 bg-orange-50/50 dark:bg-orange-950/15";
    } else {
      grade = "D/F";
      status = "High Risk";
      riskLevel = "High";
      themeColor = "text-rose-600 dark:text-rose-400 border-rose-200 bg-rose-50/50 dark:bg-rose-950/15";
    }

    const findings = [];
    const recommendations = [];

    findings.push(`Collected ${collectionRate.toFixed(1)}% of billed receivables (${formatCurrency(totalPaid)} paid of ${formatCurrency(totalReceivable)} total).`);
    
    if (outstanding > 0) {
      findings.push(`Outstanding balance of ${formatCurrency(outstanding)} remaining to be settled.`);
    } else {
      findings.push("No outstanding balance; all billed receivables are fully paid.");
    }

    if (overdueCount > 0) {
      findings.push(`Has ${overdueCount} overdue billing statements currently pending.`);
    }

    if (grade === "A+" || grade === "A") {
      recommendations.push("Safe to extend or increase credit limits.");
      recommendations.push("Eligible for premium billing terms or discounts.");
      recommendations.push("Process new sales orders immediately without credit holds.");
    } else if (grade === "B") {
      recommendations.push("Maintain current credit terms (e.g. 30 days).");
      recommendations.push("Perform routine collection reminders 3 days before due dates.");
      recommendations.push("Ensure total outstanding balance stays below standard thresholds.");
    } else if (grade === "C") {
      recommendations.push("Require partial deposits (e.g., 50%) on large order bookings.");
      recommendations.push("Send proactive, automated reminders immediately upon invoice due date.");
      recommendations.push("Subject new deliveries to strict manager credit review.");
    } else {
      recommendations.push("High risk of delinquency. Shift payments to COD (Cash on Delivery) or advanced payment.");
      recommendations.push("Place a temporary credit hold on the account.");
      recommendations.push("Initiate aggressive collection outreach for outstanding AR balances.");
    }

    return {
      score,
      grade,
      status,
      riskLevel,
      themeColor,
      averageDelay,
      onTimeRate,
      findings,
      recommendations,
    };
  }, [details]);





  // Filtered lists for tabs
  const filteredInvoices = useMemo(() => {
    if (!details) return [];
    return details.salesInvoices.filter(
      (inv) =>
        inv.invoice_no?.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
        inv.remarks?.toLowerCase().includes(invoiceSearch.toLowerCase())
    );
  }, [details, invoiceSearch]);

  const filteredReturns = useMemo(() => {
    if (!details) return [];
    return details.salesReturns.filter(
      (ret) =>
        ret.return_no?.toLowerCase().includes(returnSearch.toLowerCase()) ||
        ret.invoice_no?.toLowerCase().includes(returnSearch.toLowerCase()) ||
        ret.remarks?.toLowerCase().includes(returnSearch.toLowerCase()) ||
        String(ret.total_amount || "").includes(returnSearch)
    );
  }, [details, returnSearch]);

  const filteredUnfulfilled = useMemo(() => {
    if (!details) return [];
    return details.unfulfilledSales.filter(
      (ut) =>
        ut.sales_invoice_id?.invoice_no?.toLowerCase().includes(unfulfilledSearch.toLowerCase()) ||
        ut.nte?.toLowerCase().includes(unfulfilledSearch.toLowerCase())
    );
  }, [details, unfulfilledSearch]);

  const filteredMemos = useMemo(() => {
    if (!details) return [];
    return details.customerMemos.filter(
      (m) =>
        m.memo_number?.toLowerCase().includes(memoSearch.toLowerCase()) ||
        m.reason?.toLowerCase().includes(memoSearch.toLowerCase())
    );
  }, [details, memoSearch]);

  const filteredPayments = useMemo(() => {
    if (!details) return [];
    return details.payments.filter(
      (p) =>
        p.collection_id?.collection_receipt_no?.toLowerCase().includes(paymentSearch.toLowerCase()) ||
        p.invoice_id?.invoice_no?.toLowerCase().includes(paymentSearch.toLowerCase()) ||
        p.reference_no?.toLowerCase().includes(paymentSearch.toLowerCase())
    );
  }, [details, paymentSearch]);

  const handleExportPDF = useCallback(() => {
    if (!details) return;

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 14;
    const headerBgColor = "#18181B"; // Zinc-900
    const headerTextColor = "#FFFFFF";
    const primaryColor = "#4F46E5"; // Indigo-600
    const secondaryTextColor = "#A1A1AA"; // Zinc-400
    const defaultTextColor = "#18181B"; // Zinc-900
    const tableHeaderBg = "#3F3F46"; // Zinc-700
    const tableHeaderTextColor = "#FFFFFF";

    // Set default text styles
    doc.setFont("helvetica", "normal");
    doc.setTextColor(defaultTextColor);

    // Function to add header to each page
    const addHeader = (pageNumber: number, totalPages: number) => {
      doc.setFillColor(headerBgColor);
      doc.rect(0, 0, pageW, 25, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(headerTextColor);
      doc.text("Customer Billing & Configuration Report", margin, 10);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(secondaryTextColor);
      doc.text(
        `Generated: ${new Date().toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })} | Customer: ${details.customer.customer_name || "N/A"} (${details.customer.customer_code || "N/A"})`,
        margin,
        15
      );

      // Page Number
      doc.setTextColor(secondaryTextColor);
      doc.text(`Page ${pageNumber} of ${totalPages}`, pageW - margin, 15, { align: "right" });
    };

    // Main Content Generation
    let currentY = 0; // Tracks the current Y position for content

    // Initial Header
    addHeader(1, 0); // Will update totalPages later
    currentY = 30; // Start content below the header

    // --- CUSTOMER PROFILE SECTION ---
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(defaultTextColor);
    doc.text("CUSTOMER PROFILE", margin, currentY);
    currentY += 5;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    const customerDetails = [
      `Name: ${details.customer.customer_name || "—"}`,
      `Code: ${details.customer.customer_code || "—"}`,
      `Store Name: ${details.customer.store_name || "—"}`,
      `Signage: ${details.customer.store_signage || "—"}`,
      `Contact: ${details.customer.contact_number || "—"}`,
      `Email: ${details.customer.customer_email || "—"}`,
      `TIN: ${details.customer.customer_tin || "—"}`,
      `Address: ${[details.customer.brgy, details.customer.city, details.customer.province].filter(Boolean).join(", ") || "—"}`,
      `VAT Registered: ${details.customer.isVAT ? "Yes" : "No"}`,
      `EWT Exempt: ${details.customer.isEWT ? "Yes" : "No"}`,
      `Payment Terms: ${details.customer.payment_term_detail?.payment_name || "No Terms"} (${details.customer.payment_term_detail?.payment_days ?? 0} Days)`,
      `Default Discount: ${details.customer.discount_type?.discount_type || "None"} (${details.customer.discount_type?.total_percent != null ? `${Number(details.customer.discount_type.total_percent).toFixed(2)}%` : "0.00%"})`,
    ];

    let xOffset = margin;
    let detailY = currentY + 3;
    customerDetails.forEach((detail, index) => {
      doc.text(detail, xOffset, detailY);
      if ((index + 1) % 4 === 0) { // Arrange in 3 columns for better readability
        xOffset = margin;
        detailY += 4;
      } else {
        xOffset += (pageW - 2 * margin) / 3; // Approx 1/3 of page width
      }
    });
    currentY = detailY + 5;

    // --- BANK ACCOUNTS TABLE ---
    currentY += 5;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(defaultTextColor);
    doc.text("REGISTERED BANK ACCOUNTS", margin, currentY);
    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [["Bank Name", "Account Name", "Account Number", "Account Type", "Branch", "Primary"]],
      body: details.bankAccounts.map((b) => [
        b.bank_name || "—",
        b.account_name || "—",
        b.account_number || "—",
        b.account_type || "—",
        b.branch_of_account || "—",
        b.is_primary ? "Yes" : "No",
      ]),
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: "#E4E4E7", lineWidth: 0.1 }, // Zinc-200
      headStyles: { fillColor: tableHeaderBg, textColor: tableHeaderTextColor, fontStyle: "bold", fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: "#FAFAFA" }, // Zinc-50
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        addHeader(data.pageNumber, doc.internal.pages.length - 1); // Pass total pages for correct numbering
      }
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;

    // --- DISCOUNT OVERRIDES & PRODUCT PRICING TABLE ---
    currentY += 5;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(defaultTextColor);
    doc.text("DISCOUNT OVERRIDES & PRODUCT PRICING", margin, currentY);
    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [["Type", "Target (Supplier/Category/Product)", "Override Detail", "Value"]],
      body: [
        ...details.supplierCategoryDiscounts.map((d) => [
          "Supplier Override",
          (d.supplier_id?.supplier_name || "—") + (d.category_id?.category_name ? ` / ${d.category_id.category_name}` : " (All Categories)"),
          d.discount_type?.discount_type || "—",
          d.discount_type?.total_percent != null ? `${Number(d.discount_type.total_percent).toFixed(2)}%` : "—",
        ]),
        ...details.productDiscounts.map((p) => [
          "Product Override",
          p.product_id?.product_name || "—",
          p.discount_type?.discount_type || "Custom Price Only",
          p.unit_price != null
            ? formatCurrency(p.unit_price)
            : (p.discount_type?.total_percent != null ? `${Number(p.discount_type.total_percent).toFixed(2)}%` : "—"),
        ]),
      ],
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: "#E4E4E7", lineWidth: 0.1 },
      headStyles: { fillColor: tableHeaderBg, textColor: tableHeaderTextColor, fontStyle: "bold", fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: "#FAFAFA" },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        addHeader(data.pageNumber, doc.internal.pages.length - 1);
      }
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;

    // Add page for transactions
    doc.addPage();
    currentY = 30; // Reset Y for new page content

    // --- SALES INVOICES RECORD ---
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(defaultTextColor);
    doc.text("SALES INVOICES RECORD", margin, currentY);
    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [["Invoice No", "Date", "Due Date", "Salesman", "Gross Amount", "Discounts", "Net Amount", "Status"]],
      body: details.salesInvoices.map((inv) => [
        inv.invoice_no || "—",
        formatDate(inv.invoice_date),
        formatDate(inv.due_date),
        inv.salesman_id?.salesman_name || "—",
        formatCurrency(inv.gross_amount || 0),
        formatCurrency(inv.discount_amount || 0),
        formatCurrency(inv.net_amount || inv.total_amount || 0),
        inv.transaction_status || "—",
      ]),
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: "#E4E4E7", lineWidth: 0.1 },
      headStyles: { fillColor: tableHeaderBg, textColor: tableHeaderTextColor, fontStyle: "bold", fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: "#FAFAFA" },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        addHeader(data.pageNumber, doc.internal.pages.length - 1);
      }
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;

    // --- CUSTOMER CREDIT & DEBIT MEMOS ---
    currentY += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(defaultTextColor);
    doc.text("CUSTOMER CREDIT & DEBIT MEMOS", margin, currentY);
    currentY += 3;

    autoTable(doc, {
      startY: currentY,
      head: [["Memo Number", "Date Created", "Type", "Supplier Target", "GL Account", "Amount", "Status"]],
      body: details.customerMemos.map((m) => [
        m.memo_number || "—",
        formatDate(m.created_at),
        m.type === 1 ? "Debit Memo" : "Credit Memo",
        m.supplier_id?.supplier_name || "—",
        m.chart_of_account?.account_title || "—",
        formatCurrency(m.amount || 0),
        m.status || "—",
      ]),
      styles: { fontSize: 7, cellPadding: 1.5, lineColor: "#E4E4E7", lineWidth: 0.1 },
      headStyles: { fillColor: tableHeaderBg, textColor: tableHeaderTextColor, fontStyle: "bold", fontSize: 7, cellPadding: 2 },
      alternateRowStyles: { fillColor: "#FAFAFA" },
      margin: { left: margin, right: margin },
      didDrawPage: (data) => {
        addHeader(data.pageNumber, doc.internal.pages.length - 1);
      }
    });
    currentY = (doc as any).lastAutoTable.finalY + 5;

    // --- PAYMENTS RECEIVED HISTORY ---
    if (details.payments.length > 0) {
      doc.addPage();
      currentY = 30; // Reset Y for new page content

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(defaultTextColor);
      doc.text("PAYMENTS RECEIVED HISTORY", margin, currentY);
      currentY += 3;

      autoTable(doc, {
        startY: currentY,
        head: [["Collection Receipt", "Date Paid", "Invoice Ref", "Reference No.", "Amount Paid"]],
        body: details.payments.map((p) => [
          p.collection_id?.collection_receipt_no || "—",
          formatDate(p.date_paid),
          p.invoice_id?.invoice_no || "—",
          p.reference_no || "—",
          formatCurrency(p.paid_amount || 0),
        ]),
        styles: { fontSize: 7, cellPadding: 1.5, lineColor: "#E4E4E7", lineWidth: 0.1 },
        headStyles: { fillColor: tableHeaderBg, textColor: tableHeaderTextColor, fontStyle: "bold", fontSize: 7, cellPadding: 2 },
        alternateRowStyles: { fillColor: "#FAFAFA" },
        margin: { left: margin, right: margin },
        didDrawPage: (data) => {
          addHeader(data.pageNumber, doc.internal.pages.length - 1);
        }
      });
      currentY = (doc as any).lastAutoTable.finalY + 5;
    }

    // --- AI CREDIT & PAYMENT RELIABILITY ANALYSIS ---
    if (aiAnalysis) {
      doc.addPage();
      currentY = 30; // Reset Y for new page content

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(primaryColor); // Use a distinct color for AI section header
      doc.text("AI CREDIT & PAYMENT RELIABILITY ANALYSIS", margin, currentY);
      currentY += 5;

      // Metrics
      doc.setFontSize(9);
      doc.setTextColor(defaultTextColor);
      doc.text(`Reliability Score: ${aiAnalysis.score}/100`, margin, currentY);
      doc.text(`Rating Grade: ${aiAnalysis.grade} (${aiAnalysis.status})`, margin + (pageW / 4), currentY);
      doc.text(`Risk Evaluation: ${aiAnalysis.riskLevel} Risk`, margin + (pageW / 2), currentY);
      currentY += 5;
      doc.text(`On-Time Payment Rate: ${aiAnalysis.onTimeRate}%`, margin, currentY);
      doc.text(`Average Payment Delay: ${aiAnalysis.averageDelay} days`, margin + (pageW / 4), currentY);
      currentY += 10;

      // Key Historical Findings
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(defaultTextColor);
      doc.text("KEY HISTORICAL FINDINGS", margin, currentY);
      currentY += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      aiAnalysis.findings.forEach((finding) => {
        if (currentY + 4 > pageH - margin) { // Check for page overflow
          doc.addPage();
          addHeader(doc.internal.pages.length, 0);
          currentY = 30; // Reset Y for new page content
        }
        doc.text(`• ${finding}`, margin, currentY);
        currentY += 4;
      });
      currentY += 5;

      // Credit Action Plan & Recommendations
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(defaultTextColor);
      doc.text("CREDIT ACTION PLAN & RECOMMENDATIONS", margin, currentY);
      currentY += 4;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      aiAnalysis.recommendations.forEach((rec) => {
        if (currentY + 4 > pageH - margin) { // Check for page overflow
          doc.addPage();
          addHeader(doc.internal.pages.length, 0);
          currentY = 30; // Reset Y for new page content
        }
        doc.text(`• ${rec}`, margin, currentY);
        currentY += 4;
      });
    }

    // Update total pages for all headers
    const totalPages = doc.internal.pages.length -1; // -1 because the first element is a dummy
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addHeader(i, totalPages);
    }
    doc.setPage(1); // Reset to the first page for viewing

    doc.save(`customer-history-report-${details.customer.customer_code}.pdf`);
  }, [details, aiAnalysis]);



  return (
    <div className="flex flex-col space-y-4 w-full max-w-full px-4 md:px-8 pb-6">
      
      {/* Split Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left Column: Customer Selection List */}
        <div className="lg:col-span-4 lg:sticky lg:top-4 h-[calc(100vh-130px)] flex flex-col space-y-4">
          <Card className="border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950 flex flex-col h-full overflow-hidden">
            <CardHeader className="pb-3 pt-4 px-4 flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                {/* Search Box */}
                <div className="relative w-full">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Search customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-8 h-9 text-xs"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Filters Row */}
                <div className="grid grid-cols-2 gap-2">
                  <SearchableSelect
                    options={storeTypeOptions}
                    value={storeType}
                    onValueChange={setStoreType}
                    placeholder="All Store Types"
                    className="h-8 text-[11.5px] px-2 bg-white dark:bg-zinc-950 font-normal border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                  />

                  <SearchableSelect
                    options={classificationOptions}
                    value={classification}
                    onValueChange={setClassification}
                    placeholder="All Classifications"
                    className="h-8 text-[11.5px] px-2 bg-white dark:bg-zinc-950 font-normal border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1 min-h-0 overflow-hidden flex flex-col">
              {isSearching ? (
                <div className="p-4 space-y-3">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No active customers found.
                </div>
              ) : (
                <div className="overflow-y-auto flex-1 min-h-0 relative scrollbar-thin">
                  <Table className="text-[11px]">
                    <TableHeader className="sticky top-0 bg-white dark:bg-zinc-950 z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                      <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                        <TableHead className="py-2 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={() => handleSort("name")}>
                          Customer {renderSortIcon("name")}
                        </TableHead>
                        <TableHead className="py-2 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={() => handleSort("term")}>
                          Term {renderSortIcon("term")}
                        </TableHead>
                        <TableHead className="py-2 text-right pr-4 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" onClick={() => handleSort("configs")}>
                          Configs {renderSortIcon("configs")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {searchResults.map((customer) => {
                        const isSelected = customer.id === selectedCustomerId;
                        return (
                          <TableRow
                            key={customer.id}
                            className={`cursor-pointer transition-all relative ${
                              isSelected
                                ? "bg-indigo-50/65 dark:bg-indigo-950/25 font-semibold text-indigo-700 dark:text-indigo-300 border-l-4 border-indigo-650 pl-2"
                                : "hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 border-l-4 border-transparent"
                            }`}
                            onClick={() => selectCustomer(customer.id)}
                          >
                            <TableCell className="py-2">
                              <div className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-1">
                                {customer.customer_name}
                              </div>
                              <div className="text-[9px] text-muted-foreground">
                                {customer.customer_code}
                              </div>
                            </TableCell>
                            <TableCell className="py-2">
                              {customer.payment_term_name !== "No Terms" ? (
                                <span className="px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-[9px] font-medium border border-zinc-200 dark:border-zinc-800">
                                  {customer.payment_term_name}
                                </span>
                              ) : (
                                <span className="text-rose-500 italic text-[9px]">No Terms</span>
                              )}
                            </TableCell>
                            <TableCell className="py-2 text-right font-bold text-zinc-700 dark:text-zinc-300 pr-4">
                              {customer.discount_config_count}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>

            {/* Pagination Controls Footer */}
            <div className="flex flex-col gap-2 p-3 text-[10px] border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/20 rounded-b-lg">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-muted-foreground">
                  Page <strong>{pagination.page}</strong> of <strong>{pagination.totalPages}</strong> ({pagination.total} total)
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Show:</span>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="h-6 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-1 py-0 text-[10px] text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
                  >
                    {[10, 20, 50, 100].map((pageSize) => (
                      <option key={pageSize} value={pageSize}>
                        {pageSize}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-1.5 text-[9px]"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                  >
                    Prev
                  </Button>
                  {getPageNumbers(page, pagination.totalPages).map((p, idx) => (
                    <Button
                      key={idx}
                      variant={p === page ? "default" : "outline"}
                      size="sm"
                      className="h-6 w-6 p-0 text-[9px]"
                      onClick={() => typeof p === "number" && setPage(p)}
                      disabled={p === "..."}
                    >
                      {p}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-6 px-1.5 text-[9px]"
                    onClick={() => setPage(Math.min(pagination.totalPages, page + 1))}
                    disabled={page === pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Detailed Mode */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {!selectedCustomerId ? (
              <motion.div
                key="dashboard-overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Visual Dashboard Header */}
                <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/10 shadow-sm">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-indigo-650/10 dark:bg-indigo-400/10 rounded-xl text-indigo-650 dark:text-indigo-455 mt-1">
                      <Sparkles className="h-6 w-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Financial Management & Customer Accounts</h3>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-xl">
                        Monitor accounts receivable, analyze client collections, audit custom override discount configurations, and leverage AI predictive scoring to optimize cash collection flows.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Portfolio Summary Analytics */}
                <Card className="border border-zinc-200/80 dark:border-zinc-800/80 bg-gradient-to-br from-white to-zinc-50/30 dark:from-zinc-950 dark:to-zinc-900/20 shadow-md">
                  <CardHeader className="pb-3 pt-5 px-5">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-zinc-850 dark:text-zinc-100">
                      <TrendingUp className="h-5 w-5 text-indigo-500" /> Account Portfolio Directory
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Key distribution metrics across all customer billing profiles.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 pb-5 space-y-6">
                    {/* Overall Quick Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/60 border border-zinc-150/50 dark:border-zinc-800">
                        <span className="text-xs text-muted-foreground font-semibold">Configured Directory</span>
                        <div className="text-3xl font-black mt-1 text-zinc-900 dark:text-zinc-100 font-mono">
                          {pagination.total} <span className="text-xs font-normal text-muted-foreground">accounts</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">Registered customer records</p>
                      </div>

                      <div className="p-4 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/60 border border-zinc-150/50 dark:border-zinc-800">
                        <span className="text-xs text-muted-foreground font-semibold">Discount Overrides</span>
                        <div className="text-3xl font-black mt-1 text-indigo-650 dark:text-indigo-400 font-mono">
                          {searchResults.reduce((sum, c) => sum + (c.discount_config_count > 0 ? 1 : 0), 0)} <span className="text-xs font-normal text-muted-foreground">active</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">Accounts with custom pricing</p>
                      </div>

                      <div className="p-4 rounded-xl bg-zinc-50/60 dark:bg-zinc-900/60 border border-zinc-150/50 dark:border-zinc-800">
                        <span className="text-xs text-muted-foreground font-semibold">Extended Terms</span>
                        <div className="text-3xl font-black mt-1 text-emerald-600 dark:text-emerald-400 font-mono">
                          {searchResults.reduce((sum, c) => sum + (c.payment_term_name !== "No Terms" ? 1 : 0), 0)} <span className="text-xs font-normal text-muted-foreground">active</span>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1">Accounts with extended due dates</p>
                      </div>
                    </div>

                    {/* Classification lists */}
                    <div className="border-t border-zinc-100 dark:border-zinc-900 pt-4 space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400">Distribution Overview</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Store types */}
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Store Types Directory</span>
                          <div className="space-y-1.5 max-h-[160px] overflow-y-auto scrollbar-thin pr-2">
                            {storeTypes.map(st => (
                              <div key={st.id} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-zinc-50/50 hover:bg-zinc-100/50 border border-zinc-150/40 transition-colors">
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{st.store_type}</span>
                                <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono">ID {st.id}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Customer classifications */}
                        <div className="space-y-2">
                          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">Customer Classifications</span>
                          <div className="space-y-1.5 max-h-[160px] overflow-y-auto scrollbar-thin pr-2">
                            {classifications.map(cl => (
                              <div key={cl.id} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg bg-zinc-50/50 hover:bg-zinc-100/50 border border-zinc-150/40 transition-colors">
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{cl.classification_name}</span>
                                <Badge variant="secondary" className="text-[9px] py-0 px-1 font-mono">ID {cl.id}</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Call to action panel */}
                <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center bg-zinc-50/10 dark:bg-zinc-900/5 flex flex-col items-center justify-center">
                  <Users className="h-8 w-8 text-zinc-300 dark:text-zinc-700 mb-2 animate-bounce" />
                  <p className="text-xs font-bold text-zinc-850 dark:text-zinc-200">Interactive Customer Audit</p>
                  <p className="text-[11px] text-muted-foreground max-w-sm mt-0.5 leading-relaxed">
                    Select a customer profile from the sidebar to review detailed ledger statements, custom supplier contracts, and predictive credit profiles.
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="detail"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Header & Back Action */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="h-8 text-xs self-start flex items-center gap-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 font-semibold"
                  >
                    <X className="h-4 w-4" /> Close Panel
                  </Button>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportPDF} className="h-8 text-xs flex items-center gap-1.5 font-semibold">
                      <Download className="h-4 w-4" /> Export Report (PDF)
                    </Button>
                  </div>
                </div>

            {isLoadingDetails ? (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </div>
                <Skeleton className="h-96 w-full" />
              </div>
            ) : details ? (
              <div className="space-y-4">
                
                {/* Profile Summary Header Card */}
                <Card className="shadow-sm border border-zinc-200/60 dark:border-zinc-800/80 bg-gradient-to-br from-white to-zinc-50/20 dark:from-zinc-950 dark:to-zinc-900/10">
                  <CardContent className="p-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="font-semibold uppercase tracking-wider text-[10px] px-1.5 py-0 border-zinc-200 dark:border-zinc-800">
                            {details.customer.customer_code}
                          </Badge>
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-[10px] px-1.5 py-0">
                            {details.customer.isActive ? "Active" : "Inactive"}
                          </Badge>
                          <Badge variant="secondary" className="font-medium text-[10px] px-1.5 py-0">
                            {details.customer.type} Customer
                          </Badge>
                        </div>
                        <h2 className="text-xl mt-1.5 font-bold tracking-tight text-zinc-950 dark:text-white">
                          {details.customer.customer_name}
                        </h2>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-zinc-500 font-medium">
                          <Store className="h-3.5 w-3.5 text-zinc-400" />
                          Store Name: <span className="text-zinc-800 dark:text-zinc-200">{details.customer.store_name}</span> 
                          {details.customer.store_signage && ` (${details.customer.store_signage})`}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-x-8 gap-y-1.5 text-xs border-l border-zinc-200/60 dark:border-zinc-800/80 pl-4 md:pl-8">
                        <div>
                          <p className="text-zinc-400">Phone</p>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">{details.customer.contact_number}</p>
                        </div>
                        <div>
                          <p className="text-zinc-400">Default Discount</p>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {details.customer.discount_type?.discount_type || "None"}
                            {details.customer.discount_type?.total_percent != null && ` (${Number(details.customer.discount_type.total_percent).toFixed(2)}%)`}
                          </p>
                        </div>
                        <div>
                          <p className="text-zinc-400">Payment Term</p>
                          <p className="font-semibold text-zinc-800 dark:text-zinc-200">
                            {details.customer.payment_term_detail 
                              ? `${details.customer.payment_term_detail.payment_name} (${details.customer.payment_term_detail.payment_days ?? 0}d)` 
                              : "No Terms"}
                          </p>
                        </div>
                        {aiAnalysis && (
                          <div>
                            <p className="text-zinc-400 flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-violet-500" /> AI AR Rating
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-[9px] py-0 px-1 border-transparent">
                                {aiAnalysis.grade}
                              </Badge>
                              <span className="font-semibold text-violet-750 dark:text-violet-400 text-xs">
                                {aiAnalysis.status}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3.5 flex flex-row items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Total Invoiced (Real)</p>
                        <p className="text-lg font-bold mt-0.5 text-zinc-800 dark:text-zinc-100">
                          {formatCurrency(metrics.totalReceivable)}
                        </p>
                      </div>
                      <div className="p-2 bg-zinc-100 dark:bg-zinc-800 rounded-full">
                        <Receipt className="h-4.5 w-4.5 text-zinc-600 dark:text-zinc-300" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-3.5 flex flex-row items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Total Paid</p>
                        <p className="text-lg font-bold mt-0.5 text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(metrics.totalPaid)}
                        </p>
                      </div>
                      <div className="p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded-full">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-200 dark:border-emerald-800 text-emerald-600">Paid</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-3.5 flex flex-row items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Outstanding Balance</p>
                        <p className="text-lg font-bold mt-0.5 text-rose-600 dark:text-rose-400">
                          {formatCurrency(metrics.outstanding)}
                        </p>
                      </div>
                      <div className="p-2 bg-rose-50 dark:bg-rose-950/30 rounded-full">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-rose-200 dark:border-rose-800 text-rose-600">Pending</Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-3.5 flex flex-row items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Overdue Statements</p>
                        <p className="text-lg font-bold mt-0.5 text-amber-600 dark:text-amber-500">
                          {metrics.overdueCount}
                        </p>
                      </div>
                      <div className="p-2 bg-amber-50 dark:bg-amber-950/30 rounded-full">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 border-amber-200 dark:border-amber-800 text-amber-600">Overdue</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                                {/* 1. AI CREDIT EVALUATION ADVISOR BLOCK (Top-Priority Credit Advisor) */}
                {aiAnalysis && (
                  <Card className="relative overflow-hidden border border-violet-200/80 dark:border-violet-800/80 bg-gradient-to-br from-white to-violet-50/10 dark:from-zinc-950 dark:to-violet-950/10 shadow-sm">
                    {/* Glow effect */}
                    <div className="absolute top-0 right-0 -mt-8 -mr-8 h-32 w-32 rounded-full bg-violet-500/10 blur-2xl pointer-events-none" />
                    
                    <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-1.5 text-violet-950 dark:text-violet-300 font-bold">
                          <Sparkles className="h-4.5 w-4.5 text-violet-500 animate-pulse" /> AI Payment Reliability Advisor
                        </CardTitle>
                        <CardDescription className="text-xs">
                          Predictive credit evaluation based on historical invoice and cash collections data.
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className={`text-xs font-semibold px-2 py-0.5 ${aiAnalysis.themeColor} border`}>
                        Risk Level: {aiAnalysis.riskLevel}
                      </Badge>
                    </CardHeader>
                    
                    <CardContent className="p-4 pt-2 space-y-4">
                      {/* Metrics block */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-zinc-100 dark:border-zinc-900 pb-4">
                        <div className="flex flex-col items-center justify-center p-3.5 rounded-xl bg-violet-500/5 dark:bg-violet-500/10 border border-violet-100/40 dark:border-violet-900/30 text-center relative overflow-hidden">
                          <span className="text-[11px] text-muted-foreground font-semibold">Reliability Score</span>
                          <div className="flex items-center gap-3 mt-1.5">
                            {/* Visual Score Ring */}
                            <div className="relative h-12 w-12 flex items-center justify-center">
                              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                                <path
                                  className="text-violet-200 dark:text-violet-900"
                                  strokeWidth="3.5"
                                  stroke="currentColor"
                                  fill="none"
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                                <path
                                  className="text-violet-600 dark:text-violet-400 transition-all duration-500"
                                  strokeDasharray={`${aiAnalysis.score}, 100`}
                                  strokeWidth="3.5"
                                  strokeLinecap="round"
                                  stroke="currentColor"
                                  fill="none"
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                />
                              </svg>
                              <span className="absolute text-xs font-black text-violet-950 dark:text-violet-300 font-mono">{aiAnalysis.score}%</span>
                            </div>
                            <div className="text-left">
                              <div className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">Grade: <span className="font-bold text-xs">{aiAnalysis.grade}</span></div>
                              <div className="text-[9px] text-muted-foreground">{aiAnalysis.status}</div>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800 text-center">
                          <span className="text-[11px] text-muted-foreground font-semibold">On-Time Payment Rate</span>
                          <span className="text-2xl font-extrabold text-zinc-850 dark:text-zinc-100 mt-0.5 font-mono">{aiAnalysis.onTimeRate}%</span>
                          <span className="text-[10px] text-zinc-500 font-medium mt-0.5">Within invoice terms</span>
                        </div>

                        <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800 text-center">
                          <span className="text-[11px] text-muted-foreground font-semibold">Average Delay to Pay</span>
                          <span className="text-2xl font-extrabold text-zinc-850 dark:text-zinc-100 mt-0.5 font-mono">
                            {aiAnalysis.averageDelay} <span className="text-xs font-semibold">days</span>
                          </span>
                          <span className="text-[10px] text-zinc-500 font-medium mt-0.5">Delay past due date</span>
                        </div>
                      </div>

                      {/* Insights and Recommendations */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 text-xs">
                        <div className="space-y-2">
                          <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <TrendingUp className="h-4 w-4 text-emerald-500" /> Key Historical Findings
                          </h4>
                          <ul className="space-y-1.5 pl-4 list-disc text-muted-foreground leading-relaxed">
                            {aiAnalysis.findings.map((finding, idx) => (
                              <li key={idx}>{finding}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                            <Building className="h-4 w-4 text-violet-500" /> Credit Action Plan & Advice
                          </h4>
                          <ul className="space-y-1.5 pl-4 list-disc text-muted-foreground leading-relaxed">
                            {aiAnalysis.recommendations.map((rec, idx) => (
                              <li key={idx} className="marker:text-violet-500">{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 2. CUSTOMER PROFILE & ASSIGNED SALESMEN & BANK DETAILS GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bank Details Card */}
                  <Card className="border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs flex items-center gap-1.5 font-bold uppercase tracking-wider text-zinc-500">
                        <Building className="h-4 w-4 text-zinc-400" /> Registered Bank Accounts
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      {details.bankAccounts.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          No bank accounts registered.
                        </p>
                      ) : (
                        <div className="max-h-[160px] overflow-y-auto relative scrollbar-thin">
                          <Table className="text-[11px]">
                            <TableHeader className="sticky top-0 bg-white dark:bg-zinc-950 z-10">
                              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                                <TableHead className="py-1">Bank / Branch</TableHead>
                                <TableHead className="py-1">Account Info</TableHead>
                                <TableHead className="py-1 text-right">Type</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {details.bankAccounts.map((acct) => (
                                <TableRow key={acct.id}>
                                  <TableCell className="py-1.5 font-semibold">
                                    <div>{acct.bank_name}</div>
                                    {acct.branch_of_account && (
                                      <div className="text-[9px] text-muted-foreground font-normal">
                                        {acct.branch_of_account}
                                      </div>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-1.5">
                                    <div className="font-medium text-zinc-900 dark:text-zinc-100">{acct.account_name}</div>
                                    <div className="text-[9px] text-muted-foreground font-mono">{acct.account_number}</div>
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-zinc-200">
                                        {acct.account_type}
                                      </Badge>
                                      {acct.is_primary === 1 && (
                                        <Badge className="bg-zinc-800 text-white text-[9px] py-0 px-1">
                                          P
                                        </Badge>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Assigned Salesmen Card */}
                  <Card className="border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950">
                    <CardHeader className="p-3 pb-1">
                      <CardTitle className="text-xs flex items-center gap-1.5 font-bold uppercase tracking-wider text-zinc-500">
                        <User className="h-4 w-4 text-zinc-400" /> Assigned Sales Agents
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 pt-0">
                      {details.salesmen.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-6">
                          No salesmen assigned to this customer.
                        </p>
                      ) : (
                        <div className="max-h-[160px] overflow-y-auto relative scrollbar-thin">
                          <Table className="text-[11px]">
                            <TableHeader className="sticky top-0 bg-white dark:bg-zinc-950 z-10">
                              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                                <TableHead className="py-1">Salesman Code</TableHead>
                                <TableHead className="py-1">Salesman Name</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {details.salesmen.map((rel) => (
                                <TableRow key={rel.id}>
                                  <TableCell className="py-1.5 font-mono text-zinc-700 dark:text-zinc-300">
                                    {rel.salesman_id?.salesman_code || "—"}
                                  </TableCell>
                                  <TableCell className="py-1.5 font-medium">
                                    {rel.salesman_id?.salesman_name || "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* 3. DISCOUNT CONFIGS CARD (Linear Override Discounts summary) */}
                <Card className="border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950">
                  <CardHeader className="p-3 pb-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <CardTitle className="text-xs flex items-center gap-1.5 font-bold uppercase tracking-wider text-zinc-500">
                        <Percent className="h-4 w-4 text-zinc-400" /> Discount Overrides & pricing rules
                      </CardTitle>
                      <div className="flex items-center gap-1.5 text-[11px] font-medium bg-zinc-50 dark:bg-zinc-900/50 px-2 py-0.5 rounded border">
                        <span className="text-zinc-500">Default Global:</span>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100">
                          {details.customer.discount_type?.discount_type || "None"}
                        </span>
                        {details.customer.discount_type?.total_percent != null && (
                          <Badge variant="outline" className="text-[9px] font-semibold px-1 py-0 border-zinc-200 bg-white">
                            {Number(details.customer.discount_type.total_percent).toFixed(2)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 space-y-4">
                    {/* Supplier Category Overrides list */}
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">Supplier & Category Adjustments</h4>
                      {details.supplierCategoryDiscounts.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic pl-1">No custom supplier or category discount rules.</p>
                      ) : (
                        <div className="max-h-[140px] overflow-y-auto relative scrollbar-thin">
                          <Table className="text-[11px]">
                            <TableHeader className="sticky top-0 bg-white dark:bg-zinc-950 z-10">
                              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                                <TableHead className="py-1">Supplier</TableHead>
                                <TableHead className="py-1">Category</TableHead>
                                <TableHead className="py-1">Discount Type</TableHead>
                                <TableHead className="py-1 text-right pr-2">Rate (%)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {details.supplierCategoryDiscounts.map((rule) => (
                                <TableRow key={rule.id}>
                                  <TableCell className="py-1 font-medium">
                                    <span>{rule.supplier_id?.supplier_name}</span>
                                    {rule.supplier_id?.supplier_shortcut && (
                                      <span className="text-[9px] text-muted-foreground block font-normal">
                                        ({rule.supplier_id.supplier_shortcut})
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-1">
                                    {rule.category_id?.category_name || <span className="text-muted-foreground italic text-[10px]">All Categories</span>}
                                  </TableCell>
                                  <TableCell className="py-1 text-zinc-600 dark:text-zinc-400">{rule.discount_type?.discount_type}</TableCell>
                                  <TableCell className="py-1 text-right font-bold pr-2">
                                    {rule.discount_type?.total_percent != null
                                      ? `${Number(rule.discount_type.total_percent).toFixed(2)}%`
                                      : "0.00%"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>

                    {/* Product Overrides list */}
                    <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-900 pt-3">
                      <h4 className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200">Specific Product Custom Pricing</h4>
                      {details.productDiscounts.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground italic pl-1">No product-specific discount overrides.</p>
                      ) : (
                        <div className="max-h-[140px] overflow-y-auto relative scrollbar-thin">
                          <Table className="text-[11px]">
                            <TableHeader className="sticky top-0 bg-white dark:bg-zinc-950 z-10">
                              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                                <TableHead className="py-1">Product</TableHead>
                                <TableHead className="py-1">SKU</TableHead>
                                <TableHead className="py-1 text-right">Custom Price</TableHead>
                                <TableHead className="py-1">Override Bundle</TableHead>
                                <TableHead className="py-1 text-right pr-2">Override (%)</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {details.productDiscounts.map((rule) => (
                                <TableRow key={rule.id}>
                                  <TableCell className="py-1 font-medium">{rule.product_id?.product_name}</TableCell>
                                  <TableCell className="py-1 text-zinc-500 font-mono">{rule.product_id?.sku_code || "—"}</TableCell>
                                  <TableCell className="py-1 text-right font-semibold text-zinc-750">
                                    {rule.unit_price != null ? formatCurrency(rule.unit_price) : "—"}
                                  </TableCell>
                                  <TableCell className="py-1 text-zinc-600">{rule.discount_type?.discount_type || "—"}</TableCell>
                                  <TableCell className="py-1 text-right font-bold pr-2">
                                    {rule.discount_type?.total_percent != null
                                      ? `${Number(rule.discount_type.total_percent).toFixed(2)}%`
                                      : "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* 4. FINANCIAL HISTORY LEDGER SECTION */}
                <div className="space-y-4 pt-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-500 px-1">Financial Transaction Ledgers</h3>

                  {/* SALES INVOICES LEDGER */}
                  <Card className="border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950">
                    <CardHeader 
                      className="p-3 pb-1.5 flex flex-row items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 select-none transition-colors"
                      onClick={() => setCollapsedInvoices(!collapsedInvoices)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Receipt className="h-4 w-4 text-zinc-400" />
                        <CardTitle className="text-xs font-bold uppercase text-zinc-850 dark:text-zinc-200">
                          Sales Invoices ({filteredInvoices.length})
                        </CardTitle>
                        <span className="text-[10px] text-zinc-400 font-mono hidden sm:inline">
                          • Net Total: {formatCurrency(filteredInvoices.reduce((s, i) => s + (i.net_amount || i.total_amount || 0), 0))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {!collapsedInvoices && (
                          <div className="relative w-40">
                            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Search invoices..."
                              value={invoiceSearch}
                              onChange={(e) => setInvoiceSearch(e.target.value)}
                              className="pl-7 pr-2 h-7 text-[10px]"
                            />
                          </div>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-zinc-150 dark:hover:bg-zinc-800">
                          {collapsedInvoices ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    {!collapsedInvoices && (
                      <CardContent className="p-3 pt-0">
                      {filteredInvoices.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-xs">
                          No sales invoices recorded.
                        </div>
                      ) : (
                        <div className="max-h-[220px] overflow-y-auto relative scrollbar-thin">
                          <Table className="text-[11px]">
                            <TableHeader className="sticky top-0 bg-white dark:bg-zinc-950 z-10">
                              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                                <TableHead className="py-1">Invoice No.</TableHead>
                                <TableHead className="py-1">Date</TableHead>
                                <TableHead className="py-1">Due Date</TableHead>
                                <TableHead className="py-1">Agent</TableHead>
                                <TableHead className="py-1 text-right">Gross</TableHead>
                                <TableHead className="py-1 text-right">Discounts</TableHead>
                                <TableHead className="py-1 text-right">Net</TableHead>
                                <TableHead className="py-1 pr-2 text-right">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredInvoices.map((inv) => (
                                <TableRow key={inv.invoice_id}>
                                  <TableCell className="py-1.5 font-bold text-zinc-900 dark:text-zinc-100">{inv.invoice_no}</TableCell>
                                  <TableCell className="py-1.5">{formatDate(inv.invoice_date)}</TableCell>
                                  <TableCell className="py-1.5">{formatDate(inv.due_date)}</TableCell>
                                  <TableCell className="py-1.5 truncate max-w-[100px]">{inv.salesman_id?.salesman_name || "—"}</TableCell>
                                  <TableCell className="py-1.5 text-right">{inv.gross_amount ? formatCurrency(inv.gross_amount) : "—"}</TableCell>
                                  <TableCell className="py-1.5 text-right text-rose-500">{inv.discount_amount ? `-${formatCurrency(inv.discount_amount)}` : "—"}</TableCell>
                                  <TableCell className="py-1.5 text-right font-bold">{formatCurrency(inv.net_amount || inv.total_amount || 0)}</TableCell>
                                  <TableCell className="py-1.5 text-right pr-2">
                                    <Badge variant="outline" className="text-[9px] py-0 border-zinc-200 font-normal">
                                      {inv.transaction_status || "Created"}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                    )}
                  </Card>

                  {/* PAYMENTS RECEIVED LEDGER */}
                  <Card className="border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950">
                    <CardHeader 
                      className="p-3 pb-1.5 flex flex-row items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 select-none transition-colors"
                      onClick={() => setCollapsedPayments(!collapsedPayments)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <CreditCard className="h-4 w-4 text-zinc-400" />
                        <CardTitle className="text-xs font-bold uppercase text-zinc-850 dark:text-zinc-200">
                          Payments Received ({filteredPayments.length})
                        </CardTitle>
                        <span className="text-[10px] text-emerald-600 font-mono hidden sm:inline">
                          • Total: {formatCurrency(filteredPayments.reduce((s, p) => s + (p.paid_amount || 0), 0))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {!collapsedPayments && (
                          <div className="relative w-40">
                            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Search payments..."
                              value={paymentSearch}
                              onChange={(e) => setPaymentSearch(e.target.value)}
                              className="pl-7 pr-2 h-7 text-[10px]"
                            />
                          </div>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-zinc-150 dark:hover:bg-zinc-800">
                          {collapsedPayments ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    {!collapsedPayments && (
                      <CardContent className="p-3 pt-0">
                      {filteredPayments.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-xs">
                          No payment transactions registered.
                        </div>
                      ) : (
                        <div className="max-h-[220px] overflow-y-auto relative scrollbar-thin">
                          <Table className="text-[11px]">
                            <TableHeader className="sticky top-0 bg-white dark:bg-zinc-950 z-10">
                              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                                <TableHead className="py-1">Receipt No.</TableHead>
                                <TableHead className="py-1">Date Paid</TableHead>
                                <TableHead className="py-1">Invoice Ref</TableHead>
                                <TableHead className="py-1">Reference No.</TableHead>
                                <TableHead className="py-1 text-right pr-2">Amount Paid</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredPayments.map((p) => (
                                <TableRow key={p.id}>
                                  <TableCell className="py-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                                    {p.collection_id?.collection_receipt_no || "—"}
                                  </TableCell>
                                  <TableCell className="py-1.5">{formatDate(p.date_paid)}</TableCell>
                                  <TableCell className="py-1.5 font-semibold text-zinc-800">{p.invoice_id?.invoice_no || "—"}</TableCell>
                                  <TableCell className="py-1.5 font-normal text-zinc-550">{p.reference_no || "—"}</TableCell>
                                  <TableCell className="py-1.5 text-right font-bold text-emerald-600 pr-2">
                                    {formatCurrency(p.paid_amount || 0)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                    )}
                  </Card>

                  {/* SALES RETURNS LEDGER */}
                  <Card className="border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950">
                    <CardHeader 
                      className="p-3 pb-1.5 flex flex-row items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 select-none transition-colors"
                      onClick={() => setCollapsedReturns(!collapsedReturns)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Undo2 className="h-4 w-4 text-zinc-400" />
                        <CardTitle className="text-xs font-bold uppercase text-zinc-850 dark:text-zinc-200">
                          Sales Returns ({filteredReturns.length})
                        </CardTitle>
                        <span className="text-[10px] text-rose-500 font-mono hidden sm:inline">
                          • Net Total: {formatCurrency(filteredReturns.reduce((s, r) => s + (r.total_amount || 0), 0))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {!collapsedReturns && (
                          <div className="relative w-40">
                            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Search returns..."
                              value={returnSearch}
                              onChange={(e) => setReturnSearch(e.target.value)}
                              className="pl-7 pr-2 h-7 text-[10px]"
                            />
                          </div>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-zinc-150 dark:hover:bg-zinc-800">
                          {collapsedReturns ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    {!collapsedReturns && (
                      <CardContent className="p-3 pt-0">
                      {filteredReturns.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-[11px] italic">
                          No sales return history registered.
                        </div>
                      ) : (
                        <div className="max-h-[220px] overflow-y-auto relative scrollbar-thin">
                          <Table className="text-[11px]">
                            <TableHeader className="sticky top-0 bg-white dark:bg-zinc-950 z-10">
                              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                                <TableHead className="py-1">Return No.</TableHead>
                                <TableHead className="py-1">Date</TableHead>
                                <TableHead className="py-1">Invoice Ref</TableHead>
                                <TableHead className="py-1">Sales Agent</TableHead>
                                <TableHead className="py-1 text-right">Return Amount</TableHead>
                                <TableHead className="py-1 pr-2">Remarks</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredReturns.map((ret) => (
                                <TableRow key={ret.id}>
                                  <TableCell className="py-1.5 font-bold text-zinc-900 dark:text-zinc-100">{ret.return_no}</TableCell>
                                  <TableCell className="py-1.5">{formatDate(ret.return_date)}</TableCell>
                                  <TableCell className="py-1.5 font-semibold text-zinc-850">{ret.invoice_no || "—"}</TableCell>
                                  <TableCell className="py-1.5">{ret.salesman_id?.salesman_name || "—"}</TableCell>
                                  <TableCell className="py-1.5 text-right font-bold text-rose-600">
                                    {ret.amount ? formatCurrency(ret.amount) : "—"}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-muted-foreground italic truncate max-w-[120px] pr-2" title={ret.remarks || ""}>
                                    {ret.remarks || "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                    )}
                  </Card>

                  {/* UNFULFILLED SALES LEDGER */}
                  <Card className="border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950">
                    <CardHeader 
                      className="p-3 pb-1.5 flex flex-row items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 select-none transition-colors"
                      onClick={() => setCollapsedUnfulfilled(!collapsedUnfulfilled)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <AlertTriangle className="h-4 w-4 text-zinc-400" />
                        <CardTitle className="text-xs font-bold uppercase text-zinc-850 dark:text-zinc-200">
                          Unfulfilled Sales ({filteredUnfulfilled.length})
                        </CardTitle>
                        <span className="text-[10px] text-amber-600 font-mono hidden sm:inline">
                          • Variance Total: {formatCurrency(filteredUnfulfilled.reduce((s, u) => s + (u.variance_amount || 0), 0))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {!collapsedUnfulfilled && (
                          <div className="relative w-40">
                            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Search unfulfilled..."
                              value={unfulfilledSearch}
                              onChange={(e) => setUnfulfilledSearch(e.target.value)}
                              className="pl-7 pr-2 h-7 text-[10px]"
                            />
                          </div>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-zinc-150 dark:hover:bg-zinc-800">
                          {collapsedUnfulfilled ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    {!collapsedUnfulfilled && (
                      <CardContent className="p-3 pt-0">
                      {filteredUnfulfilled.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-[11px] italic">
                          No unfulfilled items pending.
                        </div>
                      ) : (
                        <div className="max-h-[220px] overflow-y-auto relative scrollbar-thin">
                          <Table className="text-[11px]">
                            <TableHeader className="sticky top-0 bg-white dark:bg-zinc-950 z-10">
                              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                                <TableHead className="py-1">Invoice Ref</TableHead>
                                <TableHead className="py-1">Created</TableHead>
                                <TableHead className="py-1">Acknowledged</TableHead>
                                <TableHead className="py-1">NTE Details</TableHead>
                                <TableHead className="py-1 text-right">Variance</TableHead>
                                <TableHead className="py-1 pr-2 text-right">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredUnfulfilled.map((ut) => (
                                <TableRow key={ut.id}>
                                  <TableCell className="py-1.5 font-bold text-zinc-900 dark:text-zinc-100">
                                    {ut.sales_invoice_id?.invoice_no || "—"}
                                  </TableCell>
                                  <TableCell className="py-1.5">{formatDate(ut.date_created)}</TableCell>
                                  <TableCell className="py-1.5">{formatDate(ut.date_acknowledged)}</TableCell>
                                  <TableCell className="py-1.5 max-w-[200px] truncate" title={ut.nte}>{ut.nte || "—"}</TableCell>
                                  <TableCell className="py-1.5 text-right font-bold text-rose-600">
                                    {formatCurrency(ut.variance_amount || 0)}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right pr-2">
                                    {ut.isCleared === 1 ? (
                                      <Badge className="bg-emerald-100 text-emerald-800 border-transparent dark:bg-emerald-950/20 dark:text-emerald-400 text-[9px] py-0 font-normal">
                                        Cleared
                                      </Badge>
                                    ) : (
                                      <Badge className="bg-amber-100 text-amber-800 border-transparent dark:bg-amber-950/20 dark:text-amber-400 text-[9px] py-0 font-normal">
                                        Pending
                                      </Badge>
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                    )}
                  </Card>

                  {/* CUSTOMER ADJUSTMENT MEMOS */}
                  <Card className="border border-zinc-200/60 dark:border-zinc-800/80 shadow-sm bg-white dark:bg-zinc-950">
                    <CardHeader 
                      className="p-3 pb-1.5 flex flex-row items-center justify-between gap-4 cursor-pointer hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50 select-none transition-colors"
                      onClick={() => setCollapsedMemos(!collapsedMemos)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Percent className="h-4 w-4 text-zinc-400" />
                        <CardTitle className="text-xs font-bold uppercase text-zinc-850 dark:text-zinc-200">
                          Adjustments & Memos ({filteredMemos.length})
                        </CardTitle>
                        <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
                          • Net Total: {formatCurrency(filteredMemos.reduce((s, m) => s + (m.amount || 0), 0))}
                        </span>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {!collapsedMemos && (
                          <div className="relative w-40">
                            <Search className="absolute left-2 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                              type="text"
                              placeholder="Search memos..."
                              value={memoSearch}
                              onChange={(e) => setMemoSearch(e.target.value)}
                              className="pl-7 pr-2 h-7 text-[10px]"
                            />
                          </div>
                        )}
                        <Button variant="ghost" size="icon" className="h-6 w-6 p-0 hover:bg-zinc-150 dark:hover:bg-zinc-800">
                          {collapsedMemos ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        </Button>
                      </div>
                    </CardHeader>
                    {!collapsedMemos && (
                      <CardContent className="p-3 pt-0">
                      {filteredMemos.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-[11px] italic">
                          No adjustments or memos registered.
                        </div>
                      ) : (
                        <div className="max-h-[220px] overflow-y-auto relative scrollbar-thin">
                          <Table className="text-[11px]">
                            <TableHeader className="sticky top-0 bg-white dark:bg-zinc-950 z-10">
                              <TableRow className="bg-zinc-50/50 dark:bg-zinc-900/50">
                                <TableHead className="py-1">Memo No.</TableHead>
                                <TableHead className="py-1">Issued Date</TableHead>
                                <TableHead className="py-1">Type</TableHead>
                                <TableHead className="py-1">GL Target</TableHead>
                                <TableHead className="py-1 text-right">Amount</TableHead>
                                <TableHead className="py-1 text-right">Applied</TableHead>
                                <TableHead className="py-1 pr-2 text-right">Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredMemos.map((m) => (
                                <TableRow key={m.id}>
                                  <TableCell className="py-1.5 font-bold text-zinc-900 dark:text-zinc-100">{m.memo_number}</TableCell>
                                  <TableCell className="py-1.5">{formatDate(m.created_at)}</TableCell>
                                  <TableCell className="py-1.5">
                                    <Badge variant="outline" className={m.type === 1 ? "text-blue-600 border-blue-200 text-[9px] py-0 font-normal" : "text-amber-600 border-amber-200 text-[9px] py-0 font-normal"}>
                                      {m.type === 1 ? "Debit Memo" : "Credit Memo"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-1.5 font-mono text-[10px] max-w-[120px] truncate" title={m.chart_of_account?.account_title || ""}>
                                    {m.chart_of_account?.account_title || "—"}
                                  </TableCell>
                                  <TableCell className="py-1.5 text-right font-bold">{formatCurrency(m.amount)}</TableCell>
                                  <TableCell className="py-1.5 text-right text-muted-foreground">{m.applied_amount ? formatCurrency(m.applied_amount) : "—"}</TableCell>
                                  <TableCell className="py-1.5 text-right pr-2">
                                    <Badge variant="outline" className="text-[9px] py-0 border-zinc-200 font-normal">
                                      {m.status || "Approved"}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                    )}
                  </Card>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  </div>
</div>
  );
}
