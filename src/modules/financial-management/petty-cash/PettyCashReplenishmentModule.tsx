"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ReplenishmentApprover } from "./components/ReplenishmentApprover";
import { useReplenishmentCommand, useReplenishmentRead } from "./hooks/useReplenishment";
import { replenishmentApi, REPLENISHMENT_API } from "./providers/replenishment.api";
import { onboardingRequestId, OnboardingError } from "./providers/onboarding.api";
import { voucherMoney, voucherCents } from "./utils/voucherMoney";
import { voucherFileError } from "./utils/voucherFiles";
import type { Choice, Page } from "./onboarding-types";
import type { AccrualPreview, PettyCashAccrual, ReplenishmentFund, ReplenishmentLine, ReplenishmentPreview, ReplenishmentRequest } from "./replenishment-types";

const section = "rounded-xl border bg-card p-4 md:p-5 space-y-4";
const th = "px-3 py-2 text-left text-sm font-medium whitespace-nowrap", td = "px-3 py-2 text-sm align-top";
function Panel({ title, children }: { title: string; children: ReactNode }) { return <section className={section}><h2 className="font-semibold">{title}</h2>{children}</section>; }
function ErrorMessage({ error, retry }: { error: Error | null; retry?: () => void }) { return error ? <div role="alert" className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800"><p>{error.message}</p>{error instanceof OnboardingError && error.requestId && <p className="text-xs">Reference: {error.requestId}</p>}{retry && <Button variant="outline" size="sm" onClick={retry}>Retry</Button>}</div> : null; }
function Blockers({ items }: { items: string[] }) { return items.length ? <div role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{items.map(message => <p key={message}>{message}</p>)}</div> : null; }
export function ReplenishmentJournal({ lines }: { lines: ReplenishmentLine[] }) {
  const dr = lines.reduce((sum, line) => sum + voucherCents(line.debit), 0n), cr = lines.reduce((sum, line) => sum + voucherCents(line.credit), 0n);
  const amount = (cents: bigint) => `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
  return lines.length ? <div className="overflow-x-auto rounded-lg border"><table className="w-full" aria-label="Journal entry preview"><thead className="bg-muted/40"><tr><th className={th}>Account</th><th className={`${th} text-right`}>Debit</th><th className={`${th} text-right`}>Credit</th></tr></thead><tbody>{lines.map((line, index) => <tr className="border-t" key={index}><td className={td}>{line.account.code} · {line.account.name}</td><td className={`${td} text-right whitespace-nowrap`}>{voucherMoney(line.debit)}</td><td className={`${td} text-right whitespace-nowrap`}>{voucherMoney(line.credit)}</td></tr>)}</tbody><tfoot className="border-t font-medium"><tr><td className={td}>Total</td><td className={`${td} text-right whitespace-nowrap`}>{voucherMoney(amount(dr))}</td><td className={`${td} text-right whitespace-nowrap`}>{voucherMoney(amount(cr))}</td></tr></tfoot></table></div> : <p className="text-sm text-muted-foreground">Nothing to post.</p>;
}
type DraftState = { record: ReplenishmentRequest | null; pending: ReplenishmentRequest | null; last: ReplenishmentRequest | null };
export default function PettyCashReplenishmentModule() {
  const funds = useReplenishmentRead<ReplenishmentFund[]>("funds"), [selected, setSelected] = useState<number | null>(null), [revision, setRevision] = useState(0), [notice, setNotice] = useState("");
  const fund = funds.data?.find(item => item.id === selected) || funds.data?.[0];
  const changed = (message: string) => { setNotice(message); setRevision(value => value + 1); funds.refresh(); };
  return <div className="space-y-5"><div><h1 className="text-2xl font-semibold">Replenishment</h1><p className="mt-2 text-sm text-muted-foreground">Count the cash, match it to the vouchers and submit to a named approver. The entry posts and the fund is replenished only when that person approves.</p></div>
    {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-900">{notice}</p>}
    <ErrorMessage error={funds.error} retry={funds.refresh} />{funds.loading && <p role="status">Loading funds...</p>}
    {fund && <><div className="max-w-xl space-y-2"><label htmlFor="replenishment-fund" className="text-sm font-medium">Fund</label><select id="replenishment-fund" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={fund.id} onChange={event => { setSelected(Number(event.target.value)); setNotice(""); }}><option value={fund.id} hidden>{fund.docNo} · {fund.name}</option>{funds.data?.map(item => <option key={item.id} value={item.id}>{item.docNo} · {item.name}</option>)}</select></div><FundWorkspace key={`${fund.id}:${revision}`} fund={fund} changed={changed} /></>}
    {!funds.loading && !funds.error && !fund && <p className={section}>No Active funds are available. Approve and fund a request in Onboarding Approval first.</p>}
    <ReplenishmentHistory key={revision} />
  </div>;
}
function FundWorkspace({ fund, changed }: { fund: ReplenishmentFund; changed: (message: string) => void }) {
  const read = useReplenishmentRead<DraftState>(`funds/${fund.id}/draft`);
  return <><ErrorMessage error={read.error} retry={read.refresh} />{read.loading && <p role="status">Loading reconciliation...</p>}{read.data && <ReplenishmentEditor fund={fund} initial={read.data} changed={changed} reload={() => changed("")} />}</>;
}
function ReplenishmentEditor({ fund, initial, changed, reload }: { fund: ReplenishmentFund; initial: DraftState; changed: (message: string) => void; reload: () => void }) {
  const [draft, setDraft] = useState(initial.record), [count, setCount] = useState(initial.record?.countedCash ?? fund.expectedCash), [approver, setApprover] = useState<Choice | null>(initial.record?.approverId ? { id: initial.record.approverId, code: String(initial.record.approverId), name: initial.record.approver, status: "ACTIVE", classification: "", eligible: true, reason: null, details: {} } : null);
  const fingerprint = JSON.stringify([count, approver?.id ?? null]);
  const [savedInputs, setSavedInputs] = useState(fingerprint), [fileBusy, setFileBusy] = useState(false), [fileError, setFileError] = useState<Error | null>(null);
  const failedUpload = useRef<{ file: File; requestId: string; version: number; id: number } | null>(null), fileInput = useRef<HTMLInputElement>(null);
  const command = useReplenishmentCommand(), preview = useReplenishmentRead<ReplenishmentPreview>(`funds/${fund.id}/preview?${new URLSearchParams({ countedCash: count })}`, 300);
  const { run } = command;
  const busy = command.busy || fileBusy, dirty = savedInputs !== fingerprint;
  const save = useCallback(async () => {
    if (draft && savedInputs === fingerprint) return draft;
    const result = await run<ReplenishmentRequest>(`funds/${fund.id}/draft`, "PUT", { version: draft?.version ?? 0, countedCash: count === "" ? null : count, approverId: approver?.id ?? null });
    if (result) { setDraft(result); setSavedInputs(fingerprint); } return result;
  }, [draft, savedInputs, fingerprint, run, fund.id, count, approver?.id]);
  useEffect(() => {
    if (!dirty || busy || command.error || initial.pending || count !== "" && !/^(?:0|[1-9]\d{0,15})(?:\.\d{1,2})?$/.test(count)) return;
    const timer = setTimeout(() => { void save(); }, 650); return () => clearTimeout(timer);
  }, [dirty, busy, command.error, initial.pending, count, save]);
  async function submit() { const current = await save(); if (!current || !preview.data) return; const result = await command.run<ReplenishmentRequest>(`requests/${current.id}/submit`, "POST", { version: current.version, previewToken: preview.data.token }); if (result) changed(`${result.docNo} submitted to ${result.approver}. Cash and the ledger are unchanged.`); }
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
  async function remove(file: number) { if (!draft) return; const result = await command.run(`requests/${draft.id}/attachments/${file}/remove`, "POST", { version: draft.version }); if (result) { try { setDraft(await replenishmentApi<ReplenishmentRequest>(`requests/${draft.id}`)); if (failedUpload.current) failedUpload.current = null; } catch (cause) { setFileError(cause instanceof Error ? cause : new Error("Refresh the document status.")); } } }
  const p = preview.data;
  return <div className="space-y-5"><Panel title="Reconciliation"><p className="text-sm md:text-base"><strong>{voucherMoney(fund.imprest)}</strong> imprest − <strong>{voucherMoney(`${(voucherCents(fund.imprest) - voucherCents(fund.expectedCash)) / 100n}.${String((voucherCents(fund.imprest) - voucherCents(fund.expectedCash)) % 100n).padStart(2, "0")}`)}</strong> open vouchers = <strong>{voucherMoney(fund.expectedCash)}</strong> expected cash</p>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div className="space-y-2"><label htmlFor="replenishment-count" className="text-sm font-medium">Actual cash counted (₱)</label><Input id="replenishment-count" type="number" min="0" step="0.01" value={count} disabled={busy} onChange={event => setCount(event.target.value)} /></div><div className="space-y-2"><label htmlFor="replenishment-variance" className="text-sm font-medium">Cash over / (short)</label><Input id="replenishment-variance" readOnly value={p ? voucherMoney(p.variance) : ""} /></div><div className="space-y-2"><label htmlFor="replenishment-amount" className="text-sm font-medium">Amount to reimburse</label><Input id="replenishment-amount" readOnly value={p ? voucherMoney(p.reimbursement) : ""} /></div><ReplenishmentApprover selected={approver} disabled={busy || Boolean(initial.pending)} onSelect={setApprover} /></div>
    {initial.pending && <Blockers items={[`${initial.pending.docNo} is waiting for ${initial.pending.approver} in Replenishment Approval.`]} />}
    {!initial.pending && initial.last?.state === "REJECTED" && <Blockers items={[`${initial.last.docNo} was rejected: ${initial.last.decisionReason}. Correct the vouchers in Disbursement or attach the requested documents, then submit again.`]} />}
    <div className="space-y-2"><p className="text-sm font-medium">Supporting documents (photos or PDFs, for example client visit reports)</p><p className="text-xs text-muted-foreground">JPG, PNG, or PDF. Maximum 5 MB per file. Documents are optional.</p><input ref={fileInput} hidden type="file" multiple accept="image/jpeg,image/png,application/pdf" disabled={busy || Boolean(initial.pending)} onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ""; void uploadFiles(files); }} /><Button variant="outline" size="sm" disabled={busy || Boolean(initial.pending)} onClick={() => fileInput.current?.click()}>Attach documents</Button>
      {!draft?.attachments.length && <p className="text-sm text-muted-foreground">No documents attached.</p>}{draft?.attachments.map(file => <div key={file.id} className="flex flex-wrap items-center gap-2 rounded-md border p-2 text-sm"><span className="min-w-0 flex-1 break-words">{file.filename} · {(file.fileSize / 1024).toFixed(0)} KB{file.state !== "READY" ? " · Upload incomplete" : ""}</span>{file.state === "READY" && <><a className="underline" target="_blank" rel="noreferrer" href={`${REPLENISHMENT_API}/requests/${draft.id}/attachments/${file.id}?view=preview`}>View</a><a className="underline" href={`${REPLENISHMENT_API}/requests/${draft.id}/attachments/${file.id}`}>Download</a></>}<Button variant="ghost" size="sm" disabled={busy} onClick={() => void remove(file.id)}>Remove</Button></div>)}</div>
    <ErrorMessage error={fileError} retry={failedUpload.current ? () => { const job = failedUpload.current; if (job) void upload(job.file, job); } : undefined} />
    <ErrorMessage error={command.error} retry={() => { void command.retry().then(result => { if (result) reload(); }); }} /><ErrorMessage error={preview.error} retry={preview.refresh} />{p && <Blockers items={p.blockers} />}
    <div className="flex flex-wrap gap-2"><Button disabled={busy || preview.loading || !p?.ready || !approver || Boolean(initial.pending) || draft?.attachments.some(file => file.state !== "READY" || !file.stored)} onClick={() => void submit()}>Submit for approval</Button><Button variant="outline" asChild disabled={busy || !p?.vouchers.length}><a aria-disabled={busy || !p?.vouchers.length} target="_blank" rel="noreferrer" href={p?.vouchers.length && !busy ? `${REPLENISHMENT_API}/funds/${fund.id}/print?${new URLSearchParams({ countedCash: count })}` : undefined}>Print draft request</a></Button><Button variant="ghost" disabled={busy} onClick={reload}>Refresh data</Button></div>
    <p role="status" className="text-xs text-muted-foreground">{busy ? "Saving..." : dirty ? "Reconciliation changes pending save." : draft ? "Reconciliation draft saved." : "Preparation does not move cash or post a journal."}</p>
  </Panel><Panel title="Journal entry on approval">{p ? <ReplenishmentJournal lines={p.lines} /> : <p role="status">Loading journal preview...</p>}</Panel>
  <Panel title={`Vouchers included (${p?.vouchers.length ?? 0})`}><VoucherTable preview={p} /></Panel><AccrualSection fund={fund} changed={changed} /></div>;
}
function VoucherTable({ preview }: { preview: ReplenishmentPreview | null }) {
  if (!preview?.vouchers.length) return <p className="text-sm text-muted-foreground">No open vouchers to replenish.</p>;
  const totals = ["gross", "inputVat", "ewt", "netCash"].map(key => preview.vouchers.reduce((sum, v) => sum + voucherCents(v[key as "gross"]), 0n));
  return <div className="overflow-x-auto rounded-lg border"><table className="w-full" aria-label="Vouchers included"><thead className="bg-muted/40"><tr>{["Voucher", "Date", "Payee", "Receipts", "Gross", "Input VAT", "EWT", "Cash paid"].map((label, i) => <th className={`${th} ${i > 3 ? "text-right" : ""}`} key={label}>{label}</th>)}</tr></thead><tbody>{preview.vouchers.map(v => <tr key={v.id} className="border-t"><td className={`${td} whitespace-nowrap`}>{v.docNo}</td><td className={`${td} whitespace-nowrap`}>{v.date}</td><td className={td}>{v.payee}</td><td className={td}>{v.receipts.join(", ")}</td>{[v.gross, v.inputVat, v.ewt, v.netCash].map((value, i) => <td className={`${td} text-right whitespace-nowrap`} key={i}>{voucherMoney(value)}</td>)}</tr>)}</tbody><tfoot className="border-t font-medium"><tr><td className={td} colSpan={4}>Total</td>{totals.map((value, i) => <td className={`${td} text-right whitespace-nowrap`} key={i}>{voucherMoney(`${value / 100n}.${String(value % 100n).padStart(2, "0")}`)}</td>)}</tr></tfoot></table></div>;
}
function AccrualSection({ fund, changed }: { fund: ReplenishmentFund; changed: (message: string) => void }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const lastEnd = new Date(`${today}T00:00:00Z`); lastEnd.setUTCDate(0);
  const [period, setPeriod] = useState(lastEnd.toISOString().slice(0, 10)), command = useReplenishmentCommand();
  const preview = useReplenishmentRead<AccrualPreview>(period ? `funds/${fund.id}/accruals/preview?${new URLSearchParams({ periodEnd: period })}` : null, 250), history = useReplenishmentRead<PettyCashAccrual[]>(`funds/${fund.id}/accruals`);
  async function post() { if (!preview.data?.ready) return; const result = await command.run<PettyCashAccrual>(`funds/${fund.id}/accruals`, "POST", { periodEnd: period, previewToken: preview.data.token }); if (result) changed(`Accrual ${result.journal} and reversal ${result.reversal} posted for ${result.periodEnd} and ${result.reversalDate}. Cash is unchanged.`); }
  return <Panel title="Period-end accrual"><p className="text-sm text-muted-foreground">Vouchers still open at period end are expenses of that period. This books them against the fund on the period-end date and reverses the entry the next day. The period end cannot be after today. Each voucher can be accrued only once.</p><div className="grid max-w-xl gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="replenishment-period" className="text-sm font-medium">Period end</label><Input id="replenishment-period" type="date" max={today} value={period} disabled={command.busy} onChange={event => setPeriod(event.target.value)} /></div><div className="space-y-2"><label htmlFor="replenishment-to-accrue" className="text-sm font-medium">To accrue</label><Input id="replenishment-to-accrue" readOnly value={preview.data ? `${preview.data.vouchers.length} voucher(s) · ${voucherMoney(preview.data.amount)}` : ""} /></div></div>
    <ErrorMessage error={preview.error} retry={preview.refresh} /><ErrorMessage error={command.error} retry={() => void post()} />{preview.data && <><Blockers items={preview.data.blockers} /><ReplenishmentJournal lines={preview.data.lines} /></>}
    <Button variant="outline" disabled={command.busy || preview.loading || !preview.data?.ready} onClick={() => void post()}>Post accrual and reversal</Button><ErrorMessage error={history.error} retry={history.refresh} />
    {!!history.data?.length && <div className="overflow-x-auto rounded-lg border"><table className="w-full" aria-label="Accrual history"><thead className="bg-muted/40"><tr>{["Accrual", "Period end", "Reversal", "Vouchers", "Amount"].map(label => <th key={label} className={th}>{label}</th>)}</tr></thead><tbody>{history.data.map(a => <tr key={a.id} className="border-t"><td className={td}>{a.journal}</td><td className={`${td} whitespace-nowrap`}>{a.periodEnd}</td><td className={td}>{a.reversal} on {a.reversalDate}</td><td className={td}>{a.vouchers.join(", ")}</td><td className={`${td} text-right whitespace-nowrap`}>{voucherMoney(a.amount)}</td></tr>)}</tbody></table></div>}
  </Panel>;
}
function ReplenishmentHistory() {
  const [page, setPage] = useState(1), history = useReplenishmentRead<Page<ReplenishmentRequest>>(`requests?page=${page}&pageSize=25`);
  return <Panel title="Replenishment history"><ErrorMessage error={history.error} retry={history.refresh} />{history.loading && <p role="status">Loading history...</p>}{history.data && <>{history.data.items.length ? <div className="overflow-x-auto rounded-lg border"><table className="w-full" aria-label="Replenishment history"><thead className="bg-muted/40"><tr>{["No.", "Date", "Fund", "Prepared by", "Approver", "Status", "Docs", "Over/(short)", "Reimbursed", ""].map((label, i) => <th key={i} className={th}>{label}</th>)}</tr></thead><tbody>{history.data.items.map(r => <tr key={r.id} className="border-t"><td className={`${td} whitespace-nowrap`}>{r.docNo}</td><td className={`${td} whitespace-nowrap`}>{r.submittedAt.slice(0, 10)}</td><td className={`${td} whitespace-nowrap`}>{r.snapshot?.fund.docNo}</td><td className={td}>{r.preparedBy}</td><td className={td}>{r.approver}</td><td className={td}>{r.state === "PENDING" ? "Pending" : r.state === "POSTED" ? "Posted" : "Rejected"}{r.decisionReason && <small className="block">{r.decisionReason}</small>}</td><td className={td}>{r.attachments.length || "–"}</td><td className={`${td} text-right whitespace-nowrap`}>{voucherMoney(r.snapshot?.variance || "0.00")}</td><td className={`${td} text-right whitespace-nowrap`}>{voucherMoney(r.snapshot?.reimbursement || "0.00")}</td><td className={td}><Button size="sm" variant="outline" asChild><a target="_blank" rel="noreferrer" href={`${REPLENISHMENT_API}/requests/${r.id}/print`}>Print</a></Button></td></tr>)}</tbody></table></div> : <p className="text-sm text-muted-foreground">None yet.</p>}<div className="flex items-center justify-end gap-2 text-sm"><span>{history.data.total} record(s) · Page {page}</span><Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Previous page</Button><Button size="sm" variant="outline" disabled={page * 25 >= history.data.total} onClick={() => setPage(value => value + 1)}>Next page</Button></div></>}</Panel>;
}
