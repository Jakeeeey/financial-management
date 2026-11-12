"use client";

import { Button } from "@/components/ui/button";
import { useHistoryReport } from "../hooks/useHistoryReport";
import { getClosedPeriods } from "../providers/bankReconciliationReportsApi";
import { useAuditHistory } from "../hooks/useAuditHistory";
import { AuditHistoryFilters } from "./AuditHistoryFilters";
import { exportTime } from "../services/reconcileExport";
import { transactionMoney } from "../utils/transactionDisplay";
import type { HistoryPage } from "../report-types";
import type { ReactNode } from "react";
import { HistorySkeleton } from "./BankReconciliationSkeletons";

function Pagination({ data, loading, onPage }: { data: HistoryPage<unknown>; loading: boolean; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p>{data.total} record(s) · Page {data.page} of {pages}</p><div className="flex gap-2"><Button type="button" variant="outline" disabled={loading || data.page <= 1} onClick={() => onPage(data.page - 1)}>Previous</Button><Button type="button" variant="outline" disabled={loading || data.page >= pages} onClick={() => onPage(data.page + 1)}>Next</Button></div></div>;
}
function ErrorNotice({ error, retry }: { error: string; retry: () => void }) {
  return <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 p-3 text-sm text-destructive"><span>{error}</span><Button type="button" variant="outline" onClick={retry}>Retry</Button></div>;
}
function recordedValue(value: string | null, type: "money" | "text") {
  if (value == null) return "Not recorded";
  if (type !== "money" || !/^-?\d+(\.\d+)?$/.test(value)) return value;
  const [whole, fraction] = value.split(".");
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}${fraction === undefined ? "" : `.${fraction}`}`;
}

export function AuditTrailReport({ periodId, copyButton }: { periodId: number; copyButton?: ReactNode }) {
  const report = useAuditHistory(periodId), { data, loading, error } = report;
  return <section id="r-audit" aria-labelledby="audit-title" aria-busy={loading} className="scroll-mt-4 space-y-4 rounded-lg border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="audit-title" className="text-lg font-semibold">Audit trail</h2><div className="flex flex-wrap gap-2">{copyButton}<Button type="button" variant="outline" disabled={loading || Boolean(report.validation)} onClick={report.refresh}>Refresh audit trail</Button></div></div>
    <p className="text-sm text-muted-foreground">Full activity for the selected period, newest first, including bank setup and later reopening or next-period activity. Financial results for a closed revision remain preserved. Refresh to include newer events.</p>
    <p className="text-xs text-muted-foreground">Screen filters affect this table only. Copy, Excel, and PDF include the full report history and may include events newer than your last audit refresh.</p>
    <AuditHistoryFilters report={report} />
    {data && <p role="status" className="text-sm text-muted-foreground">{data.total} of {data.scopeTotal ?? data.total} events match{report.active ? " these filters" : " · All activity"}.</p>}
    {error && <ErrorNotice error={error} retry={report.retry} />}{loading && <HistorySkeleton label="Loading audit trail" columns={4} rows={4} />}
    {data && <><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b text-left">{["When", "Action", "By", "Detail"].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{data.items.length ? data.items.map(event => <tr key={event.id} className="border-b align-top">
      <td className="whitespace-nowrap p-2">{exportTime(event.occurredAt)}</td><td className="min-w-36 p-2">{event.actionLabel}{event.scope === "Bank setup" && <p className="mt-1 text-xs text-muted-foreground">Bank setup</p>}</td><td className="min-w-32 max-w-48 break-words p-2">{event.actor.name}</td><td className="min-w-64 max-w-2xl break-words p-2"><p>{event.summary}</p>
        {(event.changes.length > 0 || event.facts.length > 0) && <details className="mt-2"><summary aria-label={`Show details for event ${event.id}`} className="cursor-pointer text-primary">Show details</summary><div className="mt-2 space-y-3 rounded-md border p-3">
          {event.changes.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Field</th><th className="p-2">Before</th><th className="p-2">After</th></tr></thead><tbody>{event.changes.map((change, index) => <tr key={index} className="border-b align-top"><th className="p-2 text-left font-medium">{change.label}</th><td className="p-2 tabular-nums">{recordedValue(change.before, change.type)}</td><td className="p-2 tabular-nums">{recordedValue(change.after, change.type)}</td></tr>)}</tbody></table></div>}
          {event.facts.length > 0 && <dl className="space-y-2">{event.facts.map((fact, index) => <div key={index}><dt className="text-xs text-muted-foreground">{fact.label}</dt><dd className="break-words">{fact.value}</dd></div>)}</dl>}
        </div></details>}{event.notice && <p className="mt-2 text-xs text-muted-foreground">{event.notice}</p>}
      </td></tr>) : <tr><td colSpan={4} className="p-4 text-muted-foreground">{report.active ? "No audit events match these filters. Clear audit filters to see all activity." : "No activity recorded for this period."}</td></tr>}</tbody></table></div><Pagination data={data} loading={loading} onPage={report.loadPage} /></>}
  </section>;
}

export function ClosedPeriodsReport({ periodId, onView, copyButton }: { periodId: number; onView: (id: number, closureId: number) => void; copyButton?: ReactNode }) {
  const report = useHistoryReport(periodId, getClosedPeriods), { data, loading, error } = report;
  const money = (value: string | null, currency: string | null) => value == null ? "Unavailable" : transactionMoney(value, currency || "PHP");
  return <section id="r-closed" aria-labelledby="closed-title" aria-busy={loading} className="scroll-mt-4 space-y-4 rounded-lg border bg-card p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="closed-title" className="text-lg font-semibold">Closed periods</h2><div className="flex flex-wrap gap-2">{copyButton}<Button type="button" variant="outline" disabled={loading} onClick={report.refresh}>Refresh closed periods</Button></div></div>
    <p className="text-sm text-muted-foreground">Preserved closure revisions for the selected bank account, including revisions of reopened periods. Balances, closure identity and confirmed GL entries come from each saved snapshot.</p>
    {error && <ErrorNotice error={error} retry={report.retry} />}{loading && <HistorySkeleton label="Loading closed periods" columns={7} rows={3} />}
    {data && <><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-sm"><thead><tr className="border-b text-left">{["Period ended", "Closed", "Closed by", "Adjusted bank", "Adjusted book", "Entries", "Journal entries"].map((label, index) => <th key={label} className={`p-2 ${index >= 3 && index <= 5 ? "text-right" : ""}`}>{label}</th>)}</tr></thead><tbody>{data.items.length ? data.items.map(row => <tr key={row.closureId} className="border-b align-top">
      <td className="whitespace-nowrap p-2"><p>{row.periodEnd || "Unavailable"}</p><p className="mt-1 text-xs text-muted-foreground">Revision {row.revision} · Closure #{row.closureId}</p><Button type="button" size="sm" variant="outline" className="mt-2" disabled={!row.available} aria-label={`View revision ${row.revision}, closure ${row.closureId}`} onClick={() => onView(row.periodId, row.closureId)}>View revision</Button>{row.notice && <p className="mt-2 max-w-52 whitespace-normal text-xs text-amber-700 dark:text-amber-400">{row.notice}</p>}</td>
      <td className="whitespace-nowrap p-2">{exportTime(row.closedAt)}</td><td className="max-w-48 break-words p-2">{row.closedBy.name || `User #${row.closedBy.id}`}</td><td className="whitespace-nowrap p-2 text-right tabular-nums">{money(row.adjustedBankBalance, row.currency)}</td><td className="whitespace-nowrap p-2 text-right tabular-nums">{money(row.adjustedBookBalance, row.currency)}</td><td className="p-2 text-right tabular-nums">{row.entryCount ?? "Unavailable"}</td><td className="min-w-48 p-2">{row.journals.length ? <ul className="space-y-1">{row.journals.map(journal => <li key={journal.glId}>{journal.workbenchNumber || "Workbench number unavailable"}<span className="block text-xs text-muted-foreground">GL: {journal.glNumber || `#${journal.glId}`}</span></li>)}</ul> : row.available ? "None" : "Unavailable"}</td>
    </tr>) : <tr><td colSpan={7} className="p-4 text-muted-foreground">No closed periods for this bank account.</td></tr>}</tbody></table></div><Pagination data={data} loading={loading} onPage={report.loadPage} /></>}
  </section>;
}
