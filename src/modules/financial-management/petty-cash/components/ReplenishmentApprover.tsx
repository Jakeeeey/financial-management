"use client";
import { useId, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Choice, Page } from "../onboarding-types";
import { useReplenishmentRead } from "../hooks/useReplenishment";
export function ReplenishmentApprover({ selected, disabled, onSelect }: { selected: Choice | null; disabled?: boolean; onSelect: (choice: Choice | null) => void }) {
  const id = useId(), [open, setOpen] = useState(false), [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const result = useReplenishmentRead<Page<Choice>>(open ? `approvers?${new URLSearchParams({ search, page: String(page), pageSize: "25" })}` : null, 250);
  return <div className="min-w-0 space-y-2"><label id={id} className="text-sm font-medium">Approver</label><Popover modal open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
    <Button type="button" variant="outline" role="combobox" aria-labelledby={id} aria-expanded={open} disabled={disabled} className="w-full min-w-0 justify-between font-normal"><span className="truncate">{selected?.name || "Select approver"}</span><ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" /></Button>
  </PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-72 max-w-[calc(100vw-2rem)] p-0"><Command shouldFilter={false}><CommandInput aria-label="Search approvers" placeholder="Search by code or name..." value={search} onValueChange={value => { setSearch(value); setPage(1); }} />
    <CommandList className="max-h-64 overflow-y-auto overscroll-contain"><CommandEmpty>{result.loading ? "Loading choices..." : result.error?.message || "No matching choices."}</CommandEmpty><CommandGroup>{result.data?.items.map(choice => <CommandItem key={choice.id} value={String(choice.id)} onSelect={() => { onSelect(choice); setOpen(false); }}><Check className={`mr-2 size-4 ${selected?.id === choice.id ? "opacity-100" : "opacity-0"}`} /><span className="whitespace-normal">{choice.code} · {choice.name}</span></CommandItem>)}</CommandGroup></CommandList>
    <div className="flex flex-wrap items-center gap-2 border-t p-2"><Button size="sm" variant="ghost" onClick={() => { onSelect(null); setOpen(false); }}>Clear selection</Button>{result.error ? <Button size="sm" variant="outline" onClick={result.refresh}>Retry choices</Button> : <div className="flex shrink-0 items-center gap-2 whitespace-nowrap"><Button size="sm" variant="outline" disabled={result.loading || page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span className="text-xs">Page {page}</span><Button size="sm" variant="outline" disabled={result.loading || !result.data || page * result.data.pageSize >= result.data.total} onClick={() => setPage(value => value + 1)}>Next</Button></div>}</div>
  </Command></PopoverContent></Popover></div>;
}
