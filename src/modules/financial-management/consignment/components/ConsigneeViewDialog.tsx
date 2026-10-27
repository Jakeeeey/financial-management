"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getConsignee } from "../providers/consignees.api";
import type { ConsigneeDetail, ConsigneeSummary } from "../types";

export function manilaTime(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}+08:00`);
  return Number.isNaN(date.getTime()) ? value : `${new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Manila",
  }).format(date)} PHT`;
}

function Fields({ values }: { values: [string, string | number | null][] }) {
  return <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{values.map(([label, value]) => <div key={label} className="min-w-0">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="mt-1 break-words text-sm">{value === null || value === "" ? "Not provided" : value}</dd>
  </div>)}</dl>;
}

export function ConsigneeViewDialog({ selected, inspection, onClose, returnFocus }: {
  selected: ConsigneeSummary | null; inspection: number; onClose: () => void; returnFocus: () => void;
}) {
  const [result, setResult] = useState<{ key: string; detail: ConsigneeDetail | null; error: string | null } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = selected ? `${selected.id}:${inspection}:${attempt}` : "";
  const loading = selected !== null && result?.key !== key;
  const detail = result?.key === key ? result.detail : null;
  const error = result?.key === key ? result.error : null;
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    let active = true;
    getConsignee(selected.id, controller.signal).then(data => { if (active) setResult({ key, detail: data, error: null }); })
      .catch(cause => { if (active) setResult({ key, detail: null, error: cause instanceof Error ? cause.message : "Unable to load consignee." }); });
    return () => { active = false; controller.abort(); };
  }, [selected, key]);
  const defaults = detail?.defaults;
  return <Dialog open={selected !== null} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl" onCloseAutoFocus={event => { event.preventDefault(); returnFocus(); }}>
      <DialogHeader className="shrink-0 pr-6">
        <DialogTitle>{selected?.name ?? "Consignee"}</DialogTitle>
        <DialogDescription>{selected?.code} · Read-only consignee details</DialogDescription>
      </DialogHeader>
      <div className="min-h-0 space-y-6 overflow-y-auto pr-2" aria-busy={loading}>
        {loading && <p role="status" className="py-8 text-sm text-muted-foreground">Loading consignee details…</p>}
        {error && <div role="alert" className="space-y-3 rounded-md border p-4"><p>{error}</p><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry details</Button></div>}
        {detail && detail.summary.id === selected?.id && <>
          <section className="space-y-3"><h3 className="font-semibold">Identity</h3><Fields values={[
            ["Consignee code", detail.summary.code], ["Status", detail.summary.status], ["Legal name", detail.legalName],
            ["Trade name", detail.tradeName], ["TIN", detail.tin], ["VAT treatment", detail.summary.vatTreatment],
          ]} /></section>
          <section className="space-y-3 border-t pt-4"><h3 className="font-semibold">Contact and address</h3><Fields values={[
            ["Contact person", detail.summary.contactPerson], ["Email", detail.summary.email], ["Phone", detail.summary.phone],
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
            ["Reviewed by", detail.reviewedBy], ["Updated", manilaTime(detail.updatedAt)], ["Rejection reason", detail.rejectionReason],
          ]} /></section>
        </>}
      </div>
      <DialogFooter className="shrink-0 border-t pt-4"><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
