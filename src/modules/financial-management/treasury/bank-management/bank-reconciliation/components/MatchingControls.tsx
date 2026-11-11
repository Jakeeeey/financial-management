"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AccountReference } from "../reference-types";
import type { ReconciliationPeriod } from "../setup-types";
import type { ReconciliationSummary, TransactionLine, TransactionResult, TransactionSide } from "../transaction-types";
import { setBankOffset, setBankTreatment, setMatchOffset, unmatchTransactions } from "../providers/bankReconciliationTransactionsApi";
import { centsAmount, transactionCents, transactionMoney } from "../utils/transactionDisplay";
import { ReferenceChoice } from "./ReferenceChoice";
import { CreateReferenceDialog } from "./CreateReferenceDialog";

export type Selection = { BANK: TransactionLine[]; LEDGER: TransactionLine[] };
export type TransactionCommand = (operation: (period: ReconciliationPeriod) => Promise<TransactionResult>) => Promise<TransactionResult>;
export function OffsetAccountChoice({ label, selected, period, disabled, onChange, clearable = false }: {
  label: string; selected: AccountReference | null; period: ReconciliationPeriod; disabled: boolean;
  onChange: (account: AccountReference | null) => void; clearable?: boolean;
}) {
  const [creating, setCreating] = useState(false);
  return <>
    <ReferenceChoice label={label} resource="accounts" selected={selected} disabled={disabled} excludeIds={period.bank.glCoaId == null ? [] : [period.bank.glCoaId]} onSelect={item => onChange(item as AccountReference)} onAdd={() => setCreating(true)} onClear={clearable ? () => onChange(null) : undefined} />
    <CreateReferenceDialog kind={creating ? "accounts" : null} company={period.bank.company} onClose={() => setCreating(false)} onCreated={(_kind, item) => { setCreating(false); onChange(item as AccountReference); }} />
  </>;
}
export function ReconciliationProof({ summary, currency, readState }: { summary?: ReconciliationSummary; currency: string; readState?: "loading" | "error" }) {
  const values: [string, string | null | undefined][] = [["Adjusted bank balance", summary?.adjustedBankBalance], ["Adjusted book balance", summary?.adjustedBookBalance], ["Difference", summary?.difference]];
  return <section aria-label="Reconciliation proof" className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">
    {values.map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p aria-label={label} className="mt-1 break-words text-lg font-semibold tabular-nums">{readState === "loading" ? "Loading…" : value == null ? "Unavailable" : transactionMoney(value, currency)}</p></div>)}
    <div><p className={`font-semibold ${summary?.status === "RECONCILED" ? "text-emerald-700 dark:text-emerald-400" : summary?.status === "UNRECONCILED" ? "text-destructive" : "text-amber-700 dark:text-amber-400"}`}>{readState ? readState === "loading" ? "Loading reconciliation…" : "Reconciliation unavailable" : summary?.statusLabel || "Complete setup"}</p><p className="mt-1 text-xs text-muted-foreground">{readState ? "Current balances are available after the transactions load successfully." : summary ? `${summary.matchedLines} of ${summary.totalLines} lines matched · ${summary.unpostedCount} adjustments to post` : "Save the setup and load the ledger to calculate the proof."}</p></div>
  </section>;
}
export function MatchSelection({ selected, period, busy, hidden, onClear, onMatch }: {
  selected: Selection; period: ReconciliationPeriod; busy: boolean; hidden?: boolean; onClear: () => void;
  onMatch: (classification: string | null, account: number | null) => void;
}) {
  const [kind, setKind] = useState(""), [account, setAccount] = useState<AccountReference | null>(null);
  const bank = selected.BANK.reduce((sum, line) => sum + transactionCents(line.amount), 0n), ledger = selected.LEDGER.reduce((sum, line) => sum + transactionCents(line.amount), 0n), difference = bank - ledger;
  const both = selected.BANK.length > 0 && selected.LEDGER.length > 0, locked = busy || period.status === "CLOSED";
  return <section aria-label="Match selection" hidden={hidden} className="sticky bottom-0 z-10 space-y-3 rounded-lg border bg-background p-4 shadow-lg">
    <div className="flex flex-wrap items-center gap-5"><div><p className="text-xs text-muted-foreground">Bank · {selected.BANK.length} selected</p><p className="font-semibold">{transactionMoney(centsAmount(bank), period.currency)}</p></div><div><p className="text-xs text-muted-foreground">Ledger · {selected.LEDGER.length} selected</p><p className="font-semibold">{transactionMoney(centsAmount(ledger), period.currency)}</p></div><div><p className="text-xs text-muted-foreground">Difference</p><p aria-label="Match difference" className={`font-semibold ${difference === 0n ? "text-emerald-700 dark:text-emerald-400" : "text-destructive"}`}>{transactionMoney(centsAmount(difference), period.currency)}</p></div></div>
    {both && difference !== 0n && <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2 text-sm"><span className="font-medium">Treat difference as</span><select aria-label="Treat difference as" value={kind} disabled={locked} onChange={e => { setKind(e.target.value); setAccount(null); }} className="block h-9 w-full rounded-md border bg-background px-3"><option value="">Classify the difference</option><option value="BOOK_ERROR">Book error, correct with an entry</option><option value="BANK_ERROR">Bank error, bank to correct</option></select></label>{kind === "BOOK_ERROR" && <OffsetAccountChoice label="Match offset account" selected={account} period={period} disabled={locked} onChange={setAccount} />}</div>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-muted-foreground">{both ? "Selection is kept across pages and filters." : "Select at least one unmatched line on each side."}</p><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={busy} onClick={onClear}>Clear selection</Button><Button type="button" size="sm" disabled={locked || !both || difference !== 0n && !(kind === "BANK_ERROR" || kind === "BOOK_ERROR" && account)} onClick={() => onMatch(difference === 0n ? null : kind, difference !== 0n && kind === "BOOK_ERROR" ? account?.id ?? null : null)}>Match</Button></div></div>
  </section>;
}
export function LineTreatment({ line, side, period, busy, command, onError }: {
  line: TransactionLine; side: TransactionSide; period: ReconciliationPeriod; busy: boolean; command: TransactionCommand; onError: (message: string) => void;
}) {
  const locked = busy || period.status === "CLOSED", name = line.reference || String(line.id);
  async function apply(operation: (p: ReconciliationPeriod) => Promise<TransactionResult>) {
    onError("");try { await command(operation); } catch (e) { onError(e instanceof Error ? e.message : "Unable to update the transaction."); }
  }
  return <div className="mt-2 flex flex-wrap items-end gap-3">
    {line.canEditTreatment && <label className="min-w-0 space-y-1"><span className="block text-xs text-muted-foreground">Treatment</span><select aria-label={`Treatment for ${name}`} value={line.treatment || "RECORD_IN_BOOKS"} disabled={locked} className="h-9 max-w-full rounded-md border bg-background px-2 text-sm" onChange={e => { const treatment = e.target.value; void apply(p => setBankTreatment(p, line.id, treatment)); }}><option value="RECORD_IN_BOOKS">{line.amount.startsWith("-") ? "Debit memo" : "Credit memo"}: record in books</option><option value="BANK_ERROR">Bank error, bank to correct</option></select></label>}
    {line.canEditOffset && <div className="w-full max-w-sm"><OffsetAccountChoice label={`Offset account for ${line.matchLabel ? `${line.matchLabel} · ` : ""}${name}`} selected={line.offsetAccountReference} period={period} disabled={locked} clearable={line.matchId == null} onChange={account => { void apply(p => line.matchId == null ? setBankOffset(p, line.id, account?.id ?? null) : setMatchOffset(p, line.matchId, account?.id ?? null)); }} /></div>}
    {line.canUnmatch && <Button type="button" size="sm" variant="outline" disabled={locked} aria-label={`Unmatch ${line.matchLabel} for ${side.toLowerCase()} line ${name}`} onClick={() => { void apply(p => unmatchTransactions(p, line.matchId!)); }}>Unmatch {line.matchLabel}</Button>}
  </div>;
}
