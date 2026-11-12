"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Choice, MasterLinks, Page, Profile } from "../onboarding-types";
import { useOnboardingCommand, useOnboardingRead } from "../hooks/useOnboarding";
import { OnboardingChoice } from "./OnboardingChoice";
import { ErrorBox, Field, NativeSelect, OnboardingFeedback, Paging } from "./OnboardingCommon";
import { TableSkeleton } from "./PettyCashSkeletons";
import { onboardingFieldError, onboardingFieldErrors } from "../utils/onboardingFeedback";
import { payeeFilterParams } from "../utils/payeeFilters";

const payeeFieldIds: Record<string, string> = {
  supplierName: "payee-name", name: "payee-name", supplierId: "payee-name", tin: "payee-tin",
  vatRegistered: "payee-vat", payeeKind: "payee-kind", defaultExpenseCoaId: "payee-account",
  taxAddress: "payee-address", postalCode: "payee-postal",
};

export function OnboardingPayees({ links }: { links: MasterLinks | null }) {
  const [page, setPage] = useState(1), [editor, setEditor] = useState<Profile | "new" | null>(null);
  const [search, setSearch] = useState(""), [debouncedSearch, setDebouncedSearch] = useState("");
  const [payeeKind, setPayeeKind] = useState("ALL"), [vatRegistered, setVatRegistered] = useState("ALL"), [defaultExpense, setDefaultExpense] = useState("ALL");
  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 250); return () => window.clearTimeout(timer); }, [search]);
  const filtersActive = Boolean(search.trim() || payeeKind !== "ALL" || vatRegistered !== "ALL" || defaultExpense !== "ALL");
  const query = payeeFilterParams({ page, search: debouncedSearch, payeeKind, vatRegistered, defaultExpense }).toString();
  const { data, loading, error, refresh } = useOnboardingRead<Page<Profile>>(`payees?${query}`);
  const accountOptions = useOnboardingRead<Choice[]>("payee-account-options");
  function clearFilters() { setSearch(""); setDebouncedSearch(""); setPayeeKind("ALL"); setVatRegistered("ALL"); setDefaultExpense("ALL"); setPage(1); }
  function changeFilter(setter: (value: string) => void, value: string) { setter(value); setPage(1); }
  return <div className="space-y-4 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Payees</h2><Button onClick={() => setEditor("new")}>Add payee</Button></div>
    <div role="search" aria-label="Payee filters" className="flex flex-wrap items-end gap-3 rounded-lg border bg-muted/20 p-3">
      <div className="min-w-56 flex-1 space-y-2"><label htmlFor="payee-search" className="text-sm font-medium">Search</label><Input id="payee-search" type="search" aria-label="Search payees" placeholder="Payee name or TIN" value={search} onChange={event => setSearch(event.target.value)} /></div>
      <div className="w-full sm:w-48"><NativeSelect label="Type" id="payee-type" value={payeeKind} onChange={value => changeFilter(setPayeeKind, value)}><option value="ALL">All types</option><option value="CORPORATION">Corporation</option><option value="INDIVIDUAL">Individual</option></NativeSelect></div>
      <div className="w-full sm:w-48"><NativeSelect label="Tax status" id="payee-tax" value={vatRegistered} onChange={value => changeFilter(setVatRegistered, value)}><option value="ALL">All</option><option value="true">VAT-registered</option><option value="false">Non-VAT</option></NativeSelect></div>
      <div className="w-full sm:w-64"><NativeSelect label="Default account" id="payee-account" value={defaultExpense} onChange={value => changeFilter(setDefaultExpense, value)}><option value="ALL">All accounts</option><option value="NONE">Not selected</option>{accountOptions.data?.map(account => <option key={account.id} value={String(account.id)}>{account.code} · {account.name}</option>)}</NativeSelect></div>
      {filtersActive && <Button type="button" variant="ghost" onClick={clearFilters}>Clear filters</Button>}
    </div>
    <ErrorBox error={error} retry={refresh} title="Could not load payees" />{loading && <TableSkeleton label="Loading payees" rows={5} columns={6} />}
    {data && <><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{["Payee", "TIN", "Type", "Tax status", "Default account", ""].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
      {data.items.map(profile => <tr className="border-t" key={profile.id}><td className="p-3 font-medium">{profile.supplier?.name || `Supplier ${profile.supplierId}`}</td><td className="p-3">{String(profile.supplier?.details.tin || "Not supplied")}</td><td className="p-3">{profile.payeeKind === "INDIVIDUAL" ? "Individual" : "Corporation"}</td><td className="p-3">{profile.vatRegistered ? "VAT registered" : "Non-VAT"}</td><td className="p-3">{profile.defaultExpenseAccount ? `${profile.defaultExpenseAccount.code} · ${profile.defaultExpenseAccount.name}` : "Not selected"}</td><td className="p-3"><Button size="sm" variant="outline" onClick={() => setEditor(profile)}>Edit</Button></td></tr>)}
      {!data.items.length && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">{filtersActive ? "No payees match these filters." : "No Petty Cash payees configured."}</td></tr>}
    </tbody></table></div>{data.total > data.pageSize && <Paging page={page} total={data.total} pageSize={data.pageSize} onChange={setPage} />}</>}
    <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editor === "new" ? "Add payee" : "Edit payee"}</DialogTitle><DialogDescription>Payee details used for vouchers and BIR Form 2307.</DialogDescription></DialogHeader>
      {editor && <ProfileForm key={editor === "new" ? "new" : `${editor.id}-${editor.version}`} profile={editor === "new" ? null : editor} canRegister={Boolean(links?.payees.allowed)} onIdentityUpdated={refresh} onSaved={message => { setEditor(null); if (message) toast.success(message); refresh(); }} />}
    </DialogContent></Dialog>
  </div>;
}

function ProfileForm({ profile, canRegister, onIdentityUpdated, onSaved }: { profile: Profile | null; canRegister: boolean; onIdentityUpdated: () => void; onSaved: (message?: string) => void }) {
  const [supplier, setSupplier] = useState<Choice | null>(profile?.supplier || null), [name, setName] = useState(profile?.supplier?.name || ""), [tin, setTin] = useState(String(profile?.supplier?.details.tin || ""));
  const [kind, setKind] = useState(profile?.payeeKind || "CORPORATION"), [vat, setVat] = useState(profile?.vatRegistered ?? false);
  const [address, setAddress] = useState(profile?.taxAddress || ""), [postal, setPostal] = useState(profile?.postalCode || "");
  const [account, setAccount] = useState<Choice | null>(profile?.defaultExpenseAccount || null);
  const [uncertain, setUncertain] = useState(false), [identitySaved, setIdentitySaved] = useState(false), [validation, setValidation] = useState<Record<string, string>>({});
  const command = useOnboardingCommand(), matches = useOnboardingRead<Page<Choice>>(`lookups/suppliers?search=${encodeURIComponent(name)}&pageSize=25`, 250);
  useEffect(() => {
    if (!command.error) return;
    const first = onboardingFieldErrors(command.error)[0];
    const target = first ? payeeFieldIds[first.field] : "payee-error-summary";
    if (target) requestAnimationFrame(() => document.getElementById(target)?.focus());
  }, [command.error]);
  function clearFeedback() { if (Object.keys(validation).length) setValidation({}); setIdentitySaved(false); command.clearError(); }
  function fieldError(field: string) { return validation[field] || onboardingFieldError(command.error, field); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); const errors: Record<string, string> = {};
    if (!name.trim()) errors.supplierName = "Enter the payee name.";
    if (tin.trim() && !/^\d{9,12}$/.test(tin.trim().replace(/[\s-]/g, ""))) errors.tin = "Enter a valid 9–12 digit TIN, or leave it blank.";
    if (vat && !tin.trim()) errors.tin = "Enter the TIN for a VAT-registered payee.";
    const potential = supplier || matches.data?.items.find(item => item.name.toLowerCase() === name.trim().toLowerCase()) || null;
    if (!profile && !potential && !canRegister) errors.supplierName = "Select a registered payee or ask for Payee Registration access.";
    setValidation(errors);
    if (Object.keys(errors).length) { const first = Object.keys(errors)[0]; requestAnimationFrame(() => document.getElementById(payeeFieldIds[first] || "payee-error-summary")?.focus()); return; }
    let selected = potential;
    if (!selected && !profile) {
      if (uncertain) return;
      const created = await command.run<{ supplierId: number; supplierName: string }>("payees/registration", "POST", { supplierName: name, tin, payeeKind: kind, vatRegistered: vat });
      if (!created) { setUncertain(true); matches.refresh(); return; }
      selected = { id: created.supplierId, code: String(created.supplierId), name: created.supplierName, status: "ACTIVE", classification: "NON-TRADE", eligible: true, reason: null, details: { tin } }; setSupplier(selected);
    }
    if (profile) {
      const supplierName = name.trim(), normalizedTin = tin.trim().replace(/[\s-]/g, "");
      const previousName = profile.supplier?.name.trim() || "", previousTin = String(profile.supplier?.details.tin || "").replace(/[\s-]/g, "");
      const identityChanged = supplierName !== previousName || normalizedTin !== previousTin;
      const profileChanged = kind !== profile.payeeKind || vat !== profile.vatRegistered || address !== profile.taxAddress
        || postal !== profile.postalCode || (account?.id ?? null) !== profile.defaultExpenseCoaId;
      if (identityChanged) {
        const identity = await command.run<{ supplierId: number }>(`payees/${profile.supplierId}/identity`, "PATCH", { supplierName, tin });
        if (!identity) return;
        onIdentityUpdated();
      }
      if (profileChanged) {
        const result = await command.run<Profile>(`payees/${profile.id}`, "PUT", { version: profile.version, supplierId: profile.supplierId, payeeKind: kind, vatRegistered: vat, taxAddress: address, postalCode: postal, defaultExpenseCoaId: account?.id ?? null });
        if (!result) { if (identityChanged) setIdentitySaved(true); return; }
      }
      onSaved(identityChanged && profileChanged ? "Payee profile and shared supplier details updated." : identityChanged ? "Shared supplier details updated." : profileChanged ? "Payee profile updated." : undefined);
      return;
    }
    const result = await command.run<Profile>("payees", "POST", { version: 0, supplierId: selected?.id ?? null, payeeKind: kind, vatRegistered: vat, taxAddress: address, postalCode: postal, defaultExpenseCoaId: account?.id ?? null });
    if (result) onSaved(`Payee ${selected?.name || name.trim()} added to Petty Cash.`);
  }
  const existing = supplier || matches.data?.items.find(item => item.name.toLowerCase() === name.trim().toLowerCase());
  return <form noValidate className="space-y-4" onSubmit={save} onChange={clearFeedback}><fieldset disabled={command.busy} className="space-y-4">
    {profile && <p className="text-xs text-muted-foreground">Payee name and TIN are shared supplier details. Changes apply across modules.</p>}
    <div id="payee-error-summary" tabIndex={-1} className="space-y-3 outline-none">
      {Object.keys(validation).length > 0 && <OnboardingFeedback tone="error" title="Check the highlighted fields"><p>Review the highlighted payee fields and try again.</p></OnboardingFeedback>}
      {identitySaved && <OnboardingFeedback tone="warning" title="Shared payee details updated"><p>The Petty Cash profile was not saved. Review the highlighted field and try again.</p></OnboardingFeedback>}
      <ErrorBox error={command.error} title="Could not save payee profile" showFields={false} />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Payee name" id="payee-name" list={profile ? undefined : "registered-petty-cash-payees"} value={name} disabled={Boolean(!profile && supplier)} required maxLength={255} error={fieldError("supplierName")} onChange={value => { setName(value); setUncertain(false); if (!profile) { const found = matches.data?.items.find(item => item.name === value); if (found) setTin(String(found.details.tin || "")); } }} />
      <Field label="TIN" id="payee-tin" value={tin} onChange={setTin} maxLength={30} disabled={Boolean(!profile && supplier)} error={fieldError("tin")} />
      <NativeSelect label="Tax status" id="payee-vat" value={vat ? "VAT" : "NON_VAT"} onChange={value => setVat(value === "VAT")} error={fieldError("vatRegistered")}><option value="NON_VAT">Non-VAT</option><option value="VAT">VAT-registered</option></NativeSelect>
      <NativeSelect label="Payee type (sets the ATC prefix)" id="payee-kind" value={kind} onChange={value => setKind(value as Profile["payeeKind"])} error={fieldError("payeeKind")}><option value="CORPORATION">Corporation</option><option value="INDIVIDUAL">Individual</option></NativeSelect>
      <OnboardingChoice label="Default expense account" id="payee-account" resource="accounts" role="EXPENSE" selected={account} onSelect={value => { setAccount(value); clearFeedback(); }} disabled={command.busy} error={fieldError("defaultExpenseCoaId")} />
      <Field label="ZIP code" id="payee-postal" value={postal} onChange={setPostal} maxLength={20} error={fieldError("postalCode")} />
    </div>
    {!profile && <datalist id="registered-petty-cash-payees">{matches.data?.items.map(item => <option key={item.id} value={item.name} />)}</datalist>}
    <Field label="Registered address (for BIR Form 2307)" id="payee-address" value={address} onChange={setAddress} maxLength={500} error={fieldError("taxAddress")} />
    {uncertain && <OnboardingFeedback tone="warning" title="Registration outcome is unconfirmed"><p>Search the registered payees before retrying; registration may already have completed.</p></OnboardingFeedback>}
    {!profile && !canRegister && !existing && <OnboardingFeedback tone="info" title="Select a registered payee"><p>Adding a new shared payee requires Payee Registration access.</p></OnboardingFeedback>}
    <Button type="submit" disabled={command.busy || !name.trim() || !profile && !existing && (!canRegister || uncertain)}>{command.busy ? "Saving..." : profile ? "Save changes" : "Add payee"}</Button>
  </fieldset></form>;
}
