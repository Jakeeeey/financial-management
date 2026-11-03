"use client";

import { Button } from "@/components/ui/button";
import { ConsignmentStatusBadge } from "./ConsignmentStatusBadge";
import type { ShipmentSummary } from "../shipment-types";
import { formatDateTime } from "../utils/shipment-ui";

export function ShipmentRegisterCards({ items, loading, onView, onEdit, onDetails }: {
  items: ShipmentSummary[];
  loading: boolean;
  onView: (item: ShipmentSummary, button: HTMLButtonElement) => void;
  onEdit: (item: ShipmentSummary, button: HTMLButtonElement) => void;
  onDetails: (item: ShipmentSummary, button: HTMLButtonElement) => void;
}) {
  if (!items.length) return <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">No shipments match the current filters.</div>;
  return <div className="space-y-3 p-3">
    {items.map(item => <article key={item.id} aria-label={`Shipment ${item.number}`} className="min-w-0 rounded-lg border bg-background p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0"><h3 className="break-words font-semibold">{item.number}</h3><p className="mt-1 text-xs text-muted-foreground">{item.documentDate ?? "No document date"} | {item.deliveryReference || "No delivery reference"}</p></div>
        <ConsignmentStatusBadge status={item.status} />
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Agreement / consignee</dt><dd className="mt-0.5 break-words">{item.agreementReference ?? (item.agreementId ? `#${item.agreementId}` : "Not set")}{item.consigneeName ? ` | ${item.consigneeName}` : ""}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Submitted</dt><dd className="mt-0.5">{formatDateTime(item.submittedAt)}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={loading} onClick={event => onView(item, event.currentTarget)}>View</Button>
        {item.editable && <Button size="sm" variant="outline" disabled={loading} onClick={event => onEdit(item, event.currentTarget)}>Edit</Button>}
        {item.status !== "DRAFT" && <Button size="sm" disabled={loading} onClick={event => onDetails(item, event.currentTarget)}>{item.status === "PENDING" ? "Review" : "Details"}</Button>}
      </div>
    </article>)}
  </div>;
}
