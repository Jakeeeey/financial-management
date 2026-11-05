"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { ConsigneeSaveError } from "../providers/consignees.api";
import type { ConsigneeDetail } from "../types";
import type { ConsigneeWorkflowIntent } from "../hooks/useConsigneeWorkflow";

const CONFIRM_LABELS: Record<ConsigneeWorkflowIntent, string> = {
  submit: "Confirm submission",
  approve: "Confirm approval",
  reject: "Confirm rejection",
  "replacement-draft": "Confirm replacement draft",
  withdraw: "Confirm withdrawal",
};

export function ConsigneeWorkflowFeedback({ detail, intent, failure, busy, reason, setReason, onReload }: {
  detail: ConsigneeDetail; intent: ConsigneeWorkflowIntent | null; failure: ConsigneeSaveError | null; busy: boolean;
  reason: string; setReason: (value: string) => void; onReload: () => void;
}) {
  const confirmationRef = useRef<HTMLDivElement>(null);
  const rejectionRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!intent) return;
    confirmationRef.current?.scrollIntoView({ block: "nearest" });
    if (intent === "reject" || intent === "withdraw") rejectionRef.current?.focus();
  }, [intent]);

  if (!detail.reviewRestriction && !failure && !intent) return null;

  return <section className="space-y-3 border-t pt-4" aria-label="Consignee workflow actions">
    {detail.reviewRestriction && <p className="rounded border p-3 text-sm">{detail.reviewRestriction}</p>}
    {failure && <div role="alert" className="space-y-2 rounded border border-destructive p-3 text-sm"><p>{failure.message}</p>
      {Object.entries(failure.fields).map(([field, message]) => <p key={field}>{message}</p>)}
      {detail.editable && Object.keys(failure.fields).length > 0 && <p>Use Edit draft in the footer to complete these fields, save, then review and submit again.</p>}
      <Button variant="outline" disabled={busy} onClick={onReload}>Reload preview</Button>
    </div>}
    {intent && <div ref={confirmationRef} className="space-y-3 rounded-lg border p-3">
      <p className="text-sm">{intent === "submit" ? "Submit this saved consignee for independent review? Its fields will be locked." : intent === "approve" ? "Approve this consignee to Active? No agreement, inventory movement, or accounting entry will be created." : intent === "reject" ? "Reject this submission? Its saved details and your reason will remain in history." : intent === "withdraw" ? "Withdraw this submission back to Draft? It will leave the approval queue and become editable." : "Create a new draft with a new CS-CON code and a link to this rejected record? The original will remain unchanged."}</p>
      {(intent === "reject" || intent === "withdraw") && <div>
        <label htmlFor="consignee-workflow-note" className="mb-1 block text-sm font-medium">{intent === "reject" ? "Rejection reason (required)" : "Withdrawal note (optional)"}</label>
        <textarea ref={rejectionRef} id="consignee-workflow-note" maxLength={1000} required={intent === "reject"} rows={3} className="w-full rounded-md border bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={reason} disabled={busy} onChange={event => setReason(event.target.value)} aria-describedby="consignee-workflow-note-hint" />
        <div id="consignee-workflow-note-hint" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground"><span>{intent === "reject" ? "Explain the changes needed." : "Optionally record why this submission is being withdrawn."}</span><span aria-live="polite">{reason.length}/1,000</span></div>
      </div>}
    </div>}
    <p role="status" className="text-sm text-muted-foreground">{busy ? "Saving the workflow action. Please wait." : ""}</p>
  </section>;
}

export function ConsigneeWorkflowFooterActions({ detail, intent, busy, mustReload, confirmDisabled, onRequest, onCancel, onConfirm }: {
  detail: ConsigneeDetail; intent: ConsigneeWorkflowIntent | null; busy: boolean; mustReload: boolean; confirmDisabled: boolean;
  onRequest: (intent: ConsigneeWorkflowIntent) => void; onCancel: () => void; onConfirm: () => Promise<void>;
}) {
  if (intent) return <>
    <Button type="button" variant="outline" disabled={busy || mustReload} onClick={onCancel}>Cancel action</Button>
    <Button type="button" disabled={confirmDisabled} onClick={() => void onConfirm()}>{busy ? "Please wait..." : CONFIRM_LABELS[intent]}</Button>
  </>;
  return <>
    {detail.canSubmit && <Button type="button" onClick={() => onRequest("submit")}>Review and submit</Button>}
    {detail.canReview && <><Button type="button" onClick={() => onRequest("approve")}>Approve consignee</Button><Button type="button" variant="destructive" onClick={() => onRequest("reject")}>Reject</Button></>}
    {detail.canWithdraw && <Button type="button" variant="outline" onClick={() => onRequest("withdraw")}>Withdraw submission</Button>}
    {detail.canReplace && <Button type="button" onClick={() => onRequest("replacement-draft")}>Create replacement draft</Button>}
  </>;
}
