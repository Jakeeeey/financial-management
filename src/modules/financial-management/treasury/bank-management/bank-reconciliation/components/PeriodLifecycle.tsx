"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { getLifecycleReceipt, runLifecycleCommand, type LifecycleAction, type LifecycleCommand, type LifecycleReceipt } from "../providers/bankReconciliationLifecycleApi";
import { SetupError } from "../providers/bankReconciliationSetupApi";
import type { ReconciliationPeriod } from "../setup-types";
import { bankReconciliationRequestId } from "../utils/request-id";

type Pending = { action: LifecycleAction; command: LifecycleCommand };
export function PeriodLifecycle({ period, workspace, eligibility, disabled, onBusy, onDone, before }: { period: ReconciliationPeriod; workspace: "reconcile" | "posting"; eligibility?: { canClose: boolean; blockers: string[] }; disabled: boolean; onBusy: (value: boolean) => void; onDone: (id: number) => Promise<void>; before?: () => Promise<ReconciliationPeriod | null> }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const [dialog, setDialog] = useState<LifecycleAction | null>(null), [reason, setReason] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [message, setMessage] = useState("");
  useEffect(() => { onBusy(busy || Boolean(pending)); return () => onBusy(false); }, [busy, pending, onBusy]);
  const state = period.lifecycle, closed = period.status === "CLOSED";
  function remember(value: Pending | null) { setPending(value); }
  async function complete(receipt: LifecycleReceipt) { remember(null); setDialog(null); setMessage(receipt.message + (receipt.blockers?.length ? ` ${receipt.blockers.join(" ")}` : "")); await onDone(receipt.periodId); }
  async function execute(retry = false) {
    if (busy) return; setBusy(true); setError("");
    try {
      const latest = !retry && before ? await before() : period;
      const request = retry ? pending : dialog ? { action: dialog, command: { requestId: bankReconciliationRequestId(), version: latest?.version ?? period.version, ...(dialog === "reopen" ? { reason: reason.trim() } : {}) } } : null;
      if (!request) return;
      remember(request); await complete(await runLifecycleCommand(period.id, request.action, request.command));
    } catch (e) { setDialog(null); if (e instanceof SetupError && e.status < 500) { remember(null); if (e.status === 409) await onDone(period.id); } setError(e instanceof Error ? e.message : "The result is not confirmed. Check this request before continuing."); }
    finally { setBusy(false); }
  }
  async function check() {
    if (!pending || busy) return; setBusy(true); setError("");
    try { await complete(await getLifecycleReceipt(period.id, pending.command.requestId)); }
    catch (e) { if (e instanceof SetupError && e.status === 404) { remember(null); await onDone(period.id); setMessage("This request was not committed. Review the period before trying again."); } else setError(e instanceof Error ? e.message : "Unable to confirm the request."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Period lifecycle" className="space-y-3 rounded-lg border bg-card p-4 text-sm">
    {closed ? <p><strong>Closed snapshot · revision {state?.revision}</strong>{state?.closedAt && ` · ${state.closedAt.replace("T", " ")}`}{state?.closedBy && ` · ${state.closedBy.name}`}. Financial data is preserved as of closure.</p> : <p>{state?.previousPeriodId ? `Continuing period #${state.previousPeriodId}. Choose a period end in ${state.nextAllowedMonth}. Statement balances start blank.` : "Close the period in Posting after reviewing the reconciliation and confirmed GL entries."}</p>}
    {state?.historical && <p className="text-muted-foreground">This is an earlier closure revision. Open the working period from Saved periods for current changes.</p>}
    {closed && state?.successorId && <p className="text-muted-foreground">A successor has started. Record earlier-period corrections in the current open period.</p>}
    {workspace === "posting" && !closed && eligibility?.blockers.map(issue => <p key={issue} className="text-amber-700 dark:text-amber-400">{issue}</p>)}
    <div className="flex flex-wrap gap-2">{workspace === "posting" && !closed && <Button type="button" disabled={disabled || busy || Boolean(pending) || !eligibility?.canClose} onClick={() => setDialog("close")}>Close period</Button>}{workspace === "posting" && state?.canReopen && <Button type="button" variant="outline" disabled={disabled || busy || Boolean(pending)} onClick={() => { setReason(""); setDialog("reopen"); }}>Reopen period</Button>}{workspace === "reconcile" && state?.canStartNext && <Button type="button" disabled={disabled || busy || Boolean(pending)} onClick={() => setDialog("next-period")}>Start next period</Button>}</div>
    {pending && <div className="space-y-2 rounded-md border border-amber-300 p-3"><p>Request {pending.command.requestId}: confirm its outcome before continuing.</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={busy || disabled} onClick={() => { void check(); }}>Check lifecycle request</Button><Button type="button" variant="outline" disabled={busy || disabled} onClick={() => { void execute(true); }}>Retry lifecycle request</Button></div></div>}
    {error && <p role="alert" className="text-destructive">{error}</p>}{message && <p role="status">{message}</p>}
    <Dialog open={dialog !== null} onOpenChange={open => { if (!open && !busy) setDialog(null); }}><DialogContent><DialogHeader><DialogTitle>{dialog === "reopen" ? "Reopen reconciliation period" : dialog === "next-period" ? "Start the next period" : "Close reconciliation period"}</DialogTitle><DialogDescription>{dialog === "reopen" ? "Enter a reason. Existing transactions and posted journals are retained; prior closure revisions remain read-only." : dialog === "next-period" ? "Only outstanding ledger deposits in transit and checks carry forward, with their original dates. Statement balances and period end will be blank. This prevents reopening the prior period." : "The server will refresh and validate the GL. If it changed, review the refreshed reconciliation and close again. Successful closure preserves a read-only snapshot."}</DialogDescription></DialogHeader>
      {dialog === "reopen" && <label className="space-y-2 text-sm"><span>Reason for reopening</span><Textarea aria-label="Reason for reopening" value={reason} disabled={busy} onChange={e => setReason(e.target.value)} /></label>}
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={() => setDialog(null)}>Cancel</Button><Button type="button" disabled={disabled || busy || Boolean(pending) || dialog === "reopen" && !reason.trim()} onClick={() => { void execute(); }}>{dialog === "reopen" ? "Reopen period" : dialog === "next-period" ? "Start next period" : "Confirm closure"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </section>;
}
