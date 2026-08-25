import { cn } from "@/lib/utils";

import type { AdjustingEntrySummary } from "../types";

type AdjustingEntriesSummaryCardsProps = {
  summary: AdjustingEntrySummary;
};

export function AdjustingEntriesSummaryCards({ summary }: AdjustingEntriesSummaryCardsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-md border bg-background px-3 py-2 shadow-sm">
        <div className="text-xs font-medium uppercase text-muted-foreground">Draft</div>
        <div className="mt-1 text-2xl font-semibold">{summary.draft}</div>
      </div>
      <div className="rounded-md border bg-background px-3 py-2 shadow-sm">
        <div className="text-xs font-medium uppercase text-muted-foreground">Posted</div>
        <div className="mt-1 text-2xl font-semibold text-emerald-700">{summary.posted}</div>
      </div>
      <div className="rounded-md border bg-background px-3 py-2 shadow-sm">
        <div className="text-xs font-medium uppercase text-muted-foreground">Voided</div>
        <div className="mt-1 text-2xl font-semibold text-zinc-700">{summary.voided}</div>
      </div>
      <div className="rounded-md border bg-background px-3 py-2 shadow-sm">
        <div className="text-xs font-medium uppercase text-muted-foreground">Imbalanced Drafts</div>
        <div className={cn("mt-1 text-2xl font-semibold", summary.imbalanced > 0 && "text-destructive")}>
          {summary.imbalanced}
        </div>
      </div>
    </div>
  );
}
