"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LogisticsWerApprovalReviewDialog } from "./components/LogisticsWerApprovalReviewDialog";
import { APPROVAL_STATUS_OPTIONS, useLogisticsWerApproval } from "./hooks/useLogisticsWerApproval";
import type { ApprovalDecision } from "./services/logisticsWerApprovalApi";

function formatMoney(value: number | null | undefined): string {
  return `₱${Number(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadgeClassName(status: string | null): string {
  switch ((status || "").toLowerCase()) {
    case "approved":
    case "converted":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "submitted":
      return "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "returned":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "rejected":
    case "withdrawn":
      return "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300";
    default:
      return "border-muted-foreground/30 bg-muted/40 text-muted-foreground";
  }
}

export default function LogisticsWerApprovalModule() {
  const queue = useLogisticsWerApproval();
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionNotice, setDecisionNotice] = useState<string | null>(null);

  const handleDecide = async (decision: ApprovalDecision, remarks: string) => {
    setDecisionError(null);
    setDecisionNotice(null);
    try {
      const result = await queue.decide(decision, remarks.trim() || undefined);
      if (!result) return;
      if (decision === "approve") {
        setDecisionNotice(
          result.idempotent
            ? `Already converted as disbursement #${result.disbursementId}. No duplicate was created.`
            : `Approved. Standard Draft disbursement #${result.disbursementId} created.`,
        );
      } else {
        setDecisionNotice(`Submission ${decision === "return" ? "returned" : "rejected"}. Its reservation was released.`);
      }
      if (result.submission.status !== "submitted") {
        window.setTimeout(() => queue.closeReview(), 1200);
      }
    } catch (decideError) {
      setDecisionError(decideError instanceof Error ? decideError.message : "Unable to record the decision.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              value={queue.draftSearch}
              onChange={(event) => queue.setDraftSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") queue.applySearch();
              }}
              placeholder="Search plan, submission, remarks…"
              className="pl-9"
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={queue.applySearch}>
            Search
          </Button>
          <Select value={queue.status} onValueChange={queue.changeStatus}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {APPROVAL_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">{queue.totalElements} submission(s)</p>
      </div>

      {queue.error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Unable to load approval queue</AlertTitle>
          <AlertDescription>{queue.error}</AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Submission</TableHead>
              <TableHead>Dispatch plan</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Disbursement</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 inline size-4 animate-spin" /> Loading approval queue…
                </TableCell>
              </TableRow>
            ) : queue.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No submissions awaiting review.
                </TableCell>
              </TableRow>
            ) : queue.items.map((item) => (
              <TableRow key={item.submission.id}>
                <TableCell className="font-semibold">#{item.submission.id}</TableCell>
                <TableCell>
                  <span className="font-medium">{item.dispatchPlanDocNo}</span>
                  <span className="block text-xs text-muted-foreground">{formatMoney(item.dispatchPlanAmount)}</span>
                </TableCell>
                <TableCell className="text-right font-medium">{formatMoney(item.submission.totalAmount)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusBadgeClassName(item.submission.status)}>
                    {item.submission.status || "Unknown"}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {item.submission.disbursementId ? `#${item.submission.disbursementId}` : "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Button type="button" variant="outline" size="sm" onClick={() => void queue.openReview(item.submission.id)}>
                    Review
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Page {queue.page + 1} of {Math.max(queue.totalPages, 1)}</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={queue.page === 0} onClick={() => queue.setPage(queue.page - 1)}>
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={queue.page + 1 >= queue.totalPages}
            onClick={() => queue.setPage(queue.page + 1)}
          >
            Next
          </Button>
        </div>
      </div>

      <LogisticsWerApprovalReviewDialog
        review={queue.review}
        loading={queue.reviewLoading}
        error={queue.reviewError}
        deciding={queue.deciding}
        decisionError={decisionError}
        decisionNotice={decisionNotice}
        onOpenChange={(open) => {
          if (!open) {
            setDecisionError(null);
            setDecisionNotice(null);
            queue.closeReview();
          }
        }}
        onDecide={(decision, remarks) => void handleDecide(decision, remarks)}
      />
    </div>
  );
}
