import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { DisbursementDashboardData, DashboardFilters } from "../types";
import { toast } from "sonner";
import { format } from "date-fns";

export async function generateReportExcel(data: DisbursementDashboardData | null, filters: DashboardFilters) {
    if (!data || !data.vouchers || data.vouchers.length === 0) {
        toast.error("No disbursement data to export");
        return;
    }

    try {
        const workbook = new ExcelJS.Workbook();
        
        // Define common styles
        const borderStyle: Partial<ExcelJS.Borders> = {
            top: { style: "thin", color: { argb: "E2E8F0" } },
            left: { style: "thin", color: { argb: "E2E8F0" } },
            bottom: { style: "thin", color: { argb: "E2E8F0" } },
            right: { style: "thin", color: { argb: "E2E8F0" } },
        };

        const headerFill: ExcelJS.Fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0F172A" }, // Slate-900
        };

        const subHeaderFill: ExcelJS.Fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF1E293B" }, // Slate-800
        };

        const highlightFill: ExcelJS.Fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF1F5F9" }, // Slate-100
        };

        // ----------------------------------------------------
        // SHEET 1: OUTFLOW REGISTER DETAILS
        // ----------------------------------------------------
        const wsRegister = workbook.addWorksheet("Liability Register");
        
        // 1. BANNER TITLE
        const typeLabel = filters.transactionType === "1" ? "TRADE" : filters.transactionType === "2" ? "NON-TRADE" : "ALL";
        const titleRow = wsRegister.addRow([`DISBURSEMENT OUTFLOW REGISTER REPORT (${typeLabel})`]);
        titleRow.height = 35;
        wsRegister.mergeCells(1, 1, 1, 9);
        titleRow.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
        titleRow.alignment = { horizontal: "center", vertical: "middle" };
        titleRow.getCell(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF0F172A" }, // Slate-900
        };

        // 2. METADATA INFO
        wsRegister.addRow([]);
        const rangeText = `Date Range: ${filters.startDate || "All Time"} to ${filters.endDate || "Present"}`;
        const typeText = `Voucher Type: ${filters.transactionType === "1" ? "Trade Only" : filters.transactionType === "2" ? "Non-Trade Only" : "All Types"}`;
        const generatedText = `Generated On: ${format(new Date(), "yyyy-MM-dd HH:mm:ss")}`;
        
        const filterRow = wsRegister.addRow([rangeText, "", typeText, "", "", "", "", generatedText]);
        wsRegister.mergeCells(filterRow.number, 1, filterRow.number, 2);
        wsRegister.mergeCells(filterRow.number, 3, filterRow.number, 4);
        wsRegister.mergeCells(filterRow.number, 8, filterRow.number, 9);
        filterRow.font = { bold: true, size: 9, color: { argb: "FF64748B" } }; // Slate-500
        wsRegister.addRow([]);

        // 3. SUMMARY KPI CARDS
        const kpiHeaderRow = wsRegister.addRow(["EXECUTIVE METRICS SUMMARY"]);
        kpiHeaderRow.height = 20;
        wsRegister.mergeCells(kpiHeaderRow.number, 1, kpiHeaderRow.number, 4);
        kpiHeaderRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        kpiHeaderRow.alignment = { horizontal: "left", vertical: "middle" };
        kpiHeaderRow.getCell(1).fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FF2563EB" }, // Blue-600
        };

        const rate = data.totalDisbursed > 0 ? (data.totalPaid / data.totalDisbursed) * 100 : 0;
        const kpiRow1 = wsRegister.addRow(["Total Liabilities Accrued:", data.totalDisbursed, "Payout Release Rate:", rate / 100]);
        kpiRow1.getCell(2).numFmt = "₱#,##0.00";
        kpiRow1.getCell(4).numFmt = "0.0%";
        kpiRow1.eachCell((c, idx) => {
            c.border = borderStyle;
            if (idx === 1 || idx === 3) c.font = { bold: true, size: 9, color: { argb: "FF334155" } };
        });

        const kpiRow2 = wsRegister.addRow(["Total Cash Disbursed (Paid):", data.totalPaid, "Liability Pipeline Backlog:", data.totalUnpaidPayables]);
        kpiRow2.getCell(2).numFmt = "₱#,##0.00";
        kpiRow2.getCell(4).numFmt = "₱#,##0.00";
        kpiRow2.eachCell((c, idx) => {
            c.border = borderStyle;
            if (idx === 1 || idx === 3) c.font = { bold: true, size: 9, color: { argb: "FF334155" } };
        });

        wsRegister.addRow([]);

        // 4. MAIN DETAILS REGISTER TABLE
        const headerRow = wsRegister.addRow([
            "VOUCHER NO",
            "TRANS DATE",
            "PAYEE / SUPPLIER",
            "STATUS",
            "TOTAL VOUCHER AMOUNT",
            "TOTAL PAID AMOUNT",
            "SOURCE BANKS",
            "CHECK NUMBERS",
            "ALLOCATED COA EXPENSES"
        ]);
        headerRow.height = 24;
        headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
        headerRow.alignment = { horizontal: "left", vertical: "middle" };
        headerRow.eachCell((c, idx) => {
            c.fill = subHeaderFill;
            if (idx === 5 || idx === 6) {
                c.alignment = { horizontal: "right", vertical: "middle" };
            } else if (idx === 4) {
                c.alignment = { horizontal: "center", vertical: "middle" };
            }
        });

        // Add detail voucher rows
        data.vouchers.forEach((v) => {
            const row = wsRegister.addRow([
                v.docNo,
                v.transactionDate,
                v.payeeName.toUpperCase(),
                v.status.toUpperCase(),
                v.totalAmount,
                v.paidAmount,
                v.bankNames || "N/A",
                v.checkNumbers || "N/A",
                v.expenseAccountsHit || "N/A"
            ]);
            row.height = 18;
            row.getCell(5).numFmt = "₱#,##0.00";
            row.getCell(6).numFmt = "₱#,##0.00";

            row.eachCell((c, idx) => {
                c.border = borderStyle;
                c.font = { size: 9 };
                if (idx === 5 || idx === 6) {
                    c.alignment = { horizontal: "right" };
                } else if (idx === 4) {
                    c.alignment = { horizontal: "center" };
                }
            });
        });

        // Totals Row
        const totalRow = wsRegister.addRow([
            "TOTALS", "", "", "",
            data.vouchers.reduce((s, v) => s + v.totalAmount, 0),
            data.vouchers.reduce((s, v) => s + v.paidAmount, 0),
            "", "", ""
        ]);
        totalRow.height = 22;
        totalRow.font = { bold: true, size: 9.5 };
        wsRegister.mergeCells(totalRow.number, 1, totalRow.number, 4);
        totalRow.getCell(5).numFmt = "₱#,##0.00";
        totalRow.getCell(6).numFmt = "₱#,##0.00";
        totalRow.eachCell((c, idx) => {
            c.border = borderStyle;
            c.fill = highlightFill;
            if (idx === 5 || idx === 6) {
                c.alignment = { horizontal: "right", vertical: "middle" };
            }
        });

        // Set column widths
        wsRegister.getColumn(1).width = 16;
        wsRegister.getColumn(2).width = 13;
        wsRegister.getColumn(3).width = 30;
        wsRegister.getColumn(4).width = 13;
        wsRegister.getColumn(5).width = 20;
        wsRegister.getColumn(6).width = 20;
        wsRegister.getColumn(7).width = 20;
        wsRegister.getColumn(8).width = 20;
        wsRegister.getColumn(9).width = 35;


        // ----------------------------------------------------
        // SHEET 2: CHART OF ACCOUNTS (GL) BREAKDOWN
        // ----------------------------------------------------
        const wsAccounts = workbook.addWorksheet("GL Accounts Allocation");

        // Sheet Header
        const acctTitle = wsAccounts.addRow(["TREASURY CHART OF ACCOUNTS (GL) BREAKDOWN"]);
        acctTitle.height = 25;
        wsAccounts.mergeCells(1, 1, 1, 3);
        acctTitle.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        acctTitle.alignment = { horizontal: "left", vertical: "middle" };
        acctTitle.getCell(1).fill = headerFill;
        wsAccounts.addRow([]);

        // PAYMENT ACCOUNTS
        const payHeadRow = wsAccounts.addRow(["PAYMENT / BANK CASH ACCOUNTS (CREDITS OUTFLOW)"]);
        payHeadRow.height = 20;
        wsAccounts.mergeCells(payHeadRow.number, 1, payHeadRow.number, 3);
        payHeadRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
        payHeadRow.getCell(1).fill = subHeaderFill;

        const payTableHead = wsAccounts.addRow(["COA ID", "GL ACCOUNT TITLE", "TOTAL CASH OUTFLOW"]);
        payTableHead.font = { bold: true, size: 9 };
        payTableHead.getCell(3).alignment = { horizontal: "right" };

        const paymentExpenses = data.paymentCoaExpenses || [];
        paymentExpenses.forEach(p => {
            const row = wsAccounts.addRow([p.coaId, p.accountTitle || "N/A", p.totalExpense]);
            row.getCell(3).numFmt = "₱#,##0.00";
            row.eachCell((c, idx) => {
                c.border = borderStyle;
                c.font = { size: 9 };
                if (idx === 3) c.alignment = { horizontal: "right" };
            });
        });
        if (paymentExpenses.length === 0) {
            const r = wsAccounts.addRow(["N/A", "No payment accounts hit", 0]);
            r.getCell(3).numFmt = "₱#,##0.00";
            r.eachCell(c => c.border = borderStyle);
        }

        wsAccounts.addRow([]);
        wsAccounts.addRow([]);

        // EXPENSE ACCOUNTS
        const expHeadRow = wsAccounts.addRow(["PAYABLE & EXPENSE ACCOUNTS (DEBITS ACCRUED)"]);
        expHeadRow.height = 20;
        wsAccounts.mergeCells(expHeadRow.number, 1, expHeadRow.number, 3);
        expHeadRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
        expHeadRow.getCell(1).fill = subHeaderFill;

        const expTableHead = wsAccounts.addRow(["COA ID", "GL ACCOUNT TITLE", "TOTAL EXPENSE ACCRUED"]);
        expTableHead.font = { bold: true, size: 9 };
        expTableHead.getCell(3).alignment = { horizontal: "right" };

        const payableExpenses = data.payableCoaExpenses || [];
        payableExpenses.forEach(p => {
            const row = wsAccounts.addRow([p.coaId, p.accountTitle || "N/A", p.totalExpense]);
            row.getCell(3).numFmt = "₱#,##0.00";
            row.eachCell((c, idx) => {
                c.border = borderStyle;
                c.font = { size: 9 };
                if (idx === 3) c.alignment = { horizontal: "right" };
            });
        });
        if (payableExpenses.length === 0) {
            const r = wsAccounts.addRow(["N/A", "No expense accounts hit", 0]);
            r.getCell(3).numFmt = "₱#,##0.00";
            r.eachCell(c => c.border = borderStyle);
        }

        wsAccounts.getColumn(1).width = 12;
        wsAccounts.getColumn(2).width = 35;
        wsAccounts.getColumn(3).width = 22;


        // ----------------------------------------------------
        // SHEET 3: COST CENTER & DIVISION BREAKDOWN
        // ----------------------------------------------------
        const wsCostCenters = workbook.addWorksheet("Cost Centers Allocation");

        // Title
        const ccTitle = wsCostCenters.addRow(["COST CENTERS & DIVISIONS EXPENDITURES"]);
        ccTitle.height = 25;
        wsCostCenters.mergeCells(1, 1, 1, 3);
        ccTitle.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
        ccTitle.alignment = { horizontal: "left", vertical: "middle" };
        ccTitle.getCell(1).fill = headerFill;
        wsCostCenters.addRow([]);

        // EXPENSE DIVISION ALLOCATION (LINE-ITEM LEVEL)
        const lineDivHead = wsCostCenters.addRow(["EXPENSE DIVISION ALLOCATION (PAYABLE LINE LEVEL)"]);
        lineDivHead.height = 20;
        wsCostCenters.mergeCells(lineDivHead.number, 1, lineDivHead.number, 3);
        lineDivHead.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
        lineDivHead.getCell(1).fill = subHeaderFill;

        const lineDivTableHead = wsCostCenters.addRow(["DIVISION ID", "DIVISION NAME", "TOTAL LINE-LEVEL EXPENSE"]);
        lineDivTableHead.font = { bold: true, size: 9 };
        lineDivTableHead.getCell(3).alignment = { horizontal: "right" };

        const lineDivisions = data.payableDivisionExpenses || [];
        lineDivisions.forEach(div => {
            const row = wsCostCenters.addRow([div.divisionId || "N/A", div.divisionName || "N/A", div.totalExpense]);
            row.getCell(3).numFmt = "₱#,##0.00";
            row.eachCell((c, idx) => {
                c.border = borderStyle;
                c.font = { size: 9 };
                if (idx === 3) c.alignment = { horizontal: "right" };
            });
        });
        if (lineDivisions.length === 0) {
            const r = wsCostCenters.addRow(["N/A", "No line division breakdown", 0]);
            r.getCell(3).numFmt = "₱#,##0.00";
            r.eachCell(c => c.border = borderStyle);
        }

        wsCostCenters.addRow([]);
        wsCostCenters.addRow([]);

        // VOUCHER LEVEL COST CENTER HIERARCHY
        const headerDivHead = wsCostCenters.addRow(["VOUCHER COST CENTERS HIERARCHY (HEADER LEVEL)"]);
        headerDivHead.height = 20;
        wsCostCenters.mergeCells(headerDivHead.number, 1, headerDivHead.number, 3);
        headerDivHead.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 9.5 };
        headerDivHead.getCell(1).fill = subHeaderFill;

        const headerDivTableHead = wsCostCenters.addRow(["DIVISION / DEPARTMENT", "TYPE LEVEL", "TOTAL VOUCHERED AMOUNT"]);
        headerDivTableHead.font = { bold: true, size: 9 };
        headerDivTableHead.getCell(3).alignment = { horizontal: "right" };

        const divisionExpenses = data.divisionExpenses || [];
        divisionExpenses.forEach(div => {
            const dRow = wsCostCenters.addRow([div.divisionName, "DIVISION TOTAL", div.totalExpense]);
            dRow.getCell(3).numFmt = "₱#,##0.00";
            dRow.eachCell((c, idx) => {
                c.border = borderStyle;
                c.font = { bold: true, size: 9, color: { argb: "FF0F172A" } };
                if (idx === 3) c.alignment = { horizontal: "right" };
            });

            if (div.departments && div.departments.length > 0) {
                div.departments.forEach(dept => {
                    const deptRow = wsCostCenters.addRow([`  - ${dept.departmentName}`, "DEPARTMENT", dept.totalExpense]);
                    deptRow.getCell(3).numFmt = "₱#,##0.00";
                    deptRow.eachCell((c, idx) => {
                        c.border = borderStyle;
                        c.font = { size: 9, color: { argb: "FF475569" } }; // slate-600
                        if (idx === 3) c.alignment = { horizontal: "right" };
                    });
                });
            }
        });
        if (divisionExpenses.length === 0) {
            const r = wsCostCenters.addRow(["N/A", "No header cost center data", 0]);
            r.getCell(3).numFmt = "₱#,##0.00";
            r.eachCell(c => c.border = borderStyle);
        }

        wsCostCenters.getColumn(1).width = 25;
        wsCostCenters.getColumn(2).width = 18;
        wsCostCenters.getColumn(3).width = 22;

        // Write and Save
        const buffer = await workbook.xlsx.writeBuffer();
        const dateSuffix = format(new Date(), "yyyyMMdd-HHmmss");
        const fileTypeSuffix = filters.transactionType === "1" ? "Trade_" : filters.transactionType === "2" ? "NonTrade_" : "";
        
        saveAs(new Blob([buffer]), `Disbursements_${fileTypeSuffix}Report_${dateSuffix}.xlsx`);
        toast.success("Excel report exported successfully");
    } catch (err: unknown) {
        console.error("Failed to generate excel report", err);
        toast.error("Failed to export Excel report");
    }
}
