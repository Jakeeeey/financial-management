import autoTable from "jspdf-autotable";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { PAPER_SIZES } from "@/components/pdf-layout-design/constants";
import type { CompanyData } from "@/components/pdf-layout-design/types";
import type { PurchaseOrder, PurchaseOrderItem } from "./types";
import { toNum } from "./po-utils";

function fmt(val: number): string {
  if (!Number.isFinite(val)) return "PHP 0.00";
  const parts = val.toFixed(2).split(".");
  const intPart = Number(parts[0]).toLocaleString("en-US");
  return `PHP ${intPart}.${parts[1]}`;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "\u2026";
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
      const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };

      const baseSize = config.paperSize === 'Custom' ? config.customSize : (PAPER_SIZES[config.paperSize] || PAPER_SIZES.A4);
      const pageWidth = config.orientation === 'landscape' ? baseSize.height : baseSize.width;
      const pageHeight = config.orientation === 'landscape' ? baseSize.width : baseSize.height;
      const bottomMargin = config.bodyEnd ? (pageHeight - config.bodyEnd) : margins.bottom;

      const leftX = margins.left;
      const rightX = pageWidth - margins.right;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("PURCHASE ORDER", leftX, startY, { baseline: "top" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const leftColY = startY + 8;
      const lineH = 5;
      const leftLines = [
        `PO No.: ${po.purchase_order_no}`,
        `Date: ${po.lead_date || po.date || "---"}`,
        `Remark: ${po.remark || "---"}`,
        `Date Approved: ${po.date_approved ? new Date(po.date_approved).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "2-digit" }) : "---"}`,
      ];
      leftLines.forEach((line, i) => {
        doc.text(line, leftX, leftColY + i * lineH, { baseline: "top" });
      });

      const sup = options.supplier;
      if (sup) {
        doc.setFont("helvetica", "bold");
        doc.text(options.supplierName || "", rightX, leftColY, { baseline: "top", align: "right" });
        doc.setFont("helvetica", "normal");
        const rightLines = [
          sup.address || "",
          `${sup.email_address || ""}${sup.phone_number ? ` \u00B7 ${sup.phone_number}` : ""}`,
          `TIN: ${sup.tin_number || "---"}`,
          `Terms: ${sup.payment_terms || "---"}`,
        ];
        rightLines.forEach((line, i) => {
          doc.text(line.trim(), rightX, leftColY + (i + 1) * lineH, { baseline: "top", align: "right" });
        });
      }

      const dividerY = leftColY + leftLines.length * lineH + 4;
      doc.setDrawColor(200);
      doc.line(margins.left, dividerY, rightX, dividerY);

      const totalFromItems = items.reduce((sum, item) => sum + toNum(item.total_amount ?? item.line_total ?? toNum(item.qty) * toNum(item.unit_price)), 0);
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

      const availableWidth = rightX - margins.left;
      const colWeights = [10, 76, 14, 16, 26, 30];
      const totalWeight = colWeights.reduce((a, b) => a + b, 0);
      const colWidths = colWeights.map((w) => (w / totalWeight) * availableWidth);

      const fontSize = 9;
      const approxCharWidth = 0.22 * fontSize;
      const maxChars = (colIdx: number) => Math.floor(colWidths[colIdx] / approxCharWidth);

      const headRows = [["#", "Item", "UOM", "Qty", "Unit Price", "Total"]];
      const bodyRows = items.map((item, i) => [
        String(item.line_no || i + 1),
        truncate(resolveName(item), maxChars(1)),
        item.uom || "---",
        toNum(item.qty).toFixed(2),
        fmt(toNum(item.unit_price)),
        fmt(toNum(item.total_amount ?? item.line_total ?? toNum(item.qty) * toNum(item.unit_price))),
      ]);

      autoTable(doc, {
        startY: dividerY + 6,
        margin: { ...margins, bottom: bottomMargin },
        head: headRows,
        body: bodyRows,
        foot: bodyRows.length > 0
          ? [
              [
                { content: "Grand Total", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } },
                {
                  content: fmt(grandTotal),
                  styles: { fontStyle: "bold" },
                },
              ],
            ]
          : undefined,
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 9, fontStyle: "bold" },
        styles: { fontSize: 9 },
        footStyles: { fontSize: 9, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: colWidths[0] },
          1: { cellWidth: colWidths[1] },
          2: { cellWidth: colWidths[2] },
          3: { cellWidth: colWidths[3] },
          4: { cellWidth: colWidths[4] },
          5: { cellWidth: colWidths[5] },
        },
      });

      const signatureY = (doc as any).lastAutoTable?.finalY || dividerY + 30;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Prepared By", leftX, signatureY + 20, { baseline: "top" });
      doc.text("Approved By", rightX, signatureY + 20, { baseline: "top", align: "right" });
      doc.setDrawColor(0);
      doc.line(leftX, signatureY + 32, leftX + 60, signatureY + 32);
      doc.line(rightX - 60, signatureY + 32, rightX, signatureY + 32);

      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120);
      doc.text(
        "This is a system-generated document.",
        leftX,
        signatureY + 50,
        { baseline: "top" }
      );
      doc.setTextColor(0);
    }
  );

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  return { blob, url };
}
