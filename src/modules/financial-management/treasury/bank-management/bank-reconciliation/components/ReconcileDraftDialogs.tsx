"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { useReconcileDrafts } from "../hooks/useReconcileDrafts";

export function ReconcileDraftDialogs({ drafts }: { drafts: ReturnType<typeof useReconcileDrafts> }) {
  return <>
    {drafts.error && !drafts.dialog && <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{drafts.error}</p>}
    <Dialog open={drafts.dialog} onOpenChange={open => { if (!open) drafts.cancel(); }}><DialogContent><DialogHeader><DialogTitle>Unsaved reconciliation work</DialogTitle><DialogDescription>Save setup and completed transaction entries before continuing, discard unsaved edits, or cancel to keep editing. Changes already submitted may have been saved.</DialogDescription></DialogHeader>
      {drafts.error && <p role="alert" className="text-sm text-destructive">{drafts.error}</p>}
      <DialogFooter className="flex-wrap gap-2"><Button type="button" variant="outline" disabled={drafts.busy} onClick={drafts.cancel}>Cancel</Button><Button type="button" variant="outline" disabled={drafts.busy} onClick={() => { void drafts.continueAction("discard"); }}>Discard and continue</Button><Button type="button" disabled={drafts.busy} onClick={() => { void drafts.continueAction("save"); }}>{drafts.busy ? "Please wait…" : "Save and continue"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
