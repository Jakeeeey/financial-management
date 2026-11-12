import type { AuditEvent, ReportKey, ReportsExportData } from "../report-types";
import { exportMetadata, exportTime } from "./reconcileExport";
import { postingExplanation, postingStatus, POSTING_TOTAL_NOTE } from "./postingExport";

export type ReportRow = { cells: (string | number | null)[]; style?: "group" | "total" | "adjusted" };
export type ReportTable = { key: ReportKey; name: string; title: string; headers: string[]; widths: number[]; money: number[]; rows: ReportRow[]; notes: string[] };
export function auditDetail(event: AuditEvent) {
  return [event.summary, ...event.changes.map(change => `${change.label}: ${change.before ?? "Not recorded"} → ${change.after ?? "Not recorded"}`), ...event.facts.map(fact => `${fact.label}: ${fact.value}`), event.notice].filter(Boolean).join("\n");
}
export function reportsMetadata(data: ReportsExportData) {
  return [...exportMetadata(data), `History captured at generation: ${data.audit.length} events through #${data.throughEventId}; ${data.closedPeriods.length} closure revisions through #${data.throughClosureId}. Audit covers full period activity; closures cover the selected bank account.`];
}
export function reportTables(data: ReportsExportData): ReportTable[] {
  const statement: ReportRow[] = [];
  for (const side of data.statement) {
    statement.push({ cells: [`${side.part}: ${side.title}`, "", "", ""], style: "group" }, { cells: [side.openingLabel, "", "", side.openingBalance], style: "group" });
    for (const group of side.groups) {
      statement.push({ cells: [group.label, "", "", group.total], style: "group" });
      statement.push(...(group.items.length ? group.items.map(item => ({ cells: [item.reference, item.description, item.amount, ""] })) : [{ cells: ["", "None", "", ""] }]));
    }
    statement.push({ cells: [side.adjustedLabel, "", "", side.adjustedBalance], style: "adjusted" }, { cells: ["", "", "", ""] });
  }
  statement.push({ cells: ["Difference", "", "", data.reconciliation.difference], style: "total" }, { cells: ["Status", data.reconciliation.statusLabel, "", ""] });
  const journal: ReportRow[] = data.journal.entries.flatMap(entry => entry.lines.map((line, index) => ({ cells: [index ? "" : entry.workbenchNumber || entry.journalNumber || "Draft", index ? "" : entry.date || "Not set", line.account ? `${line.account.code} · ${line.account.name}` : "No account", line.debit, line.credit, index ? "" : postingExplanation(entry), index ? "" : postingStatus(entry), index ? "" : entry.postedBy || "", index ? "" : exportTime(entry.postedAt), index ? "" : entry.journalId ? String(entry.journalId) : "", index ? "" : entry.journalNumber || "", index ? "" : entry.sourceLabel, index ? "" : entry.importReference || "", index ? "" : entry.reversesNumber || "", index ? "" : entry.reversedByNumber || ""] })));
  if (!journal.length) journal.push({ cells: ["", "", "No adjusting entries", "", ""] });
  journal.push({ cells: ["", "", "Totals of all displayed lines", data.journal.totals.debit, data.journal.totals.credit], style: "total" });
  const review = [...data.period.ledgerBlockers, data.period.setupWarning, data.journal.postingDate.message, data.period.statementCheck?.state === "WARNING" ? data.period.statementCheck.message : ""].filter((s): s is string => Boolean(s));
  return [
    { key: "statement", name: "Statement", title: "Bank reconciliation statement", headers: ["Ref", "Description", "Amount", "Total"], widths: [38, 64, 24, 24], money: [2, 3], rows: statement, notes: review },
    { key: "aging", name: "Aging", title: "Outstanding items aging", headers: ["Type", "Date", "Ref", "Description", "Days", ...data.aging.buckets], widths: [29, 14, 23, 58, 10, 23, 23, 23, 23], money: [5, 6, 7, 8], rows: [
      ...data.aging.items.map(item => ({ cells: [item.type + (item.stale ? " · Stale, over 6 months" : ""), item.date, item.reference, item.description, item.days, ...data.aging.buckets.map((_, index) => item.bucket === index ? item.amount : "")] })),
      ...(data.aging.items.length ? [] : [{ cells: ["No outstanding items."] }]), { cells: ["", "", "", "Total", "", ...data.aging.totals], style: "total" },
    ], notes: [`Age at ${data.period.periodEnd || "period end not set"}; ${data.aging.count} items; net ${data.aging.net} ${data.period.currency}.`, "Follow up items past 90 days; review stale checks before deciding on reversal.", ...(!data.aging.available ? ["Set the period end in Reconcile to calculate aging and stale-check flags."] : [])] },
    { key: "journal", name: "Journal entries", title: "Adjusting entries journal", headers: ["JE #", "Date", "Account", "Debit", "Credit", "Explanation", "Status", "Posted by", "Posted at (PHT)", "GL journal ID", "GL journal #", "Source", "Import reference", "Reverses JE", "Reversed by JE"], widths: [20, 14, 38, 24, 24, 64, 42, 26, 29, 18, 23, 42, 36, 23, 23], money: [3, 4], rows: journal, notes: [POSTING_TOTAL_NOTE, `Ledger before adjustments: ${data.journal.summary.ledgerBefore ?? "Unavailable"}; confirmed cash effect: ${data.journal.summary.postedCashEffect}; ledger after posting: ${data.journal.summary.ledgerAfter ?? "Unavailable"}; still to post: ${data.journal.summary.stillToPost ?? "Unavailable"} ${data.period.currency}.`] },
    { key: "audit", name: "Audit trail", title: "Audit trail", headers: ["When (PHT)", "Action", "By", "Detail"], widths: [29, 34, 30, 110], money: [], rows: data.audit.length ? data.audit.map(event => ({ cells: [exportTime(event.occurredAt), `${event.actionLabel}${event.scope === "Bank setup" ? " · Bank setup" : ""}`, event.actor.name, auditDetail(event)] })) : [{ cells: ["", "", "", "No activity recorded for this period."] }], notes: ["Full selected period history, including bank setup and activity after a selected closure revision; newest first."] },
    { key: "closedPeriods", name: "Closed periods", title: "Closed periods", headers: ["Period ended", "Closed (PHT)", "Closed by", "Adjusted bank", "Adjusted book", "Entries", "Journal entries / GL references", "Closure ID", "Revision", "Currency", "Notice"], widths: [15, 29, 30, 25, 25, 12, 65, 16, 12, 12, 64], money: [3, 4], rows: data.closedPeriods.length ? data.closedPeriods.map(row => ({ cells: [row.periodEnd || "Unavailable", exportTime(row.closedAt), row.closedBy.name || `User #${row.closedBy.id}`, row.adjustedBankBalance, row.adjustedBookBalance, row.entryCount, row.journals.map(j => `${j.workbenchNumber || "Workbench number unavailable"} · GL: ${j.glNumber || `#${j.glId}`}`).join("\n") || (row.available ? "None" : "Unavailable"), String(row.closureId), row.revision, row.currency || "Unavailable", row.notice || ""] })) : [{ cells: ["No closed periods for this bank account."] }], notes: ["All preserved closure revisions for the selected bank account, including revisions of reopened periods. Balances and confirmed GL references come from saved snapshots."] },
  ];
}
export function copiedReport(data: ReportsExportData, key: ReportKey) {
  const table = reportTables(data).find(item => item.key === key)!;
  // Keep tab-separated columns stable when a description contains tabs or line breaks.
  const cell = (value: string | number | null) => value == null ? "Unavailable" : String(value).replace(/[\t\r\n]+/g, " ");
  return [table.title.toUpperCase(), ...reportsMetadata(data), ...table.notes, "", table.headers.join("\t"), ...table.rows.map(row => row.cells.map(cell).join("\t"))].join("\n");
}
