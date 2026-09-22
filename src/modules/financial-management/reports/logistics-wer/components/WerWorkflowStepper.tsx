"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const WER_WORKFLOW_STAGES = [
  "Record payable",
  "Submit for approval",
  "Approve & convert",
  "Release & liquidate",
] as const;

interface WerWorkflowStepperProps {
  currentStage: number;
  className?: string;
}

/** Compact orientation strip for the draft → liquidated lifecycle. */
export function WerWorkflowStepper({ currentStage, className }: WerWorkflowStepperProps) {
  const clamped = Math.max(0, Math.min(WER_WORKFLOW_STAGES.length - 1, currentStage));
  return (
    <ol
      aria-label="Payable workflow progress"
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}
    >
      {WER_WORKFLOW_STAGES.map((label, index) => {
        const done = index < clamped;
        const current = index === clamped;
        return (
          <li key={label} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden className="h-px w-4 bg-border sm:w-6" />}
            <span
              className={cn(
                "flex size-5 items-center justify-center rounded-full border text-[10px] font-bold",
                done && "border-emerald-500 bg-emerald-500 text-white",
                current && "border-primary bg-primary/10 text-primary",
                !done && !current && "border-border text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-xs",
                current ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Derive the stage from a plan's submissions (strict: furthest settled state wins). */
export function werStageForSubmissions(
  submissions: Array<{ status: string | null }> | undefined,
  isLiquidated: boolean | null | undefined,
): number {
  if (isLiquidated) return 3;
  const statuses = (submissions ?? []).map((submission) => (submission.status || "").toLowerCase());
  if (statuses.some((status) => status === "approved")) return 2;
  if (statuses.some((status) => status === "submitted")) return 1;
  return 0;
}
