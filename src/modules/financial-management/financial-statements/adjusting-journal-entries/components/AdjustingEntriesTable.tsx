"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Printer } from "lucide-react";
import { ajeEntryPrintUrl } from "../services/adjusting-journal-entries.api";
import type { AdjustingEntry, AjeAction } from "../types";
import { formatDate, formatDateTime, money, statusBadgeClass } from "./formatters";

export function availableActions(entry: AdjustingEntry): AjeAction[] {
  if (entry.entryOrigin !== "MANUAL") return [];
  switch (entry.status) {
    case "Draft": return ["submit", "cancel"];
    case "Submitted": return ["approve", "reject", "withdraw", "cancel"];
    case "Approved": return ["post", "cancel"];
    case "Rejected": return ["revise", "cancel"];
    case "Failed": return entry.canCancelAfterReversalConflict ? ["cancel"] : ["retry", "revise", "cancel"];
    default: return [];
  }
}

const creatorOnlyActions = new Set<AjeAction>(["submit", "withdraw", "revise", "cancel"]);

export function isEntryCreator(entry: AdjustingEntry, userId?: number) {
  return userId != null && entry.creatorId === userId;
}

export function isEntryApprover(entry: AdjustingEntry, userId?: number) {
  return userId != null && entry.approvedBy === userId;
}

function availableActionsForUser(entry: AdjustingEntry, userId?: number) {
  const actions = availableActions(entry);
  return isEntryCreator(entry, userId) ? actions : actions.filter(action => !creatorOnlyActions.has(action));
}

export const actionLabels: Record<AjeAction, string> = { submit: "Submit", approve: "Approve", reject: "Reject", withdraw: "Withdraw", revise: "Revise", cancel: "Cancel entry", post: "Post", retry: "Retry posting" };

export function actionLabelForEntry(entry: AdjustingEntry, action: AjeAction) {
  return action === "cancel" && entry.canCancelAfterReversalConflict ? "Delete AJE" : actionLabels[action];
}

export function isSelfApproval(entry: AdjustingEntry, userId?: number) {
  return userId != null && [entry.creatorId, entry.preparedBy, entry.submittedBy].includes(userId);
}

function queueAge(entry: AdjustingEntry) {
  const timestamp = entry.status === "Submitted" ? entry.submittedAt : entry.status === "Approved" ? entry.approvedAt : entry.status === "Failed" ? entry.lastPostingAttemptAt : null;
  if (!timestamp) return null;
  const parsedTimestamp = /[zZ]|[+-]\d{2}:?\d{2}$/.test(timestamp) ? timestamp : `${timestamp}+08:00`;
  const elapsed = Date.now() - new Date(parsedTimestamp).getTime();
  if (!Number.isFinite(elapsed)) return null;
  const minutes = Math.max(0, Math.floor(elapsed / 60_000));
  const age = minutes >= 1_440 ? `${Math.floor(minutes / 1_440)}d ${Math.floor((minutes % 1_440) / 60)}h` : minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
  const tone = elapsed > 72 * 60 * 60 * 1_000 ? "text-red-700" : elapsed > 24 * 60 * 60 * 1_000 ? "text-amber-700" : "text-muted-foreground";
  const containerTone = elapsed > 72 * 60 * 60 * 1_000 ? "border-red-500/30 bg-red-500/5 text-red-700" : elapsed > 24 * 60 * 60 * 1_000 ? "border-amber-500/30 bg-amber-500/5 text-amber-800" : "border-transparent bg-muted/20 text-foreground";
  const label = entry.status === "Submitted" ? `Waiting ${age} for review` : entry.status === "Approved" ? `Ready ${age} to post` : `Failed ${age} ago`;
  return { label, tone, containerTone };
}

function queueTimestamp(entry: AdjustingEntry) {
  return entry.status === "Submitted" ? entry.submittedAt : entry.status === "Approved" ? entry.approvedAt : entry.status === "Failed" ? entry.lastPostingAttemptAt : null;
}

function primaryAction(entry: AdjustingEntry): AjeAction | null {
  switch (entry.status) {
    case "Draft": return "submit";
    case "Submitted": return "approve";
    case "Approved": return "post";
    case "Rejected": return "revise";
    case "Failed": return entry.canCancelAfterReversalConflict ? "cancel" : "retry";
    default: return null;
  }
}

function canReverse(entry: AdjustingEntry) {
  return entry.status === "Posted" && entry.entryOrigin === "MANUAL" && entry.entryKind === "ADJUSTMENT" && entry.totalDebit > 0 && entry.variance === 0;
}

function EntryActions({ entry, userId, readOnly, onView, onAction, onReverse }: {
  entry: AdjustingEntry; userId?: number; readOnly: boolean;
  onView: (entry: AdjustingEntry, edit: boolean) => void;
  onAction: (entry: AdjustingEntry, action: AjeAction) => void;
  onReverse: (entry: AdjustingEntry) => void;
}) {
  const actions = readOnly ? [] : availableActionsForUser(entry, userId);
  const mainAction = actions.includes(primaryAction(entry) as AjeAction) ? primaryAction(entry) : null;
  const secondaryActions = actions.filter(action => action !== mainAction);
  const canEdit = !readOnly && entry.entryOrigin === "MANUAL" && entry.status === "Draft" && isEntryCreator(entry, userId);
  const selfReviewBlocked = !readOnly && userId != null && ["approve", "reject"].some(action => actions.includes(action as AjeAction)) && isSelfApproval(entry, userId);
  const postingActionBlocked = !readOnly && actions.some(action => ["post", "retry"].includes(action)) && !isEntryApprover(entry, userId);
  const postingActionTitle = `Only ${entry.approvedByName || "the user who approved this entry"} can ${entry.status === "Failed" ? "retry posting" : "post this entry"}.`;
  const mainActionDisabled = mainAction === "approve" && isSelfApproval(entry, userId)
    || ["post", "retry"].includes(mainAction || "") && !isEntryApprover(entry, userId);
  const mainActionTitle = mainAction === "approve" && isSelfApproval(entry, userId)
    ? "Another user must review your submission"
    : ["post", "retry"].includes(mainAction || "") && !isEntryApprover(entry, userId) ? postingActionTitle : undefined;

  return <div className="flex flex-wrap items-center gap-1.5">
    <Button size="sm" variant="outline" onClick={() => onView(entry, false)}>View</Button>
    {mainAction && <Button size="sm" variant={mainAction === "cancel" && entry.canCancelAfterReversalConflict ? "destructive" : ["post", "retry", "approve", "submit"].includes(mainAction) ? "default" : "outline"} disabled={mainActionDisabled} title={mainActionTitle} onClick={() => onAction(entry, mainAction)}>{actionLabelForEntry(entry, mainAction)}</Button>}
    {!readOnly && selfReviewBlocked && <p className="basis-full text-xs text-amber-700">You created, prepared, or submitted this entry. Another user must review it.</p>}
    {postingActionBlocked && <p className="basis-full text-xs text-amber-700">{postingActionTitle}</p>}
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button size="sm" variant="outline" aria-label={`More actions for ${entry.jeNo}`}><MoreHorizontal className="size-4 sm:mr-1" /><span className="hidden sm:inline">More</span></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>More actions</DropdownMenuLabel>
        {canEdit && <DropdownMenuItem onSelect={() => onView(entry, true)}>Edit</DropdownMenuItem>}
        {secondaryActions.map(action => {
          const blockedBySelfApproval = ["approve", "reject"].includes(action) && isSelfApproval(entry, userId);
          const blockedByPostingApprover = ["post", "retry"].includes(action) && !isEntryApprover(entry, userId);
          return <DropdownMenuItem key={action} disabled={blockedBySelfApproval || blockedByPostingApprover} title={blockedByPostingApprover ? postingActionTitle : undefined} onSelect={() => onAction(entry, action)}>{actionLabelForEntry(entry, action)}</DropdownMenuItem>;
        })}
        {!readOnly && canReverse(entry) && <DropdownMenuItem onSelect={() => onReverse(entry)}>Reverse</DropdownMenuItem>}
        {selfReviewBlocked && <><DropdownMenuSeparator /><div className="px-2 py-1.5 text-xs text-amber-700">A different user must approve or reject this entry.</div></>}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild><a href={ajeEntryPrintUrl(entry.id,"pdf")} target="_blank" rel="noopener noreferrer"><Printer className="size-4" /> Print PDF</a></DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>;
}

function EntryDescription({ entry }: { entry: AdjustingEntry }) {
  return <>
    <p className="line-clamp-2">{entry.description}</p>
    {entry.sourceJeNo && <p className="mt-1 text-xs text-muted-foreground">Original: {entry.sourceJeNo}{entry.sourceTransactionRef ? ` / ${entry.sourceTransactionRef}` : ""}</p>}
    {entry.status === "Posted" && entry.variance !== 0 && <p className="mt-1 text-xs text-destructive">Historical imbalance: {money(entry.variance)}</p>}
    {entry.lastPostingError && <p className="mt-1 text-xs text-destructive">{entry.lastPostingError}</p>}
  </>;
}

function EntriesSkeleton() {
  const row = (key: number) => <div key={key} className="flex items-center gap-4 border-t p-4">
    <div className="h-4 w-24 animate-pulse rounded bg-muted" />
    <div className="h-4 w-28 animate-pulse rounded bg-muted" />
    <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
    <div className="h-4 w-20 animate-pulse rounded bg-muted" />
  </div>;
  return <div className="overflow-hidden rounded-md border bg-background" aria-hidden="true">
    <div className="hidden xl:block">
      <div className="bg-muted/30 p-3"><div className="h-4 w-40 animate-pulse rounded bg-muted" /></div>
      {[1, 2, 3, 4, 5].map(row)}
    </div>
    <div className="space-y-3 p-3 xl:hidden">
      {[1, 2, 3].map(index => <div key={index} className="space-y-3 rounded-md border p-3">
        <div className="flex items-center justify-between"><div className="h-4 w-28 animate-pulse rounded bg-muted" /><div className="h-5 w-16 animate-pulse rounded bg-muted" /></div>
        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        <div className="h-9 w-full animate-pulse rounded bg-muted" />
      </div>)}
    </div>
  </div>;
}

export function AdjustingEntriesTable({ entries, loading, userId, readOnly, onView, onAction, onReverse, bulkActionsEnabled = false, selectedEntryIds, onToggleEntrySelection, onTogglePageSelection, onBulkApprove, bulkBusy = false }: {
  entries: AdjustingEntry[]; loading: boolean; userId?: number; readOnly: boolean;
  onView: (entry: AdjustingEntry, edit: boolean) => void; onAction: (entry: AdjustingEntry, action: AjeAction) => void; onReverse: (entry: AdjustingEntry) => void;
  bulkActionsEnabled?: boolean; selectedEntryIds: ReadonlySet<number>; onToggleEntrySelection: (entryId: number, selected: boolean) => void;
  onTogglePageSelection: (entryIds: number[], selected: boolean) => void; onBulkApprove: (entries: AdjustingEntry[]) => void; bulkBusy?: boolean;
}) {
  if (loading && entries.length === 0) return <EntriesSkeleton />;
  if (entries.length === 0) return <div className="rounded-md border bg-background p-8 text-center text-sm text-muted-foreground">No entries match these filters.</div>;

  const eligibleForBulkApproval = bulkActionsEnabled && userId != null ? entries.filter(entry => entry.entryOrigin === "MANUAL" && availableActions(entry).includes("approve") && !isSelfApproval(entry, userId)) : [];
  const selectedForBulkApproval = eligibleForBulkApproval.filter(entry => selectedEntryIds.has(entry.id));
  const allEligibleSelected = eligibleForBulkApproval.length > 0 && selectedForBulkApproval.length === eligibleForBulkApproval.length;

  return <div>
    {bulkActionsEnabled && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/20 p-3">
      <label className="flex items-center gap-2 text-sm"><Checkbox checked={allEligibleSelected ? true : selectedForBulkApproval.length ? "indeterminate" : false} disabled={!eligibleForBulkApproval.length || bulkBusy || loading} onCheckedChange={checked => onTogglePageSelection(eligibleForBulkApproval.map(entry => entry.id), checked === true)} aria-label="Select eligible entries on this page" />Select eligible on this page <span className="text-muted-foreground">({eligibleForBulkApproval.length})</span></label>
      <div className="flex flex-wrap items-center gap-2"><span className="text-sm text-muted-foreground">{selectedForBulkApproval.length} selected</span><Button type="button" size="sm" disabled={!selectedForBulkApproval.length || bulkBusy || loading} onClick={() => onBulkApprove(selectedForBulkApproval)}>{bulkBusy ? "Approving…" : `Approve selected${selectedForBulkApproval.length ? ` (${selectedForBulkApproval.length})` : ""}`}</Button></div>
    </div>}
    {loading && <p role="status" aria-live="polite" className="mb-2 text-xs font-medium text-muted-foreground">Updating…</p>}
    <div aria-busy={loading} className={loading ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
    <div className="hidden overflow-x-auto rounded-md border bg-background xl:block">
      <table className="w-full min-w-[1100px] text-sm"><thead className="bg-muted/30"><tr>{bulkActionsEnabled && <th className="w-10 p-3"><span className="sr-only">Select</span></th>}<th className="p-3 text-left">Journal / Reference</th><th className="p-3 text-left">Accounting date</th><th className="p-3 text-left">Description / Original</th><th className="p-3 text-left">Status</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit</th><th className="p-3 text-left">Prepared / Reviewed / Posted</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>
        {entries.map(entry => <tr key={entry.id} className="border-t align-top">{bulkActionsEnabled && <td className="p-3">{eligibleForBulkApproval.some(candidate => candidate.id === entry.id) && <Checkbox checked={selectedEntryIds.has(entry.id)} disabled={bulkBusy || loading} onCheckedChange={checked => onToggleEntrySelection(entry.id, checked === true)} aria-label={`Select ${entry.jeNo} for approval`} />}</td>}<td className="max-w-48 p-3"><p className="font-medium">{entry.jeNo}</p><p className="break-words text-xs text-muted-foreground">{entry.reference}</p><p className="mt-1 text-xs text-muted-foreground">{entry.entryOrigin === "SYSTEM" ? "System journal" : entry.entryKind === "REVERSAL" ? "Reversal" : "Adjustment"}</p></td>
          <td className="whitespace-nowrap p-3">{formatDate(entry.transactionDate)}</td><td className="max-w-64 p-3"><EntryDescription entry={entry} /></td>
          <td className="p-3"><Badge variant="outline" className={statusBadgeClass(entry.status)}>{entry.status}</Badge>{queueAge(entry) && <p className={`mt-1 whitespace-nowrap text-xs ${queueAge(entry)?.tone}`}>{queueAge(entry)?.label}</p>}{queueTimestamp(entry) && <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">{entry.status === "Submitted" ? "Submitted" : entry.status === "Approved" ? "Approved" : "Last failed"}: {formatDateTime(queueTimestamp(entry))}</p>}</td><td className="p-3 text-right font-mono">{money(entry.totalDebit)}</td><td className="p-3 text-right font-mono">{money(entry.totalCredit)}</td>
          <td className="min-w-36 p-3 text-xs"><p>Created: {entry.creatorName || "—"}</p><p>Submitted: {entry.submittedByName || "—"}</p><p>Approved: {entry.approvedByName || "—"}</p><p>Posted: {entry.postedByName || "—"}</p>{entry.datePosted && <p>{formatDateTime(entry.datePosted)}</p>}</td>
          <td className="max-w-64 p-3"><EntryActions entry={entry} userId={userId} readOnly={readOnly} onView={onView} onAction={onAction} onReverse={onReverse} /></td></tr>)}
      </tbody></table>
    </div>

    <div className="space-y-3 xl:hidden">
      {entries.map(entry => <article key={entry.id} className="space-y-3 rounded-md border bg-background p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">{bulkActionsEnabled && eligibleForBulkApproval.some(candidate => candidate.id === entry.id) && <Checkbox checked={selectedEntryIds.has(entry.id)} disabled={bulkBusy || loading} onCheckedChange={checked => onToggleEntrySelection(entry.id, checked === true)} aria-label={`Select ${entry.jeNo} for approval`} className="mt-1" />}<div className="min-w-0"><h3 className="font-semibold">{entry.jeNo}</h3><p className="break-words text-xs text-muted-foreground">{entry.reference || "No reference"}</p></div></div>
          <Badge variant="outline" className={statusBadgeClass(entry.status)}>{entry.status}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Accounting date</p><p>{formatDate(entry.transactionDate)}</p></div><div><p className="text-xs text-muted-foreground">Entry type</p><p>{entry.entryOrigin === "SYSTEM" ? "System journal" : entry.entryKind === "REVERSAL" ? "Reversal" : "Adjustment"}</p></div></div>
        <div className="text-sm"><EntryDescription entry={entry} /></div>
        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-2 text-sm"><div><p className="text-xs text-muted-foreground">Debit</p><p className="font-mono">{money(entry.totalDebit)}</p></div><div><p className="text-xs text-muted-foreground">Credit</p><p className="font-mono">{money(entry.totalCredit)}</p></div></div>
        {queueAge(entry) && <div className={`rounded-md border p-2 text-xs ${queueAge(entry)?.containerTone}`}><p className="font-medium">{queueAge(entry)?.label}</p>{queueTimestamp(entry) && <p className="mt-0.5 text-muted-foreground">{entry.status === "Submitted" ? "Submitted" : entry.status === "Approved" ? "Approved" : "Last failed"}: {formatDateTime(queueTimestamp(entry))}</p>}</div>}
        <details className="text-xs text-muted-foreground"><summary className="cursor-pointer py-1 font-medium">Workflow history</summary><div className="grid grid-cols-2 gap-1 pt-2"><span>Created by</span><span>{entry.creatorName || "—"}</span><span>Submitted by</span><span>{entry.submittedByName || "—"}</span><span>Approved by</span><span>{entry.approvedByName || "—"}</span><span>Posted by</span><span>{entry.postedByName || "—"}</span>{entry.datePosted && <><span>Posted at</span><span>{formatDateTime(entry.datePosted)}</span></>}</div></details>
        <div className="border-t pt-3"><EntryActions entry={entry} userId={userId} readOnly={readOnly} onView={onView} onAction={onAction} onReverse={onReverse} /></div>
      </article>)}
    </div>
    </div>
  </div>;
}
