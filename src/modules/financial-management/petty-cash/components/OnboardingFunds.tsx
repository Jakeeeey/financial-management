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
const status = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();
const choice = (value: FundReference | null): Choice | null => value ? { ...value, status: "REGISTERED", classification: "", eligible: true, reason: null, details: {} } : null;

export function OnboardingFunds({ requesterName, canSubmit, canEdit, canDelete }: { requesterName: string; canSubmit: boolean; canEdit: boolean; canDelete: boolean }) {
  const [page, setPage] = useState(1), [editor, setEditor] = useState<Fund | "new" | null>(null), [deleting, setDeleting] = useState<Fund | null>(null), [message, setMessage] = useState("");
  const { data, loading, error, refresh } = useOnboardingRead<Page<Fund>>(`funds?page=${page}&pageSize=25`);
  function saved(fund: Fund) { setEditor(null); setMessage(`${fund.docNo} ${editor === "new" ? "sent to Onboarding Approval" : "updated"}.`); refresh(); }
  return <div className="space-y-4 rounded-xl border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Fund requests</h2>{canSubmit && <Button onClick={() => setEditor("new")}>+ New fund request</Button>}</div>
    {message && <p role="status" className="text-sm">{message}</p>}<ErrorBox error={error} retry={refresh} />{loading && <p role="status">Loading funds...</p>}
    {data && <><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{["Fund", "Department", "Custodian", "Imprest", "Per voucher", "Approval above", "Requested by", "Status", ...(canEdit || canDelete ? [""] : [])].map((label, i) => <th key={i} className="p-3">{label}</th>)}</tr></thead><tbody>
      {data.items.map(item => <tr className="border-t" key={item.id}><td className="p-3"><span>{item.docNo}</span><strong className="block">{item.name || "—"}</strong></td><td className="p-3">{item.department?.name || "—"}</td><td className="p-3">{item.custodian?.name || "—"}</td>
        <td className="whitespace-nowrap p-3">{money(item.imprestAmount)}</td><td className="whitespace-nowrap p-3">{money(item.perVoucherLimit)}</td><td className="whitespace-nowrap p-3">{money(item.approvalThreshold)}</td><td className="p-3">{item.requestedBy?.name || "—"}<small className="block text-muted-foreground">{item.createdAt?.slice(0, 10)}</small></td><td className="p-3">{status(item.status)}</td>
        {(canEdit || canDelete) && <td className="p-3">{item.status === "PENDING" && <div className="flex gap-2">{canEdit && <Button size="sm" variant="outline" aria-label={`Edit ${item.docNo}`} onClick={() => setEditor(item)}>Edit</Button>}{canDelete && <Button size="sm" variant="outline" aria-label={`Delete ${item.docNo}`} onClick={() => setDeleting(item)}>Delete</Button>}</div>}</td>}</tr>)}
      {!data.items.length && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">No fund requests yet.</td></tr>}
    </tbody></table></div>{data.total > data.pageSize && <Paging page={page} total={data.total} pageSize={data.pageSize} onChange={setPage} />}</>}
    {editor && <FundRequestDialog key={editor === "new" ? "new" : editor.id} initial={editor === "new" ? null : editor} requesterName={requesterName} onClose={() => setEditor(null)} onSaved={saved} />}
    {deleting && <DeleteFund fund={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setMessage(`${deleting.docNo} deleted.`); setDeleting(null); setPage(1); refresh(); }} />}
  </div>;
}
function FundRequestDialog({ initial, requesterName, onClose, onSaved }: { initial: Fund | null; requesterName: string; onClose: () => void; onSaved: (fund: Fund) => void }) {
  const [name, setName] = useState(initial?.name || ""), [department, setDepartment] = useState<Choice | null>(choice(initial?.department || null)), [custodian, setCustodian] = useState<Choice | null>(choice(initial?.custodian || null));
  const [imprest, setImprest] = useState(String(initial?.imprestAmount ?? "")), [limit, setLimit] = useState(String(initial?.perVoucherLimit ?? "")), [threshold, setThreshold] = useState(String(initial?.approvalThreshold ?? ""));
  const [validation, setValidation] = useState<string[]>([]); const policy = useOnboardingRead<Settings>("settings"), command = useOnboardingCommand();
  const [selectedAccount, setSelectedAccount] = useState<Choice | null | undefined>(() => initial ? choice(initial.fundAccount) : undefined);
  const account = selectedAccount === undefined ? policy.data?.resolvedAccounts.PETTY_CASH_FUND?.[0] || null : selectedAccount, funding = policy.data?.resolvedAccounts.FUNDING_CASH?.[0] || null;
  const setupError = account ? !account.eligible ? account.reason : funding?.id === account.id ? "Funding cash/bank and the fund account must differ." : funding && !funding.eligible ? funding.reason : null : "Select a Fund account (GL).";
  async function submit(event: FormEvent) {
    event.preventDefault(); const errors: string[] = [];
    if (!name.trim()) errors.push("Enter a fund name.");
    if (!department) errors.push("Select a department."); if (!custodian) errors.push("Select a custodian.");
    if (!(Number(imprest) > 0)) errors.push("Enter an imprest amount above zero.");
    if (!(Number(limit) > 0)) errors.push("Enter a per-voucher limit above zero.");
    if (Number(limit) > Number(imprest)) errors.push("The per-voucher limit cannot exceed the imprest amount.");
    if (!(Number(threshold) > 0)) errors.push("Enter the approval threshold.");
    if (Number(threshold) > Number(limit)) errors.push("The approval threshold cannot exceed the per-voucher limit.");
    setValidation(errors); if (errors.length || !policy.data || setupError) return;
    const result = await command.run<Fund>(initial ? `funds/${initial.id}` : "funds/submit", initial ? "PUT" : "POST", { version: initial?.version || 0, policyVersion: policy.data.version, name, departmentId: department?.id ?? null, custodianId: custodian?.id ?? null, fundAccountId: account?.id ?? null, imprestAmount: imprest.trim() || null, perVoucherLimit: limit.trim() || null, approvalThreshold: threshold.trim() || null });
    if (result) onSaved(result);
  }
  return <Dialog open onOpenChange={open => { if (!open && !command.busy) onClose(); }}><DialogContent showCloseButton={false} className="max-h-[90dvh] w-[calc(100vw-2rem)] overflow-y-auto sm:max-w-4xl" onEscapeKeyDown={event => { if (command.busy) event.preventDefault(); }} onInteractOutside={event => { if (command.busy) event.preventDefault(); }}>
    <DialogHeader className="flex-row items-center justify-between space-y-0 text-left"><DialogTitle>{initial ? "Edit fund request" : "New fund request"}</DialogTitle><Button type="button" size="sm" variant="outline" disabled={command.busy} onClick={onClose}>Close</Button><DialogDescription className="sr-only">Request a petty cash fund.</DialogDescription></DialogHeader>
    <form noValidate onSubmit={submit} onChange={validation.length ? () => setValidation([]) : undefined} className="space-y-4"><fieldset disabled={command.busy} className="space-y-4"><div className="grid gap-3 md:grid-cols-3">
      <div className="min-w-0 space-y-2"><label htmlFor="fund-name" className="text-sm font-medium">Fund name</label><Input id="fund-name" value={name} onChange={event => setName(event.target.value)} maxLength={60} placeholder="e.g. Finance Office Fund" /></div>
      <OnboardingChoice label="Department" resource="departments" selected={department} onSelect={setDepartment} disabled={command.busy} />
      <OnboardingChoice label="Custodian" resource="personnel" selected={custodian} onSelect={setCustodian} disabled={command.busy} />
      <Field label="Imprest amount (₱)" id="fund-imprest" type="number" value={imprest} onChange={setImprest} required />
      <Field label="Max per voucher, hard limit (₱)" id="fund-limit" type="number" value={limit} onChange={setLimit} required />
      <Field label="Approval required above (₱)" id="fund-threshold" type="number" value={threshold} onChange={setThreshold} required />
      <OnboardingChoice label="Fund account (GL)" resource="accounts" role="PETTY_CASH_FUND" selected={account} onSelect={setSelectedAccount} disabled={policy.loading || command.busy} />
      <Field label="Requested by" id="fund-requester" value={initial?.requestedBy?.name || requesterName} onChange={() => {}} disabled />
    </div><p className="rounded-lg bg-muted/60 p-3 text-sm">Size the fund to cover about 2 to 4 weeks of small expenses. The approval threshold must not exceed the per-voucher limit.</p>
      {!policy.loading && !policy.error && setupError && <p role="alert" className="text-sm text-destructive">{setupError}</p>}
      {validation.length > 0 && <div role="alert" className="text-sm text-destructive">{validation.map(message => <p key={message}>{message}</p>)}</div>}
      <ErrorBox error={policy.error} retry={policy.refresh} /><ErrorBox error={command.error} />
      {command.error instanceof OnboardingError && command.error.status === 409 && <Button type="button" variant="outline" onClick={policy.refresh}>Reload account</Button>}
      <div className="flex gap-2"><Button type="submit" disabled={command.busy || policy.loading || Boolean(setupError)}>{command.busy ? "Saving..." : initial ? "Save changes" : "Submit for approval"}</Button><Button type="button" variant="outline" disabled={command.busy} onClick={onClose}>Cancel</Button></div>
    </fieldset></form></DialogContent></Dialog>;
}
function DeleteFund({ fund, onClose, onDeleted }: { fund: Fund; onClose: () => void; onDeleted: () => void }) {
  const command = useOnboardingCommand();
  async function remove() { const result = await command.run(`funds/${fund.id}/delete`, "POST", { version: fund.version }); if (result) onDeleted(); }
  return <Dialog open onOpenChange={open => { if (!open && !command.busy) onClose(); }}><DialogContent showCloseButton={!command.busy}><DialogHeader><DialogTitle>Delete {fund.docNo}?</DialogTitle><DialogDescription>Delete the Pending request for {fund.name}? Its audit history will be retained.</DialogDescription></DialogHeader><ErrorBox error={command.error} /><div className="flex gap-2"><Button variant="destructive" disabled={command.busy} onClick={() => void remove()}>{command.busy ? "Deleting..." : "Delete request"}</Button><Button variant="outline" disabled={command.busy} onClick={onClose}>Cancel</Button></div></DialogContent></Dialog>;
}
