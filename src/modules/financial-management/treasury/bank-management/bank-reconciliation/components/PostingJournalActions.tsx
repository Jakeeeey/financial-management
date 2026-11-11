"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ImportedJournalChoice, PostingAction, PostingCommand, PostingEntry } from "../posting-types";
import { getImportedJournalChoices } from "../providers/bankReconciliationPostingApi";

type Selection = Pick<PostingCommand, "sourceKeys" | "journalId" | "glJournalId" | "acknowledgeWithdrawal">;
export function PostingJournalActions({ entry, periodId, disabled, dateDisabled = false, hidden = false, run }: { entry: PostingEntry; periodId: number; disabled: boolean; dateDisabled?: boolean; hidden?: boolean; run: (action: PostingAction, selection: Selection) => Promise<void> }) {
  const [dialog, setDialog] = useState<"reverse" | "withdraw" | "verify-import" | null>(null), [choices, setChoices] = useState<ImportedJournalChoice[]>([]), [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(false), [error, setError] = useState(""), [acknowledged, setAcknowledged] = useState(false);
  async function verify() {
    setDialog("verify-import"); setLoading(true); setError(""); setChoices([]); setSelected("");
    try { setChoices((await getImportedJournalChoices(periodId, entry.workbenchId!)).items); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load imported journals."); } finally { setLoading(false); }
  }
  return <div className="flex flex-wrap gap-2">
    {entry.canPost && <Button type="button" data-posting-date-action size="sm" disabled={disabled || dateDisabled} onClick={() => { void run("post", { sourceKeys: [entry.key] }); }}>Post</Button>}
    {entry.canReverse && <Button type="button" data-posting-date-action size="sm" variant="outline" disabled={disabled || dateDisabled} onClick={() => setDialog("reverse")}>Reverse</Button>}
    {entry.canRetry && <Button type="button" data-posting-date-action size="sm" disabled={disabled || dateDisabled} onClick={() => { void run("retry", { journalId: entry.workbenchId }); }}>Retry</Button>}
    {entry.canExport && <Button type="button" data-posting-date-action size="sm" variant="outline" disabled={disabled || dateDisabled} onClick={() => { void run("prepare-export", { journalId: entry.workbenchId }); }}>Export for GL import</Button>}
    {entry.canVerify && <Button type="button" size="sm" disabled={disabled} onClick={() => { void verify(); }}>Verify imported journal</Button>}
    {entry.canWithdraw && <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => { setAcknowledged(false); setDialog("withdraw"); }}>Withdraw attempt</Button>}
    <Dialog open={dialog !== null && !hidden} onOpenChange={open => { if (!open) setDialog(null); }}><DialogContent><DialogHeader><DialogTitle>{dialog === "reverse" ? `Reverse ${entry.workbenchNumber}?` : dialog === "withdraw" ? `Withdraw ${entry.workbenchNumber}?` : `Verify ${entry.workbenchNumber}`}</DialogTitle><DialogDescription>{dialog === "reverse" ? "Post an opposite GL journal on the current posting date. The original remains in history; the source unlocks after the reversal is confirmed." : dialog === "withdraw" ? "This action releases an unconfirmed attempt. An already imported GL journal must be verified or reconciled first." : "Select the Posted ERP journal created from this file. The server verifies its reference, date, complete accounts and amounts before linking it."}</DialogDescription></DialogHeader>
      {dialog === "withdraw" && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} /><span>I have confirmed the file was not imported and it must not be imported later.</span></label>}
      {dialog === "verify-import" && <div className="space-y-3"><p className="break-all text-sm">Import reference: <strong>{entry.importReference}</strong></p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<label className="block space-y-2 text-sm"><span>Imported ERP journal</span><select aria-label="Imported ERP journal" value={selected} onChange={e => setSelected(e.target.value)} className="h-10 w-full rounded-md border bg-background px-3" disabled={loading}><option value="">{loading ? "Loading journals…" : "Select a Posted journal"}</option>{choices.map(choice => <option key={choice.id} value={choice.id} disabled={choice.status !== "Posted"}>{choice.je_no} · {choice.transaction_date} · {choice.status}</option>)}</select></label>{!loading && !error && !choices.length && <p className="text-sm text-muted-foreground">No ERP journal uses this import reference yet.</p>}</div>}
      <DialogFooter><Button type="button" variant="outline" onClick={() => setDialog(null)}>Cancel</Button><Button type="button" data-posting-date-action={dialog === "reverse" || undefined} disabled={disabled || loading || dialog === "reverse" && dateDisabled || dialog === "withdraw" && !acknowledged || dialog === "verify-import" && !selected} onClick={async () => { if (dialog) await run(dialog, { journalId: entry.workbenchId, ...(dialog === "withdraw" ? { acknowledgeWithdrawal: true } : dialog === "verify-import" ? { glJournalId: Number(selected) } : {}) }); setDialog(null); }}>{dialog === "reverse" ? "Post reversal" : dialog === "withdraw" ? "Withdraw attempt" : "Verify and link"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </div>;
}
