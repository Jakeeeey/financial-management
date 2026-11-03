"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ConsignmentStatusBadge } from "./ConsignmentStatusBadge";
import { ShipmentBlockerPanel } from "./ShipmentBlockerPanel";
import { ShipmentPreviewPanel } from "./ShipmentPreviewPanel";
import { getShipment, postShipment, postingPreview, rejectShipment, ShipmentError } from "../providers/shipments.api";
import type { ShipmentDetail, ShipmentPreview } from "../shipment-types";
import { formatDateTime, formatPeso, formatQuantity } from "../utils/shipment-ui";

export function ShipmentReviewDialog({ initial, onClose, returnFocus, onChanged }: {
  initial: ShipmentDetail;
  onClose: () => void;
  returnFocus: () => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState(initial);
  const [preview, setPreview] = useState<ShipmentPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(initial.summary.status === "PENDING");
  const [error, setError] = useState<ShipmentError | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmChangedCosts, setConfirmChangedCosts] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const running = useRef(false);

  const loadPreview = useCallback(async () => {
    if (detail.summary.status !== "PENDING") {
      setLoadingPreview(false);
      setPreview(null);
      return;
    }
    setLoadingPreview(true);
    setError(null);
    try {
      setPreview(await postingPreview(detail.summary.id));
    } catch (cause) {
      const failure = cause instanceof ShipmentError ? cause : new ShipmentError("Unable to load the posting preview.", 503);
      setError(failure);
      if (failure.preview) setPreview(failure.preview);
    } finally {
      setLoadingPreview(false);
    }
  }, [detail.summary.id, detail.summary.status]);

  useEffect(() => { void loadPreview(); }, [loadPreview]);

  const post = async () => {
    if (running.current || !preview) return;
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await postShipment(detail.summary.id, {
        version: detail.summary.version,
        requestId: requestId.current,
        previewHash: preview.previewHash ?? null,
        confirmChangedCosts,
      });
      setDetail(result);
      setPreview(null);
      setConfirmChangedCosts(false);
      toast.success("Shipment posted. Inventory and the shared journal were updated.");
      onChanged();
    } catch (cause) {
      const failure = cause instanceof ShipmentError ? cause : new ShipmentError("The posting result is unknown. Check the shipment status before retrying.", 503);
      setError(failure);
      if (failure.preview) setPreview(failure.preview);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const reject = async () => {
    if (running.current) return;
    if (!reason.trim() || reason.trim().length > 1000) {
      setError(new ShipmentError("Enter a rejection reason of 1 to 1,000 characters.", 400, { reason: "A rejection reason is required." }));
      return;
    }
    running.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await rejectShipment(detail.summary.id, detail.summary.version, reason.trim());
      setDetail(result);
      setRejecting(false);
      setPreview(null);
      toast.success("Shipment rejected and its reservation released.");
      onChanged();
    } catch (cause) {
      const failure = cause instanceof ShipmentError ? cause : new ShipmentError("Unable to reject the shipment.", 503);
      setError(failure);
      if (failure.preview) setPreview(failure.preview);
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const checkStatus = async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    try {
      const result = await getShipment(detail.summary.id);
      setDetail(result);
      if (result.summary.status === "POSTED") {
        toast.success("The shipment is posted.");
        onChanged();
      } else {
        setError(new ShipmentError("The shipment is still Pending. Refresh the preview before retrying.", 409));
        await loadPreview();
      }
    } catch (cause) {
      setError(cause instanceof ShipmentError ? cause : new ShipmentError("Unable to check the shipment status.", 503));
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  const pending = detail.summary.status === "PENDING";
  const posted = detail.summary.status === "POSTED";
  const rejected = detail.summary.status === "REJECTED";
  const blockers = preview?.blockers ?? [];
  const postReason = !pending
    ? null
    : loadingPreview
      ? "Loading posting checks."
      : !preview
        ? "Refresh the posting preview before posting."
        : !detail.summary.canPost
          ? (detail.summary.reviewRestriction ?? "Another authorized user must post this shipment.")
          : !preview.available
            ? `Resolve ${blockers.length} blocker${blockers.length === 1 ? "" : "s"} before posting.`
            : preview.costChanged && !confirmChangedCosts
              ? "Confirm the refreshed cost before posting."
              : null;

  const requestClose = () => {
    if (!busy) onClose();
  };

  return <Dialog open onOpenChange={open => { if (!open) requestClose(); }}>
    <DialogContent onCloseAutoFocus={event => { event.preventDefault(); returnFocus(); }} className="flex max-h-[92vh] min-w-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
      <DialogHeader className="shrink-0 border-b py-4 pl-6 pr-12 text-left">
        <div className="flex flex-wrap items-center gap-3"><DialogTitle>{detail.summary.number}</DialogTitle><ConsignmentStatusBadge status={detail.summary.status} /></div>
        <DialogDescription>{detail.summary.agreementReference ?? "Agreement"} | {detail.summary.consigneeName ?? "Consignee"} | {detail.summary.documentDate ?? "No document date"}</DialogDescription>
      </DialogHeader>

      <div className="min-h-0 min-w-0 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
        {error && <div role="alert" aria-live="polite" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <p>{error.message}</p>
          {Object.keys(error.fieldErrors).length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5">{Object.entries(error.fieldErrors).map(([field, message]) => <li key={field}>{field}: {message}</li>)}</ul>}
          <div className="mt-2 flex flex-wrap gap-2">
            {error.status === 409 && pending && <Button size="sm" variant="outline" disabled={busy} onClick={() => void loadPreview()}>Reload preview</Button>}
            {error.status >= 500 && pending && <Button size="sm" variant="outline" disabled={busy} onClick={() => void checkStatus()}>Check posting status</Button>}
          </div>
        </div>}
        {detail.summary.reviewRestriction && <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{detail.summary.reviewRestriction}</p>}

        <section aria-labelledby="shipment-workflow-heading" className="space-y-3">
          <h3 id="shipment-workflow-heading" className="text-sm font-semibold">Workflow</h3>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <WorkflowStep label="Submitted" time={detail.summary.submittedAt} active={Boolean(detail.summary.submittedAt)} />
            <WorkflowStep label={rejected ? "Rejected" : "Reviewed"} time={detail.summary.reviewedAt} active={Boolean(detail.summary.reviewedAt)} />
            <WorkflowStep label={posted ? "Posted" : "Posting"} time={detail.summary.postedAt} active={posted} journal={detail.summary.journalEntryId} />
          </div>
          {rejected && detail.summary.rejectionReason && <p className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300"><span className="font-medium">Rejection reason:</span> {detail.summary.rejectionReason}</p>}
        </section>

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">Shipment lines</h3><p className="text-xs text-muted-foreground">Submitted costs are preserved; posted costs reflect the verified posting run.</p></div>
          <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b bg-muted/50"><tr>{["Product", "Quantity / UOM", "Submitted cost", "Line amount", "Posted cost", "Available"].map(label => <th key={label} className="px-3 py-2 font-medium">{label}</th>)}</tr></thead><tbody>
            {detail.lines.map((line, index) => {
              const availability = preview?.lines?.[index];
              return <tr key={line.id} className="border-b last:border-0">
                <td className="px-3 py-2">{line.productCode ?? ""} {line.productName ?? `Product #${line.productId}`}</td>
                <td className="px-3 py-2">{formatQuantity(line.quantity)} {line.uomName ?? ""}{line.multiplier ? ` x${line.multiplier}` : ""}</td>
                <td className="px-3 py-2 tabular-nums">{formatPeso(line.unitCost)}</td>
                <td className="px-3 py-2 tabular-nums">{formatPeso(line.lineAmount)}</td>
                <td className="px-3 py-2 tabular-nums">{line.postedUnitCost == null ? "-" : formatPeso(line.postedUnitCost)}</td>
                <td className="px-3 py-2 tabular-nums">{availability ? formatQuantity(availability.availableQuantity) : "-"}</td>
              </tr>;
            })}
          </tbody></table></div>
        </section>

        <ShipmentPreviewPanel preview={preview} loading={loadingPreview} readyLabel="Ready to post" />
        {preview && preview.blockers.length > 0 && <ShipmentBlockerPanel blockers={preview.blockers} allowFieldActions={false} />}
        {preview?.costChanged && <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <input type="checkbox" checked={confirmChangedCosts} onChange={event => setConfirmChangedCosts(event.target.checked)} disabled={busy} />
          <span>Verified cost changed from {formatPeso(preview.submittedShipmentCost)} to {formatPeso(preview.refreshedShipmentCost)}. I confirm the refreshed amount.</span>
        </label>}

        <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground"><span className="font-medium text-foreground">Accounting effect:</span> warehouse inventory is reclassified to consignment inventory at verified cost. No revenue is recognized.</p>

        {rejecting && <section className="space-y-2 rounded-lg border border-destructive/40 p-4">
          <label htmlFor="shipment-rejection-reason" className="text-sm font-medium">Rejection reason</label>
          <Input id="shipment-rejection-reason" value={reason} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)} />
          <p className="text-xs text-muted-foreground">{reason.length}/1000 characters</p>
        </section>}
      </div>

      <DialogFooter className="shrink-0 flex-wrap items-center gap-2 border-t px-4 py-4 sm:px-6">
        <div className="mr-auto min-w-0 text-xs text-muted-foreground" aria-live="polite">{busy ? "Processing..." : postReason ?? (posted ? "Shipment posted successfully." : rejected ? "Shipment rejected." : "")}</div>
        <Button variant="outline" disabled={busy} onClick={requestClose}>Close</Button>
        {posted && <p className="text-sm text-muted-foreground">Shared journal #{detail.summary.journalEntryId}</p>}
        {pending && !rejecting && <><Button variant="outline" disabled={busy || !detail.summary.canReject} onClick={() => setRejecting(true)}>Reject</Button><Button disabled={busy || Boolean(postReason)} title={postReason ?? undefined} onClick={() => void post()}>{busy ? "Posting..." : "Post shipment"}</Button></>}
        {pending && rejecting && <><Button variant="outline" disabled={busy} onClick={() => { setRejecting(false); setError(null); }}>Cancel rejection</Button><Button variant="destructive" disabled={busy || !reason.trim()} onClick={() => void reject()}>{busy ? "Rejecting..." : "Confirm rejection"}</Button></>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}

function WorkflowStep({ label, time, active, journal }: { label: string; time: string | null | undefined; active: boolean; journal?: number | null }) {
  return <div className={`rounded-md border p-3 ${active ? "bg-background" : "bg-muted/30"}`}>
    <p className="text-xs font-medium text-muted-foreground">{label}</p>
    <p className="mt-1 text-sm">{formatDateTime(time)}</p>
    {journal ? <p className="mt-1 text-xs text-muted-foreground">Journal #{journal}</p> : null}
  </div>;
}
