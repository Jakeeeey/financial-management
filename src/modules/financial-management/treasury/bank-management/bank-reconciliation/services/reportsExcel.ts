import ExcelJS from "exceljs";
import type { ReportsExportData } from "../report-types";
import { reportTables, reportsMetadata } from "./reportsExport";
import { numeric, text } from "./reconcileExcel";
import { ReconcileExportError } from "./reconcileExport";

export async function buildReportsExcel(data: ReportsExportData) {
  const book = new ExcelJS.Workbook(); book.creator = data.generatedBy.name; book.created = new Date(data.generatedAt);
  for (const table of reportTables(data)) {
    const metadata = [table.title, ...reportsMetadata(data), ...table.notes], header = metadata.length + 2;
    if (table.rows.length + header > 1_048_576) throw new ReconcileExportError(`The ${table.name} sheet exceeds Excel's row limit. No partial workbook was exported.`);
    const sheet = book.addWorksheet(table.name, { views: [{ state: "frozen", ySplit: header }], pageSetup: { paperSize: 9, orientation: table.key === "statement" ? "portrait" : "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `${header}:${header}` } });
    sheet.columns = table.widths.map(width => ({ width }));
    metadata.forEach((line, index) => { sheet.mergeCells(index + 1, 1, index + 1, table.headers.length); const row = sheet.getRow(index + 1); row.getCell(1).value = text(line); row.font = { name: "Arial", size: index ? 10 : 16, bold: !index }; row.alignment = { wrapText: true, vertical: "top" }; row.height = Math.max(26, Math.ceil(line.length / Math.max(30, table.widths.reduce((a, b) => a + b, 0) - 8)) * 15 + 8); });
    const head = sheet.getRow(header); head.values = table.headers; head.font = { name: "Arial", bold: true, color: { argb: "FFFFFFFF" } }; head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D5C63" } }; head.height = 32; head.alignment = { wrapText: true, vertical: "top" };
    if (table.key !== "statement") sheet.autoFilter = { from: { row: header, column: 1 }, to: { row: header, column: table.headers.length } };
    for (const source of table.rows) {
      const values = source.cells.map((value, index) => table.money.includes(index) && value !== "" ? numeric(value as string | null, `${table.name}: ${table.headers[index]}`) : value == null ? "Unavailable" : typeof value === "string" ? text(value) : value);
      const row = sheet.addRow(values); row.font = { name: "Arial", size: 10, bold: Boolean(source.style) }; row.alignment = { wrapText: true, vertical: "top" };
      let lines = 1;
      values.forEach((value, index) => { const cell = row.getCell(index + 1); lines = Math.max(lines, String(value).split("\n").reduce((total, part) => total + Math.max(1, Math.ceil(part.length / Math.max(8, table.widths[index] - 3))), 0)); if (typeof value === "string") cell.numFmt = "@"; if (table.money.includes(index) && typeof value === "number") { cell.numFmt = '#,##0.00;(#,##0.00);"-"'; cell.alignment = { horizontal: "right", vertical: "top" }; } });
      if (lines * 15 + 8 > 409) throw new ReconcileExportError(`A ${table.name} row is too tall to display fully in Excel. Download PDF or copy the report for the full content.`);
      row.height = lines * 15 + 8;
      if (source.style) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F5F7" } };
      if (source.style === "total" || source.style === "adjusted") for (const col of table.money) row.getCell(col + 1).border = { top: { style: "thin" }, bottom: { style: source.style === "adjusted" ? "double" : "thin" } };
    }
  }
  return new Uint8Array(await book.xlsx.writeBuffer());
}
