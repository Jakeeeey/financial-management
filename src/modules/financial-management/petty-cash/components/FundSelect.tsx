"use client";
import { useId, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type FundOption = { id: number; docNo: string; name: string; custodian?: string; custodianName?: string };
const fundDetail = (fund: FundOption) => fund.custodianName || fund.custodian || "";
const fundLabel = (fund: FundOption) => `${fund.docNo} - ${fund.name}${fundDetail(fund) ? ` - ${fundDetail(fund)}` : ""}`;

export function FundSelect({ label = "Fund", funds, value, onChange, includeAll = false, disabled = false, error, size = "default" }: {
  label?: string;
  funds: FundOption[];
  value: number | null;
  onChange: (value: number | null) => void;
  includeAll?: boolean;
  disabled?: boolean;
  error?: string;
  size?: "sm" | "default";
}) {
  const id = useId(), errorId = error ? `${id}-error` : undefined, [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const selected = funds.find(fund => fund.id === value) || null;
  const normalized = search.trim().toLowerCase();
  const filtered = useMemo(() => funds.filter(fund => `${fund.docNo} ${fund.name} ${fundDetail(fund)}`.toLowerCase().includes(normalized)), [funds, normalized]);
  const showAll = includeAll && (!normalized || "all funds".includes(normalized));
  const text = selected ? fundLabel(selected) : includeAll && value === null ? "All funds" : "Select fund";
  return <div className="min-w-0 space-y-2"><label id={`${id}-label`} className="text-sm font-medium">{label}</label><Popover modal open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(""); }}><PopoverTrigger asChild>
    <Button type="button" variant="outline" role="combobox" aria-labelledby={`${id}-label`} aria-expanded={open} aria-invalid={Boolean(error)} aria-describedby={errorId} disabled={disabled} className={`w-full min-w-0 justify-between font-normal ${size === "sm" ? "h-9" : "h-10"}`}><span className="truncate">{text}</span><ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" /></Button>
  </PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0"><Command shouldFilter={false}><CommandInput aria-label={`Search ${label.toLowerCase()}`} placeholder="Search fund number, name, or custodian..." value={search} onValueChange={setSearch} /><CommandList className="max-h-72 overflow-y-auto overscroll-contain"><CommandEmpty>No matching funds.</CommandEmpty><CommandGroup>
    {showAll && <CommandItem value="ALL" onSelect={() => { onChange(null); setOpen(false); }}><Check className={`mr-2 size-4 shrink-0 ${value === null ? "opacity-100" : "opacity-0"}`} /><span>All funds</span></CommandItem>}
    {filtered.map(fund => <CommandItem key={fund.id} value={String(fund.id)} onSelect={() => { onChange(fund.id); setOpen(false); }}><Check className={`mr-2 size-4 shrink-0 ${value === fund.id ? "opacity-100" : "opacity-0"}`} /><span className="min-w-0 whitespace-normal break-words">{fundLabel(fund)}</span></CommandItem>)}
  </CommandGroup></CommandList></Command></PopoverContent></Popover>{error && <p id={errorId} className="text-xs font-medium text-destructive">{error}</p>}</div>;
}
