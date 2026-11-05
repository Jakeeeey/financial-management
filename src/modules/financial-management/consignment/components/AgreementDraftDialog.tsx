"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AgreementConsigneeSelect } from "./AgreementConsigneeSelect";
import { AgreementApiError, getAgreement, saveAgreement } from "../providers/agreements.api";
import { agreementChoices, agreementNumbers, emptyAgreementTerms, manilaToday } from "../utils/agreement-fields";
import type { AgreementConsignee, AgreementDetail, AgreementDraft } from "../agreement-types";

function initial(detail: AgreementDetail | null): AgreementDraft {
  return { requestId: crypto.randomUUID(), version: detail?.version ?? null, consigneeId: detail?.consignee.id ?? "",
    startDate: detail?.summary.startDate ?? manilaToday(), endDate: detail?.summary.endDate ?? "", terms: detail?.terms ?? emptyAgreementTerms() };
}

export function AgreementDraftDialog({ detail, onClose, onSaved, returnFocus }: {
  detail: AgreementDetail | null; onClose: () => void; onSaved: (detail: AgreementDetail) => void; returnFocus: () => void;
}) {
  const [draft, setDraft] = useState(() => initial(detail));
  const [consignee, setConsignee] = useState<AgreementConsignee | null>(detail?.consignee ?? null);
  const [pendingChoice, setPendingChoice] = useState<AgreementConsignee | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<AgreementApiError | null>(null);
  const [retryPayload, setRetryPayload] = useState<AgreementDraft | null>(null);
  const [discard, setDiscard] = useState(false);
  const [reload, setReload] = useState(false);
  const baseline = useRef(JSON.stringify(draft));
  const errorSummary = useRef<HTMLDivElement>(null);
  const openingPreview = useRef(false);
  const dirty = baseline.current !== JSON.stringify(draft);
  const uncertain = retryPayload !== null;
  const errors = failure?.fields ?? {};
  const highCommission = draft.terms.commissionRate !== null && draft.terms.commissionRate > 35 && draft.terms.commissionRate <= 60;
  const denied = failure?.status === 401 || failure?.status === 403;
  const conflict = detail !== null && failure?.status === 409;
  const close = () => { if (busy) return; if (dirty || uncertain) setDiscard(true); else onClose(); };
  useEffect(() => {
    if (!dirty && !uncertain) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, uncertain]);

  function change(next: AgreementDraft, fields: string[]) {
    setDraft(next);
    setFailure(current => {
      if (current?.status !== 400) return current;
      const remaining = Object.fromEntries(Object.entries(current.fields).filter(([key]) => !fields.includes(key)));
      return Object.keys(remaining).length ? new AgreementApiError(current.message, current.status, remaining) : null;
    });
  }
  function select(choice: AgreementConsignee, replaceTerms: boolean) {
    setConsignee(choice);
    change({ ...draft, consigneeId: choice.id, terms: replaceTerms ? { ...choice.defaults } : draft.terms },
      ["consigneeId", ...(replaceTerms ? Object.entries(choice.defaults).filter(([, value]) => value !== null).map(([key]) => `terms.${key}`) : [])]);
    setPendingChoice(null);
    requestAnimationFrame(() => document.getElementById("agreement-consigneeId")?.focus());
  }
  function choose(choice: AgreementConsignee) {
    if (choice.id === consignee?.id) return;
    if (Object.values(draft.terms).some(value => value !== null && value !== "")) setPendingChoice(choice);
    else select(choice, true);
  }
  function fieldError(key: string) { return errors[key] ? <p id={`agreement-${key}-error`} className="mt-1 text-sm text-destructive">{errors[key]}</p> : null; }
  const a11y = (key: string) => ({ id: `agreement-${key}`, "aria-required": true, "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `agreement-${key}-error` : undefined });
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || pendingChoice || denied || conflict) return;
    const payload = retryPayload ?? draft;
    const fields: Record<string, string> = {};
    if (!payload.consigneeId || consignee?.status !== "ACTIVE") fields.consigneeId = "Choose an existing Active consignee.";
    if (!payload.startDate) fields.startDate = "Enter the agreement start date.";
    if (!payload.endDate) fields.endDate = "Enter the agreement end date.";
    if (payload.startDate && payload.endDate && payload.endDate <= payload.startDate) fields.endDate = "The end date must be after the start date.";
    for (const [key, label] of agreementNumbers) {
      const value = payload.terms[key];
      if (value === null || !Number.isFinite(value)) fields[`terms.${key}`] = `Enter ${label.toLowerCase()}.`;
      else if (key === "paymentTermsDays" && !Number.isInteger(value)) fields[`terms.${key}`] = "Use whole payment-term days.";
      else if (key === "paymentTermsDays" && (value < 0 || value > 120)) fields[`terms.${key}`] = "Payment terms must be between 0 and 120 days.";
      else if (key === "commissionRate" && (value <= 0 || value > 60)) fields[`terms.${key}`] = "Commission must be greater than 0% and at most 60%.";
      else if (key === "exposureLimit" && value <= 0) fields[`terms.${key}`] = "Exposure limit must be greater than zero.";
      else if (key === "ewtRate" && (value < 0 || value > 25)) fields[`terms.${key}`] = "EWT rate must be between 0% and 25%.";
      else if (key === "priceTolerance" && (value < 0 || value > 50)) fields[`terms.${key}`] = "Price tolerance must be between 0% and 50%.";
    }
    for (const [key, label] of agreementChoices) if (!payload.terms[key]) fields[`terms.${key}`] = `Choose ${label.toLowerCase()}.`;
    if (Object.keys(fields).length) {
      setFailure(new AgreementApiError("Complete all required draft fields.", 400, fields));
      requestAnimationFrame(() => errorSummary.current?.focus());
      return;
    }
    try {
      setBusy(true); setFailure(null);
      const saved = await saveAgreement(detail?.summary.id ?? null, payload);
      setRetryPayload(null);
      toast.success(`${saved.summary.reference} saved as Draft.`);
      for (const warning of saved.warnings ?? []) toast.warning(warning);
      openingPreview.current = true;
      onSaved(saved);
    } catch (error) {
      const cause = error instanceof AgreementApiError ? error : new AgreementApiError("The save result is unknown. Check the saved record before making another request.", 0);
      setFailure(cause);
      if (cause.status === 0 || cause.status >= 500) setRetryPayload(payload);
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally { setBusy(false); }
  }
  async function reopen() {
    if (!detail || busy) return;
    try {
      setBusy(true);
      const saved = await getAgreement(detail.summary.id, new AbortController().signal);
      openingPreview.current = true;
      onSaved(saved);
    } catch (error) { setFailure(error instanceof AgreementApiError ? error : new AgreementApiError("Unable to reload the saved agreement.", 0)); }
    finally { setBusy(false); }
  }

  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl" onCloseAutoFocus={event => { event.preventDefault(); if (!openingPreview.current) returnFocus(); }} onEscapeKeyDown={event => { if (busy || dirty || uncertain) { event.preventDefault(); close(); } }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
      <DialogHeader className="shrink-0 pr-6"><DialogTitle>{detail ? `Edit ${detail.summary.reference || "agreement draft"}` : "New agreement draft"}</DialogTitle>
        <DialogDescription>All fields are required to save. Drafts are not approved agreements and cannot be used for transactions.</DialogDescription></DialogHeader>
      <form id="agreement-draft-form" noValidate onSubmit={event => void submit(event)} className="min-h-0 space-y-5 overflow-y-auto pr-2">
        {failure && <div ref={errorSummary} tabIndex={-1} role="alert" className="space-y-2 rounded-md border border-destructive/40 p-3 text-sm">
          <p>{failure.message}</p>{Object.entries(errors).map(([key, message]) => <p key={key}><button type="button" className="text-left underline" onClick={() => document.getElementById(`agreement-${key}`)?.focus()}>{message}</button></p>)}
          {detail && <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => setReload(true)}>Reload saved agreement</Button>}
        </div>}
        <fieldset disabled={busy || uncertain || denied || conflict} className="min-w-0 space-y-5">
          <section className="space-y-3">
            <label htmlFor="agreement-consigneeId" className="block text-sm font-medium">Active consignee <span aria-hidden="true">*</span></label>
            <AgreementConsigneeSelect selected={consignee} onSelect={choose} disabled={busy || uncertain || denied || conflict} invalid={!!errors.consigneeId} />{fieldError("consigneeId")}
            {consignee && <p className="text-sm text-muted-foreground">{consignee.code} · VAT treatment: {consignee.vatTreatment === "NON_VAT" ? "Non-VAT" : consignee.vatTreatment === "VAT" ? "VAT-registered" : "Not recorded"}. Available consignee defaults are copied on initial selection; agreement terms are saved independently.</p>}
            {pendingChoice && <div role="alert" className="space-y-2 rounded-md border p-3 text-sm"><p>Change to {pendingChoice.name}? Choose whether to keep entered terms or replace them with this consignee’s defaults.</p><div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => select(pendingChoice, false)}>Keep entered terms</Button><Button type="button" onClick={() => select(pendingChoice, true)}>Use consignee defaults</Button><Button type="button" variant="ghost" onClick={() => setPendingChoice(null)}>Keep current consignee</Button>
            </div></div>}
          </section>
          <section className="grid gap-4 sm:grid-cols-2" aria-label="Agreement dates and commercial terms">
            {(["startDate", "endDate"] as const).map(key => <div key={key}><label htmlFor={`agreement-${key}`} className="mb-1 block text-sm font-medium">{key === "startDate" ? "Agreement starts" : "Agreement ends"} <span aria-hidden="true">*</span></label>
              <Input {...a11y(key)} type="date" min="1000-01-01" max="9999-12-31" value={draft[key]} onChange={event => change({ ...draft, [key]: event.target.value }, [key])} />{fieldError(key)}</div>)}
            {agreementNumbers.map(([key, label]) => <div key={key}><label htmlFor={`agreement-terms.${key}`} className="mb-1 block text-sm font-medium">{label} <span aria-hidden="true">*</span></label>
              <Input {...a11y(`terms.${key}`)} type="number" step={key === "paymentTermsDays" ? "1" : "0.000001"} value={draft.terms[key] ?? ""} onChange={event => change({ ...draft, terms: { ...draft.terms, [key]: event.target.value === "" ? null : Number(event.target.value) } }, [`terms.${key}`])} />{fieldError(`terms.${key}`)}</div>)}
            {agreementChoices.map(([key, label, options]) => <div key={key}><label htmlFor={`agreement-terms.${key}`} className="mb-1 block text-sm font-medium">{label} <span aria-hidden="true">*</span></label>
              <select {...a11y(`terms.${key}`)} value={draft.terms[key] ?? ""} onChange={event => change({ ...draft, terms: { ...draft.terms, [key]: event.target.value || null } }, [`terms.${key}`])} className="h-10 w-full rounded-md border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring">
                <option value="">Choose an option</option>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
              </select>{fieldError(`terms.${key}`)}</div>)}
          </section>
        </fieldset>
      </form>
      {uncertain && <p role="status" className="text-sm text-muted-foreground">The save may already have persisted. Retry sends the identical request; entered values are retained.</p>}
      {reload && <div role="alert" className="space-y-2 rounded border p-3 text-sm"><p>Reopen the saved agreement and discard these entered values?</p><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => setReload(false)}>Keep editing</Button><Button disabled={busy} onClick={() => void reopen()}>Reopen saved record</Button></div></div>}
      {highCommission && <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Commission exceeds 35%. This is allowed, but confirm the commercial term before approval.</p>}
      {discard && <div role="alert" className="space-y-2 rounded border p-3 text-sm"><p>Discard unsaved changes? An unconfirmed save may already have persisted.</p><div className="flex gap-2"><Button variant="outline" onClick={() => setDiscard(false)}>Keep editing</Button><Button variant="destructive" onClick={onClose}>Discard and close</Button></div></div>}
      <DialogFooter className="shrink-0 border-t pt-4"><Button variant="outline" disabled={busy} onClick={close}>Cancel</Button><Button type="submit" form="agreement-draft-form" disabled={busy || denied || conflict || pendingChoice !== null || (!!detail && !dirty && !uncertain)}>{busy ? "Saving…" : uncertain ? "Retry save" : "Save draft"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
