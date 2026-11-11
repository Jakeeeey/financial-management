"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReconciliationPeriod } from "../setup-types";
import { IMPORT_LAYOUTS, type ImportReport, type TransactionData, type TransactionFilter, type TransactionPane, type TransactionResult, type TransactionLine, type TransactionSide } from "../transaction-types";
import { deleteTransaction, downloadTransactionTemplate, getTransactions, importTransactions } from "../providers/bankReconciliationTransactionsApi";
import { refreshSetupLedger } from "../providers/bankReconciliationSetupApi";
import { autoMatchTransactions, matchTransactions, undoTransactionMatches } from "../providers/bankReconciliationTransactionsApi";
import { LineTreatment, MatchSelection, ReconciliationProof, type Selection } from "./MatchingControls";
import { highlightedText, transactionMoney } from "../utils/transactionDisplay";
import { bankReconciliationRequestId } from "../utils/request-id";
import type { useReconcileDrafts } from "../hooks/useReconcileDrafts";
import { entryDirty } from "../utils/reconcileDrafts";

type Drafts = ReturnType<typeof useReconcileDrafts>;
type Run = <T extends { period: ReconciliationPeriod }>(command: (period: ReconciliationPeriod) => Promise<T>) => Promise<T>;
function Highlight({ value, query }: { value: string; query: string }) {
  return <>{highlightedText(value, query).map((part, i) => part.marked ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>)}</>;
}
function ImportResult({ report }: { report: ImportReport }) {
  const [page, setPage] = useState(1);
  return <div className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm" role="status">
    <p><strong>{report.imported} imported</strong> · {report.invalid} invalid · {report.duplicates} duplicates — {report.fileName}</p>
    {report.issues.length > 0 && <details><summary className="cursor-pointer">View skipped rows ({report.issues.length})</summary><ul className="my-2 max-h-64 space-y-1 overflow-y-auto">{report.issues.slice((page - 1) * 25, page * 25).map(issue => <li key={issue.row}>Row {issue.row}: {issue.kind === "DUPLICATE" ? "Duplicate. " : ""}{issue.message}</li>)}</ul><div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous issues</Button><span>Page {page} of {Math.ceil(report.issues.length / 25)}</span><Button type="button" size="sm" variant="outline" disabled={page * 25 >= report.issues.length} onClick={() => setPage(p => p + 1)}>Next issues</Button></div></details>}
    {report.imported === 0 && report.issues.length === 0 && <p>The sheet has no transactions under its header row.</p>}
  </div>;
}
type PaneProps = {
  side: TransactionSide; data?: TransactionPane; period: ReconciliationPeriod | null; query: string; busy: boolean;
  selected: TransactionLine[]; onToggle: (line: TransactionLine) => void;
  drafts: Drafts; onSubmit: (side: TransactionSide) => Promise<void>;
  onPage: (page: number) => void; command: (operation: (p: ReconciliationPeriod) => Promise<TransactionResult>) => Promise<TransactionResult>;
};
function Pane({ side, data, period, query, busy, onPage, command, selected, onToggle, drafts, onSubmit }: PaneProps) {
  const bank = side === "BANK", title = bank ? "Bank statement" : "Books: Cash in Bank ledger", prefix = bank ? "Bank" : "Ledger";
  const fileInput = useRef<HTMLInputElement>(null), upload = useRef<{ file: File; requestId: string } | null>(null);
  const entry = drafts.entries[side], adding = entry.open, draft = entry.fields;
  const [error, setError] = useState(""), [report, setReport] = useState<ImportReport | null>(null), [retry, setRetry] = useState(false);
  const locked = !period || period.status === "CLOSED" || busy;
  async function template() {
    setError("");
    try {
      const blob = await downloadTransactionTemplate(side), url = URL.createObjectURL(blob), anchor = document.createElement("a");
      anchor.href = url; anchor.download = IMPORT_LAYOUTS[side].filename; document.body.append(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to download the template."); }
  }
  async function submit() {
    setError("");
    try { await onSubmit(side); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to add the line."); }
  }
  async function importFile() {
    const job = upload.current; if (!job) return;
    setError(""); setReport(null); setRetry(false);
    try { const result = await command(p => importTransactions(p, side, job.file, job.requestId)); setReport(result.report!); }
    catch (e) { setError(e instanceof Error ? e.message : "The import result is unavailable. Retry this upload safely."); setRetry(true); }
  }
  async function remove(id: number) {
    setError("");
    try { await command(p => deleteTransaction(p, side, id)); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to delete the line."); }
  }
  return <section aria-label={`${prefix} transactions`} className="min-w-0 space-y-3 rounded-lg border bg-card p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">{title}</h2>{data && <p className="mt-1 text-xs text-muted-foreground">Showing {data.filtered} of {data.total} · {data.total} lines · {data.matched} matched · {data.open} open · {transactionMoney(data.net, period?.currency || "PHP")} net</p>}</div>
      <div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => drafts.openEntry(side, !adding)}>{adding ? "Close entry" : "Add line"}</Button><Button type="button" size="sm" variant="outline" onClick={() => { void template(); }}>Template</Button><Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => fileInput.current?.click()}>Import Excel</Button><input ref={fileInput} aria-label={`${prefix} Excel file`} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={locked} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) { upload.current = { file, requestId: bankReconciliationRequestId() }; void importFile(); } }} /></div>
    </div>
    {entryDirty(entry) && <div className="flex flex-wrap items-center justify-between gap-2 text-xs"><p>{prefix} entry not added{!adding ? " · Reopen Add line to continue editing" : ""}.</p><Button type="button" size="sm" variant="ghost" disabled={locked} aria-label={`Discard ${prefix.toLowerCase()} entry draft`} onClick={() => drafts.discardEntry(side)}>Discard draft</Button></div>}
    {entry.uncertain && <div className="space-y-2 rounded-md border border-amber-400 p-3 text-sm"><p>The earlier add result is unconfirmed. Review the refreshed saved lines before retrying, or discard this entry draft if it was already added.</p><Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => { setError(""); void drafts.reviewEntry(side).catch(e => setError(e.message)); }}>Review saved {prefix.toLowerCase()} lines</Button>{entry.reviewed && <Button type="button" variant="outline" size="sm" disabled={locked} onClick={() => drafts.allowRetry(side)}>I reviewed the saved lines; allow retry</Button>}</div>}
    {!bank && <><div className="flex flex-wrap items-center gap-3"><Button type="button" size="sm" variant="outline" disabled={locked || Boolean(period?.ledgerBlockers.length)} onClick={() => { setError(""); void command(async p => ({ period: await refreshSetupLedger(p) })).catch(e => setError(e.message)); }}>Refresh ledger</Button>{period?.ledgerAsOf && <span className="text-xs text-muted-foreground">Last refreshed: {period.ledgerAsOf.replace("T", " ")}</span>}</div>{period?.ledgerBalance == null && <p className="text-xs text-muted-foreground">Manual and imported lines can be entered here. Resolve the setup blockers to load posted GL transactions and the actual balance.</p>}</>}
    {adding && <form className="grid gap-3 rounded-md bg-muted/30 p-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); void submit(); }}>
      {([['date', 'Date'], ['reference', 'Reference'], ['description', 'Description'], ['amount', 'Amount (+ in / − out)']] as const).map(([field, label]) => <label key={field} className="space-y-1 text-xs"><span>{label}</span><Input aria-label={`${prefix} line ${field}`} type={field === "date" ? "date" : "text"} inputMode={field === "amount" ? "decimal" : undefined} maxLength={field === "reference" ? 255 : field === "description" ? 1000 : undefined} value={draft[field]} disabled={locked || entry.uncertain} onChange={e => drafts.changeEntry(side, { [field]: e.target.value })} /></label>)}
      <Button type="submit" size="sm" disabled={locked || entry.uncertain} className="justify-self-start">Add {bank ? "bank" : "ledger"} line</Button>
    </form>}
    {error && <div role="alert" className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm text-destructive"><p>{error}</p>{retry && <Button type="button" size="sm" variant="outline" disabled={locked} onClick={() => { void importFile(); }}>Retry this upload</Button>}</div>}
    {report && <ImportResult key={report.id} report={report} />}
    {data?.items.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2"><span className="sr-only">Select</span></th><th className="p-2">Date</th><th className="p-2">Reference</th><th className="p-2">Description</th><th className="p-2 text-right">Amount</th><th className="p-2"><span className="sr-only">Actions</span></th></tr></thead><tbody>{data.items.map(line => <Fragment key={line.id}><tr className="align-top"><td className="p-2"><input type="checkbox" aria-label={`Select ${prefix.toLowerCase()} line ${line.reference || line.id}`} checked={selected.some(item => item.id === line.id)} disabled={locked || !(line.canMatch ?? line.canDelete)} onChange={() => onToggle(line)} /></td><td className="min-w-28 whitespace-nowrap p-2"><Highlight value={line.date} query={query} /></td><td className="max-w-40 break-words p-2"><Highlight value={line.reference} query={query} /></td><td className="min-w-36 max-w-72 break-words p-2"><Highlight value={line.description} query={query} /></td><td className={`whitespace-nowrap p-2 text-right tabular-nums ${line.amount.startsWith("-") ? "" : "text-emerald-700 dark:text-emerald-400"}`}><Highlight value={transactionMoney(line.amount, period?.currency || "PHP")} query={query} /></td><td className="p-2">{line.canDelete && <Button type="button" size="sm" variant="ghost" aria-label={`Delete ${prefix.toLowerCase()} line ${line.reference || line.id}`} disabled={locked} onClick={() => { void remove(line.id); }}>Delete</Button>}</td></tr><tr className="border-b"><td colSpan={6} className="px-2 pb-3 pt-1 text-xs"><Highlight value={line.status} query={query} />{line.offsetAccount && <p className="mt-1 text-muted-foreground"><Highlight value={line.offsetAccount} query={query} /></p>}{line.sourceKey && <p className="mt-1 text-muted-foreground">Loaded from GL</p>}{period && <LineTreatment line={line} side={side} period={period} busy={busy} command={command} onError={setError} />}</td></tr></Fragment>)}</tbody></table></div> : <p className="py-5 text-sm text-muted-foreground">{!period ? "Select a bank account to begin." : query ? "No lines match this search." : data?.total ? "No lines in this view." : bank ? "Add or import the lines from your bank statement." : "Add, import, or load ledger lines for this period."}</p>}
    {data && data.filtered > 0 && <div className="flex items-center justify-end gap-2 text-xs"><Button type="button" size="sm" variant="outline" disabled={data.page === 1} onClick={() => onPage(data.page - 1)}>Previous</Button><span>Page {data.page} of {Math.max(1, Math.ceil(data.filtered / data.pageSize))}</span><Button type="button" size="sm" variant="outline" disabled={data.page * data.pageSize >= data.filtered} onClick={() => onPage(data.page + 1)}>Next</Button></div>}
  </section>;
}

export function TransactionWorkbench({ period, run, busy, setBusy, drafts }: { period: ReconciliationPeriod | null; run: Run; busy: boolean; setBusy: (busy: boolean) => void; drafts: Drafts }) {
  const [filter, setFilter] = useState<TransactionFilter>("ALL"), [query, setQuery] = useState("");
  const [bankPage, setBankPage] = useState(1), [ledgerPage, setLedgerPage] = useState(1), [data, setData] = useState<TransactionData | null>(null), [error, setError] = useState(""), [loading, setLoading] = useState(false);
  const [selection, setSelection] = useState<Selection>({ BANK: [], LEDGER: [] }), [message, setMessage] = useState("");
  useEffect(() => { setSelection({ BANK: [], LEDGER: [] }); }, [period?.id, period?.version, period?.lifecycle?.closureId]);
  useEffect(() => { setMessage(""); }, [period?.id]);
  useEffect(() => {
    if (!period?.id) return;
    let active = true; setLoading(true);
    const timer = setTimeout(() => { getTransactions(period.id, filter, query, bankPage, ledgerPage, period.lifecycle?.closureId).then(result => { if (active) { setData(result); setError(""); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [period?.id, period?.version, period?.lifecycle?.closureId, filter, query, bankPage, ledgerPage]);
  const current = data?.period.id === period?.id && data?.period.lifecycle?.closureId === period?.lifecycle?.closureId ? data : null;
  async function command(operation: (p: ReconciliationPeriod) => Promise<TransactionResult>) {
    setBusy(true);
    try { const result = await run(operation); setBankPage(1); setLedgerPage(1); setSelection({ BANK: [], LEDGER: [] }); return result; }
    finally { setBusy(false); }
  }
  function toggle(side: TransactionSide, line: TransactionLine) {
    setSelection(previous => ({ ...previous, [side]: previous[side].some(item => item.id === line.id) ? previous[side].filter(item => item.id !== line.id) : [...previous[side], line] }));
  }
  async function submit(side: TransactionSide) { await drafts.submitEntry(side); setBankPage(1); setLedgerPage(1); }
  async function perform(operation: (p: ReconciliationPeriod) => Promise<TransactionResult>) {
    setError(""); setMessage("");
    try {
      const result = await command(operation);
      if (result.autoMatch) {
        const report = result.autoMatch;
        setMessage(`Matched ${report.groups} groups: ${report.passes.pass1} by reference, ${report.passes.pass2} by date, ${report.passes.bankToLedger + report.passes.ledgerToBank} grouped. ${report.ambiguousLines} ambiguous lines remain for review.${report.deferredLines ? ` Pass 3 reached its search limit; no groups from that pass were applied. Review ${report.deferredLines} deferred lines manually.` : ""}`);
      } else if (result.undone !== undefined) setMessage(`${result.undone} matches undone; ${result.locked || 0} posted matches kept.`);
      else if (result.matches?.length) setMessage(`Matched ${result.matches.map(match => match.label).join(", ")}.`);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update matches."); }
  }
  return <section aria-label="Reconciliation transactions" className="space-y-4" aria-busy={loading}>
    <ReconciliationProof summary={current?.reconciliation} currency={period?.currency || "PHP"} />
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{([['ALL', 'All', current?.counts.all], ['TO_REVIEW', 'To review', current?.counts.toReview], ['MATCHED', 'Matched', current?.counts.matched]] as const).map(([value, label, count]) => <Button key={value} type="button" size="sm" variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} onClick={() => { setFilter(value); setBankPage(1); setLedgerPage(1); }}>{label} ({count ?? 0})</Button>)}</div><Input aria-label="Search transactions" placeholder="Date, reference, description, status or amount…" className="w-full sm:max-w-md" maxLength={200} value={query} onChange={e => { setQuery(e.target.value); setBankPage(1); setLedgerPage(1); }} /></div>
    <div className="flex flex-wrap gap-2"><Button type="button" disabled={!period || period.status === "CLOSED" || busy} onClick={() => { void perform(autoMatchTransactions); }}>Auto-match</Button><Button type="button" variant="outline" disabled={!period || period.status === "CLOSED" || busy || !current?.counts.matched} onClick={() => { void perform(undoTransactionMatches); }}>Undo unposted matches</Button></div>
    {message && <p className="rounded-md border bg-muted/20 p-3 text-sm" aria-live="polite">{message}</p>}
    {period?.status === "CLOSED" && <p className="text-sm text-muted-foreground">This period is closed. Transactions are read-only.</p>}
    {error && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}
    <div className="grid gap-4 xl:grid-cols-2"><Pane key={`bank-${period?.id || 0}`} side="BANK" data={current?.bank} period={period} query={query} busy={busy} onPage={setBankPage} command={command} selected={selection.BANK} onToggle={line => toggle("BANK", line)} drafts={drafts} onSubmit={submit} /><Pane key={`ledger-${period?.id || 0}`} side="LEDGER" data={current?.ledger} period={period} query={query} busy={busy} onPage={setLedgerPage} command={command} selected={selection.LEDGER} onToggle={line => toggle("LEDGER", line)} drafts={drafts} onSubmit={submit} /></div>
    {period && selection.BANK.length + selection.LEDGER.length > 0 && <MatchSelection key={`${selection.BANK.map(line => line.id).join(",")}|${selection.LEDGER.map(line => line.id).join(",")}`} selected={selection} period={period} busy={busy} onClear={() => setSelection({ BANK: [], LEDGER: [] })} onMatch={(kind, account) => { void perform(p => matchTransactions(p, selection.BANK.map(line => line.id), selection.LEDGER.map(line => line.id), kind, account)); }} />}
  </section>;
}
