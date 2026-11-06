"use client";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Choice, Settings } from "../onboarding-types";
import { useOnboardingCommand, useOnboardingRead } from "../hooks/useOnboarding";
import { OnboardingError } from "../providers/onboarding.api";
import { OnboardingChoice } from "./OnboardingChoice";
import { ErrorBox } from "./OnboardingCommon";
import { FormSkeleton } from "./PettyCashSkeletons";
import { onboardingFieldError } from "../utils/onboardingFeedback";

type TaxRole = "INPUT_VAT" | "EWT_PAYABLE" | "CASH_OVER_SHORT";
function savedAccount(settings: Settings, role: TaxRole): Choice | null {
  const id = settings.accounts[role]?.[0];
  return id == null ? null : settings.resolvedAccounts[role]?.find(account => account.id === id) || {
    id, code: String(id), name: "Unavailable account", status: "UNAVAILABLE", classification: "", eligible: false,
    reason: "The saved account is unavailable. Select a replacement or clear the selection.", details: {},
  };
}

export function OnboardingTaxAccounts({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const read = useOnboardingRead<Settings>("settings"), [busy, setBusy] = useState(false);
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>Configure posting accounts</DialogTitle><DialogDescription>Select the shared accounts used for Input VAT, EWT Payable and cash variances.</DialogDescription></DialogHeader>
    {read.loading && <FormSkeleton label="Loading posting accounts" fields={3} />}<ErrorBox error={read.error} retry={read.refresh} title="Could not load posting account settings" />
    {read.data ? <TaxAccountEditor key={read.data.version} settings={read.data} onClose={onClose} onSaved={onSaved} reload={read.refresh} onBusyChange={setBusy} /> : <div><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button></div>}
  </DialogContent></Dialog>;
}

function TaxAccountEditor({ settings, onClose, onSaved, reload, onBusyChange }: { settings: Settings; onClose: () => void; onSaved: () => void; reload: () => void; onBusyChange: (busy: boolean) => void }) {
  const [vat, setVat] = useState(() => savedAccount(settings, "INPUT_VAT")), [ewt, setEwt] = useState(() => savedAccount(settings, "EWT_PAYABLE"));
  const [overShort, setOverShort] = useState(() => savedAccount(settings, "CASH_OVER_SHORT"));
  const command = useOnboardingCommand();
  const conflict = command.error instanceof OnboardingError && command.error.status === 409;
  const unsuitable = Boolean(vat && !vat.eligible || ewt && !ewt.eligible || overShort && !overShort.eligible);
  async function save(event: FormEvent) {
    event.preventDefault(); if (command.busy || conflict || unsuitable) return;
    onBusyChange(true);
    try {
      const result = await command.run<Settings>("settings", "PUT", {
        version: settings.version, companyId: settings.companyId, signatoryUserId: settings.signatoryUserId,
        signatoryTitle: settings.signatoryTitle, signatoryTin: settings.signatoryTin,
        usageWarning: settings.usageWarning, usageCritical: settings.usageCritical, staleDays: settings.staleDays,
        accounts: { ...settings.accounts, INPUT_VAT: vat ? [vat.id] : [], EWT_PAYABLE: ewt ? [ewt.id] : [], CASH_OVER_SHORT: overShort ? [overShort.id] : [] },
      });
      if (result) { toast.success("Posting accounts updated. New previews will use these mappings."); onSaved(); }
    } finally { onBusyChange(false); }
  }
  return <form onSubmit={save} onChange={command.clearError} className="space-y-4"><fieldset disabled={command.busy || conflict} className="grid gap-4 sm:grid-cols-2">
    <OnboardingChoice label="Input VAT" id="tax-input-vat" resource="accounts" role="INPUT_VAT" selected={vat} onSelect={value => { setVat(value); command.clearError(); }} disabled={command.busy || conflict} error={onboardingFieldError(command.error, "accounts.INPUT_VAT")} />
    <OnboardingChoice label="EWT Payable" id="tax-ewt-payable" resource="accounts" role="EWT_PAYABLE" selected={ewt} onSelect={value => { setEwt(value); command.clearError(); }} disabled={command.busy || conflict} error={onboardingFieldError(command.error, "accounts.EWT_PAYABLE")} />
    <OnboardingChoice label="Cash Over/Short" id="posting-over-short" resource="accounts" role="CASH_OVER_SHORT" selected={overShort} onSelect={value => { setOverShort(value); command.clearError(); }} disabled={command.busy || conflict} error={onboardingFieldError(command.error, "accounts.CASH_OVER_SHORT")} />
  </fieldset>
    <p className="text-sm text-muted-foreground">Unused accounts may be left blank. Transactions requiring a tax or variance account need a suitable selection before continuing.</p>
    <p className="text-sm text-muted-foreground">Changes apply to new replenishment, accrual and closure previews, including open paid vouchers. Submitted and posted journals keep their saved accounts.</p>
    <ErrorBox error={command.error} title="Could not save posting accounts" showFields={false} action={conflict ? { label: "Reload settings", onClick: reload } : undefined} />
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={command.busy || conflict || unsuitable}>{command.busy ? "Saving..." : "Save changes"}</Button><Button type="button" variant="outline" disabled={command.busy} onClick={onClose}>Cancel</Button></div>
  </form>;
}
