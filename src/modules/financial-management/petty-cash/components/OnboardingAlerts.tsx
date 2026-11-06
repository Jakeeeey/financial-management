"use client";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Settings } from "../onboarding-types";
import { useOnboardingRead, useOnboardingCommand } from "../hooks/useOnboarding";
import { OnboardingError } from "../providers/onboarding.api";
import { onboardingFieldError } from "../utils/onboardingFeedback";
import { ErrorBox, Field } from "./OnboardingCommon";

export function OnboardingAlerts({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const read = useOnboardingRead<Settings>("settings"), [busy, setBusy] = useState(false);
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent showCloseButton={false} className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Configure alerts</DialogTitle><DialogDescription>Set the usage and stale-voucher alerts shared by all Petty Cash funds.</DialogDescription></DialogHeader>
    {read.loading && <p role="status">Loading alert settings...</p>}<ErrorBox error={read.error} retry={read.refresh} title="Could not load alert settings" />
    {read.data ? <AlertEditor key={read.data.version} settings={read.data} onClose={onClose} onSaved={onSaved} reload={read.refresh} onBusyChange={setBusy} /> : <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>}
  </DialogContent></Dialog>;
}
function AlertEditor({ settings, onClose, onSaved, reload, onBusyChange }: { settings: Settings; onClose: () => void; onSaved: () => void; reload: () => void; onBusyChange: (busy: boolean) => void }) {
  const [warning, setWarning] = useState(settings.usageWarning == null ? "" : String(settings.usageWarning)), [critical, setCritical] = useState(settings.usageCritical == null ? "" : String(settings.usageCritical)), [days, setDays] = useState(settings.staleDays == null ? "" : String(settings.staleDays));
  const [errors, setErrors] = useState<Record<string, string>>({}), command = useOnboardingCommand();
  const conflict = command.error instanceof OnboardingError && command.error.status === 409;
  function changed(set: (value: string) => void, value: string) { set(value); setErrors({}); command.clearError(); }
  async function save(event?: FormEvent) {
    event?.preventDefault(); if (command.busy || conflict) return;
    const invalid: Record<string, string> = {};
    for (const [field, value] of [["usageWarning", warning], ["usageCritical", critical]]) if (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) <= 0 || Number(value) > 100) invalid[field] = "Enter a percentage above zero and at most 100, with up to two decimal places.";
    if (!invalid.usageWarning && !invalid.usageCritical && Number(warning) >= Number(critical)) invalid.usageWarning = "Usage warning must be lower than critical usage.";
    if (!days.trim() || !Number.isInteger(Number(days)) || Number(days) <= 0 || Number(days) > 2147483647) invalid.staleDays = "Enter a positive whole number of days, up to 2147483647.";
    setErrors(invalid); if (Object.keys(invalid).length) return;
    onBusyChange(true);
    try {
      const saved = await command.run<Settings>("alerts", "PUT", { version: settings.version, usageWarning: warning, usageCritical: critical, staleDays: days });
      if (saved) { toast.success("Alert settings updated. Refresh fund alerts to use the new values."); onSaved(); }
    } finally { onBusyChange(false); }
  }
  const error = (field: string) => errors[field] || onboardingFieldError(command.error, field);
  return <form noValidate onSubmit={save} className="space-y-4"><fieldset disabled={command.busy || conflict} className="space-y-4">
    <Field label="Usage warning (%)" id="alerts-warning" type="number" value={warning} onChange={v => changed(setWarning, v)} required error={error("usageWarning")} />
    <Field label="Critical usage (%)" id="alerts-critical" type="number" value={critical} onChange={v => changed(setCritical, v)} required error={error("usageCritical")} />
    <Field label="Stale voucher age (days)" id="alerts-stale-days" type="number" value={days} onChange={v => changed(setDays, v)} required error={error("staleDays")} />
  </fieldset><p className="text-sm text-muted-foreground">Warning must be lower than critical usage. Vouchers older than the configured number of days are flagged. Changes apply when fund alerts next refresh.</p>
    {Object.keys(errors).length > 0 && <p role="alert" className="text-sm text-destructive">Check the highlighted alert settings.</p>}
    <ErrorBox error={command.error} title="Could not save alert settings" showFields={false} action={conflict ? { label: "Reload settings", onClick: reload } : undefined} />
    <div className="flex flex-wrap gap-2"><Button type="submit" disabled={command.busy || conflict}>{command.busy ? "Saving..." : "Save changes"}</Button><Button type="button" variant="outline" disabled={command.busy} onClick={onClose}>Cancel</Button></div>
  </form>;
}
