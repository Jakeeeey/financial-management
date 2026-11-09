import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { IMPORT_LAYOUTS, type ImportRow, type TransactionSide } from "../transaction-types";

export class WorkbookError extends Error {}
const normalizeHeader = (value: unknown) => String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const blank = (cell?: XLSX.CellObject) => !cell?.f && (cell?.v == null || String(cell.v).trim() === "");

export async function buildTransactionTemplate(side: TransactionSide) {
  const layout = IMPORT_LAYOUTS[side], book = new ExcelJS.Workbook();
  const data = book.addWorksheet(layout.sheet, { views: [{ state: "frozen", ySplit: 1 }] });
  data.columns = layout.headers.map((header, index) => ({ header, width: [15, 22, 52, 25, 25][index] }));
  data.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  data.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
  data.getColumn(1).numFmt = "yyyy-mm-dd"; data.getColumn(2).numFmt = "@";
  data.getColumn(4).numFmt = "#,##0.00"; data.getColumn(5).numFmt = "#,##0.00";
  const validation = (data as ExcelJS.Worksheet & { dataValidations: { add: (range: string, rule: ExcelJS.DataValidation) => void } }).dataValidations;
  validation.add("A2:A1048576", { type: "date", operator: "between", allowBlank: true, formulae: [new Date(Date.UTC(1900, 0, 1)), new Date(Date.UTC(9999, 11, 31))], showErrorMessage: true, errorTitle: "Date", error: "Enter a valid date, for example 2026-10-31." });
  validation.add("D2:E1048576", { type: "decimal", operator: "greaterThanOrEqual", allowBlank: true, formulae: [0], showErrorMessage: true, errorTitle: "Amount", error: "Use a positive amount in one money column only." });
  const instructions = book.addWorksheet("Instructions");
  instructions.columns = [{ width: 20 }, { width: 26 }, { width: 65 }, { width: 25 }, { width: 25 }];
  instructions.addRows([
    [`How to fill in the ${layout.sheet} template`], [],
    ["1", `Enter transactions on the ${layout.sheet} sheet starting at row 2. Keep its name and the five headers.`],
    ["2", "Dates: real Excel dates, yyyy-mm-dd, or m/d/yyyy. Keep Reference as text to preserve leading zeros."],
    ["3", `Fill only ${layout.headers[3]} or ${layout.headers[4]}. Use a positive amount with at most two decimal places.`],
    ["4", "Do not use formulas. Save as .xlsx and import on the matching side."],
    ["5", "Good rows import. Invalid rows and duplicates are skipped and reported by Excel row number."],
    ["6", "Duplicates use date, reference (letters/digits, ignoring case), and signed amount within this period and side."],
    [], ["Examples only — these rows are not imported"], [...layout.headers],
    ["2026-10-03", "000123", "Customer collection", 120000, null],
    ["2026-10-09", "CHK-1040", "Office rent", null, 32000],
    ["2026-10-31", side === "BANK" ? "DM-7790" : "DS-1031", side === "BANK" ? "Monthly service charge" : "Collection deposited after cut-off", side === "BANK" ? null : 85000, side === "BANK" ? 350 : null],
  ]);
  instructions.getRow(1).font = { bold: true, size: 14 }; instructions.getRow(11).font = { bold: true };
  instructions.getColumn(2).alignment = { wrapText: true }; instructions.getColumn(2).numFmt = "@";
  instructions.mergeCells("A1:E1"); instructions.getRow(1).height = 28;
  instructions.mergeCells("A10:E10");
  for (let row = 3; row <= 8; row++) { instructions.mergeCells(`B${row}:E${row}`); instructions.getRow(row).height = 34; }
  instructions.getColumn(4).numFmt = "#,##0.00"; instructions.getColumn(5).numFmt = "#,##0.00";
  return new Uint8Array(await book.xlsx.writeBuffer());
}

function validDate(year: number, month: number, day: number) {
  if (year < 1000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31) return "";
  const d = new Date(0); d.setUTCFullYear(year, month - 1, day); d.setUTCHours(0, 0, 0, 0);
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` : "";
}
function dateCell(cell: XLSX.CellObject | undefined, date1904: boolean) {
  if (blank(cell)) return "";
  if (cell?.t === "n") {
    const serial = Math.floor(Number(cell.v));
    if (!Number.isFinite(serial) || serial < 0 || (!date1904 && serial === 60)) return "INVALID";
    const d = XLSX.SSF.parse_date_code(serial, { date1904 });
    return d ? validDate(d.y, d.m, d.d) || "INVALID" : "INVALID";
  }
  const s = String(cell?.v ?? "").trim(), iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s), us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  return (iso ? validDate(+iso[1], +iso[2], +iso[3]) : us ? validDate(+us[3], +us[1], +us[2]) : "") || "INVALID";
}

export function parseTransactionWorkbook(buffer: Uint8Array, fileName: string, side: TransactionSide): ImportRow[] {
  const layout = IMPORT_LAYOUTS[side], other = IMPORT_LAYOUTS[side === "BANK" ? "LEDGER" : "BANK"];
  if (!/\.xlsx$/i.test(fileName)) throw new WorkbookError("Only .xlsx templates are accepted. Open the file in Excel and save as .xlsx.");
  let book: XLSX.WorkBook & { keys?: string[] };
  try {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new Error();
    book = XLSX.read(buffer, { type: "array", cellDates: false, cellNF: true, cellText: true, bookFiles: true });
    if (!book.keys?.includes("xl/workbook.xml")) throw new Error();
  } catch { throw new WorkbookError("The file could not be read as an .xlsx workbook. Save it from Excel as .xlsx and try again."); }
  const sheetName = book.SheetNames.find(name => name.trim().toLowerCase() === layout.sheet.toLowerCase());
  if (!sheetName) {
    if (book.SheetNames.some(name => name.trim().toLowerCase() === other.sheet.toLowerCase())) throw new WorkbookError(`This is the ${other.sheet} template. Import it on the other side.`);
    throw new WorkbookError(`The workbook must contain the "${layout.sheet}" data sheet. Download a fresh template.`);
  }
  const sheet = book.Sheets[sheetName];
  const cells = Object.keys(sheet).filter(key => !key.startsWith("!"));
  const headers = layout.headers.map((_, i) => sheet[XLSX.utils.encode_cell({ r: 0, c: i })] as XLSX.CellObject | undefined);
  if (headers.some((cell, index) => cell?.f || normalizeHeader(cell?.v) !== normalizeHeader(layout.headers[index]))) {
    if (headers.every((cell, index) => normalizeHeader(cell?.v) === normalizeHeader(other.headers[index]))) throw new WorkbookError(`This is the ${other.sheet} template. Import it on the other side.`);
    throw new WorkbookError(`Row 1 of "${layout.sheet}" must read: ${layout.headers.join(" | ")}. Keep the columns in this order.`);
  }
  const rowNumbers = new Set<number>();
  for (const address of cells) {
    const pos = XLSX.utils.decode_cell(address), cell = sheet[address] as XLSX.CellObject;
    if (pos.c >= 5 && !blank(cell)) throw new WorkbookError(`The "${layout.sheet}" sheet must have only the five template columns. Remove the extra column at ${address}.`);
    if (pos.r > 0 && pos.c < 5 && !blank(cell)) rowNumbers.add(pos.r);
  }
  const rows: ImportRow[] = [], date1904 = book.Workbook?.WBProps?.date1904 === true;
  for (const r of [...rowNumbers].sort((a, b) => a - b)) {
    const values = [0, 1, 2, 3, 4].map(c => sheet[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined);
    const unsupported = values.some(cell => cell?.f || cell && !["n", "s", "str", "z"].includes(cell.t));
    const ref = values[1];
    rows.push({ row: r + 1, date: dateCell(values[0], date1904), reference: ref?.t === "n" ? XLSX.utils.format_cell(ref) : String(ref?.v ?? "").trim(), description: String(values[2]?.v ?? "").trim(), moneyIn: blank(values[3]) ? "" : String(values[3]?.v).trim(), moneyOut: blank(values[4]) ? "" : String(values[4]?.v).trim(), error: unsupported ? "Formulas, errors, and unsupported cell types are not accepted; paste values instead." : "" });
  }
  return rows;
}
