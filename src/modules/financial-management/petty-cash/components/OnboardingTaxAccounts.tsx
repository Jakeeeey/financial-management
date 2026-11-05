"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Choice, Settings } from "../onboarding-types";
import { useOnboardingCommand, useOnboardingRead } from "../hooks/useOnboarding";
import { OnboardingError } from "../providers/onboarding.api";
import { OnboardingChoice } from "./OnboardingChoice";
import { ErrorBox } from "./OnboardingCommon";

type TaxRole = "INPUT_VAT" | "EWT_PAYABLE";
function savedAccount(settings: Settings, role: TaxRole): Choice | null {
  const id = settings.accounts[role]?.[0];
  return id == null ? null : settings.resolvedAccounts[role]?.find(account => account.id === id) || {
    id, code: String(id), name: "Unavailable account", status: "UNAVAILABLE", classification: "", eligible: false,
    reason: "The saved account is unavailable. Select a replacement or clear the selection.", details: {},
  };
}

export function OnboardingTaxAccounts({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const read = useOnboardingRead<Settings>("settings"), [busy, setBusy] = useState(false);
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Configure tax accounts</DialogTitle><DialogDescription>Select the shared accounts used when posting Input VAT and EWT Payable.</DialogDescription></DialogHeader>
    {read.loading && <p role="status">Loading tax accounts...</p>}<ErrorBox error={read.error} retry={read.refresh} />
    {read.data ? <TaxAccountEditor key={read.data.version} settings={read.data} onClose={onClose} onSaved={onSaved} reload={read.refresh} onBusyChange={setBusy} /> : <div><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button></div>}
  </DialogContent></Dialog>;
}

function TaxAccountEditor({ settings, onClose, onSaved, reload, onBusyChange }: { settings: Settings; onClose: () => void; onSaved: () => void; reload: () => void; onBusyChange: (busy: boolean) => void }) {
  const [vat, setVat] = useState(() => savedAccount(settings, "INPUT_VAT")), [ewt, setEwt] = useState(() => savedAccount(settings, "EWT_PAYABLE"));
  const command = useOnboardingCommand();
  const conflict = command.error instanceof OnboardingError && command.error.status === 409;
  const unsuitable = Boolean(vat && !vat.eligible || ewt && !ewt.eligible);
  async function save(event: FormEvent) {
    event.preventDefault(); if (command.busy || conflict || unsuitable) return;
    onBusyChange(true);
    try {
      const result = await command.run<Settings>("settings", "PUT", {
        version: settings.version, companyId: settings.companyId, signatoryUserId: settings.signatoryUserId,
        signatoryTitle: settings.signatoryTitle, signatoryTin: settings.signatoryTin,
        usageWarning: settings.usageWarning, usageCritical: settings.usageCritical, staleDays: settings.staleDays,
        accounts: { ...settings.accounts, INPUT_VAT: vat ? [vat.id] : [], EWT_PAYABLE: ewt ? [ewt.id] : [] },
      });
      if (result) onSaved();
    } finally { onBusyChange(false); }
  }
  return <form onSubmit={save} className="space-y-4"><fieldset disabled={command.busy || conflict} className="grid gap-4 sm:grid-cols-2">
    <OnboardingChoice label="Input VAT" resource="accounts" role="INPUT_VAT" selected={vat} onSelect={setVat} disabled={command.busy || conflict} />
    <OnboardingChoice label="EWT Payable" resource="accounts" role="EWT_PAYABLE" selected={ewt} onSelect={setEwt} disabled={command.busy || conflict} />
  </fieldset>
    <p className="text-sm text-muted-foreground">A tax account may be left blank when unused. Transactions requiring that tax will need a suitable account before continuing.</p>
    <p className="text-sm text-muted-foreground">Changes apply to new replenishment and accrual previews, including open paid vouchers. Submitted and posted journals keep their saved accounts.</p>
    <ErrorBox error={command.error} />
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={command.busy || conflict || unsuitable}>{command.busy ? "Saving..." : "Save changes"}</Button>{conflict && <Button type="button" variant="outline" onClick={reload}>Reload settings</Button>}<Button type="button" variant="outline" disabled={command.busy} onClick={onClose}>Cancel</Button></div>
  </form>;
}
