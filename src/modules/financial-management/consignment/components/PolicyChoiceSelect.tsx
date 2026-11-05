"use client";

import { useEffect, useId, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getPolicyChoices } from "../providers/policies.api";
import type { PolicyChoice, PolicyChoices } from "../policy-types";

export function PolicyChoiceSelect({ label, kind, selected, disabled, error, onSelect }: { label: string; kind: "branches" | "accounts"; selected: PolicyChoice | null; disabled: boolean; error?: string; onSelect: (choice: PolicyChoice | null) => void }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data: PolicyChoices | null; error: string | null } | null>(null);
  const key = JSON.stringify([kind, search, page, revision]);
  const loading = open && result?.key !== key;
  const data = result?.key === key ? result.data : null;
  const failure = result?.key === key ? result.error : null;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => {
      getPolicyChoices(kind, search.trim(), page, controller.signal)
        .then(data => { if (active) setResult({ key, data, error: null }); })
        .catch(cause => { if (active) setResult({ key, data: null, error: cause instanceof Error ? cause.message : "Unable to load choices." }); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [open, kind, search, page, key]);

  return <div className="min-w-0 space-y-2">
    <label id={`${id}-label`} htmlFor={id} className="font-medium">{label}</label>
    <Popover open={open && !disabled} onOpenChange={value => {
      setOpen(value);
      if (value) { setSearch(""); setPage(1); setRevision(current => current + 1); }
    }}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-labelledby={`${id}-label`} aria-expanded={open && !disabled} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} disabled={disabled} className="w-full min-w-0 justify-between font-normal">
          <span className="truncate">{selected ? selected.name : `Select ${label.toLowerCase()}`}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
        <Command shouldFilter={false}>
          <CommandInput aria-label={`Search ${label}`} placeholder="Search by code or name..." value={search} onValueChange={value => { setSearch(value); setPage(1); }} />
          <CommandList aria-busy={loading} className="max-h-64 overflow-y-auto">
            <CommandEmpty>{loading ? "Loading choices..." : failure || "No matching choices."}</CommandEmpty>
            <CommandGroup>
              {!loading && !failure && data?.items.map(choice => <CommandItem key={choice.id} value={String(choice.id)} onSelect={() => { onSelect(choice); setOpen(false); }}>
                <Check aria-hidden className={`size-4 shrink-0 ${selected?.id === choice.id ? "opacity-100" : "opacity-0"}`} />
                <span className="min-w-0 whitespace-normal break-words"><span className="block">{choice.name}</span><span className="text-xs text-muted-foreground">{choice.code} | #{choice.id} | {choice.status}</span></span>
              </CommandItem>)}
            </CommandGroup>
          </CommandList>
        </Command>
        {failure && <div role="alert" className="border-t p-2"><Button type="button" variant="outline" onClick={() => setRevision(current => current + 1)}>Retry choices</Button></div>}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t p-2 text-xs">
          <Button type="button" size="sm" variant="ghost" onClick={() => { onSelect(null); setOpen(false); }}>Clear selection</Button>
          <span>Page {page}</span>
          <div className="flex gap-1">
            <Button type="button" size="sm" variant="outline" disabled={loading || page <= 1} onClick={() => setPage(current => current - 1)}>Previous choices</Button>
            <Button type="button" size="sm" variant="outline" disabled={loading || !data || page * data.pageSize >= data.total} onClick={() => setPage(current => current + 1)}>Next choices</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
    {selected?.reason && <p className="text-sm text-amber-800">{selected.reason}</p>}
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
