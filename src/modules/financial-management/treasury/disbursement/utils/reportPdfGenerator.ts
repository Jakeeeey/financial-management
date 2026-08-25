import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { DisbursementDashboardData, DashboardFilters } from "../types";

export const generateReportPDF = (
    data: DisbursementDashboardData | null,
    filters: DashboardFilters
) => {
    if (!data) return;

    const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4"
    });

    const primaryColor: [number, number, number] = [15, 23, 42]; // Slate-900 / Dark Navy
    const accentColor: [number, number, number] = [22, 163, 74]; // Emerald-600

    const formatMoney = (amount: number) => `PHP ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Page Numbering Function
    const addPageDecoration = (pdf: jsPDF, pageNum: number) => {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(148, 163, 184); // Gray-400
        // Footer: Page Number and Confidentiality
        pdf.text(`Page ${pageNum}`, 282, 202, { align: "right" });
        pdf.text("MEN2 MARKETING - CONFIDENTIAL TREASURY REPORT", 15, 202);
        pdf.setDrawColor(226, 232, 240); // Slate-200
        pdf.line(15, 198, 282, 198);
    };

    // --- PAGE 1: EXECUTIVE BRIEF & STATUS SUMMARY ---
    // Minimalist Branded Header
    doc.setFillColor(248, 250, 252); // Slate-50 background for header
    doc.rect(0, 0, 297, 32, "F");
    
    // Top border accent line
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 297, 3, "F");

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("MEN2 MARKETING", 15, 15);

    const typeLabel = filters.transactionType === "1" ? "TRADE" : filters.transactionType === "2" ? "NON-TRADE" : "ALL";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // Slate-500
    doc.text(`TREASURY OUTFLOWS REPORT (${typeLabel})`, 15, 22);

    // Period / Timestamp Metadata (Right-aligned)
    const nowStr = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    doc.text(`Generated At: ${nowStr}`, 282, 15, { align: "right" });
    
    const startStr = filters.startDate ? format(new Date(filters.startDate), "MMM dd, yyyy") : "All Time";
    const endStr = filters.endDate ? format(new Date(filters.endDate), "MMM dd, yyyy") : "Present";
    doc.text(`Period: ${startStr} - ${endStr}`, 282, 21, { align: "right" });
    
    const typeHeaderLabel = filters.transactionType === "1" ? "Trade Only" : filters.transactionType === "2" ? "Non-Trade Only" : "All Types";
    doc.text(`Type: ${typeHeaderLabel}`, 282, 27, { align: "right" });

    // --- KPI CARDS SECTION ---
    let startY = 44;
    const cardW = 85;
    const cardH = 22;
    const cardG = 8;
    const xOffsets = [15, 15 + cardW + cardG, 15 + (cardW + cardG) * 2];

    const kpis = [
        { title: "TOTAL VOUCHER LIABILITY", value: formatMoney(data.totalDisbursed), desc: "Liabilities Incurred in Period", border: primaryColor },
        { title: "TOTAL CASH OUTFLOW (PAID)", value: formatMoney(data.totalPaid), desc: "Released & Posted Payments", border: accentColor },
        { title: "OUTFLOW VOUCHERS COUNT", value: String(data.vouchers?.length || 0), desc: "Volume of Processed Vouchers", border: [147, 51, 234] }
    ];

    kpis.forEach((kpi, idx) => {
        const x = xOffsets[idx];
        doc.setFillColor(248, 250, 252);
        doc.rect(x, startY, cardW, cardH, "F");
        
        doc.setFillColor(kpi.border[0], kpi.border[1], kpi.border[2]);
        doc.rect(x, startY, 2, cardH, "F");

        doc.setTextColor(100, 116, 139);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(kpi.title, x + 6, startY + 5.5);

        doc.setTextColor(kpi.border[0], kpi.border[1], kpi.border[2]);
        doc.setFontSize(14);
        doc.text(kpi.value, x + 6, startY + 12);

        doc.setTextColor(148, 163, 184);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text(kpi.desc, x + 6, startY + 17.5);
    });

    startY += cardH + 12;

    // --- VOUCHER SUMMARY BY STATUS (PIPELINE) ---
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("VOUCHER SUMMARY BY PIPELINE STATUS", 15, startY - 2);

    const summaryData: Record<string, { count: number; total: number }> = {};
    (data.vouchers || []).forEach(v => {
        const status = v.status || "Draft";
        if (!summaryData[status]) {
            summaryData[status] = { count: 0, total: 0 };
        }
        summaryData[status].count += 1;
        summaryData[status].total += v.totalAmount || 0;
    });

    const summaryRows = Object.entries(summaryData).map(([status, stats]) => [
        status.toUpperCase(),
        String(stats.count),
        formatMoney(stats.total)
    ]);
    
    const totalCount = Object.values(summaryData).reduce((sum, r) => sum + r.count, 0);
    const totalSum = Object.values(summaryData).reduce((sum, r) => sum + r.total, 0);
    summaryRows.push(["TOTAL VOUCHER LIABILITY", String(totalCount), formatMoney(totalSum)]);

    autoTable(doc, {
        startY: startY,
        head: [["STATUS PIPELINE", "VOUCHERS COUNT", "TOTAL LIABILITY AMOUNT"]],
        body: summaryRows,
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8, fontStyle: "bold" },
        bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
        columnStyles: { 1: { halign: "center" }, 2: { halign: "right", fontStyle: "bold" } },
        margin: { left: 15, right: 15 },
        didParseCell: (cellData) => {
            if (cellData.row.index === summaryRows.length - 1) {
                cellData.cell.styles.fontStyle = "bold";
                if (cellData.column.index === 2) {
                    cellData.cell.styles.textColor = accentColor;
                }
            }
        }
    });

    addPageDecoration(doc, 1);

    // --- PAGE 2: CHART OF ACCOUNTS (GL) BREAKDOWNS ---
    doc.addPage();
    
    // Header text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("FINANCIAL CHART OF ACCOUNTS (GL) BREAKDOWN", 15, 15);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Summarized allocations for bank accounts (Cash Outflows) and expense accounts (Debits Accrued).", 15, 20);

    // PAYMENT COAS TABLE
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("PAYMENT / BANK ACCOUNTS (CREDITS OUTFLOW)", 15, 30);

    const paymentRows = (data.paymentCoaExpenses || []).map(p => [
        `GL #${p.coaId}`,
        p.accountTitle || "N/A",
        formatMoney(p.totalExpense)
    ]);

    autoTable(doc, {
        startY: 32,
        head: [["COA ID", "BANK / CASH ACCOUNT GL TITLE", "TOTAL CASH OUTFLOW"]],
        body: paymentRows.length > 0 ? paymentRows : [["N/A", "No payment account hit in period", "PHP 0.00"]],
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
        margin: { left: 15, right: 15 }
    });

    // PAYABLE COAS TABLE
    let nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    doc.text("PAYABLE & EXPENSE ACCOUNTS (DEBITS ACCRUED)", 15, nextY - 2);

    const payableRows = (data.payableCoaExpenses || []).map(p => [
        `GL #${p.coaId}`,
        p.accountTitle || "N/A",
        formatMoney(p.totalExpense)
    ]);

    autoTable(doc, {
        startY: nextY,
        head: [["COA ID", "EXPENSE / LIABILITY GL TITLE", "TOTAL EXPENSE ACCRUED"]],
        body: payableRows.length > 0 ? payableRows : [["N/A", "No expense account hit in period", "PHP 0.00"]],
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
        margin: { left: 15, right: 15 }
    });

    addPageDecoration(doc, 2);

    // --- PAGE 3: COST CENTER & DIVISION BREAKDOWNS ---
    doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("COST CENTERS & DIVISION ALIGNMENTS", 15, 15);
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("Breakdown of expenditures mapped to divisions (at line-level) and divisions/departments (at voucher header level).", 15, 20);

    // DYNAMIC EXPENSE DIVISION ALLOCATION (LINE BREAKDOWN)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("EXPENSE DIVISION ALLOCATION (LINE-ITEM LEVEL BREAKDOWN)", 15, 30);

    const divLineRows = (data.payableDivisionExpenses || []).map(div => [
        div.divisionName || "N/A",
        formatMoney(div.totalExpense)
    ]);

    autoTable(doc, {
        startY: 32,
        head: [["DIVISION (PAYABLE LINE EXPENSE CENTER)", "TOTAL ALLOCATED EXPENSE"]],
        body: divLineRows.length > 0 ? divLineRows : [["No line-level division data available", "PHP 0.00"]],
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
        margin: { left: 15, right: 15 }
    });

    // HEADER LEVEL DIVISIONS & DEPARTMENTS
    nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    doc.text("VOUCHER HEADER-LEVEL COST CENTER HIERARCHY", 15, nextY - 2);

    const divDeptRows: string[][] = [];
    (data.divisionExpenses || []).forEach(div => {
        divDeptRows.push([div.divisionName, "DIVISION TOTAL", formatMoney(div.totalExpense)]);
        if (div.departments && div.departments.length > 0) {
            div.departments.forEach(dept => {
                divDeptRows.push([`  - ${dept.departmentName}`, "DEPARTMENT", formatMoney(dept.totalExpense)]);
            });
        }
    });

    autoTable(doc, {
        startY: nextY,
        head: [["DIVISION / DEPARTMENT HIERARCHY", "TYPE LEVEL", "TOTAL VOUCHERED AMOUNT"]],
        body: divDeptRows.length > 0 ? divDeptRows : [["No cost center hierarchy hit", "N/A", "PHP 0.00"]],
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
        margin: { left: 15, right: 15 },
        didParseCell: (cellData) => {
            const rawVal = cellData.row.cells[1]?.text;
            const textStr = Array.isArray(rawVal) ? rawVal.join(" ") : String(rawVal || "");
            if (textStr === "DIVISION TOTAL") {
                cellData.cell.styles.fontStyle = "bold";
                cellData.cell.styles.textColor = primaryColor;
            } else if (textStr === "DEPARTMENT") {
                cellData.cell.styles.textColor = [100, 116, 139];
            }
        }
    });

    addPageDecoration(doc, 3);

    // --- PAGE 4: DETAILED OUTFLOW REGISTER & SIGNATURES ---
    doc.addPage();

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("DETAILED OUTFLOW REGISTER DETAILS", 15, 15);

    const detailHeaders = [
        "VOUCHER NO",
        "TRANS DATE",
        "PAYEE / SUPPLIER",
        "ALLOCATED GL EXPENSES",
        "STATUS",
        "TOTAL AMOUNT",
        "AMOUNT PAID"
    ];

    const detailRows = (data.vouchers || []).map(v => [
        v.docNo,
        v.transactionDate ? format(new Date(v.transactionDate), "yyyy-MM-dd") : "N/A",
        v.payeeName || "N/A",
        v.expenseAccountsHit || "N/A",
        (v.status || "Draft").toUpperCase(),
        v.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 }),
        v.paidAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })
    ]);

    autoTable(doc, {
        startY: 18,
        head: [detailHeaders],
        body: detailRows,
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 7.5, fontStyle: "bold" },
        bodyStyles: { fontSize: 7.5, textColor: [51, 65, 85] },
        columnStyles: {
            0: { cellWidth: 25, fontStyle: "bold" },
            1: { cellWidth: 20 },
            2: { cellWidth: 42 },
            3: { cellWidth: 83 },
            4: { cellWidth: 22, halign: "center" },
            5: { cellWidth: 32, halign: "right" },
            6: { cellWidth: 32, halign: "right", fontStyle: "bold" }
        },
        margin: { left: 15, right: 15 },
        styles: { overflow: "ellipsize" }
    });

    // --- CORPORATE SIGNATURE BLOCK ---
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
    let sigY = finalY;
    
    // Add new page if signature block does not fit on Page 4
    if (sigY > 165) {
        doc.addPage();
        sigY = 30;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("REPORT SIGN-OFF AND AUTHORIZATION", 15, 15);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(51, 65, 85);
    
    doc.text("Prepared By:", 15, sigY);
    doc.line(15, sigY + 12, 85, sigY + 12);
    doc.setFont("helvetica", "normal");
    doc.text("Treasury Officer", 15, sigY + 16);
    
    doc.setFont("helvetica", "bold");
    doc.text("Reviewed By:", 110, sigY);
    doc.line(110, sigY + 12, 180, sigY + 12);
    doc.setFont("helvetica", "normal");
    doc.text("Finance Manager / Auditor", 110, sigY + 16);
    
    doc.setFont("helvetica", "bold");
    doc.text("Approved By:", 210, sigY);
    doc.line(210, sigY + 12, 280, sigY + 12);
    doc.setFont("helvetica", "normal");
    doc.text("Chief Financial Officer", 210, sigY + 16);

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        addPageDecoration(doc, i);
    }

    // Save PDF
    const fileTypeSuffix = filters.transactionType === "1" ? "trade-" : filters.transactionType === "2" ? "non-trade-" : "";
    doc.save(`treasury-outflows-${fileTypeSuffix}report-${format(new Date(), "yyyyMMdd-HHmmss")}.pdf`);
};
