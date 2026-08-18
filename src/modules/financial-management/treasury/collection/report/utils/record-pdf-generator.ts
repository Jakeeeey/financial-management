import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { RowInput } from "jspdf-autotable";
import type { CompanyProfile } from "../../company-profile";
import type { PouchReportDto } from "../hooks/useCollectionReport";
import {
    COLLECTION_PDF_MARGIN,
    drawCollectionPdfHeader,
    getCollectionPdfTableWidth,
} from "./pdf-header";

type AutoTableDocument = jsPDF & {
    lastAutoTable?: {
        finalY?: number;
    };
};

const formatAmount = (value?: number | null) =>
    "P " + Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 });

const formatSignedAmount = (value?: number | null) => {
    const amount = Number(value ?? 0);
    return (amount < 0 ? "-" : amount > 0 ? "+" : "") + formatAmount(Math.abs(amount));
};

const displayIdentifier = (value?: string | null) => value?.trim() || "\u2014";
const displayCustomer = (value?: string | null) => {
    const customer = value?.trim();
    return customer && !/^chk-/i.test(customer) ? customer : "N/A";
};

const formatDate = (value?: string | null) => {
    if (!value) return "\u2014";

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : format(date, "MM/dd/yyyy");
};

const getLastTableY = (doc: jsPDF, fallback: number) =>
    (doc as AutoTableDocument).lastAutoTable?.finalY ?? fallback;

function drawSectionTitle(doc: jsPDF, title: string, currentY: number): number {
    const pageHeight = doc.internal.pageSize.getHeight();
    if (currentY > pageHeight - 70) {
        doc.addPage();
        currentY = 40;
    }

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(title, 40, currentY);
    return currentY + 10;
}

function emptyTableRow(message: string, columnCount: number): RowInput {
    return [{
        content: message,
        colSpan: columnCount,
        styles: { halign: "center", textColor: [120, 120, 120], fontStyle: "italic" },
    }];
}

function addPageNumbers(doc: jsPDF): void {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageCount = (doc as any).internal.getNumberOfPages();

    for (let page = 1; page <= pageCount; page++) {
        doc.setPage(page);
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(150);
        doc.text("Page " + page + " of " + pageCount, pageWidth / 2, pageHeight - 20, { align: "center" });
    }
}

export function generateCollectionRecordPDF(
    pouch: PouchReportDto,
    companyProfile: CompanyProfile | null,
): void {
    const doc = new jsPDF("p", "pt", "a4");
    const tableWidth = getCollectionPdfTableWidth(doc);
    const printedOn = format(new Date(), "yyyy-MM-dd HH:mm");
    const netVariance = (pouch.overage || 0) - (pouch.shortage || 0);
    const totalAssets = (pouch.totalCash || 0) + (pouch.totalCheck || 0);

    let currentY = drawCollectionPdfHeader(
        doc,
        companyProfile,
        "Treasury Department - Collection Record",
    );

    autoTable(doc, {
        startY: currentY,
        body: [
            ["Document No.", displayIdentifier(pouch.docNo), "Collection Date", formatDate(pouch.date)],
            ["Status", pouch.isPosted ? "POSTED" : "DRAFT", "Printed On", printedOn],
            ["Total Assets", formatAmount(totalAssets), "Net Variance", formatSignedAmount(netVariance)],
            ["Net Invoices", formatAmount(pouch.invoiceNetTotal), "Memos / Returns", `${pouch.totalMemos} / ${pouch.totalReturns}`],
        ],
        theme: "plain",
        styles: { fontSize: 8, cellPadding: 4, lineColor: [226, 232, 240], lineWidth: 0.3 },
        columnStyles: {
            0: { fontStyle: "bold", fillColor: [240, 240, 240] },
            1: { fontStyle: "bold" },
            2: { fontStyle: "bold", fillColor: [240, 240, 240] },
            3: { fontStyle: "bold" },
        },
        margin: { left: COLLECTION_PDF_MARGIN, right: COLLECTION_PDF_MARGIN },
        tableWidth,
    });
    currentY = getLastTableY(doc, currentY) + 18;

    currentY = drawSectionTitle(doc, "Assets / Remittance", currentY);
    autoTable(doc, {
        startY: currentY,
        head: [["Asset", "Amount"]],
        body: [
            ["Physical Cash", formatAmount(pouch.totalCash)],
            ["Deposits (Checks)", formatAmount(pouch.totalCheck)],
            ["Total Assets / Total Remittance", formatAmount(totalAssets)],
        ],
        theme: "grid",
        headStyles: { fillColor: [46, 204, 113] },
        styles: { fontSize: 8, cellPadding: 4 },
        columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
        margin: { left: COLLECTION_PDF_MARGIN, right: COLLECTION_PDF_MARGIN },
        tableWidth,
    });
    currentY = getLastTableY(doc, currentY) + 18;

    currentY = drawSectionTitle(doc, "Deposits (Checks)", currentY);
    const checkRows: RowInput[] = pouch.checks.length > 0
        ? pouch.checks.map((check) => [
            displayIdentifier(check.bankName),
            displayIdentifier(check.checkNo),
            formatDate(check.chequeDate),
            displayCustomer(check.customerName),
            formatAmount(check.amount),
        ])
        : [emptyTableRow("No checks recorded.", 5)];

    autoTable(doc, {
        startY: currentY,
        head: [["Bank", "Check No.", "Check Date", "Customer", "Amount"]],
        body: checkRows,
        foot: [[
            { content: "Total Checks", colSpan: 4, styles: { halign: "right", fontStyle: "bold" } },
            { content: formatAmount(pouch.totalCheck), styles: { halign: "right", fontStyle: "bold" } },
        ]],
        theme: "grid",
        headStyles: { fillColor: [52, 152, 219] },
        styles: { fontSize: 8, cellPadding: 4 },
        columnStyles: { 4: { halign: "right", fontStyle: "bold" } },
        margin: { left: COLLECTION_PDF_MARGIN, right: COLLECTION_PDF_MARGIN },
        tableWidth,
    });
    currentY = getLastTableY(doc, currentY) + 18;

    currentY = drawSectionTitle(doc, "Accounts Settled (Invoices & Credits)", currentY);
    const invoiceRows: RowInput[] = pouch.invoices.length > 0
        ? pouch.invoices.map((invoice) => [
            displayIdentifier(invoice.invoiceNo),
            displayIdentifier(invoice.customerName),
            formatAmount(invoice.actualInvoiceTotal ?? invoice.invoiceTotal),
            formatAmount(invoice.invoiceTotal),
            formatAmount(invoice.grossAmount),
            formatSignedAmount(invoice.memoAmount),
            formatAmount(invoice.returnAmount),
            formatAmount(invoice.remainingBalance),
            formatAmount(invoice.netAmount),
        ])
        : [emptyTableRow("No invoices settled in this record.", 9)];

    autoTable(doc, {
        startY: currentY,
        head: [["Invoice No.", "Customer", "Gross Invoice", "Net Invoice", "Applied", "Memo", "Return", "Remaining", "Net Receivable"]],
        body: invoiceRows,
        foot: [[
            { content: "Total Net Receivable", colSpan: 8, styles: { halign: "right", fontStyle: "bold" } },
            { content: formatAmount(pouch.invoiceNetTotal), styles: { halign: "right", fontStyle: "bold" } },
        ]],
        theme: "grid",
        headStyles: { fillColor: [46, 204, 113] },
        styles: { fontSize: 6.5, cellPadding: 3 },
        columnStyles: {
            2: { halign: "right" },
            3: { halign: "right" },
            4: { halign: "right" },
            5: { halign: "right" },
            6: { halign: "right" },
            7: { halign: "right" },
            8: { halign: "right", fontStyle: "bold" },
        },
        margin: { left: COLLECTION_PDF_MARGIN, right: COLLECTION_PDF_MARGIN },
        tableWidth,
    });
    currentY = getLastTableY(doc, currentY) + 18;

    currentY = drawSectionTitle(doc, "Adjustments / Variances", currentY);
    const varianceRows: RowInput[] = pouch.variances.length > 0
        ? pouch.variances.map((variance) => [
            displayIdentifier(variance.type),
            displayIdentifier(variance.customerName),
            displayIdentifier(variance.invoiceNo),
            displayIdentifier(variance.accountTitle),
            displayIdentifier(variance.remarks),
            formatAmount(variance.amount),
        ])
        : [emptyTableRow("No adjustments or variances recorded.", 6)];

    autoTable(doc, {
        startY: currentY,
        head: [["Type", "Customer", "Invoice No.", "Account / Reason", "Remarks", "Amount"]],
        body: varianceRows,
        foot: [[
            { content: "Net Variance", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } },
            { content: formatSignedAmount(netVariance), styles: { halign: "right", fontStyle: "bold" } },
        ]],
        theme: "grid",
        headStyles: { fillColor: [155, 89, 182] },
        styles: { fontSize: 7, cellPadding: 3 },
        columnStyles: { 5: { halign: "right", fontStyle: "bold" } },
        margin: { left: COLLECTION_PDF_MARGIN, right: COLLECTION_PDF_MARGIN },
        tableWidth,
    });

    addPageNumbers(doc);
    doc.save("Collection_Record_" + (pouch.docNo || "unknown") + ".pdf");
}
