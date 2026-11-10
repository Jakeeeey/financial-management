"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
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

  // Months 0-11 are the tax year; 12-15 are the following January-April, where the
  // annual returns for this year fall.
  const LAST_MONTH = 15;
  const activeMonth = month ?? (year === currentYear ? Number(today.slice(5, 7)) - 1 : 0);
  const displayYear = activeMonth > 11 ? year + 1 : year;
  const displayMonth = activeMonth % 12;
  const monthKey = `${displayYear}-${String(displayMonth + 1).padStart(2, "0")}`;
  const monthCount = useMemo(
    () => calendar.events.filter((item) => item.date.startsWith(monthKey)).length,
    [calendar.events, monthKey],
  );

  const notices = calendar.notices.filter((notice) => notice !== HOLIDAY_CAVEAT);
  /** True while the figures on screen belong to the year the reader just left. */
  const stale = calendar.settledYear !== null && calendar.settledYear !== year;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
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
          <Button variant="outline" size="sm" asChild>
            <Link href="/fm/taxation/payments-2307">Record payments</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={calendar.refetch} disabled={calendar.isLoading}>
            <RefreshCw className={calendar.isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {stale ? (
        <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-[92px] rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
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

        </div>
      )}

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
            month={displayMonth}
            year={displayYear}
            canPrev={activeMonth > 0}
            canNext={activeMonth < LAST_MONTH}
            items={calendar.events}
            today={today}
            isLoading={calendar.isLoading || stale}
            onMonthChange={(next) => setMonth(Math.min(LAST_MONTH, Math.max(0, next)))}
            onToday={() => {
              const todayYear = Number(today.slice(0, 4));
              const todayMonth = Number(today.slice(5, 7)) - 1;
              const index = todayYear === year ? todayMonth : todayYear === year + 1 ? 12 + todayMonth : 0;
              setMonth(Math.min(LAST_MONTH, Math.max(0, index)));
            }}
          />
        </TabsContent>

        <TabsContent value="deadlines">
          <CalendarTable
            rows={calendar.rows}
            total={calendar.total}
            companies={calendar.companies}
            filters={calendar.filters}
            isLoading={calendar.isLoading || stale}
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
