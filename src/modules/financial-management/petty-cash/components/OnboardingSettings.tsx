"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Settings } from "../onboarding-types";
import { useOnboardingCommand, useOnboardingRead } from "../hooks/useOnboarding";
import { OnboardingChoice } from "./OnboardingChoice";
import { ErrorBox, Field } from "./OnboardingCommon";

export function OnboardingSettings() {
  const read = useOnboardingRead<Settings>("settings"), [editing, setEditing] = useState(false), [saved, setSaved] = useState(false);
  const data = read.data;
  return <section className="space-y-4 rounded-xl border bg-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Company</h2><Button disabled={!data} onClick={() => setEditing(true)}>Edit company details</Button></div>
    <p className="text-sm text-muted-foreground">These details print on every document and appear as the payor on BIR Form 2307.</p>
    {saved && <p role="status" className="text-sm">Company details saved.</p>}{read.loading && <p role="status">Loading company...</p>}<ErrorBox error={read.error} retry={read.refresh} />
    {data && <dl className="text-sm">{[["Registered name", data.company?.name], ["TIN", data.company?.details.tin], ["Registered address", data.company?.details.address], ["ZIP code", data.company?.details.postalCode], ["Authorised signatory for 2307", [data.signatory?.name, data.signatoryTitle].filter(Boolean).join(", ")], ["Signatory TIN", data.signatoryTin]].map(([label, value]) => <div key={String(label)} className="grid gap-2 border-b px-2 py-3 sm:grid-cols-[1fr_2fr]"><dt className="text-xs uppercase text-muted-foreground">{String(label)}</dt><dd className="break-words">{value ? String(value) : "—"}</dd></div>)}</dl>}
    {editing && data && <CompanyEditor settings={data} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setSaved(true); read.refresh(); }} />}
  </section>;
}
function CompanyEditor({ settings, onClose, onSaved }: { settings: Settings; onClose: () => void; onSaved: () => void }) {
  const [company, setCompany] = useState(settings.company), [name, setName] = useState(settings.company?.name || ""), [tin, setTin] = useState(String(settings.company?.details.tin || ""));
  const [address, setAddress] = useState(String(settings.company?.details.address || "")), [zip, setZip] = useState(String(settings.company?.details.postalCode || ""));
  const [signatory, setSignatory] = useState(settings.signatory), [title, setTitle] = useState(settings.signatoryTitle), [signatoryTin, setSignatoryTin] = useState(settings.signatoryTin);
  const command = useOnboardingCommand();
  async function save(event: React.FormEvent) {
    event.preventDefault(); const result = await command.run("company", "PUT", { version: settings.version, companyId: company?.id ?? null, registeredName: name, tin, address, postalCode: zip, signatoryUserId: signatory?.id ?? null, signatoryTitle: title, signatoryTin });
    if (result) onSaved();
  }
  return <Dialog open onOpenChange={open => { if (!open && !command.busy) onClose(); }}><DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader className="flex-row items-center justify-between"><DialogTitle>Company details</DialogTitle><Button type="button" size="sm" variant="outline" disabled={command.busy} onClick={onClose}>Close</Button><DialogDescription className="sr-only">Edit company details used on Petty Cash documents.</DialogDescription></DialogHeader>
    <form onSubmit={save} className="space-y-4"><fieldset disabled={command.busy} className="space-y-4">
      {!settings.company && <OnboardingChoice label="Registered company" resource="companies" selected={company} onSelect={value => { setCompany(value); setName(value?.name || ""); setTin(String(value?.details.tin || "")); setAddress(String(value?.details.address || "")); setZip(String(value?.details.postalCode || "")); }} />}
      <Field label="Registered name" id="company-name" value={name} onChange={setName} maxLength={255} required />
      <div className="grid gap-3 sm:grid-cols-2"><Field label="TIN" id="company-tin" value={tin} onChange={setTin} maxLength={30} /><Field label="ZIP code" id="company-zip" value={zip} onChange={setZip} maxLength={20} /></div>
      <Field label="Registered address" id="company-address" value={address} onChange={setAddress} maxLength={500} />
      <div className="grid gap-3 sm:grid-cols-2"><OnboardingChoice label="Authorised signatory" resource="personnel" selected={signatory} onSelect={setSignatory} disabled={command.busy} /><Field label="Signatory title" id="company-signatory-title" value={title} onChange={setTitle} maxLength={255} /><Field label="Signatory TIN" id="company-signatory-tin" value={signatoryTin} onChange={setSignatoryTin} maxLength={30} /></div>
      <ErrorBox error={command.error} /><div className="flex gap-2"><Button type="submit" disabled={command.busy}>{command.busy ? "Saving..." : "Save details"}</Button><Button type="button" variant="outline" disabled={command.busy} onClick={onClose}>Cancel</Button></div>
    </fieldset></form></DialogContent></Dialog>;
}
