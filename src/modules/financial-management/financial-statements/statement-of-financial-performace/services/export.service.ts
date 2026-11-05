import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
    FinancialPerformanceComparisonStatus,
    FinancialPerformanceEntry,
    FinancialPerformanceReportCriteria,
    FinancialPerformanceResponse,
} from "../types";
import {
    FINANCIAL_PERFORMANCE_ACCOUNT_BREAKDOWN_SECTIONS,
    isFinancialPerformanceAccountBreakdownEntry,
    matchesFinancialPerformanceEntrySearch,
} from "../utils/account-search";
import {
    describeFinancialPerformanceStatus,
    FINANCIAL_PERFORMANCE_SOURCE_MODULES,
} from "../utils/report-coverage";
import {
    formatFinancialPerformanceDateRange,
    getFinancialPerformanceComparisonLabel,
} from "../utils/periods";
import { alignFinancialPerformanceEntries } from "../utils/comparison-entries";
import { formatFinancialPerformanceChange, getFinancialPerformanceChange } from "../utils/variances";

const COMPANY_NAME = "MEN2 MARKETING AND DISTRIBUTION ENTERPRISE CORPORATION";
const REPORT_TITLE = "STATEMENT OF FINANCIAL PERFORMANCE";
const BASIS = "Accrual Basis";
const EXCEL_PESO_FORMAT = "₱#,##0.00;-₱#,##0.00;₱0.00";

export type FinancialPerformanceExportScope = "statement" | "account-breakdown";

export interface FinancialPerformanceExportContext {
    criteria: FinancialPerformanceReportCriteria;
    comparisonStatus: FinancialPerformanceComparisonStatus;
    searchQuery: string;
    generatedAt: Date;
}

interface FinancialPerformanceExportRowMeta {
    isHeader?: boolean;
    isNegativeFormat?: boolean;
    currentZeroActivity?: boolean;
    priorZeroActivity?: boolean;
}

interface FinancialPerformanceExportRow {
    raw: Array<string | number>;
    meta: FinancialPerformanceExportRowMeta;
}

interface FinancialPerformanceExportTable {
    headers: string[];
    tableRows: FinancialPerformanceExportRow[];
}

const formatNumberStr = (value: number) => {
    const formatted = new Intl.NumberFormat("en-PH", {
        style: "decimal",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(Math.abs(value));

    return value < 0 ? `-PHP ${formatted}` : `PHP ${formatted}`;
};

const formatGeneratedAt = (date: Date) => `${new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
}).format(date)} PHT`;

function buildExportMetadata(
    data: FinancialPerformanceResponse,
    scope: FinancialPerformanceExportScope,
    context: FinancialPerformanceExportContext,
    accountCount: number,
): Array<[string, string]> {
    const { criteria } = context;
    const hasComparisonData = criteria.includeComparison
        && context.comparisonStatus === "available"
        && !!data.comparisonData;
    const comparisonStatus = !criteria.includeComparison
        ? "Not included"
        : hasComparisonData
            ? "Available"
            : "Unavailable";

    const metadata: Array<[string, string]> = [
        ["Export scope", scope === "statement" ? "Full applied statement" : "Account breakdown — current-period account activity"],
        ["Reporting period", formatFinancialPerformanceDateRange(criteria.startDate, criteria.endDate)],
        ["Comparison period", criteria.includeComparison
            ? formatFinancialPerformanceDateRange(criteria.comparisonStartDate, criteria.comparisonEndDate)
            : "Not included"],
        ["Comparison data", comparisonStatus],
        ["Transaction status", describeFinancialPerformanceStatus(criteria.status)],
        ["Division", criteria.divisionName || "All divisions"],
        ["Department", criteria.departmentName || "All departments"],
        ["Source coverage", FINANCIAL_PERFORMANCE_SOURCE_MODULES.join(", ")],
        ["Currency", "PHP — Philippine peso"],
        ["Reporting basis", BASIS],
        ["Income-tax assumption", `${(data.taxRateUsed * 100).toFixed(2)}% of positive pre-tax income (rate used by the report)`],
    ];

    if (scope === "account-breakdown") {
        metadata.push(
            ["Matching account rows", `${accountCount} ${accountCount === 1 ? "account row" : "account rows"}`],
            ["Detail View search", context.searchQuery.trim() || "All account rows"],
        );
    } else {
        metadata.push(
            ["Account detail scope", "Full applied statement layout"],
            ["Detail View search", "Not applied — statement includes the full applied report"],
        );
    }
    metadata.push(["Generated at", formatGeneratedAt(context.generatedAt)]);
    return metadata;
}

export const buildFinancialPerformanceExportData = (
    data: FinancialPerformanceResponse,
    includeComparison: boolean,
    comparisonStatus: FinancialPerformanceComparisonStatus,
    comparisonLabel: string,
): FinancialPerformanceExportTable => {
    const comparisonSummary = data.comparisonData;
    const comparisonAvailable = includeComparison && comparisonStatus === "available" && !!comparisonSummary;
    const rows: Array<{
        label: string;
        current: number;
        past?: number | string;
        variance?: number;
        isIndented?: boolean;
        isHeader?: boolean;
        isNegativeFormat?: boolean;
        currentZeroActivity?: boolean;
        priorZeroActivity?: boolean;
    }> = [];

    const addRow = (
        label: string,
        current: number | undefined,
        past: number | undefined,
        options: {
            isIndented?: boolean;
            isHeader?: boolean;
            isNegativeFormat?: boolean;
            currentZeroActivity?: boolean;
            priorZeroActivity?: boolean;
        } = {},
    ) => {
        const currentValue = current ?? 0;
        const priorValue = past ?? 0;
        rows.push({
            label,
            current: currentValue,
            past: includeComparison ? comparisonAvailable ? priorValue : "Comparison unavailable" : undefined,
            variance: comparisonAvailable ? getFinancialPerformanceChange(currentValue, priorValue, options.isNegativeFormat) : undefined,
            ...options,
        });
    };

    const addEntries = (sectionKey: string, isNegativeFormat = false) => {
        const alignedEntries = alignFinancialPerformanceEntries(
            data.entries,
            comparisonAvailable ? comparisonSummary?.entries ?? [] : [],
        ).filter(({ current, comparison }) => (current ?? comparison)?.reportSection === sectionKey);

        alignedEntries.forEach(({ current, comparison }) => {
            const entry = current ?? comparison!;
            addRow(entry.accountTitle, current?.amount ?? 0, comparison?.amount ?? 0, {
                isIndented: true,
                isNegativeFormat,
                currentZeroActivity: !current,
                priorZeroActivity: !comparison,
            });
        });
    };

    addRow("Sales activity (credit less debit)", data.totalRevenue, comparisonSummary?.totalRevenue, { isHeader: true });
    addRow("Cost of Goods Sold", data.totalCostOfSales, comparisonSummary?.totalCostOfSales, { isHeader: true });
    addEntries("Purchases / Cost of Sales");
    addRow("Gross Profit", data.grossProfit, comparisonSummary?.grossProfit, { isHeader: true });
    addRow("Operating Expenses", data.totalOperatingExpenses, comparisonSummary?.totalOperatingExpenses, { isHeader: true, isNegativeFormat: true });
    addEntries("Operating Expenses");
    addRow("Other Expense", data.totalOtherExpense, comparisonSummary?.totalOtherExpense, { isHeader: true, isNegativeFormat: true });
    addEntries("Other Expense");
    addRow("Other Income", data.totalOtherIncome, comparisonSummary?.totalOtherIncome, { isHeader: true });
    addEntries("Other Income");
    addRow("Net Other Income (Loss)", data.totalOtherIncome - data.totalOtherExpense, comparisonSummary
        ? comparisonSummary.totalOtherIncome - comparisonSummary.totalOtherExpense
        : undefined, { isHeader: true });
    addRow("Income Before Tax", data.incomeBeforeTax, comparisonSummary?.incomeBeforeTax, { isHeader: true });
    addRow(`Estimated income tax (${(data.taxRateUsed * 100).toFixed(2)}% of positive pre-tax income)`, data.incomeTaxExpense, comparisonSummary?.incomeTaxExpense, {
        isIndented: true,
        isNegativeFormat: true,
    });
    addRow("Net Income", data.netIncome, comparisonSummary?.netIncome, { isHeader: true });

    const headers = includeComparison
        ? ["Particulars", "Current period", comparisonLabel || "Comparison period", "Change (current minus comparison)", "Activity / comparison status"]
        : ["Particulars", "Current period"];

    const tableRows = rows.map(row => {
        const label = `${row.isIndented ? "    " : ""}${row.label}`;
        const raw: Array<string | number> = [label, row.current];
        if (includeComparison) {
            const activity = !comparisonAvailable
                ? ""
                : row.currentZeroActivity && row.priorZeroActivity
                    ? "Zero activity in both periods"
                    : row.currentZeroActivity
                        ? "Zero activity in current period"
                        : row.priorZeroActivity
                            ? "Zero activity in comparison period"
                            : "";
            raw.push(row.past ?? "Comparison unavailable", row.variance ?? "", activity);
        }
        return { raw, meta: row };
    });

    return { headers, tableRows };
};

export function buildFinancialPerformanceAccountBreakdownExportData(
    data: FinancialPerformanceResponse,
    searchQuery: string,
): FinancialPerformanceExportTable & { accountCount: number } {
    const entries = data.entries.filter(entry =>
        isFinancialPerformanceAccountBreakdownEntry(entry)
        && matchesFinancialPerformanceEntrySearch(entry, searchQuery)
    ).sort((left, right) => FINANCIAL_PERFORMANCE_ACCOUNT_BREAKDOWN_SECTIONS.indexOf(left.reportSection as typeof FINANCIAL_PERFORMANCE_ACCOUNT_BREAKDOWN_SECTIONS[number])
        - FINANCIAL_PERFORMANCE_ACCOUNT_BREAKDOWN_SECTIONS.indexOf(right.reportSection as typeof FINANCIAL_PERFORMANCE_ACCOUNT_BREAKDOWN_SECTIONS[number]));
    return {
        headers: ["Section", "GL code", "Account", "Division", "Department", "Current-period activity"],
        tableRows: entries.map((entry: FinancialPerformanceEntry) => ({
            raw: [entry.reportSection || "Uncategorized", entry.glCode || "Unavailable", entry.accountTitle, entry.division || "—", entry.department || "—", entry.amount],
            meta: {},
        })),
        accountCount: entries.length,
    };
}

function buildExportTable(
    data: FinancialPerformanceResponse,
    scope: FinancialPerformanceExportScope,
    context: FinancialPerformanceExportContext,
): FinancialPerformanceExportTable & { accountCount: number } {
    if (scope === "account-breakdown") {
        return buildFinancialPerformanceAccountBreakdownExportData(data, context.searchQuery);
    }

    return {
        ...buildFinancialPerformanceExportData(
            data,
            context.criteria.includeComparison,
            context.comparisonStatus,
            getFinancialPerformanceComparisonLabel(context.criteria),
        ),
        accountCount: 0,
    };
}

function formatPdfCell(cell: string | number, row: FinancialPerformanceExportRowMeta, columnIndex: number): string | number {
    if (typeof cell !== "number" || columnIndex === 0) return cell;
    if (columnIndex === 3) return formatFinancialPerformanceChange(cell, formatNumberStr);
    const isExpenseAmount = columnIndex === 1 || columnIndex === 2;
    const displayAmount = isExpenseAmount && row.isNegativeFormat ? -Math.abs(cell) : cell;
    return formatNumberStr(displayAmount);
}

function formatExcelCell(cell: string | number, row: FinancialPerformanceExportRowMeta, columnIndex: number): string | number {
    if (typeof cell !== "number") return cell;
    const isExpenseAmount = columnIndex === 1 || columnIndex === 2;
    return isExpenseAmount && row.isNegativeFormat ? -Math.abs(cell) : cell;
}

export function buildFinancialPerformanceExcelWorksheet(
    data: FinancialPerformanceResponse,
    scope: FinancialPerformanceExportScope,
    context: FinancialPerformanceExportContext,
): XLSX.WorkSheet {
    const table = buildExportTable(data, scope, context);
    const metadata = buildExportMetadata(data, scope, context, table.accountCount);
    const title = scope === "statement" ? REPORT_TITLE : "ACCOUNT BREAKDOWN";
    const worksheetData: Array<Array<string | number>> = [
        [COMPANY_NAME],
        [title],
        ...metadata.map(([label, value]) => [label, value]),
        [],
        table.headers,
        ...table.tableRows.map(row => row.raw.map((cell, index) => formatExcelCell(cell, row.meta, index))),
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    const columnCount = table.headers.length;
    const headerRowIndex = 3 + metadata.length;
    const firstDataRowIndex = headerRowIndex + 1;
    const monetaryColumns = scope === "account-breakdown"
        ? [5]
        : context.criteria.includeComparison
            ? [1, 2, 3]
            : [1];

    worksheet["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: columnCount - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: columnCount - 1 } },
        ...metadata.map((_, index) => ({
            s: { r: index + 2, c: 1 },
            e: { r: index + 2, c: columnCount - 1 },
        })).filter(merge => merge.s.c < merge.e.c),
    ];
    worksheet["!cols"] = scope === "account-breakdown"
        ? [{ wch: 26 }, { wch: 14 }, { wch: 36 }, { wch: 22 }, { wch: 22 }, { wch: 24 }]
        : [{ wch: 45 }, ...Array.from({ length: columnCount - 1 }, () => ({ wch: 24 }))];
    worksheet["!autofilter"] = {
        ref: XLSX.utils.encode_range({
            s: { r: headerRowIndex, c: 0 },
            e: { r: worksheetData.length - 1, c: columnCount - 1 },
        }),
    };

    for (let rowIndex = firstDataRowIndex; rowIndex < worksheetData.length; rowIndex += 1) {
        for (const columnIndex of monetaryColumns) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex })];
            if (cell?.t === "n") cell.z = EXCEL_PESO_FORMAT;
        }
    }

    return worksheet;
}

export const exportToExcel = (
    data: FinancialPerformanceResponse,
    scope: FinancialPerformanceExportScope,
    context: FinancialPerformanceExportContext,
) => {
    const worksheet = buildFinancialPerformanceExcelWorksheet(data, scope, context);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, scope === "statement" ? "Statement" : "Account Breakdown");
    XLSX.writeFile(workbook, scope === "statement"
        ? "Statement_Of_Financial_Performance.xlsx"
        : "Statement_Account_Breakdown.xlsx");
};

export const exportToPdf = (
    data: FinancialPerformanceResponse,
    scope: FinancialPerformanceExportScope,
    context: FinancialPerformanceExportContext,
) => {
    const table = buildExportTable(data, scope, context);
    const metadata = buildExportMetadata(data, scope, context, table.accountCount);
    const isAccountBreakdown = scope === "account-breakdown";
    const doc = new jsPDF(isAccountBreakdown ? "l" : "p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.width;
    const margin = 15;
    const title = isAccountBreakdown ? "ACCOUNT BREAKDOWN" : REPORT_TITLE;

    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(COMPANY_NAME, pageWidth / 2, 14, { align: "center" });
    doc.setFontSize(12);
    doc.text(title, pageWidth / 2, 20, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let cursorY = 27;
    for (const [label, value] of metadata) {
        const lines = doc.splitTextToSize(`${label}: ${value}`, pageWidth - margin * 2);
        doc.text(lines, margin, cursorY);
        cursorY += lines.length * 4;
    }

    const monetaryColumns = isAccountBreakdown
        ? [5]
        : context.criteria.includeComparison
            ? [1, 2, 3]
            : [1];
    const columnStyles: Record<number, { halign: "left" | "right" }> = {};
    table.headers.forEach((_, index) => {
        columnStyles[index] = { halign: monetaryColumns.includes(index) ? "right" : "left" };
    });

    autoTable(doc, {
        startY: cursorY + 3,
        head: [table.headers],
        body: table.tableRows.map(row => row.raw.map((cell, index) => formatPdfCell(cell, row.meta, index))),
        theme: "grid",
        margin: { left: margin, right: margin },
        styles: { fontSize: isAccountBreakdown ? 8 : 9, cellPadding: isAccountBreakdown ? 2.5 : 4, valign: "middle" },
        headStyles: { fillColor: [250, 250, 250], textColor: [50, 50, 50], fontStyle: "bold" },
        columnStyles,
        didParseCell: cell => {
            if (!isAccountBreakdown && cell.section === "body" && table.tableRows[cell.row.index]?.meta.isHeader) {
                cell.cell.styles.fontStyle = "bold";
                cell.cell.styles.fillColor = [252, 252, 252];
            }
        },
    });

    doc.save(isAccountBreakdown ? "Statement_Account_Breakdown.pdf" : "Statement_Of_Financial_Performance.pdf");
};
