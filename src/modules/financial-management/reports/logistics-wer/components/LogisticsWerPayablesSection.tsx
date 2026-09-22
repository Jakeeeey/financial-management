"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, Loader2, Paperclip, Plus, Trash2, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { displayWerStatus } from "../utils/status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WerCoaCombobox } from "./WerCoaCombobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import type {
  LogisticsWerDispatchPlanDetail,
  LogisticsWerPayableSubmission,
} from "../types";
import {
  deletePayableReceipt,
  fetchPayableCoas,
  savePayableDraft,
  submitPayable,
  uploadPayableReceipt,
  withdrawPayableSubmission,
  type PayableCoaOption,
  type PayableLineInput,
  type StagedReceipt,
} from "../services/logisticsWerApi";

function formatMoney(value: number | null | undefined): string {
  return `₱${Number(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function submissionBadgeClassName(status: string | null): string {
  switch ((status || "").toLowerCase()) {
    case "approved":
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

function receiptViewHref(fileId: string | null): string | null {
  if (!fileId) return null;
  return `/api/fm/treasury/disbursements/attachments/${encodeURIComponent(fileId)}`;
}

interface EditableLine {
  key: number;
  amount: string;
  referenceNo: string;
  remarks: string;
  date: string;
  coaId: string;
  receipts: StagedReceipt[];
}

function todayDateOnly(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyLine(key: number): EditableLine {
  return { key, amount: "", referenceNo: "", remarks: "", date: todayDateOnly(), coaId: "", receipts: [] };
}

interface LogisticsWerPayablesSectionProps {
  planId: number;
  planStatus: string | null;
  detail: LogisticsWerDispatchPlanDetail;
  onChanged: () => Promise<void> | void;
}

export function LogisticsWerPayablesSection({ planId, planStatus, detail, onChanged }: LogisticsWerPayablesSectionProps) {
  const [lines, setLines] = useState<EditableLine[]>([emptyLine(1)]);
  const [lineKey, setLineKey] = useState(2);
  const [coas, setCoas] = useState<PayableCoaOption[]>([]);
  const [coasError, setCoasError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<number | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);

  const eligibility = detail.supplierEligibility ?? null;
  const submissions = detail.submissions ?? [];
  const isForClearance = (planStatus || "").toLowerCase() === "for clearance";

  useEffect(() => {
    if (!isForClearance) return;
    let active = true;
    fetchPayableCoas()
      .then((options) => {
        if (active) setCoas(options);
      })
      .catch((loadError) => {
        if (active) setCoasError(loadError instanceof Error ? loadError.message : "Unable to load chart of accounts.");
      });
    return () => {
      active = false;
    };
  }, [isForClearance]);

  const updateLine = (key: number, patch: Partial<EditableLine>) => {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  };

  const linesTotal = lines.reduce((sum, line) => {
    const amount = Number(line.amount);
    return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);

  const buildPayload = (): PayableLineInput[] => lines.map((line) => ({
    amount: Number(line.amount),
    referenceNo: line.referenceNo.trim() || null,
    remarks: line.remarks.trim() || null,
    date: line.date || null,
    coaId: line.coaId ? Number(line.coaId) : null,
    receiptFileIds: line.receipts.map((receipt) => receipt.fileId),
  }));

  const handleAction = async (kind: "save-draft" | "submit") => {
    setFormError(null);
    setNotice(null);
    setSubmittedId(null);
    setBusy(true);
    try {
      const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `wer-${planId}-${Date.now()}`;
      const submission = kind === "submit"
        ? await submitPayable(planId, buildPayload(), idempotencyKey)
        : await savePayableDraft(planId, buildPayload(), idempotencyKey);
      setNotice(
        kind === "submit"
          ? `Submission #${submission.id} recorded for QA approval.`
          : `Draft #${submission.id} saved.`,
      );
      if (kind === "submit") setSubmittedId(submission.id);
      setLines([emptyLine(1)]);
      setLineKey((next) => next + 1);
      await onChanged();
    } catch (actionError) {
      setFormError(actionError instanceof Error ? actionError.message : "Unable to record the payable.");
    } finally {
      setBusy(false);
    }
  };

  const handleAttach = async (key: number, file: File | undefined) => {
    if (!file) return;
    setFormError(null);
    setUploadingKey(key);
    try {
      const staged = await uploadPayableReceipt(planId, file);
      setLines((current) => current.map((line) => (
        line.key === key ? { ...line, receipts: [...line.receipts, staged] } : line
      )));
    } catch (uploadError) {
      setFormError(uploadError instanceof Error ? uploadError.message : "Unable to upload the receipt.");
    } finally {
      setUploadingKey(null);
    }
  };

  const handleDetach = async (key: number, fileId: string) => {
    setFormError(null);
    try {
      await deletePayableReceipt(planId, fileId);
      setLines((current) => current.map((line) => (
        line.key === key ? { ...line, receipts: line.receipts.filter((receipt) => receipt.fileId !== fileId) } : line
      )));
    } catch (detachError) {
      setFormError(detachError instanceof Error ? detachError.message : "Unable to remove the receipt.");
    }
  };

  const handleWithdraw = async (submission: LogisticsWerPayableSubmission) => {
    if (!window.confirm(`Withdraw submission #${submission.id}? Its reservation will be released.`)) return;
    setFormError(null);
    setWithdrawingId(submission.id);
    try {
      await withdrawPayableSubmission(planId, submission.id);
      setNotice(`Submission #${submission.id} withdrawn; its reservation was released.`);
      await onChanged();
    } catch (withdrawError) {
      setFormError(withdrawError instanceof Error ? withdrawError.message : "Unable to withdraw the submission.");
    } finally {
      setWithdrawingId(null);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h3 className="flex items-center gap-2 font-semibold">
          Logistics payables
          {detail.isLiquidated && (
            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
              Liquidated
            </Badge>
          )}
        </h3>
        <p className="text-xs text-muted-foreground">
          Record payable drafts against this dispatch plan and submit them for QA approval.
        </p>
      </div>

      {eligibility ? (
        eligibility.eligible ? (
          <Alert className="border-emerald-500/40 bg-emerald-500/5">
            <CheckCircle2 className="size-4 text-emerald-600" />
            <AlertTitle>Driver supplier eligible</AlertTitle>
            <AlertDescription>
              {eligibility.supplierName || `Supplier #${eligibility.supplierId ?? "?"}`} is the active supplier linked to this driver.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertTitle>Payable submission blocked</AlertTitle>
            <AlertDescription>{eligibility.reason || "The assigned driver has no eligible supplier account."}</AlertDescription>
          </Alert>
        )
      ) : (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Eligibility unavailable</AlertTitle>
          <AlertDescription>Supplier eligibility could not be resolved for this dispatch plan.</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Planned amount</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(detail.plannedAmount ?? detail.plan.amount)}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Reserved amount</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(detail.reservedAmount)}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Remaining amount</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(detail.remainingAmount)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Submission</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Lines / receipts</TableHead>
              <TableHead>Disbursement</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-xs text-muted-foreground">
                  No payable submissions recorded for this dispatch plan. Use the form below to record the first payable.
                </TableCell>
              </TableRow>
            ) : submissions.map((submission) => {
              const receiptCount = submission.lines.reduce((sum, line) => sum + line.receipts.length, 0);
              const status = (submission.status || "").toLowerCase();
              return (
                <TableRow key={submission.id}>
                  <TableCell className="font-semibold">#{submission.id}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={submissionBadgeClassName(submission.status)}>
                      {displayWerStatus(submission.status)}
                    </Badge>
                    {submission.decisionRemarks && (
                      <p className="mt-1 max-w-48 truncate text-[11px] text-muted-foreground" title={submission.decisionRemarks}>
                        {submission.decisionRemarks}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(submission.totalAmount)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {submission.lines.length} line(s) · {receiptCount} receipt(s)
                  </TableCell>
                  <TableCell className="text-xs">
                    {submission.disbursementId ? `#${submission.disbursementId}` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {status === "submitted" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={withdrawingId === submission.id}
                        onClick={() => void handleWithdraw(submission)}
                      >
                        {withdrawingId === submission.id ? "Withdrawing…" : "Withdraw"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {!isForClearance ? (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Read-only</AlertTitle>
          <AlertDescription>
            New payables can only be recorded while the plan is in For Clearance state. Posted plans are read-only.
          </AlertDescription>
        </Alert>
      ) : detail.isLiquidated ? (
        <Alert className="border-emerald-500/40 bg-emerald-500/5">
          <CheckCircle2 className="size-4 text-emerald-600" />
          <AlertTitle>Liquidated</AlertTitle>
          <AlertDescription>All payables for this dispatch plan have been released. No new submissions are accepted.</AlertDescription>
        </Alert>
      ) : !eligibility?.eligible ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Entry disabled</AlertTitle>
          <AlertDescription>Resolve driver supplier eligibility before recording payables.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">New payable</h4>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setLineKey((next) => next + 1);
                setLines((current) => [...current, emptyLine(lineKey)]);
              }}
            >
              <Plus className="size-3.5" /> Add line
            </Button>
          </div>
          {coasError && (
            <p className="text-xs text-muted-foreground">Chart of accounts unavailable: {coasError}. A COA is still required per line before submitting.</p>
          )}

          {lines.map((line, index) => (
            <div key={line.key} className="space-y-2 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground">Line {index + 1}</p>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setLines((current) => {
                        const position = current.findIndex((item) => item.key === line.key);
                        // Receipts are intentionally not copied: each attachment
                        // belongs to exactly one payable line.
                        const copy: EditableLine = {
                          key: Math.max(0, ...current.map((item) => item.key)) + 1,
                          amount: line.amount,
                          referenceNo: line.referenceNo,
                          remarks: line.remarks,
                          date: line.date,
                          coaId: line.coaId,
                          receipts: [],
                        };
                        const nextLines = [...current];
                        nextLines.splice(position + 1, 0, copy);
                        return nextLines;
                      });
                    }}
                  >
                    <Copy className="size-3.5" /> Duplicate
                  </Button>
                  {lines.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                    >
                      <Trash2 className="size-3.5" /> Remove
                    </Button>
                  )}
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.amount}
                    onChange={(event) => updateLine(line.key, { amount: event.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Reference no.</Label>
                  <Input
                    value={line.referenceNo}
                    onChange={(event) => updateLine(line.key, { referenceNo: event.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={line.date}
                    onChange={(event) => updateLine(line.key, { date: event.target.value })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                  <Label>Account (COA) *</Label>
                  <WerCoaCombobox
                    value={line.coaId}
                    options={coas}
                    onValueChange={(value) => updateLine(line.key, { coaId: value })}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Remarks</Label>
                  <Textarea
                    value={line.remarks}
                    onChange={(event) => updateLine(line.key, { remarks: event.target.value })}
                    placeholder="Optional"
                    className="min-h-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Receipts</Label>
                {line.receipts.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {line.receipts.map((receipt) => {
                      const href = receiptViewHref(receipt.fileId);
                      return (
                        <span key={receipt.fileId} className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs">
                          <Paperclip className="size-3 text-muted-foreground" />
                          {href ? (
                            <a href={href} target="_blank" rel="noreferrer" className="max-w-40 truncate underline">
                              {receipt.fileName || receipt.fileId}
                            </a>
                          ) : (
                            <span className="max-w-40 truncate">{receipt.fileName || receipt.fileId}</span>
                          )}
                          <button
                            type="button"
                            aria-label="Remove receipt"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => void handleDetach(line.key, receipt.fileId)}
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
                <Input
                  type="file"
                  disabled={uploadingKey === line.key}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void handleAttach(line.key, file);
                  }}
                />
                {uploadingKey === line.key && (
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="size-3 animate-spin" /> Uploading receipt…
                  </p>
                )}
              </div>
            </div>
          ))}

          {formError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Unable to record payable</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span>
              Lines total: <strong className="text-foreground">{formatMoney(linesTotal)}</strong>
            </span>
            <span>
              Remaining on plan: <strong className="text-foreground">{formatMoney(detail.remainingAmount ?? detail.plan.amount)}</strong>
            </span>
          </div>
          {notice && (
            <Alert className="border-emerald-500/40 bg-emerald-500/5">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <AlertTitle>Saved</AlertTitle>
              <AlertDescription className="flex flex-wrap items-center gap-3">
                <span>{notice}</span>
                {submittedId !== null && (
                  <a
                    className="font-semibold text-emerald-700 underline dark:text-emerald-300"
                    href={`/fm/reports/logistics-wer-approval?search=${encodeURIComponent(String(submittedId))}`}
                  >
                    View in approval queue
                  </a>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => void handleAction("save-draft")}>
              {busy ? "Saving…" : "Save Draft"}
            </Button>
            <Button type="button" disabled={busy} onClick={() => void handleAction("submit")}>
              {busy ? "Submitting…" : "Submit for Approval"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
