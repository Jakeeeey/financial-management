"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContentInDialog, PopoverTrigger } from "@/components/ui/popover";
import { agreementConsignees } from "../providers/agreements.api";
import type { AgreementConsignee, AgreementConsigneePage } from "../agreement-types";

export function AgreementConsigneeSelect({ selected, onSelect, disabled, invalid }: {
  selected: AgreementConsignee | null; onSelect: (option: AgreementConsignee) => void; disabled: boolean; invalid: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; data: AgreementConsigneePage | null; error: string | null } | null>(null);
  const key = JSON.stringify([search, page, revision]);
  const loading = open && result?.key !== key;
  const data = result?.key === key ? result.data : null;
  const error = result?.key === key ? result.error : null;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let active = true;
    const timer = window.setTimeout(() => {
      agreementConsignees(search.trim(), page, controller.signal).then(data => { if (active) setResult({ key, data, error: null }); })
        .catch(error => { if (active) setResult({ key, data: null, error: error instanceof Error ? error.message : "Unable to load Active consignees." }); });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [open, search, page, key]);
  return <Popover open={open} onOpenChange={value => { setOpen(value); if (value) { setSearch(""); setPage(1); setRevision(value => value + 1); } }}>
    <PopoverTrigger asChild><Button id="agreement-consigneeId" type="button" variant="outline" role="combobox" aria-expanded={open} aria-required aria-invalid={invalid} aria-describedby={invalid ? "agreement-consigneeId-error" : undefined} disabled={disabled} className="w-full min-w-0 justify-start">
      <span className="truncate">{selected ? `${selected.name} (${selected.code})` : "Choose an Active consignee"}</span>
    </Button></PopoverTrigger>
    <PopoverContentInDialog align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
      <Command shouldFilter={false}>
        <CommandInput placeholder="Search Active consignees by code or name" value={search} onValueChange={value => { setSearch(value); setPage(1); }} />
        <CommandList aria-busy={loading}>
          <CommandEmpty>{loading ? "Loading Active consignees…" : error || "No Active consignees match. An Active consignee is required before saving an agreement."}</CommandEmpty>
          <CommandGroup>{!loading && data?.items.map(option => <CommandItem key={option.id} value={option.id} onSelect={() => { onSelect(option); setOpen(false); }}>
            <span className="min-w-0"><span className="block truncate">{option.name}</span><span className="text-xs text-muted-foreground">{option.code}</span></span>
          </CommandItem>)}</CommandGroup>
        </CommandList>
      </Command>
      {error && <div role="alert" className="border-t p-2"><Button type="button" variant="outline" onClick={() => setRevision(value => value + 1)}>Retry consignee choices</Button></div>}
      {data && <div className="flex items-center justify-between gap-2 border-t p-2 text-xs"><span>{data.total} Active consignees · Page {data.page}</span><div className="flex gap-1">
        <Button type="button" size="sm" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Previous choices</Button>
        <Button type="button" size="sm" variant="outline" disabled={page * data.pageSize >= data.total || loading} onClick={() => setPage(value => value + 1)}>Next choices</Button>
      </div></div>}
    </PopoverContentInDialog>
  </Popover>;
}
