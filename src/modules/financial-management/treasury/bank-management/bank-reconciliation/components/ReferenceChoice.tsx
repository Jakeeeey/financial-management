"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useReferenceChoices } from "../hooks/useReferenceChoices";
import type { BankBranchReference, BankReconciliationReferenceResource, BankReconciliationReferences } from "../reference-types";
import { ChoiceListSkeleton } from "./BankReconciliationSkeletons";
import { BankAccountLabel, bankAccountLabel } from "./BankAccountLabel";

type Reference = BankReconciliationReferences[BankReconciliationReferenceResource];
export function referenceLabel(item: Reference) {
  return "bankName" in item ? bankAccountLabel(item) : `${item.code} · ${item.name}`;
}

export function ReferenceChoice({ label, resource, selected, onSelect, disabled, companyId, bankGroup, currentAssets, onAdd, onClear, excludeIds }: {
  label: string; resource: BankReconciliationReferenceResource; selected: Reference | null;
  onSelect: (item: Reference) => void; disabled?: boolean; companyId?: number; bankGroup?: BankBranchReference;
  currentAssets?: boolean; onAdd?: () => void; onClear?: () => void; excludeIds?: number[];
}) {
  const choices = useReferenceChoices(resource, { companyId, ...(resource === "bank-accounts" ? bankGroup : {}) });
  const { open, search, page, items, total, loading, error } = choices;
  return <div className="min-w-0 space-y-2"><label className="text-sm font-medium">{label}</label>
    <Popover open={open} onOpenChange={choices.onOpenChange} modal>
      <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open} title={selected ? referenceLabel(selected) : undefined} disabled={disabled} className="w-full min-w-0 justify-between font-normal">
        {selected && "bankName" in selected ? <BankAccountLabel bank={selected} truncate /> : <span className="min-w-0 flex-1 truncate text-left">{selected ? referenceLabel(selected) : `Select ${label.toLowerCase()}`}</span>}<ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button></PopoverTrigger>
      <PopoverContent align="start" className="w-[max(22rem,var(--radix-popover-trigger-width))] max-w-[calc(100vw-2rem)] p-0">
        <Command shouldFilter={false}><CommandInput aria-label={`Search ${label}`} placeholder="Search by code, name, or branch..." value={search} onValueChange={choices.onSearchChange} />
          <CommandList className="max-h-64 overflow-y-auto overscroll-contain">{loading ? <ChoiceListSkeleton label={`Loading ${label.toLowerCase()} choices`} rows={3} /> : <>
            <CommandEmpty>{error || "No matching choices."}</CommandEmpty>
            {!error && <CommandGroup>{items.map(item => {
              const unsuitable = currentAssets && "classification" in item && item.classification !== "BS / CURRENT ASSETS";
              const excluded = excludeIds?.includes(item.id);
              return <CommandItem key={item.id} value={String(item.id)} disabled={Boolean(unsuitable || excluded)} onSelect={() => { onSelect(item); choices.onOpenChange(false); }}>
                <Check className={`mr-2 size-4 shrink-0 ${selected?.id === item.id ? "opacity-100" : "opacity-0"}`} />
                <span className="min-w-0 flex-1 whitespace-normal break-words">{"bankName" in item ? <BankAccountLabel bank={item} /> : referenceLabel(item)}{"classification" in item && <small className="block text-muted-foreground">{item.status} · {item.classification}{unsuitable ? " · Select a Current Assets account" : excluded ? " · Cash in Bank cannot be its own offset" : ""}</small>}</span>
              </CommandItem>;
            })}</CommandGroup>}
          </>}</CommandList>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t p-2">
            {onAdd && <Button type="button" variant="ghost" size="sm" onClick={() => { choices.onOpenChange(false); onAdd(); }}>Add new…</Button>}
            {onClear && selected && <Button type="button" variant="ghost" size="sm" onClick={() => { choices.onOpenChange(false); onClear(); }}>Clear selection</Button>}
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap"><Button type="button" size="sm" variant="outline" disabled={loading || page === 1} onClick={choices.previous}>Previous</Button><span className="text-xs">Page {page}</span><Button type="button" size="sm" variant="outline" disabled={loading || page * 25 >= total} onClick={choices.next}>Next</Button></div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  </div>;
}
