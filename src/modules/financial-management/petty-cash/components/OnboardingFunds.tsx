"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Choice, Fund, FundReference, Page, Settings } from "../onboarding-types";
import { useOnboardingCommand, useOnboardingRead } from "../hooks/useOnboarding";
import { OnboardingError } from "../providers/onboarding.api";
import { OnboardingChoice } from "./OnboardingChoice";
import { ErrorBox, Field, Paging } from "./OnboardingCommon";

const money = (value: number | null) => value == null ? "—" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(value);
const reference = (value: FundReference | null) => value ? `${value.code} · ${value.name}` : "Not recorded";
const status = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const fieldLabels: Record<string, string> = { name: "Fund name", branchId: "Branch", departmentId: "Department", custodianId: "Custodian", fundAccount: "Fund account", imprestAmount: "Imprest amount", perVoucherLimit: "Per-voucher limit", approvalThreshold: "Approval threshold", version: "Request", policyVersion: "Policy" };

export function OnboardingFunds({ requesterName, canSubmit }: { requesterName: string; canSubmit: boolean }) {
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1); const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null); const [saved, setSaved] = useState<Fund | null>(null);
  const { data, loading, error, refresh } = useOnboardingRead<Page<Fund>>(`funds?${new URLSearchParams({ search, page: String(page), pageSize: "25" })}`, 250);
  return <div className="space-y-4 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Fund requests</h2>
    {canSubmit && <Button onClick={() => setCreating(true)}>New fund request</Button>}</div>
    <p className="text-sm text-muted-foreground">Submit a request for independent approval. Pending requests are not funded and cannot pay vouchers.</p>
    {saved && <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"><span>{saved.docNo} submitted · Pending · Not funded.</span><Button size="sm" variant="outline" onClick={() => setSelectedId(saved.id)}>View submitted request</Button></div>}
    <Input aria-label="Search funds" placeholder="Search fund number or name" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /><ErrorBox error={error} retry={refresh} />
    {loading && <p role="status">Loading funds...</p>}{data && <><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{["Fund", "Branch / Department", "Custodian", "Imprest", "Per voucher", "Approval above", "Requested by", "Status", "Details"].map(label => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>
      {data.items.map(item => <tr className="border-t" key={item.id}><td className="p-3"><span className="font-medium">{item.docNo}</span><span className="block text-muted-foreground">{item.name || "—"}</span></td>
        <td className="p-3">{item.branch?.name || "—"}<span className="block text-muted-foreground">{item.department?.name || "—"}</span></td><td className="p-3">{item.custodian?.name || "—"}</td>
        <td className="whitespace-nowrap p-3">{money(item.imprestAmount)}</td><td className="whitespace-nowrap p-3">{money(item.perVoucherLimit)}</td><td className="whitespace-nowrap p-3">{money(item.approvalThreshold)}</td>
        <td className="p-3">{item.requestedBy?.name || "—"}<span className="block whitespace-nowrap text-xs text-muted-foreground">{item.createdAt?.replace("T", " ")}</span></td><td className="p-3">{status(item.status)}</td>
        <td className="p-3"><Button size="sm" variant="outline" aria-label={`View ${item.docNo}`} onClick={() => setSelectedId(item.id)}>Details</Button></td></tr>)}
      {!data.items.length && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No fund requests yet.</td></tr>}
    </tbody></table></div><Paging page={page} total={data.total} pageSize={data.pageSize} onChange={setPage} /></>}
    {creating && <FundRequestDialog requesterName={requesterName} onClose={() => setCreating(false)} onSaved={fund => { setCreating(false); setSaved(fund); setSearch(""); setPage(1); refresh(); }} />}
    {selectedId !== null && <FundDetails id={selectedId} onClose={() => setSelectedId(null)} />}
  </div>;
}

function FundRequestDialog({ requesterName, onClose, onSaved }: { requesterName: string; onClose: () => void; onSaved: (fund: Fund) => void }) {
  const [name, setName] = useState(""); const [branch, setBranch] = useState<Choice | null>(null); const [department, setDepartment] = useState<Choice | null>(null); const [custodian, setCustodian] = useState<Choice | null>(null);
  const [imprest, setImprest] = useState(""); const [limit, setLimit] = useState(""); const [threshold, setThreshold] = useState("");
  const policy = useOnboardingRead<Settings>("settings"); const command = useOnboardingCommand();
  const accounts = policy.data?.resolvedAccounts.PETTY_CASH_FUND || []; const account = accounts.length === 1 ? accounts[0] : null;
  const accountReady = Boolean(account?.eligible);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!policy.data || !accountReady) return;
    const result = await command.run<Fund>("funds/submit", "POST", { version: 0, policyVersion: policy.data.version, name, branchId: branch?.id ?? null, departmentId: department?.id ?? null, custodianId: custodian?.id ?? null,
      imprestAmount: imprest.trim() || null, perVoucherLimit: limit.trim() || null, approvalThreshold: threshold.trim() || null });
    if (result) onSaved(result);
  }
  const errors = command.error instanceof OnboardingError ? command.error.fields : {};
  return <Dialog open onOpenChange={open => { if (!open && !command.busy) onClose(); }}><DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-4xl" onEscapeKeyDown={event => { if (command.busy) event.preventDefault(); }} onInteractOutside={event => { if (command.busy) event.preventDefault(); }}>
    <DialogHeader><DialogTitle>New fund request</DialogTitle><DialogDescription>Submit as Pending. Independent approval and funding are delivered in the next increment.</DialogDescription></DialogHeader>
    <form noValidate onSubmit={submit} className="space-y-4"><fieldset disabled={command.busy} className="space-y-4">
      <Field label="Fund name" id="fund-name" value={name} onChange={setName} maxLength={128} required />
      <div className="grid gap-4 md:grid-cols-2"><OnboardingChoice label="Branch" resource="branches" selected={branch} onSelect={setBranch} disabled={command.busy} />
        <OnboardingChoice label="Department" resource="departments" selected={department} onSelect={setDepartment} disabled={command.busy} />
        <OnboardingChoice label="Custodian" resource="personnel" selected={custodian} onSelect={setCustodian} disabled={command.busy} />
        <Field label="Division" id="fund-division" value={department?.classification || "Select a department"} onChange={() => {}} disabled />
        <Field label="Imprest amount (PHP)" id="fund-imprest" type="number" value={imprest} onChange={setImprest} required />
        <Field label="Per-voucher limit (PHP)" id="fund-limit" type="number" value={limit} onChange={setLimit} required />
        <Field label="Approval threshold (PHP)" id="fund-threshold" type="number" value={threshold} onChange={setThreshold} required />
        <Field label="Requested by" id="fund-requester" value={requesterName} onChange={() => {}} disabled />
      </div>
      <div className="space-y-2 rounded-lg border p-3 text-sm"><p className="font-medium">Fund account (policy mapping)</p>
        {policy.loading ? <p role="status">Loading fund account...</p> : <p>{account ? `${account.code} · ${account.name}` : "No Petty Cash Fund account configured."}</p>}
        {!policy.loading && !policy.error && !accountReady && <p role="alert" className="text-destructive">{account?.reason || "Configure a suitable Petty Cash Fund account in Company & Policy Settings before submitting."}</p>}
        <ErrorBox error={policy.error} retry={policy.refresh} />
        <p className="text-xs text-muted-foreground">The funding cash/bank account may be configured before approval. This request does not move cash or post a journal.</p>
      </div>
      <p className="text-sm text-muted-foreground">All amounts must be positive. Approval threshold ≤ per-voucher limit ≤ imprest amount.</p>
      {command.error && <div role="alert" className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"><p>{command.error.message}</p>
        {Object.entries(errors).map(([field, message]) => <p key={field}>{fieldLabels[field] || field}: {message}</p>)}
        {command.error instanceof OnboardingError && command.error.requestId && <p className="text-xs">Reference: {command.error.requestId}</p>}
      </div>}
      {command.error instanceof OnboardingError && command.error.status === 409 && command.error.message.startsWith("Policy settings changed.") && <Button type="button" variant="outline" onClick={policy.refresh}>Reload policy and review account</Button>}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={command.busy || policy.loading || !accountReady}>{command.busy ? "Submitting..." : "Submit for approval"}</Button></div>
    </fieldset></form>
  </DialogContent></Dialog>;
}

function FundDetails({ id, onClose }: { id: number; onClose: () => void }) {
  const { data, loading, error, refresh } = useOnboardingRead<Fund>(`funds/${id}`);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader>
    <DialogTitle>Fund request details</DialogTitle><DialogDescription>Submitted values are retained for independent review.</DialogDescription></DialogHeader>
    {loading && <p role="status">Loading fund request...</p>}<ErrorBox error={error} retry={refresh} />
    {data && <><dl className="grid gap-4 text-sm sm:grid-cols-2">{[
      ["Fund number", data.docNo], ["Fund name", data.name || "—"], ["Status", status(data.status)], ["Requested on (PHT)", data.createdAt.replace("T", " ")],
      ["Branch", reference(data.branch)], ["Department", reference(data.department)], ["Division", reference(data.division)], ["Custodian", reference(data.custodian)],
      ["Imprest amount", money(data.imprestAmount)], ["Per-voucher limit", money(data.perVoucherLimit)], ["Approval threshold", money(data.approvalThreshold)],
      ["Fund account", reference(data.fundAccount)], ["Requested by", data.requestedBy?.name || "Not recorded"], ["Expected cash", money(data.expectedCash)],
    ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>
      {data.status === "PENDING" && <p className="rounded-lg border p-3 text-sm">Pending · Not funded. This request cannot pay vouchers and has not posted a journal.</p>}
      <p className="text-xs text-muted-foreground">Request version {data.version} · Submitted policy version {data.policyVersion ?? "Not recorded"}</p></>}
    <div className="flex justify-end"><Button variant="outline" onClick={onClose}>Close details</Button></div>
  </DialogContent></Dialog>;
}
