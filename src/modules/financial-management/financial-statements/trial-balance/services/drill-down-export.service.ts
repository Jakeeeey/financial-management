import * as XLSX from "xlsx";
import { format } from "date-fns";
import { TrialBalanceDrillDownItem } from "../types/trial-balance.schema";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "MEN2 MARKETING AND DISTRIBUTION ENTERPRISE CORPORATION";

const formatNumber = (val: number) => {
  if (val === 0) return "0.00";
  return new Intl.NumberFormat("en-PH", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const round = (val: number): number => {
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

interface DrillDownExportOptions {
  items: TrialBalanceDrillDownItem[];
  glCode: string;
  accountTitle: string;
  startDate: string;
  endDate: string;
}

const buildRows = (items: TrialBalanceDrillDownItem[]) => {
  let totalDebit = 0;
  let totalCredit = 0;

  const rows = items.map((item) => {
    const debit = Number(item.debit || 0);
    const credit = Number(item.credit || 0);
    totalDebit = round(totalDebit + debit);
    totalCredit = round(totalCredit + credit);

    return [
      item.journalEntryId || "",
      item.date ? format(new Date(item.date), "yyyy-MM-dd") : "",
      item.description || "",
      debit,
      credit,
      item.source || "",
      item.postedBy ?? "",
    ];
  });

  rows.push(["TOTAL", "", "", totalDebit, totalCredit, "", ""]);
  return rows;
};

const HEADERS = ["Journal ID", "Date", "Description", "Debit", "Credit", "Source", "Posted By"];

export const exportDrillDownToExcel = (opts: DrillDownExportOptions) => {
  const { items, glCode, accountTitle, startDate, endDate } = opts;
  const dateRangeText = `${format(new Date(startDate), "MMM d, yyyy")} to ${format(new Date(endDate), "MMM d, yyyy")}`;
  const rows = buildRows(items);

  const worksheetData = [
    [COMPANY_NAME],
    [`TRIAL BALANCE DRILL DOWN — ${glCode} ${accountTitle}`],
    [dateRangeText],
    [],
    HEADERS,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
  ];

  ws["!cols"] = [
    { wch: 18 }, // Journal ID
    { wch: 14 }, // Date
    { wch: 40 }, // Description
    { wch: 16 }, // Debit
    { wch: 16 }, // Credit
    { wch: 16 }, // Source
    { wch: 16 }, // Posted By
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Drill Down");
  XLSX.writeFile(wb, `DrillDown_${glCode}_${format(new Date(), "yyyyMMdd")}.xlsx`);
};

export const exportDrillDownToCSV = (opts: DrillDownExportOptions) => {
  const { items, glCode, startDate, endDate } = opts;

  const csvRows: string[] = [];
  csvRows.push(HEADERS.join(","));

  items.forEach((item) => {
    const debit = Number(item.debit || 0);
    const credit = Number(item.credit || 0);
    const row = [
      `"${item.journalEntryId || ""}"`,
      `"${item.date ? format(new Date(item.date), "yyyy-MM-dd") : ""}"`,
      `"${(item.description || "").replace(/"/g, '""')}"`,
      formatNumber(debit),
      formatNumber(credit),
      `"${item.source || ""}"`,
      `"${item.postedBy ?? ""}"`,
    ];
    csvRows.push(row.join(","));
  });

  // Add totals
  let totalDebit = 0;
  let totalCredit = 0;
  items.forEach((item) => {
    totalDebit = round(totalDebit + Number(item.debit || 0));
    totalCredit = round(totalCredit + Number(item.credit || 0));
  });
  csvRows.push(`"TOTAL","","",${formatNumber(totalDebit)},${formatNumber(totalCredit)},"",""`);

  const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `DrillDown_${glCode}_${format(new Date(), "yyyyMMdd")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
