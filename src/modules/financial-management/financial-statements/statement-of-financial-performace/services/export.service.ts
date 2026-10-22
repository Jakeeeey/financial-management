import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FinancialPerformanceComparisonStatus, FinancialPerformanceResponse } from "../types";
import { alignFinancialPerformanceEntries } from "../utils/comparison-entries";
import { formatFinancialPerformanceChange, getFinancialPerformanceChange } from "../utils/variances";

const COMPANY_NAME = "MEN2 MARKETING AND DISTRIBUTION ENTERPRISE CORPORATION";
const REPORT_TITLE = "STATEMENT OF FINANCIAL PERFORMANCE";
const BASIS = "Accrual Basis";

const formatNumberStr = (val: number | undefined, isNegativeFormat: boolean = false) => {
    if (val === undefined) return "P0.00";
    const displayAmount = isNegativeFormat ? -Math.abs(val) : val;
    const isNegative = displayAmount < 0;
    const absValue = Math.abs(displayAmount);
    
    const formatted = new Intl.NumberFormat('en-PH', {
        style: 'decimal',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(absValue);
    
    return isNegative ? `-P${formatted}` : `P${formatted}`;
};

export const buildFinancialPerformanceExportData = (
    data: FinancialPerformanceResponse, 
    includeComparison: boolean, 
    comparisonStatus: FinancialPerformanceComparisonStatus,
    comparisonLabel: string
) => {
    const summary = data;
    const comparisonSummary = data.comparisonData;
    const comparisonAvailable = includeComparison && comparisonStatus === "available" && !!comparisonSummary;

    const rows: Array<{ label: string; current: number; past?: number | string; variance?: number; isIndented?: boolean; isHeader?: boolean; isNegativeFormat?: boolean; currentZeroActivity?: boolean; priorZeroActivity?: boolean }> = [];

    const addRow = (
        label: string, 
        current: number | undefined, 
        past: number | undefined, 
        options: { isIndented?: boolean; isHeader?: boolean; isNegativeFormat?: boolean; currentZeroActivity?: boolean; priorZeroActivity?: boolean } = {}
    ) => {
        const c = current || 0;
        const p = past ?? 0;
        rows.push({
            label,
            current: c,
            past: includeComparison ? comparisonAvailable ? p : "Comparison unavailable" : undefined,
            variance: comparisonAvailable ? getFinancialPerformanceChange(c, p, options.isNegativeFormat) : undefined,
            ...options
        });
    };

    const addEntries = (sectionKey: string, isNegativeFormat: boolean = false) => {
        const alignedEntries = alignFinancialPerformanceEntries(
            summary.entries,
            comparisonAvailable ? comparisonSummary?.entries ?? [] : [],
        ).filter(({ current, comparison }) => (current ?? comparison)?.reportSection === sectionKey);
        alignedEntries.forEach(({ current, comparison }) => {
            const entry = current ?? comparison!;
            addRow(
                entry.accountTitle,
                current?.amount ?? 0,
                comparison?.amount ?? 0,
                { isIndented: true, isNegativeFormat, currentZeroActivity: !current, priorZeroActivity: !comparison }
            );
        });
    };

    // SALES
    addRow("Sales activity (credit less debit)", summary.totalRevenue, comparisonSummary?.totalRevenue, { isHeader: true });

    // COGS
    addRow("Cost of Goods Sold", summary.totalCostOfSales, comparisonSummary?.totalCostOfSales, { isHeader: true });
    addEntries("Purchases / Cost of Sales");
    
    // GROSS PROFIT
    addRow("Gross Profit", summary.grossProfit, comparisonSummary?.grossProfit, { isHeader: true });

    // OPEX
    addRow("Operating Expenses", summary.totalOperatingExpenses, comparisonSummary?.totalOperatingExpenses, { isHeader: true, isNegativeFormat: true });
    addEntries("Operating Expenses");

    // OTHER INCOME / EXPENSES
    addRow("Other Expense", summary.totalOtherExpense, comparisonSummary?.totalOtherExpense, { isHeader: true, isNegativeFormat: true });
    addEntries("Other Expense");

    addRow("Other Income", summary.totalOtherIncome, comparisonSummary?.totalOtherIncome, { isHeader: true });
    addEntries("Other Income");

    // NET OTHER INCOME (LOSS)
    addRow("Net Other Income (Loss)", summary.totalOtherIncome - summary.totalOtherExpense, comparisonSummary ? comparisonSummary.totalOtherIncome - comparisonSummary.totalOtherExpense : undefined, { isHeader: true });

    // NET INCOME BEFORE TAX
    addRow("Income Before Tax", summary.incomeBeforeTax, comparisonSummary?.incomeBeforeTax, { isHeader: true });
    addRow(`Estimated income tax (${(summary.taxRateUsed * 100).toFixed(2)}% of positive pre-tax income)`, summary.incomeTaxExpense, comparisonSummary?.incomeTaxExpense, { isIndented: true, isNegativeFormat: true });

    // NET INCOME
    addRow("Net Income", summary.netIncome, comparisonSummary?.netIncome, { isHeader: true });

    // Convert structured rows to array data formatted for tables
    const headers = includeComparison 
        ? ["Particulars", "Current", comparisonLabel, "Change (current minus comparison)"]
        : ["Particulars", "Current"];

    const tableRows = rows.map(r => {
        const indentStr = r.isIndented ? "    " : "";
        
        const rowData = [
            `${indentStr}${r.label}`,
            r.current
        ];
        
        if (includeComparison) {
            rowData.push(r.past ?? "Comparison unavailable");
            rowData.push(r.variance ?? "");
        }
        
        return {
            raw: rowData,
            meta: r
        };
    });

    return { headers, tableRows };
};

function formatExportCell(
    cell: string | number,
    row: { isNegativeFormat?: boolean; currentZeroActivity?: boolean; priorZeroActivity?: boolean },
    columnIndex: number,
): string | number {
    if (typeof cell !== "number" || columnIndex === 0) return cell;
    if (columnIndex === 3) {
        return formatFinancialPerformanceChange(cell, amount => formatNumberStr(amount));
    }
    const zeroActivity = columnIndex === 1 ? row.currentZeroActivity : columnIndex === 2 ? row.priorZeroActivity : false;
    return `${formatNumberStr(cell, row.isNegativeFormat)}${zeroActivity ? " (Zero activity)" : ""}`;
}

function formatExcelCell(
    cell: string | number,
    row: { isNegativeFormat?: boolean; currentZeroActivity?: boolean; priorZeroActivity?: boolean },
    columnIndex: number,
): string | number {
    if (columnIndex === 3 && typeof cell === "number") return cell;
    return formatExportCell(cell, row, columnIndex);
}

export const exportToExcel = (
    data: FinancialPerformanceResponse | null, 
    dateRangeText: string, 
    includeComparison: boolean, 
    comparisonStatus: FinancialPerformanceComparisonStatus,
    comparisonLabel: string, 
    filename: string = "Statement_Of_Financial_Performance.xlsx"
) => {
    if (!data) return;
    
    const { headers, tableRows } = buildFinancialPerformanceExportData(data, includeComparison, comparisonStatus, comparisonLabel);

    // Prepare rows for Excel
    const dataRows = tableRows.map(tr => tr.raw.map((cell, idx) => formatExcelCell(cell, tr.meta, idx)));
    const exportBasis = includeComparison && (comparisonStatus !== "available" || !data.comparisonData) ? `${BASIS} · Comparison unavailable` : BASIS;

    const worksheetData = [
        [COMPANY_NAME],
        [REPORT_TITLE],
        [dateRangeText],
        [exportBasis],
        [],
        headers,
        ...dataRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const colCount = headers.length;

    if (includeComparison && colCount > 3) {
        for (let rowIndex = 6; rowIndex < worksheetData.length; rowIndex += 1) {
            const cell = ws[XLSX.utils.encode_cell({ r: rowIndex, c: 3 })];
            if (cell?.t === "n") cell.z = "₱#,##0.00;-₱#,##0.00;₱0.00";
        }
    }

    // Merge headers
    ws["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colCount - 1 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: colCount - 1 } },
        { s: { r: 3, c: 0 }, e: { r: 3, c: colCount - 1 } },
    ];

    // Set column widths
    const cols = [{ wch: 45 }];
    for (let i = 1; i < colCount; i++) {
        cols.push({ wch: 20 });
    }
    ws["!cols"] = cols;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financial Performance");
    XLSX.writeFile(wb, filename);
};


export const exportToPdf = (
    data: FinancialPerformanceResponse | null, 
    dateRangeText: string, 
    includeComparison: boolean, 
    comparisonStatus: FinancialPerformanceComparisonStatus,
    comparisonLabel: string, 
    filename: string = "Statement_Of_Financial_Performance.pdf"
) => {
    if (!data) return;

    // Switch to Portrait to maximize vertical space and fit the columns better
    const doc = new jsPDF("p", "mm", "a4");
    const { headers, tableRows } = buildFinancialPerformanceExportData(data, includeComparison, comparisonStatus, comparisonLabel);

    // Format numbers for PDF display
    const formattedRows = tableRows.map(tr => tr.raw.map((cell, idx) => formatExportCell(cell, tr.meta, idx)));
    const exportBasis = includeComparison && (comparisonStatus !== "available" || !data.comparisonData) ? `${BASIS} · Comparison unavailable` : BASIS;

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
    doc.text(exportBasis, pageWidth / 2, 32, { align: "center" });

    // Setup column styles dynamically - remove fixed cellWidth to allow full-width stretching
    const colStyles: { [key: number]: { halign: "left" | "center" | "right" } } = {
        0: { halign: "left" } // First column (Particulars) will take the remaining space
    };
    for (let i = 1; i < headers.length; i++) {
        colStyles[i] = { halign: "right" }; // Value columns will auto-size but stay right-aligned
    }

    autoTable(doc, {
        startY: 40,
        head: [headers],
        body: formattedRows,
        theme: "grid",
        margin: { left: 15, right: 15 },
        styles: {
            fontSize: 9,
            cellPadding: 5, // Increased padding to fill space better
            valign: 'middle'
        },
        headStyles: {
            fillColor: [250, 250, 250],
            textColor: [50, 50, 50],
            fontStyle: "bold",
            halign: "right",
        },
        columnStyles: colStyles,
        didParseCell: function(dataProp) {
            // override first column header alignment
            if (dataProp.section === 'head' && dataProp.column.index === 0) {
               dataProp.cell.styles.halign = 'left';
            }
            
            // Bold header rows/Summary rows
            if (dataProp.section === 'body') {
                const tr = tableRows[dataProp.row.index];
                if (tr.meta.isHeader) {
                    dataProp.cell.styles.fontStyle = "bold";
                    dataProp.cell.styles.fillColor = [252, 252, 252]; // Subtle highlight for header rows
                }
            }
        }
    });

    doc.save(filename);
};
