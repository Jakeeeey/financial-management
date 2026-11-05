"use client";

import { useRef, useEffect } from "react";
import { useBudgetApprovalContext } from "../providers/BudgetApprovalProvider";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MonthTabs() {
  const { filters, updateFilter } = useBudgetApprovalContext();
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Scroll the active tab into view on mount or when month changes
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [filters.month]);

  return (
    <div
      ref={containerRef}
      className="grid w-full min-w-[720px] grid-cols-12 items-center gap-1 overflow-x-auto scrollbar-none pb-0.5"
      style={{ scrollbarWidth: "none" }}
    >
      {MONTH_NAMES.map((name, i) => {
        const value = String(i + 1);
        const isActive = filters.month === value;
        return (
          <button
            key={value}
            ref={isActive ? activeRef : null}
            onClick={() => updateFilter("month", value)}
            className={`
              h-8.5 w-full min-w-0 rounded-xl px-2 text-xs transition-all duration-150 active:scale-95 flex items-center justify-center
              ${isActive
                ? "bg-primary text-primary-foreground font-bold shadow-sm border border-primary"
                : "bg-muted/60 text-muted-foreground border border-border/50 hover:bg-muted hover:border-border hover:text-foreground font-semibold shadow-2xs"
              }
            `}
          >
            {name.slice(0, 3)}
          </button>
        );
      })}
    </div>
  );
}
