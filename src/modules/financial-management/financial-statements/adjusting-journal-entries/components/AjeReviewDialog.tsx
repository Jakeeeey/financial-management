"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AjeAction, AjeAttachment, AjeAuditEvent, AdjustingEntry } from "../types";
import { ajeAttachmentPreviewUrl, ajeAttachmentThumbnailUrl, ajeAttachmentUrl, ajeEntryPrintUrl } from "../services/adjusting-journal-entries.api";
import { AjeAttachmentPreview, isPreviewableAjeImage } from "./AjeAttachmentPreview";
import { auditEventSummary, formatDate, formatDateTime, money, statusBadgeClass } from "./formatters";
import { availableActions, isSelfApproval } from "./AdjustingEntriesTable";

type Props = {
  open: boolean;
  journalNumber: string | null;
  entry: AdjustingEntry | null;
  attachments: AjeAttachment[];
  loading: boolean;
  error: string;
  attachmentsLoading: boolean;
  attachmentsError: string;
  auditEvents: AjeAuditEvent[];
  auditLoading: boolean;
  auditError: string;
  canReview: boolean;
  userId?: number;
  onAction: (entry: AdjustingEntry, action: AjeAction) => void;
  confirmingApproval: boolean;
  approvalBusy: boolean;
  approvalError: string;
  onRequestApproval: () => void;
  onCancelApproval: () => void;
  onConfirmApproval: (entry: AdjustingEntry) => void;
  onRetryDetails: () => void;
  onClose: () => void;
  onCloseAutoFocus: (event: { preventDefault: () => void }) => void;
};

export function AjeReviewDialog({ open, journalNumber, entry, attachments, loading, error, attachmentsLoading, attachmentsError, auditEvents, auditLoading, auditError, canReview, userId, onAction, confirmingApproval, approvalBusy, approvalError, onRequestApproval, onCancelApproval, onConfirmApproval, onRetryDetails, onClose, onCloseAutoFocus }: Props) {
  const reviewActions = entry ? availableActions(entry).filter(action => action === "approve" || action === "reject") : [];
  const selfReviewBlocked = Boolean(canReview && userId != null && entry && reviewActions.length && isSelfApproval(entry, userId));
  const approvalReady = Boolean(entry && !loading && !error && !attachmentsLoading && !auditLoading);
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl" onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader className="shrink-0 px-6 pt-6 pb-4 pr-12">
        <DialogTitle>{entry?.jeNo || journalNumber || "Review adjusting entry"}</DialogTitle>
        <DialogDescription>{canReview ? "Review journal details, workflow history, and supporting documents before deciding." : "Read-only view of the journal details, workflow history, and supporting documents."}</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
      {loading && <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading journal details…</p>}
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><span>{error}</span><Button type="button" variant="outline" size="sm" onClick={onRetryDetails}>Retry details</Button></div>}
      {confirmingApproval && approvalError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{approvalError}</p>}
      {!loading && entry && <div className="space-y-4">
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="outline" className={statusBadgeClass(entry.status)}>{entry.status}</Badge></div>
          <div><p className="text-xs text-muted-foreground">Accounting date</p><p className="text-sm">{formatDate(entry.transactionDate)}</p></div>
          <div><p className="text-xs text-muted-foreground">Reference</p><p className="break-words text-sm">{entry.reference || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Entry type</p><p className="text-sm">{entry.entryOrigin === "SYSTEM" ? "System journal" : entry.entryKind === "REVERSAL" ? "Reversal" : "Adjustment"}</p></div>
          <div><p className="text-xs text-muted-foreground">Created by</p><p className="text-sm">{entry.creatorName || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Submitted by</p><p className="text-sm">{entry.submittedByName || "—"}{entry.submittedAt ? ` · ${formatDateTime(entry.submittedAt)}` : ""}</p></div>
          <div><p className="text-xs text-muted-foreground">Approved by</p><p className="text-sm">{entry.approvedByName || "—"}{entry.approvedAt ? ` · ${formatDateTime(entry.approvedAt)}` : ""}</p></div>
          <div><p className="text-xs text-muted-foreground">Posted by</p><p className="text-sm">{entry.postedByName || "—"}{entry.datePosted ? ` · ${formatDateTime(entry.datePosted)}` : ""}</p></div>
          {entry.sourceJeNo && <div className="sm:col-span-2"><p className="text-xs text-muted-foreground">Original journal</p><p className="text-sm">{entry.sourceJeNo}{entry.sourceTransactionRef ? ` · ${entry.sourceTransactionRef}` : ""}</p></div>}
          <div className="sm:col-span-2 lg:col-span-4"><p className="text-xs text-muted-foreground">Description / narration</p><p className="whitespace-pre-wrap break-words text-sm">{entry.description || "—"}</p></div>
        </div>
        {entry.lastPostingError && <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">Posting error: {entry.lastPostingError}</p>}

        <section aria-label="Journal lines" className="space-y-2">
          <h3 className="font-semibold">Journal lines</h3>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[700px] text-sm"><thead className="bg-muted/30"><tr><th className="p-2 text-left">Account</th><th className="p-2 text-left">Department</th><th className="p-2 text-left">Line description</th><th className="p-2 text-right">Debit</th><th className="p-2 text-right">Credit</th></tr></thead>
              <tbody>{entry.details.map((line, index) => <tr key={line.id ?? index} className="border-t"><td className="p-2">{[line.accountNumber, line.accountTitle].filter(Boolean).join(" · ") || "—"}</td><td className="p-2">{line.departmentName || "—"}</td><td className="p-2">{line.description || "—"}</td><td className="p-2 text-right font-mono">{money(line.debit)}</td><td className="p-2 text-right font-mono">{money(line.credit)}</td></tr>)}</tbody>
              <tfoot className="border-t bg-muted/20"><tr><td className="p-2 font-semibold" colSpan={3}>Totals</td><td className="p-2 text-right font-mono">{money(entry.totalDebit)}</td><td className="p-2 text-right font-mono">{money(entry.totalCredit)}</td></tr></tfoot>
            </table>
          </div>
        </section>

        <section aria-label="Supporting documents" className="space-y-2 rounded-md border p-3">
          <h3 className="font-semibold">Supporting documents</h3>
          {attachmentsLoading && <p role="status" className="text-sm text-muted-foreground">Loading supporting documents…</p>}
          {!attachmentsLoading && attachmentsError && <p role="alert" className="text-sm text-amber-700">{attachmentsError}</p>}
          {!attachmentsLoading && !attachmentsError && attachments.length === 0 && <p className="text-sm text-muted-foreground">No supporting documents attached.</p>}
          {!attachmentsLoading && !attachmentsError && attachments.map(file => {
            const previewable = file.state === "READY" && isPreviewableAjeImage(file.mimeType, file.filename);
            return <AjeAttachmentPreview key={file.id} fileName={file.filename}
              downloadUrl={file.state === "READY" ? ajeAttachmentUrl(file.entryId, file.id) : undefined}
              openDownloadInNewTab
              thumbnailUrl={previewable ? ajeAttachmentThumbnailUrl(file.entryId, file.id) : undefined}
              previewUrl={previewable ? ajeAttachmentPreviewUrl(file.entryId, file.id) : undefined}
              statusText={file.state === "READY" ? undefined : "Upload incomplete"}
              metadata={`${file.uploadedByName} · ${formatDateTime(file.uploadedAt)}`} />;
          })}
        </section>

        <section aria-label="Audit trail" className="space-y-2 border-t pt-4">
          <h3 className="font-semibold">Audit trail</h3>
          {auditLoading && auditEvents.length === 0 && <p role="status" className="text-sm text-muted-foreground">Loading audit trail…</p>}
          {auditLoading && auditEvents.length > 0 && <p role="status" className="text-xs text-muted-foreground">Updating audit trail…</p>}
          {!auditLoading && auditError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{auditError}</p>}
          {!auditLoading && !auditError && auditEvents.length === 0 && <p className="text-sm text-muted-foreground">No audit events recorded.</p>}
          {auditEvents.length > 0 && <ol aria-busy={auditLoading} className="divide-y rounded-md border px-3">
            {auditEvents.map(event => <li key={event.id} className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
              <time dateTime={event.occurredAt} className="text-xs text-muted-foreground">{formatDateTime(event.occurredAt)}</time>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{event.action} by {event.actorName || "Name unavailable"}</p>
                <p className="text-sm text-muted-foreground">{auditEventSummary(event)}</p>
              </div>
            </li>)}
          </ol>}
        </section>
      </div>}
      {canReview && selfReviewBlocked && <p className="text-sm text-amber-700">Another user must review this entry because you created, prepared, or submitted it.</p>}
      </div>
      <DialogFooter className="shrink-0 flex-wrap border-t bg-background px-6 py-4">
        {!loading && entry && <Button type="button" variant="outline" asChild><a href={ajeEntryPrintUrl(entry.id,"pdf")} target="_blank" rel="noopener noreferrer">Print PDF</a></Button>}
        {confirmingApproval ? <>
          <Button type="button" variant="outline" disabled={approvalBusy} onClick={onCancelApproval}>Cancel</Button>
          <Button type="button" disabled={approvalBusy || !approvalReady || selfReviewBlocked || !reviewActions.includes("approve")} onClick={() => { if (entry) onConfirmApproval(entry); }}>{approvalBusy ? "Approving..." : "Confirm approval"}</Button>
        </> : <>
          {canReview && entry && !selfReviewBlocked && reviewActions.includes("reject") && <Button type="button" variant="outline" onClick={() => onAction(entry, "reject")}>Reject</Button>}
          {canReview && entry && !selfReviewBlocked && reviewActions.includes("approve") && <Button type="button" onClick={onRequestApproval}>Approve</Button>}
        </>}
        <DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
