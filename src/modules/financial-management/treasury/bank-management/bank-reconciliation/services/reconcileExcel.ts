import ExcelJS from "exceljs";
import type { ReconcileExportData } from "../export-types";
import { transactionCents } from "../utils/transactionDisplay";
import { exportMetadata, ReconcileExportError, summaryRows } from "./reconcileExport";

const MONEY = '#,##0.00;(#,##0.00);"-"';
export function numeric(value: string | null, field: string): number | string {
  if (value == null) return "Unavailable";
  const number = Number(value), fixed = number.toFixed(2), excelFixed = Number(number.toPrecision(15)).toFixed(2);
  if (!/^-?\d+\.\d{2}$/.test(fixed) || !/^-?\d+\.\d{2}$/.test(excelFixed) || transactionCents(fixed) !== transactionCents(value) || transactionCents(excelFixed) !== transactionCents(value)) {
    throw new ReconcileExportError(`Excel cannot preserve every cent of ${field}: ${value}. Download PDF for the exact amount.`);
  }
  return number;
}
export function text(value: string) {
  if (value.length > 32767) throw new ReconcileExportError("A reconciliation field exceeds Excel's 32,767-character cell limit. Download PDF for the full content.");
  return value;
}
export async function buildReconcileExcel(data: ReconcileExportData) {
  const book = new ExcelJS.Workbook(); book.creator = data.generatedBy.name; book.created = new Date(data.generatedAt);
  const metadata = exportMetadata(data);
  function sheet(name: string, title: string, headers: string[], widths: number[], rows: (string | number)[][], money: number[], dates: number[] = [], references: number[] = []) {
    if (rows.length + 7 > 1_048_576) throw new ReconcileExportError(`The ${name} sheet exceeds Excel's row limit. No partial workbook was exported.`);
    const ws = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 7 }], pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
    ws.columns = widths.map(width => ({ width })); ws.properties.defaultRowHeight = 22;
    [title, ...metadata].forEach((line, index) => { ws.mergeCells(index + 1, 1, index + 1, headers.length); ws.getCell(index + 1, 1).value = text(line); ws.getRow(index + 1).height = index === 0 ? 28 : 32; });
    ws.getRow(1).font = { name: "Arial", size: 16, bold: true };
    const head = ws.getRow(7); head.values = headers; head.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } }; head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D5C63" } };
    ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7, column: headers.length } };
    for (const values of rows) {
      const row = ws.addRow(values.map(value => typeof value === "string" ? text(value) : value));
      row.font = { name: "Arial", size: 10 }; row.alignment = { vertical: "top", wrapText: true };
      for (const col of money) { row.getCell(col).numFmt = MONEY; row.getCell(col).alignment = { horizontal: "right", vertical: "top" }; }
      for (const col of references) row.getCell(col).numFmt = "@";
      for (const col of dates) {
        const cell = row.getCell(col); if (typeof cell.value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cell.value)) { cell.value = new Date(cell.value + "T00:00:00Z"); cell.numFmt = "yyyy-mm-dd"; }
      }
    }
    for (let index = 2; index <= 6; index++) ws.getRow(index).font = { name: "Arial", size: 10, color: { argb: "FF5D6B78" } };
    for (let index = 1; index <= 6; index++) ws.getCell(index, 1).alignment = { wrapText: true, vertical: "top" };
    return ws;
  }
  sheet("Summary", "Bank reconciliation summary", ["Field", "Value"], [48, 80], summaryRows(data).map(row => [row.label, row.money ? numeric(row.value, row.label) : row.value || ""]), [2]);
  const counts = (name: string, pane: ReconcileExportData["bank"]) => [`${name}: ${pane.total} lines; ${pane.matched} matched; ${pane.open} open`, "", "Net", numeric(pane.net, `${name} net`)];
  sheet("Bank statement", "Bank statement lines", ["Date", "Ref", "Description", "Amount", "Status", "Offset account", "JE #"], [13, 20, 46, 22, 45, 32, 20], [...data.bank.items.map(line => [line.date, line.reference, line.description, numeric(line.amount, `bank line ${line.reference || line.id}`), line.status, line.offsetAccount, line.jeNumber || ""]), counts("Bank statement", data.bank)], [4], [1], [2]);
  sheet("Ledger", "Cash in Bank ledger lines", ["Date", "Ref", "Description", "Amount", "Status"], [13, 20, 50, 22, 48], [...data.ledger.items.map(line => [line.date, line.reference, line.description, numeric(line.amount, `ledger line ${line.reference || line.id}`), line.status]), counts("Ledger", data.ledger)], [4], [1], [2]);
  sheet("Matches", "Matches", ["Match", "Bank refs", "Ledger refs", "Bank amount", "Ledger amount", "Difference", "Treatment", "Offset account", "JE #"], [12, 30, 30, 22, 22, 22, 20, 32, 20], data.matches.map(m => [m.label, m.bankReferences.join(", "), m.ledgerReferences.join(", "), numeric(m.bankAmount, `${m.label} bank total`), numeric(m.ledgerAmount, `${m.label} ledger total`), numeric(m.difference, `${m.label} difference`), m.treatment, m.offsetAccount, m.jeNumber]), [4, 5, 6], [], [1, 2, 3]);
  return new Uint8Array(await book.xlsx.writeBuffer());
}
