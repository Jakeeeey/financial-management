// src/modules/financial-management/accounting/supplier-debit-memo/components/MemoFilters.tsx

"use client";

import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import type { MemoFilters as FiltersType } from "../types";
import { MEMO_STATUSES } from "../utils";

interface MemoFiltersProps {
  filters:    FiltersType;
  suppliers:  { id: number; supplier_name: string }[];
  accounts:   { coa_id: number; account_title: string | null; id?: number }[];
  hasFilters: boolean;
  onChange:   <K extends keyof FiltersType>(key: K, value: FiltersType[K]) => void;
  onClear:    () => void;
  onAddNew:   () => void;
}

export function MemoFiltersBar({
  filters, suppliers, accounts, hasFilters, onChange, onClear, onAddNew,
}: MemoFiltersProps) {
  return (
    <div className="flex items-center justify-between gap-2 w-full">

      {/* Left side — filters */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* Supplier */}
        <Select
          value={filters.supplier_id || undefined}
          onValueChange={val => onChange("supplier_id", val)}
        >
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {suppliers.filter(s => s.supplier_name?.trim()).map(s => (
              <SelectItem key={s.id} value={String(s.id)} className="text-xs">
                {s.supplier_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Chart of Account */}
        <Select
          value={filters.chart_of_account || undefined}
          onValueChange={val => onChange("chart_of_account", val)}
        >
          <SelectTrigger className="h-9 w-[180px] text-xs">
            <SelectValue placeholder="All Accounts" />
          </SelectTrigger>
          <SelectContent className="max-h-60">
            {accounts.map(a => {
              const id = (a as any).id ?? a.coa_id;
              return (
                <SelectItem key={id} value={String(id)} className="text-xs">
                  {a.account_title ?? String(id)}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>

        {/* Status */}
        <Select
          value={filters.status || undefined}
          onValueChange={val => onChange("status", val)}
        >
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {MEMO_STATUSES.map(s => (
              <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Right side — always pinned to the right */}
      <Button
        size="sm"
        onClick={onAddNew}
        className="h-9 px-3 text-xs gap-1.5 shrink-0"
      >
        <Plus className="h-3.5 w-3.5" />
        New Debit Memo
      </Button>
    </div>
  );
}