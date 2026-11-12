"use client";

import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { useAuditHistory } from "../hooks/useAuditHistory";

export function AuditHistoryFilters({ report }: { report: ReturnType<typeof useAuditHistory> }) {
  const [open, setOpen] = useState(false), { filters, options } = report;
  const actor = options.actors.find(actor => String(actor.id) === filters.actorId);
  const action = options.actions.find(action => action.code === filters.action);
  return <div className="space-y-3">
    <div role="group" aria-label="Audit filters" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <div className="min-w-0 space-y-2"><label htmlFor="audit-search" className="text-sm font-medium">Reference or JE</label><Input id="audit-search" type="search" maxLength={200} value={filters.search} onChange={e => report.change({ search: e.target.value })} placeholder="Search activity references" /></div>
      <div className="min-w-0 space-y-2"><label htmlFor="audit-action" className="text-sm font-medium">Action</label><select id="audit-action" value={filters.action} onChange={e => report.change({ action: e.target.value })} className="h-9 w-full min-w-0 rounded-md border bg-background px-3 text-sm"><option value="">All actions</option>{options.actions.map(action => <option key={action.code} value={action.code}>{action.label}</option>)}</select></div>
      <div className="min-w-0 space-y-2"><label className="text-sm font-medium">User</label><Popover open={open} onOpenChange={setOpen} modal><PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" aria-label="Audit user" aria-expanded={open} title={actor?.name} className="w-full min-w-0 justify-between font-normal"><span className="truncate">{actor?.name || (filters.actorId ? `User #${filters.actorId}` : "All users")}</span><ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" /></Button></PopoverTrigger><PopoverContent align="start" className="w-[max(18rem,var(--radix-popover-trigger-width))] max-w-[calc(100vw-2rem)] p-0"><Command label="Search audit users"><CommandInput aria-label="Search audit users" placeholder="Search users in this history..." /><CommandList><CommandEmpty>No matching users.</CommandEmpty><CommandGroup>{[{ id: "", name: "All users" }, ...options.actors.map(actor => ({ id: String(actor.id), name: actor.name }))].map(actor => <CommandItem key={actor.id} value={`${actor.id} ${actor.name}`} onSelect={() => { report.change({ actorId: actor.id }); setOpen(false); }}><Check className={`mr-2 size-4 shrink-0 ${filters.actorId === actor.id ? "opacity-100" : "opacity-0"}`} /><span className="whitespace-normal break-words">{actor.name}</span></CommandItem>)}</CommandGroup></CommandList></Command></PopoverContent></Popover></div>
      {(["fromDate", "toDate"] as const).map(field => <div key={field} className="min-w-0 space-y-2"><label htmlFor={`audit-${field}`} className="text-sm font-medium">{field === "fromDate" ? "From date (PHT)" : "To date (PHT)"}</label><Input id={`audit-${field}`} type="date" min="0001-01-01" max="9999-12-31" value={filters[field]} aria-invalid={Boolean(report.validation)} aria-describedby={report.validation ? "audit-date-error" : undefined} onChange={e => report.changeDate(field, e.target.value, e.target.validity.badInput)} onInput={e => { if (!e.currentTarget.value) report.changeDate(field, "", e.currentTarget.validity.badInput); }} /></div>)}
    </div>
    {report.validation && <p id="audit-date-error" role="alert" className="text-sm text-destructive">{report.validation}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="break-words text-sm text-muted-foreground">{report.active ? `Filters: ${[filters.search.trim() && `“${filters.search.trim()}”`, filters.action && (action?.label || filters.action), filters.actorId && (actor?.name || `User #${filters.actorId}`), filters.fromDate && `from ${filters.fromDate} PHT`, filters.toDate && `through ${filters.toDate} PHT`].filter(Boolean).join(" · ")}` : "All activity in this history"}</p><Button type="button" variant="outline" disabled={!report.active} onClick={report.clear}>Clear audit filters</Button></div>
  </div>;
}
