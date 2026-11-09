"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { searchBankReconciliationReferences } from "../providers/bankReconciliationReferencesApi";
import type { BankReconciliationReferenceResource, BankReconciliationReferences } from "../reference-types";

type Reference = BankReconciliationReferences[BankReconciliationReferenceResource];
export function referenceLabel(item: Reference) {
  return "bankName" in item ? `${item.bankName} · ${item.branch} · ${item.maskedAccountNumber || "Account number unavailable"}` : `${item.code} · ${item.name}`;
}

export function ReferenceChoice({ label, resource, selected, onSelect, disabled, companyId, bankGroup, currentAssets, onAdd }: {
  label: string; resource: BankReconciliationReferenceResource; selected: Reference | null;
  onSelect: (item: Reference) => void; disabled?: boolean; companyId?: number; bankGroup?: string;
  currentAssets?: boolean; onAdd?: () => void;
}) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const [items, setItems] = useState<Reference[]>([]), [total, setTotal] = useState(0), [loading, setLoading] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      searchBankReconciliationReferences(resource, { search, page, pageSize: 25, companyId }, controller.signal)
        .then(data => { setItems(data.items); setTotal(data.total); })
        .catch(e => { if (e.name !== "AbortError") setError(e.message); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, search, page, resource, companyId]);
  return <div className="min-w-0 space-y-2"><label className="text-sm font-medium">{label}</label>
    <Popover open={open} onOpenChange={value => { setOpen(value); if (value) { setSearch(""); setPage(1); } }} modal>
      <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open} disabled={disabled} className="w-full min-w-0 justify-between font-normal">
        <span className="truncate">{selected ? referenceLabel(selected) : `Select ${label.toLowerCase()}`}</span><ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button></PopoverTrigger>
      <PopoverContent align="start" className="w-[max(22rem,var(--radix-popover-trigger-width))] max-w-[calc(100vw-2rem)] p-0">
        <Command shouldFilter={false}><CommandInput aria-label={`Search ${label}`} placeholder="Search by code, name, or branch..." value={search} onValueChange={value => { setSearch(value); setPage(1); }} />
          <CommandList className="max-h-64 overflow-y-auto overscroll-contain"><CommandEmpty>{loading ? "Loading choices..." : error || "No matching choices."}</CommandEmpty>
            {!loading && !error && <CommandGroup>{items.filter(item => !bankGroup || !("bankName" in item) || `${item.bankName} · ${item.branch}` === bankGroup).map(item => {
              const unsuitable = currentAssets && "classification" in item && item.classification !== "BS / CURRENT ASSETS";
              return <CommandItem key={item.id} value={String(item.id)} disabled={Boolean(unsuitable)} onSelect={() => { onSelect(item); setOpen(false); }}>
                <Check className={`mr-2 size-4 shrink-0 ${selected?.id === item.id ? "opacity-100" : "opacity-0"}`} />
                <span className="min-w-0 whitespace-normal break-words">{referenceLabel(item)}{"classification" in item && <small className="block text-muted-foreground">{item.status} · {item.classification}{unsuitable ? " · Select a Current Assets account" : ""}</small>}</span>
              </CommandItem>;
            })}</CommandGroup>}
          </CommandList>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t p-2">
            {onAdd && <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); onAdd(); }}>Add new…</Button>}
            <div className="flex shrink-0 items-center gap-2 whitespace-nowrap"><Button type="button" size="sm" variant="outline" disabled={loading || page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button><span className="text-xs">Page {page}</span><Button type="button" size="sm" variant="outline" disabled={loading || page * 25 >= total} onClick={() => setPage(p => p + 1)}>Next</Button></div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  </div>;
}
