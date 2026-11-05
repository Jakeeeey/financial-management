"use client";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { useFundRead } from "../hooks/useFunds";
import { OnboardingError } from "../providers/onboarding.api";
import type { Choice, Page } from "../onboarding-types";
import type { CashCount } from "../master-types";
import { voucherMoney } from "../utils/voucherMoney";
import { OnboardingFeedback } from "./OnboardingCommon";
import { onboardingErrorTitle, onboardingFieldErrors } from "../utils/onboardingFeedback";
export function MasterError({ error, retry, title, showFields = true, action }: { error?: Error | null; retry?: () => void; title?: string; showFields?: boolean; action?: { label: string; onClick: () => void } }) {
  if (!error) return null;
  const requestId = error instanceof OnboardingError ? error.requestId : undefined;
  return <OnboardingFeedback tone="error" title={title || onboardingErrorTitle(error)} requestId={requestId} fields={showFields ? onboardingFieldErrors(error) : []} action={action ?? (retry ? { label: "Retry", onClick: retry } : undefined)}><p>{error.message}</p></OnboardingFeedback>;
}
export function MasterTable({ label, headers, children }: { label: string; headers: string[]; children: ReactNode }) { return <div className="overflow-x-auto rounded-lg border"><table aria-label={label} className="w-full text-left text-sm [&_th]:whitespace-nowrap [&_th]:p-3 [&_td]:p-3 [&_tr]:border-b [&_tbody_tr:last-child]:border-0"><thead className="bg-muted/30"><tr>{headers.map((header, i) => <th key={i}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
export function CountLabel({ count }: { count: CashCount | null }) { return count ? <span className={count.snapshot.variance !== "0.00" && !count.resolution ? "text-destructive" : "text-muted-foreground"}>{count.snapshot.variance === "0.00" ? "Balanced" : `${voucherMoney(count.snapshot.variance)} ${count.snapshot.variance.startsWith("-") ? "short" : "over"}`} · {count.recordedAt.slice(0, 10)}{count.resolution ? ` · cleared in ${count.resolution}` : ""}</span> : <span className="text-muted-foreground">Not counted</span>; }
export function MasterChoice({ label, path, selected, onSelect, disabled, exclude = [] }: { label: string; path: string; selected: Choice | null; onSelect: (value: Choice | null) => void; disabled?: boolean; exclude?: number[] }) {
  const [open, setOpen] = useState(false);
  return <div className="min-w-0 space-y-2"><span className="text-sm font-medium">{label}</span><Popover modal open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label={label} aria-expanded={open} disabled={disabled} className="w-full justify-between font-normal"><span className="truncate">{selected ? `${selected.code} · ${selected.name}` : `Select ${label.toLowerCase()}`}</span><span aria-hidden>⌄</span></Button></PopoverTrigger><PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">{open && <Choices label={label} path={path} exclude={exclude} onSelect={value => { onSelect(value); setOpen(false); }} />}</PopoverContent></Popover></div>;
}
function Choices({ label, path, exclude, onSelect }: { label: string; path: string; exclude: number[]; onSelect: (value: Choice | null) => void }) {
  const [search, setSearch] = useState(""), [page, setPage] = useState(1); const read = useFundRead<Page<Choice>>(`${path}?${new URLSearchParams({ search, page: String(page), pageSize: "25" })}`, 250);
  return <Command shouldFilter={false}><CommandInput aria-label={`Search ${label}`} value={search} onValueChange={value => { setSearch(value); setPage(1); }} placeholder="Search by code or name..." /><CommandList className="max-h-64 overflow-y-auto overscroll-contain"><CommandEmpty>{read.loading ? "Loading choices..." : read.error?.message || "No matching choices."}</CommandEmpty><CommandGroup>{read.data?.items.map(c => <CommandItem key={c.id} value={String(c.id)} disabled={!c.eligible || exclude.includes(c.id)} onSelect={() => onSelect(c)}><span className="whitespace-normal">{c.code} · {c.name}{c.reason && <small className="block">{c.reason}</small>}</span></CommandItem>)}</CommandGroup></CommandList><div className="flex flex-wrap items-center gap-2 border-t p-2"><Button type="button" size="sm" variant="ghost" onClick={() => onSelect(null)}>Clear selection</Button><div className="flex shrink-0 items-center gap-2 whitespace-nowrap"><Button type="button" size="sm" variant="outline" disabled={page === 1 || read.loading} onClick={() => setPage(p => p - 1)}>Previous</Button><span className="text-xs">Page {page}</span><Button type="button" size="sm" variant="outline" disabled={!read.data || page * 25 >= read.data.total || read.loading} onClick={() => setPage(p => p + 1)}>Next</Button></div>{read.error && <Button type="button" size="sm" onClick={read.refresh}>Retry choices</Button>}</div></Command>;
}
