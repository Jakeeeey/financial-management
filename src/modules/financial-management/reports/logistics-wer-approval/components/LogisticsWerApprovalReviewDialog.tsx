"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type { SubmissionReview } from "../services/logisticsWerApprovalApi";

function formatMoney(value: number | null | undefined): string {
  return `₱${Number(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface LogisticsWerApprovalReviewDialogProps {
  review: SubmissionReview | null;
  loading: boolean;
  error: string | null;
  deciding: boolean;
  decisionError: string | null;
  decisionNotice: string | null;
  onOpenChange: (open: boolean) => void;
  onDecide: (decision: "approve" | "return" | "reject", remarks: string) => void;
}

export function LogisticsWerApprovalReviewDialog({
  review,
  loading,
  error,
  deciding,
  decisionError,
  decisionNotice,
  onOpenChange,
  onDecide,
}: LogisticsWerApprovalReviewDialogProps) {
  const [remarks, setRemarks] = useState("");
  const open = loading || error !== null || review !== null;
  const submission = review?.submission ?? null;
  const status = (submission?.status || "").toLowerCase();
  const decidable = status === "submitted";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-[95vw] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>
            {submission ? `Review submission #${submission.id}` : "Review submission"}
          </DialogTitle>
          <DialogDescription>
            {review
              ? `Dispatch plan ${review.dispatchPlanDocNo} · ${formatMoney(submission?.totalAmount)}`
              : "Loading submission details…"}
          </DialogDescription>
        </DialogHeader>

        {loading && !review && (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Loading submission…
          </div>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Unable to load submission</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {review && submission && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Planned amount</p>
                <p className="mt-1 text-lg font-semibold">{formatMoney(review.plannedAmount)}</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Reserved amount</p>
                <p className="mt-1 text-lg font-semibold">{formatMoney(review.reservedAmount)}</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Remaining amount</p>
                <p className="mt-1 text-lg font-semibold">{formatMoney(review.remainingAmount)}</p>
              </div>
              <div className="rounded-xl border bg-card p-3">
                <p className="text-xs text-muted-foreground">Supplier</p>
                <p className="mt-1 text-sm font-semibold">
                  {review.supplierEligibility?.eligible
                    ? review.supplierEligibility.supplierName || `Supplier #${review.supplierEligibility.supplierId ?? "?"}`
                    : "Not eligible"}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-14">Line</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>Receipts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {submission.lines.map((line, index) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.lineNo ?? index + 1}</TableCell>
                      <TableCell className="text-right font-medium">{formatMoney(line.amount)}</TableCell>
                      <TableCell>{line.referenceNo || "—"}</TableCell>
                      <TableCell>{line.remarks || "—"}</TableCell>
                      <TableCell>
                        {line.receipts.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {line.receipts.map((receipt) => receipt.fileId ? (
                              <a
                                key={receipt.id}
                                href={`/api/fm/treasury/disbursements/attachments/${encodeURIComponent(receipt.fileId)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs underline"
                              >
                                Receipt #{receipt.id}
                              </a>
                            ) : (
                              <span key={receipt.id} className="text-xs text-muted-foreground">#{receipt.id}</span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {submission.disbursementId && (
              <Alert className="border-emerald-500/40 bg-emerald-500/5">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <AlertTitle>Converted</AlertTitle>
                <AlertDescription>
                  Standard Draft disbursement #{submission.disbursementId} was created from this submission.
                </AlertDescription>
              </Alert>
            )}

            {decidable ? (
              <div className="space-y-2 rounded-xl border p-4">
                <Label htmlFor="wer-decision-remarks">Decision remarks (required to return or reject)</Label>
                <Textarea
                  id="wer-decision-remarks"
                  value={remarks}
                  onChange={(event) => setRemarks(event.target.value)}
                  placeholder="Explain the decision…"
                  className="min-h-20"
                />
                {decisionError && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Decision failed</AlertTitle>
                    <AlertDescription>{decisionError}</AlertDescription>
                  </Alert>
                )}
                {decisionNotice && (
                  <Alert className="border-emerald-500/40 bg-emerald-500/5">
                    <CheckCircle2 className="size-4 text-emerald-600" />
                    <AlertTitle>Recorded</AlertTitle>
                    <AlertDescription>{decisionNotice}</AlertDescription>
                  </Alert>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="outline" disabled={deciding} onClick={() => onDecide("return", remarks)}>
                    {deciding ? "Saving…" : "Return"}
                  </Button>
                  <Button type="button" variant="destructive" disabled={deciding} onClick={() => onDecide("reject", remarks)}>
                    {deciding ? "Saving…" : "Reject"}
                  </Button>
                  <Button type="button" disabled={deciding} onClick={() => onDecide("approve", remarks)}>
                    {deciding ? "Approving…" : "Approve & Convert"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{submission.status || "Unknown"}</Badge>
                <span>This submission is no longer awaiting a decision.</span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
