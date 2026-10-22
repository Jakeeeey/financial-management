import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  BalanceSheetFilterState,
  BalanceSheetSummary,
} from "../types/balance-sheet.schema";
import { FinancialAccount, KeyRatios } from "../types";

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
  ratios: KeyRatios;
  filters: BalanceSheetFilterState;
}

const formatDate = (value: string) => dateFormatter.format(new Date(`${value}T00:00:00Z`));
const formatPeriod = (startDate: string, endDate: string) => `${formatDate(startDate)} to ${formatDate(endDate)}`;

const formatPhp = (value: number) => {
  const amount = Math.abs(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return value < 0 ? `-PHP ${amount}` : `PHP ${amount}`;
};

const getMetadataRows = (filters: BalanceSheetFilterState, generatedAt: Date): string[][] => [
  ["Reporting period", formatPeriod(filters.startDate, filters.endDate)],
  ["Status", filters.status || "All statuses"],
  ["Division", filters.divisionName || "All divisions"],
  ["Department", filters.departmentName || "All departments"],
  [
    "Comparison period",
    filters.includeComparison
      ? formatPeriod(filters.comparisonStartDate, filters.comparisonEndDate)
      : "Disabled",
  ],
  ["Currency", "Philippine peso (PHP)"],
  ["Generated at", `${generatedAtFormatter.format(generatedAt)} PHT`],
];

const getSummaryRows = (data: BalanceSheetExportData, includeComparison: boolean): (string | number)[][] => {
  const current = data.summary;
  const prior = data.comparisonSummary;
  const metrics: { label: string; current: number; prior: number }[] = [
    { label: "Total assets", current: current.totalAssets, prior: prior?.totalAssets ?? 0 },
    { label: "Total liabilities", current: current.totalLiabilities, prior: prior?.totalLiabilities ?? 0 },
    { label: "Total equity", current: current.totalEquity, prior: prior?.totalEquity ?? 0 },
    { label: "Balance difference", current: current.balanceVariance, prior: prior?.balanceVariance ?? 0 },
  ];

  return metrics.map(({ label, current: currentAmount, prior: priorAmount }) => includeComparison
    ? [label, currentAmount, priorAmount, currentAmount - priorAmount]
    : [label, currentAmount]);
};

const getRatioRows = (data: BalanceSheetExportData, includeComparison: boolean): (string | number)[][] => {
  const ratios = [
    ["Current ratio", data.ratios.currentRatio],
    ["Quick ratio", data.ratios.quickRatio],
    ["Debt to equity", data.ratios.debtToEquity],
    ["Debt ratio", data.ratios.debtRatio],
  ] as const;

  return ratios.map(([label, ratio]) => includeComparison
    ? [label, ratio.current, ratio.prior, ratio.variance]
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
      account.priorPeriod,
      account.variance,
      account.variancePercentage,
    ]
    : [account.code, account.account, account.type, account.group, account.currentPeriod]);

const getComparisonColumns = (enabled: boolean) => enabled
  ? ["Current Period", "Comparison Period", "Variance", "Variance %"]
  : ["Current Period"];

export const exportBalanceSheetToExcel = (data: BalanceSheetExportData) => {
  const generatedAt = new Date();
  const hasComparison = data.filters.includeComparison && data.comparisonSummary !== null;
  const summaryHeaders = hasComparison
    ? ["Metric", "Current Period", "Comparison Period", "Variance"]
    : ["Metric", "Current Period"];
  const ratioHeaders = hasComparison
    ? ["Ratio", "Current Period", "Comparison Period", "Variance"]
    : ["Ratio", "Current Period"];
  const accountHeaders = ["GL Code", "Account", "Type", "Group", ...getComparisonColumns(hasComparison)];
  const metadataRows = [
    [COMPANY_NAME],
    [REPORT_TITLE],
    ...getMetadataRows(data.filters, generatedAt),
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
      if (cell) cell.z = PESO_NUMBER_FORMAT;
    }
  }
  for (let row = ratioHeaderRow + 1; row < ratioHeaderRow + 5; row++) {
    for (const column of hasComparison ? [1, 2, 3] : [1]) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) cell.z = "0.00";
    }
  }
  for (let row = accountHeaderRow + 1; row < worksheetData.length; row++) {
    for (const column of hasComparison ? [4, 5, 6] : [4]) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: row, c: column })];
      if (cell) cell.z = PESO_NUMBER_FORMAT;
    }
    if (hasComparison) {
      const percentageCell = worksheet[XLSX.utils.encode_cell({ r: row, c: 7 })];
      if (percentageCell) percentageCell.z = '0.0"%"';
    }
  }

  worksheet["!cols"] = [
    { wch: 22 },
    { wch: 42 },
    { wch: 22 },
    { wch: 30 },
    ...Array.from({ length: hasComparison ? 4 : 1 }, () => ({ wch: 22 })),
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
  const hasComparison = data.filters.includeComparison && data.comparisonSummary !== null;
  const doc = new jsPDF("landscape", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(COMPANY_NAME, pageWidth / 2, 12, { align: "center" });
  doc.setFontSize(14);
  doc.text(REPORT_TITLE, pageWidth / 2, 19, { align: "center" });

  autoTable(doc, {
    startY: 23,
    body: getMetadataRows(data.filters, generatedAt),
    theme: "plain",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 38 } },
  });
  const metadataEnd = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: metadataEnd + 3,
    head: [hasComparison
      ? ["Report summary", "Current period", "Comparison period", "Variance"]
      : ["Report summary", "Current period"]],
    body: getSummaryRows(data, hasComparison).map(row => row.map((value, index) =>
      index === 0 ? String(value) : formatPhp(Number(value)))),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 52 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });
  const summaryEnd = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  autoTable(doc, {
    startY: summaryEnd + 3,
    head: [hasComparison
      ? ["Key ratios", "Current period", "Comparison period", "Variance"]
      : ["Key ratios", "Current period"]],
    body: getRatioRows(data, hasComparison).map(row => row.map((value, index) =>
      index === 0 ? String(value) : `${Number(value).toFixed(2)}x`)),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 52 }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });
  const ratiosEnd = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const accountHeaders = ["GL Code", "Account", "Type", "Group", ...getComparisonColumns(hasComparison)];
  const accountRows = getAccountRows(data.accounts, hasComparison).map(row => row.map((value, index) => {
    if (index === 0 || (index >= 1 && index <= 3)) return String(value);
    if (hasComparison && index === 7) return `${Number(value).toFixed(1)}%`;
    return formatPhp(Number(value));
  }));

  autoTable(doc, {
    startY: ratiosEnd + 5,
    head: [accountHeaders],
    body: accountRows.length > 0 ? accountRows : [["", "No account balances found", "", "", ...Array(hasComparison ? 4 : 1).fill("")]],
    theme: "grid",
    styles: { font: "helvetica", fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" },
    columnStyles: hasComparison
      ? { 0: { cellWidth: 20 }, 1: { cellWidth: 62 }, 2: { cellWidth: 28 }, 3: { cellWidth: 35 }, 4: { halign: "right" }, 5: { halign: "right" }, 6: { halign: "right" }, 7: { halign: "right" } }
      : { 0: { cellWidth: 24 }, 1: { cellWidth: 78 }, 2: { cellWidth: 32 }, 3: { cellWidth: 40 }, 4: { halign: "right" } },
  });

  doc.save(`Statement_of_Financial_Position_${generatedAt.toISOString().slice(0, 10)}.pdf`);
};
