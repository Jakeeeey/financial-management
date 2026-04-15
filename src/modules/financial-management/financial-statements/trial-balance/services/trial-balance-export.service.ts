import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { TrialBalanceItem } from "../types/trial-balance.schema";

const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || "MEN2 MARKETING AND DISTRIBUTION ENTERPRISE CORPORATION";
const REPORT_TITLE = "TRIAL BALANCE";
const BASIS = "Accrual Basis";

const formatNumber = (val: number) => {
  if (val === 0) return "0.00";
  return new Intl.NumberFormat('en-PH', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

/**
 * Robust rounding helper for financial calculations.
 * Prevents floating-point precision errors (e.g., 0.1 + 0.2).
 */
const round = (val: number): number => {
  return Math.round((val + Number.EPSILON) * 100) / 100;
};

/**
 * Build a flat list of export rows — no grouping, no subtotals, no net balance.
 * Only: Code | Account Title | Debit | Credit
 * Plus a GRAND TOTAL row at the bottom.
 */
const buildExportRows = (items: TrialBalanceItem[]) => {
  let grandTotalDebit = 0;
  let grandTotalCredit = 0;

  const rows: any[][] = items.map(item => {
    grandTotalDebit = round(grandTotalDebit + item.totalDebit);
    grandTotalCredit = round(grandTotalCredit + item.totalCredit);
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
    grandTotalDebit,
    grandTotalCredit,
  ]);

  return rows;
};

export const exportTrialBalanceToExcel = (items: TrialBalanceItem[], startDate: string, endDate: string) => {
  const dateRangeText = `${format(new Date(startDate), "MMM d, yyyy")} to ${format(new Date(endDate), "MMM d, yyyy")}`;
  const rows = buildExportRows(items);

  const worksheetData = [
    [COMPANY_NAME],
    [REPORT_TITLE],
    [dateRangeText],
    [BASIS],
    [],
    ["Code", "Account Title", "Debit", "Credit"],
    ...rows
  ];

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Styling and Merging
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 3 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 3 } },
  ];

  ws["!cols"] = [
    { wch: 15 }, // Code
    { wch: 45 }, // Account Title
    { wch: 18 }, // Debit
    { wch: 18 }, // Credit
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Trial Balance");
  XLSX.writeFile(wb, `Trial_Balance_${format(new Date(), "yyyyMMdd")}.xlsx`);
};

export const exportTrialBalanceToPdf = (items: TrialBalanceItem[], startDate: string, endDate: string) => {
  const doc = new jsPDF("p", "mm", "a4");
  const dateRangeText = `${format(new Date(startDate), "MMM d, yyyy")} to ${format(new Date(endDate), "MMM d, yyyy")}`;
  const rows = buildExportRows(items);

  // Header
  const pageWidth = doc.internal.pageSize.width;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(COMPANY_NAME, pageWidth / 2, 14, { align: "center" });
  
  doc.setFontSize(12);
  doc.text(REPORT_TITLE, pageWidth / 2, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(dateRangeText, pageWidth / 2, 26, { align: "center" });
  doc.text(BASIS, pageWidth / 2, 32, { align: "center" });

  const formattedRows = rows.map(row => 
    row.map((cell: any, index: number) => {
      if ((index === 2 || index === 3) && typeof cell === "number") return formatNumber(cell);
      return cell;
    })
  );

  autoTable(doc, {
    startY: 40,
    head: [["Code", "Account Title", "Debit", "Credit"]],
    body: formattedRows,
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [0, 0, 0],
      fontStyle: "bold",
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 100 },
      2: { halign: "right", cellWidth: 30 },
      3: { halign: "right", cellWidth: 30 },
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
