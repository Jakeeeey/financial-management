"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ACCOUNT_ROLES, type AccountRole, type Choice, type MasterLinks, type Settings } from "../onboarding-types";
import { useOnboardingCommand, useOnboardingRead } from "../hooks/useOnboarding";
import { OnboardingChoice } from "./OnboardingChoice";
import { ErrorBox, Field, ReadinessList } from "./OnboardingCommon";
import { OnboardingTaxRules } from "./OnboardingTaxRules";

export function OnboardingSettings({ links }: { links: MasterLinks | null }) {
  const { data, loading, error, refresh } = useOnboardingRead<Settings>("settings");
  const [saved, setSaved] = useState(false);
  return <div className="space-y-6">{saved && <p role="status" className="text-sm text-green-800">Policy settings saved.</p>}
    <ErrorBox error={error} retry={refresh} />{loading && <p role="status">Loading policy settings...</p>}
    {data && <SettingsForm key={data.version} settings={data} links={links} onSaved={() => { setSaved(true); refresh(); }} />}
    <OnboardingTaxRules />
  </div>;
}
function SettingsForm({ settings, links, onSaved }: { settings: Settings; links: MasterLinks | null; onSaved: () => void }) {
  const [company, setCompany] = useState(settings.company); const [signatory, setSignatory] = useState(settings.signatory);
  const [title, setTitle] = useState(settings.signatoryTitle); const [tin, setTin] = useState(settings.signatoryTin);
  const [warning, setWarning] = useState(String(settings.usageWarning)); const [critical, setCritical] = useState(String(settings.usageCritical)); const [days, setDays] = useState(String(settings.staleDays));
  const [accounts, setAccounts] = useState<Record<AccountRole, Choice[]>>(settings.resolvedAccounts);
  const command = useOnboardingCommand();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await command.run<Settings>("settings", "PUT", { version: settings.version, companyId: company?.id ?? null, signatoryUserId: signatory?.id ?? null,
      signatoryTitle: title, signatoryTin: tin, usageWarning: Number(warning), usageCritical: Number(critical), staleDays: Number(days),
      accounts: Object.fromEntries(Object.entries(accounts).map(([role, choices]) => [role, choices.map(choice => choice.id)])) });
    if (saved) onSaved();
  }
  return <form onSubmit={submit} className="space-y-6"><fieldset disabled={command.busy} className="space-y-6">
    <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Company and signatory</h2>
      <p className="text-sm text-muted-foreground">Select the shared company. Official identity stays in Company management; Petty Cash stores the document signatory settings.</p>
      <div className="grid gap-4 md:grid-cols-2"><OnboardingChoice label="Registered company" resource="companies" selected={company} onSelect={setCompany} disabled={command.busy} />
        <OnboardingChoice label="Authorized signatory" resource="personnel" selected={signatory} onSelect={setSignatory} disabled={command.busy} />
        <Field label="Signatory title" id="signatory-title" value={title} onChange={setTitle} maxLength={255} /><Field label="Signatory TIN" id="signatory-tin" value={tin} onChange={setTin} maxLength={30} />
      </div>
      {company && <dl className="grid gap-3 rounded-lg bg-muted/40 p-4 text-sm md:grid-cols-2"><div><dt className="text-muted-foreground">Registered name</dt><dd>{company.name}</dd></div><div><dt className="text-muted-foreground">TIN</dt><dd>{String(company.details.tin || "Not configured")}</dd></div><div><dt className="text-muted-foreground">Registered address</dt><dd>{String(company.details.address || "Not configured")}</dd></div><div><dt className="text-muted-foreground">ZIP code</dt><dd>{String(company.details.postalCode || "Not configured")}</dd></div></dl>}
      {links?.company.allowed && links.company.path && <Button type="button" variant="outline" asChild><a href={links.company.path}>Manage shared company</a></Button>}
    </section>
    <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Account mappings</h2><p className="text-sm text-muted-foreground">Select suitable Pending or Approved accounts for each role. Incomplete setup can be saved. Accounting must confirm the purpose of each selected account.</p>
      <div className="grid gap-4 md:grid-cols-2">{(Object.entries(ACCOUNT_ROLES) as [AccountRole, string][]).map(([role, label]) => <div key={role} className="min-w-0 space-y-2">
        <OnboardingChoice label={label} resource="accounts" role={role} selected={role === "EXPENSE" ? null : accounts[role]?.[0] ?? null} disabled={command.busy}
          onSelect={choice => setAccounts(previous => ({ ...previous, [role]: role === "EXPENSE" ? choice ? [...(previous[role] || []).filter(item => item.id !== choice.id), choice] : [] : choice ? [choice] : [] }))} />
        {role === "EXPENSE" && <ul className="space-y-2">{accounts.EXPENSE?.map(choice => <li key={choice.id} className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm"><span>{choice.code} · {choice.name}{choice.reason && <small className="block text-amber-800">{choice.reason}</small>}</span><Button type="button" size="sm" variant="ghost" aria-label={`Remove ${choice.name}`} onClick={() => setAccounts(previous => ({ ...previous, EXPENSE: previous.EXPENSE.filter(item => item.id !== choice.id) }))}>Remove</Button></li>)}</ul>}
      </div>)}</div>
    </section>
    <section className="space-y-4 rounded-xl border bg-card p-5"><h2 className="text-lg font-semibold">Alerts</h2><div className="grid gap-4 md:grid-cols-3">
      <Field label="Usage warning (%)" id="usage-warning" value={warning} onChange={setWarning} type="number" required /><Field label="Critical usage (%)" id="usage-critical" value={critical} onChange={setCritical} type="number" required /><Field label="Stale voucher days" id="stale-days" value={days} onChange={setDays} type="number" required />
    </div><p className="text-xs text-muted-foreground">Initial policy: warning at 60%, critical at 85%, vouchers older than 30 days. Values are saved in the database.</p></section>
    <ErrorBox error={command.error} /><Button type="submit" disabled={command.busy}>{command.busy ? "Saving..." : "Save policy settings"}</Button>
    <p className="text-xs text-muted-foreground">Version {settings.version}. Incomplete certificate or tax setup does not imply that every operation is blocked.</p>
  </fieldset><ReadinessList checks={settings.readiness} /></form>;
}
