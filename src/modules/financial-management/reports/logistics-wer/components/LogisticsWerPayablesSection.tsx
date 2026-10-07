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
import { getStatusColor } from "@/modules/financial-management/treasury/disbursement/utils/disbursement-utils";
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
  LogisticsWerPayableSubmissionSummary,
} from "../types";
import { findBudgetRequestOverages } from "../utils/budget-balances";
import { canRunPayableAction, isPayableFormDirty, validatePayableLines } from "../utils/payable-validation";
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

function nextLineKey(current: EditableLine[]): number {
  return Math.max(0, ...current.map((item) => item.key)) + 1;
}

interface LogisticsWerPayablesSectionProps {
  planId: number;
  planStatus: string | null;
  detail: LogisticsWerDispatchPlanDetail;
  onChanged: () => Promise<void> | void;
}

export function LogisticsWerPayablesSection({ planId, planStatus, detail, onChanged }: LogisticsWerPayablesSectionProps) {
  const [initialLines, setInitialLines] = useState<EditableLine[]>(() => [emptyLine(1)]);
  const [lines, setLines] = useState<EditableLine[]>(initialLines);
  const [coas, setCoas] = useState<PayableCoaOption[]>([]);
  const [coasError, setCoasError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
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

  const addLine = () => {
    setLines((current) => [...current, emptyLine(nextLineKey(current))]);
  };

  const linesTotal = lines.reduce((sum, line) => {
    const amount = Number(line.amount);
    return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);
  const requestLines = lines.flatMap((line) => {
    const amount = Number(line.amount);
    if (!Number.isFinite(amount) || amount <= 0) return [];
    const coaId = line.coaId ? Number(line.coaId) : null;
    return [{ amount, coaId: Number.isInteger(coaId) && Number(coaId) > 0 ? Number(coaId) : null }];
  });
  const projectedOverages = detail.budgetContextAvailable
    ? findBudgetRequestOverages(requestLines, detail.budgetBalancesByCoa)
    : [];
  const submissionBlocked = !detail.budgetContextAvailable
    || (detail.unclassifiedReservedAmount ?? 0) > 0
    || projectedOverages.length > 0;

  const buildPayload = (): PayableLineInput[] => lines.map((line) => ({
    amount: Number(line.amount),
    referenceNo: line.referenceNo.trim() || null,
    remarks: line.remarks.trim() || null,
    date: line.date || null,
    coaId: line.coaId ? Number(line.coaId) : null,
    receiptFileIds: line.receipts.map((receipt) => receipt.fileId),
  }));

  const isDirty = isPayableFormDirty(lines, initialLines);
  const payload = buildPayload();
  const draftValidation = validatePayableLines(payload, false);
  const submitValidation = validatePayableLines(payload, true);
  const draftActionEnabled = canRunPayableAction("save-draft", {
    dirty: isDirty,
    valid: draftValidation.valid,
    busy,
    uploading: uploadingKey !== null,
    submissionBlocked,
  });
  const submitActionEnabled = canRunPayableAction("submit", {
    dirty: isDirty,
    valid: submitValidation.valid,
    busy,
    uploading: uploadingKey !== null,
    submissionBlocked,
  });

  const handleAction = async (kind: "save-draft" | "submit") => {
    const dirty = isPayableFormDirty(lines, initialLines);
    const validation = validatePayableLines(buildPayload(), kind === "submit");
    if (!validation.valid) {
      if (dirty && !busy && uploadingKey === null) {
        setNotice(null);
        setFormError(validation.error);
      }
      return;
    }
    if (!canRunPayableAction(kind, {
      dirty,
      valid: validation.valid,
      busy,
      uploading: uploadingKey !== null,
      submissionBlocked,
    })) return;

    setFormError(null);
    setNotice(null);
    setBusy(true);
    try {
      const idempotencyKey = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `wer-${planId}-${Date.now()}`;
      const submission = kind === "submit"
        ? await submitPayable(planId, validation.lines, idempotencyKey)
        : await savePayableDraft(planId, validation.lines, idempotencyKey);
      setNotice(
        kind === "submit"
          ? `Submission #${submission.id} recorded for QA approval.`
          : `Draft #${submission.id} saved.`,
      );
      const pristineLines = [emptyLine(1)];
      setInitialLines(pristineLines);
      setLines(pristineLines);
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

  const handleWithdraw = async (submission: LogisticsWerPayableSubmissionSummary) => {
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
          Submitted payables and actual approved disbursement lines consume the budget for their selected COA.
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Dispatch plan value</p>
          <p className="mt-1 text-lg font-semibold">{formatMoney(detail.plannedAmount ?? detail.plan.amount)}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Allocated expense budget</p>
          <p className="mt-1 text-lg font-semibold">
            {detail.budgetContextAvailable ? formatMoney(detail.allocatedExpenseBudget) : "Unavailable"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Reserved payables</p>
          <p className="mt-1 text-lg font-semibold">
            {detail.budgetContextAvailable ? formatMoney(detail.reservedAmount) : "Unavailable"}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Available expense budget</p>
          <p className="mt-1 text-lg font-semibold">
            {detail.budgetContextAvailable ? formatMoney(detail.remainingAmount) : "Unavailable"}
          </p>
        </div>
      </div>

      {detail.budgetContextAvailable && (detail.unclassifiedBudgetAmount ?? 0) > 0 && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertTitle>Budget classification required</AlertTitle>
          <AlertDescription>
            {formatMoney(detail.unclassifiedBudgetAmount)} is not available to submit until the related budget lines are classified to a COA.
          </AlertDescription>
        </Alert>
      )}
      {!detail.budgetContextAvailable && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Submission blocked</AlertTitle>
          <AlertDescription>
            {detail.budgetContextError || "The expense budget and current reservations could not be verified. You can save a draft, but submission is unavailable."}
          </AlertDescription>
        </Alert>
      )}
      {(detail.overBudgetAmount ?? 0) > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Existing expense budget overage</AlertTitle>
          <AlertDescription>
            Active or recorded payables exceed the allocated budget by {formatMoney(detail.overBudgetAmount)} across one or more COAs. New spending in those accounts is blocked.
          </AlertDescription>
        </Alert>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Submission</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Lines / receipts</TableHead>
              <TableHead>Disbursement</TableHead>
              <TableHead>Treasury Status</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {submissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-xs text-muted-foreground">
                  No payable submissions recorded for this dispatch plan. Use the form below to record the first payable.
                </TableCell>
              </TableRow>
            ) : submissions.map((submission) => {
              const status = (submission.status || "").toLowerCase();
              const treasuryStatus = submission.disbursementId
                ? submission.treasuryStatus || "Unavailable"
                : "Not created";
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
                    {submission.lineCount} line(s) · {submission.receiptCount} receipt(s)
                  </TableCell>
                  <TableCell className="text-xs">
                    {submission.disbursementId ? `#${submission.disbursementId}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-black uppercase ${getStatusColor(treasuryStatus)}`}
                    >
                      {treasuryStatus}
                    </Badge>
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold">New Payable Line Entries</h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Configure financial account allocation, date references, amounts, and attachment proofs.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="size-3.5" /> Add Line
            </Button>
          </div>
          {coasError && (
            <p className="text-xs text-muted-foreground">Chart of accounts unavailable: {coasError}. A COA is still required per line before submitting.</p>
          )}

          {lines.map((line, index) => (
            <div key={line.key} className="space-y-3 rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">Line {index + 1}</Badge>
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                    {formatMoney(Number.isFinite(Number(line.amount)) ? Number(line.amount) : 0)}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    aria-label="Duplicate line"
                    title="Duplicate line"
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
                    <Copy className="size-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    aria-label="Remove line"
                    title="Remove line"
                    disabled={lines.length <= 1}
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                <div className="space-y-1">
                  <Label>Reference No. (Optional)</Label>
                  <Input
                    value={line.referenceNo}
                    onChange={(event) => updateLine(line.key, { referenceNo: event.target.value })}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="whitespace-nowrap" title="Chart of Accounts (COA), required to submit">
                    Chart of Accounts *
                  </Label>
                  <WerCoaCombobox
                    value={line.coaId}
                    options={coas}
                    onValueChange={(value) => updateLine(line.key, { coaId: value })}
                  />
                  {line.coaId && detail.budgetContextAvailable && (
                    <p className="text-[11px] text-muted-foreground">
                      Available for this COA: {formatMoney(
                        detail.budgetBalancesByCoa.find((balance) => balance.coaId === Number(line.coaId))?.remainingAmount ?? 0,
                      )}
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={line.date}
                    onChange={(event) => updateLine(line.key, { date: event.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Amount (₱) *</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₱</span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.amount}
                      onChange={(event) => updateLine(line.key, { amount: event.target.value })}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-1 sm:col-span-2 md:col-span-2">
                  <Label>Remarks (Optional)</Label>
                  <Textarea
                    value={line.remarks}
                    onChange={(event) => updateLine(line.key, { remarks: event.target.value })}
                    placeholder="Optional"
                    className="min-h-9"
                  />
                </div>
                <div className="space-y-1 sm:col-span-2 md:col-span-2">
                  <Label>File Upload / Attachments</Label>
                  <div className="flex min-h-9 flex-wrap items-center gap-2 rounded-md border border-dashed bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/50">
                    {line.receipts.length === 0 && (
                      <span className="text-xs text-muted-foreground">No files attached</span>
                    )}
                    {line.receipts.map((receipt) => {
                      const href = receiptViewHref(receipt.fileId);
                      return (
                        <span key={receipt.fileId} className="inline-flex max-w-full items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs">
                          <Paperclip className="size-3 shrink-0 text-muted-foreground" />
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
                    <label
                      className={`ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium ${
                        uploadingKey === line.key ? "cursor-not-allowed opacity-50" : "cursor-pointer text-primary hover:underline"
                      }`}
                    >
                      <Paperclip className="size-3.5" />
                      {line.receipts.length > 0 ? "Add file" : "Choose file"}
                      <Input
                        type="file"
                        aria-label="Upload receipt"
                        className="sr-only"
                        disabled={uploadingKey === line.key}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          event.target.value = "";
                          void handleAttach(line.key, file);
                        }}
                      />
                    </label>
                  </div>
                  {uploadingKey === line.key && (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" /> Uploading receipt…
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" className="h-10 w-full border-dashed text-xs" onClick={addLine}>
            <Plus className="size-3.5" /> Add New Entry Line Item
          </Button>

          {formError && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Unable to record payable</AlertTitle>
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}
          {projectedOverages.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Submission exceeds a COA budget</AlertTitle>
              <AlertDescription>
                {projectedOverages.map((overage) => {
                  const label = coas.find((option) => option.coaId === overage.coaId)?.label || `COA ${overage.coaId}`;
                  return `${label}: requested ${formatMoney(overage.requestedAmount)}, available ${formatMoney(overage.remainingAmount)}.`;
                }).join(" ")}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <span>
              Lines total: <strong className="text-foreground">{formatMoney(linesTotal)}</strong>
            </span>
            <span>
              Available expense budget: <strong className="text-foreground">
                {detail.budgetContextAvailable ? formatMoney(detail.remainingAmount) : "Unavailable"}
              </strong>
            </span>
          </div>
          {notice && (
            <Alert className="border-emerald-500/40 bg-emerald-500/5">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <AlertTitle>Saved</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!draftActionEnabled}
              onClick={() => void handleAction("save-draft")}
            >
              {busy ? "Saving…" : "Save Draft"}
            </Button>
            <Button
              type="button"
              disabled={!submitActionEnabled}
              onClick={() => void handleAction("submit")}
            >
              {busy ? "Submitting…" : "Submit for Approval"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
