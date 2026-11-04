"use client";
import { useId, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Choice, Page } from "../onboarding-types";
import { useOnboardingRead } from "../hooks/useOnboarding";

export function OnboardingChoice({ label, resource, role = "EXPENSE", selected, disabled, onSelect }: {
  label: string; resource: string; role?: string; selected: Choice | null; disabled?: boolean; onSelect: (choice: Choice | null) => void;
}) {
  const id = useId(); const [open, setOpen] = useState(false);
  return <div className="min-w-0 space-y-2"><label id={`${id}-label`} className="text-sm font-medium">{label}</label>
    <Popover modal open={open} onOpenChange={setOpen}><PopoverTrigger asChild>
      <Button type="button" variant="outline" role="combobox" aria-labelledby={`${id}-label`} aria-expanded={open} disabled={disabled} className="w-full min-w-0 justify-between font-normal">
        <span className="truncate">{selected ? `${selected.code} · ${selected.name}` : `Select ${label.toLowerCase()}`}</span><ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
      </Button></PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
        {open && <Choices label={label} resource={resource} role={role} selected={selected} onSelect={value => { onSelect(value); setOpen(false); }} />}
      </PopoverContent>
    </Popover>{selected?.reason && <p className="text-xs text-amber-800">{selected.reason}</p>}</div>;
}
function Choices({ label, resource, role, selected, onSelect }: { label: string; resource: string; role: string; selected: Choice | null; onSelect: (choice: Choice | null) => void }) {
  const [search, setSearch] = useState(""); const [page, setPage] = useState(1);
  const params = new URLSearchParams({ search, page: String(page), pageSize: "25", role });
  const { data, loading, error, refresh } = useOnboardingRead<Page<Choice>>(`lookups/${resource}?${params}`, 250);
  return <Command shouldFilter={false} className="h-auto max-h-[var(--radix-popover-content-available-height)] [&_[data-slot=command-input-wrapper]]:shrink-0"><CommandInput aria-label={`Search ${label}`} placeholder="Search by code or name..." value={search} onValueChange={value => { setSearch(value); setPage(1); }} />
    <CommandList aria-busy={loading} className="min-h-0 max-h-64 overflow-y-auto overscroll-contain"><CommandEmpty>{loading ? "Loading choices..." : error?.message || "No matching choices."}</CommandEmpty><CommandGroup>
      {!loading && !error && data?.items.map(choice => <CommandItem key={choice.id} value={String(choice.id)} disabled={!choice.eligible} onSelect={() => onSelect(choice)}>
        <Check className={`mr-2 size-4 shrink-0 ${selected?.id === choice.id ? "opacity-100" : "opacity-0"}`} /><span className="min-w-0 whitespace-normal break-words">{choice.code} · {choice.name}<small className="block text-muted-foreground">{choice.reason || [resource === "accounts" ? choice.status : "", choice.classification].filter(Boolean).join(" · ")}</small></span>
      </CommandItem>)}
    </CommandGroup></CommandList>
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t p-2"><Button type="button" size="sm" variant="ghost" onClick={() => onSelect(null)}>Clear selection</Button>
      {error ? <Button type="button" size="sm" variant="outline" onClick={refresh}>Retry choices</Button> : <>
        <Button type="button" aria-label="Previous choices" size="sm" variant="outline" disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Previous</Button>
        <span className="text-xs">Page {page}</span><Button type="button" aria-label="Next choices" size="sm" variant="outline" disabled={loading || !data || page * data.pageSize >= data.total} onClick={() => setPage(value => value + 1)}>Next</Button>
      </>}
    </div></Command>;
}
