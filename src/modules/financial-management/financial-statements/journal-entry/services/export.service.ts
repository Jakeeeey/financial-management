import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { JournalEntryGroup } from "../types";
import { collectionReference } from "../utils/collection-reference";
import { formatJournalAmount } from "../utils/formatters";

const COMPANY_NAME = "MEN2 MARKETING AND DISTRIBUTION ENTERPRISE CORPORATION";
const REPORT_TITLE = "GENERAL JOURNAL";
const BASIS = "Accrual Basis";
const EXCEL_PHP_FORMAT = '"₱"#,##0.00;-"₱"#,##0.00;"₱"0.00';

type ExportRow = {
  cells: (string | number)[];
  kind: "detail" | "subtotal" | "total";
};

const roundMoney = (value: number) => Number(value.toFixed(2));
export const buildJournalExportData = (groups: JournalEntryGroup[], timeZone?: string): ExportRow[] => {
  const rows: ExportRow[] = [];
  const dateFormatter = timeZone ? new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }) : null;
  let totalDebit = 0;
  let totalCredit = 0;

  groups.forEach((group) => {
    const cpNumber = collectionReference(group);
    const reference = cpNumber ? `${group.jeNo}\nCP#: ${cpNumber}` : group.jeNo;
    let groupDebit = 0;
    let groupCredit = 0;
    const formattedDate = group.transactionDate ? dateFormatter ? dateFormatter.format(new Date(group.transactionDate)) : format(new Date(group.transactionDate), "yyyy-MM-dd") : "";

    group.entries.forEach((entry, index) => {
      groupDebit += entry.debit;
      groupCredit += entry.credit;

      rows.push({
        kind: "detail",
        cells: [
          index === 0 ? formattedDate : "",
          index === 0 ? group.sourceModule : "",
          index === 0 ? reference : "",
          entry.accountTitle || "N/A",
          group.sourceModule === "Collection"
            ? entry.description || group.description || "N/A"
            : index === 0 ? group.description || "N/A" : `- ${entry.accountTitle || "N/A"} distribution`,
          entry.debit,
          entry.credit,
          "",
        ],
      });
    });

    const roundedDebit = roundMoney(groupDebit);
    const roundedCredit = roundMoney(groupCredit);
    const difference = roundMoney(roundedDebit - roundedCredit);

    rows.push({
      kind: "subtotal",
      cells: ["", "", group.jeNo, "", "Journal subtotal", roundedDebit, roundedCredit, difference],
    });

    totalDebit = roundMoney(totalDebit + roundedDebit);
    totalCredit = roundMoney(totalCredit + roundedCredit);
  });

  rows.push({
    kind: "total",
    cells: ["TOTAL", "", "", "", "Grand total", totalDebit, totalCredit, roundMoney(totalDebit - totalCredit)],
  });

  return rows;
};

export const generateJournalExcel = (
  groups: JournalEntryGroup[],
  dateRangeText: string,
  activeFilters?: string[],
  timeZone?: string,
) => {
  const filterRows = activeFilters === undefined
    ? []
    : activeFilters.length > 0
      ? [["Applied filters:"], ...activeFilters.map((filter) => [`- ${filter}`])]
      : [["Applied filters: None"]];
  const rowCount = 7 + filterRows.length + groups.reduce((count, group) => count + group.entries.length + 1, 0);
  if (rowCount > 1048576) throw new Error("The export exceeds Excel's row limit. Please narrow the reporting date range.");
  const exportRows = buildJournalExportData(groups, timeZone);
  const worksheetData = [
    [COMPANY_NAME],
    [REPORT_TITLE],
    [activeFilters === undefined ? dateRangeText : `Reporting period: ${dateRangeText}`],
    [BASIS],
    ...filterRows,
    [],
    ["Transaction Date", "Type", "Ref No. / JE No.", "Account Title", "Description", "Debit", "Credit", "Debit–Credit Difference"],
    ...exportRows.map((row) => row.cells),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
  // Keep the CP reference's second line visible when the workbook is opened.
  worksheet["!rows"] = worksheetData.map(row => typeof row[2] === "string" && row[2].includes("\n") ? { hpt: 30 } : {});
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
    ...filterRows.map((_, index) => ({ s: { r: 4 + index, c: 0 }, e: { r: 4 + index, c: 7 } })),
  ];

  worksheet["!cols"] = [
    { wch: 15 },
    { wch: 12 },
    { wch: 20 },
    { wch: 35 },
    { wch: 45 },
    { wch: 18 },
    { wch: 18 },
    { wch: 27 },
  ];

  const firstDataRowIndex = 6 + filterRows.length;
  for (let rowIndex = firstDataRowIndex; rowIndex < worksheetData.length; rowIndex += 1) {
    for (let columnIndex = 5; columnIndex <= 7; columnIndex += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
      if (cell && typeof cell.v === "number") cell.z = EXCEL_PHP_FORMAT;
    }
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "General Journal");
  return new Uint8Array(XLSX.write(workbook, { type: typeof window === "undefined" ? "buffer" : "array", bookType: "xlsx", compression: true }));
};

export const generateJournalPdf = (
  groups: JournalEntryGroup[],
  dateRangeText: string,
  activeFilters?: string[],
  timeZone?: string,
) => {
  const doc = new jsPDF({ orientation: "landscape", compress: true });
  const exportRows = buildJournalExportData(groups, timeZone);
  const filterSummary = activeFilters?.length ? activeFilters.join(" | ") : "None";
  const formattedRows = exportRows.map(({ cells }) =>
    cells.map((cell, index) => (index >= 5 && typeof cell === "number" ? formatJournalAmount(cell).replace("₱", "PHP ") : cell))
  );

  const pageWidth = doc.internal.pageSize.width;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY_NAME, pageWidth / 2, 14, { align: "center" });

  doc.setFontSize(12);
  doc.text(REPORT_TITLE, pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(activeFilters === undefined ? dateRangeText : `Reporting period: ${dateRangeText}`, pageWidth / 2, 26, { align: "center" });
  doc.text(BASIS, pageWidth / 2, 32, { align: "center" });

  let tableStartY = 40;
  if (activeFilters !== undefined) {
    const filterLines = doc.splitTextToSize(`Applied filters: ${filterSummary}`, pageWidth - 28);
    doc.setFontSize(8);
    doc.text(filterLines, 14, 38);
    tableStartY = 38 + filterLines.length * 4 + 3;
  }

  autoTable(doc, {
    startY: tableStartY,
    margin: { left: 14, right: 14 },
    head: [["Transaction Date", "Type", "Ref No. / JE No.", "Account Title", "Description", "Debit", "Credit", "Debit–Credit Difference"]],
    body: formattedRows,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 3,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 24 },
      1: { cellWidth: 23 },
      2: { cellWidth: 33 },
      3: { cellWidth: 50 },
      4: { cellWidth: 55 },
      5: { halign: "right", cellWidth: 27 },
      6: { halign: "right", cellWidth: 27 },
      7: { halign: "right", cellWidth: 30 },
    },
    didParseCell(data) {
      const rowKind = exportRows[data.row.index]?.kind;
      if (rowKind === "subtotal" || rowKind === "total") {
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  return new Uint8Array(doc.output("arraybuffer"));
};

function downloadJournal(bytes: Uint8Array, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function exportJournalToExcel(groups: JournalEntryGroup[], dateRangeText: string, filename = "Journal_Entries.xlsx", activeFilters?: string[]) {
  downloadJournal(generateJournalExcel(groups, dateRangeText, activeFilters), filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

export function exportJournalToPdf(groups: JournalEntryGroup[], dateRangeText: string, filename = "Journal_Entries.pdf", activeFilters?: string[]) {
  downloadJournal(generateJournalPdf(groups, dateRangeText, activeFilters), filename, "application/pdf");
}
