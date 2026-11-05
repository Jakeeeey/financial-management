"use client";

import type { RefObject } from "react";
import { AlertCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fieldLabel, focusShipmentField } from "../utils/shipment-ui";

export function ShipmentFormErrorSummary({ errors, summaryRef }: {
  errors: Record<string, string>;
  summaryRef: RefObject<HTMLDivElement | null>;
}) {
  const entries = Object.entries(errors);
  if (!entries.length) return null;
  return <div ref={summaryRef} tabIndex={-1} role="alert" className="scroll-mt-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm focus-visible:outline-2 focus-visible:outline-destructive">
    <div className="flex items-start gap-2">
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-destructive">{entries.length} field{entries.length === 1 ? "" : "s"} need attention</p>
        <ul className="mt-2 space-y-1.5">
          {entries.map(([field, message]) => <li key={field} className="flex flex-wrap items-center justify-between gap-2">
            <span className="min-w-0 break-words"><span className="font-medium">{fieldLabel(field)}:</span> {message}</span>
            <Button type="button" size="sm" variant="outline" onClick={() => focusShipmentField(field)}>Go to field <ArrowRight aria-hidden="true" /></Button>
          </li>)}
        </ul>
      </div>
    </div>
  </div>;
}
