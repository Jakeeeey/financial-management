"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Choice } from "../onboarding-types";
import { VOUCHER_DOCUMENTS, type Voucher, type VoucherAmounts, type VoucherAttachment, type VoucherFund, type VoucherInput, type VoucherLine, type VoucherLineInput, type VoucherOperations } from "../voucher-types";
import { VOUCHER_API, voucherApi } from "../providers/vouchers.api";
import { onboardingRequestId } from "../providers/onboarding.api";
import { useVoucherCommand, useVoucherPreview, useVoucherRead } from "../hooks/useVouchers";
import { VOUCHER_FILE_ACCEPT, VOUCHER_FILE_GUIDANCE, voucherFileError } from "../utils/voucherFiles";
import { ErrorBox, Field, NativeSelect, OnboardingFeedback } from "./OnboardingCommon";
import { TotalsSkeleton, VoucherEditorSkeleton } from "./PettyCashSkeletons";
import { useFundDecision } from "../hooks/useFunds";
import { VoucherChoice } from "./VoucherChoice";
import { voucherCents, voucherMoney as money } from "../utils/voucherMoney";
import { onboardingFieldError } from "../utils/onboardingFeedback";

type EditorLine = VoucherLineInput & { account: Choice | null; vatChoice: Choice | null; ewtChoice: Choice | null };
type QueuedFile = { requestId: string; key: string; file: File; version?: number; error?: string; uploaded?: boolean };
type Confirmation = { review: VoucherOperations; current: Voucher; needsApproval: boolean; requiresCash: boolean; cashAfter: string };
const newLine = (): EditorLine => ({ key: onboardingRequestId(), documentType: "INVOICE", receiptNo: "", expenseCoaId: null, gross: "", vatIncluded: false, vatRuleId: null, ewtRuleId: null, account: null, vatChoice: null, ewtChoice: null });
const taxChoice = (rule: { id?: number; code?: string; rate?: string }): Choice | null => rule.id ? { id: rule.id, code: rule.code || "", name: `${rule.rate}%`, status: "VERIFIED", classification: "", eligible: true, reason: null, details: {} } : null;
const fromLine = (line: VoucherLine): EditorLine => ({ ...line, account: line.account, vatChoice: taxChoice(line.taxSnapshot.vat), ewtChoice: taxChoice(line.taxSnapshot.ewt) });
const fromCents = (cents: bigint) => `${cents < 0n ? "-" : ""}${(cents < 0n ? -cents : cents) / 100n}.${String((cents < 0n ? -cents : cents) % 100n).padStart(2, "0")}`;

export function VoucherEditor({ fund, voucherId, canEdit, onClose, operational = false, onFinalized, onDataChanged }: { fund: VoucherFund; voucherId: number | null; canEdit: boolean; onClose: () => void; operational?: boolean; onFinalized?: (value: VoucherOperations) => void; onDataChanged?: () => void }) {
  const loaded = useVoucherRead<Voucher>(voucherId === null ? null : `vouchers/${voucherId}`), [busy, setBusy] = useState(false);
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent showCloseButton={false} className="max-h-[92dvh] w-[calc(100vw-2rem)] grid-cols-1 overflow-y-auto sm:max-w-7xl" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>{operational ? voucherId === null ? "New payment voucher" : "Edit voucher" : voucherId === null ? "New voucher draft" : "Voucher draft details"}</DialogTitle><DialogDescription>{operational ? "One payee per voucher, one line per receipt. Save a draft or review the payment before cash moves." : "One payee per voucher. Save an unpaid draft and its supporting files; no cash is paid."}</DialogDescription></DialogHeader>
    {loaded.loading && <VoucherEditorSkeleton />}<ErrorBox error={loaded.error} retry={loaded.refresh} title="Could not load voucher" />
    {(voucherId === null || loaded.data) && <EditorForm initial={loaded.data} fund={fund} canEdit={canEdit} onClose={onClose} onBusy={setBusy} operational={operational} onFinalized={onFinalized} onDataChanged={onDataChanged} />}
  </DialogContent></Dialog>;
}

function Totals({ value }: { value: VoucherAmounts }) {
  return <dl className="grid gap-2 rounded-lg border bg-muted/20 p-3 text-sm sm:grid-cols-5">{[["Gross", value.gross], ["Expense base", value.expenseBase], ["Input VAT", value.inputVat], ["EWT", value.ewt], ["Net cash payable", value.netCash]].map(([label, amount]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-0.5 font-semibold">{money(amount)}</dd></div>)}</dl>;
}

function VoucherConfirmation({ confirmation, fund, busy, cashConfirmed, onCashConfirmed, onConfirm, onClose, onRetry, uncertain, error }: { confirmation: Confirmation; fund: VoucherFund; busy: boolean; cashConfirmed: boolean; onCashConfirmed: (value: boolean) => void; onConfirm: () => void; onClose: () => void; onRetry: () => void; uncertain: boolean; error: Error | null }) {
  const review = confirmation.review, target = review.proposed || review.effective, delta = voucherCents(review.cashDelta);
  const blocked = review.blockers.length > 0 || !review.actions.finalize;
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent showCloseButton={!busy} className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>{confirmation.needsApproval ? "Submit voucher for approval" : confirmation.current.state === "UNREPLENISHED" ? "Confirm voucher changes" : "Confirm voucher payment"}</DialogTitle><DialogDescription>{confirmation.needsApproval ? "No cash moves until an approver decides this voucher." : "Review the payment details below. Cash moves only after you confirm."}</DialogDescription></DialogHeader>
    <div className="grid gap-3 rounded-lg bg-muted/30 p-4 text-sm sm:grid-cols-2">{[["Fund", `${fund.docNo} · ${fund.name}`], ["Payee", target.saved.payee.name], ["Voucher", confirmation.current.docNo], ["Voucher date", target.saved.date], ["Gross", money(target.saved.totals.gross)], ["Net cash", money(target.saved.totals.netCash)], ["Cash on hand", money(fund.expectedCash)], ["Cash after", confirmation.needsApproval ? "Unchanged until approval" : money(confirmation.cashAfter)]].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>)}</div>
    <Totals value={target.saved.totals} />
    {confirmation.needsApproval && <OnboardingFeedback tone="info" title="Approval required"><p>This voucher is above the {money(fund.approvalThreshold)} approval threshold. It will be submitted for approval and cash will not be paid yet.</p></OnboardingFeedback>}
    {blocked && <OnboardingFeedback tone="warning" title="Resolve these before continuing">{review.blockers.length ? review.blockers.map(blocker => <p key={blocker}>{blocker}</p>) : <p>Save a correction draft with the changes before confirming, or close this review if nothing changed.</p>}</OnboardingFeedback>}
    {confirmation.requiresCash && <label className="flex items-start gap-2 rounded-lg border p-3 text-sm"><input type="checkbox" className="mt-1" checked={cashConfirmed} disabled={busy || blocked} onChange={event => onCashConfirmed(event.target.checked)} /><span>{delta < 0n ? `I confirm ${money(fromCents(-delta))} was returned to the cash box.` : `I confirm ${money(fromCents(delta))} was paid to the payee.`}</span></label>}
    <ErrorBox error={error} title={confirmation.needsApproval ? "Could not submit voucher for approval" : "Could not finalize voucher"} />
    {uncertain && <OnboardingFeedback tone="warning" title="Decision outcome is unconfirmed"><p>Retry the same decision to check its status safely.</p></OnboardingFeedback>}
    <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Back</Button>{uncertain ? <Button type="button" disabled={busy} onClick={onRetry}>{busy ? "Checking..." : "Retry decision"}</Button> : <Button type="button" disabled={busy || blocked || confirmation.requiresCash && !cashConfirmed} onClick={onConfirm}>{busy ? "Submitting..." : confirmation.needsApproval ? "Submit for approval" : confirmation.current.state === "UNREPLENISHED" ? "Confirm changes" : "Confirm payment"}</Button>}</div>
  </DialogContent></Dialog>;
}

function EditorForm({ initial, fund, canEdit, onClose, onBusy, operational, onFinalized, onDataChanged }: { initial: Voucher | null; fund: VoucherFund; canEdit: boolean; onClose: () => void; onBusy: (busy: boolean) => void; operational: boolean; onFinalized?: (value: VoucherOperations) => void; onDataChanged?: () => void }) {
  const [record, setRecord] = useState(initial), [date, setDate] = useState(initial?.saved.date || new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()));
  const [payee, setPayee] = useState<Choice | null>(initial ? { ...initial.saved.payee, id: initial.saved.payeeProfileId } : null), [particulars, setParticulars] = useState(initial?.saved.particulars || "");
  const [lines, setLines] = useState<EditorLine[]>(() => initial ? initial.saved.lines.map(fromLine) : [newLine()]);
  const [queued, setQueued] = useState<QueuedFile[]>([]), [fileError, setFileError] = useState<Error | null>(null), [saving, setSaving] = useState(false);
  const [discardConfirm, setDiscardConfirm] = useState(false), [viewFile, setViewFile] = useState<VoucherAttachment | null>(null), [confirmation, setConfirmation] = useState<Confirmation | null>(null), [cashConfirmed, setCashConfirmed] = useState(false);
  const command = useVoucherCommand(), decision = useFundDecision<VoucherOperations>();
  const busy = saving || command.busy || decision.busy || decision.uncertain;
  useEffect(() => onBusy(busy), [busy, onBusy]);
  const input: VoucherInput = { version: record?.version || 0, voucherId: record?.id || null, fundId: fund.id, payeeProfileId: payee?.id || null, date, particulars, lines: lines.map(({ key, documentType, receiptNo, expenseCoaId, gross, vatIncluded, vatRuleId, ewtRuleId }) => ({ key, documentType, receiptNo, expenseCoaId, gross, vatIncluded, vatRuleId, ewtRuleId })) };
  const previewReady = Boolean(payee && date && particulars.trim() && lines.some(line => line.receiptNo.trim() && line.account && Number(line.gross) > 0));
  const preview = useVoucherPreview(input, previewReady);
  const content = JSON.stringify([input.fundId, input.payeeProfileId, input.date, input.particulars, input.lines]);
  const savedContent = useRef(initial ? content : ""), saveLock = useRef(false);
  const willNeedApproval = Boolean(preview.data && voucherCents(preview.data.totals.gross) > voucherCents(fund.approvalThreshold));
  function clearFeedback() { setFileError(null); command.clearError(); decision.clearError(); }
  function changeLine(key: string, updates: Partial<EditorLine>) { setLines(current => current.map(line => line.key === key ? { ...line, ...updates } : line)); setCashConfirmed(false); clearFeedback(); }
  function queueFiles(key: string, files: FileList | null) {
    if (!files) return; const accepted: QueuedFile[] = []; const errors: string[] = [];
    for (const file of Array.from(files)) { const invalid = voucherFileError(file); if (invalid) errors.push(`${file.name}: ${invalid.message}`); else accepted.push({ key, file, requestId: onboardingRequestId() }); }
    setQueued(current => [...current, ...accepted]); setFileError(errors.length ? new Error(errors.join(" ")) : null);
  }
  async function persistDraft() {
    if (!canEdit || !preview.data || saveLock.current) return null;
    saveLock.current = true; setSaving(true); setFileError(null);
    try {
      let current = record;
      if (!current || savedContent.current !== content) {
        const result = await command.run<Voucher>(current ? `vouchers/${current.id}/draft` : "vouchers/drafts", current ? "PUT" : "POST", { ...input, previewToken: preview.data.token });
        if (!result) return null; current = result; setRecord(result); savedContent.current = content; onDataChanged?.();
      }
      for (const entry of queued.filter(file => !file.uploaded)) {
        const line = current.saved.lines.find(line => line.key === entry.key); if (!line) continue;
        const version = entry.version ?? current.version;
        setQueued(files => files.map(file => file.requestId === entry.requestId ? { ...file, version, error: undefined } : file));
        const form = new FormData(); form.append("file", entry.file); form.append("requestId", entry.requestId); form.append("version", String(version)); form.append("lineId", String(line.id));
        let failed = false;
        try { await voucherApi<VoucherAttachment>(`vouchers/${current.id}/attachments`, { method: "POST", body: form }); onDataChanged?.(); setQueued(files => files.map(file => file.requestId === entry.requestId ? { ...file, version, uploaded: true, error: undefined } : file)); }
        catch (cause) { failed = true; setQueued(files => files.map(file => file.requestId === entry.requestId ? { ...file, version, error: cause instanceof Error ? cause.message : "Upload failed. Retry this file." } : file)); }
        current = await voucherApi<Voucher>(`vouchers/${current.id}`); setRecord(current);
        if (failed) return null;
      }
      return current;
    } catch (cause) { setFileError(cause instanceof Error ? cause : new Error("The draft may be saved. Reopen it before retrying.")); return null; }
    finally { saveLock.current = false; setSaving(false); }
  }
  async function saveDraft(event: Pick<FormEvent, "preventDefault">) {
    event.preventDefault(); const current = await persistDraft(); if (current) toast.success(`${current.docNo} saved as an unpaid draft. Cash and the ledger are unchanged.`);
  }
  async function prepareFinalize(event: Pick<FormEvent, "preventDefault">) {
    event.preventDefault(); if (!operational) { await saveDraft(event); return; }
    const current = await persistDraft(); if (!current) return;
    setSaving(true);
    try {
      const review = await voucherApi<VoucherOperations>(`vouchers/${current.id}/workflow`);
      const target = review.proposed || review.effective, needsApproval = voucherCents(target.saved.totals.gross) > voucherCents(fund.approvalThreshold);
      const requiresCash = !needsApproval && voucherCents(review.cashDelta) !== 0n;
      const cashAfter = fromCents(voucherCents(fund.expectedCash) - voucherCents(review.cashDelta));
      setCashConfirmed(false); setConfirmation({ review, current, needsApproval, requiresCash, cashAfter });
    } catch (cause) { setFileError(cause instanceof Error ? cause : new Error("Unable to prepare the payment confirmation.")); }
    finally { setSaving(false); }
  }
  function finish(result: VoucherOperations) {
    if (confirmation?.needsApproval) toast.success(`${result.voucher.docNo} submitted for approval. No cash has been paid.`);
    else if (confirmation?.current.state === "UNREPLENISHED") toast.success(`${result.voucher.docNo} changes saved.`);
    else { const delta = voucherCents(confirmation?.review.cashDelta || "0.00"); toast.success(delta === 0n ? `${result.voucher.docNo} finalized. No cash movement was required.` : `${result.voucher.docNo} paid. ${money(fromCents(delta < 0n ? -delta : delta))} was ${delta < 0n ? "returned to the cash box" : "paid to the payee"}.`); }
    setConfirmation(null); if (onFinalized) onFinalized(result); else onClose();
  }
  async function confirmFinalize() {
    if (!confirmation || decision.busy) return;
    const result = await decision.run(`disbursement/vouchers/${confirmation.current.id}/finalize`, { version: confirmation.current.version, previewToken: confirmation.review.reviewToken, cashConfirmed: confirmation.requiresCash ? cashConfirmed : false });
    if (result) finish(result);
  }
  async function retryFinalize() { const result = await decision.retry(); if (result) finish(result); }
  async function removeFile(file: VoucherAttachment) {
    if (!record || busy) return; setSaving(true);
    try { const result = await command.run<VoucherAttachment>(`vouchers/${record.id}/attachments/${file.id}/remove`, "POST", { version: record.version }); if (result) { setRecord(await voucherApi<Voucher>(`vouchers/${record.id}`)); setQueued(current => current.filter(item => item.key !== record.saved.lines.find(line => line.id === file.lineId)?.key || !item.error)); onDataChanged?.(); } }
    catch (cause) { setFileError(cause instanceof Error ? cause : new Error("Unable to refresh attachments.")); }
    finally { setSaving(false); }
  }
  async function discard() {
    if (!record || busy) return; setSaving(true);
    try { const result = await command.run<Voucher>(`vouchers/${record.id}/discard`, "POST", { version: record.version }); if (result) { onDataChanged?.(); toast.success(`${record.docNo} discarded.`); onClose(); } }
    finally { setSaving(false); }
  }
  const lookup = (resource: string) => `lookups/${resource}?fundId=${fund.id}`;
  const primaryLabel = !operational ? "Save draft" : initial?.state === "UNREPLENISHED" ? "Review & save changes" : willNeedApproval ? "Submit for approval" : "Review & pay";
  return <form onSubmit={event => void (operational ? prepareFinalize(event) : saveDraft(event))} noValidate className="min-w-0 space-y-4" onChange={clearFeedback}>
    <div className="rounded-lg border p-3 text-sm"><strong>{record?.docNo || "New draft"} · {fund.docNo} · {fund.name}</strong><p className="mt-1 text-muted-foreground">Gross hard limit {money(fund.perVoucherLimit)} · Approval above {money(fund.approvalThreshold)} · Cash on hand {money(fund.expectedCash)}</p></div>
    {record && <details className="space-y-2 rounded-lg border p-3 text-sm"><summary className="cursor-pointer font-medium">Saved draft snapshot</summary><p className="mt-2">{record.saved.date} · {record.saved.payee.name} · {record.saved.particulars}</p><Totals value={record.saved.totals} /></details>}
    <fieldset disabled={busy || !canEdit} className="min-w-0 space-y-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Voucher date" id="voucher-date" type="date" value={date} onChange={setDate} required error={onboardingFieldError(preview.error || command.error, "date")} />
      <VoucherChoice label="Payee" path={lookup("payees")} selected={payee} onSelect={choice => {
        setPayee(choice); setCashConfirmed(false); clearFeedback();
        const defaultAccount = choice?.details.defaultExpenseAccount as Choice | undefined;
        setLines(current => current.map(line => ({ ...line, ...(!line.gross.trim() && defaultAccount?.eligible ? { account: defaultAccount, expenseCoaId: defaultAccount.id } : {}), ...(!choice?.details.vatRegistered || !choice?.details.tin ? { vatIncluded: false, vatRuleId: null, vatChoice: null } : {}), ...(payee?.classification !== choice?.classification ? { ewtRuleId: null, ewtChoice: null } : {}) })));
      }} disabled={busy || !canEdit} error={onboardingFieldError(preview.error || command.error, "payeeProfileId")} /><div className="space-y-2"><label htmlFor="voucher-tin" className="text-sm font-medium">Supplier TIN</label><Input id="voucher-tin" readOnly value={String(payee?.details.tin || "")} placeholder="Filled from payee" /></div><Field label="Particulars / Purpose" id="voucher-particulars" value={particulars} onChange={setParticulars} maxLength={1000} required error={onboardingFieldError(preview.error || command.error, "particulars")} /></div>
      {payee && <p className="text-xs text-muted-foreground">TIN: {String(payee.details.tin || "Not supplied")} · {String(payee.details.vatRegistered ? "VAT registered" : "Non-VAT")} · {payee.classification}. Missing TIN is not a tax exemption.</p>}
      <p className="text-xs text-muted-foreground">Cash advances, IOUs, loans, salaries/payroll and personal cheque encashment are prohibited.</p>
      <div className="space-y-3">{lines.map((line, index) => <section key={line.key} className="space-y-3 rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">Receipt / expense line {index + 1}</h3><div className="flex gap-1">{index > 0 && <Button type="button" size="sm" variant="ghost" onClick={() => setLines(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>Move up</Button>}<Button type="button" size="sm" variant="ghost" aria-label={`Remove line ${index + 1}`} disabled={lines.length === 1} onClick={() => { setLines(current => current.filter(item => item.key !== line.key)); setQueued(current => current.filter(item => item.key !== line.key)); clearFeedback(); }}>&times;</Button></div></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <NativeSelect label={`Document type, line ${index + 1}`} id={`doc-${line.key}`} value={line.documentType} onChange={documentType => changeLine(line.key, { documentType, ...(documentType !== "INVOICE" ? { vatIncluded: false, vatRuleId: null, vatChoice: null } : {}) })} error={onboardingFieldError(preview.error || command.error, `lines.${index}.documentType`)}>{Object.entries(VOUCHER_DOCUMENTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</NativeSelect>
          <Field label={`Receipt number, line ${index + 1}`} id={`receipt-${line.key}`} value={line.receiptNo} onChange={receiptNo => changeLine(line.key, { receiptNo })} maxLength={128} required error={onboardingFieldError(preview.error || command.error, `lines.${index}.receiptNo`)} />
          <VoucherChoice label={`Expense account, line ${index + 1}`} path={lookup("accounts")} selected={line.account} onSelect={account => changeLine(line.key, { account, expenseCoaId: account?.id ?? null })} disabled={busy || !canEdit} error={onboardingFieldError(preview.error || command.error, `lines.${index}.expenseCoaId`)} />
          <Field label={`Gross amount (PHP), line ${index + 1}`} id={`gross-${line.key}`} type="number" value={line.gross} onChange={gross => changeLine(line.key, { gross })} required error={onboardingFieldError(preview.error || command.error, `lines.${index}.gross`)} />
          <label className="flex items-start gap-2 text-sm"><input aria-label={`VAT included, line ${index + 1}`} type="checkbox" disabled={!payee?.details.vatRegistered || !payee?.details.tin || line.documentType !== "INVOICE"} checked={line.vatIncluded} onChange={event => changeLine(line.key, { vatIncluded: event.target.checked, ...(!event.target.checked ? { vatRuleId: null, vatChoice: null } : {}) })} />VAT included</label>
          <VoucherChoice label={`VAT rule, line ${index + 1}`} path={`${lookup("tax-rules")}&${new URLSearchParams({ profileId: String(payee?.id || ""), date, documentType: line.documentType, kind: "VAT" })}`} selected={line.vatChoice} onSelect={vatChoice => changeLine(line.key, { vatChoice, vatRuleId: vatChoice?.id ?? null })} disabled={busy || !canEdit || !line.vatIncluded || !payee || !date} error={onboardingFieldError(preview.error || command.error, `lines.${index}.vatRuleId`)} />
          <VoucherChoice label={`EWT / ATC, line ${index + 1}`} path={`${lookup("tax-rules")}&${new URLSearchParams({ profileId: String(payee?.id || ""), date, documentType: line.documentType, kind: "EWT" })}`} selected={line.ewtChoice} onSelect={ewtChoice => changeLine(line.key, { ewtChoice, ewtRuleId: ewtChoice?.id ?? null })} disabled={busy || !canEdit || !payee || !date} error={onboardingFieldError(preview.error || command.error, `lines.${index}.ewtRuleId`)} />
          <Button type="button" variant="outline" className="justify-self-start" aria-label={`Attach files, line ${index + 1}`} onClick={() => document.getElementById(`files-${line.key}`)?.click()}>Attach files</Button>
        </div>
        {preview.data?.lines[index] && <Totals value={preview.data.lines[index].amounts} />}
        <div className="space-y-2 border-t pt-3"><label htmlFor={`files-${line.key}`} className="text-sm font-medium">Supporting files, line {index + 1}</label><p className="text-xs text-muted-foreground">{VOUCHER_FILE_GUIDANCE} Files are optional and upload after the draft is saved.</p>
          <Input id={`files-${line.key}`} type="file" className="sr-only" accept={VOUCHER_FILE_ACCEPT} multiple onChange={event => { queueFiles(line.key, event.target.files); event.target.value = ""; }} />
          {queued.filter(file => file.key === line.key && !file.uploaded).map(file => <div key={file.requestId} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs"><span className="min-w-0 flex-1 break-words">{file.file.name} · {(file.file.size / 1024).toFixed(1)} KB · {file.error || "Ready to upload on Save draft"}</span><Button type="button" size="sm" variant="ghost" onClick={() => setQueued(current => current.filter(item => item.requestId !== file.requestId))}>Remove queued file</Button></div>)}
          {record?.attachments.filter(file => file.lineId === record.saved.lines.find(saved => saved.key === line.key)?.id).map(file => <div key={file.id} className="flex flex-wrap items-center gap-2 rounded border p-2 text-xs"><span className="min-w-0 flex-1 break-words">{file.filename} · {(file.fileSize / 1024).toFixed(1)} KB · {file.state === "READY" ? "Ready" : "Upload incomplete — retry the queued file or remove"}</span>{file.state === "READY" && <><Button type="button" size="sm" variant="outline" onClick={() => setViewFile(file)}>Preview</Button><Button type="button" size="sm" variant="outline" asChild><a href={`${VOUCHER_API}/vouchers/${record.id}/attachments/${file.id}`}>Download</a></Button></>}<Button type="button" size="sm" variant="ghost" onClick={() => void removeFile(file)}>Remove file</Button></div>)}
        </div>
      </section>)}</div>
      <Button type="button" variant="outline" onClick={() => { setLines(current => [...current, newLine()]); clearFeedback(); }}>Add receipt / expense line</Button>
    </fieldset>
    {!previewReady && <OnboardingFeedback tone="info" title="Complete the voucher details"><p>Select a payee and complete the first receipt line to calculate the voucher.</p></OnboardingFeedback>}
    {preview.loading && <TotalsSkeleton label="Calculating voucher preview" />}<ErrorBox error={preview.error} retry={preview.refresh} title="Voucher calculation needs attention" />
    <ErrorBox error={command.error} title="Could not save voucher draft" /><ErrorBox error={fileError} title="Supporting file action failed" />
    {operational && <p className="text-sm text-muted-foreground">Saving a draft does not move cash. Payments at or below {money(fund.approvalThreshold)} require confirmation; higher amounts are submitted for approval. No journal posts until replenishment.</p>}
    {decision.uncertain && !confirmation && <OnboardingFeedback tone="warning" title="Payment outcome is unconfirmed"><p>Retry the same action to check its status safely.</p></OnboardingFeedback>}
    <div className="sticky bottom-0 z-10 -mx-2 space-y-3 border-t bg-background/95 p-3 backdrop-blur sm:-mx-6 sm:px-6">{preview.data && <Totals value={preview.data.totals} />}<div className="flex flex-wrap items-center justify-end gap-2">{record?.state === "DRAFT" && canEdit && <Button type="button" variant="outline" disabled={busy} onClick={() => setDiscardConfirm(value => !value)}>Discard draft</Button>}<Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button>{operational && canEdit && <Button type="button" variant="outline" disabled={busy || !preview.data} onClick={event => void saveDraft(event)}>Save draft</Button>}{canEdit && <Button type="submit" disabled={busy || !preview.data}>{busy ? "Saving..." : queued.some(file => file.error && !file.uploaded) ? "Save draft / retry files" : primaryLabel}</Button>}</div></div>
    {discardConfirm && <div role="alert" className="space-y-2 rounded-lg border p-3 text-sm"><p>Discard this unpaid draft and release its receipt reservations? Its audit history will be retained.</p><Button type="button" variant="destructive" disabled={busy} onClick={() => void discard()}>Confirm discard</Button></div>}
    {confirmation && <VoucherConfirmation confirmation={confirmation} fund={fund} busy={busy} cashConfirmed={cashConfirmed} onCashConfirmed={setCashConfirmed} onConfirm={() => void confirmFinalize()} onClose={() => { if (!busy) { setConfirmation(null); setCashConfirmed(false); } }} onRetry={() => void retryFinalize()} uncertain={decision.uncertain} error={decision.error} />}
    {viewFile && record && <Dialog open onOpenChange={open => { if (!open) setViewFile(null); }}><DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] overflow-auto sm:max-w-4xl"><DialogHeader><DialogTitle>{viewFile.filename}</DialogTitle><DialogDescription>Authenticated supporting file preview.</DialogDescription></DialogHeader>
      {viewFile.mimeType === "application/pdf" ? typeof navigator !== "undefined" && navigator.pdfViewerEnabled ? <iframe title={viewFile.filename} className="h-[65dvh] w-full" src={`${VOUCHER_API}/vouchers/${record.id}/attachments/${viewFile.id}?view=preview`} /> : <p role="status" className="rounded-lg border p-4 text-sm">This browser cannot display PDF previews. Download the file to view it.</p>
        // eslint-disable-next-line @next/next/no-img-element
        : <img alt={viewFile.filename} className="max-h-[65dvh] w-full object-contain" src={`${VOUCHER_API}/vouchers/${record.id}/attachments/${viewFile.id}?view=preview`} />}
      <Button type="button" variant="outline" asChild><a href={`${VOUCHER_API}/vouchers/${record.id}/attachments/${viewFile.id}`}>Download file if preview is unavailable</a></Button><Button type="button" variant="outline" onClick={() => setViewFile(null)}>Close preview</Button>
    </DialogContent></Dialog>}
  </form>;
}
