"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getBankReconciliationContext, getBankReconciliationReference, searchBankReconciliationReferences } from "./providers/bankReconciliationReferencesApi";
import { getSetupPeriod, saveBankConfiguration } from "./providers/bankReconciliationSetupApi";
import { usePeriodSetup } from "./hooks/usePeriodSetup";
import { ReferenceChoice } from "./components/ReferenceChoice";
import { CreateReferenceDialog, type NewReference } from "./components/CreateReferenceDialog";
import { TransactionWorkbench } from "./components/TransactionWorkbench";
import { ReconcileExports } from "./components/ReconcileExports";
import type { AccountReference, BankAccountReference, CompanyReference } from "./reference-types";
import type { BankConfiguration } from "./setup-types";

function money(value: string | null | undefined, currency: string) {
  if (value == null) return "Unavailable";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "PHP" }).format(Number(value));
}

export default function BankReconciliationSetupModule() {
  const setup = usePeriodSetup();
  const { setError } = setup;
  const [authorized, setAuthorized] = useState(false), [accessError, setAccessError] = useState("");
  const [company, setCompany] = useState<CompanyReference | null>(null), [banks, setBanks] = useState<BankAccountReference[]>([]), [group, setGroup] = useState("");
  const [newKind, setNewKind] = useState<NewReference | null>(null), [configOpen, setConfigOpen] = useState(false), [configCompany, setConfigCompany] = useState<CompanyReference | null>(null), [configAccount, setConfigAccount] = useState<AccountReference | null>(null);
  const [busy, setBusy] = useState(false), [configError, setConfigError] = useState("");
  const period = setup.period, bank = setup.bank, draft = setup.draft, closed = period?.status === "CLOSED";
  useEffect(() => {
    getBankReconciliationContext().then(context => {
      if (!context.workspaces.some(item => item.key === "reconcile")) throw new Error("Reconcile module access is required.");
      setAuthorized(true);
    }).catch(e => setAccessError(e.message));
  }, []);
  useEffect(() => {
    if (!authorized) return;
    searchBankReconciliationReferences("bank-accounts", { pageSize: 100 }).then(data => setBanks(data.items)).catch(e => setAccessError(e.message));
  }, [authorized, bank?.id]);
  useEffect(() => {
    if (!draft?.companyId) return;
    getBankReconciliationReference("companies", draft.companyId).then(setCompany).catch(e => setError(e.message));
  }, [draft?.companyId, setError]);
  useEffect(() => {
    if (bank) setGroup(`${bank.bankName} · ${bank.branch}`);
  }, [bank]);
  const groups = [...new Set(banks.filter(item => !company || item.companyId == null || item.companyId === company.id).map(item => `${item.bankName} · ${item.branch}`))];
  if (accessError) return <p role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">{accessError}</p>;
  if (!authorized) return <p className="text-sm text-muted-foreground">Loading reconciliation setup…</p>;

  async function selectCompany(selected: CompanyReference) {
    if (bank?.companyId != null && bank.companyId !== selected.id) {
      setBusy(true);
      try { await setup.save(); setup.clear(); setGroup(""); setCompany(selected); }
      catch (e) { setup.setError(e instanceof Error ? e.message : "Save the current setup first."); }
      finally { setBusy(false); }
    } else { setCompany(selected); setup.change({ companyId: selected.id }); }
  }
  async function configure() {
    if (!bank) return; setBusy(true); setConfigError("");
    try {
      const current = await setup.save();
      const result = await saveBankConfiguration(bank.id, bank.version, configCompany?.id ?? null, configAccount?.id ?? null);
      setup.setBank(result);
      if (current) {
        const reloaded = await getSetupPeriod(current.id); setup.load(reloaded);
        setup.change({ companyId: result.companyId });
      }
      if (result.company) setCompany(result.company);
      setConfigOpen(false);
    } catch (e) { setConfigError(e instanceof Error ? e.message : "Unable to save bank configuration."); }
    finally { setBusy(false); }
  }
  function created(kind: NewReference, item: CompanyReference | AccountReference | BankConfiguration) {
    if (kind === "companies") {
      if (configOpen) setConfigCompany(item as CompanyReference);
      else { void selectCompany(item as CompanyReference); }
    } else if (kind === "bank-accounts") { setBanks(previous => [...previous, item as BankConfiguration]); void setup.selectBank(item.id, company?.id ?? null); }
    else setConfigAccount(item as AccountReference);
  }
  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Reconcile</h1><p className="mt-2 text-sm text-muted-foreground">Compare bank statement lines with the Cash in Bank ledger. Add transactions, import templates, or refresh posted ledger lines.</p></div>
      <div className="flex gap-2"><Button type="button" variant="outline" disabled={!draft || setup.loading || busy || closed} onClick={() => { void setup.save().catch(() => {}); }}>Save setup</Button>{period && <Button type="button" variant="outline" disabled={busy} onClick={() => { void setup.reload(); }}>Reload setup</Button>}</div>
    </div>
    <ReconcileExports key={bank?.id || 0} ready={Boolean(draft)} busy={busy || setup.loading} setBusy={setBusy} run={setup.run} />
    <section aria-label="Period setup" className="space-y-5 rounded-lg border bg-card p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <ReferenceChoice label="Entity" resource="companies" selected={company} disabled={setup.loading || busy || closed} onSelect={item => { void selectCompany(item as CompanyReference); }} onAdd={() => setNewKind("companies")} />
        <label className="min-w-0 space-y-2 text-sm"><span className="font-medium">Bank and branch</span><Input aria-label="Bank and branch" list="bank-branch-options" value={group} onChange={e => setGroup(e.target.value)} disabled={setup.loading || busy || closed} placeholder="Search bank or branch" /><datalist id="bank-branch-options">{groups.map(name => <option key={name} value={name} />)}</datalist><button type="button" className="text-xs text-primary underline" disabled={!company || busy || closed} onClick={() => setNewKind("bank-accounts")}>Add new bank/branch…</button></label>
        <ReferenceChoice label="Bank account" resource="bank-accounts" selected={bank} companyId={company?.id} bankGroup={groups.includes(group) ? group : undefined} disabled={setup.loading || busy || closed} onSelect={item => { void setup.selectBank(item.id, company?.id ?? null); }} onAdd={company ? () => setNewKind("bank-accounts") : undefined} />
        <label className="space-y-2 text-sm"><span className="font-medium">Currency</span><Input aria-label="Currency" value={draft?.currency || "PHP"} readOnly /></label>
        <label className="space-y-2 text-sm"><span className="font-medium">Period ended</span><Input type="date" aria-label="Period ended" value={draft?.periodEnd || ""} disabled={!draft || busy || setup.loading || closed} onChange={e => setup.change({ periodEnd: e.target.value })} /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm"><span className="font-medium">Statement opening balance</span><Input aria-label="Statement opening balance" inputMode="decimal" placeholder="Optional" value={draft?.statementOpening || ""} disabled={!draft || busy || closed} onChange={e => setup.change({ statementOpening: e.target.value })} /></label>
        <label className="space-y-2 text-sm"><span className="font-medium">Statement ending balance</span><Input aria-label="Statement ending balance" inputMode="decimal" value={draft?.statementEnding || ""} disabled={!draft || busy || closed} onChange={e => setup.change({ statementEnding: e.target.value })} /></label>
        <label className="space-y-2 text-sm"><span className="font-medium">Ledger balance before adjustments</span><Input aria-label="Ledger balance before adjustments" readOnly value={money(period?.ledgerBalance, draft?.currency || "PHP")} /></label>
      </div>
      {bank && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 p-3 text-sm"><div><span className="font-medium">Cash in Bank GL: </span>{bank.account ? `${bank.account.code} · ${bank.account.name}` : "Not configured"}<p className="mt-1 text-xs text-muted-foreground">{bank.company?.name || "Company not configured"}</p></div><Button type="button" size="sm" variant="outline" disabled={busy || closed} onClick={() => { setConfigCompany(bank.company || company); setConfigAccount(bank.account); setConfigError(""); setConfigOpen(true); }}>Configure bank account</Button></div>}
      {period && <><div className="text-sm text-amber-700 dark:text-amber-400">{period.ledgerBlockers.map(issue => <p key={issue}>{issue}</p>)}{period.setupWarning && <p>{period.setupWarning}</p>}</div><p className={`text-sm ${period.statementCheck.state === "WARNING" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{period.statementCheck.message}</p></>}
      {setup.error && <p role="alert" className="text-sm text-destructive">{setup.error}</p>}
      <p role="status" className="text-xs text-muted-foreground">{setup.loading ? "Loading saved setup…" : setup.status || "Select a bank account to begin. Setup changes save automatically."}</p>
    </section>
    <TransactionWorkbench period={period} run={setup.run} busy={busy || setup.loading} setBusy={setBusy} />
    <Dialog open={configOpen} onOpenChange={open => { if (!busy) setConfigOpen(open); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Configure bank account</DialogTitle><DialogDescription>Associate this bank with its company and a dedicated Cash in Bank GL account.</DialogDescription></DialogHeader>
      <ReferenceChoice label="Bank company" resource="companies" selected={configCompany} onSelect={item => setConfigCompany(item as CompanyReference)} onAdd={() => setNewKind("companies")} disabled={busy} />
      <ReferenceChoice label="Cash in Bank GL account" resource="accounts" selected={configAccount} onSelect={item => setConfigAccount(item as AccountReference)} currentAssets onAdd={() => setNewKind("accounts")} disabled={busy} />
      {configError && <p role="alert" className="text-sm text-destructive">{configError}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setConfigOpen(false)}>Cancel</Button><Button type="button" disabled={busy} onClick={() => { void configure(); }}>Save configuration</Button></DialogFooter>
    </DialogContent></Dialog>
    <CreateReferenceDialog kind={newKind} company={company} onClose={() => setNewKind(null)} onCreated={created} />
  </section>;
}
