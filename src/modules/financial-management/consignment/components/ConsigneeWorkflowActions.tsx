"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConsigneeSaveError, consigneeCommand } from "../providers/consignees.api";
import type { ConsigneeDetail, ConsignmentWorkspace } from "../types";

export function ConsigneeWorkflowActions({ detail, workspace, reason, setReason, onChanged, onReload, onBusy }: {
  detail: ConsigneeDetail; workspace: ConsignmentWorkspace; reason: string; setReason: (value: string) => void;
  onChanged: (detail: ConsigneeDetail) => void; onReload: () => void; onBusy: (value: boolean) => void;
}) {
  const [intent, setIntent] = useState<string | null>(null);
  const [failure, setFailure] = useState<ConsigneeSaveError | null>(null);
  const [busy, setBusy] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const mustReload = !!failure && (failure.status === 409 || failure.status === 401 || failure.status === 403 || ((failure.status === 0 || failure.status >= 500) && intent !== "replacement-draft"));
  async function execute() {
    if (!intent || busy || mustReload) return;
    if (intent === "reject" && (!reason.trim() || reason.trim().length > 1000)) {
      setFailure(new ConsigneeSaveError("Enter a rejection reason of 1 to 1,000 characters.", 400)); return;
    }
    setBusy(true); onBusy(true); setFailure(null);
    try {
      const result = await consigneeCommand(workspace,detail.summary.id,intent,detail.version,reason,requestId);
      setReason(""); onChanged(result);
    } catch (cause) { setFailure(cause instanceof ConsigneeSaveError ? cause : new ConsigneeSaveError("The action could not be confirmed. Reload the preview to check its saved status.",0)); }
    finally { setBusy(false); onBusy(false); }
  }
  const labels: Record<string,string> = { submit: "Confirm submission", approve: "Confirm approval", reject: "Confirm rejection", "replacement-draft": "Create replacement draft" };
  return <section className="space-y-3 border-t pt-4" aria-label="Consignee workflow actions">
    {detail.reviewRestriction && <p className="rounded border p-3 text-sm">{detail.reviewRestriction}</p>}
    {failure && <div role="alert" className="space-y-2 rounded border border-destructive p-3 text-sm"><p>{failure.message}</p>
      {Object.entries(failure.fields).map(([field,message]) => <p key={field}>{message}</p>)}
      {detail.editable && Object.keys(failure.fields).length > 0 && <p>Use Edit draft below to complete these fields, save, then review and submit again.</p>}
      <Button variant="outline" disabled={busy} onClick={onReload}>Reload preview</Button>
    </div>}
    {!intent && <div className="flex flex-wrap gap-2">
      {detail.canSubmit && <Button onClick={() => setIntent("submit")}>Review and submit</Button>}
      {detail.canReview && <><Button onClick={() => setIntent("approve")}>Approve consignee</Button><Button variant="destructive" onClick={() => setIntent("reject")}>Reject</Button></>}
      {detail.canReplace && <Button onClick={() => setIntent("replacement-draft")}>Create replacement draft</Button>}
    </div>}
    {intent && <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm">{intent === "submit" ? "Submit this saved consignee for independent review? Its fields will be locked." : intent === "approve" ? "Approve this consignee to Active? No agreement, inventory movement, or accounting entry will be created." : intent === "reject" ? "Reject this submission? Its saved details and your reason will remain in history." : "Create a new draft with a new CS-CON code and a link to this rejected record? The original will remain unchanged."}</p>
      {intent === "reject" && <div><label htmlFor="consignee-rejection-reason" className="mb-1 block text-sm font-medium">Rejection reason (required)</label>
        <textarea id="consignee-rejection-reason" maxLength={1000} required rows={3} className="w-full rounded-md border bg-background p-2 text-sm focus-visible:outline-2 focus-visible:outline-ring" value={reason} disabled={busy} onChange={event => setReason(event.target.value)} aria-describedby="consignee-reason-hint" />
        <p id="consignee-reason-hint" className="text-sm text-muted-foreground">Explain the changes needed. Up to 1,000 characters.</p></div>}
      <div className="flex flex-wrap gap-2"><Button disabled={busy || mustReload} onClick={() => void execute()}>{busy ? "Please wait..." : labels[intent]}</Button><Button variant="outline" disabled={busy || mustReload} onClick={() => { setIntent(null); setFailure(null); }}>Cancel action</Button></div>
    </div>}
    <p role="status" className="text-sm text-muted-foreground">{busy ? "Saving the workflow action. Please wait." : ""}</p>
  </section>;
}
