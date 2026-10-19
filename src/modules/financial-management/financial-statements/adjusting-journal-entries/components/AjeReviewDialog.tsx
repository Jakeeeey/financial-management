"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AjeAttachment, AdjustingEntry } from "../types";
import { ajeAttachmentPreviewUrl, ajeAttachmentUrl } from "../services/adjusting-journal-entries.api";
import { AjeAttachmentPreview, isPreviewableAjeImage } from "./AjeAttachmentPreview";
import { formatDate, formatDateTime, money, statusBadgeClass } from "./formatters";

type Props = {
  open: boolean;
  journalNumber: string | null;
  entry: AdjustingEntry | null;
  attachments: AjeAttachment[];
  loading: boolean;
  error: string;
  attachmentsError: string;
  onClose: () => void;
};

export function AjeReviewDialog({ open, journalNumber, entry, attachments, loading, error, attachmentsError, onClose }: Props) {
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose(); }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
      <DialogHeader>
        <DialogTitle>{entry?.jeNo || journalNumber || "Review adjusting entry"}</DialogTitle>
        <DialogDescription>Read-only journal review. Use the queue row to approve, reject, post, or retry this entry.</DialogDescription>
      </DialogHeader>
      {loading && <p role="status" className="py-8 text-center text-sm text-muted-foreground">Loading journal details…</p>}
      {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>}
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
          {attachmentsError && <p role="alert" className="text-sm text-amber-700">{attachmentsError}</p>}
          {!attachmentsError && attachments.length === 0 && <p className="text-sm text-muted-foreground">No supporting documents attached.</p>}
          {attachments.map(file => {
            const previewable = file.state === "READY" && isPreviewableAjeImage(file.mimeType, file.filename);
            return <AjeAttachmentPreview key={file.id} fileName={file.filename}
              downloadUrl={file.state === "READY" ? ajeAttachmentUrl(file.entryId, file.id) : undefined}
              openDownloadInNewTab
              previewUrl={previewable ? ajeAttachmentPreviewUrl(file.entryId, file.id) : undefined}
              statusText={file.state === "READY" ? undefined : "Upload incomplete"}
              metadata={`${file.uploadedByName} · ${formatDateTime(file.uploadedAt)}`} />;
          })}
        </section>
      </div>}
      <DialogFooter><DialogClose asChild><Button type="button" variant="outline">Close</Button></DialogClose></DialogFooter>
    </DialogContent>
  </Dialog>;
}
