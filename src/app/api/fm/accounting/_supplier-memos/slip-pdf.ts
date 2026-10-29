import { jsPDF } from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import { PAPER_SIZES } from "@/components/pdf-layout-design/constants";
import { drawPageNumbers, renderElement } from "@/components/pdf-layout-design/PdfGenerator";
import type { PdfTemplate } from "@/components/pdf-layout-design/services/pdf-template";
import type { PdfElementConfig } from "@/components/pdf-layout-design/types";
import { memoDateTime, type MemoDetail, type MemoHistoryEvent } from "@/modules/financial-management/accounting/supplier-memos/types";
import { memoPdfMoney as memoMoney } from "./pdf-format";
import type { MemoActor } from "./access";
import { directusBase, MemoError, readRows, type Row } from "./directus";

const navy: [number, number, number] = [26, 26, 46];
const text = (value: unknown) => String(value ?? "").trim();
const date = (value: string) => {
  const parsed = new Date(value.slice(0, 10) + "T00:00:00Z");
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-PH", { dateStyle: "medium", timeZone: "UTC" }).format(parsed);
};

export function memoSlipLayout(template?: PdfTemplate) {
  const config = template?.config;
  const paper = config?.paperSize === "Custom" ? config.customSize : PAPER_SIZES[config?.paperSize || "A4"];
  if (!paper || ![paper.width, paper.height].every(value => Number.isFinite(value) && value > 0)) throw new MemoError("The selected template has an invalid paper size.");
  const orientation = config?.orientation || "portrait";
  const width = orientation === "landscape" ? Math.max(paper.width, paper.height) : Math.min(paper.width, paper.height);
  const height = orientation === "landscape" ? Math.min(paper.width, paper.height) : Math.max(paper.width, paper.height);
  const margins = config?.margins || { top: 12, right: 12, bottom: 12, left: 12 };
  if (!Object.values(margins).every(value => Number.isFinite(value) && value >= 0)) throw new MemoError("The selected template has invalid print margins.");
  const bodyEnd = Math.min(config?.bodyEnd ?? height - margins.bottom, height - margins.bottom);
  const elements = Object.values(config?.elements || {}).filter(element => element.visible);
  if (elements.some(element => ![element.x, element.y, element.width, element.height].every(Number.isFinite))) throw new MemoError("The selected template has invalid element positions.");
  // Header bounds take precedence over legacy bodyStart values that overlap the frame.
  const headerEnd = Math.max(margins.top, config?.bodyStart || 0, ...elements.filter(element => element.y < bodyEnd).map(element => element.y + element.height + 3));
  if (width - margins.left - margins.right < 25 || !Number.isFinite(bodyEnd) || !Number.isFinite(headerEnd) || bodyEnd - headerEnd < 35) {
    throw new MemoError("The selected template has insufficient space for the memo. Choose another template or Standard Header.");
  }
  return { width, height, orientation, margins, bodyEnd, headerEnd, elements, narrow: width - margins.left - margins.right < 100 };
}

async function printCompany(template?: PdfTemplate): Promise<Row> {
  const [company] = await readRows("company", { company_id: { _eq: 1 } },
    "company_id,company_name,company_address,company_brgy,company_city,company_province,company_zipCode,company_tin,company_registrationNumber,company_contact,company_email,company_logo", "company_id");
  if (!company?.company_name) throw new MemoError("Company information is unavailable for printing.", 503);
  if (Object.values(template?.config.elements || {}).some(element => element.visible && element.type === "image" && element.id === "company_logo") && company.company_logo) {
    const logo = text(company.company_logo);
    if (/^[0-9a-f-]{36}$/i.test(logo)) {
      const response = await fetch(directusBase() + "/assets/" + logo, {
        headers: { Authorization: "Bearer " + process.env.DIRECTUS_STATIC_TOKEN }, cache: "no-store", signal: AbortSignal.timeout(15_000),
      });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !/^image\/(png|jpeg|webp)/.test(contentType)) throw new MemoError("The company logo could not be loaded. Please try again.", 503);
      company.company_logo = "data:" + contentType.split(";")[0] + ";base64," + Buffer.from(await response.arrayBuffer()).toString("base64");
    } else if (!/^data:image\/(png|jpeg|webp);base64,/.test(logo)) throw new MemoError("The company logo is not available in a supported image format.", 503);
  }
  return company;
}

export async function memoSlip(detail: MemoDetail, history: MemoHistoryEvent[], actor: MemoActor, template?: PdfTemplate): Promise<ArrayBuffer> {
  const layout = memoSlipLayout(template);
  const company = await printCompany(template);
  const generatedAt = new Date().toISOString();
  const doc = new jsPDF({ format: [layout.width, layout.height], orientation: layout.orientation, compress: true });
  const { memo, eligibility } = detail;
  const title = "Supplier " + (Number(memo.type) === 1 ? "Credit" : "Debit") + " Memo";
  doc.setProperties({ title: title + " - " + memo.memo_number });
  const { width, height, margins, narrow } = layout;
  const area = width - margins.left - margins.right;
  const footerLines = () => {
    doc.setFont("helvetica", "normal").setFontSize(7);
    return doc.splitTextToSize("Generated by " + actor.name + " | " + memoDateTime(generatedAt), narrow ? area : area - 26) as string[];
  };
  const footerHeight = footerLines().length * 3 + (narrow ? 10 : 6);
  const bodyEnd = Math.min(layout.bodyEnd, height - margins.bottom - footerHeight);

  function templateElement(element: PdfElementConfig) {
    const x = Math.max(margins.left, element.x);
    const available = Math.min(element.width, width - margins.right - x);
    if (available <= 0) throw new MemoError("The selected template places an element outside the printable page.");
    let adjusted = { ...element, x, width: available, style: { ...element.style } };
    if (element.type === "text" || element.type === "custom_text") {
      const value = element.type === "custom_text" ? (element.content || "").replace(/\{\{(.*?)\}\}/g, (_, key) => text(company[key.trim()])) : text(company[element.id]);
      const font = doc.getFontList()[element.style.fontFamily] ? element.style.fontFamily : "helvetica";
      let size = element.style.fontSize;
      doc.setFont(font, element.style.fontWeight).setFontSize(size);
      if (doc.getTextWidth(value) > available) size = Math.max(8, size * available / doc.getTextWidth(value));
      doc.setFontSize(size);
      let lines = doc.splitTextToSize(value, available) as string[];
      while (lines.length > 1 && size > 8) {
        size = Math.max(8, size - 0.2);
        doc.setFontSize(size);
        lines = doc.splitTextToSize(value, available) as string[];
      }
      adjusted = { ...adjusted, type: "custom_text", content: lines.join("\n"), style: { ...adjusted.style, fontFamily: font, fontSize: size } };
      const bottom = element.y + element.height / 2 + size * 25.4 / 72 * (0.35 + (lines.length - 1) * (element.style.lineHeight || 1.15));
      if (element.y < layout.bodyEnd) headerEnd = Math.max(headerEnd, bottom + 3);
    }
    renderElement(doc, adjusted, company);
  }

  let headerEnd = layout.headerEnd;
  function header() {
    if (template) { layout.elements.forEach(templateElement); return headerEnd; }
    let y = margins.top;
    doc.setFont("helvetica", "bold").setFontSize(16).setTextColor(...navy);
    const name = doc.splitTextToSize(text(company.company_name).toUpperCase(), area) as string[];
    doc.text(name, margins.left, y + 5); y += name.length * 6 + 2;
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(80);
    const address = [company.company_address, company.company_brgy, company.company_city, company.company_province, company.company_zipCode].map(text).filter(Boolean).join(", ");
    const legal = [company.company_tin ? "TIN: " + text(company.company_tin) : "", company.company_registrationNumber ? "Reg No: " + text(company.company_registrationNumber) : ""].filter(Boolean).join(" | ");
    const contact = [company.company_contact ? "Tel: " + text(company.company_contact) : "", text(company.company_email)].filter(Boolean).join(" | ");
    for (const line of [address, legal, contact].filter(Boolean)) {
      const lines = doc.splitTextToSize(line, area) as string[];
      doc.text(lines, margins.left, y + 3); y += lines.length * 3.5;
    }
    doc.setDrawColor(...navy).setLineWidth(0.6).line(margins.left, y + 3, width - margins.right, y + 3);
    headerEnd = y + 8;
    return headerEnd;
  }
  const framed = new Set<number>();
  function frame() {
    const page = doc.getCurrentPageInfo().pageNumber;
    if (framed.has(page)) return;
    const top = header();
    if (page > 1) {
      doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(...navy);
      doc.text(doc.splitTextToSize(title + " - " + memo.memo_number + " (continued)", area), margins.left, top + 3);
    }
    framed.add(page);
  }
  frame();
  doc.setFont("helvetica", "bold").setFontSize(narrow ? 11 : 14).setTextColor(...navy);
  const titleLines = doc.splitTextToSize(title.toUpperCase(), narrow ? area : area * 0.64) as string[];
  doc.text(titleLines, margins.left, headerEnd + 5);
  doc.setFontSize(narrow ? 10 : 12);
  const numberLines = doc.splitTextToSize(memo.memo_number, narrow ? area : area * 0.34) as string[];
  const numberY = narrow ? headerEnd + titleLines.length * 5 + 6 : headerEnd + 5;
  doc.text(numberLines, narrow ? margins.left : width - margins.right, numberY, { align: narrow ? "left" : "right" });
  let y = Math.max(headerEnd + titleLines.length * 5, numberY + (numberLines.length - 1) * 5) + 9;
  doc.setFont("helvetica", "bold").setFontSize(8);
  const continuationHeight = doc.splitTextToSize(title + " - " + memo.memo_number + " (continued)", area).length * 3.8 + 6;
  const pageTop = headerEnd + continuationHeight;
  if (bodyEnd - pageTop < 35) throw new MemoError("The selected template header leaves insufficient space for this memo. Choose another template or Standard Header.");

  function table(options: UserOptions) {
    autoTable(doc, { startY: y, theme: "plain", tableWidth: area, rowPageBreak: "avoid",
      margin: { left: margins.left, right: margins.right, top: pageTop, bottom: height - bodyEnd },
      styles: { font: "helvetica", fontSize: narrow ? 8 : 9, cellPadding: 2, overflow: "linebreak", textColor: 30 },
      headStyles: { fillColor: [240, 240, 245], textColor: 50, fontStyle: "bold" },
      willDrawPage: frame, ...options });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  }
  function newPage() { doc.addPage(); frame(); y = pageTop; }
  const info = [
    ["Supplier", memo.supplierName || "Not recorded"],
    ["GL account", [memo.accountCode, memo.accountName].filter(Boolean).join(" - ") || "Not recorded"],
    ["Memo date", date(memo.date)], ["Status", memo.status], ["Encoder", memo.creatorName || "Not recorded"],
    ["Created at (PHT)", memoDateTime(memo.created_at)], ["Reason", memo.reason || "None"],
  ];
  const summary = [["Memo amount", memoMoney(memo.amount)], ["Posted usage", memoMoney(eligibility.appliedAmount)],
    ["Reserved / unposted", memoMoney(eligibility.reservedAmount)], ["Remaining balance", memoMoney(eligibility.remainingAmount)]];
  if (narrow) {
    table({ body: info, styles: { font: "helvetica", fontSize: 8, cellPadding: 1.5, overflow: "linebreak", textColor: 30 },
      columnStyles: { 0: { cellWidth: area * 0.36, textColor: 90 }, 1: { cellWidth: area * 0.64 } } });
    table({ head: [[{ content: "MEMO SUMMARY", colSpan: 2 }]], body: summary, theme: "grid",
      columnStyles: { 0: { cellWidth: area * 0.55 }, 1: { cellWidth: area * 0.45, halign: "right" } },
      didParseCell: data => { if (data.section === "body" && data.row.index === 3) { data.cell.styles.fontStyle = "bold"; data.cell.styles.fillColor = [245, 245, 245]; } } });
  } else {
    table({ head: [[{ content: "", colSpan: 3, styles: { fillColor: 255 } }, { content: "MEMO SUMMARY", colSpan: 2, styles: { fillColor: navy, textColor: 255 } }]],
      body: info.map((row, index) => [row[0], row[1], "", summary[index]?.[0] || "", summary[index]?.[1] || ""]),
      columnStyles: { 0: { cellWidth: area * 0.15, textColor: 100 }, 1: { cellWidth: area * 0.39 }, 2: { cellWidth: area * 0.04 },
        3: { cellWidth: area * 0.24 }, 4: { cellWidth: area * 0.18, halign: "right" } },
      didParseCell: data => {
        if (data.section === "body" && data.column.index >= 3 && data.row.index < 4) {
          data.cell.styles.lineWidth = 0.15; data.cell.styles.lineColor = 215;
          if (data.row.index === 3) { data.cell.styles.fontStyle = "bold"; data.cell.styles.fillColor = [245, 245, 245]; }
        }
      } });
  }
  const cancellation = history.find(event => event.action === "CANCEL" && event.outcome === "completed");
  const warnings: string[][] = [];
  if (memo.status.toUpperCase() === "CANCELLED") warnings.push(["CANCELLED", cancellation
    ? cancellation.actorName + " | " + memoDateTime(cancellation.occurredAt) + "\nReason: " + (cancellation.reason || "Not recorded")
    : "Cancellation actor/reason not recorded in application history."]);
  if (eligibility.ambiguous) warnings.push(["NEEDS REVIEW", eligibility.blockedReason || "The linked usage cannot be safely attributed."]);
  if (warnings.length) table({ body: warnings, theme: "grid", styles: { font: "helvetica", fontSize: 8, cellPadding: 2, overflow: "linebreak", fillColor: [255, 247, 230] },
    columnStyles: { 0: { cellWidth: narrow ? area * 0.34 : 30, fontStyle: "bold" } } });

  doc.setFont("helvetica", "normal").setFontSize(8);
  const firstApplication = eligibility.applications[0];
  const firstRecord = firstApplication ? firstApplication.documentNo + "\n" + firstApplication.status + " | Reserved / unposted\nAmount: " + memoMoney(firstApplication.amount) : "No disbursements are linked to this memo.";
  const sectionLead = narrow ? 16 + doc.splitTextToSize(firstRecord, area - 4).length * 3.5 : 26;
  if (y + sectionLead > bodyEnd) newPage();
  table({ head: [[{ content: "LINKED DISBURSEMENTS", colSpan: narrow ? 1 : 4, styles: { fillColor: 255, textColor: navy, fontStyle: "bold" } }],
    ...(narrow ? [] : [["Disbursement", "Status", "Usage", "Applied amount"]])],
    body: eligibility.applications.length ? eligibility.applications.map(application => {
      const usage = eligibility.ambiguous ? "Needs review" : application.posted ? "Posted usage" : "Reserved / unposted";
      const amount = memoMoney(eligibility.ambiguous ? null : application.amount);
      return narrow ? [application.documentNo + "\n" + application.status + " | " + usage + "\nAmount: " + amount]
        : [application.documentNo, application.status, usage, amount];
    }) : [[{ content: eligibility.ambiguous ? "No reconciled disbursement links are available. Usage needs review." : "No disbursements are linked to this memo.", colSpan: narrow ? 1 : 4, styles: { textColor: 100 } }]],
    styles: { font: "helvetica", fontSize: 8, cellPadding: 2, overflow: "linebreak", textColor: 30, lineWidth: { bottom: 0.15 }, lineColor: 220 },
    columnStyles: narrow ? {} : { 0: { cellWidth: area * 0.3 }, 1: { cellWidth: area * 0.22 }, 2: { cellWidth: area * 0.24 }, 3: { cellWidth: area * 0.24, halign: "right" } } });

  const signWidth = narrow ? area : (area - 16) / 3;
  doc.setFont("helvetica", "normal").setFontSize(9);
  const prepared = doc.splitTextToSize(memo.creatorName || "Not recorded", signWidth) as string[];
  const signHeight = Math.max(29, 23 + prepared.length * 4);
  for (const [index, label] of ["Prepared By", "Checked By", "Approved By"].entries()) {
    if ((narrow || index === 0) && y + signHeight > bodyEnd) newPage();
    const x = margins.left + (narrow ? 0 : index * (signWidth + 8));
    doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(80).text(label.toUpperCase(), x, y + 3);
    doc.setFont("helvetica", "normal").setFontSize(9).setTextColor(30);
    if (index === 0) doc.text(prepared, x, y + 13);
    const lineY = y + 15 + (prepared.length - 1) * 4;
    doc.setDrawColor(100).setLineWidth(0.2).line(x, lineY, x + signWidth, lineY);
    doc.setFontSize(7).setTextColor(110).text(doc.splitTextToSize("Signature over Printed Name / Date", signWidth), x, lineY + 4);
    if (narrow) y += signHeight + 3;
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    const lines = footerLines();
    const top = height - margins.bottom - footerHeight + 2;
    doc.setDrawColor(210).setLineWidth(0.2).line(margins.left, top - 3, width - margins.right, top - 3);
    doc.setTextColor(110).text(lines, margins.left, top);
    if (!template) doc.text("Page " + page + " / " + pages, width - margins.right, top, { align: "right" });
  }
  if (template) drawPageNumbers(doc, template.config);
  return doc.output("arraybuffer");
}
