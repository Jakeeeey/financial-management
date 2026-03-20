// src/modules/supply-chain-management/product-pricing-management/product-pricing/utils/printPdf.ts
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import type { ProductRow, ProductTierKey, Unit } from "../types";

type Options = {
    paper?: "a4" | "legal" | "a3";
    orientation?: "landscape" | "portrait";
    fontSize?: number;
    compact?: boolean;
    includeBarcode?: boolean;
};

type PdfCell = {
    content: string;
    rowSpan?: number;
    colSpan?: number;
    styles?: {
        halign?: "left" | "center" | "right" | "justify";
    };
};

type AutoTableColumnStyle = {
    cellWidth?: number | "auto" | "wrap";
    halign?: "left" | "center" | "right" | "justify";
};

type AutoTableDoc = jsPDF & {
    lastAutoTable?: {
        finalY?: number;
    };
};

function safeStr(v: unknown): string {
    const s = String(v ?? "").trim();
    if (!s || s === "undefined" || s === "null") return "";
    return s;
}

function toNumberOrNull(v: unknown): number | null {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function money(v: unknown): string {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

function tierValue(p: ProductRow, tier: ProductTierKey): unknown {
    if (tier === "A") return p.priceA;
    if (tier === "B") return p.priceB;
    if (tier === "C") return p.priceC;
    if (tier === "D") return p.priceD;
    return p.priceE;
}

function buildGroupKey(p: ProductRow): number {
    const parentId = toNumberOrNull(p.parent_id);
    if (parentId !== null && parentId > 0) return parentId;

    const productId = Number(p.product_id);
    return Number.isFinite(productId) ? productId : 0;
}

function pickBase(items: ProductRow[]) {
    const parent = items.find((x) => x.parent_id == null);
    const base = parent ?? items[0];

    return {
        name: safeStr(base?.product_name) || "—",
        code: safeStr(base?.product_code) || "—",
        barcode: safeStr(base?.barcode) || "",
    };
}

export function generatePricingMatrixPdf(args: {
    rows: ProductRow[];
    filtersText: string;
    lookups: {
        unitName: (id: number | null | undefined) => string;
        units?: Unit[];
    };
    options?: Options;
}) {
    const { rows, filtersText, lookups } = args;
    const opts: Options = args.options ?? {};

    const paper = opts.paper ?? "a4";
    const orientation = opts.orientation ?? "landscape";
    const includeBarcode = opts.includeBarcode ?? true;
    const compact = opts.compact ?? true;

    const TIERS: ProductTierKey[] = ["A", "B", "C", "D", "E"];

    const doc = new jsPDF({ orientation, unit: "pt", format: paper }) as AutoTableDoc;

    const usedUnitIds = Array.from(
        new Set(
            (rows ?? [])
                .map((r) => toNumberOrNull(r.unit_of_measurement))
                .filter((n): n is number => n !== null && n > 0),
        ),
    );

    const usedUnits = usedUnitIds
        .map((id) => ({
            id,
            label: safeStr(lookups.unitName(id)) || String(id),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

    const now = new Date();
    const generated = `${now.toLocaleDateString()} ${now.toLocaleTimeString()}`;

    const groups = new Map<number, ProductRow[]>();

    for (const r of rows ?? []) {
        const key = buildGroupKey(r);
        const existing = groups.get(key);

        if (existing) {
            existing.push(r);
        } else {
            groups.set(key, [r]);
        }
    }

    const groupList = Array.from(groups.entries()).map(([key, items]) => {
        const byUnit = new Map<number, ProductRow>();

        for (const item of items) {
            const unitId = toNumberOrNull(item.unit_of_measurement);
            if (unitId !== null && unitId > 0) {
                byUnit.set(unitId, item);
            }
        }

        const base = pickBase(items);

        return {
            key,
            product_name: base.name,
            product_code: base.code,
            barcode: base.barcode,
            byUnit,
        };
    });

    groupList.sort((a, b) => a.product_name.localeCompare(b.product_name));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Product Pricing Matrix", 40, 36);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Generated: ${generated}`, doc.internal.pageSize.getWidth() - 220, 36);
    doc.text(filtersText ? `Filters: ${filtersText}` : "Filters: (none)", 40, 56);

    const uomCount = Math.max(usedUnits.length, 1);

    const headRow1: PdfCell[] = [
        { content: "Product", rowSpan: 2 },
        { content: "Code", rowSpan: 2 },
    ];

    if (includeBarcode) {
        headRow1.push({ content: "Barcode", rowSpan: 2 });
    }

    for (const tier of TIERS) {
        headRow1.push({
            content: tier,
            colSpan: uomCount,
            styles: { halign: "center" },
        });
    }

    const headRow2: PdfCell[] = [];

    for (let i = 0; i < TIERS.length; i += 1) {
        if (usedUnits.length === 0) {
            headRow2.push({
                content: "—",
                styles: { halign: "center" },
            });
            continue;
        }

        for (const unit of usedUnits) {
            headRow2.push({
                content: unit.label,
                styles: { halign: "center" },
            });
        }
    }

    const body: string[][] = groupList.map((group) => {
        const rowCells: string[] = [group.product_name, group.product_code];

        if (includeBarcode) {
            rowCells.push(group.barcode);
        }

        for (const tier of TIERS) {
            if (usedUnits.length === 0) {
                rowCells.push("");
                continue;
            }

            for (const unit of usedUnits) {
                const variant = group.byUnit.get(unit.id);
                rowCells.push(variant ? money(tierValue(variant, tier)) : "");
            }
        }

        return rowCells;
    });

    const pageW = doc.internal.pageSize.getWidth();
    const marginX = 24;

    const fixedProductW = Math.min(240, Math.max(180, pageW * 0.22));
    const fixedCodeW = 80;
    const fixedBarcodeW = includeBarcode ? 110 : 0;

    const fixedW = fixedProductW + fixedCodeW + fixedBarcodeW;
    const priceCols = TIERS.length * uomCount;
    const avail = Math.max(200, pageW - marginX * 2 - fixedW);
    const priceCellW = Math.max(34, Math.floor(avail / Math.max(1, priceCols)));

    const baselineFont = Number.isFinite(opts.fontSize) ? Number(opts.fontSize) : 6;
    const overloadFactor = priceCols > 20 ? 2 : priceCols > 16 ? 1 : 0;
    const fontSize = Math.max(5, Math.min(9, baselineFont - overloadFactor));

    const cellPadding = compact ? 3 : 5;

    const columnStyles: Record<number, AutoTableColumnStyle> = {
        0: { cellWidth: fixedProductW },
        1: { cellWidth: fixedCodeW },
    };

    if (includeBarcode) {
        columnStyles[2] = { cellWidth: fixedBarcodeW };
    }

    const startIdx = includeBarcode ? 3 : 2;
    for (let i = 0; i < priceCols; i += 1) {
        columnStyles[startIdx + i] = {
            cellWidth: priceCellW,
            halign: "right",
        };
    }

    autoTable(doc, {
        startY: 72,
        head: [headRow1, headRow2],
        body,
        theme: "grid",
        margin: { left: marginX, right: marginX },

        styles: {
            font: "helvetica",
            fontSize,
            cellPadding,
            overflow: "linebreak",
            valign: "middle",
            lineWidth: 0.4,
        },

        headStyles: {
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
        },

        columnStyles,

        didDrawPage: () => {
            const pageCount = doc.getNumberOfPages();
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const pageNumber = doc.getCurrentPageInfo().pageNumber;

            doc.setFontSize(8);
            doc.text(`Page ${pageNumber} of ${pageCount}`, pageWidth - 90, pageHeight - 16);
        },
    });

    doc.save("product-pricing-matrix.pdf");
}