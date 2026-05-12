// src/modules/financial-management/treasury/bulk-approval/components/FinalTopSheetModal.tsx
"use client";

import * as React from "react";
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  Loader2,
  Send,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import * as api from "../providers/fetchProvider";
import type {
  FinalDecisionTarget,
  FinalHeaderDecisionPayload,
  FinalHeaderDecisionStatus,
  FinalHeaderGroup,
  FinalTopSheetDetail,
  FinalTopSheetResponse,
} from "../type";
import { formatCurrency, formatDate } from "../utils/format";
import AuditeeDetailSplitModal from "./AuditeeDetailSplitModal";
import FinalTopSheetMatrix from "./FinalTopSheetMatrix";

type Props = {
  open: boolean;
  group: FinalHeaderGroup | null;
  onOpenChange: (open: boolean) => void;
  onSubmitted: () => void | Promise<void>;
};

type ApprovalMeta = {
  draft_statuses?: string[];
  can_act?: boolean;
  is_waiting?: boolean;
  current_tier?: number;
  required_approver_level?: number;
};

function getApprovalMeta(source: (ApprovalMeta & Record<string, unknown>) | null | undefined): ApprovalMeta {
  return {
    draft_statuses: source?.draft_statuses,
    can_act: source?.can_act,
    is_waiting: source?.is_waiting,
    current_tier: source?.current_tier,
    required_approver_level: source?.required_approver_level,
  };
}

function formatDraftStatusList(statuses?: string[]) {
  const clean = [...new Set((statuses ?? []).filter(Boolean))];
  return clean.length > 0 ? clean.join(", ") : "No draft status";
}

function getApprovalInfo(meta: ApprovalMeta) {
  const currentLevel = meta.current_tier ? `Level ${meta.current_tier}` : "not yet routed";
  const requiredLevel = meta.required_approver_level ? `Level ${meta.required_approver_level}` : "final approver level";
  const currentStatuses = formatDraftStatusList(meta.draft_statuses);

  if (meta.can_act) {
    return {
      title: "Ready for final approver action",
      description: `Current status: ${currentStatuses}. This top sheet is already on ${requiredLevel}.`,
      shortLabel: "Ready",
      tone: "ready" as const,
      currentLevel,
      requiredLevel,
      currentStatuses,
    };
  }

  return {
    title: "View-only until previous approval tier is completed",
    description: `Current status: ${currentStatuses}. Current approval tier is ${currentLevel}; final approver actions are enabled only at ${requiredLevel}.`,
    shortLabel: "Waiting",
    tone: "waiting" as const,
    currentLevel,
    requiredLevel,
    currentStatuses,
  };
}


type LineRemarksMap = Record<number, string>;

type PendingRemarksDecision = {
  status: Extract<FinalHeaderDecisionStatus, "Rejected" | "With Concern">;
  target: FinalDecisionTarget;
  affectedDetails: FinalTopSheetDetail[];
} | null;


function getTargetLabel(data: FinalTopSheetResponse | null, target: FinalDecisionTarget) {
  if (!data) return "Whole Top Sheet";

  if (target.scope === "all") return "Whole Top Sheet / All Encoders";

  if (target.scope === "encoder") {
    const salesman = data.salesmen.find((item) => item.employee_id === target.employee_id);
    return `Encoder: ${salesman?.salesman_name ?? `Employee #${target.employee_id}`}`;
  }

  if (target.scope === "coa") {
    const coa = data.coa_rows.find((item) => item.coa_id === target.coa_id);
    return `COA: ${coa?.account_title ?? `COA #${target.coa_id}`} / All Encoders`;
  }

  if (target.scope === "cell") {
    const salesman = data.salesmen.find((item) => item.employee_id === target.employee_id);
    const coa = data.coa_rows.find((item) => item.coa_id === target.coa_id);
    return `${salesman?.salesman_name ?? `Employee #${target.employee_id}`} • ${
      coa?.account_title ?? `COA #${target.coa_id}`
    }`;
  }

  return `${target.expense_ids.length} selected expense line${target.expense_ids.length === 1 ? "" : "s"}`;
}

function getDetailsForTarget(
  details: FinalTopSheetDetail[],
  target: FinalDecisionTarget
) {
  if (target.scope === "all") return details;

  if (target.scope === "encoder") {
    return details.filter((detail) => detail.employee_id === target.employee_id);
  }

  if (target.scope === "coa") {
    return details.filter((detail) => detail.coa_id === target.coa_id);
  }

  if (target.scope === "cell") {
    return details.filter(
      (detail) =>
        detail.employee_id === target.employee_id && detail.coa_id === target.coa_id
    );
  }

  const expenseIdSet = new Set(target.expense_ids);
  return details.filter((detail) => expenseIdSet.has(detail.expense_id));
}

function requiresLineRemarks(status: FinalHeaderDecisionStatus) {
  return status === "Rejected" || status === "With Concern";
}

function getLineRemark(lineRemarks: LineRemarksMap, expenseId: number) {
  return lineRemarks[expenseId]?.trim() ?? "";
}

function buildDecisionPayload(params: {
  group: FinalHeaderGroup;
  status: FinalHeaderDecisionStatus;
  remarks: string;
  target: FinalDecisionTarget;
}): FinalHeaderDecisionPayload {
  const base = {
    resource: "final-header-decision" as const,
    division_id: params.group.division_id,
    period_from: params.group.period_from,
    period_to: params.group.period_to,
    status: params.status,
    remarks: params.remarks,
    target_scope: params.target.scope,
  };

  if (params.target.scope === "encoder") {
    return { ...base, employee_id: params.target.employee_id };
  }

  if (params.target.scope === "coa") {
    return { ...base, coa_id: params.target.coa_id };
  }

  if (params.target.scope === "cell") {
    return {
      ...base,
      employee_id: params.target.employee_id,
      coa_id: params.target.coa_id,
    };
  }

  if (params.target.scope === "expense_ids") {
    return {
      ...base,
      expense_ids: params.target.expense_ids,
      concern_expense_ids:
        params.status === "With Concern" ? params.target.expense_ids : undefined,
    };
  }

  return base;
}




function RemarksRequiredDialog({
  open,
  decision,
  lineRemarks,
  submitting,
  onOpenChange,
  onLineRemarkChange,
  onSubmit,
}: {
  open: boolean;
  decision: PendingRemarksDecision;
  lineRemarks: LineRemarksMap;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onLineRemarkChange: (expenseId: number, value: string) => void;
  onSubmit: () => void | Promise<void>;
}) {
  const affectedDetails = decision?.affectedDetails ?? [];
  const statusLabel = decision?.status ?? "With Concern";
  const missingCount = affectedDetails.filter(
    (detail) => !getLineRemark(lineRemarks, detail.expense_id)
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden rounded-3xl border-slate-200 p-0 shadow-2xl">
        <div className="shrink-0 border-b bg-slate-950 px-6 py-4 text-white">
          <DialogTitle className="flex items-center gap-2 text-base font-black tracking-tight">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            Item Remarks Required
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs font-medium text-white/60">
            {statusLabel} decisions require remarks for every affected expense line before submission.
          </DialogDescription>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-50/70 px-5 py-4">
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
            {missingCount > 0
              ? `${missingCount} line${missingCount === 1 ? "" : "s"} still need remarks.`
              : "All affected lines have remarks and are ready to submit."}
          </div>

          <div className="space-y-3">
            {affectedDetails.map((detail) => {
              const salesman = detail.salesman_name || `Employee #${detail.employee_id}`;
              const account = detail.account_title || `COA #${detail.coa_id}`;
              const isMissing = !getLineRemark(lineRemarks, detail.expense_id);

              return (
                <div
                  key={detail.expense_id}
                  className={`rounded-2xl border bg-white p-4 shadow-sm ${
                    isMissing ? "border-amber-200" : "border-emerald-100"
                  }`}
                >
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-800">
                        {salesman}
                      </p>
                      <p className="truncate text-xs font-semibold text-slate-500">
                        {account}
                      </p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        Expense #{detail.expense_id} • {formatDate(detail.transaction_date)}
                      </p>
                    </div>
                    <Badge className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700 hover:bg-emerald-50">
                      {formatCurrency(detail.amount)}
                    </Badge>
                  </div>

                  <Textarea
                    value={lineRemarks[detail.expense_id] ?? ""}
                    onChange={(event) =>
                      onLineRemarkChange(detail.expense_id, event.target.value)
                    }
                    placeholder={`Enter remarks for ${statusLabel.toLowerCase()} decision...`}
                    rows={2}
                    className={`resize-none rounded-xl bg-white text-xs font-medium shadow-inner ${
                      isMissing ? "border-amber-300" : "border-slate-200"
                    }`}
                    disabled={submitting}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="shrink-0 border-t bg-white px-5 py-4">
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl border-slate-200 px-4 text-xs font-bold"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-slate-900 px-5 text-xs font-black uppercase tracking-widest text-white hover:bg-primary"
              onClick={() => void onSubmit()}
              disabled={submitting || missingCount > 0 || affectedDetails.length === 0}
            >
              {submitting ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-3.5 w-3.5" />
              )}
              Submit Remarks
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function FinalTopSheetModal({
  open,
  group,
  onOpenChange,
  onSubmitted,
}: Props) {
  const [data, setData] = React.useState<FinalTopSheetResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [remarks, setRemarks] = React.useState("");
  const [lineRemarks, setLineRemarks] = React.useState<LineRemarksMap>({});
  const [pendingRemarksDecision, setPendingRemarksDecision] = React.useState<PendingRemarksDecision>(null);
  const [remarksDialogOpen, setRemarksDialogOpen] = React.useState(false);
  const [stagedDecisions, setStagedDecisions] = React.useState<Record<string, { target: FinalDecisionTarget; status: FinalHeaderDecisionStatus }>>({});
  const [globalDecision, setGlobalDecision] = React.useState<FinalHeaderDecisionStatus>("Approved");
  const [finalConfirmOpen, setFinalConfirmOpen] = React.useState(false);
  const [selectedAuditeeId, setSelectedAuditeeId] = React.useState<number | null>(null);
  const [auditeeDetailOpen, setAuditeeDetailOpen] = React.useState(false);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const activeApprovalMeta = React.useMemo(() => {
    return getApprovalMeta((data?.group ?? group) as (ApprovalMeta & Record<string, unknown>) | null | undefined);
  }, [data?.group, group]);

  const approvalInfo = React.useMemo(() => getApprovalInfo(activeApprovalMeta), [activeApprovalMeta]);
  const canSubmitFinalAction = data?.group.can_act ?? false;
  const isApprovedHistory = data?.group.draft_statuses.includes("Approved") && !canSubmitFinalAction;
  const actionDisabledReason = canSubmitFinalAction ? undefined : approvalInfo.description;

  React.useEffect(() => {
    if (!open || !group) return;

    let active = true;

    async function loadTopSheet() {
      if (!group) return;

      try {
        setLoading(true);
        setData(null);
        setSelectedAuditeeId(null);
        setAuditeeDetailOpen(false);
        setRemarks("");
        setLineRemarks({});
        setPendingRemarksDecision(null);
        setRemarksDialogOpen(false);
        setStagedDecisions({});
        setFinalConfirmOpen(false);

        const result = await api.getFinalTopSheet({
          division_id: group.division_id,
          period_from: group.period_from,
          period_to: group.period_to,
        });

        if (active) setData(result);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to load final top sheet.");
        if (active) setData(null);
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadTopSheet();

    return () => {
      active = false;
    };
  }, [group, open]);

  function handleOpenAuditeeDetails(employeeId: number) {
    setSelectedAuditeeId(employeeId);
    setAuditeeDetailOpen(true);
  }

  function getTargetKey(target: FinalDecisionTarget) {
    if (target.scope === "all") return "all";
    if (target.scope === "encoder") return `encoder:${target.employee_id}`;
    if (target.scope === "coa") return `coa:${target.coa_id}`;
    if (target.scope === "cell") return `cell:${target.employee_id}:${target.coa_id}`;
    return "unknown";
  }

  function handleToggleDecision(status: FinalHeaderDecisionStatus, target: FinalDecisionTarget) {
    const key = getTargetKey(target);
    setStagedDecisions((current) => {
      const existing = current[key];
      const next = { ...current };

      if (existing && existing.status === status) {
        delete next[key];
      } else {
        next[key] = { target, status };
      }

      return next;
    });
  }

  function handleLineRemarkChange(expenseId: number, value: string) {
    setLineRemarks((current) => ({ ...current, [expenseId]: value }));
  }

  async function refreshAfterDecision() {
    if (!group) return;

    await onSubmitted();

    const refreshed = await api.getFinalTopSheet({
      division_id: group.division_id,
      period_from: group.period_from,
      period_to: group.period_to,
    });
    setData(refreshed);
  }

  async function submitSingleDecisionRequest(params: {
    status: FinalHeaderDecisionStatus;
    target: FinalDecisionTarget;
    decisionRemarks: string;
  }) {
    if (!group) return null;

    if (!canSubmitFinalAction) {
      toast.warning("Final approver actions are disabled for now.", {
        description: approvalInfo.description,
      });
      return null;
    }

    return api.submitFinalHeaderDecision(
      buildDecisionPayload({
        group,
        status: params.status,
        remarks: params.decisionRemarks,
        target: params.target,
      })
    );
  }

  function handleInitiateFinalSubmit() {
    if (!remarks.trim()) {
      setRemarks(""); // Reset to empty to trigger focus/validation if needed
    }
    setFinalConfirmOpen(true);
  }

  async function submitItemLevelDecisionBatch(
    status: Extract<FinalHeaderDecisionStatus, "Rejected" | "With Concern">,
    affectedDetails: FinalTopSheetDetail[]
  ) {
    if (!group) return;

    if (!canSubmitFinalAction) {
      toast.warning("This top sheet is still waiting for previous approval levels.", {
        description: approvalInfo.description,
      });
      return;
    }

    const missingRemarks = affectedDetails.filter(
      (detail) => !getLineRemark(lineRemarks, detail.expense_id)
    );

    if (missingRemarks.length > 0) {
      toast.error(`Please provide remarks for ${missingRemarks.length} affected line${missingRemarks.length === 1 ? "" : "s"}.`);
      return;
    }

    try {
      setSubmitting(true);

      for (const detail of affectedDetails) {
        await submitSingleDecisionRequest({
          status,
          target: { scope: "expense_ids", expense_ids: [detail.expense_id] },
          decisionRemarks: getLineRemark(lineRemarks, detail.expense_id),
        });
      }

      toast.success(
        `${affectedDetails.length} ${status.toLowerCase()} line decision${affectedDetails.length === 1 ? "" : "s"} submitted.`
      );
      setPendingRemarksDecision(null);
      setRemarksDialogOpen(false);
      await refreshAfterDecision();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit final decision.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitTargetDecision(
    status: FinalHeaderDecisionStatus,
    target: FinalDecisionTarget
  ) {
    if (!group) return;

    if (!canSubmitFinalAction) {
      toast.warning("This top sheet is view-only for the final approver right now.", {
        description: approvalInfo.description,
      });
      return;
    }

    const affectedDetails = getDetailsForTarget(data?.details ?? [], target);

    if (affectedDetails.length === 0) {
      toast.error("The selected action has no expense lines to update.");
      return;
    }

    if (requiresLineRemarks(status)) {
      const missingRemarks = affectedDetails.filter(
        (detail) => !getLineRemark(lineRemarks, detail.expense_id)
      );

      if (missingRemarks.length > 0) {
        setPendingRemarksDecision({ status, target, affectedDetails });
        setRemarksDialogOpen(true);
        toast.warning("Remarks are required per affected expense line.");
        return;
      }

      await submitItemLevelDecisionBatch(status, affectedDetails);
      return;
    }

    try {
      setSubmitting(true);
      const result = await submitSingleDecisionRequest({
        status,
        target,
        decisionRemarks: remarks.trim(),
      });

      toast.success(
        `${result?.message || "Final decision submitted."} Target: ${getTargetLabel(data, target)}.`
      );
      await refreshAfterDecision();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to submit final decision.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitStagedAuditBatch() {
    const stagedList = Object.values(stagedDecisions);
    if (!stagedList.length) return;

    try {
      setSubmitting(true);
      let successCount = 0;

      for (const item of stagedList) {
        // Note: For now, we reuse the same logic. 
        // If it requires remarks, we might need a more complex batch UI.
        // But the user requested "one button for submit approval on the matrix".
        const affectedDetails = getDetailsForTarget(data?.details ?? [], item.target);
        
        if (requiresLineRemarks(item.status)) {
           // For simplicity, we skip batching items that require remarks if not provided.
           // In a real app, we'd validate this before starting the loop.
           const missing = affectedDetails.some(d => !getLineRemark(lineRemarks, d.expense_id));
           if (missing) {
             toast.error(`Decision for ${getTargetLabel(data, item.target)} requires line remarks.`);
             continue;
           }
        }

        await submitSingleDecisionRequest({
          status: item.status,
          target: item.target,
          decisionRemarks: remarks.trim(),
        });
        successCount++;
      }

      setStagedDecisions({});
      setFinalConfirmOpen(false);
      setRemarks("");
      await refreshAfterDecision();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Batch submission failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPendingRemarksDecision() {
    if (!pendingRemarksDecision) return;

    await submitItemLevelDecisionBatch(
      pendingRemarksDecision.status,
      pendingRemarksDecision.affectedDetails
    );
  }

  function submitWhole(status: FinalHeaderDecisionStatus) {
    void submitTargetDecision(status, { scope: "all" });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex !h-screen !w-screen !max-w-none !max-h-none flex-col overflow-hidden border-none p-0 sm:rounded-none">
          <div className="shrink-0 bg-gradient-to-r from-slate-950 via-slate-900 to-[#1e1e2e] px-5 py-3 text-white shadow-xl relative">
            <div className="flex items-center justify-between gap-4 relative z-10">
              <DialogTitle className="flex items-center gap-3 text-base font-black tracking-tight text-white">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                </div>
                <div className="flex flex-col leading-none">
                  <span>Final Top-Sheet Review</span>
                  {Object.keys(stagedDecisions).length > 0 ? (
                    <motion.span 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-[9px] font-black uppercase tracking-[0.25em] text-emerald-400 mt-0.5 flex items-center gap-1"
                    >
                      <span className="h-1 w-1 rounded-full bg-emerald-400 animate-ping" />
                      {Object.keys(stagedDecisions).length} Items Staged for Consensus
                    </motion.span>
                  ) : (
                    <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-white/40 mt-0.5">Audit Consensus Engine</span>
                  )}
                </div>
              </DialogTitle>

              <div className="flex items-center gap-2">
                {group && (
                  <div className="flex items-center gap-2 bg-white/5 p-1.5 rounded-xl border border-white/10">
                    <Badge className="rounded-lg bg-primary/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-primary border border-primary/30">
                      {group.division_name ?? `Division #${group.division_id}`}
                    </Badge>
                    <span className="text-[10px] font-bold text-white/50">
                      {formatDate(group.period_from)} – {formatDate(group.period_to)}
                    </span>
                    <Badge className={`rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                      isApprovedHistory
                        ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                        : canSubmitFinalAction 
                          ? "border border-emerald-300/40 bg-emerald-400/15 text-emerald-200" 
                          : "border border-amber-300/40 bg-amber-400/15 text-amber-200"
                    }`}>
                      {isApprovedHistory ? "FINALIZED" : approvalInfo.shortLabel}
                    </Badge>
                  </div>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all"
                  onClick={() => onOpenChange(false)}
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-4">
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-4">
                <div className="relative">
                  <div className="h-12 w-12 rounded-full border-4 border-primary/5 border-t-primary animate-spin" />
                  <Loader2 className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-primary" />
                </div>
                <p className="text-sm font-black text-slate-600 animate-pulse">Calculating Matrix Totals...</p>
              </div>
            ) : !data ? (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <AlertTriangle className="h-10 w-10 text-rose-400" />
                <p className="text-base font-black text-slate-800">No top-sheet data available.</p>
              </div>
            ) : (
              <div className="flex h-full flex-col gap-4 animate-in fade-in duration-500 overflow-hidden">
                <div className={`flex items-center justify-between gap-6 rounded-2xl border px-6 py-4 transition-all ${
                  isApprovedHistory 
                    ? "bg-emerald-50 border-emerald-100 shadow-sm shadow-emerald-100/20" 
                    : canSubmitFinalAction 
                      ? "bg-emerald-50 border-emerald-100 shadow-sm shadow-emerald-100/20" 
                      : "bg-slate-50 border-slate-200"
                }`}>
                  <div className="flex items-center gap-5">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ring-4 ${
                      isApprovedHistory
                        ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/5"
                        : canSubmitFinalAction 
                          ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/5" 
                          : "bg-slate-200 text-slate-400 ring-slate-100"
                    }`}>
                      {isApprovedHistory || canSubmitFinalAction ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
                    </div>
                    <div className="space-y-1">
                      <h3 className={`text-sm font-black tracking-tight ${
                        isApprovedHistory || canSubmitFinalAction ? "text-emerald-900" : "text-slate-900"
                      }`}>
                        {isApprovedHistory 
                          ? "Audit Finalized & Posted" 
                          : canSubmitFinalAction 
                            ? "Ready for final approver action" 
                            : "View-only until previous approval tier is completed"}
                      </h3>
                      <p className={`text-[11px] font-medium leading-none ${
                        isApprovedHistory || canSubmitFinalAction ? "text-emerald-700/70" : "text-slate-500"
                      }`}>
                        {isApprovedHistory 
                          ? "This top-sheet has been successfully audited and posted to the live Disbursement table."
                          : canSubmitFinalAction 
                            ? `Current status: ${data?.group.draft_statuses.join(", ")}. This top-sheet is already on Level ${data?.group.current_tier}.` 
                            : `Current status: ${data?.group.draft_statuses.join(", ")}. Final approver actions are enabled only at Level ${data?.group.required_approver_level}.`}
                      </p>
                    </div>
                  </div>

                  {!isApprovedHistory && (
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Status</p>
                        <p className="text-[10px] font-black text-slate-900">{data?.group.draft_statuses.join(", ")}</p>
                      </div>
                      <div className="h-8 w-px bg-slate-200" />
                      <div className="text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Current Tier</p>
                        <p className="text-[10px] font-black text-slate-900">Level {data?.group.current_tier}</p>
                      </div>
                      <div className="h-8 w-px bg-slate-200" />
                      <div className="text-center">
                        <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Required Tier</p>
                        <p className="text-[10px] font-black text-slate-900">Level {data?.group.required_approver_level}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Compact stats strip */}
                <div className="flex shrink-0 items-stretch gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 shadow-md">
                  <div className="flex items-center gap-2 pr-4 border-r border-slate-100">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      <CalendarRange size={14} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Period</p>
                      <p className="text-[11px] font-black text-slate-800">
                        {formatDate(data.group.period_from)} – {formatDate(data.group.period_to)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 border-r border-slate-100">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                      <Users size={14} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Encoders</p>
                      <p className="text-sm font-black text-slate-800">{data.salesmen.length}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-4 border-r border-slate-100">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <FileText size={14} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Lines</p>
                      <p className="text-sm font-black text-slate-800">{data.details.length}</p>
                    </div>
                  </div>
                  <div className="flex flex-1 items-center justify-end gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
                      <ShieldCheck size={14} />
                    </div>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700/60">Consolidated Total</p>
                      <p className="text-base font-black text-emerald-700">{formatCurrency(data.grand_total)}</p>
                    </div>
                    {Object.keys(stagedDecisions).length > 0 && (
                      <div className="ml-4 px-4 border-l border-emerald-100">
                        <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">Batch Action</p>
                        <Button
                          size="sm"
                          className="h-8 rounded-xl bg-slate-900 px-4 text-[10px] font-black uppercase tracking-widest text-white shadow-lg hover:bg-primary transition-all active:scale-95"
                          onClick={submitStagedAuditBatch}
                          disabled={submitting}
                        >
                          <Send className="mr-2 h-3 w-3" />
                          Commit Staged Audit
                        </Button>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="ml-4 h-8 rounded-xl border-slate-200 bg-slate-50 px-4 text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white active:scale-95"
                      onClick={() => {
                        setSelectedAuditeeId(null);
                        setAuditeeDetailOpen(true);
                      }}
                    >
                      <Eye className="mr-1.5 h-3.5 w-3.5 text-primary" />
                      Inspect All
                    </Button>
                  </div>
                </div>

                {/* Matrix – fills remaining space */}
                <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50">
                  <FinalTopSheetMatrix
                    data={data}
                    submitting={submitting}
                    canAct={canSubmitFinalAction}
                    isApprovedHistory={isApprovedHistory}
                    readOnlyReason={actionDisabledReason}
                    stagedDecisions={Object.fromEntries(
                      Object.entries(stagedDecisions).map(([k, v]) => [k, v.status])
                    )}
                    onOpenAuditeeDetails={handleOpenAuditeeDetails}
                    onToggleDecision={handleToggleDecision}
                    onSubmitStaged={submitStagedAuditBatch}
                  />
                </div>
              </div>
            )}
          </div>

          {!isApprovedHistory && (
            <div className="shrink-0 border-t bg-white px-6 py-4 shadow-[0_-10px_40px_-20px_rgba(0,0,0,0.1)]">
              <div className="flex items-center justify-between gap-6 max-w-7xl mx-auto">
                <div className="flex items-center gap-5">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Consolidated Value</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-slate-900 tabular-nums">{formatCurrency(data?.grand_total ?? 0)}</span>
                      <span className="text-[10px] font-bold text-slate-400">{data?.details.length ?? 0} Lines</span>
                    </div>
                  </div>

                  {Object.keys(stagedDecisions).length === 0 && (
                    <div className="flex items-center gap-3 pl-6 border-l border-slate-100">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Consensus:</span>
                      <div className="flex bg-slate-100 p-0.5 rounded-xl">
                        {(["Approved", "With Concern", "Rejected"] as const).map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => setGlobalDecision(status)}
                            disabled={!canSubmitFinalAction}
                            className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
                              globalDecision === status
                                ? status === "Approved" ? "bg-white text-emerald-600 shadow-sm" :
                                  status === "With Concern" ? "bg-white text-amber-600 shadow-sm" :
                                  "bg-white text-rose-600 shadow-sm"
                                : "text-slate-400 hover:text-slate-600"
                            }`}
                          >
                            {status === "With Concern" ? "Concern" : status}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <button 
                    className="text-[9px] font-black uppercase tracking-widest text-slate-300 hover:text-slate-500 transition-colors px-2" 
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel Review
                  </button>
                  <div className="h-8 w-px bg-slate-100" />
                  <Button
                    type="button"
                    size="sm"
                    className={`h-11 px-8 rounded-xl font-black uppercase tracking-[0.15em] shadow-lg transition-all active:scale-[0.98] gap-2 text-[10px] ${
                      Object.keys(stagedDecisions).length > 0 
                        ? "bg-slate-900 text-white hover:bg-primary" 
                        : globalDecision === "Approved" ? "bg-emerald-600 hover:bg-emerald-700 text-white" :
                          globalDecision === "With Concern" ? "bg-amber-500 hover:bg-amber-600 text-white" :
                          "bg-rose-600 hover:bg-rose-700 text-white"
                    }`}
                    onClick={handleInitiateFinalSubmit}
                    disabled={submitting || loading || !data || !canSubmitFinalAction}
                  >
                    {submitting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                    <span>
                      {Object.keys(stagedDecisions).length > 0 
                        ? `Submit ${Object.keys(stagedDecisions).length} Decisions` 
                        : "Submit Audit"}
                    </span>
                  </Button>
                </div>
              </div>
            </div>
          )}

          {isApprovedHistory && (
            <div className="shrink-0 border-t bg-slate-50 px-6 py-4">
              <div className="flex items-center justify-between gap-6 max-w-7xl mx-auto">
                <div className="flex items-center gap-5">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Archived Value</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-slate-500 tabular-nums">{formatCurrency(data?.grand_total ?? 0)}</span>
                      <span className="text-[10px] font-bold text-slate-400">{data?.details.length ?? 0} Lines</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <p className="text-[10px] font-bold text-slate-400 italic">This top-sheet has been finalized and is currently in read-only archive mode.</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl font-bold text-[10px] uppercase tracking-widest"
                    onClick={() => onOpenChange(false)}
                  >
                    Close Archive
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      <AuditeeDetailSplitModal
        open={auditeeDetailOpen}
        onOpenChange={setAuditeeDetailOpen}
        employeeId={selectedAuditeeId}
        data={data}
        submitting={submitting}
        lineRemarks={lineRemarks}
        onLineRemarkChange={handleLineRemarkChange}
        onSubmitTargetDecision={(status, target) =>
          void submitTargetDecision(status, target)
        }
        onPreviewUrl={setPreviewUrl}
      />

      {/* Fullscreen document preview lightbox */}
      <Dialog open={!!previewUrl} onOpenChange={(v) => { if (!v) setPreviewUrl(null); }}>
        <DialogContent showCloseButton={false} className="max-w-[95vw] w-[95vw] h-[90vh] p-0 overflow-hidden bg-[#020617] border-none shadow-2xl flex flex-col">
          <DialogTitle className="sr-only">Evidence Preview</DialogTitle>
          <DialogDescription className="sr-only">Full-screen view of the attached evidence document</DialogDescription>
          <button
            className="absolute top-6 right-6 z-50 h-12 w-12 flex items-center justify-center text-white bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 rounded-full border border-white/10 backdrop-blur-md transition-colors"
            onClick={() => setPreviewUrl(null)}
          >
            <XCircle size={24} />
          </button>
          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {previewUrl && (
                <motion.div
                  key={previewUrl}
                  className="w-full h-full flex items-center justify-center p-12"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.1 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Evidence"
                    className="max-w-[85vw] max-h-[80vh] object-contain shadow-[0_0_80px_rgba(0,0,0,0.5)] rounded-lg pointer-events-none"
                    draggable={false}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </DialogContent>
      </Dialog>

      <RemarksRequiredDialog
        open={remarksDialogOpen}
        decision={pendingRemarksDecision}
        lineRemarks={lineRemarks}
        submitting={submitting}
        onOpenChange={(nextOpen) => {
          setRemarksDialogOpen(nextOpen);
          if (!nextOpen) setPendingRemarksDecision(null);
        }}
        onLineRemarkChange={handleLineRemarkChange}
        onSubmit={submitPendingRemarksDecision}
      />

      <Dialog open={finalConfirmOpen} onOpenChange={setFinalConfirmOpen}>
        <DialogContent className="max-w-lg p-0 overflow-hidden border-none rounded-[2.5rem] shadow-2xl">
          <div className="bg-slate-950 px-8 py-6 text-white">
            <DialogTitle className="flex items-center gap-3 text-xl font-black tracking-tight">
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
              Consensus Confirmation
            </DialogTitle>
            <DialogDescription className="text-white/40 text-xs font-bold uppercase tracking-widest mt-1">
              Finalizing Audit Consensus Trail
            </DialogDescription>
          </div>

          <div className="p-8 bg-slate-50 space-y-6">
            {(canSubmitFinalAction && (Object.keys(stagedDecisions).length > 0 || globalDecision === "Approved")) && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-900 leading-none">Irreversible Posting Action</p>
                  <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                    This consensus will <strong>permanently post</strong> approved items to the live Disbursement table. Any items marked "With Concern" or "Rejected" will be excluded from this batch.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Action Scope</span>
                <Badge variant="outline" className="bg-slate-50 text-[10px] font-black px-3 py-1 rounded-lg">
                  {Object.keys(stagedDecisions).length > 0 ? "Staged Batch" : "Global Consensus"}
                </Badge>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Decision</span>
                <span className={`text-[10px] font-black uppercase tracking-widest ${
                  Object.keys(stagedDecisions).length > 0 ? "text-slate-900" :
                  globalDecision === "Approved" ? "text-emerald-600" :
                  globalDecision === "With Concern" ? "text-amber-500" : "text-rose-600"
                }`}>
                  {Object.keys(stagedDecisions).length > 0 ? `${Object.keys(stagedDecisions).length} Items` : globalDecision}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-2">
                <FileText size={14} className="text-primary" />
                Audit Remarks <span className="text-rose-500">*</span>
              </label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Provide mandatory consensus remarks for the audit trail..."
                rows={4}
                className="resize-none rounded-2xl border-slate-200 bg-white p-4 text-xs font-medium shadow-inner focus:ring-2 focus:ring-primary/10"
              />
              <p className="text-[9px] font-bold text-slate-400 italic">
                These remarks will be permanently recorded for accountability.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <Button
                size="lg"
                className={`h-14 rounded-2xl font-black uppercase tracking-[0.2em] shadow-lg gap-3 text-sm ${
                  Object.keys(stagedDecisions).length > 0 ? "bg-slate-900 text-white" :
                  globalDecision === "Approved" ? "bg-emerald-600 text-white" :
                  globalDecision === "With Concern" ? "bg-amber-500 text-white" : "bg-rose-600 text-white"
                }`}
                disabled={submitting || !remarks.trim()}
                onClick={() => {
                  if (Object.keys(stagedDecisions).length > 0) {
                    void submitStagedAuditBatch();
                  } else {
                    void submitWhole(globalDecision);
                  }
                }}
              >
                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send size={18} />}
                Confirm & Post Audit
              </Button>
              <Button
                variant="ghost"
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                onClick={() => setFinalConfirmOpen(false)}
              >
                Go Back & Review
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
