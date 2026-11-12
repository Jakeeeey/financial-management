"use client";

import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { BankReconciliationContext } from "./reference-types";
import { getBankReconciliationContext } from "./providers/bankReconciliationReferencesApi";
import { useFinancialReports } from "./hooks/useFinancialReports";
import { PeriodHistoryChoice } from "./components/PeriodHistoryChoice";
import { AuditTrailReport, ClosedPeriodsReport } from "./components/HistoryReports";
import { postingStatus, POSTING_TOTAL_NOTE } from "./services/postingExport";
import { transactionMoney } from "./utils/transactionDisplay";
import { useReportsExports } from "./hooks/useReportsExports";
import { CopyReportButton } from "./components/CopyReportButton";
import type { ReportKey } from "./report-types";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { BankAccountLabel } from "./components/BankAccountLabel";
import { exportTime } from "./services/reconcileExport";
import { ReportsSkeleton } from "./components/BankReconciliationSkeletons";

export default function BankReconciliationReportsModule() {
  const [context, setContext] = useState<BankReconciliationContext | null>(null), [accessError, setAccessError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getBankReconciliationContext(controller.signal).then(value => { if (!value.workspaces.some(w => w.key === "reports")) throw new Error("Reports module access is required."); setContext(value); }).catch(e => { if (!controller.signal.aborted) setAccessError(e.message); });
    return () => controller.abort();
  }, []);
  const reports = useFinancialReports(context !== null), { data, loading } = reports, period = data?.period;
  const [historyPeriodId, setHistoryPeriodId] = useState<number | null>(null);
  if (data && data.period.id !== historyPeriodId) setHistoryPeriodId(data.period.id);
  const exports = useReportsExports(period), exporting = Boolean(exports.busy);
  const fileFeedback = exports.action === "xlsx" || exports.action === "pdf";
  const copy = (key: ReportKey, name: string) => <CopyReportButton id={`copy-report-${key}`} name={name} busy={exports.busy === key} disabled={!data || loading || exporting} feedback={exports.action === key ? exports : undefined} onClick={() => void exports.run(key)} onRetry={() => void exports.run(key)} onRefresh={reports.refresh} />;
  const money = (value: string | null | undefined) => value == null ? "Unavailable" : value.startsWith("-") ? `(${transactionMoney(value.slice(1), period?.currency || "PHP")})` : transactionMoney(value, period?.currency || "PHP");
  const viewRevision = async (id: number, closureId: number) => {
    await reports.selectPeriod(id, closureId);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#r-statement`);
    requestAnimationFrame(() => document.getElementById("r-statement")?.scrollIntoView());
  };
  if (accessError) return <p role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">{accessError}</p>;
  if (!context) return <ReportsSkeleton label="Loading Reports" />;
  return <section aria-label="Bank reconciliation Reports" className="space-y-6" aria-busy={loading}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Reports</h1><p className="mt-2 text-sm text-muted-foreground">Review the reconciliation statement, outstanding items, and adjusting entries.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!data || loading || exporting} onClick={reports.refresh}>Refresh data</Button></div></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><PeriodHistoryChoice period={period} disabled={loading || exporting} onSelect={reports.selectPeriod} /><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!data || loading || exporting} onClick={() => void exports.run("xlsx")}>{exports.busy === "xlsx" ? "Generating Excel…" : "Export to Excel"}</Button><Button type="button" variant="outline" disabled={!data || loading || exporting} onClick={() => void exports.run("pdf")}>{exports.busy === "pdf" ? "Generating PDF…" : "Download PDF"}</Button></div></div>
    {fileFeedback && exports.error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{exports.error}</p>}{fileFeedback && exports.message && <p role="status" className="text-sm text-muted-foreground">{exports.message}</p>}
    <Dialog open={Boolean(exports.manual)} onOpenChange={open => { if (!open) exports.dismiss(); }}><DialogContent className="max-w-3xl" onCloseAutoFocus={event => { event.preventDefault(); if (exports.action && !fileFeedback) document.getElementById(`copy-report-${exports.action}`)?.focus({ preventScroll: true }); }}><DialogHeader><DialogTitle>Copy report text</DialogTitle><DialogDescription>Your browser blocked automatic copying. Select the text below and use Ctrl+C or your device’s copy command.</DialogDescription></DialogHeader><Textarea aria-label="Report text to copy" readOnly value={exports.manual} className="h-80 font-mono text-xs" onFocus={event => event.currentTarget.select()} /><Button type="button" variant="outline" onClick={() => exports.dismiss()}>Close</Button></DialogContent></Dialog>
    {reports.error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/40 p-3 text-sm text-destructive"><span>{reports.error}</span><Button type="button" variant="outline" disabled={loading} onClick={reports.refresh}>Retry reports</Button></div>}
    {loading ? <ReportsSkeleton label="Loading financial reports" /> : !data ? <p className="rounded-lg border p-6 text-sm text-muted-foreground">Choose a saved reconciliation period to view its reports.</p> : <>
      <nav aria-label="Jump to report" className="flex flex-wrap gap-2 text-sm">{[["r-statement", "Reconciliation statement"], ["r-aging", "Outstanding items aging"], ["r-journal", "Adjusting entries journal"], ["r-audit", "Audit trail"], ["r-closed", "Closed periods"]].map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-md border px-3 py-2 hover:bg-muted">{label}</a>)}</nav>
      <section aria-label="Report period" className="min-w-0 space-y-1 text-sm">
        <p className="break-words"><span className="text-muted-foreground">Entity: </span><span className="font-medium">{data.entity?.name || "Entity not set"}</span></p>
        <div className="flex min-w-0 items-baseline gap-1 text-muted-foreground"><span className="shrink-0">Bank account:</span><BankAccountLabel bank={data.period.bank} /></div>
        <p className="flex flex-wrap gap-x-3 text-muted-foreground"><span>Currency: {data.period.currency}</span><span>{data.period.periodEnd ? `Period ended ${data.period.periodEnd}` : "Period end not set"}</span><span>Status: {data.period.status === "CLOSED" ? "Closed" : "Open"}</span></p>
        {data.period.status === "CLOSED" && <p className="break-words">Closed snapshot · revision {data.period.lifecycle?.revision ?? "unavailable"}{data.period.lifecycle?.closedBy ? ` · ${data.period.lifecycle.closedBy.name}` : ""}{data.period.lifecycle?.closedAt ? ` · ${exportTime(data.period.lifecycle.closedAt)}` : ""}. Financial data is preserved as of closure.</p>}
        {[...data.period.ledgerBlockers, data.period.setupWarning, data.journal.postingDate.message].filter(Boolean).map(issue => <p key={issue} className="text-amber-700 dark:text-amber-400">{issue}</p>)}{data.period.statementCheck?.state === "WARNING" && <p className="text-amber-700 dark:text-amber-400">{data.period.statementCheck.message}</p>}
      </section>
      <section id="r-statement" aria-labelledby="statement-title" className="scroll-mt-4 space-y-4 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="statement-title" className="text-lg font-semibold">Reconciliation statement</h2><div className="flex flex-wrap items-center gap-2">{copy("statement", "Reconciliation statement")}<span className={`rounded-full px-3 py-1 text-sm ${data.reconciliation.status === "RECONCILED" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"}`}>{data.reconciliation.statusLabel}</span></div></div>
        <div className="grid gap-4 xl:grid-cols-2">{data.statement.map(side => <section key={side.part} aria-label={side.title} className="min-w-0 rounded-lg border"><div className="border-b p-3"><p className="text-xs text-muted-foreground">{side.part}</p><h3 className="font-semibold">{side.title}</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[500px] text-sm"><thead className="sr-only"><tr><th>Reference</th><th>Description</th><th>Item amount</th><th>Total</th></tr></thead><tbody>
          <tr className="border-b font-medium"><td colSpan={3} className="p-3">{side.openingLabel}</td><td className="whitespace-nowrap p-3 text-right tabular-nums">{money(side.openingBalance)}</td></tr>
          {side.groups.map(group => <Fragment key={group.label}><tr className="bg-muted/40 font-medium"><td colSpan={3} className="p-3">{group.label}</td><td className="whitespace-nowrap p-3 text-right tabular-nums">{money(group.total)}</td></tr>{group.items.length ? group.items.map((item, index) => <tr key={index} className="align-top"><td className="max-w-40 break-words p-3">{item.reference}</td><td className="min-w-36 break-words p-3">{item.description}</td><td className="whitespace-nowrap p-3 text-right tabular-nums">{money(item.amount)}</td><td /></tr>) : <tr><td /><td className="p-3 text-muted-foreground">None</td><td colSpan={2} /></tr>}</Fragment>)}
        </tbody><tfoot><tr className="border-t font-semibold"><td colSpan={3} className="p-3">{side.adjustedLabel}</td><td className="whitespace-nowrap p-3 text-right tabular-nums">{money(side.adjustedBalance)}</td></tr></tfoot></table></div></section>)}</div>
        <div className="flex flex-wrap justify-between gap-3 rounded-md bg-muted/40 p-3 text-sm"><p>Difference: <strong aria-label="Report difference">{money(data.reconciliation.difference)}</strong></p><p>{data.reconciliation.unpostedCount} adjustments to post</p></div>
      </section>
      <section id="r-aging" aria-labelledby="aging-title" className="scroll-mt-4 space-y-4 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="aging-title" className="text-lg font-semibold">Outstanding items aging</h2>{copy("aging", "Outstanding items aging")}</div><p className="text-sm text-muted-foreground">Open ledger items as of {data.period.periodEnd || "period end"}. {data.aging.count} items, net {money(data.aging.net)}. Follow up items past 90 days; review stale checks before deciding on reversal.</p>
        {!data.aging.available && <p className="text-sm text-amber-700 dark:text-amber-400">Set the period end in Reconcile to calculate aging and stale-check flags.</p>}
        <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">Type</th><th className="p-2">Date</th><th className="p-2">Ref</th><th className="p-2">Description</th><th className="p-2 text-right">Days</th>{data.aging.buckets.map(bucket => <th key={bucket} className="p-2 text-right">{bucket}</th>)}</tr></thead><tbody>{data.aging.items.length ? data.aging.items.map(item => <tr key={item.id} className="border-b align-top"><td className="p-2">{item.type}{item.stale && <span className="mt-1 block text-xs font-medium text-amber-700 dark:text-amber-400">Stale, over 6 months</span>}</td><td className="whitespace-nowrap p-2">{item.date}</td><td className="max-w-40 break-words p-2">{item.reference}</td><td className="min-w-48 max-w-80 break-words p-2">{item.description}</td><td className="p-2 text-right tabular-nums">{item.days ?? "Unavailable"}</td>{data.aging.buckets.map((bucket, index) => <td key={bucket} className="whitespace-nowrap p-2 text-right tabular-nums">{item.bucket === index ? money(item.amount) : ""}</td>)}</tr>) : <tr><td colSpan={9} className="p-4 text-muted-foreground">No outstanding items.</td></tr>}</tbody><tfoot><tr className="border-t font-semibold"><td colSpan={5} className="p-2">Total</td>{data.aging.totals.map((total, index) => <td key={index} className="whitespace-nowrap p-2 text-right tabular-nums">{money(total)}</td>)}</tr></tfoot></table></div>
      </section>
      <section id="r-journal" aria-labelledby="journal-title" className="scroll-mt-4 space-y-4 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="journal-title" className="text-lg font-semibold">Adjusting entries journal</h2>{copy("journal", "Adjusting entries journal")}</div><p className="text-sm text-muted-foreground">{data.journal.entries.length} entries. Ledger after posting {money(data.journal.summary.ledgerAfter)}. Confirmed net cash effect {money(data.journal.summary.postedCashEffect)}. Still to post {money(data.journal.summary.stillToPost)}.</p>
        <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead><tr className="border-b text-left"><th className="p-2">JE #</th><th className="p-2">Date</th><th className="p-2">Account</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th className="p-2">Explanation / source</th><th className="p-2">Status</th></tr></thead><tbody>{data.journal.entries.length ? data.journal.entries.map(entry => <Fragment key={entry.key}>{entry.lines.map((line, index) => <tr key={index} className={`align-top ${index === entry.lines.length - 1 ? "border-b" : ""}`}>
          {index === 0 && <><td rowSpan={entry.lines.length} className="whitespace-nowrap p-2">{entry.workbenchNumber || entry.journalNumber || "Draft"}{entry.workbenchNumber && entry.journalNumber && <p className="mt-1 text-xs text-muted-foreground">GL: {entry.journalNumber}</p>}</td><td rowSpan={entry.lines.length} className="whitespace-nowrap p-2">{entry.date || "Not set"}</td></>}
          <td className="min-w-44 max-w-72 break-words p-2">{line.account ? `${line.account.code} · ${line.account.name}` : <span className="text-destructive">No account</span>}</td><td className="whitespace-nowrap p-2 text-right tabular-nums">{line.debit === "0.00" ? "" : money(line.debit)}</td><td className="whitespace-nowrap p-2 text-right tabular-nums">{line.credit === "0.00" ? "" : money(line.credit)}</td>
          {index === 0 && <><td rowSpan={entry.lines.length} className="min-w-64 max-w-xl break-words p-2"><p>{entry.explanation}</p><p className="mt-1 text-xs text-muted-foreground">Source: {entry.sourceLabel}</p>{entry.importReference && <p className="mt-1 text-xs text-muted-foreground">Import reference: {entry.importReference}</p>}{entry.postedBy && <p className="mt-1 text-xs text-muted-foreground">Posted by {entry.postedBy}{entry.postedAt ? ` · ${exportTime(entry.postedAt)}` : ""}</p>}{entry.reversesNumber && <p className="mt-1 text-xs">Reverses {entry.reversesNumber}</p>}{entry.reversedByNumber && <p className="mt-1 text-xs">Reversed by {entry.reversedByNumber}</p>}{[entry.lastError, ...entry.issues].filter(Boolean).map(issue => <p key={issue} className="mt-1 text-xs text-destructive">{issue}</p>)}</td><td rowSpan={entry.lines.length} className="p-2">{postingStatus(entry)}</td></>}
        </tr>)}</Fragment>) : <tr><td colSpan={7} className="p-4 text-muted-foreground">No adjusting entries this period.</td></tr>}</tbody><tfoot><tr className="border-t font-semibold"><td colSpan={3} className="p-2">Totals</td><td className="whitespace-nowrap p-2 text-right tabular-nums">{money(data.journal.totals.debit)}</td><td className="whitespace-nowrap p-2 text-right tabular-nums">{money(data.journal.totals.credit)}</td><td colSpan={2} /></tr></tfoot></table></div>
        <p className="text-xs text-muted-foreground">{POSTING_TOTAL_NOTE}</p>
      </section>
    </>}
    {/* Keep full-period Audit filters and its boundary while a financial revision reloads. */}
    {historyPeriodId !== null && <div hidden={!data || loading}><AuditTrailReport key={historyPeriodId} periodId={historyPeriodId} copyButton={copy("audit", "Audit trail")} /></div>}
    {data && !loading && <ClosedPeriodsReport periodId={data.period.id} onView={viewRevision} copyButton={copy("closedPeriods", "Closed periods")} />}
  </section>;
}
