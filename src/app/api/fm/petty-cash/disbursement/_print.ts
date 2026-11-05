import { jsPDF } from "jspdf";
import autoTable, { type UserOptions } from "jspdf-autotable";
import type { VoucherFund, VoucherOperations } from "@/modules/financial-management/petty-cash/voucher-types";

export type VoucherPrintList = { fund: VoucherFund; vouchers: VoucherOperations[]; company: Record<string, string>; asOf: string; preparedBy: string };
const status = (value: string) => value.replaceAll("_", " ");
export function printMoney(value: string) {
  const negative = value.startsWith("-"), [whole, cents = "00"] = value.replace(/^-/, "").split(".");
  return `${negative ? "-" : ""}PHP ${BigInt(whole).toLocaleString("en-PH")}.${cents.padEnd(2, "0")}`;
}
export function heading(doc: jsPDF, company: Record<string, string>, title: string, reference: string) {
  let y = 13;
  for (const [text, size] of [[company.registeredName || "Petty Cash", 12], [`${company.address || ""}${company.postalCode ? ` ${company.postalCode}` : ""}`.trim(), 8], [company.tin ? `TIN ${company.tin}` : "", 8], [title, 15], [reference, 9]] as const) {
    if (!text) continue;
    doc.setFontSize(size).setFont("helvetica", size >= 12 ? "bold" : "normal");
    const lines = doc.splitTextToSize(text, 184); doc.text(lines, 13, y); y += lines.length * (size >= 12 ? 6 : 4) + 2;
  }
  return y + 2;
}
export function table(doc: jsPDF, y: number, options: UserOptions) {
  autoTable(doc, { startY: y, margin: { left: 13, right: 13, top: 15, bottom: 48 }, styles: { font: "helvetica", fontSize: 8, cellPadding: 2, overflow: "linebreak", textColor: 20 }, headStyles: { fillColor: [240, 242, 245], textColor: 20, fontStyle: "bold" }, footStyles: { fillColor: [248, 248, 248], textColor: 20 }, theme: "grid", rowPageBreak: "avoid", showFoot: "lastPage", ...options });
  return (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
}
export function finish(doc: jsPDF, y: number, signatures: string[], reference: string) {
  if (y > 258) { doc.addPage(); y = 25; }
  const cell = 184 / signatures.length;
  signatures.forEach((label, index) => { const x = 13 + cell * index; doc.setDrawColor(90).line(x, y + 12, x + cell - 7, y + 12); doc.setFontSize(8).setFont("helvetica", "normal").text(doc.splitTextToSize(label, cell - 8), x, y + 17); });
  const total = doc.getNumberOfPages();
  for (let page = 1; page <= total; page++) { doc.setPage(page); doc.setFontSize(7).setTextColor(90); doc.text(reference, 13, 288); doc.text(`Page ${page} of ${total}`, 197, 288, { align: "right" }); }
  return new Uint8Array(doc.output("arraybuffer"));
}
export function voucherPdf(data: VoucherOperations) {
  const doc = new jsPDF({ format: "a4", compress: true }), p = data.effective.saved;
  let y = heading(doc, data.company, "Petty Cash Voucher", `${data.voucher.docNo} | ${p.date} | ${status(data.voucher.state)}`);
  if (["DRAFT", "FOR_APPROVAL", "VOID", "REJECTED"].includes(data.voucher.state)) { doc.setFontSize(10).setFont("helvetica", "bold").text(`${status(data.voucher.state)}${["DRAFT", "FOR_APPROVAL"].includes(data.voucher.state) ? " - UNPAID" : ""}`, 13, y); y += 8; }
  y = table(doc, y, { body: [["Fund", `${data.fundDocNo} - ${data.fundName}`], ["Payee", `${p.payee.name}${p.payee.details.tin ? ` | TIN ${p.payee.details.tin}` : ""}`], ["Particulars", p.particulars], ["Status / reason", `${status(data.voucher.state)}${data.reason ? `: ${data.reason}` : ""}`]], columnStyles: { 0: { cellWidth: 35, fontStyle: "bold" } } });
  y = table(doc, y, { head: [["Document", "Receipt no.", "Expense account", "Amount", "VAT", "EWT"]], body: p.lines.map(line => [status(line.documentType), line.receiptNo, `${line.account.code} - ${line.account.name}`, printMoney(line.amounts.gross), printMoney(line.amounts.inputVat), `${printMoney(line.amounts.ewt)}${line.taxSnapshot.ewt.code ? `\n${line.taxSnapshot.ewt.code} (${line.taxSnapshot.ewt.rate}%)` : ""}`]), foot: [["", "", "Total", printMoney(p.totals.gross), printMoney(p.totals.inputVat), printMoney(p.totals.ewt)], ["", "", "Net cash payable", "", "", printMoney(p.totals.netCash)], ["", "", "Actual cash paid", "", "", printMoney(data.paidNetCash)]], columnStyles: { 2: { cellWidth: 48 }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } } });
  if (data.proposed) y = table(doc, y, { body: [["Pending changes", "This document shows the effective voucher. Proposed changes have not changed its paid cash."]] });
  if (data.effective.attachments.length) y = table(doc, y, { head: [["Supporting documents"]], body: data.effective.attachments.map(file => [file.filename]) });
  if (data.revisions.length > 1) y = table(doc, y, { head: [["Revision", "When / by", "State / amounts / reason"]], body: data.revisions.map(r => [String(r.number), `${r.preparedAt.replace("T", " ")}\n${r.preparedBy}`, `${r.state} | Gross ${printMoney(r.saved.totals.gross)} | Net ${printMoney(r.saved.totals.netCash)}${r.reason ? `\n${r.reason}` : ""}`]) });
  return finish(doc, y, [`Prepared by\n${data.effective.preparedBy}`, `Approved by\n${data.effective.decidedBy || ""}`, "Received by (Payee)"], data.voucher.docNo);
}
export function voucherListPdf(data: VoucherPrintList) {
  const doc = new jsPDF({ format: "a4", compress: true });
  let y = heading(doc, data.company, "Petty Cash Voucher List", `${data.fund.docNo} - ${data.fund.name} | As of ${data.asOf}`);
  y = table(doc, y, { head: [["Voucher", "Date", "Payee", "Receipts", "Status", "Cash paid"]], body: data.vouchers.length ? data.vouchers.map(v => [v.voucher.docNo, v.effective.saved.date, v.effective.saved.payee.name, v.effective.saved.lines.map(line => line.receiptNo).join(", "), status(v.voucher.state), printMoney(v.paidNetCash)]) : [["No open vouchers", "", "", "", "", ""]], foot: [["", "", "", "", "Total open vouchers", printMoney(data.fund.openVouchers)], ["", "", "", "", "Cash on hand", printMoney(data.fund.expectedCash)], ["", "", "", "", "Imprest amount", printMoney(data.fund.imprestAmount)]], columnStyles: { 4: { cellWidth: 28 }, 5: { halign: "right", cellWidth: 32 } } });
  return finish(doc, y, [`Prepared by\n${data.preparedBy || ""}`, "Reviewed by", "Approved by"], data.fund.docNo);
}
