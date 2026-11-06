"use client";
import { useCallback, useDeferredValue, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorBox, OnboardingFeedback } from "./components/OnboardingCommon";
import { ReplenishmentApprover } from "./components/ReplenishmentApprover";
import { ReplenishmentJournal } from "./components/ReplenishmentJournal";
import { ReplenishmentStatus } from "./components/ReplenishmentStatus";
import { useReplenishmentCommand, useReplenishmentRead } from "./hooks/useReplenishment";
import { replenishmentApi, REPLENISHMENT_API } from "./providers/replenishment.api";
import { onboardingFieldError } from "./utils/onboardingFeedback";
import { onboardingRequestId, OnboardingError } from "./providers/onboarding.api";
import { voucherMoney, voucherCents } from "./utils/voucherMoney";
import { voucherFileError } from "./utils/voucherFiles";
import type { Choice, Page } from "./onboarding-types";
import type { AccrualPreview, PettyCashAccrual, ReplenishmentFund, ReplenishmentPreview, ReplenishmentRequest } from "./replenishment-types";

const section = "rounded-xl border bg-card p-4 md:p-5 space-y-4";
const th = "px-3 py-2 text-left text-sm font-medium whitespace-nowrap";
const td = "px-3 py-2 text-sm align-top";
const AMOUNT = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const amountFromCents = (cents: bigint) => `${cents < 0n ? "-" : ""}${(cents < 0n ? -cents : cents) / 100n}.${String((cents < 0n ? -cents : cents) % 100n).padStart(2, "0")}`;

function Panel({ title, children, description }: { title: string; children: ReactNode; description?: string }) {
  return <section className={section}><div><h2 className="font-semibold">{title}</h2>{description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}</div>{children}</section>;
}
function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className="rounded-lg border bg-muted/20 p-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p><p className={`mt-1 ${strong ? "text-lg font-semibold" : "font-medium"}`}>{value}</p></div>;
}
function BlockerList({ items, title = "Resolve these items before continuing" }: { items: string[]; title?: string }) {
  if (!items.length) return null;
  return <OnboardingFeedback tone="warning" title={title}><ul className="list-inside list-disc space-y-1">{items.map(message => <li key={message}>{message}</li>)}</ul></OnboardingFeedback>;
}
type DraftState = { record: ReplenishmentRequest | null; pending: ReplenishmentRequest | null; last: ReplenishmentRequest | null };

export default function PettyCashReplenishmentModule() {
  const funds = useReplenishmentRead<ReplenishmentFund[]>("funds"), [selected, setSelected] = useState<number | null>(null), [revision, setRevision] = useState(0);
  const fund = funds.data?.find(item => item.id === selected) || funds.data?.[0];
  const changed = () => { setRevision(value => value + 1); funds.refresh(); };
  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Replenishment</h1><p className="mt-2 text-sm text-muted-foreground">Count the cash, match it to the vouchers and submit to a named approver. The entry posts and the fund is replenished only when that person approves.</p></div>
    <ErrorBox error={funds.error} retry={funds.refresh} title="Unable to load petty cash funds" />{funds.loading && <p role="status">Loading funds...</p>}
    {fund && <><div className="max-w-xl space-y-2"><label htmlFor="replenishment-fund" className="text-sm font-medium">Fund</label><select id="replenishment-fund" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={fund.id} onChange={event => { setSelected(Number(event.target.value)); }}>{funds.data?.map(item => <option key={item.id} value={item.id}>{item.docNo} - {item.name}</option>)}</select></div><FundWorkspace key={`${fund.id}:${revision}`} fund={fund} changed={changed} /></>}
    {!funds.loading && !funds.error && !fund && <p className={section}>No Active funds are available. Approve and fund a request in Onboarding Approval first.</p>}
    <ReplenishmentHistory key={revision} />
  </div>;
}
function FundWorkspace({ fund, changed }: { fund: ReplenishmentFund; changed: () => void }) {
  const read = useReplenishmentRead<DraftState>(`funds/${fund.id}/draft`);
  return <><ErrorBox error={read.error} retry={read.refresh} title="Unable to load this fund's reconciliation" />{read.loading && <p role="status">Loading reconciliation...</p>}{read.data && <ReplenishmentEditor fund={fund} initial={read.data} changed={changed} reload={changed} />}</>;
}
function ReplenishmentEditor({ fund, initial, changed, reload }: { fund: ReplenishmentFund; initial: DraftState; changed: () => void; reload: () => void }) {
  const [draft, setDraft] = useState(initial.record), [count, setCount] = useState(initial.record?.countedCash ?? fund.expectedCash), [approver, setApprover] = useState<Choice | null>(initial.record?.approverId ? { id: initial.record.approverId, code: String(initial.record.approverId), name: initial.record.approver, status: "ACTIVE", classification: "", eligible: true, reason: null, details: {} } : null), [confirming, setConfirming] = useState(false);
  const fingerprint = JSON.stringify([count, approver?.id ?? null]);
  const [savedInputs, setSavedInputs] = useState(fingerprint), [fileBusy, setFileBusy] = useState(false), [fileError, setFileError] = useState<Error | null>(null);
  const failedUpload = useRef<{ file: File; requestId: string; version: number; id: number } | null>(null), fileInput = useRef<HTMLInputElement>(null);
  const command = useReplenishmentCommand(), preview = useReplenishmentRead<ReplenishmentPreview>(`funds/${fund.id}/preview?${new URLSearchParams({ countedCash: count })}`, 300);
  const { run } = command, busy = command.busy || fileBusy, dirty = savedInputs !== fingerprint, countValid = count === "" || AMOUNT.test(count);
  const countError = !countValid ? "Enter a nonnegative cash amount with at most two decimal places." : onboardingFieldError(command.error, "countedCash");
  const approverError = onboardingFieldError(command.error, "approverId");
  const imprest = voucherCents(fund.imprest), expected = voucherCents(fund.expectedCash), open = imprest - expected;
  const save = useCallback(async () => {
    if (!countValid || count !== "" && !AMOUNT.test(count)) return null;
    if (draft && savedInputs === fingerprint) return draft;
    const result = await run<ReplenishmentRequest>(`funds/${fund.id}/draft`, "PUT", { version: draft?.version ?? 0, countedCash: count === "" ? null : count, approverId: approver?.id ?? null });
    if (result) { setDraft(result); setSavedInputs(fingerprint); } return result;
  }, [draft, savedInputs, fingerprint, run, fund.id, count, countValid, approver?.id]);
  useEffect(() => {
    if (!dirty || busy || command.error || initial.pending || !countValid) return;
    const timer = setTimeout(() => { void save(); }, 650); return () => clearTimeout(timer);
  }, [dirty, busy, command.error, initial.pending, count, countValid, save]);
  async function submit() {
    setConfirming(false);
    const current = await save(); if (!current || !preview.data) return;
    const result = await run<ReplenishmentRequest>(`requests/${current.id}/submit`, "POST", { version: current.version, previewToken: preview.data.token });
    if (result) { toast.success(`${result.docNo} submitted to ${result.approver}. Cash and the ledger are unchanged.`); changed(); }
  }
  async function upload(file: File, retry?: { requestId: string; version: number; id: number }, persisted?: ReplenishmentRequest) {
    const invalid = voucherFileError(file); if (invalid) { setFileError(new Error(invalid.message)); return; }
    let current = retry ? draft : persisted || await save(); if (!current) return;
    setFileBusy(true); setFileError(null);
    if (!retry) try { current = await replenishmentApi<ReplenishmentRequest>(`requests/${current.id}`); } catch (cause) { setFileError(cause instanceof Error ? cause : new Error("Unable to reload document status.")); setFileBusy(false); return; }
    const job = retry || { requestId: onboardingRequestId(), version: current.version, id: current.id }; failedUpload.current = { ...job, file };
    const form = new FormData(); form.set("file", file); form.set("requestId", job.requestId); form.set("version", String(job.version));
    try { await replenishmentApi(`requests/${job.id}/attachments`, { method: "POST", body: form }); failedUpload.current = null; }
    catch (cause) { setFileError(cause instanceof Error ? cause : new Error("File upload failed. Retry or remove the pending upload.")); }
    finally { try { setDraft(await replenishmentApi<ReplenishmentRequest>(`requests/${job.id}`)); } catch { setFileError(new Error("Unable to reload document status. Refresh before continuing.")); } setFileBusy(false); }
  }
  async function uploadFiles(files: File[]) {
    for (const file of files) { const invalid = voucherFileError(file); if (invalid) { setFileError(new Error(invalid.message)); return; } }
    const current = await save(); if (!current) return;
    for (const file of files) { await upload(file, undefined, current); if (failedUpload.current) break; }
  }
  async function remove(file: number) {
    if (!draft) return;
    const result = await command.run(`requests/${draft.id}/attachments/${file}/remove`, "POST", { version: draft.version });
    if (result) { try { setDraft(await replenishmentApi<ReplenishmentRequest>(`requests/${draft.id}`)); if (failedUpload.current) failedUpload.current = null; } catch (cause) { setFileError(cause instanceof Error ? cause : new Error("Refresh the document status.")); } }
  }
  const p = preview.data, canSubmit = !busy && !preview.loading && !preview.refreshing && !dirty && Boolean(p?.ready) && Boolean(approver) && !initial.pending && countValid && !draft?.attachments.some(file => file.state !== "READY" || !file.stored);
  return <div className="space-y-5"><Panel title="Reconciliation" description="Preparation does not move cash or post a journal.">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Summary label="Imprest amount" value={voucherMoney(fund.imprest)} /><Summary label="Open vouchers" value={voucherMoney(amountFromCents(open))} /><Summary label="Expected cash" value={voucherMoney(fund.expectedCash)} /><Summary label="Counted cash" value={count && AMOUNT.test(count) ? voucherMoney(count) : "Not entered"} strong /></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"><div className="space-y-2"><label htmlFor="replenishment-count" className="text-sm font-medium">Actual cash counted</label><Input id="replenishment-count" type="number" min="0" step="0.01" value={count} disabled={busy} aria-invalid={Boolean(countError)} aria-describedby={countError ? "replenishment-count-error" : undefined} onChange={event => { setCount(event.target.value); command.clearError(); }} />{countError && <p id="replenishment-count-error" className="text-xs font-medium text-destructive">{countError}</p>}</div><div className="space-y-2"><label htmlFor="replenishment-variance" className="text-sm font-medium">Cash over / (short)</label><Input id="replenishment-variance" readOnly value={p ? voucherMoney(p.variance) : ""} /></div><div className="space-y-2"><label htmlFor="replenishment-amount" className="text-sm font-medium">Amount to reimburse</label><Input id="replenishment-amount" readOnly value={p ? voucherMoney(p.reimbursement) : ""} /></div></div>
    <div className="max-w-xl"><ReplenishmentApprover selected={approver} disabled={busy || Boolean(initial.pending)} onSelect={choice => { setApprover(choice); command.clearError(); }} error={approverError} /></div>
    {initial.pending && <OnboardingFeedback tone="info" title="A replenishment is already awaiting approval">{initial.pending.docNo} is waiting for {initial.pending.approver}. Decide it in <Link className="underline" href="/fm/petty-cash/replenishment-approval">Replenishment Approval</Link> before preparing another request.</OnboardingFeedback>}
    {!initial.pending && initial.last?.state === "REJECTED" && <OnboardingFeedback tone="warning" title={`${initial.last.docNo} was rejected`}>{initial.last.decisionReason}. Correct the vouchers in Disbursement or attach the requested documents, then submit again.</OnboardingFeedback>}
    <div className="space-y-2"><p className="text-sm font-medium">Supporting documents</p><p className="text-xs text-muted-foreground">JPG, PNG, or PDF. Maximum 5 MB per file. Documents are optional.</p><input ref={fileInput} hidden type="file" multiple accept="image/jpeg,image/png,application/pdf" disabled={busy || Boolean(initial.pending)} onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ""; void uploadFiles(files); }} /><Button variant="outline" size="sm" disabled={busy || Boolean(initial.pending)} onClick={() => fileInput.current?.click()}>Attach documents</Button>
      {!draft?.attachments.length && <p className="text-sm text-muted-foreground">No documents attached.</p>}{draft?.attachments.map(file => <div key={file.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"><span className="min-w-0 flex-1 break-words">{file.filename} - {(file.fileSize / 1024).toFixed(0)} KB{file.state !== "READY" ? " - Upload incomplete" : ""}</span>{file.state === "READY" && <><a className="underline" target="_blank" rel="noreferrer" href={`${REPLENISHMENT_API}/requests/${draft.id}/attachments/${file.id}?view=preview`}>View</a><a className="underline" href={`${REPLENISHMENT_API}/requests/${draft.id}/attachments/${file.id}`}>Download</a></>}<Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove(file.id)}>Remove</Button></div>)}</div>
    <ErrorBox error={fileError} retry={failedUpload.current ? () => { const job = failedUpload.current; if (job) void upload(job.file, job); } : undefined} title="Document action failed" />
    <ErrorBox error={command.error} retry={command.error instanceof OnboardingError && command.error.status < 500 ? undefined : () => { void command.retry().then(result => { if (result) reload(); }); }} />
    <ErrorBox error={preview.error} retry={preview.refresh} title="Unable to update the replenishment preview" />
    {preview.refreshing && <p role="status" className="text-xs text-muted-foreground">Updating preview...</p>}
    <BlockerList items={p?.blockers ?? []} title="Resolve these items before submitting" />
    <div className="sticky bottom-3 z-10 flex flex-wrap gap-2 rounded-lg border bg-card/95 p-2 shadow-sm"><Button disabled={!canSubmit} onClick={() => setConfirming(true)}>Submit for approval</Button><Button variant="outline" asChild disabled={busy || !p?.vouchers.length}><a aria-disabled={busy || !p?.vouchers.length} target="_blank" rel="noreferrer" href={p?.vouchers.length && !busy ? `${REPLENISHMENT_API}/funds/${fund.id}/print?${new URLSearchParams({ countedCash: count })}` : undefined}>Print draft request</a></Button><Button variant="ghost" disabled={busy} onClick={reload}>Refresh data</Button></div>
    <p role="status" className="text-xs text-muted-foreground">{busy ? "Saving..." : dirty ? "Reconciliation changes pending save." : draft ? "Reconciliation draft saved." : "Preparation does not move cash or post a journal."}</p>
  </Panel><Panel title="Journal entry on approval">{p ? <ReplenishmentJournal lines={p.lines} /> : <p role="status">Loading journal preview...</p>}</Panel>
  <Panel title={`Vouchers included (${p?.vouchers.length ?? 0})`}><VoucherTable preview={p} /></Panel><AccrualSection fund={fund} changed={changed} />
  <Dialog open={confirming} onOpenChange={setConfirming}><DialogContent><DialogHeader><DialogTitle>Submit replenishment?</DialogTitle><DialogDescription>{p?.vouchers.length} voucher(s) will be locked for approval. Cash and the ledger remain unchanged until {approver?.name} approves.</DialogDescription></DialogHeader>{p && <div className="grid gap-3 sm:grid-cols-2"><Summary label="Cash counted" value={voucherMoney(p.countedCash)} /><Summary label="To reimburse" value={voucherMoney(p.reimbursement)} /><Summary label="Over / (short)" value={voucherMoney(p.variance)} /><Summary label="Named approver" value={approver?.name ?? ""} /></div>}<DialogFooter><Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button><Button disabled={busy} onClick={() => void submit()}>{busy ? "Submitting..." : "Submit for approval"}</Button></DialogFooter></DialogContent></Dialog></div>;
}
function VoucherTable({ preview }: { preview: ReplenishmentPreview | null }) {
  if (!preview?.vouchers.length) return <p className="text-sm text-muted-foreground">No open vouchers to replenish.</p>;
  const totals = ["gross", "inputVat", "ewt", "netCash"].map(key => preview.vouchers.reduce((sum, v) => sum + voucherCents(v[key as "gross"]), 0n));
  return <div className="overflow-x-auto rounded-lg border"><table className="w-full" aria-label="Vouchers included"><thead className="bg-muted/40"><tr>{["Voucher", "Date", "Payee", "Receipts", "Gross", "Input VAT", "EWT", "Cash paid"].map((label, i) => <th className={`${th} ${i > 3 ? "text-right" : ""}`} key={label}>{label}</th>)}</tr></thead><tbody>{preview.vouchers.map(v => <tr key={v.id} className="border-t"><td className={`${td} whitespace-nowrap`}>{v.docNo}</td><td className={`${td} whitespace-nowrap`}>{v.date}</td><td className={td}>{v.payee}</td><td className={td}>{v.receipts.join(", ")}</td>{[v.gross, v.inputVat, v.ewt, v.netCash].map((value, i) => <td className={`${td} text-right whitespace-nowrap`} key={i}>{voucherMoney(value)}</td>)}</tr>)}</tbody><tfoot className="border-t font-medium"><tr><td className={td} colSpan={4}>Total</td>{totals.map((value, i) => <td className={`${td} text-right whitespace-nowrap`} key={i}>{voucherMoney(`${value / 100n}.${String(value % 100n).padStart(2, "0")}`)}</td>)}</tr></tfoot></table></div>;
}
function AccrualSection({ fund, changed }: { fund: ReplenishmentFund; changed: () => void }) {
  const lastEnd = new Date(`${today()}T00:00:00Z`); lastEnd.setUTCDate(0);
  const [period, setPeriod] = useState(lastEnd.toISOString().slice(0, 10)), command = useReplenishmentCommand(), [confirming, setConfirming] = useState(false);
  const preview = useReplenishmentRead<AccrualPreview>(period ? `funds/${fund.id}/accruals/preview?${new URLSearchParams({ periodEnd: period })}` : null, 250), history = useReplenishmentRead<PettyCashAccrual[]>(`funds/${fund.id}/accruals`);
  const periodError = onboardingFieldError(preview.error, "periodEnd");
  const noVouchers = Boolean(preview.data && preview.data.vouchers.length === 0);
  async function post() { if (!preview.data?.ready) return; setConfirming(false); const result = await command.run<PettyCashAccrual>(`funds/${fund.id}/accruals`, "POST", { periodEnd: period, previewToken: preview.data.token }); if (result) { toast.success(`Accrual ${result.journal} and reversal ${result.reversal} posted for ${result.periodEnd} and ${result.reversalDate}. Cash is unchanged.`); changed(); } }
  return <Panel title="Period-end accrual" description="Vouchers still open at period end are expenses of that period. This books them against the fund on the period-end date and reverses the entry the next day. Each voucher can be accrued only once."><div className="grid max-w-xl gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="replenishment-period" className="text-sm font-medium">Period end</label><Input id="replenishment-period" type="date" max={today()} value={period} disabled={command.busy} aria-invalid={Boolean(periodError)} aria-describedby={periodError ? "replenishment-period-error" : undefined} onChange={event => setPeriod(event.target.value)} />{periodError && <p id="replenishment-period-error" className="text-xs font-medium text-destructive">{periodError}</p>}</div><div className="space-y-2"><label htmlFor="replenishment-to-accrue" className="text-sm font-medium">To accrue</label><Input id="replenishment-to-accrue" readOnly value={preview.data ? `${preview.data.vouchers.length} voucher(s) - ${voucherMoney(preview.data.amount)}` : ""} /></div></div>
    <ErrorBox error={preview.error} retry={preview.refresh} title="Unable to load the accrual preview" /><ErrorBox error={command.error} retry={() => void post()} />
    {noVouchers ? <OnboardingFeedback tone="info" title="Nothing to accrue">{preview.data?.blockers[0] ?? "No open vouchers are eligible for this period."}</OnboardingFeedback> : preview.data && <><BlockerList items={preview.data.blockers} title="Resolve these items before posting" /><ReplenishmentJournal lines={preview.data.lines} /></>}
    <Button variant="outline" disabled={command.busy || preview.loading || noVouchers || !preview.data?.ready} onClick={() => setConfirming(true)}>Post accrual and reversal</Button>
    <ErrorBox error={history.error} retry={history.refresh} title="Unable to load accrual history" />
    {!!history.data?.length && <div className="overflow-x-auto rounded-lg border"><table className="w-full" aria-label="Accrual history"><thead className="bg-muted/40"><tr>{["Accrual", "Period end", "Reversal", "Vouchers", "Amount"].map(label => <th key={label} className={th}>{label}</th>)}</tr></thead><tbody>{history.data.map(a => <tr key={a.id} className="border-t"><td className={td}>{a.journal}</td><td className={`${td} whitespace-nowrap`}>{a.periodEnd}</td><td className={td}>{a.reversal} on {a.reversalDate}</td><td className={td}>{a.vouchers.join(", ")}</td><td className={`${td} text-right whitespace-nowrap`}>{voucherMoney(a.amount)}</td></tr>)}</tbody></table></div>}
    <Dialog open={confirming} onOpenChange={setConfirming}><DialogContent><DialogHeader><DialogTitle>Post this accrual?</DialogTitle><DialogDescription>The accrual posts on {period} and reverses on {preview.data?.reversalDate}. Cash is unchanged. This cannot be posted again for the same vouchers.</DialogDescription></DialogHeader>{preview.data && <div className="grid gap-3 sm:grid-cols-2"><Summary label="Vouchers" value={String(preview.data.vouchers.length)} /><Summary label="Accrual amount" value={voucherMoney(preview.data.amount)} /><Summary label="Accrual date" value={preview.data.periodEnd} /><Summary label="Reversal date" value={preview.data.reversalDate} /></div>}<DialogFooter><Button variant="outline" onClick={() => setConfirming(false)}>Cancel</Button><Button disabled={command.busy} onClick={() => void post()}>{command.busy ? "Posting..." : "Post accrual and reversal"}</Button></DialogFooter></DialogContent></Dialog>
  </Panel>;
}
function ReplenishmentHistory() {
  const [page, setPage] = useState(1), [search, setSearch] = useState(""), [status, setStatus] = useState("ALL"), [from, setFrom] = useState(""), [to, setTo] = useState("");
  const deferred = useDeferredValue(search), query = new URLSearchParams({ page: String(page), pageSize: "25", status });
  if (deferred.trim()) query.set("search", deferred.trim());
  if (from) query.set("dateFrom", from);
  if (to) query.set("dateTo", to);
  const history = useReplenishmentRead<Page<ReplenishmentRequest>>(`requests?${query}`, 250), filters = Boolean(search.trim() || from || to || status !== "ALL");
  const update = (change: () => void) => { change(); setPage(1); };
  return <Panel title="Replenishment history"><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_minmax(9rem,1fr)_auto]"><div className="space-y-2"><label htmlFor="replenishment-history-search" className="text-sm font-medium">Search</label><Input id="replenishment-history-search" value={search} placeholder="Request no., fund, preparer or approver" onChange={event => update(() => setSearch(event.target.value))} /></div><div className="space-y-2"><label htmlFor="replenishment-history-status" className="text-sm font-medium">Status</label><select id="replenishment-history-status" className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={status} onChange={event => update(() => setStatus(event.target.value))}><option value="ALL">All statuses</option><option value="PENDING">Pending</option><option value="POSTED">Posted</option><option value="REJECTED">Rejected</option></select></div><div className="space-y-2"><label htmlFor="replenishment-history-from" className="text-sm font-medium">Submitted from</label><Input id="replenishment-history-from" type="date" value={from} max={to || undefined} onChange={event => update(() => setFrom(event.target.value))} /></div><div className="space-y-2"><label htmlFor="replenishment-history-to" className="text-sm font-medium">Submitted to</label><Input id="replenishment-history-to" type="date" value={to} min={from || undefined} onChange={event => update(() => setTo(event.target.value))} /></div><div className="flex items-end"><Button variant="outline" disabled={!filters} onClick={() => update(() => { setSearch(""); setStatus("ALL"); setFrom(""); setTo(""); })}>Clear filters</Button></div></div>
    <ErrorBox error={history.error} retry={history.refresh} title="Unable to load replenishment history" />{(history.loading || history.refreshing) && <p role="status" className="text-sm text-muted-foreground">{history.loading ? "Loading history..." : "Updating history..."}</p>}
    {history.data && <>{history.data.items.length ? <><div className="hidden overflow-x-auto rounded-lg border md:block"><table className="w-full" aria-label="Replenishment history"><thead className="bg-muted/40"><tr>{["No.", "Date", "Fund", "Prepared by", "Approver", "Status", "Docs", "Over/(short)", "Reimbursed", ""].map((label, i) => <th key={i} className={th}>{label}</th>)}</tr></thead><tbody>{history.data.items.map(r => <tr key={r.id} className="border-t"><td className={`${td} whitespace-nowrap`}>{r.docNo}</td><td className={`${td} whitespace-nowrap`}>{r.submittedAt.slice(0, 10)}</td><td className={`${td} whitespace-nowrap`}>{r.snapshot?.fund.docNo}</td><td className={td}>{r.preparedBy}</td><td className={td}>{r.approver}</td><td className={td}><ReplenishmentStatus state={r.state} />{r.decisionReason && <small className="mt-1 block max-w-56 whitespace-normal">{r.decisionReason}</small>}</td><td className={td}>{r.attachments.length || "-"}</td><td className={`${td} text-right whitespace-nowrap`}>{voucherMoney(r.snapshot?.variance || "0.00")}</td><td className={`${td} text-right whitespace-nowrap`}>{voucherMoney(r.snapshot?.reimbursement || "0.00")}</td><td className={td}><Button size="sm" variant="outline" asChild><a target="_blank" rel="noreferrer" href={`${REPLENISHMENT_API}/requests/${r.id}/print`}>Print</a></Button></td></tr>)}</tbody></table></div>
      <div className="space-y-3 md:hidden">{history.data.items.map(r => <article key={r.id} className="space-y-3 rounded-lg border p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{r.docNo}</p><p className="text-sm text-muted-foreground">{r.snapshot?.fund.docNo} - {r.snapshot?.fund.name}</p></div><ReplenishmentStatus state={r.state} /></div><dl className="grid grid-cols-2 gap-2 text-sm"><div><dt className="text-muted-foreground">Submitted</dt><dd>{r.submittedAt.slice(0, 10)}</dd></div><div><dt className="text-muted-foreground">Approver</dt><dd>{r.approver}</dd></div><div><dt className="text-muted-foreground">Over/(short)</dt><dd>{voucherMoney(r.snapshot?.variance || "0.00")}</dd></div><div><dt className="text-muted-foreground">Reimbursed</dt><dd>{voucherMoney(r.snapshot?.reimbursement || "0.00")}</dd></div></dl>{r.decisionReason && <p className="text-sm">{r.decisionReason}</p>}<div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{r.attachments.length} document(s)</p><Button size="sm" variant="outline" asChild><a target="_blank" rel="noreferrer" href={`${REPLENISHMENT_API}/requests/${r.id}/print`}>Print</a></Button></div></article>)}</div>
      <div className="flex flex-wrap items-center justify-end gap-2 text-sm"><span>{history.data.total} record(s) - Page {page}</span><Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous page</Button><Button size="sm" variant="outline" disabled={page * 25 >= history.data.total} onClick={() => setPage(value => value + 1)}>Next page</Button></div></> : <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">{filters ? "No replenishment requests match these filters." : "No replenishment requests have been submitted yet."}</p>}</>}
  </Panel>;
}
