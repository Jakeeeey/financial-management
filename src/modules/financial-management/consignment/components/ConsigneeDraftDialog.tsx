"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConsigneeSaveError, getConsignee, saveConsignee } from "../providers/consignees.api";
import type { ConsigneeDetail, ConsigneeDraft, ConsignmentWorkspace } from "../types";

const identity = [
  ["legalName", "Registered business name", 200], ["tradeName", "Trade name", 160], ["tin", "TIN", 32],
  ["contactPerson", "Contact person", 160], ["email", "Email", 254], ["phone", "Phone", 40],
  ["addressLine", "Business address", 255], ["city", "City / municipality", 100], ["province", "Province", 100], ["postalCode", "Postal code", 20],
] as const;
const numbers = [
  ["commissionRate", "Commission (%)", 60], ["paymentTermsDays", "Payment terms (days)", 120],
  ["exposureLimit", "Exposure limit (PHP)", 99999999999999], ["ewtRate", "EWT (%)", 25], ["priceTolerance", "Price tolerance (%)", 50],
] as const;
const choices = [
  ["settlementFrequency", "Collection cycle", [["WEEKLY", "Weekly"], ["SEMI_MONTHLY", "Twice a month"], ["MONTHLY", "Monthly"]]],
  ["salesReportFrequency", "Sales report frequency", [["WEEKLY", "Weekly"], ["BIWEEKLY", "Every two weeks"], ["MONTHLY", "Monthly"]]],
  ["shrinkageResponsibility", "Shrinkage responsibility", [["CONSIGNEE", "Consignee"], ["COMPANY", "Our company"]]],
  ["listingFeeSettlement", "Listing-fee settlement", [["OFFSET", "Deducted from collections"], ["CASH", "Paid in cash"]]],
] as const;

function initial(detail: ConsigneeDetail | null): ConsigneeDraft {
  return {
    requestId: crypto.randomUUID(), version: detail?.version ?? null,
    legalName: detail?.legalName ?? "", tradeName: detail?.tradeName ?? "", tin: detail?.tin ?? "",
    vatTreatment: detail?.summary.vatTreatment ?? "", contactPerson: detail?.summary.contactPerson ?? "",
    email: detail?.summary.email ?? "", phone: detail?.summary.phone ?? "",
    addressLine: detail?.addressLine ?? "", city: detail?.city ?? "", province: detail?.province ?? "", postalCode: detail?.postalCode ?? "",
    defaults: detail?.defaults ?? { commissionRate: null, paymentTermsDays: null, settlementFrequency: null,
      salesReportFrequency: null, exposureLimit: null, shrinkageResponsibility: null, ewtRate: null, priceTolerance: null, listingFeeSettlement: null },
  };
}

export function ConsigneeDraftDialog({ detail, onClose, onSaved, returnFocus, workspace = "consignees" }: {
  workspace?: ConsignmentWorkspace; detail: ConsigneeDetail | null; onClose: () => void; onSaved: (detail: ConsigneeDetail) => void; returnFocus: () => void;
}) {
  const [draft, setDraft] = useState(() => initial(detail));
  const baseline = useRef(JSON.stringify(draft));
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<ConsigneeSaveError | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [retryPayload, setRetryPayload] = useState<ConsigneeDraft | null>(null);
  const [discard, setDiscard] = useState(false);
  const errorSummary = useRef<HTMLDivElement>(null);
  const dirty = baseline.current !== JSON.stringify(draft);
  const errors = failure?.fields ?? {};
  function close() { if (busy) return; if (dirty || uncertain) setDiscard(true); else onClose(); }
  function fieldError(key: string) { return errors[key] ? <p id={`draft-${key}-error`} className="mt-1 text-sm text-destructive">{errors[key]}</p> : null; }
  const a11y = (key: string) => ({ id: `draft-${key}`, "aria-invalid": !!errors[key], "aria-describedby": errors[key] ? `draft-${key}-error` : undefined });
  async function save() {
    if (busy) return;
    setFailure(null);
    if (!draft.legalName.trim()) {
      setFailure(new ConsigneeSaveError("Check the highlighted fields.", 400, { legalName: "Enter the registered business name." }));
      requestAnimationFrame(() => errorSummary.current?.focus()); return;
    }
    setBusy(true);
    const submitted = retryPayload ?? draft;
    try { onSaved(await saveConsignee(detail?.summary.id ?? null, submitted, workspace)); }
    catch (cause) {
      const error = cause instanceof ConsigneeSaveError ? cause : new ConsigneeSaveError("Unable to confirm the save. Retry the same request before making further changes.", 0);
      setFailure(error);
      if (!detail && (error.status === 0 || error.status >= 500)) { setUncertain(true); setRetryPayload(submitted); }
      requestAnimationFrame(() => errorSummary.current?.focus());
    } finally { setBusy(false); }
  }
  async function reload() {
    if (!detail || !window.confirm("Reload the saved draft? Your unsaved changes will be discarded.")) return;
    setBusy(true);
    try {
      const loaded = await getConsignee(detail.summary.id, new AbortController().signal, workspace);
      if (!loaded.editable) { setFailure(new ConsigneeSaveError("This record is no longer editable. Close to inspect it.", 403)); return; }
      const next = initial(loaded); setDraft(next); baseline.current = JSON.stringify(next); setFailure(null);
    } catch (cause) { setFailure(new ConsigneeSaveError(cause instanceof Error ? cause.message : "Reload failed.", 0)); }
    finally { setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open) close(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl" onCloseAutoFocus={event => { event.preventDefault(); returnFocus(); }} onEscapeKeyDown={event => { event.preventDefault(); close(); }} onInteractOutside={event => event.preventDefault()}>
      <DialogHeader className="pr-6"><DialogTitle>{detail ? `Edit draft ${detail.summary.code}` : "New consignee draft"}</DialogTitle>
        <DialogDescription>Only registered business name is required to save a draft. Other supplied values must be valid. Saving does not submit or approve this consignee.</DialogDescription></DialogHeader>
      <form id="consignee-draft-form" className="min-h-0 space-y-5 overflow-y-auto pr-2" noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
        {failure && <div ref={errorSummary} tabIndex={-1} role="alert" className="space-y-2 rounded border border-destructive p-3 focus-visible:outline-2"><p>{failure.message}</p>
          {Object.entries(errors).map(([key, message]) => <a key={key} className="block text-sm underline" href={`#draft-${key}`}>{message}</a>)}
          {failure.status === 409 && detail && <Button type="button" variant="outline" onClick={() => void reload()} disabled={busy}>Reload saved draft</Button>}
        </div>}
        <fieldset disabled={busy || uncertain || failure?.status === 403 || failure?.status === 401} className="space-y-5 disabled:opacity-70">
          <section className="space-y-3"><h3 className="font-semibold">Business identity, contact and address</h3>
            <div className="grid gap-4 sm:grid-cols-2">{identity.map(([key, label, max]) => <div key={key} className="min-w-0">
              <label htmlFor={`draft-${key}`} className="mb-1 block text-sm font-medium">{label}{key === "legalName" ? " (required)" : ""}</label>
              <Input {...a11y(key)} maxLength={max} required={key === "legalName"} type={key === "email" ? "email" : "text"} value={draft[key]} onChange={event => setDraft({ ...draft, [key]: event.target.value })} />{fieldError(key)}
            </div>)}
            <div><label htmlFor="draft-vatTreatment" className="mb-1 block text-sm font-medium">VAT treatment</label>
              <select {...a11y("vatTreatment")} className="h-10 w-full rounded-md border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring" value={draft.vatTreatment} onChange={event => setDraft({ ...draft, vatTreatment: event.target.value })}>
                <option value="">Not specified</option><option value="VAT">VAT-registered</option><option value="NON_VAT">Non-VAT</option>
              </select>{fieldError("vatTreatment")}</div>
            </div><p className="text-sm text-muted-foreground">TIN: 9 or 12 digits; spaces and hyphens are accepted. Phone: 10?13 digits.</p>
          </section>
          <details className="rounded-lg border p-3" open={Object.keys(errors).some(key => key.startsWith("defaults.")) || undefined}>
            <summary className="cursor-pointer font-medium focus-visible:outline-2">Optional default terms</summary>
            <p className="my-3 text-sm text-muted-foreground">These are draft defaults, not approved accounting or tax settings. Leave unknown values blank.</p>
            <div className="grid gap-4 sm:grid-cols-2">{numbers.map(([key, label, max]) => <div key={key}>
              <label htmlFor={`draft-defaults.${key}`} className="mb-1 block text-sm font-medium">{label}</label>
              <Input {...a11y(`defaults.${key}`)} type="number" min={key === "commissionRate" || key === "exposureLimit" ? 0.000001 : 0} max={max} step={key === "paymentTermsDays" ? 1 : "0.000001"} value={draft.defaults[key] ?? ""}
                onChange={event => setDraft({ ...draft, defaults: { ...draft.defaults, [key]: event.target.value === "" ? null : Number(event.target.value) } })} />{fieldError(`defaults.${key}`)}
            </div>)}{choices.map(([key, label, options]) => <div key={key}>
              <label htmlFor={`draft-defaults.${key}`} className="mb-1 block text-sm font-medium">{label}</label>
              <select {...a11y(`defaults.${key}`)} className="h-10 w-full rounded-md border bg-background px-3 focus-visible:outline-2 focus-visible:outline-ring" value={draft.defaults[key] ?? ""} onChange={event => setDraft({ ...draft, defaults: { ...draft.defaults, [key]: event.target.value || null } })}>
                <option value="">Not specified</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
              </select>{fieldError(`defaults.${key}`)}</div>)}</div>
          </details>
        </fieldset>
      </form>
      {discard && <div role="alert" className="space-y-2 rounded border p-3"><p>Discard unsaved changes? A save whose result is unknown may already have persisted.</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setDiscard(false)}>Keep editing</Button><Button variant="destructive" onClick={onClose}>Discard and close</Button></div></div>}
      <p role="status" className="text-sm text-muted-foreground">{busy ? "Saving or reloading draft. Please wait." : uncertain ? "Save result is unknown. Retry sends the identical creation request." : ""}</p>
      <DialogFooter className="shrink-0 border-t pt-4"><Button variant="outline" disabled={busy} onClick={close}>Cancel</Button>
        <Button form="consignee-draft-form" type="submit" disabled={busy || failure?.status === 401 || failure?.status === 403 || (failure?.status === 409 && !!detail)}>{busy ? "Please wait?" : uncertain ? "Retry save" : "Save draft"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
