"use client";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ErrorBox } from "./OnboardingCommon";
import { useFundDecision, useFundRead } from "../hooks/useFunds";
import { ReplenishmentJournal } from "../PettyCashReplenishmentModule";
import { replenishmentApi } from "../providers/replenishment.api";
import { onboardingRequestId } from "../providers/onboarding.api";
import { voucherCents, voucherMoney } from "../utils/voucherMoney";
import { voucherFileError } from "../utils/voucherFiles";
import type { ReplenishmentReview } from "../replenishment-types";

export const APPROVAL_API = "/api/fm/petty-cash/replenishment-approval";
export function ReplenishmentStatus({ state }: { state: string }) { return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${state === "PENDING" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : state === "POSTED" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{state === "PENDING" ? "Pending" : state === "POSTED" ? "Posted" : "Rejected"}</span>; }

const table = "w-full text-left text-sm [&_th]:whitespace-nowrap [&_th]:p-2 [&_th]:font-medium [&_td]:p-2";
const sum = (values: string[]) => { const cents = values.reduce((n, v) => n + voucherCents(v), 0n); return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`; };
export function ReplenishmentApprovalReview({ id, actorName, onClose, onChanged }: { id: number; actorName: string; onClose: () => void; onChanged: (record: ReplenishmentReview) => void }) {
  const read = useFundRead<ReplenishmentReview>(`replenishment-approval/requests/${id}`), command = useFundDecision<ReplenishmentReview>();
  const [remarks, setRemarks] = useState(""), [confirmed, setConfirmed] = useState(false), [uploading, setUploading] = useState(false), [fileError, setFileError] = useState<Error | null>(null);
  const fileInput = useRef<HTMLInputElement>(null), failedUpload = useRef<{ file: File; requestId: string; version: number } | null>(null);
  const data = read.data, r = data?.row.request, p = r?.snapshot, locked = command.busy || command.uncertain || uploading, pending = r?.state === "PENDING";
  function reload() { setConfirmed(false); read.refresh(); }
  async function decide(action: "approve" | "reject") {
    if (!r || !data) return;
    const payload = action === "approve" ? { version: r.version, reviewToken: data.reviewToken, cashConfirmed: confirmed, remarks } : { version: r.version, reason: remarks };
    const result = await command.run(`replenishment-approval/requests/${id}/${action}`, payload); if (result) onChanged(result);
  }
  async function upload(files: File[], retry?: { requestId: string; version: number }) {
    for (const file of files) { const invalid = voucherFileError(file); if (invalid) { setFileError(new Error(invalid.message)); return; } }
    setUploading(true); setFileError(null); setConfirmed(false);
    try {
      for (const file of files) {
        const current = await replenishmentApi<{ version: number }>(`requests/${id}`);
        const job = retry || { requestId: onboardingRequestId(), version: current.version }; failedUpload.current = { ...job, file };
        const form = new FormData(); form.set("file", file); form.set("version", String(job.version)); form.set("requestId", job.requestId);
        await replenishmentApi(`requests/${id}/attachments`, { method: "POST", body: form }); failedUpload.current = null;
      }
    } catch (cause) { setFileError(cause instanceof Error ? cause : new Error("Supporting file upload failed. Retry the same file.")); }
    finally { setUploading(false); read.refresh(); }
  }
  const print = <Button variant="outline" asChild><a target="_blank" rel="noreferrer" href={`${APPROVAL_API}/requests/${id}/print`}>Print</a></Button>;
  return <Dialog open onOpenChange={open => { if (!open && !locked) onClose(); }}><DialogContent showCloseButton={!locked} className="max-h-[90vh] grid-cols-1 overflow-y-auto sm:max-w-[1100px]" onEscapeKeyDown={event => { if (locked) event.preventDefault(); }} onInteractOutside={event => { if (locked) event.preventDefault(); }}><DialogHeader><DialogTitle>{r && p ? `${r.docNo} · ${p.fund.docNo} ${p.fund.name}` : "Replenishment review"}</DialogTitle><DialogDescription>Review the reconciliation, vouchers, supporting documents and journal before deciding.</DialogDescription></DialogHeader>
    {read.loading && <p role="status">Loading replenishment...</p>}<ErrorBox error={read.error || null} retry={reload} /><ErrorBox error={command.error} />
    {data && r && p && <><div><ReplenishmentStatus state={r.state} /></div><div className="grid gap-4 rounded-lg bg-muted/30 p-4 text-sm sm:grid-cols-3">{[["Prepared by", `${r.preparedBy} · ${r.submittedAt.slice(0, 10)}`], ["Custodian", p.fund.custodian], ["Named approver", r.approver]].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>)}</div>
      <dl className="divide-y text-sm">{[["Imprest amount", p.fund.imprest], ["Expected cash", p.fund.expectedCash], ["Cash counted", p.countedCash], ["Over/(short)", p.variance], ["To reimburse", p.reimbursement]].map(([label, value]) => <div key={label} className="grid grid-cols-2 gap-3 py-2"><dt>{label}</dt><dd className="text-right font-medium">{voucherMoney(value)}</dd></div>)}</dl>
      {pending && !data.row.assigned && <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">Assigned to {r.approver}. Only the named approver can decide this request.</p>}
      {!!data.blockers.length && <div role="note" className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{data.blockers.map(message => <p key={message}>{message}</p>)}</div>}
      <section className="space-y-2"><h2 className="font-medium">Vouchers ({p.vouchers.length})</h2><div className="overflow-x-auto rounded-lg border"><table aria-label="Supporting vouchers" className={table}><thead className="border-b bg-muted/30"><tr>{["Voucher", "Date", "Payee", "Receipts", "Gross", "Cash paid"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{p.vouchers.map(v => <tr key={v.id} className="border-b align-top"><td className="whitespace-nowrap">{v.docNo}</td><td className="whitespace-nowrap">{v.date}</td><td>{v.payee}</td><td>{data.receipts?.filter(l => l.voucherId === v.id).length ? data.receipts.filter(l => l.voucherId === v.id).map((l, i) => <p key={i}>{l.documentType.replaceAll("_", " ")} {l.receiptNo}</p>) : v.receipts.join(", ")}</td><td className="whitespace-nowrap text-right">{voucherMoney(v.gross)}</td><td className="whitespace-nowrap text-right">{voucherMoney(v.netCash)}</td></tr>)}</tbody><tfoot><tr><th colSpan={4} className="text-left">Total</th><td className="whitespace-nowrap text-right">{voucherMoney(sum(p.vouchers.map(v => v.gross)))}</td><td className="whitespace-nowrap text-right">{voucherMoney(sum(p.vouchers.map(v => v.netCash)))}</td></tr></tfoot></table></div></section>
      <section className="space-y-2"><h2 className="font-medium">Supporting documents ({r.attachments.length})</h2>{r.attachments.length ? r.attachments.map(file => <div key={file.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-2 text-sm"><span className="min-w-0 flex-1 break-words">{file.filename} · {(file.fileSize / 1024).toFixed(0)} KB</span>{file.state === "READY" ? <><a className="underline" target="_blank" rel="noreferrer" href={`${APPROVAL_API}/requests/${id}/attachments/${file.id}?view=preview`}>View</a><a className="underline" href={`${APPROVAL_API}/requests/${id}/attachments/${file.id}`}>Download</a></> : <span>Upload incomplete</span>}</div>) : <p className="text-sm text-muted-foreground">No documents attached.</p>}
        {data.canAddDocuments && <><p className="text-xs text-muted-foreground">JPG, PNG or PDF. Maximum 5 MB per file. Pending documents are retained.</p><input ref={fileInput} hidden multiple type="file" accept="image/jpeg,image/png,application/pdf" disabled={locked} onChange={event => { const files = Array.from(event.target.files || []); event.target.value = ""; void upload(files); }} /><Button size="sm" variant="outline" disabled={locked} onClick={() => fileInput.current?.click()}>Add document</Button></>}<ErrorBox error={fileError} retry={failedUpload.current && data.canAddDocuments ? () => { const job = failedUpload.current; if (job) void upload([job.file], job); } : undefined} />
      </section>
      <section className="space-y-2"><h2 className="font-medium">{pending ? "Journal entry on approval" : "Submitted journal entry"}{data.accountingDate ? ` · ${data.accountingDate}` : ""}</h2><ReplenishmentJournal lines={p.lines} /></section>
      {pending && <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="replenishment-decider" className="text-sm font-medium">Approver</label><Input id="replenishment-decider" readOnly value={actorName} /></div><div className="space-y-2"><label htmlFor="replenishment-remarks" className="text-sm font-medium">Remarks (required to reject)</label><Input id="replenishment-remarks" maxLength={1000} value={remarks} disabled={locked || !data.canReject} onChange={event => setRemarks(event.target.value)} /></div></div>}
      {pending && data.row.assigned && <label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={confirmed} disabled={locked || !data.canApprove} onChange={event => setConfirmed(event.target.checked)} />{p.reimbursement === "0.00" ? "I confirm the counted cash and variance; no reimbursement cash is due." : `I confirm ${voucherMoney(p.reimbursement)} reimbursement was received and the counted cash is correct.`}</label>}
      {!pending && <p className="rounded-lg border p-3 text-sm">{r.state === "POSTED" ? "Posted" : "Rejected"} by {data.row.decidedBy} · {data.row.decidedAt.replace("T", " ")}{data.row.journal ? ` · ${data.row.journal.number}` : ""}{r.decisionReason ? ` · ${r.decisionReason}` : ""}</p>}
      {!!data.history.length && <details className="rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Action history</summary><ul className="mt-3 space-y-2">{data.history.map((h, i) => <li key={i}>{h.occurredAt.replace("T", " ")} · {h.actorName} · {h.action.replaceAll("_", " ")}{h.reason ? ` · ${h.reason}` : ""}</li>)}</ul></details>}
    </>}
    {command.uncertain && <p role="status" className="text-sm">The decision outcome is not confirmed. Retry the same decision to safely recover its result.</p>}
    <div className="flex flex-wrap gap-2 pt-2">{command.uncertain ? <Button disabled={command.busy} onClick={async () => { const result = await command.retry(); if (result) onChanged(result); }}>{command.busy ? "Checking decision..." : "Retry decision"}</Button> : pending && <><Button disabled={locked || !data?.canApprove || !confirmed} onClick={() => void decide("approve")}>Approve and post</Button><Button variant="destructive" disabled={locked || !data?.canReject || !remarks.trim()} onClick={() => void decide("reject")}>Reject</Button></>}{r && print}<Button variant="outline" disabled={locked} onClick={onClose}>Cancel</Button>{command.error && !locked && <Button variant="outline" onClick={reload}>Reload review</Button>}</div>
  </DialogContent></Dialog>;
}
