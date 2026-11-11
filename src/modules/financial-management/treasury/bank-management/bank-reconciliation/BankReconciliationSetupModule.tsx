"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getBankReconciliationContext, getBankReconciliationReference } from "./providers/bankReconciliationReferencesApi";
import { getSetupPeriod, saveBankConfiguration } from "./providers/bankReconciliationSetupApi";
import { usePeriodSetup } from "./hooks/usePeriodSetup";
import { ReferenceChoice } from "./components/ReferenceChoice";
import { CreateReferenceDialog, type NewReference } from "./components/CreateReferenceDialog";
import { TransactionWorkbench } from "./components/TransactionWorkbench";
import { ReconcileExports } from "./components/ReconcileExports";
import type { AccountReference, BankBranchReference, CompanyReference } from "./reference-types";
import type { BankConfiguration } from "./setup-types";
import { PeriodHistoryChoice } from "./components/PeriodHistoryChoice";
import { PeriodLifecycle } from "./components/PeriodLifecycle";
import { useReconcileDrafts } from "./hooks/useReconcileDrafts";
import { ReconcileDraftDialogs } from "./components/ReconcileDraftDialogs";
import { useReferenceChoices } from "./hooks/useReferenceChoices";

function BankBranchChoice({ selected, companyId, disabled, onSelect }: { selected: BankBranchReference | null; companyId?: number; disabled?: boolean; onSelect: (group: BankBranchReference) => void }) {
  const choices = useReferenceChoices("bank-accounts", { companyId });
  const { open, search, page, items, total, loading, error } = choices;
  const groups = [...new Map(items.map(({ bankName, branch }) => [JSON.stringify([bankName, branch]), { bankName, branch }])).values()];
  return <Popover open={open} onOpenChange={choices.onOpenChange} modal>
    <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label="Bank and branch" aria-expanded={open} disabled={disabled} className="w-full min-w-0 justify-between font-normal"><span className={`min-w-0 flex-1 truncate text-left ${!selected ? "text-muted-foreground" : ""}`}>{selected ? `${selected.bankName} · ${selected.branch}` : "Select bank and branch"}</span><ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" /></Button></PopoverTrigger>
    <PopoverContent align="start" className="w-[max(22rem,var(--radix-popover-trigger-width))] max-w-[calc(100vw-2rem)] p-0">
      <Command shouldFilter={false}><CommandInput aria-label="Search bank and branch" placeholder="Search bank or branch..." value={search} onValueChange={choices.onSearchChange} />
        <CommandList className="max-h-64 overflow-y-auto overscroll-contain"><CommandEmpty>{loading ? "Loading bank branches..." : error || "No matching bank or branch."}</CommandEmpty>
          {!loading && !error && <CommandGroup>{groups.map(group => <CommandItem key={JSON.stringify(group)} value={JSON.stringify(group)} className="items-start whitespace-normal py-2" onSelect={() => { onSelect(group); choices.onOpenChange(false); }}><Check className={`mr-2 mt-0.5 size-4 shrink-0 ${selected?.bankName === group.bankName && selected?.branch === group.branch ? "opacity-100" : "opacity-0"}`} /><span className="min-w-0 whitespace-normal break-words">{group.bankName} · {group.branch}</span></CommandItem>)}</CommandGroup>}
        </CommandList>
        <div className="flex items-center justify-between gap-2 border-t p-2"><div className="flex shrink-0 items-center gap-2 whitespace-nowrap"><Button type="button" size="sm" variant="outline" disabled={loading || page === 1} onClick={choices.previous}>Previous</Button><span className="text-xs">Page {page}</span><Button type="button" size="sm" variant="outline" disabled={loading || page * 25 >= total} onClick={choices.next}>Next</Button></div></div>
      </Command>
    </PopoverContent>
  </Popover>;
}

function money(value: string | null | undefined, currency: string) {
  if (value == null) return "Unavailable";
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: /^[A-Z]{3}$/.test(currency) ? currency : "PHP" }).format(Number(value));
}

export default function BankReconciliationSetupModule() {
  const setup = usePeriodSetup();
  const { setError } = setup;
  const [authorized, setAuthorized] = useState(false), [accessError, setAccessError] = useState("");
  const [actorId, setActorId] = useState<number | null>(null);
  const [company, setCompany] = useState<CompanyReference | null>(null), [group, setGroup] = useState<BankBranchReference | null>(null);
  const [newKind, setNewKind] = useState<NewReference | null>(null), [configOpen, setConfigOpen] = useState(false), [configCompany, setConfigCompany] = useState<CompanyReference | null>(null), [configAccount, setConfigAccount] = useState<AccountReference | null>(null);
  const [busy, setBusy] = useState(false), [configError, setConfigError] = useState("");
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const drafts = useReconcileDrafts(actorId, setup), editorLocked = drafts.busy || Boolean(setup.bank && !drafts.ready);
  const period = setup.period, bank = setup.bank, draft = setup.draft, closed = period?.status === "CLOSED";
  const selectedBankId = bank?.id, selectedBankName = bank?.bankName, selectedBranch = bank?.branch;
  const nextMonth = period?.lifecycle?.nextAllowedMonth;
  const lastDay = nextMonth ? new Date(Date.UTC(Number(nextMonth.slice(0, 4)), Number(nextMonth.slice(5, 7)), 0)).toISOString().slice(0, 10) : undefined;
  useEffect(() => {
    getBankReconciliationContext().then(context => {
      if (!context.workspaces.some(item => item.key === "reconcile")) throw new Error("Reconcile module access is required.");
      setActorId(context.actor.id);
      setAuthorized(true);
    }).catch(e => setAccessError(e.message));
  }, []);
  useEffect(() => {
    if (!draft?.companyId) return;
    if (closed && bank?.company) { setCompany(bank.company); return; }
    getBankReconciliationReference("companies", draft.companyId).then(setCompany).catch(e => setError(e.message));
  }, [draft?.companyId, setError, closed, bank?.company]);
  useEffect(() => {
    if (selectedBankId) setGroup({ bankName: selectedBankName || "", branch: selectedBranch || "" });
  }, [selectedBankId, selectedBankName, selectedBranch]);
  if (accessError) return <p role="alert" className="rounded-lg border border-destructive p-4 text-sm text-destructive">{accessError}</p>;
  if (!authorized) return <p className="text-sm text-muted-foreground">Loading reconciliation setup…</p>;

  async function selectCompany(selected: CompanyReference) {
    if (bank?.companyId != null && bank.companyId !== selected.id) {
      setBusy(true);
      try { await setup.save(); setup.clear(); setGroup(null); setCompany(selected); }
      catch (e) { setup.setError(e instanceof Error ? e.message : "Save the current setup first."); }
      finally { setBusy(false); }
    } else { setCompany(selected); drafts.changeSetup({ companyId: selected.id }); }
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
      else { drafts.requestAction(() => selectCompany(item as CompanyReference)); }
    } else if (kind === "bank-accounts") { drafts.requestAction(() => setup.selectBank(item.id, company?.id ?? null)); }
    else setConfigAccount(item as AccountReference);
  }
  return <section className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold tracking-tight">Reconcile</h1><p className="mt-2 text-sm text-muted-foreground">Compare bank statement lines with the Cash in Bank ledger. Add transactions, import templates, or refresh posted ledger lines.</p></div>
      <div className="flex flex-wrap gap-2"><PeriodHistoryChoice period={period} disabled={busy || lifecycleBusy || setup.loading || drafts.busy} onSelect={async (id, closureId) => { drafts.requestAction(() => setup.selectPeriod(id, closureId)); }} /><Button type="button" variant="outline" disabled={!draft || setup.loading || busy || lifecycleBusy || closed || editorLocked} onClick={() => { void setup.save().catch(() => {}); }}>Save setup</Button>{period && <Button type="button" variant="outline" disabled={busy || lifecycleBusy || drafts.busy} onClick={() => drafts.requestAction(setup.reload)}>Reload setup</Button>}</div>
    </div>
    <ReconcileDraftDialogs drafts={drafts} />
    {period && <PeriodLifecycle key={period.id} period={period} workspace="reconcile" disabled={busy || setup.loading} onBusy={setLifecycleBusy} onDone={setup.selectPeriod} before={setup.save} />}
    <ReconcileExports key={bank?.id || 0} ready={Boolean(draft)} busy={busy || lifecycleBusy || setup.loading || editorLocked} setBusy={setBusy} run={setup.run} />
    <fieldset disabled={lifecycleBusy || editorLocked} aria-label="Period setup" className="space-y-5 rounded-lg border bg-card p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <ReferenceChoice label="Entity" resource="companies" selected={company} disabled={setup.loading || busy || closed} onSelect={item => { const selected = item as CompanyReference; if (bank?.companyId != null && bank.companyId !== selected.id) drafts.requestAction(() => selectCompany(selected)); else void selectCompany(selected); }} onAdd={() => setNewKind("companies")} />
        <label className="min-w-0 space-y-2 text-sm"><span className="font-medium">Bank and branch</span><BankBranchChoice selected={group} companyId={closed ? undefined : company?.id} disabled={setup.loading || busy || closed} onSelect={setGroup} /><button type="button" className="text-xs text-primary underline" disabled={!company || busy || closed} onClick={() => setNewKind("bank-accounts")}>Add new bank/branch…</button></label>
        <ReferenceChoice label="Bank account" resource="bank-accounts" selected={bank} companyId={closed ? undefined : company?.id} bankGroup={!closed && group ? group : undefined} disabled={setup.loading || busy} onSelect={item => drafts.requestAction(() => setup.selectBank(item.id, company?.id ?? null))} onAdd={!closed && company ? () => setNewKind("bank-accounts") : undefined} />
        <label className="space-y-2 text-sm"><span className="font-medium">Currency</span><Input aria-label="Currency" value={draft?.currency || "PHP"} readOnly /></label>
        <label className="space-y-2 text-sm"><span className="font-medium">Period ended</span><Input type="date" aria-label="Period ended" min={nextMonth ? `${nextMonth}-01` : undefined} max={lastDay} value={draft?.periodEnd || ""} disabled={!draft || busy || setup.loading || closed} onChange={e => drafts.changeSetup({ periodEnd: e.target.value })} /></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="space-y-2 text-sm"><span className="font-medium">Statement opening balance</span><Input aria-label="Statement opening balance" inputMode="decimal" placeholder="Optional" value={draft?.statementOpening || ""} disabled={!draft || busy || closed} onChange={e => drafts.changeSetup({ statementOpening: e.target.value })} /></label>
        <label className="space-y-2 text-sm"><span className="font-medium">Statement ending balance</span><Input aria-label="Statement ending balance" inputMode="decimal" value={draft?.statementEnding || ""} disabled={!draft || busy || closed} onChange={e => drafts.changeSetup({ statementEnding: e.target.value })} /></label>
        <label className="space-y-2 text-sm"><span className="font-medium">Ledger balance before adjustments</span><Input aria-label="Ledger balance before adjustments" readOnly value={money(period?.ledgerBalance, draft?.currency || "PHP")} /></label>
      </div>
      {bank && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-muted/40 p-3 text-sm"><div><span className="font-medium">Cash in Bank GL: </span>{bank.account ? `${bank.account.code} · ${bank.account.name}` : "Not configured"}<p className="mt-1 text-xs text-muted-foreground">{bank.company?.name || "Company not configured"}</p></div><Button type="button" size="sm" variant="outline" disabled={busy || closed} onClick={() => { setConfigCompany(bank.company || company); setConfigAccount(bank.account); setConfigError(""); setConfigOpen(true); }}>Configure bank account</Button></div>}
      {period && <><div className="text-sm text-amber-700 dark:text-amber-400">{period.ledgerBlockers.map(issue => <p key={issue}>{issue}</p>)}{period.setupWarning && <p>{period.setupWarning}</p>}</div><p className={`text-sm ${period.statementCheck.state === "WARNING" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}>{period.statementCheck.message}</p></>}
      {setup.error && <p role="alert" className="text-sm text-destructive">{setup.error}</p>}
      <p role="status" className="text-xs text-muted-foreground">{setup.loading ? "Loading saved setup…" : setup.status || "Select a bank account to begin. Setup changes save automatically."}</p>
    </fieldset>
    <TransactionWorkbench period={period} run={setup.run} busy={busy || lifecycleBusy || setup.loading || editorLocked} setBusy={setBusy} drafts={drafts} />
    <Dialog open={configOpen} onOpenChange={open => { if (!busy) setConfigOpen(open); }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Configure bank account</DialogTitle><DialogDescription>Associate this bank with its company and a dedicated Cash in Bank GL account.</DialogDescription></DialogHeader>
      <ReferenceChoice label="Bank company" resource="companies" selected={configCompany} onSelect={item => setConfigCompany(item as CompanyReference)} onAdd={() => setNewKind("companies")} disabled={busy} />
      <ReferenceChoice label="Cash in Bank GL account" resource="accounts" selected={configAccount} onSelect={item => setConfigAccount(item as AccountReference)} currentAssets onAdd={() => setNewKind("accounts")} disabled={busy} />
      {configError && <p role="alert" className="text-sm text-destructive">{configError}</p>}<DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setConfigOpen(false)}>Cancel</Button><Button type="button" disabled={busy} onClick={() => { void configure(); }}>Save configuration</Button></DialogFooter>
    </DialogContent></Dialog>
    <CreateReferenceDialog kind={newKind} company={company} onClose={() => setNewKind(null)} onCreated={created} />
  </section>;
}
