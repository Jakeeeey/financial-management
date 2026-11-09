"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { TRANSACTION_KIND_OPTIONS, TRANSACTION_STATUS_OPTIONS } from "../constants";
import type { AccountOption, TransactionFilters } from "../types";
import { DateField } from "./DateField";
import { OptionCombobox } from "./OptionCombobox";

const ALL = "ALL";

interface TransactionFiltersBarProps {
  filters: TransactionFilters;
  accounts: AccountOption[];
  onChange: (patch: Partial<TransactionFilters>) => void;
  onReset: () => void;
}

/**
 * Filter row of the Bank transactions register, per the reference: bank, account, type, status and
 * the two value dates on one line, with the free-text search and the reset below them.
 */
export function TransactionFiltersBar({ filters, accounts, onChange, onReset }: TransactionFiltersBarProps) {
  const [query, setQuery] = useState(filters.q);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // Debounced in the handler, not an effect: typing a reference must not fire one request per keystroke.
  const handleQuery = (value: string) => {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onChange({ q: value }), 300);
  };

  const handleReset = () => {
    if (timer.current) clearTimeout(timer.current);
    setQuery("");
    onReset();
  };

  const bankOptions = useMemo(() => {
    const names = [...new Set(accounts.map((account) => account.bankName))].sort((a, b) => a.localeCompare(b));
    return [{ value: ALL, label: "All banks" }, ...names.map((name) => ({ value: name, label: name }))];
  }, [accounts]);

  const accountOptions = useMemo(() => {
    const scoped = filters.bankName
      ? accounts.filter((account) => account.bankName === filters.bankName)
      : accounts;
    return [
      { value: ALL, label: "All accounts" },
      ...scoped.map((account) => ({
        value: String(account.bankId),
        label: account.label,
        description: account.currency,
      })),
    ];
  }, [accounts, filters.bankName]);

  const isFiltered =
    filters.kind !== "ALL" ||
    filters.bankName !== null ||
    filters.bankAccountId !== null ||
    filters.status !== "" ||
    filters.from !== "" ||
    filters.to !== "" ||
    filters.q !== "";

  return (
    <div
      aria-label="Transaction filters"
      className="grid gap-3 border-b border-border/50 px-4 py-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(180px,1.6fr)]"
    >
      <div className="space-y-1.5">
        <Label htmlFor="transaction-bank" className="text-xs text-muted-foreground">
          Bank
        </Label>
        <OptionCombobox
          id="transaction-bank"
          options={bankOptions}
          value={filters.bankName ?? ALL}
          onChange={(value) =>
            // Changing the bank can orphan the chosen account, so the account filter resets with it.
            onChange({ bankName: value === ALL ? null : value, bankAccountId: null })
          }
          placeholder="All banks"
          searchPlaceholder="Search banksâ€¦"
          emptyLabel="No bank matches."
          className="h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transaction-account" className="text-xs text-muted-foreground">
          Account
        </Label>
        <OptionCombobox
          id="transaction-account"
          options={accountOptions}
          value={filters.bankAccountId ? String(filters.bankAccountId) : ALL}
          onChange={(value) => onChange({ bankAccountId: value === ALL ? null : Number(value) })}
          placeholder="All accounts"
          searchPlaceholder="Search accountsâ€¦"
          emptyLabel="No account matches."
          className="h-9"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transaction-kind" className="text-xs text-muted-foreground">
          Type
        </Label>
        <Select
          value={filters.kind}
          onValueChange={(value) => onChange({ kind: value as TransactionFilters["kind"] })}
        >
          <SelectTrigger id="transaction-kind" size="sm" className="w-full">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value={ALL}>All types</SelectItem>
            {TRANSACTION_KIND_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transaction-status" className="text-xs text-muted-foreground">
          Status
        </Label>
        <Select
          value={filters.status || ALL}
          onValueChange={(value) => onChange({ status: value === ALL ? "" : value })}
        >
          <SelectTrigger id="transaction-status" size="sm" className="w-full">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value={ALL}>Any status</SelectItem>
            {TRANSACTION_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transaction-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <DateField
          id="transaction-from"
          value={filters.from}
          onChange={(value) => onChange({ from: value })}
          placeholder="Any date"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transaction-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <DateField
          id="transaction-to"
          value={filters.to}
          onChange={(value) => onChange({ to: value })}
          placeholder="Any date"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transaction-search" className="text-xs text-muted-foreground">
          Search
        </Label>
        <div className="flex items-center gap-1">
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              id="transaction-search"
              value={query}
              onChange={(event) => handleQuery(event.target.value)}
              placeholder="Reference, payee or bank"
              className="h-9 pl-9"
              autoComplete="off"
            />
          </div>
          {isFiltered ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="h-9 w-9 shrink-0"
              aria-label="Clear filters"
              title="Clear filters"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
