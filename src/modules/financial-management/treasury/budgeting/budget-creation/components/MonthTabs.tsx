"use client";

import { useRef, useEffect } from "react";
import { useCreateBudgetContext } from "../providers/CreateBudgetProvider";
import { MONTH_NAMES } from "../utils";

export function MonthTabs() {
  const { filters, updateFilter } = useCreateBudgetContext();
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
      className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5"
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
              shrink-0 h-8 px-4 rounded-lg text-xs font-bold transition-all duration-150 active:scale-95
              ${isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
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
