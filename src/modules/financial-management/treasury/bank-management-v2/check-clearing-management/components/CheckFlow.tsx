"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const STAGES: { from: string; steps: { label: string; hint: string; tone?: "ok" | "bad" }[]; arrows: string[] }[] = [
  {
    from: "Issued",
    arrows: ["→ release →", "→ bank pays →"],
    steps: [
      { label: "Pending", hint: "issued, not yet with payee" },
      { label: "In Clearing", hint: "with payee / bank" },
      { label: "Cleared", hint: "bank GL credited", tone: "ok" },
    ],
  },
  {
    from: "Received",
    arrows: ["→ deposit →", "→ bank credits →"],
    steps: [
      { label: "Received", hint: "on hand, not yet deposited" },
      { label: "In Clearing", hint: "deposited" },
      { label: "Cleared", hint: "bank GL debited", tone: "ok" },
    ],
  },
];

/** FSD 1.4 workflow instructions, collapsed by default like the reference prototype. */
export function CheckFlow() {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-xl border border-border/50">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
        <span className="text-sm font-semibold">How a check moves through the system</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t border-border/50 px-4 py-3">
        {STAGES.map((row) => (
          <div key={row.from} className="flex flex-wrap items-center gap-2 text-xs">
            <span className="w-16 shrink-0 font-semibold">{row.from}</span>
            {row.steps.map((step, index) => (
              <span key={`${row.from}-${step.label}`} className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-md border px-2 py-1",
                    step.tone === "ok"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      : "border-border bg-muted/40",
                  )}
                >
                  <span className="block font-medium">{step.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{step.hint}</span>
                </span>
                {index < row.steps.length - 1 ? (
                  <span className="text-[11px] text-muted-foreground">{row.arrows[index]}</span>
                ) : null}
              </span>
            ))}
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="w-16 shrink-0" aria-hidden="true" />
          <span className="text-[11px] text-muted-foreground">Exceptions:</span>
          <span className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <span className="block font-medium">Returned</span>
            <span className="block text-[11px] opacity-80">bounced or returned unpaid</span>
          </span>
          <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            <span className="block font-medium">Cancelled</span>
            <span className="block text-[11px] opacity-80">voided or handed back</span>
          </span>
          <span className="text-[11px] text-muted-foreground">→</span>
          <span className="rounded-md border border-border bg-muted/40 px-2 py-1">
            <span className="block font-medium">Replacement check</span>
            <span className="block text-[11px] text-muted-foreground">new check linked to the old one; history kept</span>
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Until a check clears it stays in the check-clearing account, so the bank account only shows cash the bank has
          actually paid or credited. Post-dated checks keep their status and carry a PDC tag until their check date.
        </p>
      </CollapsibleContent>
    </Collapsible>
  );
}
