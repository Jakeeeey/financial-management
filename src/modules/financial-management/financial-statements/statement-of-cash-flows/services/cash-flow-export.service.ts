import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  CashFlowActivityFilter,
  CashFlowEntry,
  CashFlowSortField,
  CashFlowSortOrder,
  GroupedCashFlowEntries,
} from "../types/cash-flow.schema";
import {
  calculateCashFlowSummary,
  groupCashFlowEntries,
} from "./cash-flow.service";
import {
  filterCashFlowEntries,
  flattenCashFlowEntries,
  sortCashFlowEntries,
} from "../utils/transaction-view";
import { formatCashFlowDate } from "../utils/reporting-dates";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "MEN2 MARKETING AND DISTRIBUTION ENTERPRISE CORPORATION";
const EXCEL_PESO_FORMAT = "₱#,##0.00;-₱#,##0.00;₱0.00";

export type CashFlowExportScope = "statement" | "transactions";
export type CashFlowExportFormat = "pdf" | "excel";

export interface CashFlowExportContext {
  entries: CashFlowEntry[];
  startDate: string;
  endDate: string;
  search: string;
  activity: CashFlowActivityFilter;
  sortField: CashFlowSortField;
  sortOrder: CashFlowSortOrder;
  generatedAt: Date;
}

export interface CashFlowExportSummaryRow {
  label: string;
  value: string | number;
  kind: "amount" | "count" | "text";
}

export interface PreparedCashFlowExport {
  scope: CashFlowExportScope;
  entries: CashFlowEntry[];
  groups: GroupedCashFlowEntries;
  summary: ReturnType<typeof calculateCashFlowSummary>;
  metadataRows: Array<[string, string | number]>;
  summaryRows: CashFlowExportSummaryRow[];
  headers: string[];
  tableRows: Array<Array<string | number>>;
}

const generatedAtFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

const transactionDateFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeZone: "Asia/Manila",
});

function formatPhp(value: number) {
  const amount = Math.abs(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-PHP ${amount}` : `PHP ${amount}`;
}

function formatGeneratedAt(value: Date) {
  return `${generatedAtFormatter.format(value)} PHT`;
}

function formatTransactionDate(value: string | null | undefined) {
  if (!value) return "Date not provided";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : transactionDateFormatter.format(date);
}

function formatActivity(activity: CashFlowActivityFilter) {
  if (activity === "all") return "All activities";
  if (activity === "uncategorized") return "Uncategorized";
  return `${activity[0].toUpperCase()}${activity.slice(1)}`;
}

function getExportEntries(scope: CashFlowExportScope, context: CashFlowExportContext) {
  if (scope === "statement") return [...context.entries];

  const reportOrder = flattenCashFlowEntries(groupCashFlowEntries(context.entries));
  const filtered = filterCashFlowEntries(reportOrder, context.search, context.activity);
  return sortCashFlowEntries(filtered, context.sortField, context.sortOrder);
}

function buildMetadataRows(
  scope: CashFlowExportScope,
  context: CashFlowExportContext,
  recordCount: number,
): Array<[string, string | number]> {
  const search = context.search.trim() || "None";
  const activity = formatActivity(context.activity);
  return [
    ["Export scope", scope === "statement" ? "Full applied-period statement" : "All matching transactions across pages"],
    ["Reporting period", `${formatCashFlowDate(context.startDate)} to ${formatCashFlowDate(context.endDate)}`],
    ["Transaction activity filter", activity],
    ["Transaction search", search],
    ["Transaction sort", `${context.sortField} (${context.sortOrder})`],
    [
      "Filter scope note",
      scope === "statement"
        ? "Search and activity filters are listed for context only; they do not narrow the full statement."
        : `All transactions matching ${activity} and the search criterion are included; pagination does not limit this export.`,
    ],
    ["Reporting method", "Not disclosed in report data"],
    ["Cash-account scope", "Not disclosed in report data"],
    ["Transaction-status scope", "Not disclosed in report data"],
    ["Source-module coverage", "Not disclosed in report data"],
    ["Currency", "PHP — Philippine peso"],
    ["Record count", recordCount],
    ["Generated at", formatGeneratedAt(context.generatedAt)],
  ];
}

function buildStatementSummaryRows(summary: ReturnType<typeof calculateCashFlowSummary>): CashFlowExportSummaryRow[] {
  return [
    { label: "Operating activities", value: summary.operatingActivities, kind: "amount" },
    { label: "Investing activities", value: summary.investingActivities, kind: "amount" },
    { label: "Financing activities", value: summary.financingActivities, kind: "amount" },
    { label: "Net Change in Cash (Operating + Investing + Financing)", value: summary.netIncreaseInCash, kind: "amount" },
    { label: "Uncategorized transaction count", value: summary.uncategorizedCount, kind: "count" },
    { label: "All-register movement", value: summary.registerNetMovement, kind: "amount" },
    { label: "Difference from all-register movement", value: summary.reconciliationDifference, kind: "amount" },
    { label: "Opening cash and cash equivalents", value: "Not available", kind: "text" },
    { label: "Closing cash and cash equivalents", value: "Not available", kind: "text" },
  ];
}

function buildStatementRows(
  groups: GroupedCashFlowEntries,
  summary: ReturnType<typeof calculateCashFlowSummary>,
): Array<Array<string | number>> {
  const sections = [
    { key: "operating", title: "Operating activities", entries: groups.operating, total: summary.operatingActivities },
    { key: "investing", title: "Investing activities", entries: groups.investing, total: summary.investingActivities },
    { key: "financing", title: "Financing activities", entries: groups.financing, total: summary.financingActivities },
    { key: "other", title: "Uncategorized transactions", entries: groups.other, total: summary.uncategorizedNetMovement },
  ] as const;

  const rows: Array<Array<string | number>> = [];
  for (const section of sections) {
    rows.push([`${section.title} (${section.entries.length})`, "", "", ""]);
    for (const entry of section.entries) {
      rows.push([
        entry.transactionRef?.trim() || "Transaction reference not provided",
        entry.cashFlowActivity?.trim() || "Not provided",
        formatTransactionDate(entry.transactionDate),
        entry.netCashFlow == null ? "Not provided" : entry.netCashFlow,
      ]);
    }
    rows.push([
      section.key === "other" ? "Uncategorized subtotal (excluded from Net Change in Cash)" : `${section.title} subtotal`,
      "",
      "",
      section.total,
    ]);
  }

  rows.push(["Net Change in Cash (Operating + Investing + Financing)", "", "", summary.netIncreaseInCash]);
  rows.push(["Difference from all-register movement", "", "", summary.reconciliationDifference]);
  return rows;
}

export function prepareCashFlowExport(
  scope: CashFlowExportScope,
  context: CashFlowExportContext,
): PreparedCashFlowExport {
  const entries = getExportEntries(scope, context);
  const groups = groupCashFlowEntries(entries);
  const summary = calculateCashFlowSummary(entries);
  const summaryRows = scope === "statement"
    ? buildStatementSummaryRows(summary)
    : [
      { label: "Matching transaction count", value: entries.length, kind: "count" as const },
      { label: "Filtered transaction net movement", value: summary.registerNetMovement, kind: "amount" as const },
    ];

  return {
    scope,
    entries,
    groups,
    summary,
    metadataRows: buildMetadataRows(scope, context, entries.length),
    summaryRows,
    headers: ["Reference / activity line", "Activity", "Transaction date", "Net cash movement (PHP)"],
    tableRows: scope === "statement" ? buildStatementRows(groups, summary) : entries.map(entry => [
      entry.transactionRef?.trim() || "Transaction reference not provided",
      entry.cashFlowActivity?.trim() || "Uncategorized",
      formatTransactionDate(entry.transactionDate),
      entry.netCashFlow == null ? "Not provided" : entry.netCashFlow,
    ]),
  };
}

export function buildCashFlowExcelWorksheet(
  scope: CashFlowExportScope,
  context: CashFlowExportContext,
) {
  const prepared = prepareCashFlowExport(scope, context);
  const worksheetData: Array<Array<string | number>> = [
    [COMPANY_NAME],
    [scope === "statement" ? "STATEMENT OF CASH FLOWS" : "CASH FLOW TRANSACTIONS"],
    ...prepared.metadataRows,
    [],
    [scope === "statement" ? "STATEMENT TOTALS" : "FILTERED TRANSACTION TOTALS"],
    ["Metric", "Value"],
    ...prepared.summaryRows.map(row => [row.label, row.value]),
    [],
    prepared.headers,
    ...prepared.tableRows,
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const summaryHeaderRow = worksheetData.findIndex(row => row[0] === "Metric");
  const detailHeaderRow = worksheetData.findIndex(row => row[0] === prepared.headers[0]);

  prepared.summaryRows.forEach((row, index) => {
    if (row.kind !== "amount") return;
    const cell = worksheet[XLSX.utils.encode_cell({ r: summaryHeaderRow + index + 1, c: 1 })];
    if (cell?.t === "n") cell.z = EXCEL_PESO_FORMAT;
  });

  for (let row = detailHeaderRow + 1; row < worksheetData.length; row += 1) {
    const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: 3 })];
    if (cell?.t === "n") cell.z = EXCEL_PESO_FORMAT;
  }

  worksheet["!cols"] = [{ wch: 42 }, { wch: 24 }, { wch: 22 }, { wch: 26 }];
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: detailHeaderRow, c: 0 },
      e: { r: worksheetData.length - 1, c: prepared.headers.length - 1 },
    }),
  };
  return worksheet;
}

function getManilaDateKey(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Manila",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value ?? "00";
  return `${part("year")}${part("month")}${part("day")}`;
}

function getFileName(scope: CashFlowExportScope, format: CashFlowExportFormat, generatedAt: Date) {
  const name = scope === "statement" ? "Cash_Flow_Statement" : "Cash_Flow_Filtered_Transactions";
  return `${name}_${getManilaDateKey(generatedAt)}.${format === "pdf" ? "pdf" : "xlsx"}`;
}

export function exportCashFlowToExcel(scope: CashFlowExportScope, context: CashFlowExportContext) {
  const worksheet = buildCashFlowExcelWorksheet(scope, context);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, scope === "statement" ? "Statement" : "Transactions");
  XLSX.writeFile(workbook, getFileName(scope, "excel", context.generatedAt));
}

export function exportCashFlowToPdf(scope: CashFlowExportScope, context: CashFlowExportContext) {
  const prepared = prepareCashFlowExport(scope, context);
  const doc = new jsPDF("landscape", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  const title = scope === "statement" ? "STATEMENT OF CASH FLOWS" : "CASH FLOW TRANSACTIONS";

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(COMPANY_NAME, pageWidth / 2, 12, { align: "center" });
  doc.setFontSize(14);
  doc.text(title, pageWidth / 2, 19, { align: "center" });

  autoTable(doc, {
    startY: 23,
    body: prepared.metadataRows.map(([label, value]) => [label, String(value)]),
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1, overflow: "linebreak" },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 48 } },
  });
  const metadataEnd = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: metadataEnd + 3,
    head: [[scope === "statement" ? "Statement totals" : "Filtered transaction totals", "Value"]],
    body: prepared.summaryRows.map(row => [
      row.label,
      row.kind === "amount" ? formatPhp(Number(row.value)) : String(row.value),
    ]),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5, overflow: "linebreak" },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 85 }, 1: { halign: "right" } },
  });
  const totalsEnd = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const formattedRows = prepared.tableRows.length > 0
    ? prepared.tableRows.map(row => row.map((value, index) => index === 3 && typeof value === "number" ? formatPhp(value) : String(value)))
    : [["No transactions matched the export criteria.", "", "", ""]];

  autoTable(doc, {
    startY: totalsEnd + 4,
    head: [prepared.headers],
    body: formattedRows,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    columnStyles: { 0: { cellWidth: 75 }, 1: { cellWidth: 35 }, 2: { cellWidth: 32 }, 3: { halign: "right", cellWidth: 40 } },
  });

  doc.save(getFileName(scope, "pdf", context.generatedAt));
}
