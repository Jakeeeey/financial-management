"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getAgreement } from "../providers/agreements.api";
import { agreementChoices, agreementDate, agreementNumbers } from "../utils/agreement-fields";
import { manilaTime } from "./ConsigneeViewDialog";
import type { AgreementDetail } from "../agreement-types";

export function AgreementViewDialog({ id, onClose, onEdit, returnFocus }: { id: string; onClose: () => void; onEdit: (detail: AgreementDetail) => void; returnFocus: () => void }) {
  const [result, setResult] = useState<{ detail: AgreementDetail | null; error: string | null; attempt: number } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const startingEdit = useRef(false);
  const loading = result?.attempt !== attempt;
  const detail = result?.attempt === attempt ? result.detail : null;
  const error = result?.attempt === attempt ? result.error : null;
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    getAgreement(id, controller.signal).then(detail => { if (active) setResult({ detail, error: null, attempt }); })
      .catch(error => { if (active) setResult({ detail: null, error: error instanceof Error ? error.message : "Unable to load this agreement.", attempt }); });
    return () => { active = false; controller.abort(); };
  }, [id, attempt]);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="flex max-h-[90dvh] flex-col overflow-hidden sm:max-w-3xl" onCloseAutoFocus={event => { event.preventDefault(); if (!startingEdit.current) returnFocus(); }}>
      <DialogHeader className="shrink-0 pr-6"><DialogTitle>{detail?.summary.reference || "Agreement details"}</DialogTitle><DialogDescription>Saved agreement terms and ownership. Draft agreements are unavailable for transactions.</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-5 overflow-y-auto pr-2" aria-busy={loading}>
        {loading && <p role="status">Loading agreement details…</p>}
        {error && <div role="alert" className="space-y-2 rounded border p-3"><p>{error}</p><Button variant="outline" onClick={() => setAttempt(value => value + 1)}>Retry details</Button></div>}
        {detail && <>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">{[
            ["Consignee", `${detail.consignee.name} (${detail.consignee.code})`], ["Status", detail.summary.status],
            ["Agreement starts", agreementDate(detail.summary.startDate)], ["Agreement ends", agreementDate(detail.summary.endDate)],
            ["VAT treatment", detail.vatTreatment === "NON_VAT" ? "Non-VAT" : detail.vatTreatment === "VAT" ? "VAT-registered" : "Not recorded"],
            ["Created by", detail.summary.createdBy || "Not recorded"], ["Created", manilaTime(detail.createdAt)], ["Updated", manilaTime(detail.updatedAt)],
            ...agreementNumbers.map(([key, label]) => [label, detail.terms[key] === null ? "Not recorded" : key === "exposureLimit" ? new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(detail.terms[key]!) : String(detail.terms[key])]),
            ...agreementChoices.map(([key, label, options]) => [label, options.find(([value]) => value === detail.terms[key])?.[1] || detail.terms[key] || "Not recorded"]),
          ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl>
          {!detail.editable && <p className="rounded-md bg-muted p-3 text-sm">This record is read-only. Only its creator can edit it while its status is Draft.</p>}
        </>}
      </div>
      <DialogFooter className="shrink-0 border-t pt-4">{detail?.editable && <Button onClick={() => { startingEdit.current = true; onEdit(detail); }}>Edit draft</Button>}<Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
