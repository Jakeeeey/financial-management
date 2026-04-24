// src/modules/financial-management/printables-management/product-printables/utils/printPdf.ts

import type { MatrixRow, PriceType, Unit, Supplier } from "../types";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { PdfTemplate } from "@/components/pdf-layout-design/services/pdf-template";
import { PdfData } from "@/components/pdf-layout-design/types";

type MatrixOptions = {
    paper?: string;
    orientation?: "landscape" | "portrait";
    fontSize?: number;
    title?: string;
    priceTypes?: PriceType[];
    units?: Unit[];
    usedUnitIds?: Set<number>;
    supplier?: Supplier | null;
    selectedTemplate?: PdfTemplate;
    companyData?: PdfData | null;
    selectedPriceTypeIds?: string[];
    printedBy?: string;
    filterSummary?: string;
};

type PdfCell = {
    content: string;
    rowSpan?: number;
    colSpan?: number;
    styles?: {
        halign?: "left" | "center" | "right" | "justify";
        valign?: "top" | "middle" | "bottom";
        fillColor?: [number, number, number];
        textColor?: [number, number, number];
        fontStyle?: "normal" | "bold" | "italic" | "bolditalic";
        fontSize?: number;
    };
};

const TIERS = ["A", "B", "C", "D", "E"] as const;

const groupColors: Record<string, [number, number, number]> = {
    ListPrice: [243, 244, 246], // gray-100
    A: [240, 249, 255], // sky-50
    B: [236, 253, 245], // emerald-50
    C: [245, 243, 255], // violet-50
    D: [255, 251, 235], // amber-50
    E: [255, 241, 242], // rose-50
};

const groupTextColors: Record<string, [number, number, number]> = {
    ListPrice: [75, 85, 99], // gray-600
    A: [3, 105, 161],  // sky-700
    B: [4, 120, 87],   // emerald-700
    C: [109, 40, 217], // violet-700
    D: [180, 83, 9],   // amber-800
    E: [190, 18, 60],  // rose-700
};

function money(v: unknown): string {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

export async function generateProductMatrixPdf(rows: MatrixRow[], options: MatrixOptions = {}) {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const { drawPageNumbers } = await import("@/components/pdf-layout-design/PdfGenerator");
    const {
        fontSize = 7,
        title = "Product Matrix Report",
        units = [],
        usedUnitIds = new Set(),
        supplier = null,
        selectedTemplate,
        companyData,
        selectedPriceTypeIds = [],
        priceTypes = [],
        printedBy = "System User",
        filterSummary = ""
    } = options;

    const allPriceTypes = priceTypes || [];

    // Determine active tiers based on selection
    // Map -1 to "ListPrice" and others to A-E based on their position among non-synthetic types
    const activeTiers = allPriceTypes.length > 0
        ? allPriceTypes
            .filter(pt => selectedPriceTypeIds.length === 0 || selectedPriceTypeIds.includes(String(pt.price_type_id)))
            .map(pt => {
                if (pt.price_type_id === -1) {
                    return { key: "ListPrice" as const, label: pt.price_type_name };
                }
                const nonSynthetic = allPriceTypes.filter(p => p.price_type_id !== -1);
                const idx = nonSynthetic.findIndex(p => p.price_type_id === pt.price_type_id);
                return {
                    key: (TIERS[idx] || "A") as typeof TIERS[number],
                    label: pt.price_type_name
                };
            })
            .filter(t => t.key != null)
        : TIERS.map((key, i) => ({
            key,
            label: allPriceTypes?.[i]?.price_type_name || `PRICE TYPE ${key}`
        })).slice(0, 5);

    const usedUnits = units
        .filter(u => usedUnitIds.has(Number(u.unit_id)))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const uomCount = Math.max(usedUnits.length, 1);
    const now = new Date();

    // --- Dynamic Layout Optimization ---
    const totalCols = 3 + (activeTiers.length * uomCount);
    let dynamicFontSize = fontSize;
    let dynamicPadding = 1.0;
    let nameW = 56;
    let extraW = 28;

    if (totalCols > 15) {
        dynamicFontSize = 6;
        dynamicPadding = 0.8;
        nameW = 45;
        extraW = 24;
    }
    if (totalCols > 25) {
        dynamicFontSize = 5.5;
        dynamicPadding = 0.6;
        nameW = 40;
        extraW = 20;
    }

    // --- Extract config from template ---
    const tplConfig = selectedTemplate?.config;

    // Paper size: template uses e.g. "Letter", jsPDF also accepts these strings
    const finalPaper = tplConfig?.paperSize.toLowerCase() || options.paper || "a4";
    const finalOrientation = tplConfig?.orientation || options.orientation || "landscape";

    // Margins: prefer template config, fallback to default
    const finalMargins = tplConfig?.margins || { top: 10, left: 10, right: 10, bottom: 10 };

    // Body start Y (below header elements)
    const bodyEnd = tplConfig?.bodyEnd;

    const doc = new jsPDF({ orientation: finalOrientation, unit: "mm", format: finalPaper });

    // --- Header Construction (2 rows) ---
    const headRow1: PdfCell[] = [
        { content: "Brand", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
        { content: "Category", rowSpan: 2, styles: { valign: "middle", halign: "center" } },
        { content: "Product Name", rowSpan: 2, styles: { valign: "middle", fontStyle: "bold", halign: "center" } },
    ];

    for (const tier of activeTiers) {
        headRow1.push({
            content: tier.label,
            colSpan: uomCount,
            styles: {
                halign: "center",
                fillColor: groupColors[tier.key] || [245, 245, 245],
                textColor: groupTextColors[tier.key] || [50, 50, 50],
                fontStyle: "bold"
            },
        });
    }

    // Row 2: UOM names per tier
    const headRow2: PdfCell[] = [];
    for (const tier of activeTiers) {
        if (usedUnits.length === 0) {
            headRow2.push({ content: "Price", styles: { halign: "center", fillColor: groupColors[tier.key] } });
        } else {
            for (const unit of usedUnits) {
                headRow2.push({
                    content: unit.unit_shortcut || unit.unit_name || "—",
                    styles: {
                        halign: "center",
                        fontSize: Math.max(dynamicFontSize - 1, 5),
                        fillColor: groupColors[tier.key]
                    },
                });
            }
        }
    }

    // --- Body Construction ---
    const body = rows.map((row) => {
        const cells: (string | PdfCell)[] = [
            row.brand_name || "—",
            row.category_name || "—",
            { content: row.display.product_name || "—", styles: { fontStyle: "bold" } }
        ];

        for (const tier of activeTiers) {
            if (usedUnits.length === 0) {
                cells.push("—");
            } else {
                for (const unit of usedUnits) {
                    const variant = row.variantsByUnitId[Number(unit.unit_id)];
                    const price = variant?.tiers?.[tier.key];
                    cells.push(price != null ? money(price) : "—");
                }
            }
        }
        return cells;
    });

    const generated = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

    let y = 40;

    if (selectedTemplate) {
        let templateHeaderEnd = await PdfEngine.applyTemplate(doc, selectedTemplate.name, companyData || null);
        if (tplConfig?.bodyStart != null) {
            templateHeaderEnd = tplConfig.bodyStart;
        }

        // Create a clear gap for metadata and push table down
        const metadataHeight = filterSummary ? 12 : 8;
        const metadataTop = templateHeaderEnd - 3; // Shift up to hug the header line
        y = metadataTop + metadataHeight + 1; // Table starts immediately after metadata

        // Add metadata even with template
        doc.setFontSize(8.5);
        doc.setTextColor(60);

        let currentX = finalMargins.left;

        // Add a subtle title for the metadata section
        doc.setFont("helvetica", "bold");
        doc.text("REPORT INFORMATION", currentX, metadataTop);

        doc.setDrawColor(220);
        doc.setLineWidth(0.2);
        doc.line(currentX, metadataTop + 2, doc.internal.pageSize.getWidth() - finalMargins.right, metadataTop + 2);

        const metaLineY = metadataTop + 7;
        doc.setFont("helvetica", "bold");
        doc.text("Printed Date:", currentX, metaLineY);
        currentX += doc.getTextWidth("Printed Date: ") + 1.5;
        doc.setFont("helvetica", "normal");
        doc.text(generated, currentX, metaLineY);
        currentX += doc.getTextWidth(generated) + 8;

        doc.setFont("helvetica", "bold");
        doc.text("Generated By:", currentX, metaLineY);
        currentX += doc.getTextWidth("Generated By: ") + 1.5;
        doc.setFont("helvetica", "normal");
        doc.text(printedBy, currentX, metaLineY);

        if (filterSummary) {
            const filterY = metaLineY + 5;
            doc.setFont("helvetica", "bold");
            doc.text("Active Criteria:", finalMargins.left, filterY);
            doc.setFont("helvetica", "normal");
            const filterX = finalMargins.left + doc.getTextWidth("Active Criteria: ") + 1.5;
            const splitFilters = doc.splitTextToSize(filterSummary, doc.internal.pageSize.getWidth() - filterX - finalMargins.right);
            doc.text(splitFilters, filterX, filterY);
        }

        // Reset for table
        doc.setFont("helvetica", "normal");
    } else {
        doc.setFontSize(22);
        doc.setTextColor(0, 51, 102); // Professional Dark Blue
        doc.setFont("helvetica", "bold");
        doc.text(title.toUpperCase(), finalMargins.left, finalMargins.top + 5);

        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.setFont("helvetica", "normal");
        doc.text("OFFICIAL PRODUCT PRICING MATRIX REPORT", finalMargins.left, finalMargins.top + 11);

        y = finalMargins.top + 20;

        // Metadata Block
        doc.setDrawColor(230);
        doc.setFillColor(248, 250, 252);
        const metaHeight = filterSummary ? 18 : 12;
        doc.roundedRect(finalMargins.left, y - 5, doc.internal.pageSize.getWidth() - finalMargins.left - finalMargins.right, metaHeight, 1, 1, "FD");

        doc.setFontSize(9);
        doc.setTextColor(70);

        let currentX = finalMargins.left + 5;
        doc.setFont("helvetica", "bold");
        doc.text("REPORT DATE:", currentX, y);
        currentX += doc.getTextWidth("REPORT DATE: ") + 2;
        doc.setFont("helvetica", "normal");
        doc.text(generated, currentX, y);
        currentX += doc.getTextWidth(generated) + 12;

        doc.setFont("helvetica", "bold");
        doc.text("PREPARED BY:", currentX, y);
        currentX += doc.getTextWidth("PREPARED BY: ") + 2;
        doc.setFont("helvetica", "normal");
        doc.text(printedBy, currentX, y);

        if (filterSummary) {
            y += 6;
            doc.setFont("helvetica", "bold");
            doc.text("FILTER CRITERIA:", finalMargins.left + 5, y);
            doc.setFont("helvetica", "normal");
            const filterX = finalMargins.left + 5 + doc.getTextWidth("FILTER CRITERIA: ") + 2;
            const splitFilters = doc.splitTextToSize(filterSummary, doc.internal.pageSize.getWidth() - filterX - finalMargins.right - 5);
            doc.text(splitFilters, filterX, y);
            y += (splitFilters.length * 3.5);
        } else {
            y += 4;
        }

        y += 5;

        if (supplier) {
            doc.setFontSize(10);
            doc.setTextColor(0);
            doc.setFont("helvetica", "bold");
            doc.text(supplier.supplier_name, finalMargins.left, y);
            y += 4;

            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            doc.setTextColor(80);

            const details: string[] = [];
            if (supplier.address) details.push(`Address: ${supplier.address}`);
            if (supplier.tin_number) details.push(`TIN: ${supplier.tin_number}`);
            if (supplier.contact_person) details.push(`Contact: ${supplier.contact_person}`);
            if (supplier.phone_number) details.push(`Phone: ${supplier.phone_number}`);

            if (details.length > 0) {
                doc.text(details.join("  |  "), finalMargins.left, y);
                y += 4;
            }
        }
    }

    autoTable(doc, {
        startY: y + 1,
        head: [headRow1, headRow2],
        body,
        theme: "grid",
        styles: {
            fontSize: dynamicFontSize,
            cellPadding: dynamicPadding,
            valign: "middle",
            lineWidth: 0.5,
            lineColor: [200, 200, 200],
        },
        headStyles: {
            fillColor: [245, 245, 245],
            textColor: [50, 50, 50],
            fontStyle: "bold",
        },
        columnStyles: {
            0: { cellWidth: extraW },
            1: { cellWidth: extraW },
            2: { cellWidth: nameW }
        },
        margin: {
            left: finalMargins.left,
            right: finalMargins.right,
            top: finalMargins.top,
            bottom: bodyEnd != null
                ? (doc.internal.pageSize.getHeight() - bodyEnd)
                : finalMargins.bottom
        },
        didParseCell: (data) => {
            if (data.section === "body" && data.column.index >= 3) {
                const tierIdx = Math.floor((data.column.index - 3) / uomCount);
                const tier = activeTiers[tierIdx];
                if (tier) {
                    data.cell.styles.fillColor = groupColors[tier.key];
                    data.cell.styles.halign = "right";
                }
            }
        },
        didDrawPage: (data) => {
            if (selectedTemplate?.config?.pageNumber?.show) {
                drawPageNumbers(doc, selectedTemplate.config);
            } else {
                const str = "Page " + doc.getCurrentPageInfo().pageNumber;
                doc.setFontSize(8);
                doc.text(str, data.settings.margin.left, doc.internal.pageSize.getHeight() - 4);
            }
        }
    });

    doc.save(`Product_Printables_Matrix_${now.getTime()}.pdf`);
}
