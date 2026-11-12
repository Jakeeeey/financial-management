import ExcelJS from "exceljs";
import type { FallbackExportData } from "../posting-types";
import { transactionCents } from "../utils/transactionDisplay";

export class FallbackJournalExportError extends Error {}
function numeric(value: string) {
  const number = Number(value), fixed = number.toFixed(2), excel = Number(number.toPrecision(15)).toFixed(2);
  if (!/^-?\d+\.\d{2}$/.test(fixed) || !/^-?\d+\.\d{2}$/.test(excel) || transactionCents(fixed) !== transactionCents(value) || transactionCents(excel) !== transactionCents(value)) throw new FallbackJournalExportError(`Excel cannot preserve every cent of ${value}. No journal file was generated.`);
  return number;
}
function cellText(value: string) { if (value.length > 32767) throw new FallbackJournalExportError("A journal field exceeds Excel's cell limit. No partial file was generated."); return value; }
export function fallbackFilename(data: FallbackExportData) {
  const entity = (data.entity?.name || "Entity").replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 75);
  return `Bank-rec_${entity}_${data.period.periodEnd}_Journal-import_${data.requestId.slice(0, 8)}.xlsx`;
}
export async function buildFallbackJournalExcel(data: FallbackExportData) {
  if (data.entries.reduce((rows, entry) => rows + entry.lines.length, 1) > 1_048_576) throw new FallbackJournalExportError("The journal exceeds Excel's row limit. No partial file was generated.");
  const book = new ExcelJS.Workbook(); book.creator = `ERP user ${data.generatedBy}`;
  const sheet = book.addWorksheet("Journal entries", { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = ["Company ID", "Company", "Bank account ID", "Bank / branch / masked account", "Currency", "Period end", "Workbench JE", "Import reference", "Posting date", "Account code", "Account title", "Debit", "Credit", "Department ID", "Explanation", "Source type", "Source ID", "Reverses JE", "Generated at (PHT)"];
  sheet.columns = headers.map((header, index) => ({ header, width: [2, 3, 14].includes(index) ? 48 : [1, 10].includes(index) ? 30 : 21 }));
  sheet.getRow(1).font = { bold: true }; sheet.getRow(1).alignment = { wrapText: true }; sheet.getRow(1).height = 34;
  sheet.autoFilter = { from: "A1", to: "S1" };
  let debit = 0n, credit = 0n;
  for (const entry of data.entries) {
    let entryDebit = 0n, entryCredit = 0n;
    for (const line of entry.lines) {
      if (!line.account || !entry.workbenchNumber || !entry.importReference || !entry.date) throw new FallbackJournalExportError("The journal snapshot is incomplete.");
      const row = sheet.addRow([data.entity?.id || data.period.companyId, data.entity?.name || "", data.period.bankId, [data.period.bank.bankName, data.period.bank.branch, data.period.bank.maskedAccountNumber].join(" | "), data.period.currency, data.period.periodEnd, entry.workbenchNumber, entry.importReference, entry.date, line.account.code, line.account.name, numeric(line.debit), numeric(line.credit), (line as typeof line & { departmentId?: number }).departmentId ?? "", entry.explanation, entry.sourceType, String(entry.sourceId), entry.reversesNumber || "", data.generatedAt].map(value => typeof value === "string" ? cellText(value) : value));
      for (const col of [6, 7, 8, 9, 10, 17, 18]) row.getCell(col).numFmt = "@";
      for (const col of [12, 13]) row.getCell(col).numFmt = '#,##0.00;(#,##0.00);"-"';
      row.alignment = { vertical: "top", wrapText: true }; entryDebit += transactionCents(line.debit); entryCredit += transactionCents(line.credit);
    }
    if (entryDebit <= 0n || entryDebit !== entryCredit) throw new FallbackJournalExportError("Every exported journal must balance exactly."); debit += entryDebit; credit += entryCredit;
  }
  if (!data.entries.length || debit !== credit) throw new FallbackJournalExportError("There are no balanced journals to export.");
  const instructions = book.addWorksheet("Instructions"); instructions.columns = [{ width: 120 }];
  for (const text of ["Bank Reconciliation journal import", "This workbook does not post to the GL. Entries remain unconfirmed until verified in Posting.", "Import each Workbench JE once, using its exact Import reference as the ERP journal reference. Preserve all dates, accounts, departments and amounts. Blank Department ID means no department.", "After the GL journals are Posted, use Verify imported journal in Bank Reconciliation. Do not create another journal by clicking Post for an exported entry.", "The company, bank account, currency and unique reference identify this export. Workbench JE numbers are sequential per company; the underlying ERP journal has its own AJE number.", "A withdrawn file must never be imported. If a journal was already imported, verify or reconcile that journal before attempting withdrawal.", "Reversals swap the original debit and credit and remain unconfirmed until their own GL journal is verified. The original source stays locked until then.", `Generated ${data.generatedAt} by ERP user ${data.generatedBy}. Request ${data.requestId}.`]) { const row = instructions.addRow([text]); row.alignment = { wrapText: true, vertical: "top" }; row.height = 45; }
  return new Uint8Array(await book.xlsx.writeBuffer());
}
