"use client";

import { X } from "lucide-react";
import { useTrialBalance } from "../hooks/useTrialBalance";
import { getTrialBalanceAppliedFilters } from "../utils/filter-state";

export function TrialBalanceAppliedFilters() {
  const { reportContext, removeFilter } = useTrialBalance();
  if (!reportContext) return null;
  const chips = getTrialBalanceAppliedFilters(reportContext);

  return (
    <section aria-label="Applied filters" className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Applied filters:</span>
      {chips.length ? chips.map(chip => (
        <button key={chip.key} type="button" onClick={() => removeFilter(chip.key)}
          aria-label={`Remove ${chip.label} filter`}
          className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-left text-xs hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="min-w-0 [overflow-wrap:anywhere]">{chip.label}</span>
          <X aria-hidden="true" className="h-3 w-3 shrink-0" />
        </button>
      )) : <span className="text-xs text-muted-foreground">No additional filters applied.</span>}
      <span className="sr-only" aria-live="polite">{chips.length} additional filters applied</span>
    </section>
  );
}
