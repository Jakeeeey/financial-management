"use client";

import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ShipmentBlocker } from "../utils/shipment-ui";
import { blockerLabel, fieldElementId, fieldLabel, focusShipmentField, groupBlockers } from "../utils/shipment-ui";

export function ShipmentBlockerPanel({ blockers, onFocusField, allowFieldActions = true }: {
  blockers: ShipmentBlocker[];
  onFocusField?: (field: string) => void;
  allowFieldActions?: boolean;
}) {
  if (!blockers.length) {
    return <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
      <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <p>All blocking checks pass. The shipment is ready for the next action.</p>
    </div>;
  }

  return <div role="alert" aria-live="polite" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
    <div className="flex items-start gap-2">
      <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div>
        <h4 className="font-semibold text-destructive">{blockers.length} blocker{blockers.length === 1 ? "" : "s"} need attention</h4>
        <p className="mt-1 text-muted-foreground">Resolve these checks before saving a valid preview or submitting the shipment.</p>
      </div>
    </div>
    <div className="space-y-3">
      {groupBlockers(blockers).map(group => <section key={group.title} aria-label={group.title}>
        <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h5>
        <ul className="mt-1 space-y-2">
          {group.items.map((blocker, index) => <li key={`${blocker.code}-${blocker.field}-${index}`} className="flex flex-wrap items-start justify-between gap-2 rounded-md border bg-background/80 p-2.5">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{blockerLabel(blocker.code)}</p>
              <p className="mt-0.5 break-words text-muted-foreground">{blocker.message}</p>
              {blocker.field && <p className="mt-1 text-xs text-muted-foreground">Field: {fieldLabel(blocker.field)}</p>}
            </div>
            {allowFieldActions && fieldElementId(blocker.field) && <Button type="button" size="sm" variant="outline" onClick={() => { onFocusField?.(blocker.field); focusShipmentField(blocker.field); }}>
              Go to field <ArrowRight aria-hidden="true" />
            </Button>}
          </li>)}
        </ul>
      </section>)}
    </div>
  </div>;
}
