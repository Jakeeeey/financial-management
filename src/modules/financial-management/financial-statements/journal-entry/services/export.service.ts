import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { JournalEntryGroup } from "../types";

const COMPANY_NAME = "MEN2 MARKETING AND DISTRIBUTION ENTERPRISE CORPORATION";
const REPORT_TITLE = "GENERAL JOURNAL";
const BASIS = "Accrual Basis";

const formatNumber = (val: number) => {
  if (val === 0) return "0.00";
  return new Intl.NumberFormat('en-PH', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
};

const buildExportData = (groups: JournalEntryGroup[]) => {
  const rows: any[][] = [];
  let sumDebit = 0;
  let sumCredit = 0;

  groups.forEach((group) => {
    const debitEntries = group.entries.filter((e) => e.debit > 0);
    const creditEntries = group.entries.filter((e) => e.credit > 0);

    const currentDebitTotal = Number(debitEntries.reduce((sum, e) => sum + e.debit, 0).toFixed(2));
    const currentCreditTotal = Number(creditEntries.reduce((sum, e) => sum + e.credit, 0).toFixed(2));
    const netBalance = Number((currentDebitTotal - currentCreditTotal).toFixed(2));

    sumDebit = Number((sumDebit + currentDebitTotal).toFixed(2));
    sumCredit = Number((sumCredit + currentCreditTotal).toFixed(2));

    const formattedDate = group.transactionDate ? format(new Date(group.transactionDate), "yyyy-MM-dd") : "";

    // Row 1: Debits
    const lastDebitIdx = Math.max(0, debitEntries.length - 1);
    debitEntries.forEach((entry, idx) => {
      const isFirst = idx === 0;
      const isLast = idx === lastDebitIdx;
      rows.push([
        isFirst ? formattedDate : "",
        isFirst ? group.sourceModule.split(" ")[0] : "",
        isFirst ? group.jeNo : "",
        entry.accountTitle,
        isFirst ? (group.description || "N/A") : `- ${entry.accountTitle} distribution`,
        entry.debit,
        "",
        isLast ? currentDebitTotal : "",
      ]);
    });

    // Row 2: Credits
    const lastCreditIdx = Math.max(0, creditEntries.length - 1);
    creditEntries.forEach((entry, idx) => {
      const isLast = idx === lastCreditIdx;
      rows.push([
        "",
        "",
        "",
        `    ${entry.accountTitle}`,
        `- ${entry.accountTitle} distribution`,
        "",
        entry.credit,
        isLast ? netBalance : "",
      ]);
    });
  });

  // Total Row
  rows.push([
    "TOTAL", "", "", "", "", sumDebit, sumCredit, Number((sumDebit - sumCredit).toFixed(2))
  ]);

  return rows;
};

export const exportJournalToExcel = (groups: JournalEntryGroup[], dateRangeText: string, filename: string = "Journal_Entries.xlsx") => {
  const dataRows = buildExportData(groups);

  const worksheetData = [
    [COMPANY_NAME],
    [REPORT_TITLE],
    [dateRangeText],
    [BASIS],
    [],
    ["Transaction Date", "Type", "Ref No. / JE No.", "Account Title", "Description", "Debit", "Credit", "Balance"],
    ...dataRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(worksheetData);

  // Merge headers across all 8 columns
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 7 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 7 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 7 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 7 } },
  ];

  // Set column widths
  ws["!cols"] = [
    { wch: 15 }, // Date
    { wch: 12 }, // Type
    { wch: 20 }, // Ref No
    { wch: 35 }, // Account Title
    { wch: 45 }, // Description
    { wch: 15 }, // Debit
    { wch: 15 }, // Credit
    { wch: 15 }, // Balance
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "General Journal");

  XLSX.writeFile(wb, filename);
};

export const exportJournalToPdf = (groups: JournalEntryGroup[], dateRangeText: string, filename: string = "Journal_Entries.pdf") => {
  const doc = new jsPDF("landscape");
  const dataRows = buildExportData(groups);

  // Format numbers for PDF display
  const formattedRows = dataRows.map(row => 
    row.map((cell, index) => {
      if (index >= 5 && typeof cell === "number") return formatNumber(cell);
      return cell;
    })
  );

  // Centered Header Text
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

  autoTable(doc, {
    startY: 40,
    head: [["Transaction Date", "Type", "Ref No. / JE No.", "Account Title", "Description", "Debit", "Credit", "Balance"]],
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
      0: { cellWidth: 20 },
      1: { cellWidth: 15 },
      2: { cellWidth: 35 },
      3: { cellWidth: 50 },
      4: { cellWidth: 70 },
      5: { halign: "right", cellWidth: 25 },
      6: { halign: "right", cellWidth: 25 },
      7: { halign: "right", cellWidth: 25 },
    },
    didParseCell: function(data) {
      // Bold the TOTAL row
      if (data.row.index === formattedRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
      }
    }
  });

  doc.save(filename);
};
