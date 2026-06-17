"use client";

import { useCreateBudgetContext } from "../providers/CreateBudgetProvider";
import { BudgetStatus } from "../types";

export function LifecycleTabs() {
  const { filters, updateFilter } = useCreateBudgetContext();

  const tabs: { value: BudgetStatus; label: string }[] = [
    { value: "Draft", label: "Drafts" },
    { value: "Pending", label: "Pending Approval" },
    { value: "Approved", label: "Approved (Official)" },
    { value: "Rejected", label: "Rejected" },
  ];

  return (
    <div className="flex items-center gap-1">
      {tabs.map((tab) => {
        const isActive = filters.status === tab.value;
        return (
          <button
            key={tab.value}
            onClick={() => updateFilter("status", tab.value)}
            className={`
              relative px-4 py-2 text-xs font-bold transition-all duration-200
              ${isActive 
                ? "text-primary" 
                : "text-muted-foreground hover:text-foreground"
              }
            `}
          >
            {tab.label}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary animate-in fade-in slide-in-from-bottom-1 duration-300" />
            )}
          </button>
        );
      })}
    </div>
  );
}
