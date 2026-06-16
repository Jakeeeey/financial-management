import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import type { MatrixRow } from "../../product-pricing/types";
import { flattenListCostMatrixRows } from "../../shared/supplier-batch/flattenPrintMatrix";

function formatMoney(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return "";
    return Number(value).toLocaleString("en-PH", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export function exportSupplierListCostPdf(args: {
    supplierName: string;
    matrixRows: MatrixRow[];
}) {
    const { supplierName, matrixRows } = args;
    const flatRows = flattenListCostMatrixRows(matrixRows);
    const generatedAt = new Date();

    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const margin = 28;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Supplier List Cost Report", margin, margin);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Supplier: ${supplierName}`, margin, margin + 14);
    doc.text(
        `Generated: ${generatedAt.toLocaleDateString()} ${generatedAt.toLocaleTimeString()}  |  Products: ${flatRows.length}`,
        margin,
        margin + 26,
    );
    doc.setTextColor(20);

    autoTable(doc, {
        startY: margin + 36,
        head: [["Product Code", "Barcode", "Product Name", "Unit ID", "Current List Cost", "Proposed List Cost"]],
        body: flatRows.map((row) => [
            row.product_code ?? "",
            row.barcode ?? "",
            row.product_name,
            row.unit_id != null ? String(row.unit_id) : "",
            formatMoney(row.current_list_cost),
            "",
        ]),
        styles: { fontSize: 7, cellPadding: 3 },
        headStyles: { fillColor: [30, 41, 59], textColor: 255 },
        margin: { left: margin, right: margin },
    });

    doc.save(`list-cost-${supplierName.replace(/[<>:"/\\|?*]+/g, "_").trim() || "supplier"}.pdf`);
}
