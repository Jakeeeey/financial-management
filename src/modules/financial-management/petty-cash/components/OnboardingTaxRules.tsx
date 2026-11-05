"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Page, TaxRule } from "../onboarding-types";
import { useOnboardingCommand, useOnboardingRead } from "../hooks/useOnboarding";
import { ErrorBox, Field, NativeSelect, Paging } from "./OnboardingCommon";

const documents = { INVOICE: "Invoice", OFFICIAL_RECEIPT: "Official receipt", ACKNOWLEDGEMENT: "Acknowledgement receipt", OTHER: "Other" };
export function OnboardingTaxRules() {
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [editor, setEditor] = useState<TaxRule | "new" | null>(null); const [saved, setSaved] = useState(false);
  const query = new URLSearchParams({ search, page: String(page), pageSize: "25" });
  const { data, loading, error, refresh } = useOnboardingRead<Page<TaxRule>>(`tax-rules?${query}`, 250);
  return <section className="space-y-4 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Verified tax rules</h2><p className="mt-1 text-sm text-muted-foreground">Maintain Accounting-reviewed VAT and ATC definitions. No rates from the prototype are preselected.</p></div><Button type="button" onClick={() => setEditor("new")}>Add tax rule</Button></div>
    {saved && <p role="status" className="text-sm text-green-800">Tax rule saved.</p>}<Input aria-label="Search tax rules" placeholder="Search code or source reference" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} />
    <ErrorBox error={error} retry={refresh} />{loading && <p role="status">Loading tax rules...</p>}
    {data && <><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{["Code", "Kind", "Payee classification", "Rate (%)", "Effective dates", "Verification", "Action"].map(label => <th className="p-3" key={label}>{label}</th>)}</tr></thead><tbody>
      {data.items.map(rule => <tr className="border-t" key={rule.id}><td className="p-3 font-medium">{rule.code}</td><td className="p-3">{rule.ruleKind}</td><td className="p-3">{rule.payeeKind}</td><td className="p-3">{rule.rate}</td><td className="p-3 whitespace-nowrap">{rule.effectiveFrom} – {rule.effectiveTo || "Open ended"}</td><td className="p-3">{rule.state}</td><td className="p-3"><Button type="button" variant="outline" size="sm" onClick={() => setEditor(rule)}>{rule.state === "DRAFT" ? "Edit rule" : "View rule"}</Button></td></tr>)}
      {!data.items.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No tax rules configured.</td></tr>}
    </tbody></table></div><Paging page={page} total={data.total} pageSize={data.pageSize} onChange={setPage} /></>}
    <Dialog open={editor !== null} onOpenChange={open => { if (!open) setEditor(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editor === "new" ? "Add tax rule" : "Tax rule"}</DialogTitle><DialogDescription>Record verified source information and applicable dates. Verified values are retained as history.</DialogDescription></DialogHeader>
      {editor && <TaxForm key={editor === "new" ? "new" : `${editor.id}-${editor.version}`} rule={editor === "new" ? null : editor} onSaved={() => { setEditor(null); setSaved(true); refresh(); }} onAmend={() => { if (editor !== "new") setEditor({ ...editor, id: 0, version: 0, state: "DRAFT", verifiedAt: null, verifiedBy: null }); }} />}
    </DialogContent></Dialog>
  </section>;
}
function TaxForm({ rule, onSaved, onAmend }: { rule: TaxRule | null; onSaved: () => void; onAmend: () => void }) {
  const [kind, setKind] = useState(rule?.ruleKind || "VAT"); const [code, setCode] = useState(rule?.code || "");
  const [payeeKind, setPayeeKind] = useState(rule?.payeeKind || "BOTH"); const [rate, setRate] = useState(rule ? String(rule.rate) : "");
  const [from, setFrom] = useState(rule?.effectiveFrom || ""); const [to, setTo] = useState(rule?.effectiveTo || "");
  const [docs, setDocs] = useState(rule?.documentTypes || []); const [state, setState] = useState(rule?.state || "DRAFT");
  const [source, setSource] = useState(rule?.sourceReference || ""); const [note, setNote] = useState(rule?.verificationNote || "");
  const command = useOnboardingCommand(); const locked = Boolean(rule && rule.state !== "DRAFT");
  async function save(nextState = state) {
    const result = await command.run<TaxRule>(rule?.id ? `tax-rules/${rule.id}` : "tax-rules", rule?.id ? "PUT" : "POST", { version: rule?.version || 0, ruleKind: kind, code, payeeKind, rate: Number(rate), effectiveFrom: from, effectiveTo: to || null, documentTypes: docs, state: nextState, sourceReference: source, verificationNote: note });
    if (result) onSaved();
  }
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}><fieldset disabled={locked || command.busy} className="grid gap-4 sm:grid-cols-2">
    <NativeSelect label="Tax kind" id="tax-kind" value={kind} onChange={value => { setKind(value as "VAT" | "EWT"); if (value === "EWT" && payeeKind === "BOTH") setPayeeKind("INDIVIDUAL"); }}><option value="VAT">VAT</option><option value="EWT">EWT / ATC</option></NativeSelect>
    <Field label="Rule / ATC code" id="tax-code" value={code} onChange={setCode} maxLength={32} required />
    <NativeSelect label="Payee classification" id="tax-payee-kind" value={payeeKind} onChange={value => setPayeeKind(value as TaxRule["payeeKind"])}><option value="INDIVIDUAL">Individual</option><option value="CORPORATION">Corporation</option>{kind === "VAT" && <option value="BOTH">Both</option>}</NativeSelect>
    <Field label="Rate (%)" id="tax-rate" value={rate} onChange={setRate} type="number" required />
    <Field label="Effective from" id="tax-from" value={from} onChange={setFrom} type="date" required /><Field label="Effective to (inclusive)" id="tax-to" value={to} onChange={setTo} type="date" />
    <div className="space-y-2 sm:col-span-2"><p className="text-sm font-medium">Eligible document types</p><div className="flex flex-wrap gap-4">{Object.entries(documents).map(([id, label]) => <label key={id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={docs.includes(id)} onChange={event => setDocs(previous => event.target.checked ? [...previous, id] : previous.filter(item => item !== id))} />{label}</label>)}</div></div>
    <Field label="Accounting-reviewed source reference" id="tax-source" value={source} onChange={setSource} maxLength={1000} /><Field label="Verification notes" id="tax-note" value={note} onChange={setNote} maxLength={1000} />
    <NativeSelect label="Verification state" id="tax-state" value={state} onChange={value => setState(value as TaxRule["state"])}><option value="DRAFT">Draft — unavailable for tax use</option><option value="VERIFIED">Verified — source reviewed by Accounting</option></NativeSelect>
  </fieldset>
    {state === "VERIFIED" && !locked && <p className="text-sm text-amber-800">Saving as Verified records your identity and time as the verifier. Confirm Accounting has reviewed the rate, applicability, dates and source reference.</p>}
    {locked && <div className="rounded-lg border p-3 text-sm"><p>{rule?.state}. Verified by user {rule?.verifiedBy ?? "—"} at {rule?.verifiedAt || "—"}.</p><p>Verified values cannot be edited. Create a draft amendment for a new rate or period.</p></div>}
    <ErrorBox error={command.error} /><div className="flex flex-wrap gap-2">{!locked && <Button type="submit" disabled={command.busy}>{command.busy ? "Saving..." : "Save tax rule"}</Button>}
      {locked && <Button type="button" variant="outline" onClick={onAmend}>Create draft amendment</Button>}{rule?.state === "VERIFIED" && <Button type="button" variant="outline" disabled={command.busy} onClick={() => void save("RETIRED")}>Retire rule</Button>}
    </div>
  </form>;
}
