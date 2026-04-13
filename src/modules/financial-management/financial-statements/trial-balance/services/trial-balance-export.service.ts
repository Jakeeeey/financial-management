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

const getSubCategory = (item: TrialBalanceItem): string => {
  const type = item.accountType.toUpperCase();
  const category = item.accountCategory.toUpperCase();

  if (category === "ASSETS") {
    if (type.includes("NON-CURRENT")) return "Non-Current Assets";
    if (type.includes("CURRENT")) return "Current Assets";
  }
  if (category === "LIABILITIES") {
    if (type.includes("NON-CURRENT")) return "Non-Current Liabilities";
    if (type.includes("CURRENT")) return "Current Liabilities";
  }
  if (category === "EQUITY") {
    if (type.includes("RETAINED EARNINGS")) return "Retained Earnings";
    if (type.includes("CAPITAL")) return "Capital";
  }
  if (category === "REVENUE") {
    if (type.includes("NON-OPERATING")) return "Non-Operating Revenue";
    if (type.includes("OPERATING")) return "Operating Revenue";
  }
  if (category === "EXPENSE" || category === "EXPENSES") {
    if (type.includes("NON TRADE") || type.includes("NON-TRADE")) return "Operating Expenses (Non Trade)";
    if (type.includes("TRADE")) return "Operating Expenses (Trade)";
  }

  return item.accountType; // Fallback to raw type
};

const groupData = (items: TrialBalanceItem[]) => {
  const categories = ["ASSETS", "LIABILITIES", "EQUITY", "REVENUE", "EXPENSE", "EXPENSES"];
  const order = ["ASSETS", "LIABILITIES", "EQUITY", "REVENUE", "EXPENSE", "EXPENSES"];
  
  const grouped: Record<string, Record<string, TrialBalanceItem[]>> = {};

  items.forEach(item => {
    let cat = item.accountCategory.toUpperCase();
    if (cat === "EXPENSES") cat = "EXPENSE"; // Normalize
    
    const subCat = getSubCategory(item);

    if (!grouped[cat]) grouped[cat] = {};
    if (!grouped[cat][subCat]) grouped[cat][subCat] = [];
    grouped[cat][subCat].push(item);
  });

  return grouped;
};

const buildExportRows = (items: TrialBalanceItem[]) => {
  const grouped = groupData(items);
  const rows: any[][] = [];
  let grandTotalDebit = 0;
  let grandTotalCredit = 0;

  const categoryOrder = ["ASSETS", "LIABILITIES", "EQUITY", "REVENUE", "EXPENSE"];
  const categoryLabels: Record<string, string> = {
    "ASSETS": "Assets",
    "LIABILITIES": "Liabilities",
    "EQUITY": "Equity",
    "REVENUE": "Revenue",
    "EXPENSE": "Expenses"
  };

  categoryOrder.forEach(catKey => {
    if (!grouped[catKey]) return;

    // Add Category Header Row
    rows.push([categoryLabels[catKey], "", "", "", "", ""]);

    let catTotalDebit = 0;
    let catTotalCredit = 0;

    Object.entries(grouped[catKey]).forEach(([subCat, subItems]) => {
      // Add Sub-category Header Row
      rows.push(["  " + subCat, "", "", "", "", ""]);

      let subTotalDebit = 0;
      let subTotalCredit = 0;

      subItems.forEach(item => {
        rows.push([
          item.glCode,
          item.accountTitle,
          item.totalDebit,
          item.totalCredit,
          item.netBalance,
          item.balanceType
        ]);
        subTotalDebit = round(subTotalDebit + item.totalDebit);
        subTotalCredit = round(subTotalCredit + item.totalCredit);
      });

      // Add Sub-category Total Row
      rows.push([
        `  Total ${subCat}`,
        "",
        subTotalDebit,
        subTotalCredit,
        round(subTotalDebit - subTotalCredit),
        ""
      ]);

      catTotalDebit = round(catTotalDebit + subTotalDebit);
      catTotalCredit = round(catTotalCredit + subTotalCredit);
    });

    // Add Category Total Row
    rows.push([
      `Total ${categoryLabels[catKey]}`,
      "",
      catTotalDebit,
      catTotalCredit,
      round(catTotalDebit - catTotalCredit),
      ""
    ]);

    grandTotalDebit = round(grandTotalDebit + catTotalDebit);
    grandTotalCredit = round(grandTotalCredit + catTotalCredit);
  });

  // Grand Total Row
  const isBalanced = Math.abs(grandTotalDebit - grandTotalCredit) < 0.01;
  rows.push([
    "GRAND TOTAL",
    "",
    grandTotalDebit,
    grandTotalCredit,
    round(grandTotalDebit - grandTotalCredit),
    isBalanced ? "Balanced" : "Unbalanced"
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
    ["Code", "Account Title", "Debit", "Credit", "Net Balance", "Type"],
    ...rows
  ];

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Styling and Merging
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },
  ];

  ws["!cols"] = [
    { wch: 15 }, // Code
    { wch: 40 }, // Account Title
    { wch: 15 }, // Debit
    { wch: 15 }, // Credit
    { wch: 15 }, // Net Balance
    { wch: 12 }, // Type
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
    row.map((cell, index) => {
      if ((index === 2 || index === 3 || index === 4) && typeof cell === "number") return formatNumber(cell);
      return cell;
    })
  );

  autoTable(doc, {
    startY: 40,
    head: [["Code", "Account Title", "Debit", "Credit", "Net Balance", "Type"]],
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
      1: { cellWidth: 70 },
      2: { halign: "right", cellWidth: 25 },
      3: { halign: "right", cellWidth: 25 },
      4: { halign: "right", cellWidth: 25 },
      5: { halign: "center", cellWidth: 20 },
    },
    didParseCell: function(data) {
      const rowContent = data.row.raw as any[];
      const cellContent = data.cell.text[0];
      
      // Style Category Headers
      if (rowContent[0] && !rowContent[1] && !rowContent[2]) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fillColor = [245, 245, 245];
      }

      // Style Totals
      if (cellContent.includes("Total") || cellContent === "GRAND TOTAL") {
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  doc.save(`Trial_Balance_${format(new Date(), "yyyyMMdd")}.pdf`);
};
