"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FundingAccountChoice } from "./FundingAccountChoice";
import { MasterError, MasterTable, CountLabel } from "./MasterCommon";
import { Field, OnboardingFeedback } from "./OnboardingCommon";
import { useFundRead, useFundDecision } from "../hooks/useFunds";
import { OnboardingError } from "../providers/onboarding.api";
import type { Choice } from "../onboarding-types";
import type { ChangePreview } from "../master-types";
import { CHANGE_TYPES } from "../master-types";
import { onboardingFieldError } from "../utils/onboardingFeedback";
import { voucherMoney as money } from "../utils/voucherMoney";

export function FundChangeReview({ id, actorName, canDecide, onClose, onChanged }: { id: string; actorName: string; canDecide: boolean; onClose: () => void; onChanged: (message?: string) => void }) {
  const [funding, setFunding] = useState<Choice | null>(null), [remarks, setRemarks] = useState(""), [confirmed, setConfirmed] = useState(false), [decision, setDecision] = useState<"approve" | "reject" | null>(null);
  const read = useFundRead<ChangePreview>(`onboarding-approval/changes/${id}${funding ? `?fundingAccountId=${funding.id}` : ""}`), command = useFundDecision<ChangePreview>(), data = read.data, locked = command.busy || command.uncertain;
  const conflict = command.error instanceof OnboardingError && command.error.status === 409;
  const reviewErrorTitle = decision === "reject" ? "Could not reject fund change" : decision === "approve" ? "Could not approve fund change" : "Could not complete fund decision";
  const fundingError = onboardingFieldError(command.error, "fundingAccountId");
  const remarksError = onboardingFieldError(command.error, "remarks") || onboardingFieldError(command.error, "reason");
  const cashError = onboardingFieldError(command.error, "cashConfirmed");
  function reload() { setConfirmed(false); setDecision(null); command.clearError(); read.refresh(); }
  async function decide(action: "approve" | "reject") {
    if (!data) return;
    setDecision(action);
    const result = await command.run(`onboarding-approval/changes/${id}/${action}`, { version: data.change.version, previewToken: data.token, fundingAccountId: funding?.id ?? null, cashConfirmed: confirmed, remarks });
    if (result) onChanged(action === "approve" ? `${result.change.docNo} approved.${result.journal ? ` Entry ${result.journal} was posted.` : " No journal entry was required."}` : `${result.change.docNo} rejected. The requester can review the reason and resubmit.`);
  }
  return <Dialog open onOpenChange={open => { if (!open && !locked) onClose(); }}><DialogContent showCloseButton={!locked} className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl" onEscapeKeyDown={event => { if (locked) event.preventDefault(); }} onInteractOutside={event => { if (locked) event.preventDefault(); }}><DialogHeader><DialogTitle>{data ? `${data.change.docNo} · ${CHANGE_TYPES[data.change.type as keyof typeof CHANGE_TYPES]}` : "Fund change"}</DialogTitle><DialogDescription>Review the fund, supporting count and entry before deciding.</DialogDescription></DialogHeader>
    {read.loading && <p role="status">Loading change...</p>}<MasterError error={read.error} retry={reload} title="Could not load fund change" /><MasterError error={command.error} title={reviewErrorTitle} showFields={false} action={conflict ? { label: "Reload review", onClick: reload } : undefined} />
    {data && <><div className="grid gap-4 rounded-lg bg-muted/30 p-4 text-sm sm:grid-cols-2">{[["Fund", `${data.fund.docNo} · ${data.fund.name}`], ["Custodian", data.fund.custodian], ["Requested by", `${data.change.requestedBy} · ${data.change.requestedAt.slice(0, 10)}`], ["Reason", data.change.reason], ["Current imprest", money(data.fund.imprest)], ["Cash on hand", money(data.fund.expectedCash)], ["Change", data.change.newImprest ? `${money(data.change.requestedFund.imprest)} → ${money(data.change.newImprest)}` : data.change.newCustodian || "Return counted cash and close"], ["Status", data.change.state]].map(([label, value]) => <div key={label}><p className="text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value}</p></div>)}</div>
      {data.change.state === "PENDING" && data.fundingRequired && <FundingAccountChoice selected={funding} disabled={locked || !canDecide} onSelect={choice => { setFunding(choice); setConfirmed(false); command.clearError(); }} error={fundingError} />}
      {data.count && <section className="rounded-lg border p-3 text-sm"><p>Supporting count: <strong>{data.count.docNo}</strong> · <CountLabel count={data.count} /></p><p>Counted {money(data.count.snapshot.countedCash)} · Counter {data.count.snapshot.counter} · Witness {data.count.snapshot.witness}</p></section>}
      {data.lines.length > 0 && <><h2 className="font-semibold">{data.journal ? `Posted entry · ${data.journal}` : "Entry on approval"}</h2><MasterTable label="Fund change posting" headers={["Account", "Debit", "Credit"]}>{data.lines.map((line, index) => <tr key={index}><td>{line.account.code} · {line.account.name}</td><td>{money(line.debit)}</td><td>{money(line.credit)}</td></tr>)}</MasterTable></>}
      {data.change.type === "CUSTODIAN" && <p className="text-sm text-muted-foreground">No journal entry or cash movement. Custody changes only after approval.</p>}
      {data.blockers.length > 0 && <OnboardingFeedback tone="warning" title="Approval is blocked">{data.blockers.map(blocker => <p key={blocker}>{blocker}</p>)}</OnboardingFeedback>}
      {data.change.state === "PENDING" && !canDecide && <OnboardingFeedback tone="info" title="Review only"><p>You can review this request, but only users with approval access can approve or reject it.</p></OnboardingFeedback>}
      {data.change.state === "PENDING" && <><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><label htmlFor="change-approver" className="text-sm font-medium">Approver</label><Input id="change-approver" readOnly value={actorName} /></div><Field label="Remarks (required to reject)" id="change-remarks" value={remarks} maxLength={1000} disabled={locked} error={remarksError} onChange={value => { setRemarks(value); command.clearError(); }} /></div>{data.cashRequired && <><label className="flex items-center gap-2 text-sm"><input aria-invalid={Boolean(cashError)} aria-describedby={cashError ? "change-cash-error" : undefined} type="checkbox" disabled={locked} checked={confirmed} onChange={event => { setConfirmed(event.target.checked); command.clearError(); }} />I confirm the funding or counted cash return required by this change.</label>{cashError && <p id="change-cash-error" className="text-xs font-medium text-destructive">{cashError}</p>}</>}</>}
      {command.uncertain && <OnboardingFeedback tone="warning" title="Decision outcome is unconfirmed"><p>Retry the same decision to check its status and safely complete it.</p></OnboardingFeedback>}
    </>}
    <div className="flex flex-wrap justify-end gap-2">{command.uncertain ? <Button disabled={command.busy} onClick={async () => { if (await command.retry()) onChanged(); }}>Check / retry decision</Button> : data?.change.state === "PENDING" && <><Button disabled={!canDecide || !data.canApprove || data.cashRequired && !confirmed || locked} onClick={() => void decide("approve")}>{command.busy ? "Saving..." : "Approve"}</Button><Button variant="destructive" disabled={!canDecide || !data.canReject || !remarks.trim() || locked} onClick={() => void decide("reject")}>Reject</Button></>}<Button variant="outline" disabled={locked} onClick={reload}>Reload review</Button><Button variant="outline" disabled={locked} onClick={onClose}>Close</Button></div>
  </DialogContent></Dialog>;
}
