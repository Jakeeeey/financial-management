"use client";

import { Fragment, useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, Copy, Loader2, Paperclip, Plus, Trash2, X } from "lucide-react";
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
  LogisticsWerPayableSubmissionLineDetails,
  LogisticsWerPayableSubmissionSummary,
} from "../types";
import { findBudgetRequestOverages } from "../utils/budget-balances";
import { canRunPayableAction, isPayableFormDirty, validatePayableLines } from "../utils/payable-validation";
import {
  deletePayableReceipt,
  fetchPayableSubmissionDetails,
  fetchPayableCoas,
  savePayableDraft,
  submitPayable,
  updateReturnedPayable,
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
  id: number | null;
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
  return { key, id: null, amount: "", referenceNo: "", remarks: "", date: todayDateOnly(), coaId: "", receipts: [] };
}

function editableLinesFromDetails(lines: LogisticsWerPayableSubmissionLineDetails[]): EditableLine[] {
  return lines.map((line) => ({
    key: line.id,
    id: line.id,
    amount: String(line.amount),
    referenceNo: line.referenceNo || "",
    remarks: line.remarks || "",
    date: line.date || "",
    coaId: line.coaId ? String(line.coaId) : "",
    receipts: line.receipts.flatMap((receipt) => receipt.fileId ? [{ fileId: receipt.fileId, fileName: null }] : []),
  }));
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
  const [coasLoaded, setCoasLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<number | null>(null);
  const [editingSubmissionId, setEditingSubmissionId] = useState<number | null>(null);
  const [loadingEditId, setLoadingEditId] = useState<number | null>(null);
  const [expandedSubmissionIds, setExpandedSubmissionIds] = useState<Set<number>>(() => new Set());
  const [submissionDetails, setSubmissionDetails] = useState<Record<number, LogisticsWerPayableSubmissionLineDetails[]>>({});
  const [submissionDetailsLoading, setSubmissionDetailsLoading] = useState<Record<number, boolean>>({});
  const [submissionDetailsErrors, setSubmissionDetailsErrors] = useState<Record<number, string>>({});

  const eligibility = detail.supplierEligibility ?? null;
  const submissions = detail.submissions ?? [];
  const isForClearance = (planStatus || "").toLowerCase() === "for clearance";

  useEffect(() => {
    if ((!isForClearance && submissions.length === 0) || coasLoaded) return;
    let active = true;
    fetchPayableCoas()
      .then((options) => {
        if (active) {
          setCoas(options);
          setCoasLoaded(true);
        }
      })
      .catch((loadError) => {
        if (active) {
          setCoasError(loadError instanceof Error ? loadError.message : "Unable to load chart of accounts.");
          setCoasLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, [coasLoaded, isForClearance, submissions.length]);

  const loadSubmissionDetails = async (submissionId: number) => {
    if (
      Object.prototype.hasOwnProperty.call(submissionDetails, submissionId)
      || submissionDetailsLoading[submissionId]
    ) return;
    setSubmissionDetailsLoading((current) => ({ ...current, [submissionId]: true }));
    setSubmissionDetailsErrors((current) => {
      const next = { ...current };
      delete next[submissionId];
      return next;
    });
    try {
      const details = await fetchPayableSubmissionDetails(planId, submissionId);
      setSubmissionDetails((current) => ({ ...current, [submissionId]: details.lines }));
    } catch (loadError) {
      setSubmissionDetailsErrors((current) => ({
        ...current,
        [submissionId]: loadError instanceof Error ? loadError.message : "Unable to load submission details.",
      }));
    } finally {
      setSubmissionDetailsLoading((current) => ({ ...current, [submissionId]: false }));
    }
  };

  const toggleSubmissionDetails = (submissionId: number) => {
    const opening = !expandedSubmissionIds.has(submissionId);
    setExpandedSubmissionIds((current) => {
      const next = new Set(current);
      if (next.has(submissionId)) next.delete(submissionId);
      else next.add(submissionId);
      return next;
    });
    if (opening) void loadSubmissionDetails(submissionId);
  };

  const handleEditReturned = async (submissionId: number) => {
    if (isPayableFormDirty(lines, initialLines) && !window.confirm("Discard the unsaved new payable and edit the returned submission?")) {
      return;
    }
    setFormError(null);
    setNotice(null);
    setLoadingEditId(submissionId);
    try {
      const details = await fetchPayableSubmissionDetails(planId, submissionId);
      if (!details.canEdit) {
        throw new Error("Only the original submitter can edit this returned payable.");
      }
      if (details.lines.length === 0) throw new Error("This returned submission has no payable lines to edit.");
      const editableLines = editableLinesFromDetails(details.lines);
      setInitialLines(editableLines);
      setLines(editableLines);
      setEditingSubmissionId(submissionId);
    } catch (editError) {
      setFormError(editError instanceof Error ? editError.message : "Unable to load the returned payable.");
    } finally {
      setLoadingEditId(null);
    }
  };

  const cancelReturnedEdit = async () => {
    const initialFileIds = new Set(initialLines.flatMap((line) => line.receipts.map((receipt) => receipt.fileId)));
    const newlyStagedFileIds = Array.from(new Set(
      lines.flatMap((line) => line.receipts.map((receipt) => receipt.fileId).filter((fileId) => !initialFileIds.has(fileId))),
    ));
    try {
      await Promise.all(newlyStagedFileIds.map((fileId) => deletePayableReceipt(planId, fileId)));
    } catch (cancelError) {
      setFormError(cancelError instanceof Error ? cancelError.message : "Unable to discard newly uploaded receipts.");
      return;
    }
    const pristineLines = [emptyLine(1)];
    setInitialLines(pristineLines);
    setLines(pristineLines);
    setEditingSubmissionId(null);
    setFormError(null);
    setNotice(null);
  };

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
    || projectedOverages.length > 0
    || !eligibility?.eligible;

  const buildPayload = (): PayableLineInput[] => lines.map((line) => ({
    ...(line.id === null ? {} : { id: line.id }),
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
    dirty: isDirty || editingSubmissionId !== null,
    valid: submitValidation.valid,
    busy,
    uploading: uploadingKey !== null,
    submissionBlocked,
  });

  const handleAction = async (kind: "save-draft" | "submit") => {
    const dirty = isPayableFormDirty(lines, initialLines);
    const actionDirty = dirty || (kind === "submit" && editingSubmissionId !== null);
    const validation = validatePayableLines(buildPayload(), kind === "submit");
    if (!validation.valid) {
      if (actionDirty && !busy && uploadingKey === null) {
        setNotice(null);
        setFormError(validation.error);
      }
      return;
    }
    if (!canRunPayableAction(kind, {
      dirty: actionDirty,
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
      const submission = editingSubmissionId !== null
        ? await updateReturnedPayable(planId, editingSubmissionId, kind, validation.lines)
        : kind === "submit"
          ? await submitPayable(planId, validation.lines, idempotencyKey)
          : await savePayableDraft(planId, validation.lines, idempotencyKey);
      if (editingSubmissionId !== null && kind === "save-draft") {
        const updatedLines = editableLinesFromDetails(submission.lines);
        setInitialLines(updatedLines);
        setLines(updatedLines);
        setSubmissionDetails((current) => ({
          ...current,
          [submission.id]: submission.lines,
        }));
        setNotice(`Changes saved to returned submission #${submission.id}.`);
        await onChanged();
        return;
      }
      if (editingSubmissionId !== null) {
        setSubmissionDetails((current) => ({ ...current, [submission.id]: submission.lines }));
      }
      setNotice(editingSubmissionId !== null
        ? `Submission #${submission.id} resubmitted for QA approval.`
        : kind === "submit"
          ? `Submission #${submission.id} recorded for QA approval.`
          : `Draft #${submission.id} saved.`);
      const pristineLines = [emptyLine(1)];
      setInitialLines(pristineLines);
      setLines(pristineLines);
      setEditingSubmissionId(null);
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
    const persistedFileIds = new Set(initialLines.flatMap((line) => line.receipts.map((receipt) => receipt.fileId)));
    if (editingSubmissionId !== null && persistedFileIds.has(fileId)) {
      setLines((current) => current.map((line) => (
        line.key === key ? { ...line, receipts: line.receipts.filter((receipt) => receipt.fileId !== fileId) } : line
      )));
      return;
    }
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
          <p className="mt-1 text-lg font-semibold">{formatMoney(detail.dispatchPlanValue ?? detail.plan.amount)}</p>
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
              <TableHead className="w-10"><span className="sr-only">Details</span></TableHead>
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
                <TableCell colSpan={8} className="py-6 text-center text-xs text-muted-foreground">
                  No payable submissions recorded for this dispatch plan. Use the form below to record the first payable.
                </TableCell>
              </TableRow>
            ) : submissions.map((submission) => {
              const status = (submission.status || "").toLowerCase();
              const expanded = expandedSubmissionIds.has(submission.id);
              const detailsId = `wer-submission-${submission.id}-details`;
              const submissionLines = submissionDetails[submission.id];
              const treasuryStatus = submission.disbursementId
                ? submission.treasuryStatus || "Unavailable"
                : "Not created";
              return (
                <Fragment key={submission.id}>
                <TableRow>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`${expanded ? "Collapse" : "Expand"} details for submission #${submission.id}`}
                      aria-expanded={expanded}
                      aria-controls={expanded ? detailsId : undefined}
                      onClick={() => toggleSubmissionDetails(submission.id)}
                    >
                      {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                    </Button>
                  </TableCell>
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
                    {submission.disbursementDocNo || "—"}
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
                    {status === "returned" && isForClearance && !detail.isLiquidated && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={editingSubmissionId !== null || loadingEditId !== null || busy || uploadingKey !== null}
                        onClick={() => void handleEditReturned(submission.id)}
                      >
                        {loadingEditId === submission.id ? "Loading…" : "Edit"}
                      </Button>
                    )}
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
                {expanded && (
                  <TableRow>
                    <TableCell colSpan={8} className="bg-muted/20 p-3">
                      <div id={detailsId} role="region" aria-label={`Line items for submission #${submission.id}`}>
                        {submissionDetailsLoading[submission.id] ? (
                          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                            <Loader2 className="size-4 animate-spin" /> Loading line items...
                          </div>
                        ) : submissionDetailsErrors[submission.id] ? (
                          <Alert variant="destructive">
                            <AlertCircle className="size-4" />
                            <AlertTitle>Unable to load submission details</AlertTitle>
                            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
                              <span>{submissionDetailsErrors[submission.id]}</span>
                              <Button type="button" variant="outline" size="sm" onClick={() => void loadSubmissionDetails(submission.id)}>
                                Retry
                              </Button>
                            </AlertDescription>
                          </Alert>
                        ) : submissionLines?.length === 0 ? (
                          <p className="py-4 text-sm text-muted-foreground">This submission has no line items.</p>
                        ) : submissionLines ? (
                          <div className="overflow-x-auto rounded-md border bg-background">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-16">Line</TableHead>
                                  <TableHead className="w-32 text-right">Amount</TableHead>
                                  <TableHead>COA account</TableHead>
                                  <TableHead>Remarks</TableHead>
                                  <TableHead>Receipts</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {submissionLines.map((line, index) => {
                                  const coaLabel = line.coaId
                                    ? coas.find((option) => option.coaId === line.coaId)?.label || `COA #${line.coaId}`
                                    : "Not assigned";
                                  return (
                                    <TableRow key={line.id}>
                                      <TableCell>{line.lineNo ?? index + 1}</TableCell>
                                      <TableCell className="text-right font-medium">{formatMoney(line.amount)}</TableCell>
                                      <TableCell>{coaLabel}</TableCell>
                                      <TableCell className="max-w-sm whitespace-pre-wrap break-words">{line.remarks || "—"}</TableCell>
                                      <TableCell>
                                        {line.receipts.length === 0 ? (
                                          <span className="text-muted-foreground">—</span>
                                        ) : (
                                          <div className="flex flex-wrap gap-2">
                                            {line.receipts.map((receipt) => {
                                              const href = receiptViewHref(receipt.fileId);
                                              return href ? (
                                                <a
                                                  key={receipt.id}
                                                  href={href}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="inline-flex items-center gap-1 text-xs text-primary underline"
                                                >
                                                  <Paperclip className="size-3.5" /> Receipt #{receipt.id}
                                                </a>
                                              ) : (
                                                <span key={receipt.id} className="text-xs text-muted-foreground">
                                                  Receipt #{receipt.id} unavailable
                                                </span>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {formError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Payable action failed</AlertTitle>
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

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
      ) : !eligibility?.eligible && editingSubmissionId === null ? (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertTitle>Entry disabled</AlertTitle>
          <AlertDescription>Resolve driver supplier eligibility before recording payables.</AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold">
                {editingSubmissionId !== null ? `Edit Returned Submission #${editingSubmissionId}` : "New Payable Line Entries"}
              </h4>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {editingSubmissionId !== null
                  ? "Correct the returned line items, save your changes, or resubmit the same submission for approval."
                  : "Configure financial account allocation, date references, amounts, and attachment proofs."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {editingSubmissionId !== null && (
                <Button type="button" variant="outline" size="sm" disabled={busy || uploadingKey !== null} onClick={() => void cancelReturnedEdit()}>
                  Cancel
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" onClick={addLine}>
                <Plus className="size-3.5" /> Add Line
              </Button>
            </div>
          </div>
          {editingSubmissionId !== null && submissions.find((submission) => submission.id === editingSubmissionId)?.decisionRemarks && (
            <Alert>
              <AlertCircle className="size-4" />
              <AlertTitle>Reviewer feedback</AlertTitle>
              <AlertDescription>
                {submissions.find((submission) => submission.id === editingSubmissionId)?.decisionRemarks}
              </AlertDescription>
            </Alert>
          )}
          {editingSubmissionId !== null && !eligibility?.eligible && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertTitle>Resubmission blocked</AlertTitle>
              <AlertDescription>{eligibility?.reason || "Supplier eligibility is unavailable."} You can save your corrections, but the payable cannot be resubmitted yet.</AlertDescription>
            </Alert>
          )}
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
                          id: null,
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
              {busy ? "Saving…" : editingSubmissionId !== null ? "Save Changes" : "Save Draft"}
            </Button>
            <Button
              type="button"
              disabled={!submitActionEnabled}
              onClick={() => void handleAction("submit")}
            >
              {busy ? "Submitting…" : editingSubmissionId !== null ? "Resubmit for Approval" : "Submit for Approval"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
