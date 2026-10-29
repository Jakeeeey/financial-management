"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { AjeAction, AjeAttachment, AjeAuditEvent, AdjustingEntry } from "../types";
import { ajeAttachmentPreviewUrl, ajeAttachmentThumbnailUrl, ajeAttachmentUrl, ajeEntryPrintUrl } from "../services/adjusting-journal-entries.api";
import { AjeAttachmentPreview, isPreviewableAjeImage } from "./AjeAttachmentPreview";
import { AjeDataFreshness, AjeRetryAlert } from "./AjeDataFreshness";
import { auditEventSummary, formatDate, formatDateTime, money, statusBadgeClass } from "./formatters";
import { availableActions } from "./AdjustingEntriesTable";

export function canConfirmSubmission(entry: AdjustingEntry | null, reviewReady: boolean, notes: string) {
  return Boolean(entry && reviewReady && availableActions(entry).includes("submit")
    && (entry.status !== "For Revision" || notes.trim()));
}

type Props = {
  open: boolean;
  journalNumber: string | null;
  entry: AdjustingEntry | null;
  attachments: AjeAttachment[];
  loading: boolean;
  error: string;
  attachmentsLoading: boolean;
  attachmentsError: string;
  detailsUpdatedAt: number | null;
  attachmentsUpdatedAt: number | null;
  auditEvents: AjeAuditEvent[];
  auditLoading: boolean;
  auditError: string;
  auditUpdatedAt: number | null;
  canReview: boolean;
  userId?: number;
  onAction: (entry: AdjustingEntry, action: AjeAction) => void;
  confirmingPosting: boolean;
  postingBusy: boolean;
  postingError: string;
  postingUncertain: boolean;
  checkingPosting: boolean;
  onCheckPosting: () => void;
  confirmingSubmission: boolean;
  submissionBusy: boolean;
  submissionError: string;
  submissionNotes: string;
  onSubmissionNotesChange: (notes: string) => void;
  onCancelSubmission: () => void;
  onConfirmSubmission: (entry: AdjustingEntry, notes: string) => void;
  onRequestPosting: () => void;
  onCancelPosting: () => void;
  onConfirmPosting: (entry: AdjustingEntry) => void;
  onRetryDetails: () => void;
  onRetryAttachments: () => void;
  onRetryAudit: () => void;
  onClose: () => void;
  onCloseAutoFocus: (event: { preventDefault: () => void }) => void;
};

export function AjeReviewDialog({ open, journalNumber, entry, attachments, loading, error, attachmentsLoading, attachmentsError, detailsUpdatedAt, attachmentsUpdatedAt, auditEvents, auditLoading, auditError, auditUpdatedAt, canReview, onAction, confirmingPosting, postingBusy, postingUncertain, checkingPosting, onCheckPosting, postingError, confirmingSubmission, submissionBusy, submissionError, submissionNotes, onSubmissionNotesChange, onCancelSubmission, onConfirmSubmission, onRequestPosting, onCancelPosting, onConfirmPosting, onRetryDetails, onRetryAttachments, onRetryAudit, onClose, onCloseAutoFocus }: Props) {
  const reviewActions = entry ? availableActions(entry).filter(action => action === "post" || action === "retry" || action === "reject" || action === "reject-final") : [];
  const reviewReady = Boolean(entry && !loading && !error && !attachmentsLoading && !attachmentsError && !auditLoading && !auditError);
  const revisionNotesRequired = entry?.status === "For Revision";
  return <Dialog open={open} onOpenChange={value => { if (!value && !postingBusy && !submissionBusy) onClose(); }}>
    <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl" onCloseAutoFocus={onCloseAutoFocus}>
      <DialogHeader className="shrink-0 px-6 pt-6 pb-4 pr-12">
        <DialogTitle>{entry?.jeNo || journalNumber || "Review adjusting entry"}</DialogTitle>
        <DialogDescription>{confirmingSubmission ? "Review the complete journal before submitting it for posting." : canReview ? "Review the complete journal before posting or returning it for revision. Posting commits it to the General Ledger." : "Read-only view of the journal details, workflow history, and supporting documents."}</DialogDescription>
        <AjeDataFreshness label="Journal details" updatedAt={detailsUpdatedAt} loading={loading} stale={Boolean(error)} />
      </DialogHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-4">
      {loading && <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading journal details…</p>}
      {error && <AjeRetryAlert message={error} retrying={loading} retryLabel="Retry details" onRetry={onRetryDetails} />}
      {confirmingPosting && postingError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{postingError}</p>}
      {confirmingSubmission && submissionError && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{submissionError}</p>}
      {!loading && entry && <div className="space-y-4">
        <div className="grid gap-3 rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Status</p><Badge variant="outline" className={statusBadgeClass(entry.status)}>{entry.status}</Badge></div>
          <div><p className="text-xs text-muted-foreground">Accounting date</p><p className="text-sm">{formatDate(entry.transactionDate)}</p></div>
          <div><p className="text-xs text-muted-foreground">Reference</p><p className="break-words text-sm">{entry.reference || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Entry type</p><p className="text-sm">{entry.entryOrigin === "SYSTEM" ? "System journal" : entry.entryKind === "REVERSAL" ? "Reversal" : "Adjustment"}</p></div>
          <div><p className="text-xs text-muted-foreground">Created by</p><p className="text-sm">{entry.creatorName || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Submitted by</p><p className="text-sm">{entry.submittedByName || "—"}{entry.submittedAt ? ` · ${formatDateTime(entry.submittedAt)}` : ""}</p></div>
          {(entry.approvedByName || entry.approvedAt) && <div><p className="text-xs text-muted-foreground">Historical approval</p><p className="text-sm">{entry.approvedByName || "—"}{entry.approvedAt ? ` · ${formatDateTime(entry.approvedAt)}` : ""}</p></div>}
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

        {confirmingSubmission && revisionNotesRequired && <div className="space-y-1.5 rounded-md border bg-muted/10 p-3">
          <Label htmlFor="aje-submission-revision-notes">Revision notes <span aria-hidden="true">*</span></Label>
          <p id="aje-submission-revision-notes-hint" className="text-xs text-muted-foreground">Explain how you addressed the requested revisions. This note will appear in the audit trail.</p>
          <Textarea id="aje-submission-revision-notes" aria-describedby="aje-submission-revision-notes-hint" maxLength={4000} required value={submissionNotes} disabled={submissionBusy} onChange={event => onSubmissionNotesChange(event.target.value)} />
        </div>}

        <section aria-label="Supporting documents" className="space-y-2 rounded-md border p-3">
          <div><h3 className="font-semibold">Supporting documents</h3><AjeDataFreshness label="Documents" updatedAt={attachmentsUpdatedAt} loading={attachmentsLoading} stale={Boolean(attachmentsError)} /></div>
          {attachmentsLoading && <p role="status" className="text-sm text-muted-foreground">Loading supporting documents…</p>}
          {attachmentsError && <AjeRetryAlert message={attachmentsError} retrying={attachmentsLoading} retryLabel="Retry documents" onRetry={onRetryAttachments} />}
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
          <div><h3 className="font-semibold">Audit trail</h3><AjeDataFreshness label="Audit events" updatedAt={auditUpdatedAt} loading={auditLoading} stale={Boolean(auditError)} /></div>
          {auditLoading && auditEvents.length === 0 && <p role="status" className="text-sm text-muted-foreground">Loading audit trail…</p>}
          {auditLoading && auditEvents.length > 0 && <p role="status" className="text-xs text-muted-foreground">Updating audit trail…</p>}
          {auditError && <AjeRetryAlert message={auditError} retrying={auditLoading} retryLabel="Retry audit events" onRetry={onRetryAudit} />}
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
      </div>
      <DialogFooter className="shrink-0 flex-wrap border-t bg-background px-6 py-4">
        {!loading && entry && <Button type="button" variant="outline" asChild><a href={ajeEntryPrintUrl(entry.id,"pdf")} target="_blank" rel="noopener noreferrer">Print PDF</a></Button>}
        {confirmingSubmission ? <>
          <Button type="button" variant="outline" disabled={submissionBusy} onClick={onCancelSubmission}>Cancel submission</Button>
          <Button type="button" disabled={submissionBusy || !canConfirmSubmission(entry,reviewReady,submissionNotes)} onClick={() => { if (entry) onConfirmSubmission(entry,submissionNotes); }}>{submissionBusy ? "Submitting..." : "Confirm submission"}</Button>
        </> : confirmingPosting ? <>
          <Button type="button" variant="outline" disabled={postingBusy} onClick={onCancelPosting}>Cancel</Button>
          <Button type="button" disabled={postingBusy || postingUncertain || !reviewReady || !reviewActions.some(action => action === "post" || action === "retry")} onClick={() => { if (entry) onConfirmPosting(entry); }}>{postingBusy ? "Posting..." : "Confirm posting"}</Button>
          {postingUncertain && <Button type="button" disabled={checkingPosting || postingBusy} onClick={onCheckPosting}>{checkingPosting ? "Checking status..." : "Check posting status"}</Button>}
        </> : <>
          {canReview && entry && reviewActions.includes("reject-final") && <Button type="button" variant="destructive" onClick={() => onAction(entry, "reject-final")}>Reject</Button>}
          {canReview && entry && reviewActions.includes("reject") && <Button type="button" variant="outline" onClick={() => onAction(entry, "reject")}>Return for revision</Button>}
          {canReview && entry && reviewActions.some(action => action === "post" || action === "retry") && <Button type="button" onClick={onRequestPosting}>{entry.status === "Failed" ? "Retry posting" : "Post"}</Button>}
        </>}
        {!confirmingSubmission && <DialogClose asChild><Button type="button" variant="outline" disabled={postingBusy || submissionBusy}>Close</Button></DialogClose>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
