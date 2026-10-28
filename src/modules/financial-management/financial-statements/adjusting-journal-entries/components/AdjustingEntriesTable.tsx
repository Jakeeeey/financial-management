"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import type { AdjustingEntry, AjeAction } from "../types";
import { formatDate, formatDateTime, formatQueueAgeLabel, money, statusBadgeClass } from "./formatters";

export function availableActions(entry: AdjustingEntry): AjeAction[] {
  if (entry.entryOrigin !== "MANUAL") return [];
  switch (entry.status) {
    case "Draft":
    case "For Revision": return ["submit", "cancel"];
    case "Submitted": return ["post", "reject", "withdraw", "cancel"];
    case "Rejected": return ["revise", "cancel"];
    case "Failed": return entry.canCancelAfterReversalConflict ? ["cancel"] : ["retry", "revise", "cancel"];
    default: return [];
  }
}

export function actionRequiresReason(entry: AdjustingEntry, action: AjeAction) {
  return action === "reject" || action === "cancel" || action === "submit" && entry.status === "For Revision";
}

const creatorOnlyActions = new Set<AjeAction>(["submit", "withdraw", "revise", "cancel"]);

export function isEntryCreator(entry: AdjustingEntry, userId?: number) {
  return userId != null && entry.creatorId === userId;
}

export function isEntryPoster(entry: AdjustingEntry, userId?: number) {
  return userId != null && entry.entryOrigin === "MANUAL" && !isSelfApproval(entry, userId);
}

function availableActionsForUser(entry: AdjustingEntry, userId?: number) {
  const actions = availableActions(entry);
  return isEntryCreator(entry, userId) ? actions : actions.filter(action => !creatorOnlyActions.has(action));
}

export function actionsForPresentation(entry: AdjustingEntry, userId: number | undefined, creationView: boolean) {
  if (creationView && entry.status === "Submitted") return [];
  return availableActionsForUser(entry, userId).filter(action => !creationView || ["submit", "cancel"].includes(action));
}

export const actionLabels: Record<AjeAction, string> = { submit: "Submit", reject: "Return for revision", withdraw: "Withdraw", revise: "Revise", cancel: "Cancel entry", post: "Post", retry: "Retry posting" };

export function actionLabelForEntry(entry: AdjustingEntry, action: AjeAction) {
  return action === "cancel" && entry.canCancelAfterReversalConflict ? "Delete AJE" : actionLabels[action];
}

export function isSelfApproval(entry: AdjustingEntry, userId?: number) {
  return userId != null && [entry.creatorId, entry.preparedBy, entry.submittedBy].includes(userId);
}

function queueAge(entry: AdjustingEntry) {
  const status = entry.status;
  if (status !== "Submitted" && status !== "Approved" && status !== "Failed") return null;
  const timestamp = entry.status === "Submitted" ? entry.submittedAt : entry.status === "Approved" ? entry.approvedAt : entry.status === "Failed" ? entry.lastPostingAttemptAt : null;
  if (!timestamp) return null;
  const parsedTimestamp = /[zZ]|[+-]\d{2}:?\d{2}$/.test(timestamp) ? timestamp : `${timestamp}+08:00`;
  const elapsed = Date.now() - new Date(parsedTimestamp).getTime();
  if (!Number.isFinite(elapsed)) return null;
  const tone = elapsed > 72 * 60 * 60 * 1_000 ? "text-red-700" : elapsed > 24 * 60 * 60 * 1_000 ? "text-amber-700" : "text-muted-foreground";
  const containerTone = elapsed > 72 * 60 * 60 * 1_000 ? "border-red-500/30 bg-red-500/5 text-red-700" : elapsed > 24 * 60 * 60 * 1_000 ? "border-amber-500/30 bg-amber-500/5 text-amber-800" : "border-transparent bg-muted/20 text-foreground";
  const label = formatQueueAgeLabel(status, elapsed, !entry.canCancelAfterReversalConflict);
  return { label, tone, containerTone };
}

function queueTimestamp(entry: AdjustingEntry) {
  return entry.status === "Submitted" ? entry.submittedAt : entry.status === "Approved" ? entry.approvedAt : entry.status === "Failed" ? entry.lastPostingAttemptAt : null;
}

function primaryAction(entry: AdjustingEntry): AjeAction | null {
  switch (entry.status) {
    case "Draft":
    case "For Revision": return "submit";
    case "Submitted": return "post";
    case "Rejected": return "revise";
    case "Failed": return entry.canCancelAfterReversalConflict ? "cancel" : "retry";
    default: return null;
  }
}

function canReverse(entry: AdjustingEntry) {
  return entry.status === "Posted" && entry.entryOrigin === "MANUAL" && entry.entryKind === "ADJUSTMENT" && entry.totalDebit > 0 && entry.variance === 0;
}

function EntryActions({ entry, userId, readOnly, onView, onAction, onReverse, compactSummary = false, actionsDisabled = false, creationView = false }: {
  entry: AdjustingEntry; userId?: number; readOnly: boolean;
  onView: (entry: AdjustingEntry, edit: boolean, trigger?: HTMLElement) => void;
  onAction: (entry: AdjustingEntry, action: AjeAction, trigger?: HTMLElement) => void;
  onReverse: (entry: AdjustingEntry) => void;
  compactSummary?: boolean;
  creationView?: boolean;
  actionsDisabled?: boolean;
}) {
  if (compactSummary) return <Button size="sm" variant="outline" disabled={actionsDisabled} onClick={event => onView(entry, false, event.currentTarget)}>View</Button>;
  const actions = readOnly ? [] : actionsForPresentation(entry, userId, creationView);
  const mainAction = actions.includes(primaryAction(entry) as AjeAction) ? primaryAction(entry) : null;
  const secondaryActions = actions.filter(action => action !== mainAction);
  const canEdit = !readOnly && entry.entryOrigin === "MANUAL" && ["Draft", "For Revision"].includes(entry.status) && isEntryCreator(entry, userId);
  const showReverse = !readOnly && !creationView && canReverse(entry);
  const hasMoreActions = canEdit || secondaryActions.length > 0 || showReverse;
  const selfReviewBlocked = !readOnly && userId != null && ["post", "retry", "reject"].some(action => actions.includes(action as AjeAction)) && isSelfApproval(entry, userId);
  const postingActionBlocked = !readOnly && actions.some(action => ["post", "retry"].includes(action)) && !isEntryPoster(entry, userId);
  const postingActionTitle = "Another user must post this entry because you created, prepared, or submitted it.";
  const mainActionDisabled = mainAction === "post" && isSelfApproval(entry, userId)
    || ["post", "retry"].includes(mainAction || "") && !isEntryPoster(entry, userId);
  const mainActionTitle = mainAction === "post" && isSelfApproval(entry, userId)
    ? "Another user must review your submission"
    : ["post", "retry"].includes(mainAction || "") && !isEntryPoster(entry, userId) ? postingActionTitle : undefined;

  return <div className="flex flex-wrap items-center gap-1.5">
    <Button size="sm" variant="outline" disabled={actionsDisabled} onClick={event => onView(entry, false, event.currentTarget)}>View</Button>
    {mainAction && <Button size="sm" variant={mainAction === "cancel" && entry.canCancelAfterReversalConflict ? "destructive" : ["post", "retry", "submit"].includes(mainAction) ? "default" : "outline"} disabled={actionsDisabled || mainActionDisabled} title={mainActionTitle} onClick={event => onAction(entry, mainAction, event.currentTarget)}>{actionLabelForEntry(entry, mainAction)}</Button>}
    {!readOnly && selfReviewBlocked && <p className="basis-full text-xs text-amber-700">You created, prepared, or submitted this entry. Another user must review it.</p>}
    {postingActionBlocked && <p className="basis-full text-xs text-amber-700">{postingActionTitle}</p>}
    {hasMoreActions && <DropdownMenu>
      <DropdownMenuTrigger asChild><Button size="sm" variant="outline" disabled={actionsDisabled} aria-label={`More actions for ${entry.jeNo}`}><MoreHorizontal className="size-4 sm:mr-1" /><span className="hidden sm:inline">More</span></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>More actions</DropdownMenuLabel>
        {canEdit && <DropdownMenuItem onSelect={() => onView(entry, true)}>Edit</DropdownMenuItem>}
        {secondaryActions.map(action => {
          const blockedBySelfApproval = ["post", "retry", "reject"].includes(action) && isSelfApproval(entry, userId);
          const blockedByPostingApprover = ["post", "retry"].includes(action) && !isEntryPoster(entry, userId);
          return <DropdownMenuItem key={action} disabled={actionsDisabled || blockedBySelfApproval || blockedByPostingApprover} title={blockedByPostingApprover ? postingActionTitle : undefined} onSelect={event => onAction(entry, action, event.currentTarget as HTMLElement)}>{actionLabelForEntry(entry, action)}</DropdownMenuItem>;
        })}
        {showReverse && <DropdownMenuItem disabled={actionsDisabled} onSelect={() => onReverse(entry)}>Reverse</DropdownMenuItem>}
        {selfReviewBlocked && <><DropdownMenuSeparator /><div className="px-2 py-1.5 text-xs text-amber-700">A different user must post or return this entry.</div></>}
      </DropdownMenuContent>
    </DropdownMenu>}
  </div>;
}

function EntryDescription({ entry, compactSummary = false }: { entry: AdjustingEntry; compactSummary?: boolean }) {
  return <>
    <p className={compactSummary ? "line-clamp-1" : "line-clamp-2"}>{entry.description}</p>
    {entry.sourceJeNo && <p className="mt-1 text-xs text-muted-foreground">Original: {entry.sourceJeNo}{entry.sourceTransactionRef ? ` / ${entry.sourceTransactionRef}` : ""}</p>}
    {!compactSummary && entry.status === "Posted" && entry.variance !== 0 && <p className="mt-1 text-xs text-destructive">Historical imbalance: {money(entry.variance)}</p>}
    {!compactSummary && entry.lastPostingError && <p className="mt-1 text-xs text-destructive">{entry.lastPostingError}</p>}
  </>;
}

function actorWithTime(name: string | null | undefined, timestamp: string | null | undefined) {
  if (!name && !timestamp) return "—";
  return `${name || "Name unavailable"} · ${timestamp ? formatDateTime(timestamp) : "Time unavailable"}`;
}

function EntryLifecycle({ entry }: { entry: AdjustingEntry }) {
  const reviewEvents = [
    { label: "Approved by", name: entry.approvedByName, timestamp: entry.approvedAt },
    { label: "Returned by", name: entry.rejectedByName, timestamp: entry.rejectedAt },
  ].filter(event => event.name || event.timestamp);

  return <div className="space-y-1 break-words text-xs text-muted-foreground">
    <p><span className="font-medium text-foreground">Prepared:</span> {actorWithTime(entry.preparedByName, entry.preparedAt)}</p>
    <p><span className="font-medium text-foreground">Reviewed:</span> {reviewEvents.length
      ? reviewEvents.map(event => `${event.label} ${actorWithTime(event.name, event.timestamp)}`).join("; ")
      : "—"}</p>
    <p><span className="font-medium text-foreground">Posted:</span> {actorWithTime(entry.postedByName, entry.datePosted)}</p>
  </div>;
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

export function AdjustingEntriesTable({ entries, presentation = "posting", loading, emptyMessage, userId, readOnly, onView, onAction, onReverse, actionsDisabled = false }: {
  entries: AdjustingEntry[]; presentation?: "creation" | "posting" | "summary"; loading: boolean; emptyMessage?: string; userId?: number; readOnly: boolean;
  onView: (entry: AdjustingEntry, edit: boolean, trigger?: HTMLElement) => void; onAction: (entry: AdjustingEntry, action: AjeAction, trigger?: HTMLElement) => void; onReverse: (entry: AdjustingEntry) => void;
  actionsDisabled?: boolean;
}) {
  const compactSummary = presentation === "summary";
  if (loading && entries.length === 0) return <EntriesSkeleton />;
  if (entries.length === 0) return <div className="rounded-md border bg-background p-8 text-center text-sm text-muted-foreground">{emptyMessage || "No entries match these filters."}</div>;

  return <div>
    {loading && <p role="status" aria-live="polite" className="mb-2 text-xs font-medium text-muted-foreground">Updating…</p>}
    <div aria-busy={loading} className={loading ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
    <div className="hidden overflow-x-auto rounded-md border bg-background xl:block">
      <table className="w-full min-w-[1100px] text-sm"><thead className="bg-muted/30"><tr><th className="p-3 text-left">Journal / Reference</th><th className="p-3 text-left">Accounting date</th><th className="p-3 text-left">Description / Original</th><th className="p-3 text-left">Status</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit</th><th className="min-w-64 p-3 text-left">Prepared / Reviewed / Posted</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>
        {entries.map(entry => <tr key={entry.id} className="border-t align-top"><td className="max-w-48 p-3"><p className="font-medium">{entry.jeNo}</p><p className="break-words text-xs text-muted-foreground">{entry.reference}</p>{!compactSummary && <p className="mt-1 text-xs text-muted-foreground">{entry.entryOrigin === "SYSTEM" ? "System journal" : entry.entryKind === "REVERSAL" ? "Reversal" : "Adjustment"}</p>}</td>
          <td className="whitespace-nowrap p-3">{formatDate(entry.transactionDate)}</td><td className="max-w-64 p-3"><EntryDescription entry={entry} compactSummary={compactSummary} /></td>
          <td className="p-3"><Badge variant="outline" className={statusBadgeClass(entry.status)}>{entry.status}</Badge>{!compactSummary && queueAge(entry) && <p className={`mt-1 whitespace-normal text-xs ${queueAge(entry)?.tone}`}>{queueAge(entry)?.label}</p>}{!compactSummary && queueTimestamp(entry) && <p className="mt-0.5 whitespace-nowrap text-xs text-muted-foreground">{entry.status === "Submitted" ? "Submitted" : entry.status === "Approved" ? "Approved" : "Last failed"}: {formatDateTime(queueTimestamp(entry))}</p>}</td><td className="p-3 text-right font-mono">{money(entry.totalDebit)}</td><td className="p-3 text-right font-mono">{money(entry.totalCredit)}</td>
          <td className="min-w-64 p-3"><EntryLifecycle entry={entry} /></td>
          <td className="max-w-64 p-3"><EntryActions entry={entry} userId={userId} readOnly={readOnly} onView={onView} onAction={onAction} onReverse={onReverse} compactSummary={compactSummary} actionsDisabled={actionsDisabled} creationView={presentation === "creation"} /></td></tr>)}
      </tbody></table>
    </div>

    <div className="space-y-3 xl:hidden">
      {entries.map(entry => <article key={entry.id} className="space-y-3 rounded-md border bg-background p-3 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2"><div className="min-w-0"><h3 className="font-semibold">{entry.jeNo}</h3><p className="break-words text-xs text-muted-foreground">{entry.reference || "No reference"}</p></div></div>
          <Badge variant="outline" className={statusBadgeClass(entry.status)}>{entry.status}</Badge>
        </div>
        {compactSummary ? <p className="text-xs text-muted-foreground">Accounting date: {formatDate(entry.transactionDate)}</p> : <div className="grid grid-cols-2 gap-2 text-sm"><div><p className="text-xs text-muted-foreground">Accounting date</p><p>{formatDate(entry.transactionDate)}</p></div><div><p className="text-xs text-muted-foreground">Entry type</p><p>{entry.entryOrigin === "SYSTEM" ? "System journal" : entry.entryKind === "REVERSAL" ? "Reversal" : "Adjustment"}</p></div></div>}
        <div className="text-sm"><EntryDescription entry={entry} compactSummary={compactSummary} /></div>
        <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/30 p-2 text-sm"><div><p className="text-xs text-muted-foreground">Debit</p><p className="font-mono">{money(entry.totalDebit)}</p></div><div><p className="text-xs text-muted-foreground">Credit</p><p className="font-mono">{money(entry.totalCredit)}</p></div></div>
        <div className="rounded-md bg-muted/20 p-2"><EntryLifecycle entry={entry} /></div>
        {!compactSummary && queueAge(entry) && <div className={`rounded-md border p-2 text-xs ${queueAge(entry)?.containerTone}`}><p className="font-medium">{queueAge(entry)?.label}</p>{queueTimestamp(entry) && <p className="mt-0.5 text-muted-foreground">{entry.status === "Submitted" ? "Submitted" : entry.status === "Approved" ? "Approved" : "Last failed"}: {formatDateTime(queueTimestamp(entry))}</p>}</div>}
        <div className="border-t pt-3"><EntryActions entry={entry} userId={userId} readOnly={readOnly} onView={onView} onAction={onAction} onReverse={onReverse} compactSummary={compactSummary} actionsDisabled={actionsDisabled} creationView={presentation === "creation"} /></div>
      </article>)}
    </div>
    </div>
  </div>;
}
