"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getConsignee } from "../providers/consignees.api";
import { ConsigneeWorkflowFeedback, ConsigneeWorkflowFooterActions } from "./ConsigneeWorkflowActions";
import { ConsignmentStatusBadge } from "./ConsignmentStatusBadge";
import { useConsigneeWorkflow } from "../hooks/useConsigneeWorkflow";
import { formatVatTreatment } from "../utils/consignment-format";
import type { ConsigneeDetail, ConsigneeSummary, ConsignmentWorkspace } from "../types";

export function manilaTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+08:00`);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
  }).format(date)} PHT`;
}

function Fields({ values }: { values: [string, ReactNode][] }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{values.map(([label, value]) => <div key={label} className="min-w-0">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="mt-1 break-words text-sm">{value === null || value === undefined || value === "" ? "Not provided" : value}</dd>
  </div>)}</dl>;
}

function CopyValue({ value, label }: { value: string | null; label: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <>Not provided</>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
    <span className="break-all">{value}</span>
    <button type="button" onClick={() => void copy()} aria-label={`Copy ${label}`} className="rounded border px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted focus-visible:outline-2">
      {copied ? "Copied" : "Copy"}
    </button>
  </span>;
}

export function ConsigneeViewDialog({ selected, inspection, onClose, returnFocus, onEdit, workspace = "consignees", onChanged }: {
  workspace?: ConsignmentWorkspace; onChanged: (detail: ConsigneeDetail) => void; onEdit: (detail: ConsigneeDetail) => void; selected: ConsigneeSummary | null; inspection: number; onClose: () => void; returnFocus: () => void;
}) {
  const [result, setResult] = useState<{ key: string; detail: ConsigneeDetail | null; error: string | null } | null>(null);
  const [reasonState, setReasonState] = useState({ id: "", value: "" });
  const [attempt, setAttempt] = useState(0);
  const key = selected ? `${selected.id}:${inspection}:${attempt}` : "";
  const loading = selected !== null && result?.key !== key;
  const detail = result?.key === key ? result.detail : null;
  const error = result?.key === key ? result.error : null;
  const reason = detail && reasonState.id === detail.summary.id ? reasonState.value : "";
  const setReason = (value: string) => { if (detail) setReasonState({ id: detail.summary.id, value }); };
  const workflow = useConsigneeWorkflow({ detail, workspace, reason, setReason, onChanged });
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    let active = true;
    getConsignee(selected.id, controller.signal, workspace).then(data => { if (active) setResult({ key, detail: data, error: null }); })
      .catch(cause => { if (active) setResult({ key, detail: null, error: cause instanceof Error ? cause.message : "Unable to load consignee." }); });
    return () => { active = false; controller.abort(); };
  }, [selected, key, workspace]);
  const defaults = detail?.defaults;
  return <Dialog open={selected !== null} onOpenChange={open => { if (!open && !workflow.busy) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl" onEscapeKeyDown={event => { if (workflow.busy) event.preventDefault(); }} onInteractOutside={event => { if (workflow.busy) event.preventDefault(); }} onCloseAutoFocus={event => { event.preventDefault(); returnFocus(); }}>
      <DialogHeader className="shrink-0 pr-6">
        <DialogTitle>{selected?.name ?? "Consignee"}</DialogTitle>
        <DialogDescription className="flex flex-wrap items-center gap-2">
          <span>{selected?.code} · Read-only consignee details</span>
          {(detail?.summary.status ?? selected?.status) && <ConsignmentStatusBadge status={detail?.summary.status ?? selected?.status} />}
        </DialogDescription>
      </DialogHeader>
      <div className="min-h-0 space-y-6 overflow-y-auto pr-2" aria-busy={loading}>
        {loading && <p role="status" className="py-8 text-sm text-muted-foreground">Loading consignee details…</p>}
        {error && <div role="alert" className="space-y-3 rounded-md border p-4"><p>{error}</p><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry details</Button></div>}
        {detail && detail.summary.id === selected?.id && <>
          <section className="space-y-3"><h3 className="font-semibold">Identity</h3><Fields values={[
            ["Consignee code", <CopyValue key="code" value={detail.summary.code} label="consignee code" />], ["Status", <ConsignmentStatusBadge key="status" status={detail.summary.status} />], ["Legal name", detail.legalName],
            ["Trade name", detail.tradeName], ["TIN", <CopyValue key="tin" value={detail.tin} label="TIN" />], ["VAT treatment", formatVatTreatment(detail.summary.vatTreatment)],
          ]} /></section>
          <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Contact and address</h3><Fields values={[
            ["Contact person", detail.summary.contactPerson], ["Email", <CopyValue key="email" value={detail.summary.email} label="email" />], ["Phone", <CopyValue key="phone" value={detail.summary.phone} label="phone" />],
            ["Address", detail.addressLine], ["City", detail.city], ["Province", detail.province], ["Postal code", detail.postalCode],
          ]} /></section>
          {defaults && <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Default terms</h3><Fields values={[
            ["Commission (%)", defaults.commissionRate], ["Payment terms (days)", defaults.paymentTermsDays],
            ["Settlement frequency", defaults.settlementFrequency], ["Sales-report frequency", defaults.salesReportFrequency],
            ["Exposure limit (PHP)", defaults.exposureLimit === null ? null : new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(defaults.exposureLimit)],
            ["Shrinkage responsibility", defaults.shrinkageResponsibility], ["EWT (%)", defaults.ewtRate],
            ["Price tolerance (%)", defaults.priceTolerance], ["Listing-fee settlement", defaults.listingFeeSettlement],
          ]} /></section>}
          <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Record history</h3><Fields values={[
            ["Created by", detail.createdBy], ["Created", manilaTime(detail.createdAt)],
            ["Submitted by", detail.submittedBy], ["Submitted", manilaTime(detail.submittedAt)], ["Reviewed", manilaTime(detail.reviewedAt)], ["Replaces consignee ID", detail.replacesConsigneeId],
            ["Reviewed by", detail.reviewedBy], ["Updated", manilaTime(detail.updatedAt)], ["Rejection reason", detail.rejectionReason],
          ]} /></section>
          <ConsigneeWorkflowFeedback detail={detail} intent={workflow.intent} failure={workflow.failure} busy={workflow.busy} reason={reason} setReason={setReason} onReload={() => setAttempt(value => value + 1)} />
        </>}
      </div>
      <DialogFooter className="shrink-0 border-t pt-4">
        {detail?.editable && workflow.intent === null && <Button variant="outline" disabled={workflow.busy} onClick={() => onEdit(detail)}>Edit draft</Button>}
        {detail && <ConsigneeWorkflowFooterActions detail={detail} intent={workflow.intent} busy={workflow.busy} mustReload={workflow.mustReload} confirmDisabled={workflow.confirmDisabled} onRequest={workflow.request} onCancel={workflow.cancel} onConfirm={workflow.confirm} />}
        <Button disabled={workflow.busy} variant="outline" onClick={onClose}>Close</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
