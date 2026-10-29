"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  approveAgreement,
  closeAgreement,
  getAgreement,
  getAgreementClosureReadiness,
  rejectAgreement,
  submitAgreement,
} from "../providers/agreements.api";
import { agreementChoices, agreementDate, agreementNumbers } from "../utils/agreement-fields";
import { ConsignmentStatusBadge } from "./ConsignmentStatusBadge";
import { manilaTime } from "./ConsigneeViewDialog";
import type { AgreementClosureReadiness, AgreementDetail } from "../agreement-types";

type Intent = "submit" | "approve" | "reject" | "close" | null;

export function AgreementViewDialog({ id, onClose, onEdit, onChanged, returnFocus }: {
  id: string; onClose: () => void; onEdit: (detail: AgreementDetail) => void;
  onChanged?: (detail: AgreementDetail) => void; returnFocus: () => void;
}) {
  const [result, setResult] = useState<{ detail: AgreementDetail | null; error: string | null; attempt: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [intent, setIntent] = useState<Intent>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<AgreementClosureReadiness | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const startingEdit = useRef(false);
  const loading = result?.attempt !== attempt;
  const detail = result?.attempt === attempt ? result.detail : null;
  const error = result?.attempt === attempt ? result.error : null;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getAgreement(id, controller.signal).then(detail => { if (active) setResult({ detail, error: null, attempt }); })
      .catch(error => { if (active) setResult({ detail: null, error: error instanceof Error ? error.message : "Unable to load this agreement.", attempt }); });
    return () => { active = false; controller.abort(); };
  }, [id, attempt]);

  function requestAction(next: Exclude<Intent, null>) {
    setActionError(null);
    setReason("");
    setReadiness(null);
    setIntent(next);
    if (next !== "close") return;
    setReadinessLoading(true);
    getAgreementClosureReadiness(id).then(setReadiness)
      .catch(cause => setActionError(cause instanceof Error ? cause.message : "Unable to check closure dependencies."))
      .finally(() => setReadinessLoading(false));
  }

  async function confirmAction() {
    if (!detail || !intent || busy) return;
    if ((intent === "reject" || intent === "close") && !reason.trim()) return;
    if (intent === "close" && (!readiness?.canClose || readinessLoading)) return;
    setBusy(true);
    setActionError(null);
    try {
      const next = intent === "submit"
        ? await submitAgreement(detail.summary.id, detail.version)
        : intent === "approve"
          ? await approveAgreement(detail.summary.id, detail.version)
          : intent === "reject"
            ? await rejectAgreement(detail.summary.id, detail.version, reason.trim())
            : await closeAgreement(detail.summary.id, detail.version, reason.trim());
      setResult({ detail: next, error: null, attempt });
      setIntent(null);
      setReason("");
      toast.success(
        intent === "submit" ? `${next.summary.reference || "Agreement"} submitted for review.`
          : intent === "approve" ? `${next.summary.reference || "Agreement"} approved and is now Active.`
            : intent === "reject" ? `${next.summary.reference || "Agreement"} rejected.`
              : `${next.summary.reference || "Agreement"} closed.`,
      );
      onChanged?.(next);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Unable to complete this agreement action.";
      setActionError(message);
      toast.error("Agreement action failed", { description: message });
    } finally {
      setBusy(false);
    }
  }

  const confirmLabel = intent === "submit" ? "Confirm submission" : intent === "approve" ? "Confirm approval" : intent === "reject" ? "Confirm rejection" : "Confirm closure";
  const confirmDisabled = busy || (intent === "reject" && (!reason.trim() || reason.length > 1000)) || (intent === "close" && (readinessLoading || !readiness?.canClose || !reason.trim() || reason.length > 1000));

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl" onCloseAutoFocus={event => { event.preventDefault(); if (!startingEdit.current) returnFocus(); }} onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader className="shrink-0 pr-6"><DialogTitle className="flex flex-wrap items-center gap-2">{detail?.summary.reference || "Agreement details"}{detail && <ConsignmentStatusBadge status={detail.summary.status} />}</DialogTitle><DialogDescription>Saved agreement terms, workflow history, and ownership.</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-5 overflow-y-auto pr-2" aria-busy={loading || busy}>
        {loading && <p role="status">Loading agreement details…</p>}
        {error && <div role="alert" className="space-y-2 rounded border p-3"><p>{error}</p><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry details</Button></div>}
        {detail && <>
          {detail.warnings.length > 0 && <div role="status" className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 size-4 shrink-0" /><div>{detail.warnings.map(warning => <p key={warning}>{warning}</p>)}</div></div>}
          <dl className="grid gap-4 text-sm sm:grid-cols-2">{[
            ["Consignee", `${detail.consignee.name} (${detail.consignee.code})`], ["Status", <ConsignmentStatusBadge key="status" status={detail.summary.status} />],
            ["Agreement starts", agreementDate(detail.summary.startDate)], ["Agreement ends", agreementDate(detail.summary.endDate)],
            ["VAT treatment", detail.vatTreatment === "NON_VAT" ? "Non-VAT" : detail.vatTreatment === "VAT" ? "VAT-registered" : "Not recorded"],
            ["Created by", detail.summary.createdBy || "Not recorded"], ["Created", manilaTime(detail.createdAt)], ["Updated", manilaTime(detail.updatedAt)],
            ...agreementNumbers.map(([key, label]) => [label, detail.terms[key] === null ? "Not recorded" : key === "exposureLimit" ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(detail.terms[key]!) : String(detail.terms[key])]),
            ...agreementChoices.map(([key, label, options]) => [label, options.find(([value]) => value === detail.terms[key])?.[1] || detail.terms[key] || "Not recorded"]),
          ].map(([label, value]) => <div key={String(label)} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl>
          <section className="space-y-2 border-t pt-4 text-sm">
            <h3 className="font-semibold">Workflow history</h3>
            <p>Submitted: {detail.submittedBy ? `${detail.submittedBy} · ${manilaTime(detail.submittedAt)}` : "Not submitted"}</p>
            <p>Reviewed: {detail.reviewedBy ? `${detail.reviewedBy} · ${manilaTime(detail.reviewedAt)}` : "Not reviewed"}</p>
            <p>Closed: {detail.closedBy ? `${detail.closedBy} · ${manilaTime(detail.closedAt)}` : "Not closed"}</p>
            {detail.closureReason && <p className="rounded bg-muted p-2 text-muted-foreground">Closure reason: {detail.closureReason}</p>}
            {detail.rejectionReason && <p className="rounded border border-rose-200 bg-rose-50 p-2 text-rose-800">Rejection reason: {detail.rejectionReason}</p>}
            {detail.reviewRestriction && <p className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">{detail.reviewRestriction}</p>}
            {!detail.editable && detail.summary.status !== "ACTIVE" && <p className="text-muted-foreground">This record is read-only unless the action below applies.</p>}
          </section>
          {intent && <section className="space-y-3 rounded-lg border p-3 text-sm">
            <p>{intent === "submit" ? "Submit this agreement for independent review? Its fields will lock." : intent === "approve" ? "Approve this agreement? It will become Active and eligible for transactions." : intent === "reject" ? "Reject this agreement? The reason will remain in history and a replacement agreement may be created." : "Close this agreement? Closure requires all dependencies to be cleared."}</p>
            {intent === "close" && readinessLoading && <p role="status">Checking closure dependencies…</p>}
            {intent === "close" && readiness && <>
              {readiness.canClose ? <p className="font-medium text-emerald-700">Closure dependencies are clear.</p> : <div className="space-y-1"><p className="font-medium text-destructive">Closure is blocked:</p>{readiness.blockers.map(blocker => <p key={blocker.code} className="text-destructive">{blocker.message}</p>)}</div>}
            </>}
            {(intent === "reject" || intent === "close") && <div>
              <label htmlFor="agreement-action-reason" className="mb-1 block font-medium">{intent === "reject" ? "Rejection reason *" : "Closure reason *"}</label>
              <textarea id="agreement-action-reason" maxLength={1000} rows={3} value={reason} disabled={busy} onChange={event => setReason(event.target.value)} className="w-full rounded-md border bg-background p-2 text-sm focus-visible:outline-2" />
              <p className="text-xs text-muted-foreground">{reason.length}/1,000</p>
            </div>}
            {actionError && <p role="alert" className="text-destructive">{actionError}</p>}
          </section>}
        </>}
      </div>
      <DialogFooter className="shrink-0 flex-wrap border-t pt-4">
        {intent ? <>
          <Button variant="outline" disabled={busy} onClick={() => { setIntent(null); setReason(""); setReadiness(null); setActionError(null); }}>Cancel action</Button>
          <Button disabled={confirmDisabled} onClick={() => void confirmAction()}>{busy ? "Working…" : confirmLabel}</Button>
        </> : <>
          {detail?.editable && <Button variant="outline" onClick={() => { startingEdit.current = true; onEdit(detail); }}>Edit draft</Button>}
          {detail?.canSubmit && <Button className="bg-green-700 text-white hover:bg-green-800" onClick={() => requestAction("submit")}>Submit for review</Button>}
          {detail?.canReview && <>
            <Button className="bg-green-700 text-white hover:bg-green-800" onClick={() => requestAction("approve")}>Approve agreement</Button>
            <Button variant="destructive" onClick={() => requestAction("reject")}>Reject</Button>
          </>}
          {detail?.canClose && <Button variant="outline" onClick={() => requestAction("close")}>Close agreement</Button>}
          <Button variant="outline" disabled={busy} onClick={onClose}>Close</Button>
        </>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
