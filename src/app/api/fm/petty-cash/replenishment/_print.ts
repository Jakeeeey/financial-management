import { jsPDF } from "jspdf";
import { heading, table, finish, printMoney } from "../disbursement/_print";
import { voucherCents } from "@/modules/financial-management/petty-cash/utils/voucherMoney";
import type { ReplenishmentPreview, ReplenishmentRequest } from "@/modules/financial-management/petty-cash/replenishment-types";
export function replenishmentPdf(p: ReplenishmentPreview, r: ReplenishmentRequest | null) {
  const doc = new jsPDF({ format: "a4", compress: true });
  const reference = `${r?.docNo || "DRAFT"} | ${p.fund.docNo} - ${p.fund.name} | ${p.date} | ${r?.state || "DRAFT"}`;
  const sum = (values: string[]) => { const cents = values.reduce((total, value) => total + voucherCents(value), 0n); return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`; };
  let y = heading(doc, p.company, "Petty Cash Replenishment Request", reference);
  y = table(doc, y, { body: [["Imprest amount", printMoney(p.fund.imprest)], ["Total cash paid on vouchers", printMoney(sum(p.vouchers.map(v => v.netCash)))], ["Expected cash", printMoney(p.fund.expectedCash)], ["Actual cash counted", printMoney(p.countedCash)], ["Cash over / (short)", printMoney(p.variance)], ["Amount to replenish", printMoney(p.reimbursement)]], columnStyles: { 0: { fontStyle: "bold" } } });
  if (p.blockers.length && !r?.docNo) y = table(doc, y, { head: [["Draft preview - resolve before submission"]], body: p.blockers.map(message => [message]) });
  y = table(doc, y, { head: [["Account", "Debit", "Credit"]], body: p.lines.map(line => [`${line.account.code} - ${line.account.name}`, printMoney(line.debit), printMoney(line.credit)]), foot: [["Total", printMoney(sum(p.lines.map(l => l.debit))), printMoney(sum(p.lines.map(l => l.credit)))]], columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } } });
  if (r?.attachments.length) y = table(doc, y, { head: [["Supporting documents", "Status"]], body: r.attachments.map(f => [f.filename, f.state]) });
  y = table(doc, y, { head: [["Voucher", "Date", "Payee", "Receipts", "Gross", "Cash paid"]], body: p.vouchers.length ? p.vouchers.map(v => [v.docNo, v.date, v.payee, v.receipts.join(", "), printMoney(v.gross), printMoney(v.netCash)]) : [["No open vouchers", "", "", "", "", ""]], columnStyles: { 4: { halign: "right" }, 5: { halign: "right" } } });
  return finish(doc, y, [`Prepared by\n${r?.preparedBy || ""}`, `Received by (Custodian)\n${p.fund.custodian}`, `Approved by\n${r?.approver || ""}`], r?.docNo || "DRAFT");
}
