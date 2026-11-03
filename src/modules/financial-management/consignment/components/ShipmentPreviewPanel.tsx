"use client";

import type { ReactNode } from "react";
import { Boxes, TrendingUp } from "lucide-react";
import type { ShipmentPreview } from "../shipment-types";
import { formatPeso, formatQuantity } from "../utils/shipment-ui";

export function ShipmentPreviewPanel({ preview, loading = false, readyLabel = "Ready to submit" }: { preview: ShipmentPreview | null; loading?: boolean; readyLabel?: string }) {
  if (loading) {
    return <section aria-label="Shipment calculation preview" aria-busy="true" className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">Calculation preview</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map(index => <div key={index} className="h-16 animate-pulse rounded-md bg-muted" />)}</div>
      <p className="text-sm text-muted-foreground">Checking stock, verified costs, and exposure...</p>
    </section>;
  }
  if (!preview) return null;

  const utilization = Number(preview.utilization ?? 0);
  const exposure = Number(preview.projectedExposure ?? 0);
  const limit = Number(preview.exposureLimit ?? 0);
  const utilizationWidth = Math.max(0, Math.min(100, Number.isFinite(utilization) ? utilization : 0));
  return <section aria-label="Shipment calculation preview" className="space-y-4 rounded-lg border bg-muted/20 p-4 text-sm">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="font-semibold">Calculation preview</h3>
        <p className="mt-1 text-xs text-muted-foreground">Stock availability is read from the warehouse configured in Policies. Pending shipments are shown separately.</p>
      </div>
      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${preview.available ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-destructive/30 bg-destructive/5 text-destructive"}`}>
        {preview.available ? readyLabel : "Blocked"}
      </span>
    </div>

    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Metric label="Shipment cost" value={formatPeso(preview.shipmentCost)} icon={<TrendingUp aria-hidden="true" className="size-4" />} />
      <Metric label="Available warehouse stock" value={formatQuantity(preview.availableQuantity)} icon={<Boxes aria-hidden="true" className="size-4" />} />
      <Metric label="Other Pending commitments" value={formatQuantity(preview.pendingShipmentQuantity)} />
      <Metric label="Projected exposure" value={`${formatPeso(exposure)} / ${formatPeso(limit)}`} />
    </div>

    <div className="space-y-1">
      <div className="flex justify-between gap-2 text-xs text-muted-foreground"><span>Exposure utilization</span><span className="font-semibold tabular-nums text-foreground">{Number.isFinite(utilization) ? utilization.toFixed(2) : "0.00"}%</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Exposure utilization" aria-valuemin={0} aria-valuemax={100} aria-valuenow={utilizationWidth}>
        <div className={`h-full rounded-full ${utilization > 90 ? "bg-destructive" : utilization > 75 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${utilizationWidth}%` }} />
      </div>
    </div>

    {preview.lines && preview.lines.length > 0 && <div className="space-y-2">
      <h4 className="font-medium">Product availability</h4>
      <div className="overflow-x-auto rounded-md border bg-background">
        <table className="w-full min-w-[620px] text-left text-xs">
          <caption className="sr-only">Product stock availability for this shipment</caption>
          <thead className="border-b bg-muted/50"><tr>{["Product", "Quantity", "Base quantity", "Unit cost", "Line amount", "Available"].map(label => <th key={label} scope="col" className="px-3 py-2 font-medium">{label}</th>)}</tr></thead>
          <tbody>{preview.lines.map((line, index) => {
            const insufficient = Number(line.availableQuantity ?? 0) < Number(line.baseQuantity ?? 0);
            return <tr key={`${line.lineId}-${index}`} className="border-b last:border-0">
              <td className="max-w-56 px-3 py-2">{line.productCode ?? ""} {line.productName ?? `Product #${line.productId ?? "-"}`}</td>
              <td className="px-3 py-2 tabular-nums">{formatQuantity(line.quantity)}</td>
              <td className="px-3 py-2 tabular-nums">{formatQuantity(line.baseQuantity)}</td>
              <td className="px-3 py-2 tabular-nums">{formatPeso(line.unitCost)}</td>
              <td className="px-3 py-2 tabular-nums">{formatPeso(line.lineAmount)}</td>
              <td className={`px-3 py-2 tabular-nums ${insufficient ? "font-semibold text-destructive" : "text-foreground"}`}>{formatQuantity(line.availableQuantity)}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
    </div>}

    {preview.warnings.length > 0 && <ul role="status" className="list-disc space-y-1 rounded-md border border-amber-200 bg-amber-50 p-3 pl-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
      {preview.warnings.map((warning, index) => <li key={index}>{warning}</li>)}
    </ul>}
  </section>;
}

function Metric({ label, value, icon }: { label: string; value: string; icon?: ReactNode }) {
  return <div className="rounded-md border bg-background p-3">
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
    <p className="mt-1 break-words font-semibold tabular-nums text-foreground">{value}</p>
  </div>;
}
