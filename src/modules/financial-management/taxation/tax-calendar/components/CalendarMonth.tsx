"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { CalendarDayDialog } from "./CalendarDayDialog";
import { formatLongDate, monthCells, monthLabel } from "./calendarDates";
import { chipStateClass, formChipClass } from "../constants";
import { holidaysFor, HOLIDAY_CAVEAT, nonWorkingReason } from "../services/holidays";
import type { CalendarDayItem } from "../types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Same hues the chips use, in the order a tax team reads them. */
const LEGEND = [
  { label: "Income tax", className: "bg-indigo-500/15 ring-indigo-500/40" },
  { label: "VAT", className: "bg-sky-500/15 ring-sky-500/40" },
  { label: "Withholding", className: "bg-amber-500/15 ring-amber-500/40" },
  { label: "Certificates", className: "bg-violet-500/15 ring-violet-500/40" },
  { label: "Overdue", className: "bg-transparent ring-2 ring-red-500/60" },
] as const;

/** One month of deadlines as a real calendar, plus the day drilldown. */
export function CalendarMonth({
  year,
  month,
  items,
  today,
  isLoading,
  canPrev = true,
  canNext = true,
  onMonthChange,
}: {
  year: number;
  /** 0-based, like `Date`. */
  month: number;
  items: CalendarDayItem[];
  today: string;
  isLoading: boolean;
  canPrev?: boolean;
  canNext?: boolean;
  onMonthChange: (month: number) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const opener = useRef<string | null>(null);

  const holidays = useMemo(() => holidaysFor(year), [year]);
  const cells = useMemo(() => monthCells(year, month), [year, month]);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarDayItem[]>();
    for (const item of items) {
      const list = map.get(item.date);
      if (list) list.push(item);
      else map.set(item.date, [item]);
    }
    return map;
  }, [items]);

  const monthCount = useMemo(
    () => cells.filter((cell) => cell.inMonth).reduce((sum, cell) => sum + (byDate.get(cell.iso)?.length ?? 0), 0),
    [cells, byDate],
  );

  const selectedItems = selected ? (byDate.get(selected) ?? []) : [];

  return (
    <section
      aria-label="Month grid"
      className="overflow-hidden rounded-2xl border border-border/50 border-t-[3px] border-t-teal-500/70 bg-card shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-3 sm:px-4">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onMonthChange(month - 1)}
          disabled={!canPrev}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          <span className="ml-1">Previous</span>
        </Button>
        <p aria-live="polite" className="text-sm font-semibold tabular-nums">
          {monthLabel(year, month)}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => onMonthChange(month + 1)} disabled={!canNext}>
          <span className="mr-1">Next</span>
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 border-b border-border/50 px-1 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:px-2">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="text-center">
            {weekday}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-7 gap-1 p-1 sm:p-2">
          {Array.from({ length: 35 }, (_, index) => (
            <Skeleton key={index} className="h-[56px] rounded-lg sm:h-[88px]" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1 p-1 sm:p-2">
          {cells.map((cell) => {
            const dayItems = cell.inMonth ? (byDate.get(cell.iso) ?? []) : [];
            const reason = cell.inMonth ? nonWorkingReason(cell.iso, holidays) : null;
            const isToday = cell.iso === today;
            const clickable = dayItems.length > 0;

            const body = (
              <>
                <span className="flex items-center gap-1">
                  <span
                    className={cn(
                      "text-[11px] font-semibold tabular-nums sm:text-xs",
                      isToday && "text-primary",
                      !cell.inMonth && "text-muted-foreground/60",
                    )}
                  >
                    {cell.day}
                  </span>
                  {reason ? (
                    <span
                      title={reason}
                      className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/80 dark:bg-amber-400/80"
                      aria-hidden
                    />
                  ) : null}
                </span>

                {dayItems.length > 0 ? (
                  <span className="mt-1 flex flex-col gap-0.5">
                    {dayItems.slice(0, 2).map((item) => (
                      <span
                        key={`${item.formCode}-${item.period}-${item.companyName}`}
                        className={cn("truncate rounded px-1 text-[11px] leading-4 font-medium", formChipClass(item.formCode), chipStateClass(item.status))}
                        title={`${item.formCode} | ${item.companyName} | ${item.period}`}
                      >
                        {item.formCode}
                      </span>
                    ))}
                    {dayItems.length > 2 ? (
                      <span className="text-[11px] leading-4 text-muted-foreground">+{dayItems.length - 2} more</span>
                    ) : null}
                  </span>
                ) : null}
              </>
            );

            const cellClass = cn(
              "flex min-h-[56px] flex-col rounded-lg border border-border/40 bg-card p-1 text-left sm:min-h-[88px] sm:p-1.5",
              !cell.inMonth && "bg-muted/30",
              cell.inMonth && reason && "bg-amber-50/60 dark:bg-amber-950/15",
              isToday && "border-primary ring-1 ring-primary/40",
            );

            if (!clickable) {
              return (
                <div key={cell.iso} className={cellClass} aria-current={isToday ? "date" : undefined}>
                  {body}
                </div>
              );
            }

            return (
              <button
                key={cell.iso}
                type="button"
                data-day-cell={cell.iso}
                onClick={() => {
                  opener.current = cell.iso;
                  setSelected(cell.iso);
                }}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${formatLongDate(cell.iso)}, ${dayItems.length} obligation${dayItems.length === 1 ? "" : "s"}${reason ? `, not a working day: ${reason.toLowerCase()}` : ""}`}
                className={cn(
                  cellClass,
                  "cursor-pointer transition-colors hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                )}
              >
                {body}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-1 px-3 pb-3 sm:px-4">
        {!isLoading && monthCount === 0 ? (
          <p className="text-xs text-muted-foreground">No deadline falls in {monthLabel(year, month)}.</p>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
          {LEGEND.map((entry) => (
            <span key={entry.label} className="inline-flex items-center gap-1.5">
              <span className={cn("h-2.5 w-2.5 rounded-sm ring-1 ring-inset", entry.className)} aria-hidden />
              {entry.label}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{HOLIDAY_CAVEAT}</p>
      </div>

      <CalendarDayDialog
        onOpenChange={(open) => {
          setSelected(open ? selected : null);
          if (!open && opener.current) {
            const iso = opener.current;
            requestAnimationFrame(() => {
              document.querySelector<HTMLElement>(`[data-day-cell="${iso}"]`)?.focus();
            });
          }
        }}
        date={selected}
        items={selectedItems}
      />
    </section>
  );
}
