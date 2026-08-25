import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { PAPER_SIZES } from "@/components/pdf-layout-design/constants";
import type { CompanyData } from "@/components/pdf-layout-design/types";
import type { PurchaseOrder, PurchaseOrderItem } from "./types";
import { toNum } from "./po-utils";

function fmt(val: number): string {
  if (!Number.isFinite(val)) return "0.00";
  const parts = val.toFixed(2).split(".");
  const intPart = Number(parts[0]).toLocaleString("en-US");
  return `${intPart}.${parts[1]}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "\u2026";
}

function centeredText(doc: jsPDF, text: string, y: number, pageWidth: number, size?: number) {
  if (size) doc.setFontSize(size);
  doc.text(text, pageWidth / 2, y, { baseline: "top", align: "center" });
}

export interface POPrintOptions {
  supplierName: string;
  supplier?: {
    address?: string | null;
    email_address?: string | null;
    phone_number?: string | null;
    tin_number?: string | null;
    payment_terms?: string | null;
  } | null;
  selectedTemplate?: string;
}

export async function generatePurchaseOrderPdf(
  po: PurchaseOrder,
  items: PurchaseOrderItem[],
  companyData: CompanyData | null,
  options: POPrintOptions
): Promise<{ blob: Blob; url: string }> {
  const templateName = options.selectedTemplate || "";

  const doc = await PdfEngine.generateWithFrame(
    templateName,
    companyData,
    (doc, startY, config) => {
      const margins = { top: 6, bottom: 8, left: 6, right: 6 };

      const baseSize = config.paperSize === 'Custom' ? config.customSize : (PAPER_SIZES[config.paperSize] || PAPER_SIZES.A4);
      const pageWidth = config.orientation === 'landscape' ? baseSize.height : baseSize.width;
      const pageHeight = config.orientation === 'landscape' ? baseSize.width : baseSize.height;
      const bottomMargin = config.bodyEnd ? (pageHeight - config.bodyEnd) : margins.bottom;

      const leftX = margins.left;
      const rightX = pageWidth - margins.right;

      // ── Dashed separator ──
      function dashLine(y: number) {
        const dashLen = 3;
        const gap = 2;
        let x = leftX;
        doc.setDrawColor(180);
        doc.setLineWidth(0.3);
        while (x < rightX) {
          doc.line(x, y, Math.min(x + dashLen, rightX), y);
          x += dashLen + gap;
        }
      }

      // ── Header ──
      centeredText(doc, "PURCHASE ORDER", startY + 2, pageWidth, 13);
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      centeredText(doc, po.purchase_order_no || "", startY + 9, pageWidth);

      dashLine(startY + 13);

      // ── Info section ──
      const infoY = startY + 16;
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");

      // Left column
      const poDate = po.lead_date || po.date || "---";
      const dateStr = poDate !== "---" && poDate !== "---"
        ? (() => { try { return new Date(poDate).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }); } catch { return poDate; } })()
        : poDate;
      const remark = po.remark && po.remark !== "---" ? `Remark: ${po.remark}` : "";
      const dateApproved = po.date_approved
        ? (() => { try { return new Date(po.date_approved).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }); } catch { return "---"; } })()
        : "---";

      const leftInfo = [
        `Date: ${dateStr}`,
        remark,
        `Date Approved: ${dateApproved}`,
      ].filter(Boolean);
      leftInfo.forEach((line, i) => {
        doc.text(line, leftX, infoY + i * 4, { baseline: "top" });
      });

      // Right column — supplier
      const sup = options.supplier;
      if (sup) {
        doc.setFont("helvetica", "bold");
        doc.text(options.supplierName || "", rightX, infoY, { baseline: "top", align: "right" });
        doc.setFont("helvetica", "normal");
        const rightLines = [
          sup.address || "",
          [sup.email_address, sup.phone_number].filter(Boolean).join(" \u00B7 ") || "",
          sup.tin_number ? `TIN: ${sup.tin_number}` : "",
          sup.payment_terms ? `Terms: ${sup.payment_terms}` : "",
        ].filter(Boolean);
        rightLines.forEach((line, i) => {
          doc.text(line, rightX, infoY + (i + 1) * 4, { baseline: "top", align: "right" });
        });
      }

      const dividerY = infoY + Math.max(leftInfo.length, (sup ? 5 : 1)) * 4 + 2;
      dashLine(dividerY);

      // ── Table ──
      const totalFromItems = items.reduce(
        (sum, item) => sum + toNum(item.total_amount ?? item.line_total ?? toNum(item.qty) * toNum(item.unit_price)),
        0
      );
      const grandTotal = totalFromItems || toNum(po.total_amount);

      const resolveName = (item: PurchaseOrderItem): string => {
        if (item.item_name) return item.item_name;
        if (typeof item.item_template_id === "object" && item.item_template_id && "name" in item.item_template_id) {
          const name = (item.item_template_id as { name?: string }).name;
          if (typeof item.item_variant_id === "object" && item.item_variant_id && "name" in item.item_variant_id) {
            return `${name} - ${(item.item_variant_id as { name?: string }).name}`;
          }
          return name || "Item";
        }
        return "Item";
      };

      const availableWidth = rightX - leftX;
      const colWeights = [8, 80, 13, 15, 25, 28];
      const totalWeight = colWeights.reduce((a, b) => a + b, 0);
      const colWidths = colWeights.map((w) => (w / totalWeight) * availableWidth);

      const fontSize = 7.5;
      const approxCharWidth = 0.22 * fontSize;
      const maxChars = (colIdx: number) => Math.floor(colWidths[colIdx] / approxCharWidth);

      const headRows = [["#", "Item", "UOM", "Qty", "Price", "Total"]];
      const bodyRows = items.map((item, i) => [
        String(item.line_no || i + 1),
        truncate(resolveName(item), maxChars(1)),
        item.uom || "\u2014",
        toNum(item.qty).toFixed(2),
        fmt(toNum(item.unit_price)),
        fmt(toNum(item.total_amount ?? item.line_total ?? toNum(item.qty) * toNum(item.unit_price))),
      ]);

      autoTable(doc, {
        startY: dividerY + 4,
        margin: { ...margins, bottom: bottomMargin },
        head: headRows,
        body: bodyRows,
        foot: bodyRows.length > 0
          ? [
              [
                { content: "Grand Total", colSpan: 5, styles: { halign: "right", fontStyle: "bold", fontSize: 7.5 } },
                { content: fmt(grandTotal), styles: { fontStyle: "bold", fontSize: 7.5 } },
              ],
            ]
          : undefined,
        theme: "grid",
        headStyles: { fillColor: [220, 220, 220], textColor: 30, fontSize, fontStyle: "bold" },
        styles: { fontSize, lineColor: [200, 200, 200], lineWidth: 0.3 },
        footStyles: { fontSize, fontStyle: "bold" },
        tableLineColor: [200, 200, 200],
        tableLineWidth: 0.3,
        columnStyles: {
          0: { cellWidth: colWidths[0], halign: "center" },
          1: { cellWidth: colWidths[1] },
          2: { cellWidth: colWidths[2], halign: "center" },
          3: { cellWidth: colWidths[3], halign: "right" },
          4: { cellWidth: colWidths[4], halign: "right" },
          5: { cellWidth: colWidths[5], halign: "right" },
        },
      });

      // ── Signature area ──
      const sigY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || dividerY + 30;
      dashLine(sigY + 8);

      const sigTop = sigY + 12;
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");

      doc.text("Prepared By:", leftX, sigTop, { baseline: "top" });
      doc.setDrawColor(150);
      doc.setLineWidth(0.5);
      doc.line(leftX, sigTop + 14, leftX + 55, sigTop + 14);

      doc.text("Approved By:", rightX - 55, sigTop, { baseline: "top" });
      doc.line(rightX - 55, sigTop + 14, rightX, sigTop + 14);

      doc.setFontSize(6.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(140);
      centeredText(doc, "This is a system-generated document.", sigTop + 30, pageWidth);
      doc.setTextColor(0);
    }
  );

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  return { blob, url };
}
