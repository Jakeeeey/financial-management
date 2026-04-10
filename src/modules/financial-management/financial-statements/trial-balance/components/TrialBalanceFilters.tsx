"use client";

import * as React from "react";
import { Search, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useTrialBalance } from "../hooks/useTrialBalance";

/**
 * Filter item container to maintain consistent 4-per-row layout
 * while allowing items to grow and fill empty space.
 */
const FilterItem = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`space-y-2 flex-grow basis-[calc(25%-1rem)] min-w-[200px] ${className}`}>
    {children}
  </div>
);

/**
 * Helper: Compute startDate and endDate from period type selections.
 */
function computeDateRange(
  periodType: string,
  year: string,
  month: string,
  quarter: string,
  manualStart: string,
  manualEnd: string
): { startDate: string; endDate: string } {
  if (periodType === "manual") {
    return { startDate: manualStart, endDate: manualEnd };
  }

  const y = parseInt(year, 10);

  if (periodType === "monthly") {
    const m = parseInt(month, 10);
    const lastDay = new Date(y, m, 0).getDate();
    return {
      startDate: `${y}-${month}-01`,
      endDate: `${y}-${month}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  if (periodType === "quarterly") {
    const quarterMap: Record<string, { startMonth: string; endMonth: string; endDay: number }> = {
      q1: { startMonth: "01", endMonth: "03", endDay: 31 },
      q2: { startMonth: "04", endMonth: "06", endDay: 30 },
      q3: { startMonth: "07", endMonth: "09", endDay: 30 },
      q4: { startMonth: "10", endMonth: "12", endDay: 31 },
    };
    const q = quarterMap[quarter] || quarterMap.q1;
    return {
      startDate: `${y}-${q.startMonth}-01`,
      endDate: `${y}-${q.endMonth}-${String(q.endDay).padStart(2, "0")}`,
    };
  }

  // annually
  return { startDate: `${y}-01-01`, endDate: `${y}-12-31` };
}

export function TrialBalanceFilters() {
  const { filters, setFilters, resetFilters, isLoading } = useTrialBalance();

  // Local state for period-type child controls
  const [periodType, setPeriodType] = React.useState(filters.periodType);
  const [manualStart, setManualStart] = React.useState(filters.startDate);
  const [manualEnd, setManualEnd] = React.useState(filters.endDate);
  const [year, setYear] = React.useState("2025");
  const [month, setMonth] = React.useState("03");
  const [quarter, setQuarter] = React.useState("q1");
  const [searchValue, setSearchValue] = React.useState(filters.search);

  // Debounced search
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout>>(null);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: value }));
    }, 500);
  };

  // Sync date range to provider when period controls change
  const syncDateRange = React.useCallback(
    (pt: string, y: string, m: string, q: string, ms: string, me: string) => {
      const { startDate, endDate } = computeDateRange(pt, y, m, q, ms, me);
      setFilters((prev) => ({
        ...prev,
        periodType: pt as "manual" | "monthly" | "quarterly" | "annually",
        startDate,
        endDate,
      }));
    },
    [setFilters]
  );

  const handlePeriodTypeChange = (val: string) => {
    setPeriodType(val as typeof periodType);
    syncDateRange(val, year, month, quarter, manualStart, manualEnd);
  };

  const handleYearChange = (val: string) => {
    setYear(val);
    syncDateRange(periodType, val, month, quarter, manualStart, manualEnd);
  };

  const handleMonthChange = (val: string) => {
    setMonth(val);
    syncDateRange(periodType, year, val, quarter, manualStart, manualEnd);
  };

  const handleQuarterChange = (val: string) => {
    setQuarter(val);
    syncDateRange(periodType, year, month, val, manualStart, manualEnd);
  };

  const handleManualStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setManualStart(val);
    syncDateRange(periodType, year, month, quarter, val, manualEnd);
  };

  const handleManualEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setManualEnd(val);
    syncDateRange(periodType, year, month, quarter, manualStart, val);
  };

  const handleReset = () => {
    setPeriodType("manual");
    setManualStart("2025-01-01");
    setManualEnd("2025-12-30");
    setYear("2025");
    setMonth("03");
    setQuarter("q1");
    setSearchValue("");
    resetFilters();
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Filters
          {isLoading && (
            <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent align-middle" />
          )}
        </h3>
        <Button variant="ghost" size="sm" className="h-8 gap-2 text-muted-foreground" onClick={handleReset}>
          <RotateCcw className="h-4 w-4" />
          Reset Filters
        </Button>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        {/* Search Bar */}
        <FilterItem>
          <Label htmlFor="tb-search">Quick Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="tb-search"
              placeholder="Search account code or title..."
              className="pl-9 rounded-lg"
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
        </FilterItem>

        {/* Period Type */}
        <FilterItem>
          <Label>Period Type</Label>
          <Select value={periodType} onValueChange={handlePeriodTypeChange}>
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annually">Annually</SelectItem>
            </SelectContent>
          </Select>
        </FilterItem>

        {/* Conditional Date Filters */}
        {periodType === "manual" && (
          <>
            <FilterItem>
              <Label>Date From</Label>
              <Input type="date" className="rounded-lg" value={manualStart} onChange={handleManualStartChange} />
            </FilterItem>
            <FilterItem>
              <Label>Date To</Label>
              <Input type="date" className="rounded-lg" value={manualEnd} onChange={handleManualEndChange} />
            </FilterItem>
          </>
        )}

        {(periodType === "monthly" || periodType === "quarterly" || periodType === "annually") && (
          <FilterItem>
            <Label>Year</Label>
            <Select value={year} onValueChange={handleYearChange}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2026">2026</SelectItem>
                <SelectItem value="2025">2025</SelectItem>
                <SelectItem value="2024">2024</SelectItem>
              </SelectContent>
            </Select>
          </FilterItem>
        )}

        {periodType === "monthly" && (
          <FilterItem>
            <Label>Month</Label>
            <Select value={month} onValueChange={handleMonthChange}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Select Month" />
              </SelectTrigger>
              <SelectContent>
                {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, idx) => (
                  <SelectItem key={m} value={String(idx + 1).padStart(2, "0")}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterItem>
        )}

        {periodType === "quarterly" && (
          <FilterItem>
            <Label>Quarter</Label>
            <Select value={quarter} onValueChange={handleQuarterChange}>
              <SelectTrigger className="rounded-lg">
                <SelectValue placeholder="Select Quarter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="q1">Q1 (Jan - Mar)</SelectItem>
                <SelectItem value="q2">Q2 (Apr - Jun)</SelectItem>
                <SelectItem value="q3">Q3 (Jul - Sep)</SelectItem>
                <SelectItem value="q4">Q4 (Oct - Dec)</SelectItem>
              </SelectContent>
            </Select>
          </FilterItem>
        )}

        {/* Standard Filters */}
        <FilterItem>
          <Label>Account Category</Label>
          <Select
            value={filters.accountCategory}
            onValueChange={(val) => setFilters((prev) => ({ ...prev, accountCategory: val }))}
          >
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="Assets">Assets</SelectItem>
              <SelectItem value="Liabilities">Liabilities</SelectItem>
              <SelectItem value="Equity">Equity</SelectItem>
              <SelectItem value="Revenue">Revenue</SelectItem>
              <SelectItem value="Expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </FilterItem>

        <FilterItem>
          <Label>Status</Label>
          <Select
            value={filters.status}
            onValueChange={(val) => setFilters((prev) => ({ ...prev, status: val }))}
          >
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Posted">Posted</SelectItem>
              <SelectItem value="Unposted">Unposted</SelectItem>
            </SelectContent>
          </Select>
        </FilterItem>

        <FilterItem>
          <Label>Review Flag</Label>
          <Select
            value={filters.reviewFlag}
            onValueChange={(val) => setFilters((prev) => ({ ...prev, reviewFlag: val }))}
          >
            <SelectTrigger className="rounded-lg">
              <SelectValue placeholder="All Flags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Flags</SelectItem>
              <SelectItem value="Normal">Normal</SelectItem>
              <SelectItem value="High">High</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </FilterItem>
      </div>
    </div>
  );
}
