"use client";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Choice } from "../onboarding-types";
import { VOUCHER_DOCUMENTS, type Voucher, type VoucherAmounts, type VoucherAttachment, type VoucherFund, type VoucherInput, type VoucherLine, type VoucherLineInput } from "../voucher-types";
import { VOUCHER_API, voucherApi } from "../providers/vouchers.api";
import { onboardingRequestId } from "../providers/onboarding.api";
import { useVoucherCommand, useVoucherPreview, useVoucherRead } from "../hooks/useVouchers";
import { VOUCHER_FILE_ACCEPT, VOUCHER_FILE_GUIDANCE, voucherFileError } from "../utils/voucherFiles";
import { ErrorBox, Field, NativeSelect } from "./OnboardingCommon";
import { VoucherChoice } from "./VoucherChoice";

const money = (value: string) => new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value));
type EditorLine = VoucherLineInput & { account: Choice | null; vatChoice: Choice | null; ewtChoice: Choice | null };
type QueuedFile = { requestId: string; key: string; file: File; version?: number; error?: string; uploaded?: boolean };
const newLine = (): EditorLine => ({ key: onboardingRequestId(), documentType: "INVOICE", receiptNo: "", expenseCoaId: null, gross: "", vatIncluded: false, vatRuleId: null, ewtRuleId: null, account: null, vatChoice: null, ewtChoice: null });
const taxChoice = (rule: { id?: number; code?: string; rate?: string }): Choice | null => rule.id ? { id: rule.id, code: rule.code || "", name: `${rule.rate}%`, status: "VERIFIED", classification: "", eligible: true, reason: null, details: {} } : null;
const fromLine = (line: VoucherLine): EditorLine => ({ ...line, account: line.account, vatChoice: taxChoice(line.taxSnapshot.vat), ewtChoice: taxChoice(line.taxSnapshot.ewt) });

export function VoucherEditor({ fund, voucherId, canEdit, onClose }: { fund: VoucherFund; voucherId: number | null; canEdit: boolean; onClose: () => void }) {
  const loaded = useVoucherRead<Voucher>(voucherId === null ? null : `vouchers/${voucherId}`), [busy, setBusy] = useState(false);
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[92dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-6xl" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>{voucherId === null ? "New voucher draft" : "Voucher draft details"}</DialogTitle><DialogDescription>One payee per voucher. Save an unpaid draft and its supporting files; no cash is paid.</DialogDescription></DialogHeader>
    {loaded.loading && <p role="status">Loading voucher draft...</p>}<ErrorBox error={loaded.error} retry={loaded.refresh} />
    {(voucherId === null || loaded.data) && <EditorForm initial={loaded.data} fund={fund} canEdit={canEdit} onClose={onClose} onBusy={setBusy} />}
  </DialogContent></Dialog>;
}
function Totals({ value }: { value: VoucherAmounts }) {
  return <dl className="grid gap-3 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-5">{[["Gross", value.gross], ["Expense base", value.expenseBase], ["Input VAT", value.inputVat], ["EWT", value.ewt], ["Net cash payable", value.netCash]].map(([label, amount]) => <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 font-semibold">{money(amount)}</dd></div>)}</dl>;
}
function EditorForm({ initial, fund, canEdit, onClose, onBusy }: { initial: Voucher | null; fund: VoucherFund; canEdit: boolean; onClose: () => void; onBusy: (busy: boolean) => void }) {
  const [record, setRecord] = useState(initial), [date, setDate] = useState(initial?.saved.date || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const [payee, setPayee] = useState<Choice | null>(initial ? { ...initial.saved.payee, id: initial.saved.payeeProfileId } : null), [particulars, setParticulars] = useState(initial?.saved.particulars || "");
  const [lines, setLines] = useState<EditorLine[]>(() => initial ? initial.saved.lines.map(fromLine) : [newLine()]);
  const [queued, setQueued] = useState<QueuedFile[]>([]), [fileError, setFileError] = useState<Error | null>(null), [saving, setSaving] = useState(false), [savedMessage, setSavedMessage] = useState("");
  const [discardConfirm, setDiscardConfirm] = useState(false), [viewFile, setViewFile] = useState<VoucherAttachment | null>(null);
  const command = useVoucherCommand(); const busy = saving || command.busy;
  const input: VoucherInput = { version: record?.version || 0, voucherId: record?.id || null, fundId: fund.id, payeeProfileId: payee?.id || null, date, particulars, lines: lines.map(({ key, documentType, receiptNo, expenseCoaId, gross, vatIncluded, vatRuleId, ewtRuleId }) => ({ key, documentType, receiptNo, expenseCoaId, gross, vatIncluded, vatRuleId, ewtRuleId })) };
  const preview = useVoucherPreview(input);
  const content = JSON.stringify([input.fundId, input.payeeProfileId, input.date, input.particulars, input.lines]);
  const savedContent = useRef(initial ? content : ""); const saveLock = useRef(false);
  function changeLine(key: string, updates: Partial<EditorLine>) { setLines(current => current.map(line => line.key === key ? { ...line, ...updates } : line)); setSavedMessage(""); }
  function queueFiles(key: string, files: FileList | null) {
    if (!files) return;
    const accepted: QueuedFile[] = []; const errors: string[] = [];
    for (const file of Array.from(files)) { const invalid = voucherFileError(file); if (invalid) errors.push(`${file.name}: ${invalid.message}`); else accepted.push({ key, file, requestId: onboardingRequestId() }); }
    setQueued(current => [...current, ...accepted]); setFileError(errors.length ? new Error(errors.join(" ")) : null);
  }
  async function save(event: FormEvent) {
    event.preventDefault(); if (saveLock.current || !canEdit || !preview.data) return;
    saveLock.current = true; setSaving(true); onBusy(true); setFileError(null); setSavedMessage("");
    try {
      let current = record;
      if (!current || savedContent.current !== content) {
        const result = await command.run<Voucher>(current ? `vouchers/${current.id}/draft` : "vouchers/drafts", current ? "PUT" : "POST", { ...input, previewToken: preview.data.token });
        if (!result) return; current = result; setRecord(result); savedContent.current = content;
      }
      for (const entry of queued.filter(file => !file.uploaded)) {
        const line = current.saved.lines.find(line => line.key === entry.key); if (!line) continue;
        const version = entry.version ?? current.version;
        setQueued(files => files.map(file => file.requestId === entry.requestId ? { ...file, version, error: undefined } : file));
        const form = new FormData(); form.append("file", entry.file); form.append("requestId", entry.requestId); form.append("version", String(version)); form.append("lineId", String(line.id));
        let failed = false;
        try {
          await voucherApi<VoucherAttachment>(`vouchers/${current.id}/attachments`, { method: "POST", body: form });
          setQueued(files => files.map(file => file.requestId === entry.requestId ? { ...file, version, uploaded: true, error: undefined } : file));
        } catch (cause) { failed = true; setQueued(files => files.map(file => file.requestId === entry.requestId ? { ...file, version, error: cause instanceof Error ? cause.message : "Upload failed. Retry this file." } : file)); }
        current = await voucherApi<Voucher>(`vouchers/${current.id}`); setRecord(current);
        if (failed) break;
      }
      setSavedMessage(`${current.docNo} saved as an unpaid draft. Cash and the ledger are unchanged.`);
    } catch (cause) { setFileError(cause instanceof Error ? cause : new Error("The draft may be saved. Reopen it before retrying.")); }
    finally { saveLock.current = false; setSaving(false); onBusy(false); }
  }
  async function removeFile(file: VoucherAttachment) {
    if (!record || busy) return; setSaving(true); onBusy(true);
    try { const result = await command.run<VoucherAttachment>(`vouchers/${record.id}/attachments/${file.id}/remove`, "POST", { version: record.version }); if (result) { setRecord(await voucherApi<Voucher>(`vouchers/${record.id}`)); setQueued(current => current.filter(item => item.key !== record.saved.lines.find(line => line.id === file.lineId)?.key || !item.error)); } }
    catch (cause) { setFileError(cause instanceof Error ? cause : new Error("Unable to refresh attachments.")); }
    finally { setSaving(false); onBusy(false); }
  }
  async function discard() {
    if (!record || busy) return; setSaving(true); onBusy(true);
    try { const result = await command.run<Voucher>(`vouchers/${record.id}/discard`, "POST", { version: record.version }); if (result) onClose(); }
    finally { setSaving(false); onBusy(false); }
  }
  const lookup = (resource: string) => `lookups/${resource}?fundId=${fund.id}`;
  return <form onSubmit={save} noValidate className="space-y-4">
    <div className="rounded-lg border p-3 text-sm"><strong>{record?.docNo || "New draft"} · {fund.docNo} · {fund.name}</strong><p className="mt-1 text-muted-foreground">Gross hard limit {money(fund.perVoucherLimit)} · Approval above {money(fund.approvalThreshold)} · Expected cash {money(fund.expectedCash)}</p></div>
    {record && <details className="space-y-2 rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Saved draft snapshot</summary><p className="mt-2">{record.saved.date} · {record.saved.payee.name} · {record.saved.particulars}</p><Totals value={record.saved.totals} /><ul className="mt-2 space-y-1">{record.saved.lines.map(line => <li key={line.key}>{line.receiptNo} · {line.account.code} · {line.account.name} · {money(line.amounts.gross)}</li>)}</ul></details>}
    <fieldset disabled={busy || !canEdit} className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><Field label="Voucher date" id="voucher-date" type="date" value={date} onChange={setDate} required />
      <VoucherChoice label="Payee" path={lookup("payees")} selected={payee} onSelect={setPayee} disabled={busy || !canEdit} /></div>
      {payee && <p className="text-xs text-muted-foreground">TIN: {String(payee.details.tin || "Not supplied")} · {String(payee.details.vatRegistered ? "VAT registered" : "Non-VAT")} · {payee.classification}. Missing TIN is not a tax exemption.</p>}
      <Field label="Particulars / Purpose" id="voucher-particulars" value={particulars} onChange={setParticulars} maxLength={1000} required />
      <p className="text-xs text-muted-foreground">Cash advances, IOUs, loans, salaries/payroll and personal cheque encashment are prohibited.</p>
      <div className="space-y-4">{lines.map((line, index) => <div key={line.key} className="space-y-3 rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">Receipt / expense line {index + 1}</h3><div className="flex gap-2">
        {index > 0 && <Button type="button" size="sm" variant="outline" onClick={() => setLines(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>Move up</Button>}
        <Button type="button" size="sm" variant="outline" disabled={lines.length === 1} onClick={() => { setLines(current => current.filter(item => item.key !== line.key)); setQueued(current => current.filter(item => item.key !== line.key)); }}>Remove line {index + 1}</Button>
      </div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><NativeSelect label={`Document type, line ${index + 1}`} id={`doc-${line.key}`} value={line.documentType} onChange={documentType => changeLine(line.key, { documentType })}>{Object.entries(VOUCHER_DOCUMENTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</NativeSelect>
        <Field label={`Receipt number, line ${index + 1}`} id={`receipt-${line.key}`} value={line.receiptNo} onChange={receiptNo => changeLine(line.key, { receiptNo })} maxLength={128} required />
        <VoucherChoice label={`Expense account, line ${index + 1}`} path={lookup("accounts")} selected={line.account} onSelect={account => changeLine(line.key, { account, expenseCoaId: account?.id ?? null })} disabled={busy || !canEdit} />
        <Field label={`Gross amount (PHP), line ${index + 1}`} id={`gross-${line.key}`} type="number" value={line.gross} onChange={gross => changeLine(line.key, { gross })} required />
        <div className="space-y-2"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={line.vatIncluded} onChange={event => changeLine(line.key, { vatIncluded: event.target.checked, ...(!event.target.checked ? { vatRuleId: null, vatChoice: null } : {}) })} />VAT included, line {index + 1}</label><p className="text-xs text-muted-foreground">Input VAT requires an eligible invoice, VAT registration, complete TIN and a verified rule.</p></div>
        <VoucherChoice label={`VAT rule, line ${index + 1}`} path={`${lookup("tax-rules")}&${new URLSearchParams({ profileId: String(payee?.id || ""), date, documentType: line.documentType, kind: "VAT" })}`} selected={line.vatChoice} onSelect={vatChoice => changeLine(line.key, { vatChoice, vatRuleId: vatChoice?.id ?? null })} disabled={busy || !canEdit || !line.vatIncluded || !payee || !date} />
        <VoucherChoice label={`EWT / ATC, line ${index + 1}`} path={`${lookup("tax-rules")}&${new URLSearchParams({ profileId: String(payee?.id || ""), date, documentType: line.documentType, kind: "EWT" })}`} selected={line.ewtChoice} onSelect={ewtChoice => changeLine(line.key, { ewtChoice, ewtRuleId: ewtChoice?.id ?? null })} disabled={busy || !canEdit || !payee || !date} />
      </div>
      {preview.data?.lines[index] && <Totals value={preview.data.lines[index].amounts} />}
      <div className="space-y-2 border-t pt-3"><label htmlFor={`files-${line.key}`} className="text-sm font-medium">Supporting files, line {index + 1}</label><p className="text-xs text-muted-foreground">{VOUCHER_FILE_GUIDANCE} Files are optional. They upload after the valid draft is saved.</p>
        <Input id={`files-${line.key}`} type="file" accept={VOUCHER_FILE_ACCEPT} multiple onChange={event => { queueFiles(line.key, event.target.files); event.target.value = ""; }} />
        {queued.filter(file => file.key === line.key && !file.uploaded).map(file => <div key={file.requestId} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs"><span className="min-w-0 flex-1 break-words">{file.file.name} · {(file.file.size / 1024).toFixed(1)} KB · {file.error || "Ready to upload on Save draft"}</span><Button type="button" size="sm" variant="ghost" onClick={() => setQueued(current => current.filter(item => item.requestId !== file.requestId))}>Remove queued file</Button></div>)}
        {record?.attachments.filter(file => file.lineId === record.saved.lines.find(saved => saved.key === line.key)?.id).map(file => <div key={file.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs"><span className="min-w-0 flex-1 break-words">{file.filename} · {(file.fileSize / 1024).toFixed(1)} KB · {file.state === "READY" ? "Ready" : "Upload incomplete — retry the queued file or remove"}</span>
          {file.state === "READY" && <><Button type="button" size="sm" variant="outline" onClick={() => setViewFile(file)}>Preview</Button><Button type="button" size="sm" variant="outline" asChild><a href={`${VOUCHER_API}/vouchers/${record.id}/attachments/${file.id}`}>Download</a></Button></>}
          <Button type="button" size="sm" variant="ghost" onClick={() => void removeFile(file)}>Remove file</Button>
        </div>)}
      </div></div>)}</div>
      <Button type="button" variant="outline" onClick={() => setLines(current => [...current, newLine()])}>Add receipt / expense line</Button>
    </fieldset>
    {preview.loading ? <p role="status" className="text-sm">Calculating voucher preview...</p> : <ErrorBox error={preview.error} retry={preview.refresh} />}
    {preview.data && <div className="space-y-2"><h3 className="font-medium">Voucher totals</h3><Totals value={preview.data.totals} /></div>}
    <ErrorBox error={command.error} /><ErrorBox error={fileError} />
    {command.error && <Button type="button" variant="outline" disabled={busy} onClick={preview.refresh}>Refresh calculation preview</Button>}
    {savedMessage && <p role="status" className="rounded-lg border p-3 text-sm">{savedMessage}</p>}
    {record && <p className="text-xs text-muted-foreground">Draft version {record.version}. Receipt numbers are reserved across all funds until this draft is discarded.</p>}
    <div className="flex flex-wrap items-center justify-end gap-2">{record && canEdit && <Button type="button" variant="outline" disabled={busy} onClick={() => setDiscardConfirm(value => !value)}>Discard draft</Button>}
      <Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close editor</Button>{canEdit && <Button type="submit" disabled={busy || !preview.data}>{busy ? "Saving draft / uploading..." : queued.some(file => file.error && !file.uploaded) ? "Save draft / retry files" : "Save draft"}</Button>}
    </div>{discardConfirm && <div role="alert" className="space-y-2 rounded-lg border p-3 text-sm"><p>Discard this unpaid draft and release its receipt reservations? Its audit history will be retained.</p><Button type="button" variant="destructive" disabled={busy} onClick={() => void discard()}>Confirm discard</Button></div>}
    {viewFile && record && <Dialog open onOpenChange={open => { if (!open) setViewFile(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] overflow-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{viewFile.filename}</DialogTitle><DialogDescription>Authenticated supporting file preview.</DialogDescription></DialogHeader>
      {viewFile.mimeType === "application/pdf" ? typeof navigator !== "undefined" && navigator.pdfViewerEnabled
        ? <iframe title={viewFile.filename} className="h-[65dvh] w-full" src={`${VOUCHER_API}/vouchers/${record.id}/attachments/${viewFile.id}?view=preview`} />
        : <p role="status" className="rounded-lg border p-4 text-sm">This browser cannot display PDF previews. Download the file to view it.</p>
        // eslint-disable-next-line @next/next/no-img-element
        : <img alt={viewFile.filename} className="max-h-[65dvh] w-full object-contain" src={`${VOUCHER_API}/vouchers/${record.id}/attachments/${viewFile.id}?view=preview`} />}
      <Button type="button" variant="outline" asChild><a href={`${VOUCHER_API}/vouchers/${record.id}/attachments/${viewFile.id}`}>Download file if preview is unavailable</a></Button>
      <Button type="button" variant="outline" onClick={() => setViewFile(null)}>Close preview</Button>
    </DialogContent></Dialog>}
  </form>;
}
