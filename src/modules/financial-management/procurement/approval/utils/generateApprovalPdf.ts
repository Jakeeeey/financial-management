import autoTable from "jspdf-autotable";
import { PdfEngine } from "@/components/pdf-layout-design/PdfEngine";
import { PAPER_SIZES } from "@/components/pdf-layout-design/constants";
import type { CompanyData } from "@/components/pdf-layout-design/types";
import type { ProcurementDetail } from "./types";

export interface ApprovalPrintOptions {
  supplier: {
    supplier_name?: string | null;
    address?: string | null;
    email_address?: string | null;
    phone_number?: string | null;
    tin_number?: string | null;
    payment_terms?: string | null;
  } | null;
  selectedTemplate?: string;
}

export async function generateApprovalPdf(
  procurementNo: string,
  leadDate: string | null,
  status: string | null,
  isApproved: number | null,
  poNo: number | null,
  details: ProcurementDetail[],
  total: number,
  companyData: CompanyData | null,
  options: ApprovalPrintOptions
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
      doc.text("PROCUREMENT", leftX, startY, { baseline: "top" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      const leftColY = startY + 10;
      const leftLines = [
        `PR No.: ${procurementNo}`,
        `Lead Date: ${leadDate || "---"}`,
        `PO No.: ${poNo ? `#${poNo}` : "---"}`,
        `Status: ${status || "---"}${isApproved ? " (Approved)" : ""}`,
      ];
      leftLines.forEach((line, i) => {
        doc.text(line, leftX, leftColY + i * 5, { baseline: "top" });
      });

      const sup = options.supplier;
      if (sup) {
        doc.setFont("helvetica", "bold");
        doc.text(sup.supplier_name || "", rightX, leftColY, { baseline: "top", align: "right" });
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

      const headRows = [["Item Template", "Variant", "UOM", "Qty", "Unit Price", "Total"]];
      const bodyRows = details.map((d) => [
        d.template_name || "---",
        d.variant_name || "---",
        d.uom || "---",
        String(d.qty || 0),
        new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(d.unit_price || 0)),
        new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(
          Number(d.total_amount || (d.qty || 0) * (d.unit_price || 0))
        ),
      ]);

      if (details.length === 0) {
        bodyRows.push(["No line items", "", "", "", "", ""]);
      }

      autoTable(doc, {
        startY: dividerY + 6,
        margin: { ...margins, bottom: bottomMargin },
        head: headRows,
        body: bodyRows,
        foot: bodyRows.length > 0 && details.length > 0
          ? [
              [
                { content: "Grand Total", colSpan: 5, styles: { halign: "right", fontStyle: "bold" } },
                {
                  content: new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(total),
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
    }
  );

  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  return { blob, url };
}
