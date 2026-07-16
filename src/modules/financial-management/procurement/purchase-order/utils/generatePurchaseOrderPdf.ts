import autoTable from "jspdf-autotable";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { PAPER_SIZES } from "@/components/pdf-layout-design/constants";
import type { CompanyData } from "@/components/pdf-layout-design/types";
import type { PurchaseOrder, PurchaseOrderItem } from "./types";
import { toNum } from "./po-utils";

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
  const templateName = options.selectedTemplate === "__none__" ? "" : (options.selectedTemplate || "");

  const doc = await PdfEngine.generateWithFrame(
    templateName,
    companyData,
    (doc, startY, config) => {
      const margins = config.margins || { top: 10, bottom: 10, left: 10, right: 10 };

      const baseSize = config.paperSize === 'Custom' ? config.customSize : (PAPER_SIZES[config.paperSize] || PAPER_SIZES.A4);
      const pageWidth = baseSize.width;
      const pageHeight = config.orientation === 'landscape' ? baseSize.width : baseSize.height;
      const bottomMargin = config.bodyEnd ? (pageHeight - config.bodyEnd) : margins.bottom;

      const leftX = margins.left;
      const rightX = pageWidth - margins.right;

      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("PURCHASE ORDER", leftX, startY, { baseline: "top" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const leftColY = startY + 10;
      const leftLines = [
        `PO No.: ${po.purchase_order_no}`,
        `Date: ${po.lead_date || po.date || "---"}`,
        `Remark: ${po.remark || "---"}`,
        `Date Approved: ${po.date_approved ? new Date(po.date_approved).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" }) : "---"}`,
      ];
      leftLines.forEach((line, i) => {
        doc.text(line, leftX, leftColY + i * 5, { baseline: "top" });
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
          doc.text(line.trim(), rightX, leftColY + (i + 1) * 5, { baseline: "top", align: "right" });
        });
      }

      const dividerY = leftColY + leftLines.length * 5 + 4;
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

      const headRows = [["#", "Item", "UOM", "Qty", "Unit Price", "Total"]];
      const bodyRows = items.map((item, i) => [
        String(item.line_no || i + 1),
        resolveName(item),
        item.uom || "---",
        toNum(item.qty).toFixed(2),
        new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(toNum(item.unit_price)),
        new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(
          toNum(item.total_amount ?? item.line_total ?? toNum(item.qty) * toNum(item.unit_price))
        ),
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
                  content: new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(grandTotal),
                  styles: { fontStyle: "bold" },
                },
              ],
            ]
          : undefined,
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontSize: 8, fontStyle: "bold" },
        styles: { fontSize: 8 },
        footStyles: { fontSize: 8, fontStyle: "bold" },
      });

      const signatureY = (doc as any).lastAutoTable?.finalY || dividerY + 30;
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Prepared By", leftX, signatureY + 20, { baseline: "top" });
      doc.text("Approved By", rightX, signatureY + 20, { baseline: "top", align: "right" });
      doc.setDrawColor(0);
      doc.line(leftX, signatureY + 32, leftX + 60, signatureY + 32);
      doc.line(rightX - 60, signatureY + 32, rightX, signatureY + 32);

      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100);
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
