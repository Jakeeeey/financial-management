"use client";

import { RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ALL_OPTION, BANK_STATUSES, CURRENCY_OPTIONS, statusLabel } from "../constants";
import type { OnboardingFilterState, OnboardingOptions } from "../types";
import { OptionCombobox } from "./OptionCombobox";

type OnboardingFiltersProps = {
  filters: OnboardingFilterState;
  options: OnboardingOptions;
  activeFilterCount: number;
  onChange: <K extends keyof OnboardingFilterState>(key: K, value: OnboardingFilterState[K]) => void;
  onReset: () => void;
};

/** Search plus the four register filters; every change sends the list back to page 1. */
export function OnboardingFilters({ filters, options, activeFilterCount, onChange, onReset }: OnboardingFiltersProps) {
  const bankOptions = [
    { value: ALL_OPTION, label: "All banks" },
    ...options.banks.map((bank) => ({ value: bank.name, label: bank.name })),
  ];

  return (
    <div className="border-b border-border/50 px-4 py-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="onboarding-search" className="text-xs text-muted-foreground">
            Search
          </Label>
          <div className="relative min-w-0">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              id="onboarding-search"
              value={filters.search}
              onChange={(event) => onChange("search", event.target.value)}
              placeholder="Account no. or holder"
              className="pl-9"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="min-w-0 space-y-1.5">
          <span className="text-xs text-muted-foreground">Bank</span>
          <OptionCombobox
            options={bankOptions}
            value={filters.bank}
            onChange={(value) => onChange("bank", value)}
            placeholder="All banks"
            searchPlaceholder="Search banks"
            emptyLabel="No bank matches that search."
            aria-label="Bank filter"
          />
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="onboarding-account-type" className="text-xs text-muted-foreground">
            Account type
          </Label>
          <Select value={filters.accountType} onValueChange={(value) => onChange("accountType", value)}>
            <SelectTrigger id="onboarding-account-type" className="w-full">
              <SelectValue className="truncate" placeholder="All types" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value={ALL_OPTION}>All types</SelectItem>
              {options.accountTypes.map((type) => (
                <SelectItem key={type.name} value={type.name}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="onboarding-status" className="text-xs text-muted-foreground">
            Status
          </Label>
          <Select value={filters.status} onValueChange={(value) => onChange("status", value)}>
            <SelectTrigger id="onboarding-status" className="w-full">
              <SelectValue className="truncate" placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value={ALL_OPTION}>All statuses</SelectItem>
              {BANK_STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {statusLabel(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label htmlFor="onboarding-currency" className="text-xs text-muted-foreground">
            Currency
          </Label>
          <Select value={filters.currency} onValueChange={(value) => onChange("currency", value)}>
            <SelectTrigger id="onboarding-currency" className="w-full">
              <SelectValue className="truncate" placeholder="All currencies" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value={ALL_OPTION}>All currencies</SelectItem>
              {CURRENCY_OPTIONS.map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {activeFilterCount > 0 ? (
          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              onClick={onReset}
              className="min-h-11 w-full justify-start md:min-h-0"
            >
              <RotateCcw className="mr-2 size-4" />
              Reset filters
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
