"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Choice, MasterLinks, Page, Profile } from "../onboarding-types";
import { useOnboardingCommand, useOnboardingRead } from "../hooks/useOnboarding";
import { OnboardingChoice } from "./OnboardingChoice";
import { ErrorBox, Field, NativeSelect, Paging } from "./OnboardingCommon";

export function OnboardingPayees({ links }: { links: MasterLinks | null }) {
  const search = ""; const [page, setPage] = useState(1); const [editor, setEditor] = useState<Profile | "new" | null>(null); const [saved, setSaved] = useState(false);
  const { data, loading, error, refresh } = useOnboardingRead<Page<Profile>>(`payees?${new URLSearchParams({ search, page: String(page), pageSize: "25" })}`, 250);
  return <div className="space-y-4 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Payees</h2><Button onClick={() => setEditor("new")}>Add payee</Button></div>
    {saved && <p role="status" className="text-sm text-green-800">Payee profile saved.</p>}
    <ErrorBox error={error} retry={refresh} />{loading && <p role="status">Loading payees...</p>}
    {data && <><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{["Payee", "TIN", "Type", "Tax status", "Default account", ""].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
      {data.items.map(profile => <tr className="border-t" key={profile.id}><td className="p-3 font-medium">{profile.supplier?.name || `Supplier ${profile.supplierId}`}</td><td className="p-3">{String(profile.supplier?.details.tin || "Not supplied")}</td><td className="p-3">{profile.payeeKind === "INDIVIDUAL" ? "Individual" : "Corporation"}</td><td className="p-3">{profile.vatRegistered ? "VAT registered" : "Non-VAT"}</td><td className="p-3">{profile.defaultExpenseAccount ? `${profile.defaultExpenseAccount.code} · ${profile.defaultExpenseAccount.name}` : "Not selected"}</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => setEditor(profile)}>Edit</Button></td></tr>)}
      {!data.items.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No Petty Cash payees configured.</td></tr>}
    </tbody></table></div>{data.total > data.pageSize && <Paging page={page} total={data.total} pageSize={data.pageSize} onChange={setPage} />}</>}
    <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editor === "new" ? "Add payee" : "Edit payee"}</DialogTitle><DialogDescription>Payee details used for vouchers and BIR Form 2307.</DialogDescription></DialogHeader>
      {editor && <ProfileForm key={editor === "new" ? "new" : `${editor.id}-${editor.version}`} profile={editor === "new" ? null : editor} canRegister={Boolean(links?.payees.allowed)} onSaved={() => { setEditor(null); setSaved(true); refresh(); }} />}
    </DialogContent></Dialog>
  </div>;
}
function ProfileForm({ profile, canRegister, onSaved }: { profile: Profile | null; canRegister: boolean; onSaved: () => void }) {
  const [supplier, setSupplier] = useState<Choice | null>(profile?.supplier || null), [name, setName] = useState(profile?.supplier?.name || ""), [tin, setTin] = useState(String(profile?.supplier?.details.tin || ""));
  const [kind, setKind] = useState(profile?.payeeKind || "CORPORATION"), [vat, setVat] = useState(profile?.vatRegistered ?? false);
  const [address, setAddress] = useState(profile?.taxAddress || ""), [postal, setPostal] = useState(profile?.postalCode || ""), [account, setAccount] = useState(profile?.defaultExpenseAccount || null);
  const [uncertain, setUncertain] = useState(false), command = useOnboardingCommand();
  const matches = useOnboardingRead<Page<Choice>>(`lookups/suppliers?search=${encodeURIComponent(name)}&pageSize=25`, 250);
  async function save(event: React.FormEvent) {
    event.preventDefault(); let selected = supplier || matches.data?.items.find(item => item.name.toLowerCase() === name.trim().toLowerCase()) || null;
    if (!selected && !profile) {
      if (uncertain) return;
      const created = await command.run<{ supplierId: number; supplierName: string }>("payees/registration", "POST", { supplierName: name, tin, payeeKind: kind, vatRegistered: vat });
      if (!created) { setUncertain(true); matches.refresh(); return; }
      selected = { id: created.supplierId, code: String(created.supplierId), name: created.supplierName, status: "ACTIVE", classification: "NON-TRADE", eligible: true, reason: null, details: { tin } }; setSupplier(selected);
    }
    const result = await command.run<Profile>(profile ? `payees/${profile.id}` : "payees", profile ? "PUT" : "POST", { version: profile?.version || 0, supplierId: selected?.id ?? null, payeeKind: kind, vatRegistered: vat, taxAddress: address, postalCode: postal, defaultExpenseCoaId: account?.id ?? null });
    if (result) onSaved();
  }
  const existing = supplier || matches.data?.items.find(item => item.name.toLowerCase() === name.trim().toLowerCase());
  return <form className="space-y-4" onSubmit={save}><fieldset disabled={command.busy} className="space-y-4"><div className="grid gap-3 sm:grid-cols-2">
    <div className="space-y-2"><label htmlFor="payee-name" className="text-sm font-medium">Payee name</label><Input id="payee-name" list="registered-petty-cash-payees" value={name} disabled={Boolean(profile || supplier)} required maxLength={255} onChange={event => { setName(event.target.value); setUncertain(false); const found = matches.data?.items.find(item => item.name === event.target.value); if (found) setTin(String(found.details.tin || "")); }} /><datalist id="registered-petty-cash-payees">{matches.data?.items.map(item => <option key={item.id} value={item.name} />)}</datalist></div>
    <Field label="TIN" id="payee-tin" value={tin} onChange={setTin} maxLength={30} disabled={Boolean(profile || supplier)} />
    <NativeSelect label="Tax status" id="payee-vat" value={vat ? "VAT" : "NON_VAT"} onChange={value => setVat(value === "VAT")}><option value="NON_VAT">Non-VAT</option><option value="VAT">VAT-registered</option></NativeSelect>
    <NativeSelect label="Payee type (sets the ATC prefix)" id="payee-kind" value={kind} onChange={value => setKind(value as Profile["payeeKind"])}><option value="CORPORATION">Corporation</option><option value="INDIVIDUAL">Individual</option></NativeSelect>
    <OnboardingChoice label="Default expense account" resource="accounts" role="EXPENSE" selected={account} onSelect={setAccount} disabled={command.busy} />
    <Field label="ZIP code" id="payee-postal" value={postal} onChange={setPostal} maxLength={20} />
  </div><Field label="Registered address (for BIR Form 2307)" id="payee-address" value={address} onChange={setAddress} maxLength={500} />
    {uncertain && <p role="alert" className="text-sm">Search the registered payees before retrying; registration may already have completed.</p>}
    {!profile && !canRegister && !existing && <p className="text-sm text-muted-foreground">Select a registered payee. Adding a new one requires Payee Registration access.</p>}
    <ErrorBox error={command.error} /><Button type="submit" disabled={command.busy || !name.trim() || !profile && !existing && (!canRegister || uncertain)}>{command.busy ? "Saving..." : profile ? "Save changes" : "Add payee"}</Button>
  </fieldset></form>;
}
