"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { useReconcileDrafts } from "../hooks/useReconcileDrafts";
import type { ReconciliationPeriod } from "../setup-types";
import type { SetupFields } from "../hooks/usePeriodSetup";
import { entryDirty, recoveryPatch, setupLabels } from "../utils/reconcileDrafts";

export function ReconcileDraftDialogs({ drafts, period, setup }: { drafts: ReturnType<typeof useReconcileDrafts>; period: ReconciliationPeriod | null; setup: SetupFields | null }) {
  const recovered = drafts.recovery, changes = recovered ? recoveryPatch(recovered) : {};
  return <>
    {drafts.storageError && <p role="alert" className="rounded-md border border-amber-400 p-3 text-sm">{drafts.storageError}</p>}
    {drafts.error && !drafts.dialog && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{drafts.error}</p>}
    {recovered && <section aria-label="Recovered reconciliation draft" className="space-y-3 rounded-lg border border-amber-400 bg-card p-4 text-sm">
      <h2 className="font-semibold">Unsaved work is available in this tab</h2>
      <p>The saved period has been loaded. Review the recovered values before restoring them. Setup changes autosave after restoration; transaction entries are added only when you choose Add line or Save and continue.</p>
      {period?.version !== recovered.baseVersion && <p className="text-amber-700 dark:text-amber-400">The saved version changed. Restoring applies only the setup fields you changed; other saved fields are retained.</p>}
      {Object.keys(changes).length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Field</th><th className="p-2">Currently saved</th><th className="p-2">Recovered value</th></tr></thead><tbody>{(Object.keys(changes) as (keyof typeof setupLabels)[]).map(field => <tr className="border-b" key={field}><th className="p-2 text-left font-medium">{setupLabels[field]}</th><td className="p-2">{String(setup?.[field] ?? "") || "Not entered"}</td><td className="p-2">{String(recovered.setup[field] ?? "") || "Not entered"}</td></tr>)}</tbody></table></div>}
      {(["BANK", "LEDGER"] as const).filter(side => entryDirty(recovered.entries[side])).map(side => <div key={side} className="space-y-1 rounded-md border p-3"><p className="font-medium">{side === "BANK" ? "Bank" : "Ledger"} entry</p><dl className="grid gap-2 sm:grid-cols-2">{Object.entries(recovered.entries[side].fields).map(([field, value]) => <div key={field}><dt className="text-xs capitalize text-muted-foreground">{field}</dt><dd className="break-words">{value || "Not entered"}</dd></div>)}</dl>{recovered.entries[side].uncertain && <p className="text-amber-700 dark:text-amber-400">An earlier add may have completed. Review saved lines before retrying.</p>}</div>)}
      {period?.status === "CLOSED" && <p>This period is closed. Recovered values are read-only and can be selected and copied for review.</p>}
      <div className="flex flex-wrap gap-2"><Button type="button" disabled={drafts.busy || period?.status === "CLOSED"} onClick={() => { void drafts.restore(); }}>Restore draft</Button><Button type="button" variant="outline" disabled={drafts.busy} onClick={drafts.discardRecovery}>Discard recovered draft</Button></div>
    </section>}
    <Dialog open={drafts.dialog} onOpenChange={open => { if (!open) drafts.cancel(); }}><DialogContent><DialogHeader><DialogTitle>Unsaved reconciliation work</DialogTitle><DialogDescription>Save setup and completed transaction entries before continuing, discard unsaved edits, or cancel to keep editing. Changes already submitted may have been saved.</DialogDescription></DialogHeader>
      {drafts.error && <p role="alert" className="text-sm text-destructive">{drafts.error}</p>}
      <DialogFooter className="flex-wrap gap-2"><Button type="button" variant="outline" disabled={drafts.busy} onClick={drafts.cancel}>Cancel</Button><Button type="button" variant="outline" disabled={drafts.busy} onClick={() => { void drafts.continueAction("discard"); }}>Discard and continue</Button><Button type="button" disabled={drafts.busy} onClick={() => { void drafts.continueAction("save"); }}>{drafts.busy ? "Please wait…" : "Save and continue"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
