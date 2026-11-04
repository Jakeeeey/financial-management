"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Choice, MasterLinks, Page, Profile, TaxRule } from "../onboarding-types";
import { useOnboardingCommand, useOnboardingRead } from "../hooks/useOnboarding";
import { OnboardingError } from "../providers/onboarding.api";
import { OnboardingChoice } from "./OnboardingChoice";
import { ErrorBox, Field, NativeSelect, Paging, ReadinessList } from "./OnboardingCommon";

export function OnboardingPayees({ links }: { links: MasterLinks | null }) {
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [editor, setEditor] = useState<Profile | "new" | null>(null); const [saved, setSaved] = useState(false);
  const { data, loading, error, refresh } = useOnboardingRead<Page<Profile>>(`payees?${new URLSearchParams({ search, page: String(page), pageSize: "25" })}`, 250);
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Link a registered supplier or configure a new payee. Tax classification is separate from Trade / Non-Trade status.</p><Button onClick={() => setEditor("new")}>Add / link payee</Button></div>
    {saved && <p role="status" className="text-sm text-green-800">Payee profile saved.</p>}<Input aria-label="Search Petty Cash payees" placeholder="Search payee name or TIN" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
    <ErrorBox error={error} retry={refresh} />{loading && <p role="status">Loading payees...</p>}
    {data && <><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{["Payee", "TIN", "Classification", "VAT status", "Default expense account", "Readiness", "Action"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
      {data.items.map(profile => <tr className="border-t" key={profile.id}><td className="p-3 font-medium">{profile.supplier?.name || `Supplier ${profile.supplierId}`}</td><td className="p-3">{String(profile.supplier?.details.tin || "Not supplied")}</td><td className="p-3">{profile.payeeKind}</td><td className="p-3">{profile.vatRegistered ? "VAT registered" : "Non-VAT"}</td><td className="p-3">{profile.defaultExpenseAccount ? `${profile.defaultExpenseAccount.code} · ${profile.defaultExpenseAccount.name}` : "Not selected"}</td><td className="p-3">{profile.readiness.ready ? "Configured" : "Needs setup"}</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => setEditor(profile)}>Edit profile</Button></td></tr>)}
      {!data.items.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No Petty Cash payees configured.</td></tr>}
    </tbody></table></div><Paging page={page} total={data.total} pageSize={data.pageSize} onChange={setPage} /></>}
    <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editor === "new" ? "Add / link payee" : "Edit payee profile"}</DialogTitle><DialogDescription>Shared payee identity stays in the registry. Petty Cash stores its own tax classification and default expense account.</DialogDescription></DialogHeader>
      {editor && <ProfileForm key={editor === "new" ? "new" : `${editor.id}-${editor.version}`} profile={editor === "new" ? null : editor} canRegister={Boolean(links?.payees.allowed)} onSaved={() => { setEditor(null); setSaved(true); refresh(); }} />}
    </DialogContent></Dialog>
  </div>;
}
function ProfileForm({ profile, canRegister, onSaved }: { profile: Profile | null; canRegister: boolean; onSaved: () => void }) {
  const [supplier, setSupplier] = useState<Choice | null>(profile?.supplier || null); const [mode, setMode] = useState<"link" | "register">("link");
  const [name, setName] = useState(""); const [tin, setTin] = useState(""); const [kind, setKind] = useState(profile?.payeeKind || "CORPORATION"); const [vat, setVat] = useState(profile?.vatRegistered ?? false);
  const [address, setAddress] = useState(profile?.taxAddress || ""); const [postal, setPostal] = useState(profile?.postalCode || ""); const [account, setAccount] = useState(profile?.defaultExpenseAccount || null);
  const [registered, setRegistered] = useState(false); const [checkRegistry, setCheckRegistry] = useState(false); const command = useOnboardingCommand();
  async function register() {
    const result = await command.run<{ supplierId: number; supplierName: string }>("payees/registration", "POST", { supplierName: name, tin, payeeKind: kind, vatRegistered: vat });
    if (result) { setSupplier({ id: result.supplierId, code: String(result.supplierId), name: result.supplierName, status: "ACTIVE", classification: "NON-TRADE", eligible: true, reason: null, details: { tin } }); setRegistered(true); setMode("link"); }
    else if (command.failure.current && (!(command.failure.current instanceof OnboardingError) || command.failure.current.status >= 500 || command.failure.current.status === 409)) { setCheckRegistry(true); setMode("link"); }
  }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const result = await command.run<Profile>(profile ? `payees/${profile.id}` : "payees", profile ? "PUT" : "POST", { version: profile?.version || 0, supplierId: supplier?.id ?? null, payeeKind: kind, vatRegistered: vat, taxAddress: address, postalCode: postal, defaultExpenseCoaId: account?.id ?? null });
    if (result) onSaved();
  }
  return <form className="space-y-4" onSubmit={save}><fieldset disabled={command.busy} className="space-y-4">
    {!profile && canRegister && !registered && !checkRegistry && <div className="flex flex-wrap gap-2"><Button type="button" variant={mode === "link" ? "default" : "outline"} onClick={() => setMode("link")}>Link existing payee</Button><Button type="button" variant={mode === "register" ? "default" : "outline"} onClick={() => setMode("register")}>Register new payee</Button></div>}
    {!profile && !canRegister && <p className="text-xs text-muted-foreground">Creating shared payees requires Payee Registration access. You can link an existing payee.</p>}
    {mode === "register" ? <div className="grid gap-4 sm:grid-cols-2"><Field label="New payee name" id="new-payee-name" value={name} onChange={setName} maxLength={255} /><Field label="Payee TIN (optional for Non-VAT)" id="new-payee-tin" value={tin} onChange={setTin} maxLength={30} /></div>
      : <OnboardingChoice label="Registered payee" resource="suppliers" selected={supplier} onSelect={setSupplier} disabled={Boolean(profile) || registered || command.busy} />}
    {registered && <p role="status" className="rounded-lg border p-3 text-sm">Shared payee #{supplier?.id} is registered. Finish setup below. If this step fails, the payee remains available to link; registration will not be repeated.</p>}
    {checkRegistry && <p className="rounded-lg border p-3 text-sm text-amber-800">Check the shared registry before attempting registration again. Search and link the existing payee if it was created.</p>}
    <div className="grid gap-4 sm:grid-cols-2"><NativeSelect label="Payee classification" id="payee-kind" value={kind} onChange={value => setKind(value as Profile["payeeKind"])}><option value="INDIVIDUAL">Individual</option><option value="CORPORATION">Corporation</option></NativeSelect>
      <NativeSelect label="Payee VAT status" id="payee-vat" value={vat ? "VAT" : "NON_VAT"} onChange={value => setVat(value === "VAT")}><option value="NON_VAT">Non-VAT</option><option value="VAT">VAT registered</option></NativeSelect>
      <Field label="Registered tax address" id="payee-address" value={address} onChange={setAddress} maxLength={500} /><Field label="Registered ZIP code" id="payee-postal" value={postal} onChange={setPostal} maxLength={20} />
    </div><OnboardingChoice label="Default expense account" resource="accounts" role="EXPENSE" selected={account} onSelect={setAccount} disabled={command.busy} />
    <p className="text-xs text-muted-foreground">A missing TIN is not a tax exemption. VAT, EWT and certificate eligibility must be verified before the affected transaction.</p>
    <ErrorBox error={command.error} />
    {mode === "register" ? <Button type="button" disabled={command.busy || !name.trim()} onClick={() => void register()}>{command.busy ? "Registering..." : "Register shared payee"}</Button>
      : <Button type="submit" disabled={command.busy || !supplier}>{command.busy ? "Saving..." : registered ? "Finish payee setup" : "Save payee profile"}</Button>}
    {command.error instanceof OnboardingError && command.error.status === 409 && <p className="text-xs text-muted-foreground">For an existing Petty Cash profile, close this dialog and open it from the payee list.</p>}
  </fieldset>
    {profile && <><ReadinessList checks={{ PAYEE_TAX_IDENTITY: profile.readiness }} /><EligibleAtcs profileId={profile.id} kind={kind} /></>}
  </form>;
}
function EligibleAtcs({ profileId, kind }: { profileId: number; kind: string }) {
  const { data, error, loading } = useOnboardingRead<Page<TaxRule>>(`tax-rules?profileId=${profileId}&ruleKind=EWT&eligibleOnly=true&page=1&pageSize=50`);
  return <div className="space-y-2 rounded-lg border p-3"><h3 className="text-sm font-medium">Applicable verified ATCs</h3><p className="text-xs text-muted-foreground">Based on the saved profile and today&apos;s date. Save classification changes to refresh eligibility.</p>
    {loading && <p className="text-xs">Loading ATCs...</p>}<ErrorBox error={error} />
    {data && <ul className="space-y-1 text-sm">{data.items.filter(rule => rule.payeeKind === kind || rule.payeeKind === "BOTH").map(rule => <li key={rule.id}>{rule.code} · {rule.rate}%</li>)}{!data.items.some(rule => rule.payeeKind === kind || rule.payeeKind === "BOTH") && <li>No eligible verified ATCs. Check tax identity, classification, configured rules and effective dates.</li>}</ul>}
  </div>;
}
