"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatNumber } from "@/lib/utils";

import { CalendarMonth } from "./components/CalendarMonth";
import { CalendarTable } from "./components/CalendarTable";
import { useTaxCalendar } from "./hooks/useTaxCalendar";
import { phtToday } from "./pht";
import { HOLIDAY_CAVEAT } from "./services/holidays";
import { TAX_YEARS, toneClass } from "./constants";
import type { Tone } from "./constants";

const TILE_ACCENT: Record<Tone, string> = {
  success: "border-l-emerald-500 from-emerald-50/70 dark:from-emerald-950/40",
  warning: "border-l-amber-500 from-amber-50/70 dark:from-amber-950/40",
  danger: "border-l-red-500 from-red-50/70 dark:from-red-950/40",
  info: "border-l-blue-500 from-blue-50/70 dark:from-blue-950/40",
  neutral: "border-l-border from-muted/40 dark:from-muted/10",
};

function Tile({ label, value, hint, tone }: { label: string; value: string; hint: string; tone: Tone }) {
  return (
    <div
      className={`overflow-hidden rounded-2xl border border-border/50 border-l-[3px] bg-gradient-to-br to-transparent p-4 shadow-none ${TILE_ACCENT[tone]}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

export function TaxCalendarModule() {
  const today = phtToday();
  const currentYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(currentYear);
  /** null until the reader navigates: the grid then follows the year selection. */
  const [month, setMonth] = useState<number | null>(null);
  const calendar = useTaxCalendar(year);

  const activeMonth = month ?? (year === currentYear ? Number(today.slice(5, 7)) - 1 : 0);
  const monthKey = `${year}-${String(activeMonth + 1).padStart(2, "0")}`;
  const monthCount = useMemo(
    () => calendar.events.filter((item) => item.date.startsWith(monthKey)).length,
    [calendar.events, monthKey],
  );

  const notices = calendar.notices.filter((notice) => notice !== HOLIDAY_CAVEAT);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-2 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Tax Calendar</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Every BIR, SEC and LGU deadline for the group, moved to the next working day when it lands on a holiday or a
            weekend.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(year)}
            onValueChange={(value) => {
              setYear(Number(value));
              setMonth(null);
            }}
          >
            <SelectTrigger className="w-[120px]" aria-label="Tax year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {TAX_YEARS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={calendar.refetch} disabled={calendar.isLoading}>
            <RefreshCw className={calendar.isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Still to file"
          value={formatNumber(calendar.counts.due + calendar.counts.overdue)}
          hint="Due or overdue"
          tone={calendar.counts.due + calendar.counts.overdue > 0 ? "info" : "neutral"}
        />
        <Tile
          label="Overdue"
          value={formatNumber(calendar.counts.overdue)}
          hint="No payment recorded"
          tone={calendar.counts.overdue > 0 ? "danger" : "neutral"}
        />
        <Tile
          label="Estimated cash out"
          value={formatCurrency(calendar.counts.estimated)}
          hint="Unfiled estimates only"
          tone={calendar.counts.estimated > 0 ? "warning" : "neutral"}
        />
        <Tile
          label="Filings tracked"
          value={formatNumber(calendar.counts.total)}
          hint="Every company"
          tone="neutral"
        />
      </div>

      {calendar.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>Could not build the calendar</AlertTitle>
          <AlertDescription>{calendar.error}</AlertDescription>
        </Alert>
      )}

      {notices.length > 0 && (
        <Alert>
          <CalendarClock className="h-4 w-4" aria-hidden />
          <AlertTitle>What the dates cannot see</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="calendar" className="space-y-4">
        <TabsList>
          <TabsTrigger value="calendar" className="min-h-11 md:min-h-0">
            Calendar ({monthCount})
          </TabsTrigger>
          <TabsTrigger value="deadlines" className="min-h-11 md:min-h-0">
            Deadlines ({calendar.counts.total})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar">
          <CalendarMonth
            year={year}
            month={activeMonth}
            items={calendar.events}
            today={today}
            isLoading={calendar.isLoading}
            onMonthChange={(next) => setMonth(next)}
          />
        </TabsContent>

        <TabsContent value="deadlines">
          <CalendarTable
            rows={calendar.rows}
            total={calendar.total}
            companies={calendar.companies}
            filters={calendar.filters}
            isLoading={calendar.isLoading}
            page={calendar.page}
            pageCount={calendar.pageCount}
            pageSize={calendar.pageSize}
            today={calendar.today}
            onFiltersChange={calendar.setFilters}
            onPageChange={calendar.setPage}
          />
        </TabsContent>
      </Tabs>

      <p className={`rounded-xl border px-4 py-3 text-xs ${toneClass("neutral")}`}>
        Deadlines are estimates prepared for review, not tax advice. The CPA confirms each date and figure before filing.
      </p>
    </div>
  );
}
