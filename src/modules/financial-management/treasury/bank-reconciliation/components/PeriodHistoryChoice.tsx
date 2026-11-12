"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { getPeriodHistory, type PeriodHistory } from "../providers/bankReconciliationLifecycleApi";
import type { ReconciliationPeriod } from "../setup-types";
import { ChoiceListSkeleton } from "./BankReconciliationSkeletons";
import { BankAccountLabel } from "./BankAccountLabel";

export function PeriodHistoryChoice({ period, disabled, onSelect }: { period?: ReconciliationPeriod | null; disabled: boolean; onSelect: (id: number, closureId?: number) => Promise<void> }) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const [items, setItems] = useState<PeriodHistory[]>([]), [total, setTotal] = useState(0), [loading, setLoading] = useState(false), [error, setError] = useState("");
  const [selecting, setSelecting] = useState(false);
  const mounted = useRef(false), choosing = useRef(false), generation = useRef(0), request = useRef<AbortController | null>(null), debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelSearch = useCallback(() => { ++generation.current; request.current?.abort(); if (debounce.current) clearTimeout(debounce.current); }, []);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; cancelSearch(); }; }, [cancelSearch]);
  useEffect(() => {
    if (!open) return;
    const token = ++generation.current, controller = new AbortController(); request.current = controller;
    const owns = () => mounted.current && token === generation.current && !controller.signal.aborted;
    setLoading(true); setError(""); setItems([]); setTotal(0);
    const timer = setTimeout(() => {
      void getPeriodHistory(search, page, undefined, controller.signal).then(result => { if (owns()) { setItems(result.items); setTotal(result.total); } }).catch(e => { if (owns()) setError(e instanceof Error ? e.message : "Unable to load saved periods."); }).finally(() => { if (owns()) setLoading(false); });
    }, 200);
    debounce.current = timer;
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, search, page]);
  function changeOpen(value: boolean) {
    if (choosing.current || value && disabled) return;
    cancelSearch(); setItems([]); setTotal(0); setError(""); setLoading(value);
    if (value) setPage(1);
    setOpen(value);
  }
  function changeSearch(value: string, nextPage = 1) {
    if (disabled || choosing.current) return;
    cancelSearch(); setLoading(true); setItems([]); setTotal(0); setError(""); setSearch(value); setPage(nextPage);
  }
  async function choose(item: PeriodHistory) {
    if (disabled || loading || choosing.current || !open) return;
    const token = generation.current; choosing.current = true; setSelecting(true); setError("");
    try { await onSelect(item.id, item.closureId || undefined); if (mounted.current && token === generation.current) { cancelSearch(); setOpen(false); } }
    catch (e) { if (mounted.current && token === generation.current) setError(e instanceof Error ? e.message : "Unable to open this period."); }
    finally { choosing.current = false; if (mounted.current) setSelecting(false); }
  }
  return <Dialog open={open} onOpenChange={changeOpen}><DialogTrigger asChild><Button type="button" variant="outline" className="h-auto min-h-9 max-w-full whitespace-normal text-left" disabled={disabled || selecting}>Saved periods{period ? `: ${period.periodEnd || "Undated"}${period.status === "CLOSED" ? ` · revision ${period.lifecycle?.revision ?? "unavailable"}` : ""}` : ""}</Button></DialogTrigger>
    <DialogContent className="sm:max-w-2xl" showCloseButton={false}><DialogHeader><DialogTitle>Saved reconciliation periods</DialogTitle><DialogDescription>Open a working period or view a preserved closure revision. History includes inactive bank accounts.</DialogDescription></DialogHeader>
      <Input aria-label="Search saved periods" placeholder="Search bank, entity, date, or status" value={search} disabled={disabled || selecting} onChange={e => changeSearch(e.target.value)} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {selecting && <p role="status" className="text-sm text-muted-foreground">Opening period…</p>}
      <div className="max-h-80 space-y-2 overflow-y-auto" aria-busy={loading || selecting}>{loading ? <ChoiceListSkeleton label="Loading saved periods" rows={4} /> : items.length ? items.map(item => <button type="button" key={`${item.id}:${item.closureId || "current"}`} disabled={disabled || selecting} onClick={() => { void choose(item); }} className="w-full min-w-0 rounded-md border p-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"><span className="block break-words font-medium">{item.periodEnd || "Undated"} · {item.status === "OPEN" ? "Open" : `Closed · revision ${item.revision ?? "unavailable"}`} · {item.companyName || "Entity not set"}</span><span className="mt-1 block text-xs text-muted-foreground"><BankAccountLabel bank={item} /></span></button>) : !error && <p className="p-3 text-sm text-muted-foreground">No saved periods found.</p>}</div>
      <div className="flex items-center justify-end gap-3 text-xs"><Button type="button" size="sm" variant="outline" disabled={disabled || loading || selecting || page === 1} onClick={() => changeSearch(search, page - 1)}>Previous periods</Button><span>Page {page}{!loading && !error ? ` of ${Math.max(1, Math.ceil(total / 25))}` : ""}</span><Button type="button" size="sm" variant="outline" disabled={disabled || loading || selecting || page * 25 >= total} onClick={() => changeSearch(search, page + 1)}>Next periods</Button></div>
      <DialogClose disabled={selecting} className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none disabled:opacity-40"><XIcon className="size-4" /><span className="sr-only">Close</span></DialogClose>
    </DialogContent></Dialog>;
}
