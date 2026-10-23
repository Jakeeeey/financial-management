import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BalanceSheetFilterState,
  BalanceSheetSummary,
} from "../types/balance-sheet.schema";
import { BalanceSheetComparisonStatus, FinancialAccount, KeyRatios } from "../types";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "MEN2 MARKETING AND DISTRIBUTION ENTERPRISE CORPORATION";
const REPORT_TITLE = "STATEMENT OF FINANCIAL POSITION";
const PESO_NUMBER_FORMAT = '"₱"#,##0.00;[Red]-"₱"#,##0.00;"₱"0.00';
const dateFormatter = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const generatedAtFormatter = new Intl.DateTimeFormat("en-PH", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Manila",
});

export interface BalanceSheetExportData {
  accounts: FinancialAccount[];
  summary: BalanceSheetSummary;
  comparisonSummary: BalanceSheetSummary | null;
  comparisonStatus: BalanceSheetComparisonStatus;
  ratios: KeyRatios;
  filters: BalanceSheetFilterState;
}

const formatDate = (value: string) => dateFormatter.format(new Date(`${value}T00:00:00Z`));
const formatPhp = (value: number) => {
  const amount = Math.abs(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-PHP ${amount}` : `PHP ${amount}`;
};

const getMetadataRows = (filters: BalanceSheetFilterState, comparisonStatus: BalanceSheetComparisonStatus, generatedAt: Date): string[][] => [
  ["As of date", formatDate(filters.endDate)],
  ["Status", filters.status || "All statuses"],
  ["Division", filters.divisionName || "All divisions"],
  ["Department", filters.departmentName || "All departments"],
  [
    "Comparison as of",
    filters.includeComparison
      ? formatDate(filters.comparisonEndDate)
      : "Disabled",
  ],
  ...(filters.includeComparison ? [["Comparison data", comparisonStatus === "available" ? "Available" : "Comparison unavailable"]] : []),
  ["Currency", "Philippine peso (PHP)"],
  ["Generated at", `${generatedAtFormatter.format(generatedAt)} PHT`],
];

const getSummaryRows = (data: BalanceSheetExportData, includeComparison: boolean): (string | number)[][] => {
  const current = data.summary;
  const prior = data.comparisonSummary;
  const metrics: { label: string; current: number; prior: number | null }[] = [
    { label: "Total assets", current: current.totalAssets, prior: prior?.totalAssets ?? null },
    { label: "Total liabilities", current: current.totalLiabilities, prior: prior?.totalLiabilities ?? null },
    { label: "Total equity", current: current.totalEquity, prior: prior?.totalEquity ?? null },
    { label: "Balance difference", current: current.balanceVariance, prior: prior?.balanceVariance ?? null },
  ];

  return metrics.map(({ label, current: currentAmount, prior: priorAmount }) => {
    if (!includeComparison) return [label, currentAmount];
    if (data.comparisonStatus !== "available" || priorAmount === null) {
      return [label, currentAmount, "Comparison unavailable", "Comparison unavailable"];
    }
    return [label, currentAmount, priorAmount, currentAmount - priorAmount];
  });
};

const getRatioRows = (data: BalanceSheetExportData, includeComparison: boolean): (string | number)[][] => {
  const ratios = [
    ["Current ratio", data.ratios.currentRatio],
    ["Quick ratio", data.ratios.quickRatio],
    ["Debt to equity", data.ratios.debtToEquity],
    ["Debt ratio", data.ratios.debtRatio],
  ] as const;

  return ratios.map(([label, ratio]) => includeComparison
    ? data.comparisonStatus === "available" && ratio.prior !== null && ratio.variance !== null
      ? [label, ratio.current, ratio.prior, ratio.variance]
      : [label, ratio.current, "Comparison unavailable", "Comparison unavailable"]
    : [label, ratio.current]);
};

const getAccountRows = (accounts: FinancialAccount[], includeComparison: boolean): (string | number)[][] =>
  accounts.map(account => includeComparison
    ? [
      account.code,
      account.account,
      account.type,
      account.group,
      account.currentPeriod,
      account.currentBalanceStatus === "zero" ? "Zero balance" : "Reported",
      account.comparisonBalanceStatus === "unavailable" ? "Comparison unavailable" : account.priorPeriod ?? 0,
      account.comparisonBalanceStatus === "unavailable" ? "Comparison unavailable" : account.comparisonBalanceStatus === "zero" ? "Zero balance" : "Reported",
      account.variance ?? "Comparison unavailable",
      account.variancePercentage ?? "Comparison unavailable",
    ]
    : [account.code, account.account, account.type, account.group, account.currentPeriod, account.currentBalanceStatus === "zero" ? "Zero balance" : "Reported"]);

const getComparisonColumns = (filters: BalanceSheetFilterState) => filters.includeComparison
  ? [`As of ${formatDate(filters.endDate)}`, "Current Balance Status", `As of ${formatDate(filters.comparisonEndDate)}`, "Comparison Balance Status", "Variance", "Variance %"]
  : [`As of ${formatDate(filters.endDate)}`, "Balance Status"];

export const exportBalanceSheetToExcel = (data: BalanceSheetExportData) => {
  const generatedAt = new Date();
  const hasComparison = data.filters.includeComparison;
  const currentDateLabel = `As of ${formatDate(data.filters.endDate)}`;
  const comparisonDateLabel = `As of ${formatDate(data.filters.comparisonEndDate)}`;
  const summaryHeaders = hasComparison
    ? ["Metric", currentDateLabel, comparisonDateLabel, "Variance"]
    : ["Metric", currentDateLabel];
  const ratioHeaders = hasComparison
    ? ["Ratio", currentDateLabel, comparisonDateLabel, "Variance"]
    : ["Ratio", currentDateLabel];
  const accountHeaders = ["GL Code", "Account", "Type", "Group", ...getComparisonColumns(data.filters)];
  const metadataRows = [
    [COMPANY_NAME],
    [REPORT_TITLE],
    ...getMetadataRows(data.filters, data.comparisonStatus, generatedAt),
  ];
  const worksheetData: (string | number)[][] = [
    ...metadataRows,
    [],
    ["REPORT SUMMARY"],
    summaryHeaders,
    ...getSummaryRows(data, hasComparison),
    [],
    ["KEY RATIOS"],
    ratioHeaders,
    ...getRatioRows(data, hasComparison),
    [],
    ["ACCOUNT DETAILS"],
    accountHeaders,
    ...getAccountRows(data.accounts, hasComparison),
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  const accountHeaderRow = worksheetData.findIndex(row => row[0] === "GL Code");
  const summaryHeaderRow = worksheetData.findIndex(row => row[0] === "Metric");
  const ratioHeaderRow = worksheetData.findIndex(row => row[0] === "Ratio");

  for (let row = summaryHeaderRow + 1; row < summaryHeaderRow + 5; row++) {
    for (const column of hasComparison ? [1, 2, 3] : [1]) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && typeof cell.v === "number") cell.z = PESO_NUMBER_FORMAT;
    }
  }
  for (let row = ratioHeaderRow + 1; row < ratioHeaderRow + 5; row++) {
    for (const column of hasComparison ? [1, 2, 3] : [1]) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) cell.z = "0.00";
    }
  }
  for (let row = accountHeaderRow + 1; row < worksheetData.length; row++) {
    for (const column of hasComparison ? [4, 6, 8] : [4]) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell && typeof cell.v === "number") cell.z = PESO_NUMBER_FORMAT;
    }
    if (hasComparison) {
      const percentageCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 9 })];
      if (percentageCell) percentageCell.z = '0.0"%"';
    }
  }

  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 42 },
    { wch: 22 },
    { wch: 30 },
    ...Array.from({ length: hasComparison ? 6 : 2 }, () => ({ wch: 22 })),
  ];
  worksheet["!autofilter"] = {
    ref: XLSX.utils.encode_range({
      s: { r: accountHeaderRow, c: 0 },
      e: { r: worksheetData.length - 1, c: accountHeaders.length - 1 },
    }),
  };

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Financial Position");
  XLSX.writeFile(workbook, `Statement_of_Financial_Position_${generatedAt.toISOString().slice(0, 10)}.xlsx`);
};

export const exportBalanceSheetToPdf = (data: BalanceSheetExportData) => {
  const generatedAt = new Date();
  const hasComparison = data.filters.includeComparison;
  const currentDateLabel = `As of ${formatDate(data.filters.endDate)}`;
  const comparisonDateLabel = `As of ${formatDate(data.filters.comparisonEndDate)}`;
  const doc = new jsPDF("landscape", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(COMPANY_NAME, pageWidth / 2, 12, { align: "center" });
  doc.setFontSize(14);
  doc.text(REPORT_TITLE, pageWidth / 2, 19, { align: "center" });

  autoTable(doc, {
    startY: 23,
    body: getMetadataRows(data.filters, data.comparisonStatus, generatedAt),
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 38 } },
  });
  const metadataEnd = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: metadataEnd + 3,
    head: [hasComparison
      ? ["Report summary", currentDateLabel, comparisonDateLabel, "Variance"]
      : ["Report summary", currentDateLabel]],
    body: getSummaryRows(data, hasComparison).map(row => row.map((value, index) =>
      index === 0 || typeof value === "string" ? String(value) : formatPhp(value))),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 52 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });
  const summaryEnd = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: summaryEnd + 3,
    head: [hasComparison
      ? ["Key ratios", currentDateLabel, comparisonDateLabel, "Variance"]
      : ["Key ratios", currentDateLabel]],
    body: getRatioRows(data, hasComparison).map(row => row.map((value, index) =>
      index === 0 || typeof value === "string" ? String(value) : `${value.toFixed(2)}x`)),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 52 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });
  const ratiosEnd = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const accountHeaders = ["GL Code", "Account", "Type", "Group", ...getComparisonColumns(data.filters)];
  const accountRows = getAccountRows(data.accounts, hasComparison).map(row => row.map((value, index) => {
    if (index < 4 || typeof value === "string") return String(value);
    if (!hasComparison && index === 5) return String(value);
    if (hasComparison && index === 9) return typeof value === "number" ? `${value.toFixed(1)}%` : String(value);
    return formatPhp(Number(value));
  }));

  autoTable(doc, {
    startY: ratiosEnd + 5,
    head: [accountHeaders],
    body: accountRows.length > 0 ? accountRows : [["", "No account balances found", "", "", ...Array(hasComparison ? 6 : 2).fill("")]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    columnStyles: hasComparison
      ? { 0: { cellWidth: 18 }, 1: { cellWidth: 48 }, 2: { cellWidth: 22 }, 3: { cellWidth: 28 }, 4: { halign: "right" }, 5: { cellWidth: 25 }, 6: { halign: "right" }, 7: { cellWidth: 28 }, 8: { halign: "right" }, 9: { halign: "right" } }
      : { 0: { cellWidth: 24 }, 1: { cellWidth: 70 }, 2: { cellWidth: 28 }, 3: { cellWidth: 36 }, 4: { halign: "right" }, 5: { cellWidth: 28 } },
  });

  doc.save(`Statement_of_Financial_Position_${generatedAt.toISOString().slice(0, 10)}.pdf`);
};
