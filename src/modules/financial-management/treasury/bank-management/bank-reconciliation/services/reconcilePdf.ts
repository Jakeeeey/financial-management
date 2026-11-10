import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { jsPDF } from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import type { ReconcileExportData } from "../export-types";
import { transactionMoney } from "../utils/transactionDisplay";
import { exportMetadata, ReconcileExportError, summaryRows } from "./reconcileExport";

// Next.js already ships this font. Reuse it; do not install or download font assets.
let font: Promise<string> | undefined;
export async function buildReconcilePdf(data: ReconcileExportData) {
  font ??= readFile(join(process.cwd(), "node_modules/next/dist/compiled/@vercel/og/Geist-Regular.ttf")).then(buffer => buffer.toString("base64")).catch(error => { font = undefined; throw error; });
  const doc = new jsPDF({ format: "a4", orientation: "landscape", compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS("Geist-Regular.ttf", await font); doc.addFont("Geist-Regular.ttf", "Reconcile", "normal"); doc.setFont("Reconcile", "normal");
  const metadata = exportMetadata(data), width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight(), margin = 13;
  const currency = data.period.currency, money = (value: string | null) => value == null ? "Unavailable" : transactionMoney(value, currency);
  doc.setFontSize(7); const footer = doc.splitTextToSize(metadata[3], width - margin * 2 - 34) as string[];
  const footerHeight = Math.max(18, footer.length * 3.1 + 7);
  doc.setFontSize(13); const entity = doc.splitTextToSize(metadata[0], width - margin * 2 - 77) as string[];
  doc.setFontSize(8); const account = doc.splitTextToSize(metadata[1], width - margin * 2) as string[];
  const headerHeight = 30 + entity.length * 5 + account.length * 3.5;
  const top = headerHeight + 6, bottom = height - footerHeight - 5;
  const registeredFont = doc.getFont(), fontMetadata = registeredFont.metadata as unknown as { characterToGlyph: (value: number) => number };
  function supported(value: string) {
    for (const char of value) if (!/[\r\n\t]/.test(char) && !fontMetadata.characterToGlyph(char.codePointAt(0)!)) throw new ReconcileExportError(`The existing PDF font cannot render the character ${char}. Export to Excel to preserve the text.`);
    return value;
  }
  for (const value of [...metadata, data.reconciliation.statusLabel]) supported(value);
  let y = top;
  function table(title: string, options: UserOptions) {
    if (y + 22 > bottom) { doc.addPage(); y = top; }
    doc.setFont("helvetica", "bold").setFontSize(10).setTextColor(24, 35, 46); doc.text(title, margin, y); y += 5;
    autoTable(doc, { startY: y, margin: { top, bottom: footerHeight + 5, left: margin, right: margin }, theme: "grid", rowPageBreak: "avoid", showHead: "everyPage", styles: { font: "Reconcile", fontStyle: "normal", fontSize: 7.5, cellPadding: 2, overflow: "linebreak", textColor: [24, 35, 46], lineColor: [216, 222, 229], lineWidth: 0.15 }, headStyles: { font: "helvetica", fontStyle: "bold", fillColor: [234, 238, 242], textColor: [24, 35, 46] }, ...options });
    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 9;
  }
  const summary = summaryRows(data).map(row => [row.label, supported(row.money ? money(row.value) : row.value || "")]);
  table("Summary", { head: [["Field", "Value"]], body: summary, tableWidth: 204, columnStyles: { 0: { cellWidth: 102 }, 1: { cellWidth: 102 } }, didParseCell: cell => { if (cell.section === "body" && cell.column.index === 1 && cell.row.index < 6) cell.cell.styles.halign = "right"; } });
  for (const bank of [true, false]) {
    const pane = bank ? data.bank : data.ledger;
    let amountWidth = bank ? 27 : 30;
    for (const value of [pane.net, ...pane.items.map(line => line.amount)]) amountWidth = Math.max(amountWidth, Math.ceil(doc.getStringUnitWidth(money(value), { font: registeredFont, fontSize: 7.5 }) * 7.5 / doc.internal.scaleFactor + 5));
    table(bank ? "Bank statement lines" : "Cash in Bank ledger lines", {
      head: [bank ? ["Date", "Ref", "Description", "Amount", "Status", "Offset account", "JE #"] : ["Date", "Ref", "Description", "Amount", "Status"]],
      body: pane.items.length ? pane.items.map(line => [line.date, supported(line.reference), supported(line.description), supported(money(line.amount)), supported(line.status), ...(bank ? [supported(line.offsetAccount), supported(line.jeNumber || "")] : [])]) : [["", "", "No transactions", "", "", ...(bank ? ["", ""] : [])]],
      foot: [["", "", `${pane.total} lines; ${pane.matched} matched; ${pane.open} open. Net`, supported(money(pane.net)), "", ...(bank ? ["", ""] : [])]], showFoot: "lastPage", footStyles: { font: "Reconcile", fontStyle: "normal", fillColor: [243, 245, 247], textColor: [24, 35, 46] },
      didParseCell: cell => { if (cell.column.index === 3) cell.cell.styles.halign = "right"; },
      columnStyles: bank ? { 0: { cellWidth: 23 }, 1: { cellWidth: 26 }, 2: { cellWidth: 92 - amountWidth }, 3: { cellWidth: amountWidth, halign: "right" }, 4: { cellWidth: 63 }, 5: { cellWidth: 42 }, 6: { cellWidth: 25 } } : { 0: { cellWidth: 25 }, 1: { cellWidth: 30 }, 2: { cellWidth: 135 - amountWidth }, 3: { cellWidth: amountWidth, halign: "right" }, 4: { cellWidth: 81 } },
    });
  }
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFont("helvetica", "bold").setFontSize(8).setTextColor(93, 107, 120); doc.text("RECONCILIATION WORKSHEET", margin, 15);
    doc.setFont("Reconcile", "normal").setFontSize(13).setTextColor(24, 35, 46); doc.text(entity, margin, 23);
    doc.setFontSize(9); const statusColor = data.reconciliation.status === "RECONCILED" ? [31, 122, 74] : data.reconciliation.status === "UNRECONCILED" ? [180, 55, 47] : [147, 98, 12];
    doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]); doc.text(doc.splitTextToSize(data.reconciliation.statusLabel, 72), width - margin, 23, { align: "right" });
    doc.setTextColor(93, 107, 120).setFontSize(8); const accountY = 25 + entity.length * 5; doc.text(account, margin, accountY); doc.text(metadata[2], margin, accountY + account.length * 3.5 + 3);
    doc.setDrawColor(216, 222, 229); doc.line(margin, headerHeight + 1, width - margin, headerHeight + 1);
    doc.setFontSize(7); doc.text(footer, margin, height - footerHeight + 5); doc.text(`Page ${page} of ${pages}`, width - margin, height - 9, { align: "right" });
  }
  doc.setProperties({ title: "Reconciliation worksheet", author: data.generatedBy.name, subject: `${metadata[0]} | ${data.period.periodEnd || "Undated"}` });
  doc.setCreationDate(new Date(data.generatedAt));
  return new Uint8Array(doc.output("arraybuffer"));
}
