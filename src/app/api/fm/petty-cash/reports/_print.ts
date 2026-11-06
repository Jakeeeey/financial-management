import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { heading, table, finish, printMoney } from "../disbursement/_print";
import { voucherCents } from "@/modules/financial-management/petty-cash/utils/voucherMoney";
import type { ReportPrintData, CertificateDocument, ReportRow } from "@/modules/financial-management/petty-cash/report-types";

export function reportPdf(data: ReportPrintData) {
  const { report } = data, wide = report.columns.length > 6;
  const doc = new jsPDF({ format: "a4", orientation: wide ? "landscape" : "portrait", compress: true });
  let y = heading(doc, data.company, `Report: ${report.title}`, `As of ${report.asOf} | Prepared by ${data.preparedBy}`);
  doc.setFontSize(8).setFont("helvetica", "normal");
  const filters = Object.entries(data.filters).filter(([, value]) => value !== null && value !== "").map(([key, value]) => `${key}: ${value}`).join(" | ");
  const scope = doc.splitTextToSize(`${report.scope}\nFilters: ${filters || "All records"}`, doc.internal.pageSize.getWidth() - 26); doc.text(scope, 13, y); y += scope.length * 4 + 5;
  autoTable(doc, { startY: y, theme: "grid", margin: { top: 14, bottom: 40, left: 13, right: 13 }, styles: { font: "helvetica", fontSize: wide ? 7 : 8, cellPadding: 2, overflow: "linebreak" }, headStyles: { fillColor: [240, 242, 245], textColor: 20 }, footStyles: { fillColor: [248, 248, 248], textColor: 20 }, showFoot: "lastPage", rowPageBreak: "avoid",
    head: [report.columns.map(c => c.label)], body: report.items.length ? report.items.map(row => report.columns.map(c => row[c.key] == null ? "" : c.kind === "money" ? printMoney(String(row[c.key])) : String(row[c.key]).replaceAll("_", " "))) : [["No records match these filters.", ...report.columns.slice(1).map(() => "")]],
    foot: Object.keys(report.totals).length ? [report.columns.map((c, i) => i === 0 ? "Total across complete scope" : report.totals[c.key] ? printMoney(report.totals[c.key]) : "")] : undefined,
  });
  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  const bottom = doc.internal.pageSize.getHeight() - 32;
  if (y > bottom - 15) { doc.addPage(); y = 24; }
  const width = (doc.internal.pageSize.getWidth() - 26) / 3;
  ["Prepared by", "Reviewed by", "Approved by"].forEach((s, i) => { const x = 13 + width * i; doc.line(x, y + 8, x + width - 8, y + 8); doc.setFontSize(8).text(s, x, y + 13); });
  const total = doc.getNumberOfPages(); for (let p = 1; p <= total; p++) { doc.setPage(p); doc.setFontSize(7).text(`${report.title} | ${report.total} records`, 13, doc.internal.pageSize.getHeight() - 9); doc.text(`Page ${p} of ${total}`, doc.internal.pageSize.getWidth() - 13, doc.internal.pageSize.getHeight() - 9, { align: "right" }); }
  return new Uint8Array(doc.output("arraybuffer"));
}
const decimal = (n: bigint) => `${n < 0n ? "-" : ""}${(n < 0n ? -n : n) / 100n}.${String((n < 0n ? -n : n) % 100n).padStart(2, "0")}`;
function sum(rows: ReportRow[], key: string) { return printMoney(decimal(rows.reduce((n, r) => n + voucherCents(String(r[key] || "0")), 0n))); }
export function certificatePdf(data: CertificateDocument) {
  const doc = new jsPDF({ format: "a4", compress: true }), snapshot = data.snapshot;
  snapshot.certificates.forEach((certificate, i) => {
    if (i) doc.addPage();
    let y = heading(doc, snapshot.company, "Certificate of Creditable Tax Withheld at Source", `BIR Form No. 2307 - prototype layout | ${snapshot.quarter}\nFor the period ${snapshot.from} to ${snapshot.to} | ${snapshot.fundLabel || "All funds"}`);
    y = table(doc, y, { head: [["Part I - Payee information", ""]], body: [["TIN", certificate.payee.tin], ["Payee's name", certificate.payee.name], ["Registered address", certificate.payee.address], ["ZIP code", certificate.payee.postalCode]] });
    y = table(doc, y, { head: [["Part II - Payor information", ""]], body: [["TIN", snapshot.company.tin], ["Payor's name", snapshot.company.registeredName], ["Registered address", snapshot.company.address], ["ZIP code", snapshot.company.postalCode]] });
    const firstMonth = Number(snapshot.from.slice(5, 7)); const months = [0, 1, 2].map(offset => new Date(2000, firstMonth - 1 + offset, 1).toLocaleDateString("en-PH", { month: "short" }));
    y = table(doc, y, { head: [["Part III - Income payments", ...months.map(m => `Income ${m}`), "Total income", "Tax withheld"]], body: certificate.rows.map(r => [String(r.atc), ...["month1", "month2", "month3", "income", "tax"].map(key => printMoney(String(r[key] || "0")))]), foot: [["Total", ...["month1", "month2", "month3", "income", "tax"].map(key => sum(certificate.rows, key))]], styles: { fontSize: 7.5, cellPadding: 2 } });
    y = table(doc, y, { body: [["Money payments subject to withholding of business tax (government and others)", "None"], ["Supporting vouchers", certificate.vouchers.join(", ")], ["Output note", snapshot.note]] });
    if (y > 238) { doc.addPage(); y = 24; }
    const declaration = doc.splitTextToSize("We declare under the penalties of perjury that this certificate has been made in good faith, verified by us, and to the best of our knowledge and belief, is true and correct, pursuant to the provisions of the National Internal Revenue Code, as amended, and the regulations issued under authority thereof.", 184);
    doc.setFontSize(8).text(declaration, 13, y); y += declaration.length * 4 + 6;
    finish(doc, y, [`${snapshot.company.signatory}\n${snapshot.company.signatoryTitle}\nTIN ${snapshot.company.signatoryTin}\nPayor / authorized representative`, "Conforme: Payee / authorized representative"], `2307 batch ${data.id} | ${snapshot.quarter} | Generated ${data.createdAt} by ${data.preparedBy}`);
  });
  return new Uint8Array(doc.output("arraybuffer"));
}
