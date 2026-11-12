"use client";

import { Fragment, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BankAccountReference, BankReconciliationContext } from "./reference-types";
import { getBankReconciliationContext } from "./providers/bankReconciliationReferencesApi";
import { usePostingPeriod } from "./hooks/usePostingPeriod";
import { PostingJournalActions } from "./components/PostingJournalActions";
import type { PostingEntry } from "./posting-types";
import { ReferenceChoice } from "./components/ReferenceChoice";
import { transactionMoney } from "./utils/transactionDisplay";
import { PeriodHistoryChoice } from "./components/PeriodHistoryChoice";
import { PeriodLifecycle } from "./components/PeriodLifecycle";
import { JOURNAL_TOTALS_NOTE, postingStatus } from "./services/postingExport";
import { exportTime } from "./services/reconcileExport";
import { HistorySkeleton, PostingSkeleton, ProofSkeleton } from "./components/BankReconciliationSkeletons";

export default function BankReconciliationPostingModule() {
  const [context, setContext] = useState<BankReconciliationContext | null>(null), [accessError, setAccessError] = useState("");
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  useEffect(() => { const controller = new AbortController(); getBankReconciliationContext(controller.signal).then(value => { if (!value.workspaces.some(w => w.key === "posting")) throw new Error("Posting module access is required."); setContext(value); }).catch(e => { if (!controller.signal.aborted) setAccessError(e.message); }); return () => controller.abort(); }, []);
  const posting = usePostingPeriod(context !== null), { data, loading, saving } = posting;
  const journal = data || posting.retainedData;
  const period = data?.period, postingBusy = loading || saving || posting.operating || posting.exporting !== null, busy = postingBusy || lifecycleBusy;
  const controlsBusy = saving || posting.operating || posting.exporting !== null || lifecycleBusy || Boolean(posting.pendingRequest);
  const money = (value: string | null | undefined) => value == null ? loading ? "Loading…" : "Unavailable" : transactionMoney(value, period?.currency || posting.bank?.currency || "PHP");
  if (accessError) return <p role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">{accessError}</p>;
  if (!context) return <PostingSkeleton label="Loading Posting" />;
  const cards = [["ledgerBefore", "Ledger before adjustments"], ["postedCashEffect", "Confirmed net cash effect"], ["ledgerAfter", "Ledger after posting"], ["adjustedBookBalance", "Adjusted book balance"], ["stillToPost", "Still to post"]] as const;
  const ready = data?.entries.filter(entry => entry.canPost) || [];
  const actionsDisabled = !data || loading || saving || posting.operating || posting.exporting !== null || lifecycleBusy || Boolean(posting.pendingRequest);
  const dateActionsDisabled = actionsDisabled || posting.dateBlocked;
  return <section aria-label="Bank reconciliation Posting" className="space-y-6" aria-busy={busy} onPointerDownCapture={e => {
    // Keep a date-action click intact: its handler saves the date before acting.
    if (e.button === 0 && e.target instanceof Element && e.target.closest("button[data-posting-date-action]") && document.activeElement?.id === "posting-date") e.preventDefault();
  }}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Posting</h1><p className="mt-2 text-sm text-muted-foreground">Review the adjusting entries. Accounts are chosen in Reconcile and are read-only here.</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!posting.canRefresh || busy} onClick={posting.refresh}>Refresh data</Button></div></div>
    <div className="flex flex-wrap items-center justify-between gap-2"><PeriodHistoryChoice period={period} disabled={controlsBusy} onSelect={posting.selectPeriod} /><div className="flex flex-wrap gap-2"><Button type="button" data-posting-date-action variant="outline" disabled={dateActionsDisabled} onClick={() => { void posting.exportFile("xlsx"); }}>{posting.exporting === "xlsx" ? "Generating Excel…" : "Export to Excel"}</Button><Button type="button" data-posting-date-action variant="outline" disabled={dateActionsDisabled} onClick={() => { void posting.exportFile("pdf"); }}>{posting.exporting === "pdf" ? "Generating PDF…" : "Download PDF"}</Button></div></div>
    {journal && <PeriodLifecycle key={journal.period.id} period={journal.period} workspace="posting" eligibility={data?.closureEligibility} disabled={postingBusy || Boolean(posting.pendingRequest)} readUnavailable={!data} onBusy={setLifecycleBusy} onDone={posting.selectPeriod} before={posting.prepareLifecycle} />}
    <section aria-label="Posting period" className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
      <ReferenceChoice label="Bank account" resource="bank-accounts" selected={posting.bank} disabled={controlsBusy} onSelect={item => { void posting.selectBank(item as BankAccountReference); }} />
      <div className="min-w-0"><p className="text-xs text-muted-foreground">Entity</p><p className="mt-2 break-words text-sm">{data?.entity?.name || (loading ? "Loading…" : posting.loadError ? "Unavailable" : "Entity not set")}</p></div>
      <div><p className="text-xs text-muted-foreground">Period ended</p><p className="mt-2 text-sm">{period?.periodEnd || (loading ? "Loading…" : posting.loadError ? "Unavailable" : "Not set")}</p></div><div><p className="text-xs text-muted-foreground">Currency / status</p><p className="mt-2 text-sm">{period ? `${period.currency} · ${period.status === "CLOSED" ? "Closed" : "Open"}` : posting.bank?.currency || (loading ? "Loading…" : posting.loadError ? "Unavailable" : "Select a bank account")}</p></div>
    </section>
    {posting.error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{posting.error}</p>}
    {posting.loadError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/40 p-3 text-sm text-destructive"><span>{posting.loadError}</span>{posting.canRefresh && <Button type="button" variant="outline" disabled={busy} onClick={posting.retry}>Retry loading Posting</Button>}</div>}
    {posting.pendingRequest && <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 p-3 text-sm"><span>Request {posting.pendingRequest.command.requestId}: confirm its outcome before starting another operation.</span><Button type="button" variant="outline" disabled={busy} onClick={() => { void posting.recover(false); }}>Check request</Button><Button type="button" variant="outline" disabled={busy} onClick={() => { void posting.recover(true); }}>Retry same request</Button></div>}
    {posting.message && <p aria-live="polite" className="text-sm text-muted-foreground">{posting.message}</p>}
    {period && <div className="space-y-1 text-sm text-amber-700 dark:text-amber-400">{[...period.ledgerBlockers, period.setupWarning].filter(Boolean).map(issue => <p key={issue}>{issue}</p>)}</div>}
    {!data && loading ? <ProofSkeleton label="Loading Posting summary" count={5} /> : <section aria-label="Posting summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(([key, label]) => <div key={key} className="min-w-0 rounded-lg border bg-card p-4"><p className="text-xs text-muted-foreground">{label}</p><p aria-label={label} className="mt-2 break-words text-lg font-semibold tabular-nums">{money(data?.summary[key])}</p></div>)}</section>}
    <section aria-label="Journal entries" className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start gap-6"><div className="max-w-lg space-y-2 text-sm"><label htmlFor="posting-date" className="block font-medium">Posting date</label><Input id="posting-date" type="date" aria-label="Posting date" aria-describedby="posting-date-feedback" value={posting.date} min={data?.postingDate.min || undefined} max={data?.postingDate.max || undefined} disabled={!period?.periodEnd || period.status === "CLOSED" || actionsDisabled} aria-invalid={data ? posting.dateInvalid : undefined} onChange={e => posting.changeDate(e.target.value, e.target.validity.badInput)} onInput={e => { if (!e.currentTarget.value) posting.changeDate("", e.currentTarget.validity.badInput); }} onBlur={() => { void posting.saveDate(); }} />
        {data && !saving && posting.dateError ? <p id="posting-date-feedback" role="alert" className="text-xs text-destructive">{posting.dateError}</p> : <p id="posting-date-feedback" aria-live="polite" className="text-xs text-muted-foreground">{saving ? "Saving posting date…" : "Defaults to period end. Changes save when you leave the field."}</p>}
        {posting.canRetryDate && <Button type="button" size="sm" variant="outline" disabled={actionsDisabled} onClick={() => { void posting.saveDate(); }}>Retry saving date</Button>}
      </div><div className="space-y-2 text-sm"><p className="font-medium">Posted by (signed in)</p><p>{context.actor.name}</p></div></div>
      <div className="flex flex-wrap gap-2"><Button type="button" data-posting-date-action disabled={dateActionsDisabled || !ready.length} onClick={() => { void posting.run("post", { sourceKeys: ready.map(entry => entry.key) }); }}>{!data ? loading ? "Loading entries…" : "Posting unavailable" : period?.status === "CLOSED" ? "Period closed" : ready.length ? `Post all ready (${ready.length})` : "Nothing ready to post"}</Button><Button type="button" data-posting-date-action variant="outline" disabled={dateActionsDisabled || !ready.length} onClick={() => { void posting.run("prepare-export", { sourceKeys: ready.map(entry => entry.key) }); }}>Export ready for GL import</Button></div>
      {period?.status === "CLOSED" && <p className="text-sm text-muted-foreground">This period is closed. Entries and posting date are read-only.</p>}
      {!journal && loading && <HistorySkeleton label="Loading adjusting entries" columns={8} rows={4} />}
      {journal && journal.entries.length > 0 && <div hidden={!data} className="space-y-2"><div className="overflow-x-auto"><table aria-describedby="posting-totals-note" className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Status</th><th className="p-2">JE #</th><th className="p-2">Date</th><th className="p-2">Account</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th><th className="p-2">Explanation / source</th><th className="p-2">Actions</th></tr></thead><tbody>{journal.entries.map(entry => <Fragment key={entry.key}>{entry.lines.map((line, index) => <tr key={index} className={`align-top ${index === entry.lines.length - 1 ? "border-b" : ""}`}>
        {index === 0 && <><td rowSpan={entry.lines.length} className="p-2"><span className={`inline-block whitespace-nowrap rounded-full px-2 py-1 text-xs ${entry.status === "POSTED" ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : entry.status === "READY" ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-destructive/10 text-destructive"}`}>{statusLabel(entry)}</span></td><td rowSpan={entry.lines.length} className="whitespace-nowrap p-2">{entry.workbenchNumber || entry.journalNumber || "Draft"}{entry.workbenchNumber && entry.journalNumber && <small className="mt-1 block text-muted-foreground">GL: {entry.journalNumber}</small>}</td><td rowSpan={entry.lines.length} className="whitespace-nowrap p-2">{entry.date || "Not set"}</td></>}
        <td className="min-w-48 max-w-80 break-words p-2">{line.account ? `${line.account.code} · ${line.account.name}` : <span className="text-destructive">{line.role === "CASH" ? "Cash in Bank not configured" : "No account"}</span>}</td><td className="whitespace-nowrap p-2 text-right tabular-nums">{line.debit === "0.00" ? "" : money(line.debit)}</td><td className="whitespace-nowrap p-2 text-right tabular-nums">{line.credit === "0.00" ? "" : money(line.credit)}</td>
        {index === 0 && <td rowSpan={entry.lines.length} className="min-w-64 max-w-xl break-words p-2"><p>{entry.explanation}</p>{entry.importReference && <p className="mt-1 text-xs text-muted-foreground">Import reference: {entry.importReference}</p>}{entry.lastError && <p className="mt-1 text-xs text-destructive">{entry.lastError}</p>}{entry.stale && <p className="mt-1 text-xs text-destructive">The source changed. Withdraw this attempt before preparing the corrected journal.</p>}<p className="mt-1 text-xs text-muted-foreground">Source: {entry.sourceLabel}</p>{entry.issues.map(issue => <p key={issue} className="mt-1 text-xs text-destructive">{issue}</p>)}{entry.postedBy && <p className="mt-1 text-xs text-muted-foreground">Posted by {entry.postedBy}{entry.postedAt ? ` · ${exportTime(entry.postedAt)}` : ""}</p>}</td>}
        {index === 0 && <td rowSpan={entry.lines.length} className="min-w-40 p-2"><PostingJournalActions entry={entry} periodId={journal!.period.id} disabled={actionsDisabled} dateDisabled={posting.dateBlocked} hidden={!data} run={posting.run} /></td>}
      </tr>)}</Fragment>)}</tbody><tfoot><tr className="border-t font-semibold"><th scope="row" colSpan={4} className="p-2 text-left">Totals of all displayed lines</th><td className="whitespace-nowrap p-2 text-right tabular-nums">{money(journal.totals.debit)}</td><td className="whitespace-nowrap p-2 text-right tabular-nums">{money(journal.totals.credit)}</td><td colSpan={2} /></tr></tfoot></table></div><p id="posting-totals-note" className="text-xs text-muted-foreground">{JOURNAL_TOTALS_NOTE}</p></div>}{!loading && (!data || !data.entries.length) && <p className="py-5 text-sm text-muted-foreground">{posting.loadError ? "Posting data unavailable. Retry loading Posting above." : posting.loadStatus === "empty" ? "No saved reconciliation exists for this bank. Prepare one in Reconcile first." : !posting.bank ? "Select a bank account to review its saved reconciliation." : !data ? "Prepare a reconciliation in Reconcile first." : "No adjusting entries. Every bank line is matched or marked as a bank error."}</p>}
    </section>
  </section>;
}

function statusLabel(entry: PostingEntry) {
  return postingStatus(entry);
}
