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

    const primaryColor: [number, number, number] = [15, 23, 42]; // Slate-900 / dark branding
    const accentColor: [number, number, number] = [22, 163, 74]; // Emerald-600

    // --- Header ---
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 297, 40, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("MEN2 MARKETING", 15, 16);

    const typeLabel = filters.transactionType === "1" ? "TRADE" : filters.transactionType === "2" ? "NON-TRADE" : "ALL";
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(200, 200, 200);
    doc.text(`TREASURY OUTFLOWS REPORT (${typeLabel})`, 15, 23);

    // Date Generated & Filters info
    const nowStr = format(new Date(), "yyyy-MM-dd HH:mm:ss");
    doc.text(`Generated At: ${nowStr}`, 220, 16);
    
    const startStr = filters.startDate ? format(new Date(filters.startDate), "MMM dd, yyyy") : "All Time";
    const endStr = filters.endDate ? format(new Date(filters.endDate), "MMM dd, yyyy") : "Present";
    doc.text(`Period: ${startStr} - ${endStr}`, 220, 23);
    
    const typeHeaderLabel = filters.transactionType === "1" ? "Trade Only" : filters.transactionType === "2" ? "Non-Trade Only" : "All Types";
    doc.text(`Type: ${typeHeaderLabel}`, 220, 30);

    // --- KPI Cards ---
    let startY = 50;
    
    // Draw three KPI card shapes
    const cardW = 85;
    const cardH = 22;
    const cardG = 8;
    const xOffsets = [15, 15 + cardW + cardG, 15 + (cardW + cardG) * 2];

    const formatMoney = (amount: number) => `PHP ${(amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const kpis = [
        { title: "TOTAL CASH OUTFLOW", value: formatMoney(data.totalPaid), desc: "Released & Posted Payments", border: primaryColor },
        { title: "OUTFLOW TRANSACTIONS", value: String(data.vouchers?.length || 0), desc: "Volume of Outflow Vouchers", border: accentColor },
        { title: "AVERAGE OUTFLOW SIZE", value: formatMoney(data.vouchers?.length ? data.totalPaid / data.vouchers.length : 0), desc: "Average Value per Outflow", border: [147, 51, 234] }
    ];

    kpis.forEach((kpi, idx) => {
        const x = xOffsets[idx];
        // Draw card background
        doc.setFillColor(248, 250, 252);
        doc.rect(x, startY, cardW, cardH, "F");
        
        // Left thick accent border
        doc.setFillColor(kpi.border[0], kpi.border[1], kpi.border[2]);
        doc.rect(x, startY, 2, cardH, "F");

        // KPI text
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

    // --- Status Outflow Summary Table ---
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("OUTFLOW SUMMARY BY STATUS", 15, startY - 2);

    const summaryData: Record<string, { count: number; total: number }> = {
        "Released": { count: 0, total: 0 },
        "Posted": { count: 0, total: 0 }
    };
    (data.vouchers || []).forEach(v => {
        const status = v.status || "";
        if (status === "Released" || status === "Posted") {
            summaryData[status].count += 1;
            summaryData[status].total += v.paidAmount || 0;
        }
    });

    const summaryRows = Object.entries(summaryData).map(([status, stats]) => [
        status.toUpperCase(),
        String(stats.count),
        formatMoney(stats.total)
    ]);
    
    // Add total row
    const totalCount = Object.values(summaryData).reduce((sum, r) => sum + r.count, 0);
    const totalSum = Object.values(summaryData).reduce((sum, r) => sum + r.total, 0);
    summaryRows.push(["TOTAL OUTFLOWS", String(totalCount), formatMoney(totalSum)]);

    autoTable(doc, {
        startY: startY,
        head: [["STATUS", "VOUCHERS COUNT", "TOTAL PAID AMOUNT"]],
        body: summaryRows,
        theme: "striped",
        headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: "bold"
        },
        bodyStyles: {
            fontSize: 8,
            textColor: [51, 65, 85]
        },
        columnStyles: {
            1: { halign: "center" },
            2: { halign: "right", fontStyle: "bold" }
        },
        margin: { left: 15, right: 15 },
        didParseCell: (cellData) => {
            // Bold the total row
            if (cellData.row.index === summaryRows.length - 1) {
                cellData.cell.styles.fontStyle = "bold";
                if (cellData.column.index === 2) {
                    cellData.cell.styles.textColor = accentColor;
                }
            }
        }
    });

    // --- Tab 1: Payment Cash Accounts ---
    let nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("PAYMENT ACCOUNTS OUTFLOWS", 15, nextY - 2);

    const paymentRows = (data.paymentCoaExpenses || []).map(p => [
        `GL #${p.coaId}`,
        p.accountTitle || "N/A",
        formatMoney(p.totalExpense)
    ]);

    autoTable(doc, {
        startY: nextY,
        head: [["COA ID", "ACCOUNT TITLE", "TOTAL CASH OUTFLOW"]],
        body: paymentRows.length > 0 ? paymentRows : [["N/A", "No payment data available", "PHP 0.00"]],
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
        margin: { left: 15, right: 15 }
    });

    // --- Tab 2: Payable Expense Accounts ---
    nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    doc.text("PAYABLE EXPENSE ACCOUNTS", 15, nextY - 2);

    const payableRows = (data.payableCoaExpenses || []).map(p => [
        `GL #${p.coaId}`,
        p.accountTitle || "N/A",
        formatMoney(p.totalExpense)
    ]);

    autoTable(doc, {
        startY: nextY,
        head: [["COA ID", "ACCOUNT TITLE", "TOTAL EXPENSE ACCRUED"]],
        body: payableRows.length > 0 ? payableRows : [["N/A", "No payable data available", "PHP 0.00"]],
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
        margin: { left: 15, right: 15 }
    });

    // --- Tab 3: Divisions & Departments ---
    nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    doc.text("DIVISIONS & DEPARTMENTS OUTFLOWS", 15, nextY - 2);

    const divDeptRows: string[][] = [];
    (data.divisionExpenses || []).forEach(div => {
        divDeptRows.push([div.divisionName, "DIV TOTAL", formatMoney(div.totalExpense)]);
        if (div.departments && div.departments.length > 0) {
            div.departments.forEach(dept => {
                divDeptRows.push([`  - ${dept.departmentName}`, "DEPT", formatMoney(dept.totalExpense)]);
            });
        }
    });

    autoTable(doc, {
        startY: nextY,
        head: [["DIVISION / DEPARTMENT", "TYPE", "TOTAL AMOUNT"]],
        body: divDeptRows.length > 0 ? divDeptRows : [["N/A", "N/A", "PHP 0.00"]],
        theme: "striped",
        headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 2: { halign: "right", fontStyle: "bold" } },
        margin: { left: 15, right: 15 },
        didParseCell: (cellData) => {
            const rawVal = cellData.row.cells[1]?.text;
            const textStr = Array.isArray(rawVal) ? rawVal.join(" ") : String(rawVal || "");
            if (textStr === "DIV TOTAL") {
                cellData.cell.styles.fontStyle = "bold";
                cellData.cell.styles.textColor = primaryColor;
            } else if (textStr === "DEPT") {
                cellData.cell.styles.textColor = [100, 116, 139] as [number, number, number];
            }
        }
    });

    // --- Outflow Details Master Table ---
    nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
    
    // Add page break if it exceeds landscape height
    if (nextY > 165) {
        doc.addPage();
        nextY = 20;
    }

    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("OUTFLOW REGISTER DETAILS", 15, nextY - 2);

    const detailHeaders = [
        "DOC NO",
        "DATE",
        "PAYEE",
        "GL ACCOUNTS HIT",
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
        startY: nextY,
        head: [detailHeaders],
        body: detailRows,
        theme: "striped",
        headStyles: {
            fillColor: primaryColor,
            textColor: [255, 255, 255],
            fontSize: 8,
            fontStyle: "bold"
        },
        bodyStyles: {
            fontSize: 7.5,
            textColor: [51, 65, 85]
        },
        columnStyles: {
            0: { cellWidth: 25, fontStyle: "bold" },
            1: { cellWidth: 22 },
            2: { cellWidth: 40 },
            3: { cellWidth: 80 },
            4: { cellWidth: 20, halign: "center" },
            5: { cellWidth: 35, halign: "right" },
            6: { cellWidth: 35, halign: "right", fontStyle: "bold" }
        },
        margin: { left: 15, right: 15 },
        styles: {
            overflow: "ellipsize",
            cellWidth: "auto"
        }
    });

    // Save document
    const fileTypeSuffix = filters.transactionType === "1" ? "trade-" : filters.transactionType === "2" ? "non-trade-" : "";
    doc.save(`treasury-outflows-${fileTypeSuffix}report-${format(new Date(), "yyyyMMdd-HHmmss")}.pdf`);
};
