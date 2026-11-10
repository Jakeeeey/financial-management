"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { CalendarDayDialog } from "./CalendarDayDialog";
import { formatLongDate, monthCells, monthLabel } from "./calendarDates";
import { formDotClass } from "../constants";
import { holidaysFor, HOLIDAY_CAVEAT, nonWorkingReason } from "../services/holidays";
import type { CalendarDayItem, CalendarStatus } from "../types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Same hues the chips use, in the order a tax team reads them. */
const LEGEND = [
  { label: "Income tax", className: "bg-indigo-500" },
  { label: "VAT", className: "bg-sky-500" },
  { label: "Withholding", className: "bg-amber-500" },
  { label: "Certificates", className: "bg-violet-500" },
  // Overdue overrides the category colour on the day chips, so the legend has to say so.
  { label: "Overdue", className: "bg-red-500" },
] as const;

const STATUS_RANK: Record<CalendarStatus, number> = { OVERDUE: 3, DUE: 2, PAID: 1, UNKNOWN: 0 };

type DayChip = { formCode: string; count: number; status: CalendarStatus };

/**
 * Eight companies file the same form on the same day, so one chip per form beats eight
 * identical "1601-EQ" pills the reader cannot tell apart.
 */
function chipsFor(items: CalendarDayItem[]): DayChip[] {
  const map = new Map<string, DayChip>();
  for (const item of items) {
    const current = map.get(item.formCode);
    if (!current) {
      map.set(item.formCode, { formCode: item.formCode, count: 1, status: item.status });
      continue;
    }
    current.count += 1;
    if (STATUS_RANK[item.status] > STATUS_RANK[current.status]) current.status = item.status;
  }
  return [...map.values()].sort((left, right) => STATUS_RANK[right.status] - STATUS_RANK[left.status]);
}

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
  onToday,
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
  /** Jumps back to the month that holds today, which may sit in next year's block. */
  onToday?: () => void;
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
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(month - 1)}
            disabled={!canPrev}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <p aria-live="polite" className="min-w-[9rem] text-center text-sm font-semibold tabular-nums">
            {monthLabel(year, month)}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onMonthChange(month + 1)}
            disabled={!canNext}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 text-[11px] text-muted-foreground md:flex">
            {LEGEND.map((entry) => (
              <span key={entry.label} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", entry.className)} aria-hidden />
                {entry.label}
              </span>
            ))}
          </div>
          {isLoading ? (
            <Skeleton className="h-5 w-24 rounded-full" />
          ) : (
            <Badge variant="outline" className="tabular-nums text-[11px]">
              {monthCount} {monthCount === 1 ? "filing" : "filings"}
            </Badge>
          )}
          {onToday ? (
            <Button type="button" variant="outline" size="sm" onClick={onToday}>
              Today
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="px-2 py-1.5 text-center">
            {weekday}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-7 gap-px bg-border/50 p-px">
          {Array.from({ length: 35 }, (_, index) => (
            <Skeleton key={index} className="h-[84px] rounded-none" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-px bg-border/50 p-px">
          {cells.map((cell) => {
            const dayItems = cell.inMonth ? (byDate.get(cell.iso) ?? []) : [];
            const reason = cell.inMonth ? nonWorkingReason(cell.iso, holidays) : null;
            const isToday = cell.iso === today;
            const clickable = dayItems.length > 0;
            const chips = chipsFor(dayItems);
            const shown = chips.slice(0, 3);
            const hiddenCount = chips.length - shown.length;

            const body = (
              <>
                <span className="flex items-center gap-1">
                  <span
                    className={cn(
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums",
                      isToday && "bg-primary text-primary-foreground",
                      !isToday && !cell.inMonth && "text-muted-foreground/50",
                      !isToday && cell.inMonth && "text-foreground/80",
                    )}
                  >
                    {cell.day}
                  </span>
                  {reason && dayItems.length > 0 ? (
                    <span
                      title={reason}
                      className="ml-auto h-1.5 w-1.5 shrink-0 rounded-[2px] bg-slate-400 dark:bg-slate-500"
                      aria-hidden
                    />
                  ) : null}
                </span>

                {shown.length > 0 ? (
                  <span className="mt-1 flex min-w-0 flex-col gap-0.5">
                    {shown.map((chip) => (
                      <span
                        key={chip.formCode}
                        className="flex min-w-0 items-center gap-1.5 text-[10px] leading-4"
                        title={`${chip.formCode}: ${chip.count} ${chip.count === 1 ? "company" : "companies"}`}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            chip.status === "OVERDUE" ? "bg-red-500" : formDotClass(chip.formCode),
                          )}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            "truncate",
                            chip.status === "OVERDUE"
                              ? "font-semibold text-red-600 dark:text-red-400"
                              : chip.status === "PAID"
                                ? "text-muted-foreground"
                                : "text-foreground/80",
                          )}
                        >
                          {chip.formCode}
                          {chip.count > 1 ? ` ×${chip.count}` : ""}
                        </span>
                      </span>
                    ))}
                    {hiddenCount > 0 ? (
                      <span className="text-[10px] leading-4 text-muted-foreground">+{hiddenCount} more</span>
                    ) : null}
                  </span>
                ) : null}
              </>
            );

            const cellClass = cn(
              "flex min-h-[76px] flex-col bg-card p-1.5 text-left sm:min-h-[92px]",
              !cell.inMonth && "bg-muted/40",
              cell.inMonth && reason && dayItems.length > 0 && "bg-muted/50 dark:bg-muted/40",
              isToday && "bg-primary/5 ring-1 ring-inset ring-primary/40",
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
                  "cursor-pointer transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset focus-visible:outline-none",
                )}
              >
                {body}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-1 px-3 py-2.5 sm:px-4">
        {!isLoading && monthCount === 0 ? (
          <p className="text-xs text-muted-foreground">No deadline falls in {monthLabel(year, month)}.</p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3 md:hidden">
            {LEGEND.map((entry) => (
              <span key={entry.label} className="inline-flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", entry.className)} aria-hidden />
                {entry.label}
              </span>
            ))}
          </div>
          <p className="text-xs">{HOLIDAY_CAVEAT}</p>
        </div>
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
