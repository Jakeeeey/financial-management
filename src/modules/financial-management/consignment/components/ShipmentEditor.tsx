"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ConsignmentStatusBadge } from "./ConsignmentStatusBadge";
import { ShipmentBlockerPanel } from "./ShipmentBlockerPanel";
import { ShipmentFormErrorSummary } from "./ShipmentFormErrorSummary";
import { ShipmentLookup } from "./ShipmentLookup";
import { ShipmentPreviewPanel } from "./ShipmentPreviewPanel";
import { getShipment, previewShipment, saveShipment, submitShipment, ShipmentError } from "../providers/shipments.api";
import type { ShipmentDetail, ShipmentDraft, ShipmentLine, ShipmentPreview, ShipmentChoice } from "../shipment-types";
import { focusShipmentField, formatPeso, formatQuantity } from "../utils/shipment-ui";

export function ShipmentEditor({ initial, editing, onClose, onSaved, returnFocus }: {
  initial: ShipmentDetail | null;
  editing: boolean;
  onClose: () => void;
  onSaved: () => void;
  returnFocus: () => void;
}) {
  const [agreementInfo, setAgreementInfo] = useState<ShipmentChoice | null>(initial?.agreement ?? null);
  const [saved, setSaved] = useState(initial);
  const [agreement, setAgreement] = useState(initial?.summary.agreementId ?? null);
  const [agreementName, setAgreementName] = useState(initial?.agreement ? `${initial.agreement.code} | ${initial.agreement.name}` : initial?.summary.agreementId ? `Agreement #${initial.summary.agreementId}` : "");
  const [date, setDate] = useState(initial?.summary.documentDate ?? "");
  const [reference, setReference] = useState(initial?.summary.deliveryReference ?? "");
  const [lines, setLines] = useState<ShipmentLine[]>(initial?.lines ?? []);
  const [preview, setPreview] = useState<ShipmentPreview | null>(null);
  const [previewStale, setPreviewStale] = useState(false);
  const [error, setError] = useState<ShipmentError | null>(null);
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<"save" | "preview" | "submit" | "reload" | null>(null);
  const [dirty, setDirty] = useState(false);
  const [requestId] = useState(() => crypto.randomUUID());
  const running = useRef(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const readOnly = !editing || (saved !== null && saved.summary.status !== "DRAFT");
  const draft = (): ShipmentDraft => ({
    requestId,
    version: saved?.summary.version ?? null,
    agreementId: agreement,
    documentDate: date || null,
    deliveryReference: reference,
    lines: lines.map(line => ({ productId: line.productId, quantity: line.quantity === null ? null : String(line.quantity) })),
  });

  const changed = () => {
    setDirty(true);
    setPreviewStale(Boolean(preview));
    toast.dismiss("shipment-preview-success");
    if (preview && !previewStale) toast.warning("Preview is stale", { id: "shipment-preview-stale", description: "Refresh it after saving your changes." });
    setError(null);
  };

  const focusFailure = (failure: ShipmentError) => {
    const firstField = Object.keys(failure.fieldErrors)[0];
    window.requestAnimationFrame(() => {
      if (firstField) focusShipmentField(firstField);
      else errorSummaryRef.current?.focus();
    });
  };

  const run = async (nextAction: "save" | "preview" | "submit") => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    setAction(nextAction);
    setError(null);
    try {
      if (nextAction === "save") {
        const result = await saveShipment(saved?.summary.id ?? null, draft());
        setSaved(result);
        setLines(result.lines);
        setDirty(false);
        setPreview(null);
        setPreviewStale(false);
        toast.dismiss("shipment-preview-stale");
        toast.success("Draft saved", { description: "No inventory or ledger changes were made." });
        onSaved();
      } else if (nextAction === "preview") {
        const result = await previewShipment(draft());
        setPreview(result);
        setPreviewStale(false);
        toast.dismiss("shipment-preview-stale");
        toast.success("Preview refreshed", { id: "shipment-preview-success", duration: 3000 });
      } else if (saved) {
        const result = await submitShipment(saved.summary.id, saved.summary.version);
        setSaved(result);
        setLines(result.lines);
        setPreview(null);
        setPreviewStale(false);
        setDirty(false);
        toast.dismiss("shipment-preview-stale");
        toast.success("Shipment submitted", { description: "Status changed to Pending. No inventory or ledger changes were made." });
        onSaved();
      }
    } catch (cause) {
      const failure = cause instanceof ShipmentError ? cause : new ShipmentError("Unable to confirm this request. Keep this form and retry with the same request identity.", 503);
      setError(failure);
      if (failure.preview) {
        setPreview(failure.preview);
        setPreviewStale(false);
      }
      if (failure.status === 409) {
        toast.error("Shipment changed", { description: "Reload the saved shipment before continuing.", action: { label: "Reload", onClick: () => void reload() } });
      } else if (Object.keys(failure.fieldErrors).length) {
        toast.error("Check the shipment fields", { description: failure.message });
      } else {
        toast.error("Shipment action failed", { description: failure.message });
      }
      focusFailure(failure);
    } finally {
      running.current = false;
      setBusy(false);
      setAction(null);
    }
  };

  const reload = async () => {
    if (!saved || running.current) return;
    running.current = true;
    setBusy(true);
    setAction("reload");
    setError(null);
    try {
      const result = await getShipment(saved.summary.id);
      setSaved(result);
      setLines(result.lines);
      setAgreement(result.summary.agreementId);
      setAgreementInfo(result.agreement ?? null);
      setAgreementName(result.agreement ? `${result.agreement.code} | ${result.agreement.name}` : result.summary.agreementId ? `Agreement #${result.summary.agreementId}` : "");
      setDate(result.summary.documentDate ?? "");
      setReference(result.summary.deliveryReference ?? "");
      setDirty(false);
      setPreview(null);
      setPreviewStale(false);
      toast.dismiss("shipment-preview-stale");
      toast.success("Saved shipment reloaded");
    } catch (cause) {
      const failure = cause instanceof ShipmentError ? cause : new ShipmentError("Unable to reload the saved shipment.", 503);
      setError(failure);
      toast.error("Unable to reload shipment", { description: failure.message });
    } finally {
      running.current = false;
      setBusy(false);
      setAction(null);
    }
  };

  const requestClose = () => {
    if (busy) return;
    if (dirty && !window.confirm("Discard unsaved shipment changes?")) return;
    onClose();
  };

  const blockers = preview?.blockers ?? [];
  const submitReason = readOnly
    ? null
    : !saved
      ? "Save the draft before submitting."
      : dirty
        ? "Save your changes before submitting."
        : previewStale
          ? "Refresh the preview after changing the shipment."
          : !preview
            ? "Preview the shipment before submitting."
            : !preview.available
              ? `Resolve ${blockers.length} blocker${blockers.length === 1 ? "" : "s"} before submitting.`
              : null;

  return <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
    <DialogContent onCloseAutoFocus={event => { event.preventDefault(); returnFocus(); }} className="flex max-h-[92vh] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
      <DialogHeader className="shrink-0 border-b py-4 pl-6 pr-12 text-left">
        <div className="flex flex-wrap items-center gap-3"><DialogTitle>{saved?.summary.number ?? "New shipment draft"}</DialogTitle>{saved && <ConsignmentStatusBadge status={saved.summary.status} />}</div>
        <DialogDescription>{readOnly ? "Review the saved shipment details." : "Prepare shipment details and inspect the calculation preview before submission."}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 min-w-0 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
        <ShipmentFormErrorSummary errors={error?.fieldErrors ?? {}} summaryRef={errorSummaryRef} />
        {readOnly && saved?.summary.status === "PENDING" && <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">This shipment is Pending. Open the Review action to post it as an independent reviewer.</p>}

        <section aria-labelledby="shipment-agreement-heading" className="space-y-4 rounded-lg border p-4">
          <h3 id="shipment-agreement-heading" className="text-sm font-semibold">Agreement and delivery</h3>
          <div className="space-y-2">
            <p className="text-sm font-medium">Active agreement <span className="text-destructive" aria-hidden="true">*</span><span className="sr-only">required</span></p>
            <div id="shipment-agreement" tabIndex={-1}>
              <ShipmentLookup kind="agreements" label="Active agreement" value={agreementName} disabled={readOnly || busy} onSelect={choice => {
                setAgreementInfo(choice);
                setAgreement(choice?.id ?? null);
                setAgreementName(choice ? `${choice.code} | ${choice.name}` : "");
                changed();
              }} />
            </div>
          </div>
          {agreementInfo && <dl className="grid gap-3 rounded-md bg-muted/40 p-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Consignee</dt><dd className="mt-1 break-words font-medium">{agreementInfo.name}</dd></div>
            <div><dt className="text-muted-foreground">Agreement term</dt><dd className="mt-1">{agreementInfo.startDate ?? "Unavailable"} to {agreementInfo.endDate ?? "Unavailable"}</dd></div>
            <div><dt className="text-muted-foreground">Exposure limit</dt><dd className="mt-1 tabular-nums">{formatPeso(agreementInfo.exposureLimit)}</dd></div>
          </dl>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium" htmlFor="shipment-document-date">Document date <span className="text-destructive" aria-hidden="true">*</span><span className="sr-only">required</span>
              <Input id="shipment-document-date" type="date" value={date} disabled={readOnly || busy} aria-invalid={Boolean(error?.fieldErrors.documentDate)} onChange={event => { setDate(event.target.value); changed(); }} />
            </label>
            <label className="space-y-2 text-sm font-medium" htmlFor="shipment-delivery-reference">Delivery reference <span className="text-destructive" aria-hidden="true">*</span><span className="sr-only">required</span>
              <Input id="shipment-delivery-reference" value={reference} maxLength={120} disabled={readOnly || busy} placeholder="Reference printed on the delivery document" aria-invalid={Boolean(error?.fieldErrors.deliveryReference)} aria-describedby="shipment-delivery-reference-help" onChange={event => { setReference(event.target.value); changed(); }} />
              <span id="shipment-delivery-reference-help" className="block text-xs font-normal text-muted-foreground">Required before submission. Use the reference on the delivery document.</span>
            </label>
          </div>
        </section>

        <section aria-labelledby="shipment-lines-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 id="shipment-lines-heading" className="text-sm font-semibold">Product lines</h3><p className="text-xs text-muted-foreground">Only active products with an eligible UOM are available.</p></div>
          {!lines.length && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No product lines added. Add at least one product before submitting.</p>}
          {lines.map((line, index) => {
            const availability = preview?.lines?.[index];
            const insufficient = availability ? Number(availability.availableQuantity ?? 0) < Number(availability.baseQuantity ?? 0) : false;
            return <div key={index} id={`shipment-line-${index}`} tabIndex={-1} className="min-w-0 space-y-3 rounded-lg border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Line {index + 1}</h4>{availability && <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${insufficient ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>Available: {formatQuantity(availability.availableQuantity)}</span>}</div>
              <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <div id={`shipment-line-${index}-product`} className="min-w-0 space-y-2" tabIndex={-1}><p className="text-sm font-medium">Product <span className="text-destructive" aria-hidden="true">*</span><span className="sr-only">required</span></p>
                  <ShipmentLookup kind="products" label={`Product line ${index + 1}`} value={line.productId ? `${line.productCode ?? ""} | ${line.productName ?? `Product #${line.productId}`}` : ""} disabled={readOnly || busy} onSelect={choice => {
                    setLines(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, productId: choice?.id ?? null, productCode: choice?.code ?? null, productName: choice?.name ?? null, uomId: choice?.uomId ?? null, uomName: choice?.uomName ?? null, multiplier: choice?.multiplier ?? null } : item));
                    changed();
                  }} />
                  <p className="text-xs text-muted-foreground">UOM: {line.uomName ?? "Not selected"} | Multiplier: {line.multiplier ?? "Not recorded"}</p>
                </div>
                <label className="space-y-2 text-sm font-medium" htmlFor={`shipment-line-${index}-quantity`}>Quantity <span className="text-destructive" aria-hidden="true">*</span><span className="sr-only">required</span>
                  <Input id={`shipment-line-${index}-quantity`} inputMode="decimal" value={line.quantity ?? ""} disabled={readOnly || busy} aria-invalid={Boolean(error?.fieldErrors[`lines.${index}.quantity`] || error?.fieldErrors[`lines.${index + 1}.quantity`])} aria-describedby={`shipment-line-${index}-quantity-help`} onChange={event => { setLines(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value || null } : item)); changed(); }} />
                  {availability && <span id={`shipment-line-${index}-quantity-help`} className={`block text-xs font-normal ${insufficient ? "text-destructive" : "text-muted-foreground"}`}>{insufficient ? "Requested quantity exceeds available stock." : `${formatQuantity(availability.baseQuantity)} base units requested.`}</span>}
                </label>
              </div>
              {!readOnly && <Button size="sm" variant="outline" disabled={busy} onClick={() => { setLines(current => current.filter((_, itemIndex) => itemIndex !== index)); changed(); }}>Remove line {index + 1}</Button>}
            </div>;
          })}
          {!readOnly && <Button variant="outline" disabled={busy || lines.length >= 200} onClick={() => { setLines(current => [...current, { id: 0, lineNo: current.length + 1, productId: null, productCode: null, productName: null, uomId: null, uomName: null, multiplier: null, quantity: null }]); changed(); }}>Add product line</Button>}
        </section>

        <ShipmentPreviewPanel preview={preview} />
        {preview && <ShipmentBlockerPanel blockers={preview.blockers} onFocusField={focusShipmentField} />}

      </div>

      <DialogFooter className="shrink-0 flex-wrap items-center gap-2 border-t px-4 py-4 sm:px-6">
        <div className="mr-auto min-w-0 text-xs text-muted-foreground" aria-live="polite">{busy ? (action === "preview" ? "Refreshing preview..." : action === "save" ? "Saving draft..." : action === "submit" ? "Submitting shipment..." : "Reloading...") : submitReason ?? (preview?.available ? "Preview is current and ready." : "")}</div>
        <Button variant="outline" disabled={busy} onClick={requestClose}>Close</Button>
        <Button variant="outline" disabled={busy} onClick={() => void run("preview")}>Preview calculations</Button>
        {!readOnly && <><Button disabled={busy || Boolean(error?.status === 409)} onClick={() => void run("save")}>{action === "save" ? "Saving..." : "Save draft"}</Button><Button disabled={busy || Boolean(submitReason)} title={submitReason ?? undefined} onClick={() => void run("submit")}>{action === "submit" ? "Submitting..." : "Submit shipment"}</Button></>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
