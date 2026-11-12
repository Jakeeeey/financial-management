"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createSetupMaster, getSetupMasterOptions } from "../providers/bankReconciliationSetupApi";
import type { AccountReference, CompanyReference } from "../reference-types";
import type { BankConfiguration, MasterOptions } from "../setup-types";

export type NewReference = "companies" | "bank-accounts" | "accounts";
export function CreateReferenceDialog({ kind, company, onClose, onCreated }: {
  kind: NewReference | null; company: CompanyReference | null; onClose: () => void;
  onCreated: (kind: NewReference, item: CompanyReference | AccountReference | BankConfiguration) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({}), [options, setOptions] = useState<MasterOptions | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    if (!kind) return;
    setValues({ accountName: company?.name || "", accountType: "Savings", currency: "PHP" }); setError("");
    if (kind === "accounts") getSetupMasterOptions().then(setOptions).catch(e => setError(e.message));
  }, [kind, company]);
  const field = (key: string, label: string, required = false, maxLength = 255) => <label className="space-y-2 text-sm" key={key}><span>{label}{required ? " *" : ""}</span><Input name={key} aria-label={label} value={values[key] || ""} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} required={required} maxLength={maxLength} /></label>;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (!kind) return; setBusy(true); setError("");
    try {
      if (kind === "companies") onCreated(kind, await createSetupMaster(kind, { code: values.code, name: values.name }));
      else if (kind === "accounts") onCreated(kind, await createSetupMaster(kind, { ...values, bsisId: Number(values.bsisId), accountTypeId: Number(values.accountTypeId), balanceTypeId: Number(values.balanceTypeId) }));
      else onCreated(kind, await createSetupMaster(kind, { ...values, companyId: company?.id }));
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to create reference."); }
    finally { setBusy(false); }
  }
  return <Dialog open={Boolean(kind)} onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
    <DialogHeader><DialogTitle>Add {kind === "companies" ? "company" : kind === "accounts" ? "GL account" : "bank account"}</DialogTitle><DialogDescription>{kind === "bank-accounts" ? "Create a bank account reference with zero opening funding. No journal will be posted." : "Save a shared database reference for use in the reconciliation."}</DialogDescription></DialogHeader>
    <form onSubmit={submit} className="space-y-4">
      {kind !== "bank-accounts" ? <div className="grid gap-4 sm:grid-cols-2">{field("code", "Code", true)}{field("name", "Name", true)}</div> : <>
        <p className="text-sm text-muted-foreground">Company: {company?.name || "Select an entity first"}</p>
        <div className="grid gap-4 sm:grid-cols-2">{field("bankName", "Bank name", true)}{field("branch", "Branch", true)}{field("accountNumber", "Account number", true, 20)}{field("accountName", "Account holder", true)}{field("accountType", "Account type", true, 40)}{field("currency", "Currency", true, 3)}</div>
        <details className="space-y-3"><summary className="cursor-pointer text-sm">Bank contact details (optional)</summary><div className="grid gap-3 sm:grid-cols-2">{field("description", "Description")}{field("ifscCode", "IFSC code")}{field("province", "Province")}{field("city", "City")}{field("barangay", "Barangay")}{field("email", "Email")}{field("mobileNo", "Mobile number", false, 20)}{field("contactPerson", "Contact person")}</div></details>
      </>}
      {kind === "accounts" && <div className="grid gap-4 sm:grid-cols-3">{([['bsisId', 'BS/IS type', options?.bsis], ['accountTypeId', 'Account classification', options?.accountTypes], ['balanceTypeId', 'Normal balance', options?.balanceTypes]] as const).map(([key, label, items]) => <label key={key} className="space-y-2 text-sm"><span>{label}</span><select aria-label={label} required className="h-9 w-full rounded-md border bg-background px-2" value={values[key] || ""} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))}><option value="">Select…</option>{items?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>)}</div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || kind === "bank-accounts" && !company}>{busy ? "Saving…" : "Save reference"}</Button></DialogFooter>
    </form>
  </DialogContent></Dialog>;
}
