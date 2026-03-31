// src/modules/supply-chain-management/product-pricing-management/product-pricing/utils/printPdf.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import type { MatrixRow, ProductTierKey, Unit, PriceType } from "../types";

type Options = {
    paper?: "a4" | "legal" | "a3";
    orientation?: "landscape" | "portrait";
    fontSize?: number;
    compact?: boolean;
    includeBarcode?: boolean;
    priceTypes?: PriceType[];
    units?: Unit[];
    usedUnitIds?: Set<number>;
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

function money(v: unknown): string {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

const TIERS: ProductTierKey[] = ["A", "B", "C", "D", "E"];

const groupColors: Record<string, [number, number, number]> = {
    A: [240, 249, 255], // sky-50
    B: [236, 253, 245], // emerald-50
    C: [245, 243, 255], // violet-50
    D: [255, 251, 235], // amber-50
    E: [255, 241, 242], // rose-50
};

const groupTextColors: Record<string, [number, number, number]> = {
    A: [3, 105, 161],  // sky-700
    B: [4, 120, 87],   // emerald-700
    C: [109, 40, 217], // violet-700
    D: [180, 83, 9],   // amber-800
    E: [190, 18, 60],  // rose-700
};

export function generatePricingMatrixPdf(
    rows: MatrixRow[],
    opts: Options = {}
) {
    const paper = opts.paper ?? "a4";
    const orientation = opts.orientation ?? "landscape";
    const includeBarcode = opts.includeBarcode ?? true;
    const compact = opts.compact ?? true;
    const usedUnitIds = opts.usedUnitIds ?? new Set();
    const unitsList = opts.units ?? [];

    const doc = new jsPDF({ orientation, unit: "pt", format: paper });

    // Filter units that are actually used in the data
    const usedUnits = unitsList
        .filter(u => usedUnitIds.has(Number(u.unit_id)))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const uomCount = Math.max(usedUnits.length, 1);

    // --- Header Construction (3 Levels) ---
    const headRow1: PdfCell[] = [
        { content: "Product Details", colSpan: includeBarcode ? 5 : 4, styles: { halign: "center", fontStyle: "bold" } },
    ];

    for (const tier of TIERS) {
        headRow1.push({
            content: `PRICE TYPE ${tier}`,
            colSpan: uomCount,
            styles: { 
                halign: "center", 
                fillColor: groupColors[tier],
                textColor: groupTextColors[tier],
                fontStyle: "bold"
            },
        });
    }

    const headRow2: PdfCell[] = [
        { content: "Code", rowSpan: 2, styles: { valign: "middle" } },
        { content: "Barcode", rowSpan: 2, styles: { valign: "middle" } },
        { content: "Product Name", rowSpan: 2, styles: { valign: "middle" } },
        { content: "Category", rowSpan: 2, styles: { valign: "middle" } },
        { content: "Brand", rowSpan: 2, styles: { valign: "middle" } },
    ];

    if (!includeBarcode) headRow2.splice(1, 1);

    for (const tier of TIERS) {
        headRow2.push({
            content: `Tier ${tier}`,
            colSpan: uomCount,
            styles: { 
                halign: "center",
                fillColor: groupColors[tier],
                textColor: groupTextColors[tier]
            },
        });
    }

    const headRow3: PdfCell[] = [];
    for (const tier of TIERS) {
        if (usedUnits.length === 0) {
            headRow3.push({ content: "Price", styles: { halign: "center", fillColor: groupColors[tier] } });
        } else {
            for (const unit of usedUnits) {
                headRow3.push({
                    content: unit.unit_shortcut || unit.unit_name || "—",
                    styles: { 
                        halign: "center", 
                        fontSize: 7,
                        fillColor: groupColors[tier]
                    },
                });
            }
        }
    }

    // --- Body Construction ---
    const body: (string | number)[][] = rows.map((row) => {
        const display = row.display;
        const cells: (string | number)[] = [
            display.product_code || "—",
        ];
        if (includeBarcode) cells.push(display.barcode || "—");
        cells.push(display.product_name || "—");
        cells.push(row.category_name || "—");
        cells.push(row.brand_name || "—");

        for (const tier of TIERS) {
            if (usedUnits.length === 0) {
                cells.push(""); 
            } else {
                for (const unit of usedUnits) {
                    const variant = row.variantsByUnitId[Number(unit.unit_id)];
                    const price = variant?.tiers?.[tier];
                    cells.push(price != null ? money(price) : "—");
                }
            }
        }
        return cells;
    });

    const now = new Date();
    doc.setFontSize(14);
    doc.text("Product Pricing Matrix Report", 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated on: ${now.toLocaleDateString()} ${now.toLocaleTimeString()}`, 40, 55);
    doc.text(`Total Products: ${rows.length}`, 40, 68);

    autoTable(doc, {
        startY: 85,
        head: [headRow1, headRow2, headRow3],
        body,
        theme: "grid",
        styles: {
            fontSize: opts.fontSize || 7,
            cellPadding: compact ? 3 : 5,
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
            0: { cellWidth: 60 }, // Code
            1: includeBarcode ? { cellWidth: 80 } : { cellWidth: 151 }, // Barcode or Name expansion
            2: { cellWidth: includeBarcode ? 140 : 180 }, // Name
            3: { cellWidth: 70 }, // Category
            4: { cellWidth: 70 }, // Brand
        },
        didParseCell: (data) => {
            if (data.section === "body" && data.column.index >= (includeBarcode ? 5 : 4)) {
                const tierIdx = Math.floor((data.column.index - (includeBarcode ? 5 : 4)) / uomCount);
                const tier = TIERS[tierIdx];
                if (tier) {
                    data.cell.styles.fillColor = groupColors[tier];
                    data.cell.styles.halign = "right";
                }
            }
        },
        didDrawPage: (data) => {
            const str = "Page " + doc.getCurrentPageInfo().pageNumber;
            doc.setFontSize(8);
            doc.text(str, data.settings.margin.left, doc.internal.pageSize.getHeight() - 10);
        }
    });

    doc.save(`Product_Pricing_Matrix_${now.toISOString().split("T")[0]}.pdf`);
}