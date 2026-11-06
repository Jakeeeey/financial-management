import { jsPDF } from "jspdf";
import { heading, table, finish, printMoney as money } from "../disbursement/_print";
import type { FundPosition, MasterFundRecord, CashCount } from "@/modules/financial-management/petty-cash/master-types";
import { COUNT_TYPES } from "@/modules/financial-management/petty-cash/master-types";
export type MasterPrintList = { funds: FundPosition[]; company: Record<string, string>; asOf: string; preparedBy: string; status: string; search: string };
const lastCount = (c: CashCount | null) => c ? `${c.snapshot.variance === "0.00" ? "Balanced" : money(c.snapshot.variance)} | ${c.recordedAt.slice(0, 10)}${c.resolution ? ` | cleared in ${c.resolution}` : ""}` : "Not counted";
export function masterListPdf(data: MasterPrintList) {
  const doc = new jsPDF({ format: "a4", compress: true });
  let y = heading(doc, data.company, "Petty Cash Master List", `As of ${data.asOf.replace("T", " ").slice(0, 19)} | Status: ${data.status}${data.search ? ` | Search: ${data.search}` : ""}`);
  y = table(doc, y, { head: [["Fund", "Custodian", "Imprest", "Cash on hand", "Open vouchers", "Last count", "Status"]], body: data.funds.length ? data.funds.map(p => [ `${p.fund.docNo}\n${p.fund.name}`, p.fund.custodian, money(p.fund.imprest), p.fund.status === "ACTIVE" ? money(p.fund.expectedCash) : "-", p.fund.status === "ACTIVE" ? money(p.openVouchers) : "-", lastCount(p.lastCount), p.fund.status]) : [["No matching funds", "", "", "", "", "", ""]], columnStyles: { 0: { cellWidth: 29 }, 1: { cellWidth: 29 }, 2: { halign: "right", cellWidth: 25 }, 3: { halign: "right", cellWidth: 25 }, 4: { halign: "right", cellWidth: 24 }, 5: { cellWidth: 30 }, 6: { cellWidth: 22 } } });
  return finish(doc, y, [`Prepared by\n${data.preparedBy}`, "Reviewed by", "Approved by"], "Petty Cash Master List");
}
export function fundRecordPdf(data: MasterFundRecord) {
  const doc = new jsPDF({ format: "a4", compress: true }), f = data.position.fund;
  let y = heading(doc, data.company, "Petty Cash Fund Record", `${f.docNo} - ${f.name} | As of ${data.asOf.replace("T", " ").slice(0, 19)}`);
  y = table(doc, y, { body: [["Department", f.department], ["Custodian", f.custodian], ["Imprest amount", money(f.imprest)], ["Per-voucher limit", money(f.perVoucherLimit)], ["Approval above", money(f.approvalThreshold)], ["Requested by", f.requestedBy], ["Approved by", f.approvedBy], ["Status", f.status]] });
  y = table(doc, y, { head: [["Voucher", "Date", "Payee", "Status", "Cash paid"]], body: data.vouchers.length ? data.vouchers.map(v => [v.docNo, v.date, v.payee, v.state.replaceAll("_", " "), money(v.paidNetCash)]) : [["No vouchers", "", "", "", ""]], columnStyles: { 4: { halign: "right" } } });
  return finish(doc, y, [`Custodian\n${f.custodian}`, "Reviewed by", "Approved by"], f.docNo);
}
export function cashCountPdf(data: { count: CashCount; company: Record<string, string> }) {
  const doc = new jsPDF({ format: "a4", compress: true }), c = data.count, p = c.snapshot;
  let y = heading(doc, data.company, "Cash Count Sheet", `${c.docNo} | ${COUNT_TYPES[p.type as keyof typeof COUNT_TYPES]} | ${p.fund.docNo} - ${p.fund.name} | ${c.recordedAt.replace("T", " ").slice(0, 19)}`);
  y = table(doc, y, { head: [["Type", "Denomination", "Quantity", "Amount"]], body: p.lines.filter(l => l.quantity > 0).map(l => [l.kind === "BILL" ? "Bill" : "Coin", money(l.amount), String(l.quantity), money(l.total)]), foot: [["", "", "Total cash counted", money(p.countedCash)]], columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } } });
  y = table(doc, y, { body: [["Total cash counted", money(p.countedCash)], ["Open vouchers", money(p.openVouchers)], ["Imprest amount", money(p.fund.imprest)], ["Expected cash", money(p.fund.expectedCash)], ["Variance", money(p.variance)], ["Remarks", p.remarks || "-"], ["Resolution", c.resolution || "Observation only; no journal posted by this count"]] });
  return finish(doc, y, [`Counted by\n${p.counter}`, `Witness\n${p.witness}`, `Custodian\n${p.fund.custodian}`], c.docNo);
}
