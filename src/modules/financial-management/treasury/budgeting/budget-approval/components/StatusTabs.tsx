"use client";

import { useBudgetApprovalContext } from "../providers/BudgetApprovalProvider";
import type { BudgetStatus } from "../types";

const STATUS_OPTIONS: { value: BudgetStatus; label: string }[] = [
  { value: "Pending", label: "Pending Review" },
  { value: "Approved", label: "Approved (Official)" },
  { value: "Rejected", label: "Rejected" },
];

export function StatusTabs() {
  const { filters, updateFilter } = useBudgetApprovalContext();

  return (
    <div className="flex items-center gap-2 p-1 bg-muted/20 rounded-xl w-fit border border-border/40">
      {STATUS_OPTIONS.map((status) => {
        const isActive = filters.status === status.value;
        return (
          <button
            key={status.value}
            onClick={() => updateFilter("status", status.value)}
            className={`
              h-8 px-4 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all duration-200 active:scale-95
              ${isActive
                ? "bg-background text-primary shadow-sm border border-border/60"
                : "text-muted-foreground hover:text-foreground"
              }
            `}
          >
            {status.label}
          </button>
        );
      })}
    </div>
  );
}
