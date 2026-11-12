import { jsPDF } from "jspdf";
import autoTable, { type RowInput, type UserOptions } from "jspdf-autotable";
import type { ReportsExportData } from "../report-types";
import { bundledPdfFont } from "./reconcilePdf";
import { ReconcileExportError, exportTime } from "./reconcileExport";
import { transactionMoney } from "../utils/transactionDisplay";
import { auditDetail, reportTables, reportsMetadata } from "./reportsExport";
import { postingDetails, postingExplanation, postingStatus, POSTING_TOTAL_NOTE } from "./postingExport";

export async function buildReportsPdf(data: ReportsExportData) {
  const doc = new jsPDF({ format: "a4", orientation: "portrait", compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS("Geist-Regular.ttf", await bundledPdfFont()); doc.addFont("Geist-Regular.ttf", "Reports", "normal"); doc.setFont("Reports", "normal");
  const font = doc.getFont().metadata as unknown as { characterToGlyph: (value: number) => number };
  function supported(value: string) { for (const char of value) if (!/[\r\n\t]/.test(char) && !font.characterToGlyph(char.codePointAt(0)!)) throw new ReconcileExportError(`The existing PDF font cannot render the character ${char}. Export to Excel or copy the report to preserve the text.`); return value; }
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 13, available = width - margin * 2;
  const metadata = reportsMetadata(data); metadata.forEach(supported);
  doc.setFontSize(11); const entity = doc.splitTextToSize(metadata[0], available) as string[];
  doc.setFontSize(8); const details = [metadata[1], metadata[2], metadata[4]].map(line => doc.splitTextToSize(line, available) as string[]);
  doc.setFontSize(7); const footer = doc.splitTextToSize(metadata[3], available - 29) as string[], footerHeight = Math.max(17, footer.length * 3 + 7);
  const top = 25 + entity.length * 4.8 + details.reduce((sum, lines) => sum + lines.length * 3.8, 0), bottom = height - footerHeight - 5;
  if (bottom - top < 75) throw new ReconcileExportError("The report metadata is too long for a portrait PDF page. Export to Excel or copy the report.");
  let y = top;
  const pages: string[] = [];
  const money = (value: string | null, currency = data.period.currency) => value == null ? "Unavailable" : value.startsWith("-") ? `(${transactionMoney(value.slice(1), currency)})` : transactionMoney(value, currency);
  function label(value: string) { const lines = doc.setFont("Reports", "normal").setFontSize(8).splitTextToSize(supported(value), available) as string[]; if (y + lines.length * 4 + 10 > bottom) { doc.addPage(); y = top; } doc.text(lines, margin, y + 3); y += lines.length * 4 + 5; }
  function table(options: UserOptions) {
    autoTable(doc, { startY: y, margin: { left: margin, right: margin, top, bottom: footerHeight + 5 }, tableWidth: available, theme: "grid", showHead: "everyPage", rowPageBreak: "auto", styles: { font: "Reports", fontStyle: "normal", fontSize: 8, cellPadding: 2, overflow: "linebreak", textColor: [24, 35, 46], lineColor: [216, 222, 229], lineWidth: 0.15 }, headStyles: { font: "Reports", fontStyle: "normal", fillColor: [234, 238, 242], textColor: [24, 35, 46] }, didParseCell: cell => { cell.cell.text.forEach(supported); }, ...options });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  }
  function section(title: string) { if (pages.length) doc.addPage(); y = top; pages.push(title); doc.setFont("Reports", "normal").setFontSize(12); doc.text(supported(title), margin, y + 4); y += 12; }
  function amountWidth(values: (string | null)[], currency = data.period.currency) { doc.setFont("Reports", "normal").setFontSize(8); return Math.max(24, ...values.map(value => doc.getTextWidth(supported(money(value, currency))) + 5)); }
  const tables = reportTables(data);
  section("Reconciliation statement");
  for (const side of data.statement) {
    const amounts = [side.openingBalance, side.adjustedBalance, ...side.groups.flatMap(group => [group.total, ...group.items.map(item => item.amount)])], amount = amountWidth(amounts);
    if (available - amount * 2 < 55) throw new ReconcileExportError("A statement amount is too wide for a portrait PDF. Copy the report to preserve the exact text.");
    const rows: RowInput[] = [[{ content: side.openingLabel, colSpan: 3 }, money(side.openingBalance)]];
    for (const group of side.groups) { rows.push([{ content: group.label, colSpan: 3 }, money(group.total)]); for (const item of group.items) rows.push([item.reference, item.description, money(item.amount), ""]); if (!group.items.length) rows.push(["", "None", "", ""]); }
    rows.push([{ content: side.adjustedLabel, colSpan: 3 }, money(side.adjustedBalance)]);
    table({ head: [[{ content: `${side.part}: ${side.title}`, colSpan: 4 }], ["Ref", "Description", "Amount", "Total"]], body: rows, columnStyles: { 0: { cellWidth: 23 }, 1: { cellWidth: available - 23 - amount * 2 }, 2: { cellWidth: amount, halign: "right" }, 3: { cellWidth: amount, halign: "right" } }, didDrawCell: cell => { if (cell.section === "body" && cell.row.index === rows.length - 1 && cell.column.index === 3) { const right = cell.cell.x + cell.cell.width - 2, left = cell.cell.x + 2, at = cell.cell.y + cell.cell.height - 0.8; doc.setDrawColor(24, 35, 46); doc.line(left, at, right, at); doc.line(left, at - 0.7, right, at - 0.7); } } });
  }
  table({ head: [["Reconciliation", "Value"]], body: [["Difference", money(data.reconciliation.difference)], ["Status", data.reconciliation.statusLabel], ["Adjustments to post", String(data.reconciliation.unpostedCount)]], columnStyles: { 0: { cellWidth: 95 }, 1: { cellWidth: available - 95 } } });
  for (const note of tables[0].notes) label(note);
  section("Outstanding items aging");
  for (const note of tables[1].notes) label(note);
  const agingAmount = amountWidth([...data.aging.items.map(item => item.amount), ...data.aging.totals]);
  // A compact detail row preserves readable descriptions while all four numeric buckets remain visible.
  const wideAging = available - agingAmount * 4 < 35;
  const agingRows: RowInput[] = [];
  for (const item of data.aging.items) {
    agingRows.push([{ content: `${item.type}${item.stale ? " · Stale, over 6 months" : ""} | ${item.date} | Ref ${item.reference}\n${item.description}`, colSpan: 5 }]);
    agingRows.push([item.days == null ? "Unavailable" : String(item.days), ...data.aging.buckets.map((_, index) => item.bucket === index ? money(item.amount) : "")]);
  }
  if (!agingRows.length) agingRows.push([{ content: "No outstanding items.", colSpan: 5 }]);
  agingRows.push(["Total", ...data.aging.totals.map(value => money(value))]);
  if (wideAging) {
    for (const item of data.aging.items) table({ head: [[{ content: `${item.type}${item.stale ? " · Stale, over 6 months" : ""} | ${item.date} | Ref ${item.reference}`, colSpan: 3 }], ["Days", "Aging bucket", "Amount"]], body: [[item.days == null ? "Unavailable" : String(item.days), item.bucket == null ? "Unavailable" : data.aging.buckets[item.bucket], money(item.amount)], [{ content: item.description, colSpan: 3 }]], columnStyles: { 0: { cellWidth: 24 }, 1: { cellWidth: available - 24 - agingAmount }, 2: { cellWidth: agingAmount, halign: "right" } } });
    table({ head: [["Aging bucket", "Total"]], body: data.aging.buckets.map((bucket, index) => [bucket, money(data.aging.totals[index])]), columnStyles: { 0: { cellWidth: available - agingAmount }, 1: { cellWidth: agingAmount, halign: "right" } } });
  } else table({ head: [["Days", "0–30 days", "31–90 days", "91–180 days", "Over 180"]], body: agingRows, columnStyles: { 0: { cellWidth: available - agingAmount * 4 }, 1: { cellWidth: agingAmount, halign: "right" }, 2: { cellWidth: agingAmount, halign: "right" }, 3: { cellWidth: agingAmount, halign: "right" }, 4: { cellWidth: agingAmount, halign: "right" } } });
  section("Adjusting entries journal");label(tables[2].notes[1]);label(POSTING_TOTAL_NOTE);
  const journalAmount = amountWidth([data.journal.totals.debit, data.journal.totals.credit, ...data.journal.entries.flatMap(entry => entry.lines.flatMap(line => [line.debit, line.credit]))]);
  if (available - journalAmount * 2 < 40) throw new ReconcileExportError("A journal amount is too wide for a portrait PDF. Copy the report to preserve the exact text.");
  for (const entry of data.journal.entries) table({ head: [[{ content: `${entry.workbenchNumber || entry.journalNumber || "Draft"} | ${entry.date || "Not set"} | ${postingStatus(entry)}`, colSpan: 3 }], ["Account", "Debit", "Credit"]], body: [...entry.lines.map(line => [line.account ? `${line.account.code} · ${line.account.name}` : "No account", money(line.debit), money(line.credit)]), [{ content: postingExplanation(entry), colSpan: 3 }], [{ content: postingDetails(entry), colSpan: 3, styles: { fontSize: 7 } }]], columnStyles: { 0: { cellWidth: available - journalAmount * 2 }, 1: { cellWidth: journalAmount, halign: "right" }, 2: { cellWidth: journalAmount, halign: "right" } } });
  if (!data.journal.entries.length) label("No adjusting entries.");
  table({ head: [["Totals of all displayed lines", "Debit", "Credit"]], body: [["", money(data.journal.totals.debit), money(data.journal.totals.credit)]], columnStyles: { 0: { cellWidth: available - journalAmount * 2 }, 1: { cellWidth: journalAmount, halign: "right" }, 2: { cellWidth: journalAmount, halign: "right" } } });
  section("Audit trail");label(tables[3].notes[0]);label(metadata[5]);
  table({ head: [["When (PHT)", "Action", "By", "Detail"]], body: data.audit.length ? data.audit.map(event => [exportTime(event.occurredAt), `${event.actionLabel}${event.scope === "Bank setup" ? " · Bank setup" : ""}`, event.actor.name, auditDetail(event)]) : [["", "", "", "No activity recorded for this period."]], columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 32 }, 2: { cellWidth: 29 }, 3: { cellWidth: available - 91 } } });
  section("Closed periods");label(tables[4].notes[0]);
  for (const row of data.closedPeriods) table({ head: [[{ content: `Period ended ${row.periodEnd || "Unavailable"} | Revision ${row.revision} | Closure #${row.closureId}`, colSpan: 2 }], ["Field", "Saved value"]], body: [["Closed", exportTime(row.closedAt)], ["Closed by", row.closedBy.name || `User #${row.closedBy.id}`], ["Currency", row.currency || "Unavailable"], ["Adjusted bank", money(row.adjustedBankBalance, row.currency || "PHP")], ["Adjusted book", money(row.adjustedBookBalance, row.currency || "PHP")], ["Entries", row.entryCount == null ? "Unavailable" : String(row.entryCount)], ["Journal entries / GL references", row.journals.map(j => `${j.workbenchNumber || "Workbench number unavailable"} · GL: ${j.glNumber || `#${j.glId}`}`).join("\n") || (row.available ? "None" : "Unavailable")], ...(row.notice ? [["Notice", row.notice]] : [])], columnStyles: { 0: { cellWidth: 60 }, 1: { cellWidth: available - 60 } } });
  if (!data.closedPeriods.length) label("No closed periods for this bank account.");
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) {
    doc.setPage(page); doc.setFont("Reports", "normal").setFontSize(9).setTextColor(93, 107, 120); doc.text("BANK RECONCILIATION REPORTS", margin, 13);
    doc.setFontSize(11).setTextColor(24, 35, 46); doc.text(entity, margin, 21); let at = 22 + entity.length * 4.8; doc.setFontSize(8).setTextColor(93, 107, 120); for (const lines of details) { doc.text(lines, margin, at); at += lines.length * 3.8; }
    doc.line(margin, top - 4, width - margin, top - 4); doc.setFontSize(7); doc.text(footer, margin, height - footerHeight + 5); doc.text(`Page ${page} of ${total}`, width - margin, height - 9, { align: "right" });
  }
  doc.setProperties({ title: "Bank reconciliation Reports", author: data.generatedBy.name, subject: `${data.entity?.name} | ${data.period.periodEnd || "Undated"}` }); doc.setCreationDate(new Date(data.generatedAt));
  return new Uint8Array(doc.output("arraybuffer"));
}
