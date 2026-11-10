import { jsPDF } from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import type { PostingExportData } from "../posting-types";
import { transactionMoney } from "../utils/transactionDisplay";
import { exportMetadata, ReconcileExportError } from "./reconcileExport";
import { bundledPdfFont } from "./reconcilePdf";
import { POSTING_TOTAL_NOTE, postingDetails, postingExplanation, postingStatus, postingSummary } from "./postingExport";

export async function buildPostingPdf(data: PostingExportData) {
  const doc = new jsPDF({ format: "a4", orientation: "portrait", compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS("Geist-Regular.ttf", await bundledPdfFont()); doc.addFont("Geist-Regular.ttf", "Posting", "normal"); doc.setFont("Posting", "normal");
  const metadata = exportMetadata(data), width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 13, available = width - margin * 2;
  const font = doc.getFont(), glyphs = font.metadata as unknown as { characterToGlyph: (value: number) => number };
  function supported(value: string) { for (const char of value) if (!/[\r\n\t]/.test(char) && !glyphs.characterToGlyph(char.codePointAt(0)!)) throw new ReconcileExportError(`The existing PDF font cannot render the character ${char}. Export to Excel to preserve the text.`); return value; }
  const money = (value: string | null) => value == null ? "Unavailable" : transactionMoney(value, data.period.currency);
  metadata.forEach(supported);
  doc.setFontSize(12); const entity = doc.splitTextToSize(metadata[0], available) as string[];
  doc.setFontSize(8); const account = doc.splitTextToSize(metadata[1], available) as string[], period = doc.splitTextToSize(metadata[2], available) as string[], snapshot = doc.splitTextToSize(metadata[4], available) as string[];
  doc.setFontSize(7); const footer = doc.splitTextToSize(metadata[3], available - 28) as string[], footerHeight = Math.max(17, footer.length * 3 + 7);
  const top = 27 + entity.length * 5 + (account.length + period.length + snapshot.length) * 3.8, bottom = height - footerHeight - 5;
  if (bottom - top < 70) throw new ReconcileExportError("The report metadata is too long for a portrait PDF page. Export to Excel to preserve the text.");
  let y = top;
  function table(options: UserOptions) {
    autoTable(doc, { startY: y, margin: { top, bottom: footerHeight + 5, left: margin, right: margin }, tableWidth: available, theme: "grid", pageBreak: "avoid", rowPageBreak: "avoid", showHead: "everyPage", styles: { font: "Posting", fontStyle: "normal", fontSize: 8, cellPadding: 2, overflow: "linebreak", textColor: [24, 35, 46], lineColor: [216, 222, 229], lineWidth: 0.15 }, headStyles: { font: "Posting", fontStyle: "normal", fillColor: [234, 238, 242], textColor: [24, 35, 46] }, ...options });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  }
  table({ head: [["Posting summary", "Value"]], body: postingSummary(data).map(row => [row.label, supported(row.money ? money(row.value) : row.value || "")]), columnStyles: { 0: { cellWidth: 74 }, 1: { cellWidth: available - 74 } }, didParseCell: cell => { if (cell.section === "body" && cell.column.index === 1 && cell.row.index < 5) cell.cell.styles.halign = "right"; } });
  let amountWidth = 30;
  for (const entry of data.entries) for (const line of entry.lines) for (const value of [line.debit, line.credit]) { doc.setFont("Posting", "normal").setFontSize(8); amountWidth = Math.max(amountWidth, doc.getTextWidth(money(value)) + 5); }
  if (available - amountWidth * 2 < 40) throw new ReconcileExportError("A journal amount is too wide for a portrait PDF. Export to Excel instead.");
  for (const entry of data.entries) {
    table({ head: [[{ content: supported(`${entry.workbenchNumber || entry.journalNumber || "Draft"} | ${entry.date || "Not set"} | ${postingStatus(entry)}`), colSpan: 3 }], ["Account", "Debit", "Credit"]], body: [
      ...entry.lines.map(line => [supported(line.account ? `${line.account.code} · ${line.account.name}` : "No account"), supported(money(line.debit)), supported(money(line.credit))]),
      [{ content: supported(postingExplanation(entry)), colSpan: 3 }], [{ content: supported(postingDetails(entry)), colSpan: 3, styles: { fontSize: 7, textColor: [93, 107, 120] } }],
    ], columnStyles: { 0: { cellWidth: available - amountWidth * 2 }, 1: { cellWidth: amountWidth, halign: "right" }, 2: { cellWidth: amountWidth, halign: "right" } } });
  }
  if (!data.entries.length) table({ head: [["Journal entries"]], body: [["No adjusting entries"]] });
  table({ head: [["Totals of all displayed lines", "Debit", "Credit"]], body: [[POSTING_TOTAL_NOTE, supported(money(data.totals.debit)), supported(money(data.totals.credit))]], columnStyles: { 0: { cellWidth: available - amountWidth * 2 }, 1: { cellWidth: amountWidth, halign: "right" }, 2: { cellWidth: amountWidth, halign: "right" } } });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(93, 107, 120); doc.text("ADJUSTING JOURNAL ENTRIES", margin, 14);
    doc.setFont("Posting", "normal").setFontSize(12).setTextColor(24, 35, 46); doc.text(entity, margin, 22); let at = 23 + entity.length * 5;
    doc.setFontSize(8).setTextColor(93, 107, 120); for (const lines of [account, period, snapshot]) { doc.text(lines, margin, at); at += lines.length * 3.8; }
    doc.setDrawColor(216, 222, 229); doc.line(margin, top - 5, width - margin, top - 5); doc.setFontSize(7); doc.text(footer, margin, height - footerHeight + 5); doc.text(`Page ${page} of ${pages}`, width - margin, height - 9, { align: "right" });
  }
  doc.setProperties({ title: "Posting summary and journal entries", author: data.generatedBy.name, subject: `${metadata[0]} | ${data.period.periodEnd || "Undated"}` }); doc.setCreationDate(new Date(data.generatedAt));
  return new Uint8Array(doc.output("arraybuffer"));
}
