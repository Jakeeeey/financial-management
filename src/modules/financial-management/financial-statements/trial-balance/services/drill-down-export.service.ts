import * as XLSX from "xlsx";
import { format } from "date-fns";
import { TrialBalanceDrillDownItem } from "../types/trial-balance.schema";
import { PERIOD_ACTIVITY_NOTE, PESO_NUMBER_FORMAT } from "../utils/money";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "MEN2 MARKETING AND DISTRIBUTION ENTERPRISE CORPORATION";

interface DrillDownExportOptions {
  items: TrialBalanceDrillDownItem[];
  glCode: string;
  accountTitle: string;
  startDate: string;
  endDate: string;
}

const buildRows = (items: TrialBalanceDrillDownItem[]) => {
  let totalDebitCentavos = 0;
  let totalCreditCentavos = 0;

  const rows = items.map((item) => {
    const debit = Number(item.debit ?? 0);
    const credit = Number(item.credit ?? 0);
    totalDebitCentavos += Math.round(debit * 100);
    totalCreditCentavos += Math.round(credit * 100);

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

  rows.push(["TOTAL", "", "", totalDebitCentavos / 100, totalCreditCentavos / 100, "", ""]);
  return rows;
};

const HEADERS = ["Journal ID", "Date", "Description", "Debit amount (PHP)", "Credit amount (PHP)", "Source", "Posted By"];

const buildWorksheet = (opts: DrillDownExportOptions, numberFormat: string) => {
  const { items, glCode, accountTitle, startDate, endDate } = opts;
  const dateRangeText = `${format(new Date(startDate), "MMM d, yyyy")} to ${format(new Date(endDate), "MMM d, yyyy")}`;
  const rows = buildRows(items);

  const worksheetData = [
    [COMPANY_NAME],
    [`TRIAL BALANCE DRILL DOWN — ${glCode} ${accountTitle}`],
    [dateRangeText],
    [PERIOD_ACTIVITY_NOTE],
    [],
    HEADERS,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } },
  ];
  const headerRow = worksheetData.findIndex(row => row[0] === "Journal ID");
  for (let row = headerRow + 1; row < worksheetData.length; row++) {
    for (const column of [3, 4]) ws[XLSX.utils.encode_cell({ r: row, c: column })].z = numberFormat;
  }

  ws["!cols"] = [
    { wch: 18 }, // Journal ID
    { wch: 14 }, // Date
    { wch: 40 }, // Description
    { wch: 24 }, // Debit amount
    { wch: 24 }, // Credit amount
    { wch: 16 }, // Source
    { wch: 16 }, // Posted By
  ];
  return ws;
};

export const exportDrillDownToExcel = (opts: DrillDownExportOptions) => {
  const ws = buildWorksheet(opts, PESO_NUMBER_FORMAT);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Drill Down");
  XLSX.writeFile(wb, `DrillDown_${opts.glCode}_${format(new Date(), "yyyyMMdd")}.xlsx`);
};

export const exportDrillDownToCSV = (opts: DrillDownExportOptions) => {
  const ws = buildWorksheet(opts, "0.00");
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `DrillDown_${opts.glCode}_${format(new Date(), "yyyyMMdd")}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};
