import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { JournalEntryGroup } from "../types";
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
export const buildJournalExportData = (groups: JournalEntryGroup[]): ExportRow[] => {
  const rows: ExportRow[] = [];
  let totalDebit = 0;
  let totalCredit = 0;

  groups.forEach((group) => {
    let groupDebit = 0;
    let groupCredit = 0;
    const formattedDate = group.transactionDate ? format(new Date(group.transactionDate), "yyyy-MM-dd") : "";

    group.entries.forEach((entry, index) => {
      groupDebit += entry.debit;
      groupCredit += entry.credit;

      rows.push({
        kind: "detail",
        cells: [
          index === 0 ? formattedDate : "",
          index === 0 ? group.sourceModule : "",
          index === 0 ? group.jeNo : "",
          entry.accountTitle || "N/A",
          index === 0 ? group.description || "N/A" : `- ${entry.accountTitle || "N/A"} distribution`,
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

export const exportJournalToExcel = (
  groups: JournalEntryGroup[],
  dateRangeText: string,
  filename: string = "Journal_Entries.xlsx",
  activeFilters?: string[]
) => {
  const exportRows = buildJournalExportData(groups);
  const filterRows = activeFilters === undefined
    ? []
    : activeFilters.length > 0
      ? [["Applied filters:"], ...activeFilters.map((filter) => [`- ${filter}`])]
      : [["Applied filters: None"]];
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
  XLSX.writeFile(workbook, filename);
};

export const exportJournalToPdf = (
  groups: JournalEntryGroup[],
  dateRangeText: string,
  filename: string = "Journal_Entries.pdf",
  activeFilters?: string[]
) => {
  const doc = new jsPDF("landscape");
  const exportRows = buildJournalExportData(groups);
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

  doc.save(filename);
};
