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
import type { TrialBalancePeriodType } from "../types/trial-balance.schema";
import { getManilaDateParts, getTrialBalancePeriodRange, getTrialBalanceYears, validateTrialBalanceDateRange } from "../utils/periods";
import { TRIAL_BALANCE_CATEGORIES, TRIAL_BALANCE_REVIEW_FLAGS } from "../utils/filter-state";

const FilterItem = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`flex w-full min-w-0 flex-col gap-1.5 sm:shrink-0 ${className}`}>
    {children}
  </div>
);

export function TrialBalanceFilters() {
  const { draftFilters: filters, setDraftFilters: setFilters, clearFilters, applyFilters,
    showAccountsNeedingReview, isLoading, hasPendingChanges, validationError, urlError, error } = useTrialBalance();

  const periodType = filters.periodType;
  const today = getManilaDateParts();
  const year = Number(filters.startDate.slice(0, 4)) || today.year;
  const month = Number(filters.startDate.slice(5, 7)) || today.month;
  const quarter = Math.ceil(month / 3);
  const years = getTrialBalanceYears(year);
  const manualStart = filters.startDate;
  const manualEnd = filters.endDate;
  const dateError = periodType === "manual" ? validateTrialBalanceDateRange(manualStart, manualEnd) : null;

  const applyPeriod = (nextType: TrialBalancePeriodType, nextYear = year, nextMonth = month, nextQuarter = quarter, now = new Date()) => {
    const range = nextType === "manual" ? {} : getTrialBalancePeriodRange(nextType, nextYear, nextMonth, nextQuarter, now);
    setFilters((prev) => ({ ...prev, periodType: nextType, ...range }));
  };

  const handleShortcut = (shortcut: "thisMonth" | "lastMonth" | "yearToDate") => {
    const now = new Date();
    const today = getManilaDateParts(now);
    applyPeriod(shortcut === "yearToDate" ? "yearToDate" : "monthly", today.year, today.month - (shortcut === "lastMonth" ? 1 : 0), 1, now);
  };

  const handleCustomDates = (startDate: string, endDate: string) => {
    setFilters((prev) => ({ ...prev, startDate, endDate }));
  };

  return (
    <form noValidate onSubmit={event => { event.preventDefault(); if (!isLoading) applyFilters(); }} className="rounded-xl border bg-card p-4 shadow-sm mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h3 className="shrink-0 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Filters
          {isLoading && (
            <span className="ml-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent align-middle" />
          )}
        </h3>
        <div className="flex min-w-0 flex-wrap gap-2" role="group" aria-label="Period shortcuts">
          <Button type="button" variant="outline" size="sm" onClick={() => handleShortcut("thisMonth")}>This month</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleShortcut("lastMonth")}>Last month</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleShortcut("yearToDate")}>Year to date</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => applyPeriod("manual")}>Custom</Button>
        </div>
        <Button type="button" variant="ghost" size="sm" className="ml-auto h-8 shrink-0 gap-2 text-muted-foreground" onClick={clearFilters}>
          <RotateCcw className="h-4 w-4" />
          Clear all
        </Button>
      </div>

      <div className="flex flex-wrap items-start gap-3">
        {/* Search Bar */}
        <FilterItem className="sm:w-72">
          <Label htmlFor="tb-search">Quick Search</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="tb-search"
              placeholder="Search account code or title..."
              className="h-9 pl-9 rounded-lg"
              value={filters.search}
              onChange={event => setFilters(prev => ({ ...prev, search: event.target.value }))}
            />
          </div>
        </FilterItem>

        {/* Period Type */}
        <FilterItem className="sm:w-40">
          <Label htmlFor="tb-period-type">Period Type</Label>
          <Select value={periodType} onValueChange={(value) => applyPeriod(value as TrialBalancePeriodType)}>
            <SelectTrigger id="tb-period-type" className="h-9 w-full min-w-0 rounded-lg">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Custom</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="annually">Annually</SelectItem>
              <SelectItem value="yearToDate">Year to date</SelectItem>
            </SelectContent>
          </Select>
        </FilterItem>

        {/* Conditional Date Filters */}
        {periodType === "manual" && (
          <>
            <FilterItem className="sm:w-48">
              <Label htmlFor="tb-start-date">Date From</Label>
              <Input id="tb-start-date" type="date" className="h-9 w-full min-w-0 rounded-lg" value={manualStart} onChange={(event) => handleCustomDates(event.target.value, manualEnd)} aria-invalid={!!dateError} aria-describedby={dateError ? "tb-date-error" : undefined} />
            </FilterItem>
            <FilterItem className="sm:w-48">
              <Label htmlFor="tb-end-date">Date To</Label>
              <Input id="tb-end-date" type="date" className="h-9 w-full min-w-0 rounded-lg" value={manualEnd} onChange={(event) => handleCustomDates(manualStart, event.target.value)} aria-invalid={!!dateError} aria-describedby={dateError ? "tb-date-error" : undefined} />
              {dateError && <p id="tb-date-error" role="alert" className="text-sm text-destructive">{dateError}</p>}
            </FilterItem>
          </>
        )}

        {(periodType === "monthly" || periodType === "quarterly" || periodType === "annually") && (
          <FilterItem className="sm:w-28">
            <Label htmlFor="tb-year">Year</Label>
            <Select value={String(year)} onValueChange={(value) => applyPeriod(periodType, Number(value))}>
              <SelectTrigger id="tb-year" className="h-9 w-full min-w-0 rounded-lg">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((option) => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
          </FilterItem>
        )}

        {periodType === "monthly" && (
          <FilterItem className="sm:w-40">
            <Label htmlFor="tb-month">Month</Label>
            <Select value={String(month).padStart(2, "0")} onValueChange={(value) => applyPeriod(periodType, year, Number(value))}>
              <SelectTrigger id="tb-month" className="h-9 w-full min-w-0 rounded-lg">
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
          <FilterItem className="sm:w-48">
            <Label htmlFor="tb-quarter">Quarter</Label>
            <Select value={`q${quarter}`} onValueChange={(value) => applyPeriod(periodType, year, month, Number(value.slice(1)))}>
              <SelectTrigger id="tb-quarter" className="h-9 w-full min-w-0 rounded-lg">
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
        <FilterItem className="sm:w-44">
          <Label htmlFor="tb-category">Account Category</Label>
          <Select
            value={filters.accountCategory}
            onValueChange={(val) => setFilters((prev) => ({ ...prev, accountCategory: val }))}
          >
            <SelectTrigger id="tb-category" className="h-9 w-full min-w-0 rounded-lg">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {TRIAL_BALANCE_CATEGORIES.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
            </SelectContent>
          </Select>
        </FilterItem>

        <FilterItem className="sm:w-40">
          <Label htmlFor="tb-status">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(val) => setFilters((prev) => ({ ...prev, status: val }))}
          >
            <SelectTrigger id="tb-status" className="h-9 w-full min-w-0 rounded-lg">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Posted">Posted</SelectItem>
              <SelectItem value="Unposted">Unposted</SelectItem>
            </SelectContent>
          </Select>
        </FilterItem>

        <FilterItem className="sm:w-40">
          <Label htmlFor="tb-review-flag">Review status</Label>
          <Select
            value={filters.reviewFlag}
            onValueChange={(val) => setFilters((prev) => ({ ...prev, reviewFlag: val }))}
          >
            <SelectTrigger id="tb-review-flag" className="h-9 w-full min-w-0 rounded-lg">
              <SelectValue placeholder="All review statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All review statuses</SelectItem>
              {TRIAL_BALANCE_REVIEW_FLAGS.map(flag => (
                <SelectItem key={flag} value={flag}>{flag === "Critical" ? "Needs review" : "No flag"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterItem>
        <div className="flex w-full flex-wrap justify-end gap-2 sm:w-auto sm:self-end">
          <Button type="button" variant="outline" className="h-9" onClick={showAccountsNeedingReview} disabled={isLoading || !!validationError}>
            Show accounts needing review
          </Button>
          <Button type="submit" className="h-9" disabled={isLoading || !!validationError || (!hasPendingChanges && !error && !urlError)}>
            {isLoading ? "Applying filters…" : "Apply filters"}
          </Button>
        </div>
      </div>
      <p role="status" className="mt-3 text-xs text-muted-foreground">
        {isLoading ? "Applying filters. Showing the last loaded report until the request completes."
          : hasPendingChanges ? "Filter changes are waiting for Apply. The report and exports still use the applied filters."
          : "Clear all restores the current month and All statuses."}
      </p>
      {urlError && <p role="alert" className="mt-2 text-sm text-destructive">{urlError}</p>}
    </form>
  );
}
