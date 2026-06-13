// src/modules/supply-chain-management/product-pricing-management/product-pricing/utils/printPdf.ts
import jsPDF from "jspdf";

import type { MatrixRow, Unit, PriceType } from "../types";
import { buildMatrixTierKeys, tierLabelForTierKey } from "./pivot";
import {
    formatPrintMoney,
    getPrintPageMetrics,
    printTextValue,
    type PrintLayoutOptions,
    type PrintPageMetrics,
} from "./printLayout";

type Options = PrintLayoutOptions & {
    includeBarcode?: boolean;
    priceTypes?: PriceType[];
    tiers?: string[];
    units?: Unit[];
    usedUnitIds?: Set<number>;
};

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

function unitLabel(unit: Unit | undefined, fallback: string) {
    return printTextValue(unit?.unit_shortcut || unit?.unit_name || fallback);
}

function drawPageFooter(doc: jsPDF, metrics: PrintPageMetrics) {
    const pageHeight = doc.internal.pageSize.getHeight();
    const str = `Page ${doc.getCurrentPageInfo().pageNumber}`;
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(str, metrics.contentLeft, pageHeight - metrics.marginPt + 10);
}

function drawReportHeader(
    doc: jsPDF,
    args: {
        now: Date;
        total: number;
        layout: string;
        metrics: PrintPageMetrics;
        continuation?: boolean;
    },
) {
    const { metrics } = args;
    const x = metrics.contentLeft;
    let y = metrics.marginPt + (args.continuation ? 8 : 10);

    if (args.continuation) {
        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.setFont("helvetica", "bold");
        doc.text("Product Pricing Matrix Report (continued)", x, y);
        return;
    }

    if (metrics.compact) {
        doc.setFontSize(11);
        doc.setTextColor(20);
        doc.setFont("helvetica", "bold");
        doc.text("Product Pricing Matrix Report", x, y);
        y += 12;
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(90);
        doc.text(
            `Generated: ${args.now.toLocaleDateString()} ${args.now.toLocaleTimeString()}  |  Products: ${args.total}  |  Layout: ${args.layout}`,
            x,
            y,
        );
        return;
    }

    doc.setFontSize(14);
    doc.setTextColor(20);
    doc.setFont("helvetica", "bold");
    doc.text("Product Pricing Matrix Report", x, y);
    y += 14;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Generated on: ${args.now.toLocaleDateString()} ${args.now.toLocaleTimeString()}`, x, y);
    y += 12;
    doc.text(`Total Products: ${args.total}`, x, y);
    y += 12;
    doc.text(`Layout: ${args.layout}`, x, y);
}

function renderPricingProductBlocksPdf(
    doc: jsPDF,
    rows: MatrixRow[],
    args: {
        layoutLabel: "Table" | "Cards";
        now: Date;
        includeBarcode: boolean;
        metrics: PrintPageMetrics;
        fontSize: number;
        priceTypes: PriceType[];
        tiers: string[];
        usedUnits: Unit[];
    },
) {
    const { metrics } = args;
    const {
        columns,
        cardWidth,
        gap,
        lineHeight,
        cardPadding,
        pillHeight,
        tableHeaderHeight,
        tableRowHeight,
        contentLeft,
        contentTop,
        contentBottom,
        footerReserve,
    } = metrics;

    let x = contentLeft;
    let y = contentTop;
    let columnIndex = 0;
    let rowMaxHeight = 0;

    const resetPosition = () => {
        x = contentLeft;
        y = contentTop;
        columnIndex = 0;
        rowMaxHeight = 0;
    };

    const maxY = () => contentBottom - footerReserve;

    const addPage = () => {
        drawPageFooter(doc, metrics);
        doc.addPage();
        drawReportHeader(doc, {
            now: args.now,
            total: rows.length,
            layout: args.layoutLabel,
            metrics,
            continuation: true,
        });
        resetPosition();
    };

    drawReportHeader(doc, {
        now: args.now,
        total: rows.length,
        layout: args.layoutLabel,
        metrics,
        continuation: false,
    });

    const advanceCardPosition = (height: number) => {
        rowMaxHeight = Math.max(rowMaxHeight, height);
        if (columnIndex + 1 < columns) {
            columnIndex += 1;
            x = contentLeft + columnIndex * (cardWidth + gap);
            return;
        }

        columnIndex = 0;
        x = contentLeft;
        y += rowMaxHeight + gap;
        rowMaxHeight = 0;
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
            printTextValue(row.brand_name),
            printTextValue(row.category_name),
            `Code: ${printTextValue(display.product_code)}`,
            args.includeBarcode ? `Barcode: ${printTextValue(display.barcode)}` : "",
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

        const wrappedName = doc.splitTextToSize(printTextValue(display.product_name), cardWidth - cardPadding * 2);
        const tableHeight = tableHeaderHeight + args.tiers.length * tableRowHeight;

        const cardHeight =
            cardPadding * 2 +
            wrappedName.length * (lineHeight + 1) +
            Math.max(pillRows.length, 1) * (pillHeight + 3) +
            (metrics.compact ? 6 : 10) +
            tableHeight;

        if (columnIndex === 0) {
            if (y + cardHeight > maxY()) {
                addPage();
            }
        } else if (y + Math.max(rowMaxHeight, cardHeight) > maxY()) {
            columnIndex = 0;
            x = contentLeft;
            y += rowMaxHeight + gap;
            rowMaxHeight = 0;
            if (y + cardHeight > maxY()) {
                addPage();
            }
        }

        doc.setDrawColor(210, 210, 210);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, y, cardWidth, cardHeight, 4, 4, "FD");

        let cursorY = y + cardPadding + 2;
        doc.setFontSize(args.fontSize + (metrics.compact ? 1 : 2));
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

        cursorY += metrics.compact ? 4 : 5;
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
                    price != null ? formatPrintMoney(price) : "-",
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

    drawPageFooter(doc, metrics);
}

export function generatePricingMatrixPdf(rows: MatrixRow[], opts: Options = {}) {
    const paper = opts.paper ?? "a4";
    const orientation = opts.orientation ?? "landscape";
    const layout = opts.layout ?? "table";
    const includeBarcode = opts.includeBarcode ?? true;
    const compact = opts.compact ?? true;
    const usedUnitIds = opts.usedUnitIds ?? new Set();
    const unitsList = opts.units ?? [];
    const now = new Date();

    const doc = new jsPDF({ orientation, unit: "pt", format: paper });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const layoutLabel = layout === "cards" ? "Cards" : "Table";
    const metrics = getPrintPageMetrics(pageWidth, pageHeight, {
        layout,
        paper,
        orientation,
        compact,
        fontSize: opts.fontSize,
        layoutLabel,
    });

    const usedUnits = unitsList
        .filter((u) => usedUnitIds.has(Number(u.unit_id)))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const priceTypesList = opts.priceTypes ?? [];
    const tiers = opts.tiers?.length ? opts.tiers : buildMatrixTierKeys(priceTypesList);

    renderPricingProductBlocksPdf(doc, rows, {
        layoutLabel,
        now,
        includeBarcode,
        metrics,
        fontSize: opts.fontSize || 7,
        priceTypes: priceTypesList,
        tiers,
        usedUnits,
    });
    doc.save(`Product_Pricing_Matrix_${now.toISOString().split("T")[0]}.pdf`);
}
