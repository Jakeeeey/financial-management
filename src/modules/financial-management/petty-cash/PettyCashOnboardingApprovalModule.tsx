"use client";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FundingAccountChoice } from "./components/FundingAccountChoice";
import { useFundDecision, useFundRead } from "./hooks/useFunds";
import { OnboardingError } from "./providers/onboarding.api";
import type { Choice, Page } from "./onboarding-types";
import type { FundDetails, FundRecord } from "./fund-types";

const root = "onboarding-approval";
function money(value: string) {
  const [whole, cents = "00"] = value.replace(/^-/, "").split(".");
  return `${value.startsWith("-") ? "-" : ""}₱${BigInt(whole).toLocaleString("en-PH")}.${cents.padEnd(2, "0")}`;
}
const date = (value: string) => value.replace("T", " ").slice(0, 16);
function Failure({ error, retry }: { error?: Error | null; retry?: () => void }) {
  if (!error) return null;
  return <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm"><p>{error.message}</p>
    {error instanceof OnboardingError && <>{Object.values(error.fields).map((value, index) => <p key={index}>{value}</p>)}{error.requestId && <p className="text-xs">Reference: {error.requestId}</p>}</>}
    {retry && <Button size="sm" variant="outline" onClick={retry}>Retry</Button>}
  </div>;
}
function Status({ value }: { value: "Pending" | "Approved" | "Rejected" }) {
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${value === "Pending" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300" : value === "Approved" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{value}</span>;
}
function Pagination({ label, page, data, onPage }: { label: string; page: number; data: Page<FundRecord>; onPage: (page: number) => void }) {
  if (data.total <= data.pageSize && page === 1) return null;
  return <div aria-label={`${label} pagination`} className="flex flex-wrap items-center justify-end gap-3 p-4 text-sm"><span>Page {page}</span><Button size="sm" variant="outline" disabled={page === 1} onClick={() => onPage(page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={page * data.pageSize >= data.total} onClick={() => onPage(page + 1)}>Next</Button></div>;
}
export default function PettyCashOnboardingApprovalModule({ actorName, canDecide }: { actorName: string; canDecide: boolean }) {
  const [pendingPage, setPendingPage] = useState(1), [decidedPage, setDecidedPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null), [message, setMessage] = useState("");
  const pending = useFundRead<Page<FundRecord>>(`${root}/funds?queue=pending&page=${pendingPage}&pageSize=25`);
  const decided = useFundRead<Page<FundRecord>>(`${root}/funds?queue=decided&page=${decidedPage}&pageSize=25`);
  function changed(result: FundDetails) {
    setMessage(`${result.fund.docNo} ${result.fund.status === "ACTIVE" ? "approved and funded" : "rejected"}${result.journal ? ` · ${result.journal.number}` : ""}.`);
    setSelected(null);
    if (pendingPage > 1 && pending.data?.items.length === 1) setPendingPage(pendingPage - 1);
    setDecidedPage(1); pending.refresh(); decided.refresh();
  }
  return <section className="space-y-5"><div><h1 className="text-2xl font-semibold tracking-tight">Onboarding Approval</h1><p className="mt-2 text-sm text-muted-foreground">Approve or reject new fund requests. Select a request to see its details and decide. Approval records funding and posts the entry.</p></div>
    {message && <p role="status" className="rounded-lg border bg-card p-3 text-sm">{message}</p>}
    <section className="overflow-hidden rounded-xl border bg-card"><h2 className="p-5 text-lg font-semibold">Awaiting approval{pending.data ? ` (${pending.data.total})` : ""}</h2>
      {pending.loading && <p role="status" className="px-5 pb-5 text-sm text-muted-foreground">Loading requests...</p>}<Failure error={pending.error} retry={pending.refresh} />
      {pending.data && <>{pending.data.items.length ? <div className="overflow-x-auto"><table aria-label="Awaiting approval" className="w-full text-left text-sm [&_th]:whitespace-nowrap [&_th]:p-3 [&_th]:font-medium [&_td]:p-3"><thead className="border-y bg-muted/40"><tr>{["Request", "Type", "Fund", "Detail", "Requested by", "Date", "Status", ""].map((label, index) => <th key={index}>{label}</th>)}</tr></thead><tbody>
        {pending.data.items.map(fund => <tr key={fund.id} tabIndex={0} className="cursor-pointer border-b align-top last:border-0 hover:bg-muted/30 focus-visible:outline-2 focus-visible:outline-ring" onClick={() => setSelected(fund.id)} onKeyDown={event => { if (event.target === event.currentTarget && event.key === "Enter") setSelected(fund.id); }}>
          <td className="whitespace-nowrap font-semibold">{fund.docNo}</td><td className="whitespace-nowrap">New fund</td><td>{fund.docNo} · {fund.name}</td><td>{money(fund.imprestAmount)} imprest · custodian {fund.custodian?.name || "—"}</td><td>{fund.requestedBy?.name || "—"}</td><td className="whitespace-nowrap">{fund.createdAt.slice(0, 10)}</td><td><Status value="Pending" /></td><td><Button size="sm" variant="outline" aria-label={`Review ${fund.docNo}`} onClick={event => { event.stopPropagation(); setSelected(fund.id); }}>Review</Button></td>
        </tr>)}
      </tbody></table></div> : <p className="px-5 pb-5 text-sm text-muted-foreground">Nothing waiting. New fund requests from Onboarding appear here.</p>}<Pagination label="Awaiting approval" page={pendingPage} data={pending.data} onPage={setPendingPage} /></>}
    </section>
    <section className="overflow-hidden rounded-xl border bg-card"><h2 className="p-5 text-lg font-semibold">Decided</h2>
      {decided.loading && <p role="status" className="px-5 pb-5 text-sm text-muted-foreground">Loading decisions...</p>}<Failure error={decided.error} retry={decided.refresh} />
      {decided.data && <>{decided.data.items.length ? <div className="overflow-x-auto"><table aria-label="Decided requests" className="w-full text-left text-sm [&_th]:whitespace-nowrap [&_th]:p-3 [&_th]:font-medium [&_td]:p-3"><thead className="border-y bg-muted/40"><tr>{["Request", "Type", "Fund", "Requested by", "Decided by", "Status", "Entry"].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
        {decided.data.items.map(fund => { const decision = fund.decision; return <tr key={fund.id} className="border-b align-top last:border-0"><td className="whitespace-nowrap font-semibold">{fund.docNo}</td><td className="whitespace-nowrap">New fund</td><td>{fund.docNo} · {fund.name}</td><td>{fund.requestedBy?.name || "—"}</td><td>{decision?.decidedBy.name || "—"}{decision && <p className="mt-1 text-xs text-muted-foreground">{date(decision.decidedAt)}</p>}</td><td><Status value={decision?.status === "REJECTED" || fund.status === "REJECTED" ? "Rejected" : "Approved"} />{decision?.status === "REJECTED" && decision.remarks && <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{decision.remarks}</p>}</td><td className="whitespace-nowrap">{decision?.journal ? decision.canViewJournal ? <Link className="text-primary underline" href={`/fm/financial-statements/journal-entry?search=${encodeURIComponent(decision.journal.number)}`}>{decision.journal.number}</Link> : decision.journal.number : "—"}</td></tr>; })}
      </tbody></table></div> : <p className="px-5 pb-5 text-sm text-muted-foreground">None yet.</p>}<Pagination label="Decided" page={decidedPage} data={decided.data} onPage={setDecidedPage} /></>}
    </section>
    <section className="overflow-hidden rounded-xl border bg-card"><h2 className="p-5 text-lg font-semibold">Entries posted on approval</h2><div className="overflow-x-auto"><table aria-label="Entries posted on approval" className="w-full text-left text-sm [&_th]:p-3 [&_th]:font-medium [&_td]:p-3"><thead className="border-y bg-muted/40"><tr><th>Event</th><th>Debit</th><th>Credit</th></tr></thead><tbody>
      {[["New fund", "Fund account (GL)", "Selected funding cash / bank"], ["Increase imprest", "Fund account (GL)", "Funding cash / bank"], ["Decrease imprest", "Funding cash / bank", "Fund account (GL)"], ["Close fund", "Funding cash / bank (counted) and Cash Over/Short if short", "Fund account (GL) and Cash Over/Short if over"], ["Change custodian", "No entry", "No entry"]].map(([event, debit, credit]) => <tr key={event} className="border-b last:border-0"><td>{event}</td><td>{debit}</td><td>{credit}</td></tr>)}
    </tbody></table></div></section>
    {selected && <FundApprovalReview key={selected} id={selected} actorName={actorName} canDecide={canDecide} onClose={() => setSelected(null)} onChanged={changed} />}
  </section>;
}

function FundApprovalReview({ id, actorName, canDecide, onClose, onChanged }: { id: string; actorName: string; canDecide: boolean; onClose: () => void; onChanged: (result: FundDetails) => void }) {
  const [funding, setFunding] = useState<Choice | null>(null), [remarks, setRemarks] = useState(""), [confirmed, setConfirmed] = useState(false);
  const read = useFundRead<FundDetails>(`${root}/funds/${id}`);
  const selectedPreview = useFundRead<FundDetails>(funding ? `${root}/funds/${id}?fundingAccountId=${funding.id}` : null);
  const command = useFundDecision(), data = selectedPreview.data ?? read.data, fund = data?.fund;
  const preview = funding ? selectedPreview.data?.preview : read.data?.preview;
  const locked = command.busy || command.uncertain, pending = fund?.status === "PENDING";
  function reload() { setConfirmed(false); read.refresh(); selectedPreview.refresh(); }
  async function decide(action: "approve" | "reject") {
    if (!fund) return;
    const payload = action === "approve" ? { version: fund.version, policyVersion: preview?.policyVersion, previewDigest: preview?.digest, fundingAccountId: funding?.id, cashConfirmed: confirmed, remarks } : { version: fund.version, reason: remarks };
    const result = await command.run(`${root}/funds/${id}/${action}`, payload); if (result) onChanged(result);
  }
  return <Dialog open onOpenChange={open => { if (!open && !locked) onClose(); }}><DialogContent showCloseButton={!locked} className="max-h-[88vh] overflow-y-auto sm:max-w-[900px]" onEscapeKeyDown={event => { if (locked) event.preventDefault(); }} onInteractOutside={event => { if (locked) event.preventDefault(); }}><DialogHeader><DialogTitle>{fund ? `${fund.docNo} · New fund request` : "New fund request"}</DialogTitle><DialogDescription>Review the request and entry before approving and funding.</DialogDescription></DialogHeader>
    {read.loading && <p role="status" className="text-sm">Loading request...</p>}<Failure error={read.error} retry={reload} /><Failure error={selectedPreview.error} retry={reload} /><Failure error={command.error} />
    {data && fund && <><div><Status value={fund.status === "REJECTED" ? "Rejected" : pending ? "Pending" : "Approved"} /></div><div className="grid gap-4 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
      {[["Fund name", fund.name], ["Department", fund.department?.name || "—"], ["Custodian", fund.custodian?.name || "—"], ["Requested by", `${fund.requestedBy?.name || "—"} · ${fund.createdAt.slice(0, 10)}`]].map(([label, value]) => <div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>)}
    </div><dl className="divide-y text-sm">{[["Imprest amount", money(fund.imprestAmount)], ["Maximum per voucher", money(fund.perVoucherLimit)], ["Approval required above", money(fund.approvalThreshold)], ["Fund account (GL)", fund.fundAccount ? `${fund.fundAccount.code} · ${fund.fundAccount.name}` : "—"], ["Custodian already holds", data.custodianActiveFunds?.length ? data.custodianActiveFunds.map(held => held.docNo).join(", ") : "No other active fund"]].map(([label, value]) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-2"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>)}</dl>
      {pending && <><FundingAccountChoice selected={funding} disabled={locked || !canDecide} onSelect={choice => { setFunding(choice); setConfirmed(false); }} />
        <section className="space-y-3"><h2 className="font-medium">Entry on approval{preview ? ` · ${preview.accountingDate}` : ""}</h2>
          {funding && selectedPreview.loading && <p role="status" className="text-sm text-muted-foreground">Updating journal preview...</p>}
          {preview && <>{preview.blockers.length > 0 && <ul className="list-inside list-disc rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">{preview.blockers.map((blocker, index) => <li key={index}>{blocker.message}</li>)}</ul>}{preview.lines.length > 0 && <div className="overflow-x-auto"><table aria-label="Entry on approval" className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-left">Account</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead><tbody>{preview.lines.map((line, index) => <tr key={index} className="border-b"><td className="p-2">{line.account.code} · {line.account.name}</td><td className="whitespace-nowrap p-2 text-right">{line.debit === "0.00" ? "—" : money(line.debit)}</td><td className="whitespace-nowrap p-2 text-right">{line.credit === "0.00" ? "—" : money(line.credit)}</td></tr>)}</tbody></table></div>}</>}
        </section>
        {canDecide && <><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="fund-approver" className="text-sm font-medium">Approver</label><Input id="fund-approver" value={actorName} readOnly /></div><div className="space-y-2"><label htmlFor="fund-approval-remarks" className="text-sm font-medium">Remarks (required to reject)</label><Input id="fund-approval-remarks" value={remarks} maxLength={1000} disabled={locked} onChange={event => setRemarks(event.target.value)} /></div></div>
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} disabled={locked || !data.canDecide || !preview?.ready} onChange={event => setConfirmed(event.target.checked)} />I confirm the funding cash was transferred to the custodian.</label>
        </>}
      </>}
      {!pending && <p className="text-sm text-muted-foreground">This request has already been decided. Close the review to see its decision in the register.</p>}
    </>}
    {command.uncertain && <p role="status" className="text-sm">The outcome has not been confirmed. Retry the same decision to check its status and safely complete it.</p>}
    <div className="flex flex-wrap gap-2 pt-2">{command.uncertain ? <Button disabled={command.busy} onClick={async () => { const result = await command.retry(); if (result) onChanged(result); }}>{command.busy ? "Checking decision..." : "Retry decision"}</Button> : pending && canDecide && <>
      <Button disabled={locked || !data?.canDecide || !funding || !preview?.ready || !confirmed} onClick={() => void decide("approve")}>{command.busy ? "Submitting decision..." : "Approve and fund"}</Button>
      <Button variant="destructive" disabled={locked || !data?.canDecide || !remarks.trim()} onClick={() => void decide("reject")}>Reject</Button>
    </>}<Button variant="outline" disabled={locked} onClick={onClose}>Cancel</Button>{command.error && !locked && <Button variant="outline" onClick={reload}>Reload review</Button>}</div>
  </DialogContent></Dialog>;
}
