"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getPeriodHistory, type PeriodHistory } from "../providers/bankReconciliationLifecycleApi";
import type { ReconciliationPeriod } from "../setup-types";

export function PeriodHistoryChoice({ period, disabled, onSelect }: { period?: ReconciliationPeriod | null; disabled: boolean; onSelect: (id: number, closureId?: number) => Promise<void> }) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const [items, setItems] = useState<PeriodHistory[]>([]), [total, setTotal] = useState(0), [loading, setLoading] = useState(false), [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true; setLoading(true); setError("");
    const timer = setTimeout(() => { getPeriodHistory(search, page).then(result => { if (active) { setItems(result.items); setTotal(result.total); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [open, search, page]);
  async function choose(item: PeriodHistory) {
    setLoading(true); setError("");
    try { await onSelect(item.id, item.closureId || undefined); setOpen(false); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to open this period."); }
    finally { setLoading(false); }
  }
  return <><Button type="button" variant="outline" disabled={disabled} onClick={() => { setPage(1); setOpen(true); }}>Saved periods{period ? `: ${period.periodEnd || "Undated"}${period.lifecycle?.revision ? ` · revision ${period.lifecycle.revision}` : ""}` : ""}</Button>
    <Dialog open={open} onOpenChange={value => { if (!loading) setOpen(value); }}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Saved reconciliation periods</DialogTitle><DialogDescription>Open a working period or view a preserved closure revision. History includes inactive bank accounts.</DialogDescription></DialogHeader>
      <Input aria-label="Search saved periods" placeholder="Search bank, entity, date, or status" value={search} disabled={disabled} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="max-h-80 space-y-2 overflow-y-auto" aria-busy={loading}>{loading ? <p className="p-3 text-sm text-muted-foreground">Loading periods…</p> : items.length ? items.map(item => <button type="button" key={`${item.id}:${item.closureId || "current"}`} disabled={disabled} onClick={() => { void choose(item); }} className="w-full rounded-md border p-3 text-left text-sm hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"><span className="block font-medium">{item.periodEnd || "Undated"} · {item.status === "OPEN" ? "Open" : `Closed · revision ${item.revision}`} · {item.companyName || "Entity not set"}</span><span className="mt-1 block text-xs text-muted-foreground">{item.bankName} · {item.branch} · {item.maskedAccountNumber}</span></button>) : <p className="p-3 text-sm text-muted-foreground">No saved periods found.</p>}</div>
      <div className="flex items-center justify-end gap-3 text-xs"><Button type="button" size="sm" variant="outline" disabled={loading || page === 1} onClick={() => setPage(p => p - 1)}>Previous periods</Button><span>Page {page} of {Math.max(1, Math.ceil(total / 25))}</span><Button type="button" size="sm" variant="outline" disabled={loading || page * 25 >= total} onClick={() => setPage(p => p + 1)}>Next periods</Button></div>
    </DialogContent></Dialog></>;
}
