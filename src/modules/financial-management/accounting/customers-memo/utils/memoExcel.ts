import ExcelJS from "exceljs";
import type { ExportDetail, ExportMemo } from "@/app/api/fm/accounting/customer-credit-memo/customers-memo/_read";

const MONEY = '"₱"#,##0.00;[Red]-"₱"#,##0.00';
const text = (value: unknown) => value == null ? "" : String(value);
const memoType = (type: number) => type === 1 ? "Credit" : type === 2 ? "Debit" : "Unknown";
const encoderName = (memo: ExportMemo) => memo.encoder_id && typeof memo.encoder_id === "object" ? [memo.encoder_id.user_fname, memo.encoder_id.user_lname].map(name => name?.trim()).filter(Boolean).join(" ") : "";
const encoder = (memo: ExportMemo) => typeof memo.encoder_id === "number" ? `Unavailable (User ID: ${memo.encoder_id})` : memo.encoder_id == null ? "Not recorded" : encoderName(memo) || "Unavailable";
const encoderNote = (memos: ExportMemo[]) => memos.some(memo => memo.encoder_id != null && !encoderName(memo))
  ? "\nEncoder note: Some names are unavailable. Source user IDs are shown where recorded." : "";

function phtDateTime(value: string): string {
  if (!value) return "";
  // Directus SQL timestamps without an offset are already local business timestamps.
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value) && !/Z$|[+-]\d{2}:?\d{2}$/.test(value)) return value.replace("T", " ").slice(0, 19);
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
function valueCell(cell: ExcelJS.Cell, value: string | number | null) {
  if (typeof value === "string" && value.length > 32767) throw new Error("A memo field exceeds Excel's cell length limit. Shorten the report scope or remarks before exporting.");
  // Strings stay literal, including text beginning with =, +, - or @. Never infer formulas/hyperlinks from user input.
  cell.value = value;
}
function workbook() {
  const book = new ExcelJS.Workbook(); book.creator = "VOS Financial Management"; book.created = new Date(); return book;
}
function sheet(book: ExcelJS.Workbook, name: string, title: string, headers: string[], widths: number[], scope: string, generatedAt: Date) {
  const ws = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4 }], pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = widths.map(width => ({ width }));
  for (let row = 1; row <= 3; row++) ws.mergeCells(row, 1, row, headers.length);
  valueCell(ws.getCell(1, 1), title); ws.getRow(1).font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF1E3A8A" } };
  valueCell(ws.getCell(2, 1), `Exported: ${phtDateTime(generatedAt.toISOString())} PHT`);
  valueCell(ws.getCell(3, 1), scope); ws.getRow(3).alignment = { wrapText: true, vertical: "top" };
  ws.getRow(3).height = Math.min(120, 16 * Math.max(1, scope.split("\n").length));
  const head = ws.getRow(4); head.values = headers; head.height = 30;
  head.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } }; head.alignment = { wrapText: true, vertical: "middle" };
  return ws;
}
function append(ws: ExcelJS.Worksheet, cells: (string | number | null)[], moneyColumns: number[] = []) {
  if (ws.rowCount >= 1_048_576) throw new Error("The export exceeds Excel's worksheet row limit. Narrow the filters and retry.");
  const row = ws.addRow([]); row.font = { name: "Calibri", size: 11 }; row.alignment = { vertical: "top", wrapText: true };
  cells.forEach((value, index) => valueCell(row.getCell(index + 1), value));
  for (const column of moneyColumns) { row.getCell(column).numFmt = MONEY; row.getCell(column).alignment = { horizontal: "right", vertical: "top" }; }
  return row;
}
function filter(ws: ExcelJS.Worksheet, lastDataRow: number, columns: number) {
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, lastDataRow), column: columns } };
}
function sum(rows: ExportMemo[], get: (row: ExportMemo) => number) { return rows.reduce((total, row) => total + Math.round(get(row) * 100), 0) / 100; }

export async function buildMemoSummaryExcel(memos: ExportMemo[], filters: string[], generatedAt = new Date()) {
  const book = workbook();
  const ws = sheet(book, "Memo Summary", "CUSTOMER MEMO SUMMARY", [
    "Memo Number", "Created Date (PHT)", "Type", "Status", "Customer Code", "Customer", "Store", "Supplier", "Salesman Code", "Salesman",
    "COA Code", "COA Account", "Reason / Remarks", "Encoder", "Memo Amount", "Applied Amount", "Remaining Balance", "CP Numbers", "Invoice Numbers",
  ], [25, 23, 12, 18, 20, 30, 25, 30, 20, 28, 20, 35, 55, 28, 19, 19, 20, 28, 28],
  `Records: ${memos.length}\nApplied filters: ${filters.length ? filters.join("\n") : "None"}${encoderNote(memos)}`, generatedAt);
  for (const memo of memos) append(ws, [text(memo.memo_number), phtDateTime(memo.created_at), memoType(memo.type), text(memo.status), text(memo.customer_id?.customer_code),
    text(memo.customer_id?.customer_name), text(memo.customer_id?.store_name), text(memo.supplier_id?.supplier_name), text(memo.salesman_id?.salesman_code), text(memo.salesman_id?.salesman_name),
    text(memo.chart_of_account?.gl_code), text(memo.chart_of_account?.account_title), text(memo.reason), encoder(memo), memo.amount, memo.applied_amount,
    memo.amount - memo.applied_amount, (memo.cpNumbers || []).join("\n"), (memo.invoiceNumbers || []).join("\n")], [15, 16, 17]);
  filter(ws, ws.rowCount, 19); ws.addRow([]);
  for (const type of [1, 2, 0]) {
    const rows = memos.filter(row => type === 0 ? row.type !== 1 && row.type !== 2 : row.type === type);
    if (!rows.length && type === 0) continue;
    const total = append(ws, [`${memoType(type).toUpperCase()} TOTAL`, `Count: ${rows.length}`, ...Array<string>(12).fill(""), sum(rows, row => row.amount), sum(rows, row => row.applied_amount), sum(rows, row => row.amount - row.applied_amount)], [15, 16, 17]);
    total.font = { name: "Calibri", size: 11, bold: true }; total.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
  }
  return book.xlsx.writeBuffer();
}
export async function buildMemoRecordExcel(details: ExportDetail, generatedAt = new Date()) {
  const book = workbook(), memo = details.header;
  const ws = sheet(book, "Memo Details", "CUSTOMER MEMO DETAILS", ["Field", "Value"], [30, 95], `Memo: ${memo.memo_number}${encoderNote([memo])}`, generatedAt);
  const fields: [string, string | number | null][] = [
    ["Memo Number", text(memo.memo_number)], ["Type", memoType(memo.type)], ["Status", text(memo.status)], ["Created Date (PHT)", phtDateTime(memo.created_at)],
    ["Customer Code", text(memo.customer_id?.customer_code)], ["Customer", text(memo.customer_id?.customer_name)], ["Store", text(memo.customer_id?.store_name)],
    ["Supplier", text(memo.supplier_id?.supplier_name)], ["Salesman Code", text(memo.salesman_id?.salesman_code)], ["Salesman", text(memo.salesman_id?.salesman_name)],
    ["COA Code", text(memo.chart_of_account?.gl_code)], ["COA Account", text(memo.chart_of_account?.account_title)], ["Reason / Remarks", text(memo.reason)], ["Encoder", encoder(memo)],
    ["Memo Amount", memo.amount], ["Applied Amount", memo.applied_amount], ["Remaining Balance", memo.amount - memo.applied_amount],
  ];
  fields.forEach(([label, value]) => append(ws, [label, value], typeof value === "number" ? [2] : []));
  const collections = sheet(book, "Collections", "LINKED COLLECTIONS", ["CP Number", "Linked Amount"], [32, 24], `Memo: ${memo.memo_number}`, generatedAt);
  details.collections.forEach(row => append(collections, [text(row.collection_id?.docNo), row.amount], [2]));
  if (!details.collections.length) append(collections, ["No linked records", null]);
  filter(collections, collections.rowCount, 2);
  if (details.collections.length) append(collections, ["TOTAL LINKED AMOUNT", details.collections.reduce((total, row) => total + Math.round(row.amount * 100), 0) / 100], [2]).font = { bold: true };
  const invoices = sheet(book, "Invoice Applications", "INVOICE APPLICATIONS", ["Invoice Number", "Invoice Date", "Due Date", "Invoice Amount", "Memo Applied Amount", "Application Date (PHT)"], [30, 18, 18, 22, 24, 26], `Memo: ${memo.memo_number}`, generatedAt);
  details.invoices.forEach(row => append(invoices, [text(row.invoice_id?.invoice_no), text(row.invoice_id?.invoice_date).slice(0, 10), text(row.invoice_id?.due_date).slice(0, 10),
    row.invoice_id?.net_amount ?? null, row.amount, row.date_applied ? phtDateTime(row.date_applied) : ""], [4, 5]));
  if (!details.invoices.length) append(invoices, ["No linked records", "", "", null, null, ""]);
  filter(invoices, invoices.rowCount, 6);
  if (details.invoices.length) append(invoices, ["TOTAL MEMO APPLIED", "", "", null, details.invoices.reduce((total, row) => total + Math.round(row.amount * 100), 0) / 100, ""], [5]).font = { bold: true };
  return book.xlsx.writeBuffer();
}
