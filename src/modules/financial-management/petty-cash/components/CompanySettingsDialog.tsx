"use client";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Settings } from "../onboarding-types";
import { useOnboardingCommand, useOnboardingRead } from "../hooks/useOnboarding";
import { OnboardingError } from "../providers/onboarding.api";
import { OnboardingChoice } from "./OnboardingChoice";
import { ErrorBox, Field, OnboardingFeedback } from "./OnboardingCommon";
import { DetailsSkeleton } from "./PettyCashSkeletons";
import { onboardingFieldError, onboardingFieldErrors } from "../utils/onboardingFeedback";

const companyFieldIds: Record<string, string> = {
  registeredName: "company-name", tin: "company-tin", address: "company-address", postalCode: "company-zip",
  companyId: "company-company", signatoryUserId: "company-signatory", signatoryTitle: "company-signatory-title", signatoryTin: "company-signatory-tin",
};

export function CompanySettingsDialog({ onClose }: { onClose: () => void }) {
  const read = useOnboardingRead<Settings>("settings"), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false);
  const data = read.data;
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Company details</DialogTitle><DialogDescription>These details print on every Petty Cash document and appear as the payor on BIR Form 2307.</DialogDescription></DialogHeader>
    {read.loading && <DetailsSkeleton label="Loading company details" rows={6} />}<ErrorBox error={read.error} retry={read.refresh} title="Could not load company details" />
    {!data && <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={onClose}>Close</Button></div>}
    {data && (editing
      ? <CompanyEditor settings={data} onCancel={() => setEditing(false)} reload={read.refresh} onSaved={() => { toast.success("Company details updated for new Petty Cash documents."); onClose(); }} onBusyChange={setBusy} />
      : <><dl className="text-sm">{[["Registered name", data.company?.name], ["TIN", data.company?.details.tin], ["Registered address", data.company?.details.address], ["ZIP code", data.company?.details.postalCode], ["Authorised signatory for 2307", [data.signatory?.name, data.signatoryTitle].filter(Boolean).join(", ")], ["Signatory TIN", data.signatoryTin]].map(([label, value]) => <div key={String(label)} className="grid gap-2 border-b px-2 py-3 sm:grid-cols-[1fr_2fr]"><dt className="text-xs uppercase text-muted-foreground">{String(label)}</dt><dd className="break-words">{value ? String(value) : "Not set"}</dd></div>)}</dl>
        <div className="flex flex-wrap gap-2"><Button onClick={() => setEditing(true)}>Edit company details</Button><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Close</Button></div></>)}
  </DialogContent></Dialog>;
}

function CompanyEditor({ settings, onCancel, onSaved, reload, onBusyChange }: { settings: Settings; onCancel: () => void; onSaved: () => void; reload: () => void; onBusyChange: (busy: boolean) => void }) {
  const [company, setCompany] = useState(settings.company), [name, setName] = useState(settings.company?.name || ""), [tin, setTin] = useState(String(settings.company?.details.tin || ""));
  const [address, setAddress] = useState(String(settings.company?.details.address || "")), [zip, setZip] = useState(String(settings.company?.details.postalCode || ""));
  const [signatory, setSignatory] = useState(settings.signatory), [title, setTitle] = useState(settings.signatoryTitle), [signatoryTin, setSignatoryTin] = useState(settings.signatoryTin);
  const [validation, setValidation] = useState<Record<string, string>>({});
  const command = useOnboardingCommand();
  const conflict = command.error instanceof OnboardingError && command.error.status === 409;
  useEffect(() => {
    if (!command.error) return;
    const first = onboardingFieldErrors(command.error)[0];
    const target = first ? companyFieldIds[first.field] : "company-error-summary";
    if (target) requestAnimationFrame(() => document.getElementById(target)?.focus());
  }, [command.error]);
  function clearFeedback() { if (Object.keys(validation).length) setValidation({}); command.clearError(); }
  function fieldError(field: string) { return validation[field] || onboardingFieldError(command.error, field); }
  async function save(event: FormEvent) {
    event.preventDefault(); const errors: Record<string, string> = {};
    if (!name.trim()) errors.registeredName = "Enter the registered company name.";
    if (tin.trim() && !/^\d{9,12}$/.test(tin.trim().replace(/[\s-]/g, ""))) errors.tin = "Enter a valid 9–12 digit TIN.";
    if (signatoryTin.trim() && !/^\d{9,12}$/.test(signatoryTin.trim().replace(/[\s-]/g, ""))) errors.signatoryTin = "Enter a valid 9–12 digit signatory TIN.";
    setValidation(errors);
    if (Object.keys(errors).length) { const first = Object.keys(errors)[0]; requestAnimationFrame(() => document.getElementById(companyFieldIds[first] || "company-error-summary")?.focus()); return; }
    onBusyChange(true);
    try {
      const result = await command.run("company", "PUT", { version: settings.version, companyId: company?.id ?? null, registeredName: name, tin, address, postalCode: zip, signatoryUserId: signatory?.id ?? null, signatoryTitle: title, signatoryTin });
      if (result) onSaved();
    } finally { onBusyChange(false); }
  }
  return <form noValidate onSubmit={save} onChange={clearFeedback} className="space-y-4"><fieldset disabled={command.busy || conflict} className="space-y-4">
    <div id="company-error-summary" tabIndex={-1} className="space-y-3 outline-none">
      {Object.keys(validation).length > 0 && <OnboardingFeedback tone="error" title="Check the highlighted fields"><p>Review the highlighted company fields and try again.</p></OnboardingFeedback>}
      <ErrorBox error={command.error} title="Could not save company details" showFields={false} action={conflict ? { label: "Reload company details", onClick: () => { reload(); onCancel(); } } : undefined} />
    </div>
    {!settings.company && <OnboardingChoice label="Registered company" id="company-company" resource="companies" selected={company} onSelect={value => { setCompany(value); setName(value?.name || ""); setTin(String(value?.details.tin || "")); setAddress(String(value?.details.address || "")); setZip(String(value?.details.postalCode || "")); clearFeedback(); }} error={fieldError("companyId")} />}
    <Field label="Registered name" id="company-name" value={name} onChange={setName} maxLength={255} required error={fieldError("registeredName")} />
    <div className="grid gap-3 sm:grid-cols-2"><Field label="TIN" id="company-tin" value={tin} onChange={setTin} maxLength={30} error={fieldError("tin")} /><Field label="ZIP code" id="company-zip" value={zip} onChange={setZip} maxLength={20} error={fieldError("postalCode")} /></div>
    <Field label="Registered address" id="company-address" value={address} onChange={setAddress} maxLength={500} error={fieldError("address")} />
    <div className="grid gap-3 sm:grid-cols-2"><OnboardingChoice label="Authorised signatory" id="company-signatory" resource="personnel" selected={signatory} onSelect={value => { setSignatory(value); clearFeedback(); }} disabled={command.busy} error={fieldError("signatoryUserId")} /><Field label="Signatory title" id="company-signatory-title" value={title} onChange={setTitle} maxLength={255} error={fieldError("signatoryTitle")} /><Field label="Signatory TIN" id="company-signatory-tin" value={signatoryTin} onChange={setSignatoryTin} maxLength={30} error={fieldError("signatoryTin")} /></div>
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={command.busy || conflict}>{command.busy ? "Saving..." : "Save details"}</Button><Button type="button" variant="outline" disabled={command.busy} onClick={onCancel}>Cancel</Button></div>
  </fieldset></form>;
}
