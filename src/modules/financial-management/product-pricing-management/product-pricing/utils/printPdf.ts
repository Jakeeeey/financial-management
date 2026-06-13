// src/modules/supply-chain-management/product-pricing-management/product-pricing/utils/printPdf.ts
import jsPDF from "jspdf";

import type { MatrixRow, Unit, PriceType } from "../types";
import { buildMatrixTierKeys, tierLabelForTierKey } from "./pivot";

type Options = {
    layout?: "table" | "cards";
    paper?: "a4" | "legal" | "a3";
    orientation?: "landscape" | "portrait";
    fontSize?: number;
    compact?: boolean;
    includeBarcode?: boolean;
    priceTypes?: PriceType[];
    tiers?: string[];
    units?: Unit[];
    usedUnitIds?: Set<number>;
};

function money(v: unknown): string {
    const n = Number(v);
    if (!Number.isFinite(n)) return "";
    return n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    });
}

const TIER_PALETTE: Array<{ fill: [number, number, number]; text: [number, number, number] }> = [
    { fill: [248, 250, 252], text: [30, 41, 59] },
    { fill: [240, 249, 255], text: [3, 105, 161] },
    { fill: [236, 253, 245], text: [4, 120, 87] },
    { fill: [245, 243, 255], text: [109, 40, 217] },
    { fill: [255, 251, 235], text: [180, 83, 9] },
    { fill: [255, 241, 242], text: [190, 18, 60] },
];

function tierPalette(index: number) {
    return TIER_PALETTE[index % TIER_PALETTE.length];
}

function textValue(v: unknown): string {
    const s = String(v ?? "").trim();
    return s || "-";
}

function drawPageFooter(doc: jsPDF) {
    const str = "Page " + doc.getCurrentPageInfo().pageNumber;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(str, 40, doc.internal.pageSize.getHeight() - 18);
}

function drawReportHeader(doc: jsPDF, args: { now: Date; total: number; layout: string }) {
    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.text("Product Pricing Matrix Report", 40, 40);
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Generated on: ${args.now.toLocaleDateString()} ${args.now.toLocaleTimeString()}`, 40, 55);
    doc.text(`Total Products: ${args.total}`, 40, 68);
    doc.text(`Layout: ${args.layout}`, 40, 81);
}

function unitLabel(unit: Unit | undefined, fallback: string) {
    return textValue(unit?.unit_shortcut || unit?.unit_name || fallback);
}

function renderPricingProductBlocksPdf(
    doc: jsPDF,
    rows: MatrixRow[],
    args: {
        layoutLabel: "Table" | "Cards";
        now: Date;
        includeBarcode: boolean;
        compact: boolean;
        fontSize: number;
        priceTypes: PriceType[];
        tiers: string[];
        usedUnits: Unit[];
    },
) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 40;
    const gap = 12;
    const columns = args.layoutLabel === "Table" ? 1 : pageWidth >= 760 ? 2 : 1;
    const cardWidth = (pageWidth - margin * 2 - gap * (columns - 1)) / columns;
    const lineHeight = args.compact ? 10 : 12;
    const cardPadding = args.compact ? 8 : 10;
    const pillHeight = args.compact ? 12 : 14;
    const tableHeaderHeight = args.compact ? 15 : 17;
    const tableRowHeight = args.compact ? 15 : 18;
    const topStart = 98;
    let x = margin;
    let y = topStart;
    let columnIndex = 0;

    drawReportHeader(doc, { now: args.now, total: rows.length, layout: args.layoutLabel });

    const addPage = () => {
        drawPageFooter(doc);
        doc.addPage();
        drawReportHeader(doc, { now: args.now, total: rows.length, layout: args.layoutLabel });
        x = margin;
        y = topStart;
        columnIndex = 0;
    };

    const advanceCardPosition = (height: number) => {
        if (columnIndex + 1 < columns) {
            columnIndex += 1;
            x = margin + columnIndex * (cardWidth + gap);
            return;
        }

        columnIndex = 0;
        x = margin;
        y += height + gap;
    };

    for (const row of rows) {
        const display = row.display;
        const unitsForRow =
            args.usedUnits.length > 0
                ? args.usedUnits
                : Object.keys(row.variantsByUnitId).map((unitId) => ({
                      unit_id: Number(unitId),
                      unit_name: `Unit ${unitId}`,
                      unit_shortcut: `U${unitId}`,
                  }));
        const printableUnits =
            unitsForRow.length > 0
                ? unitsForRow
                : [{ unit_id: 0, unit_name: "Price", unit_shortcut: "Price" }];

        const metaPills = [
            textValue(row.brand_name),
            textValue(row.category_name),
            `Code: ${textValue(display.product_code)}`,
            args.includeBarcode ? `Barcode: ${textValue(display.barcode)}` : "",
        ].filter(Boolean);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(args.fontSize);
        const pillRows: string[][] = [];
        let currentPillRow: string[] = [];
        let currentPillWidth = 0;
        const maxPillWidth = cardWidth - cardPadding * 2;
        for (const pill of metaPills) {
            const pillWidth = Math.min(maxPillWidth, doc.getTextWidth(pill) + 10);
            if (currentPillRow.length > 0 && currentPillWidth + pillWidth + 4 > maxPillWidth) {
                pillRows.push(currentPillRow);
                currentPillRow = [];
                currentPillWidth = 0;
            }
            currentPillRow.push(pill);
            currentPillWidth += pillWidth + 4;
        }
        if (currentPillRow.length > 0) pillRows.push(currentPillRow);

        const wrappedName = doc.splitTextToSize(textValue(display.product_name), cardWidth - cardPadding * 2);
        const tableHeight = tableHeaderHeight + args.tiers.length * tableRowHeight;

        const cardHeight =
            cardPadding * 2 +
            wrappedName.length * (lineHeight + 1) +
            Math.max(pillRows.length, 1) * (pillHeight + 3) +
            10 +
            tableHeight;

        if (y + cardHeight > pageHeight - 36) {
            addPage();
        }

        doc.setDrawColor(210, 210, 210);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "FD");

        let cursorY = y + cardPadding + 2;
        doc.setFontSize(args.fontSize + 2);
        doc.setTextColor(20);
        doc.setFont("helvetica", "bold");
        doc.text(wrappedName, x + cardPadding, cursorY);
        cursorY += wrappedName.length * (lineHeight + 1);

        doc.setFontSize(args.fontSize);
        doc.setFont("helvetica", "normal");
        for (const pillRow of pillRows) {
            let pillX = x + cardPadding;
            for (const pill of pillRow) {
                const pillWidth = Math.min(maxPillWidth, doc.getTextWidth(pill) + 10);
                doc.setFillColor(248, 250, 252);
                doc.setDrawColor(235, 235, 235);
                doc.roundedRect(pillX, cursorY - 8, pillWidth, pillHeight, 2, 2, "FD");
                doc.setTextColor(90);
                doc.text(pill, pillX + 5, cursorY);
                pillX += pillWidth + 4;
            }
            cursorY += pillHeight + 3;
        }

        cursorY += 5;
        const tableX = x + cardPadding;
        const tableWidth = cardWidth - cardPadding * 2;
        const tierColumnWidth = Math.min(88, tableWidth * 0.36);
        const unitCount = Math.max(printableUnits.length, 1);
        const unitColumnWidth = (tableWidth - tierColumnWidth) / unitCount;

        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(248, 250, 252);
        doc.rect(tableX, cursorY, tableWidth, tableHeaderHeight, "FD");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(args.fontSize);
        doc.setTextColor(40);
        doc.text("Price Type", tableX + 4, cursorY + tableHeaderHeight - 5);
        printableUnits.forEach((unit, index) => {
            const cellX = tableX + tierColumnWidth + index * unitColumnWidth;
            const label = unitLabel(unit, `Unit ${unit.unit_id}`);
            doc.text(
                doc.splitTextToSize(label, unitColumnWidth - 6)[0] ?? "-",
                cellX + 4,
                cursorY + tableHeaderHeight - 5,
            );
        });

        cursorY += tableHeaderHeight;
        doc.setFont("helvetica", "normal");
        args.tiers.forEach((tier, tierIndex) => {
            const rowY = cursorY + tierIndex * tableRowHeight;
            const palette = tierPalette(tierIndex);
            doc.setFillColor(...palette.fill);
            doc.setDrawColor(225, 225, 225);
            doc.rect(tableX, rowY, tableWidth, tableRowHeight, "FD");

            doc.setTextColor(...palette.text);
            doc.setFont("helvetica", "bold");
            doc.text(
                doc.splitTextToSize(tierLabelForTierKey(tier, args.priceTypes), tierColumnWidth - 6)[0] ?? "-",
                tableX + 4,
                rowY + tableRowHeight - 5,
            );

            doc.setFont("helvetica", "normal");
            doc.setTextColor(30);
            printableUnits.forEach((unit, index) => {
                const cellX = tableX + tierColumnWidth + index * unitColumnWidth;
                const variant = row.variantsByUnitId[Number(unit.unit_id)];
                const price = variant?.tiers?.[tier];
                doc.text(
                    price != null ? money(price) : "-",
                    cellX + unitColumnWidth - 4,
                    rowY + tableRowHeight - 5,
                    { align: "right" },
                );
                doc.setDrawColor(225, 225, 225);
                doc.line(cellX, rowY, cellX, rowY + tableRowHeight);
            });
        });

        advanceCardPosition(cardHeight);
    }

    drawPageFooter(doc);
}

export function generatePricingMatrixPdf(
    rows: MatrixRow[],
    opts: Options = {}
) {
    const paper = opts.paper ?? "a4";
    const orientation = opts.orientation ?? "landscape";
    const layout = opts.layout ?? "table";
    const includeBarcode = opts.includeBarcode ?? true;
    const compact = opts.compact ?? true;
    const usedUnitIds = opts.usedUnitIds ?? new Set();
    const unitsList = opts.units ?? [];
    const now = new Date();

    const doc = new jsPDF({ orientation, unit: "pt", format: paper });

    // Filter units that are actually used in the data
    const usedUnits = unitsList
        .filter(u => usedUnitIds.has(Number(u.unit_id)))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const priceTypesList = opts.priceTypes ?? [];
    const tiers = opts.tiers?.length ? opts.tiers : buildMatrixTierKeys(priceTypesList);

    renderPricingProductBlocksPdf(doc, rows, {
        layoutLabel: layout === "cards" ? "Cards" : "Table",
        now,
        includeBarcode,
        compact,
        fontSize: opts.fontSize || 7,
        priceTypes: priceTypesList,
        tiers,
        usedUnits,
    });
    doc.save(`Product_Pricing_Matrix_${now.toISOString().split("T")[0]}.pdf`);
    return;
}
