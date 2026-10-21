import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { TrialBalanceItem, TrialBalanceReportContext } from "../types/trial-balance.schema";
import { getTrialBalanceReportLabels } from "../utils/filter-state";
import { calculateTrialBalanceSummary } from "../utils/summary";
import { formatTrialBalanceAmount, PERIOD_ACTIVITY_NOTE, PESO_NUMBER_FORMAT } from "../utils/money";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "MEN2 MARKETING AND DISTRIBUTION ENTERPRISE CORPORATION";
const REPORT_TITLE = "TRIAL BALANCE";
const BASIS = "Accrual Basis";

let pdfFonts: Promise<string[]> | undefined;

async function registerPdfFonts(doc: jsPDF) {
  pdfFonts ??= Promise.all(["Regular", "Bold"].map(async weight => {
    const response = await fetch(`/fonts/noto-sans/NotoSans-${weight}.ttf`);
    if (!response.ok) throw new Error("The PDF font could not be loaded. Please try again.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
    }
    return btoa(binary);
  })).catch(error => {
    pdfFonts = undefined;
    throw error;
  });

  const [regular, bold] = await pdfFonts;
  for (const [style, font] of [["normal", regular], ["bold", bold]]) {
    doc.addFileToVFS(`NotoSans-${style}.ttf`, font);
    doc.addFont(`NotoSans-${style}.ttf`, "NotoSans", style);
  }
}

/**
 * Build a flat list of export rows — no grouping, no subtotals, no net balance.
 * Only: Code | Account Title | Period debit activity | Period credit activity
 * Plus a GRAND TOTAL row at the bottom.
 */
const buildExportRows = (items: TrialBalanceItem[]) => {
  const totals = calculateTrialBalanceSummary(items, null);

  const rows: (string | number)[][] = items.map(item => {
    return [
      item.glCode,
      item.accountTitle,
      item.totalDebit,
      item.totalCredit,
    ];
  });

  // Grand Total Row
  rows.push([
    "GRAND TOTAL",
    "",
    totals.totalDebit,
    totals.totalCredit,
  ]);

  return rows;
};

export const exportTrialBalanceToExcel = (items: TrialBalanceItem[], context: TrialBalanceReportContext) => {
  const { startDate, endDate } = context;
  const dateRangeText = `${format(new Date(startDate), "MMM d, yyyy")} to ${format(new Date(endDate), "MMM d, yyyy")}`;
  const rows = buildExportRows(items);

  const worksheetData = [
    [COMPANY_NAME],
    [REPORT_TITLE],
    [dateRangeText],
    [BASIS],
    [PERIOD_ACTIVITY_NOTE],
    ...getTrialBalanceReportLabels(context).flatMap(label => (label.match(/.{1,100}/gu) || [label]).map(line => [line])),
    [],
    ["Code", "Account Title", "Period debit activity", "Period credit activity"],
    ...rows
  ];

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Styling and Merging
  const headerRow = worksheetData.findIndex(row => row[0] === "Code");
  ws["!merges"] = Array.from({ length: headerRow - 1 }, (_, row) => ({ s: { r: row, c: 0 }, e: { r: row, c: 3 } }));
  for (let row = headerRow + 1; row < worksheetData.length; row++) {
    for (const column of [2, 3]) ws[XLSX.utils.encode_cell({ r: row, c: column })].z = PESO_NUMBER_FORMAT;
  }

  ws["!cols"] = [
    { wch: 15 }, // Code
    { wch: 45 }, // Account Title
    { wch: 26 }, // Period debit activity
    { wch: 26 }, // Period credit activity
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
  XLSX.writeFile(wb, `Trial_Balance_${format(new Date(), "yyyyMMdd")}.xlsx`);
};

export const exportTrialBalanceToPdf = async (items: TrialBalanceItem[], context: TrialBalanceReportContext) => {
  const { startDate, endDate } = context;
  const doc = new jsPDF("p", "mm", "a4");
  const dateRangeText = `${format(new Date(startDate), "MMM d, yyyy")} to ${format(new Date(endDate), "MMM d, yyyy")}`;
  const rows = buildExportRows(items);
  await registerPdfFonts(doc);

  // Header
  const pageWidth = doc.internal.pageSize.width;
  doc.setFontSize(11);
  doc.setFont("NotoSans", "bold");
  doc.text(COMPANY_NAME, pageWidth / 2, 14, { align: "center" });
  
  doc.setFontSize(12);
  doc.text(REPORT_TITLE, pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("NotoSans", "normal");
  doc.text(dateRangeText, pageWidth / 2, 26, { align: "center" });
  doc.text(BASIS, pageWidth / 2, 32, { align: "center" });

  autoTable(doc, {
    startY: 36,
    body: [PERIOD_ACTIVITY_NOTE, ...getTrialBalanceReportLabels(context)].map(label => [label]),
    theme: "plain",
    styles: { font: "NotoSans", fontSize: 8, cellPadding: 1, overflow: "linebreak" },
  });
  const metadataEnd = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  const formattedRows = rows.map(row => 
    row.map((cell: string | number, index: number) => {
      if ((index === 2 || index === 3) && typeof cell === "number") return formatTrialBalanceAmount(cell);
      return cell;
    })
  );

  autoTable(doc, {
    startY: metadataEnd + 4,
    head: [["Code", "Account Title", "Period debit activity", "Period credit activity"]],
    body: formattedRows,
    theme: "grid",
    styles: {
      font: "NotoSans",
      fontSize: 8,
      cellPadding: 2,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 80 },
      2: { halign: "right", cellWidth: 40 },
      3: { halign: "right", cellWidth: 40 },
    },
    didParseCell: function(data) {
      const cellContent = data.cell.text[0];
      
      // Style Grand Total
      if (cellContent === "GRAND TOTAL") {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [245, 245, 245];
      }
    }
  });

  doc.save(`Trial_Balance_${format(new Date(), "yyyyMMdd")}.pdf`);
};
