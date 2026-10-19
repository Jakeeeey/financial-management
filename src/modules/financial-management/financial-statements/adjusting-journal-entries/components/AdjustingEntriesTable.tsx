"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AdjustingEntry, AjeAction } from "../types";
import { formatDate, formatDateTime, money, statusBadgeClass } from "./formatters";

export function availableActions(entry: AdjustingEntry): AjeAction[] {
  if (entry.entryOrigin !== "MANUAL") return [];
  switch (entry.status) {
    case "Draft": return ["submit","cancel"];
    case "Submitted": return ["approve","reject","withdraw","cancel"];
    case "Approved": return ["post","cancel"];
    case "Rejected": return ["revise","cancel"];
    case "Failed": return ["retry","revise","cancel"];
    default: return [];
  }
}
export const actionLabels: Record<AjeAction,string> = { submit:"Submit", approve:"Approve", reject:"Reject", withdraw:"Withdraw", revise:"Revise", cancel:"Cancel entry", post:"Post", retry:"Retry posting" };
export function isSelfApproval(entry: AdjustingEntry, userId: number) {
  return [entry.creatorId,entry.preparedBy,entry.submittedBy].includes(userId);
}
export function AdjustingEntriesTable({ entries, loading, userId, readOnly, onView, onAction, onReverse }: {
  entries: AdjustingEntry[]; loading: boolean; userId: number; readOnly: boolean;
  onView: (entry: AdjustingEntry, edit: boolean) => void; onAction: (entry: AdjustingEntry, action: AjeAction) => void; onReverse: (entry: AdjustingEntry) => void;
}) {
  return <div className="overflow-x-auto rounded-md border bg-background"><table className="w-full min-w-[1100px] text-sm"><thead className="bg-muted/30"><tr><th className="p-3 text-left">Journal / Reference</th><th className="p-3 text-left">Accounting date</th><th className="p-3 text-left">Description / Original</th><th className="p-3 text-left">Status</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit</th><th className="p-3 text-left">Prepared / Reviewed / Posted</th><th className="p-3 text-right">Actions</th></tr></thead><tbody>
    {loading && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">Loading adjusting entries…</td></tr>}
    {!loading && entries.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No entries match these filters.</td></tr>}
    {!loading && entries.map(entry => <tr key={entry.id} className="border-t align-top"><td className="max-w-48 p-3"><p className="font-medium">{entry.jeNo}</p><p className="break-words text-xs text-muted-foreground">{entry.reference}</p><p className="mt-1 text-xs text-muted-foreground">{entry.entryOrigin === "SYSTEM" ? "System journal" : entry.entryKind === "REVERSAL" ? "Reversal" : "Adjustment"}</p></td>
      <td className="whitespace-nowrap p-3">{formatDate(entry.transactionDate)}</td><td className="max-w-64 p-3"><p className="line-clamp-2">{entry.description}</p>{entry.sourceJeNo && <p className="mt-1 text-xs text-muted-foreground">Original: {entry.sourceJeNo}{entry.sourceTransactionRef ? ` / ${entry.sourceTransactionRef}` : ""}</p>}{entry.status === "Posted" && entry.variance !== 0 && <p className="mt-1 text-xs text-destructive">Historical imbalance: {money(entry.variance)}</p>}{entry.lastPostingError && <p className="mt-1 text-xs text-destructive">{entry.lastPostingError}</p>}</td>
      <td className="p-3"><Badge variant="outline" className={statusBadgeClass(entry.status)}>{entry.status}</Badge></td><td className="p-3 text-right font-mono">{money(entry.totalDebit)}</td><td className="p-3 text-right font-mono">{money(entry.totalCredit)}</td>
      <td className="min-w-36 p-3 text-xs"><p>Created: {entry.creatorName || "—"}</p><p>Submitted: {entry.submittedByName || "—"}</p><p>Approved: {entry.approvedByName || "—"}</p><p>Posted: {entry.postedByName || "—"}</p>{entry.datePosted && <p>{formatDateTime(entry.datePosted)}</p>}</td>
      <td className="max-w-64 p-3"><div className="flex flex-wrap justify-end gap-1"><Button size="sm" variant="outline" onClick={() => onView(entry,false)}>View</Button>{!readOnly && entry.entryOrigin === "MANUAL" && entry.status === "Draft" && <Button size="sm" variant="outline" onClick={() => onView(entry,true)}>Edit</Button>}
        {!readOnly && availableActions(entry).map(action => <Button key={action} size="sm" variant={action === "post" || action === "approve" ? "default" : "outline"} disabled={["approve","reject"].includes(action) && isSelfApproval(entry,userId)} title={["approve","reject"].includes(action) && isSelfApproval(entry,userId) ? "Another user must review your submission" : undefined} onClick={() => onAction(entry,action)}>{actionLabels[action]}</Button>)}
        {!readOnly && entry.status === "Posted" && entry.entryOrigin === "MANUAL" && entry.entryKind === "ADJUSTMENT" && entry.totalDebit > 0 && entry.variance === 0 && <Button size="sm" variant="outline" onClick={() => onReverse(entry)}>Reverse</Button>}
      </div></td></tr>)}
  </tbody></table></div>;
}
