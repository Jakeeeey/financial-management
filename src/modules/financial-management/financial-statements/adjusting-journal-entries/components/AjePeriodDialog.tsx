"use client";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { adjustingJournalEntriesApi as api } from "../services/adjusting-journal-entries.api";
import type { AjePeriod } from "../types";
import { formatDate, formatDateTime } from "./formatters";

export function AjePeriodDialog({ period, onClose, onSaved }: { period: AjePeriod; onClose: () => void; onSaved: (value: AjePeriod) => void }) {
  const [date, setDate] = React.useState(period.closedThroughDate || "");
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const lock = React.useRef(false);
  async function save() {
    if (lock.current) return;
    if (!reason.trim()) { setError("A reason is required."); return; }
    lock.current = true; setBusy(true); setError("");
    try { onSaved(await api.setPeriod(date || null, period.version, reason.trim())); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save the cutoff"); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent><DialogHeader><DialogTitle>Adjusting Entries period cutoff</DialogTitle></DialogHeader>
    <p className="text-sm text-muted-foreground">Entries dated on or before the cutoff cannot be submitted, approved, or posted. Existing drafts remain available for revision. Clear the date to reopen all dates.</p>
    <p className="text-sm">Current cutoff: <strong>{period.closedThroughDate ? formatDate(period.closedThroughDate) : "None"}</strong></p>
    {period.updatedByName && <p className="text-xs text-muted-foreground">Last changed by {period.updatedByName} · {formatDateTime(period.updatedAt)}</p>}
    <div className="space-y-1"><Label htmlFor="cutoff-date">Closed through date</Label><Input id="cutoff-date" type="date" value={date} disabled={busy} onChange={e => setDate(e.target.value)} /></div>
    <div className="space-y-1"><Label htmlFor="cutoff-reason">Reason *</Label><Textarea id="cutoff-reason" value={reason} maxLength={4000} disabled={busy} onChange={e => setReason(e.target.value)} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || (date || null) === period.closedThroughDate} onClick={() => void save()}>{busy ? "Saving…" : "Confirm cutoff change"}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

