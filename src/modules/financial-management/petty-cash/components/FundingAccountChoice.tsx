"use client";
import { useId, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useFundRead } from "../hooks/useFunds";
import type { Choice, Page } from "../onboarding-types";

export function FundingAccountChoice({ selected, disabled, onSelect }: { selected: Choice | null; disabled: boolean; onSelect: (choice: Choice | null) => void }) {
  const id = useId(), [open, setOpen] = useState(false);
  return <div className="min-w-0 space-y-2"><label id={id} className="text-sm font-medium">Funding cash / bank account</label>
    <Popover modal open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
      <Button type="button" variant="outline" role="combobox" aria-labelledby={id} aria-expanded={open} disabled={disabled} className="w-full min-w-0 justify-between font-normal">
        <span className="truncate">{selected ? `${selected.code} · ${selected.name}` : "Select funding cash / bank account"}</span><ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button></PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
        {open && <Choices selected={selected} onSelect={choice => { onSelect(choice); setOpen(false); }} />}
      </PopoverContent></Popover>
  </div>;
}
function Choices({ selected, onSelect }: { selected: Choice | null; onSelect: (choice: Choice | null) => void }) {
  const [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const params = new URLSearchParams({ search, page: String(page), pageSize: "25" });
  const read = useFundRead<Page<Choice>>(`onboarding-approval/funding-accounts?${params}`, 250);
  return <Command label="Search funding accounts" shouldFilter={false} className="h-auto max-h-[var(--radix-popover-content-available-height)] [&_[data-slot=command-input-wrapper]]:shrink-0">
    <CommandInput aria-label="Search funding accounts" placeholder="Search by code or name..." value={search} onValueChange={value => { setSearch(value); setPage(1); }} />
    <CommandList aria-busy={read.loading} className="min-h-0 max-h-64 overflow-y-auto overscroll-contain">
      <CommandEmpty>{read.loading ? "Loading accounts..." : read.error?.message || "No matching accounts."}</CommandEmpty><CommandGroup>
        {!read.loading && !read.error && read.data?.items.map(choice => <CommandItem key={choice.id} value={String(choice.id)} disabled={!choice.eligible} onSelect={() => onSelect(choice)}>
          <Check className={`mr-2 size-4 shrink-0 ${selected?.id === choice.id ? "opacity-100" : "opacity-0"}`} /><span className="min-w-0 whitespace-normal">{choice.code} · {choice.name}<small className="block text-muted-foreground">{choice.reason || `${choice.classification} · ${choice.status}`}</small></span>
        </CommandItem>)}
      </CommandGroup></CommandList>
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t p-2"><Button type="button" size="sm" variant="ghost" onClick={() => onSelect(null)}>Clear selection</Button>
      {read.error ? <Button type="button" size="sm" variant="outline" onClick={read.refresh}>Retry choices</Button> : <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
        <Button type="button" aria-label="Previous accounts" size="sm" variant="outline" disabled={read.loading || page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span className="text-xs">Page {page}</span>
        <Button type="button" aria-label="Next accounts" size="sm" variant="outline" disabled={read.loading || !read.data || page * read.data.pageSize >= read.data.total} onClick={() => setPage(value => value + 1)}>Next</Button>
      </div>}
    </div>
  </Command>;
}
