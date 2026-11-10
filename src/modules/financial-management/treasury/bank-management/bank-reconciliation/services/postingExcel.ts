import ExcelJS from "exceljs";
import type { PostingExportData } from "../posting-types";
import { exportMetadata, exportTime, ReconcileExportError } from "./reconcileExport";
import { numeric, text } from "./reconcileExcel";
import { postingExplanation, postingStatus, postingSummary } from "./postingExport";

const MONEY = '#,##0.00;(#,##0.00);"-"';
export async function buildPostingExcel(data: PostingExportData) {
  const book = new ExcelJS.Workbook(); book.creator = data.generatedBy.name; book.created = new Date(data.generatedAt);
  function sheet(name: string, headers: string[], widths: number[], rows: (string | number)[][], money: number[]) {
    if (rows.length + 7 > 1_048_576) throw new ReconcileExportError(`The ${name} sheet exceeds Excel's row limit. No partial workbook was exported.`);
    const ws = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 7 }], pageSetup: { paperSize: 9, orientation: name === "Posting summary" ? "portrait" : "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.columns = widths.map(width => ({ width }));
    [name, ...exportMetadata(data)].forEach((value, index) => { ws.mergeCells(index + 1, 1, index + 1, headers.length); const row = ws.getRow(index + 1); row.getCell(1).value = text(value); row.font = { name: "Arial", size: index === 0 ? 16 : 10, bold: index === 0 }; row.alignment = { wrapText: true, vertical: "top" }; row.height = index === 0 ? 28 : index === 5 ? 48 : 36; });
    const head = ws.getRow(7); head.values = headers; head.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } }; head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D5C63" } }; head.height = 30; head.alignment = { wrapText: true };
    ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: headers.length } };
    for (const values of rows) {
      const row = ws.addRow(values.map(value => typeof value === "string" ? text(value) : value)); row.font = { name: "Arial", size: 10 }; row.alignment = { wrapText: true, vertical: "top" };
      let height = 1; values.forEach((value, i) => { const valueText = String(value); height = Math.max(height, valueText.split("\n").reduce((n, part) => n + Math.max(1, Math.ceil(part.length / Math.max(8, widths[i] - 3))), 0)); if (typeof value === "string") row.getCell(i + 1).numFmt = "@"; }); row.height = Math.min(409, height * 15 + 8);
      for (const col of money) if (typeof row.getCell(col).value === "number") { row.getCell(col).numFmt = MONEY; row.getCell(col).alignment = { horizontal: "right", vertical: "top" }; }
    }
    return ws;
  }
  sheet("Posting summary", ["Field", "Value"], [38, 98], postingSummary(data).map(row => [row.label, row.money ? numeric(row.value, row.label) : row.value || ""]), [2]);
  const headers = ["JE #", "Date", "Account", "Debit", "Credit", "Explanation", "Status", "Posted by", "Posted at (PHT)", "GL journal ID", "GL journal #", "Source", "Import reference", "Reverses JE", "Reversed by JE"];
  const rows = data.entries.flatMap(entry => entry.lines.map((line, index) => [index === 0 ? entry.workbenchNumber || entry.journalNumber || "Draft" : "", index === 0 ? entry.date || "Not set" : "", line.account ? `${line.account.code} · ${line.account.name}` : "No account", numeric(line.debit, "journal debit"), numeric(line.credit, "journal credit"), index === 0 ? postingExplanation(entry) : "", index === 0 ? postingStatus(entry) : "", index === 0 ? entry.postedBy || "" : "", index === 0 && entry.postedAt ? exportTime(entry.postedAt) : "", index === 0 && entry.journalId ? String(entry.journalId) : "", index === 0 ? entry.journalNumber || "" : "", index === 0 ? entry.sourceLabel : "", index === 0 ? entry.importReference || "" : "", index === 0 ? entry.reversesNumber || "" : "", index === 0 ? entry.reversedByNumber || "" : ""]));
  if (!rows.length) rows.push(["", "", "No adjusting entries", "", "", "", "", "", "", "", "", "", "", "", ""]);
  rows.push(["", "", "Totals of all displayed lines", numeric(data.totals.debit, "debit total"), numeric(data.totals.credit, "credit total"), "", "", "", "", "", "", "", "", "", ""]);
  const ws = sheet("Journal entries", headers, [20, 14, 38, 23, 23, 62, 42, 25, 28, 18, 22, 40, 36, 22, 22], rows, [4, 5]); ws.getRow(ws.rowCount).font = { bold: true };
  return new Uint8Array(await book.xlsx.writeBuffer());
}
