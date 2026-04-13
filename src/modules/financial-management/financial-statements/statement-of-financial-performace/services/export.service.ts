import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FinancialPerformanceResponse, FinancialPerformanceEntry } from "../types";

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
    
    return isNegative ? `(P${formatted})` : `P${formatted}`;
};

const getSectionTotal = (sourceData: FinancialPerformanceResponse | undefined, sectionName: string) => {
    if (!sourceData || !sourceData.entries) return 0;
    return sourceData.entries
        .filter(e => e.reportSection === sectionName)
        .reduce((acc, curr) => acc + curr.amount, 0);
};

const buildExportData = (
    data: FinancialPerformanceResponse, 
    includeComparison: boolean, 
    comparisonLabel: string, 
    taxRate: number
) => {
    const summary = data;
    const comparisonSummary = data.comparisonData;

    const rows: Array<{ label: string; current: number; past?: number; variance?: number; isIndented?: boolean; isHeader?: boolean; isNegativeFormat?: boolean }> = [];

    const addRow = (
        label: string, 
        current: number | undefined, 
        past: number | undefined, 
        options: { isIndented?: boolean; isHeader?: boolean; isNegativeFormat?: boolean } = {}
    ) => {
        const c = current || 0;
        const p = past || 0;
        rows.push({
            label,
            current: c,
            past: includeComparison ? p : undefined,
            variance: includeComparison ? c - p : undefined,
            ...options
        });
    };

    const addEntries = (sectionKey: string, isNegativeFormat: boolean = false) => {
        const filteredEntries = summary.entries.filter(e => e.reportSection === sectionKey);
        filteredEntries.forEach(entry => {
            const compEntry = comparisonSummary?.entries.find(c => c.accountTitle === entry.accountTitle);
            addRow(
                sectionKey === "Contra Revenue" ? `Less: ${entry.accountTitle}` : entry.accountTitle,
                entry.amount,
                compEntry?.amount,
                { isIndented: true, isNegativeFormat }
            );
        });
    };

    // SALES
    addRow("Gross Sales", Math.abs(summary.totalRevenue), comparisonSummary ? Math.abs(comparisonSummary.totalRevenue) : undefined, { isHeader: true });
    addEntries("Contra Revenue", true);
    
    const currTotalDeductions = getSectionTotal(summary, "Contra Revenue");
    const pastTotalDeductions = getSectionTotal(comparisonSummary, "Contra Revenue");
    addRow("Total Deductions", currTotalDeductions, pastTotalDeductions, { isHeader: true, isNegativeFormat: true });

    const currNetSales = Math.abs(summary.totalRevenue) - Math.abs(currTotalDeductions);
    const pastNetSales = comparisonSummary ? Math.abs(comparisonSummary.totalRevenue) - Math.abs(pastTotalDeductions) : undefined;
    addRow("Net Sales", currNetSales, pastNetSales, { isHeader: true });

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
    addRow(`Tax (${taxRate}%)`, summary.incomeTaxExpense, comparisonSummary?.incomeTaxExpense, { isIndented: true, isNegativeFormat: true });

    // NET INCOME
    addRow("Net Income", summary.netIncome, comparisonSummary?.netIncome, { isHeader: true });

    // Convert structured rows to array data formatted for tables
    const headers = includeComparison 
        ? ["Particulars", "Current", comparisonLabel, "Variance"]
        : ["Particulars", "Current"];

    const tableRows = rows.map(r => {
        const indentStr = r.isIndented ? "    " : "";
        
        const rowData = [
            `${indentStr}${r.label}`,
            r.current
        ];
        
        if (includeComparison) {
            rowData.push(r.past as number);
            rowData.push(r.variance as number);
        }
        
        return {
            raw: rowData,
            meta: r
        };
    });

    return { headers, tableRows };
};

export const exportToExcel = (
    data: FinancialPerformanceResponse | null, 
    dateRangeText: string, 
    includeComparison: boolean, 
    comparisonLabel: string, 
    taxRate: number, 
    filename: string = "Statement_Of_Financial_Performance.xlsx"
) => {
    if (!data) return;
    
    const { headers, tableRows } = buildExportData(data, includeComparison, comparisonLabel, taxRate);

    // Prepare rows for Excel
    const dataRows = tableRows.map(tr => tr.raw.map((cell, idx) => {
        if (idx > 0 && typeof cell === "number") {
             // For excel, returning actual number so Excel handles it properly, 
             // but if they want the parens, we could format it here.
             // Best to use raw numbers for excel, and let the user format or we format strictly.
             // We will apply strict string format for consistency with UI.
             return formatNumberStr(cell, tr.meta.isNegativeFormat);
        }
        return cell;
    }));

    const worksheetData = [
        [COMPANY_NAME],
        [REPORT_TITLE],
        [dateRangeText],
        [BASIS],
        [],
        headers,
        ...dataRows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const colCount = headers.length;

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
    comparisonLabel: string, 
    taxRate: number, 
    filename: string = "Statement_Of_Financial_Performance.pdf"
) => {
    if (!data) return;

    // Switch to Portrait to maximize vertical space and fit the columns better
    const doc = new jsPDF("p", "mm", "a4");
    const { headers, tableRows } = buildExportData(data, includeComparison, comparisonLabel, taxRate);

    // Format numbers for PDF display
    const formattedRows = tableRows.map(tr => 
        tr.raw.map((cell, idx) => {
            if (idx > 0 && typeof cell === "number") {
               return formatNumberStr(cell, tr.meta.isNegativeFormat);
            }
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

    // Setup column styles dynamically - remove fixed cellWidth to allow full-width stretching
    const colStyles: Record<number, any> = {
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
