// src/modules/financial-management/treasury/expense-approval/user-expense-limit/components/EditLimitModal.tsx

"use client";

import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { X, Loader2, Save, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useUpdateLimit, useCoas } from "../hooks/useUserExpenseLimit";
import type { UserExpenseLimit, UpdateLimitPayload, Coa } from "../types";
import { formatPeso, BUDGET_COAS } from "../utils";
import { getCoaConfig } from "./LimitTable";

// ─── Searchable select for COAs ────────────────────────────────────────────────
interface SearchableCoaSelectProps {
  loading:  boolean;
  options:  Coa[];
  onSelect: (coa: Coa) => void;
  excludeIds: Set<number>;
}

function SearchableCoaSelect({ loading, options, onSelect, excludeIds }: SearchableCoaSelectProps) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const inputRef            = useRef<HTMLInputElement>(null);

  const availableOptions = useMemo(() => 
    options.filter(o => !excludeIds.has(o.coa_id)),
    [options, excludeIds]
  );

  const filtered = useMemo(() =>
    search.trim()
      ? availableOptions.filter(o =>
          (o.account_title || "").toLowerCase().includes(search.toLowerCase()) ||
          String(o.gl_code || "").includes(search)
        )
      : availableOptions,
    [availableOptions, search]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex h-10 w-full items-center justify-center rounded-xl border border-dashed border-primary/45 hover:border-primary/80 bg-primary/5 hover:bg-primary/10 px-3 py-2.5 text-xs font-black text-primary transition-all focus:outline-none"
      >
        <span className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Custom Chart of Account
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
            <div className="flex items-center border-b border-border px-3 py-2 gap-2 bg-muted/20">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search account name or code…"
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground font-semibold"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")}>
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {loading ? (
                <p className="py-4 text-center text-xs text-muted-foreground">Loading accounts…</p>
              ) : filtered.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No accounts available.</p>
              ) : (
                filtered.map(o => (
                  <button
                    key={o.coa_id}
                    type="button"
                    onClick={() => { onSelect(o); setOpen(false); setSearch(""); }}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-accent hover:text-accent-foreground text-xs"
                  >
                    <div className="font-bold text-foreground">{o.account_title}</div>
                    <div className="text-[9px] text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded ml-2 shrink-0 font-bold">{o.gl_code}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────
interface EditLimitModalProps {
  limit:     UserExpenseLimit;
  onClose:   () => void;
  onSuccess: (message: string) => void;
}

export function EditLimitModal({ limit, onClose, onSuccess }: EditLimitModalProps) {
  const { submit, loading, error } = useUpdateLimit();
  const { coas, loading: coasLoading } = useCoas();

  const defaultCoaIds = useMemo(() => new Set(BUDGET_COAS.map(c => c.id)), []);
  const activeOrPendingLimits = useMemo(() => limit.pending_limits || limit.limits || {}, [limit.pending_limits, limit.limits]);

  const [customCoaIds, setCustomCoaIds] = useState<Set<number>>(() => {
    const ids = new Set<number>();
    Object.keys(activeOrPendingLimits).forEach(idStr => {
      const id = Number(idStr);
      if (!defaultCoaIds.has(id)) {
        ids.add(id);
      }
    });
    return ids;
  });

  const [limitsState, setLimitsState] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    // Pre-fill defaults
    BUDGET_COAS.forEach(coa => {
      init[coa.id] = activeOrPendingLimits[coa.id] || "";
    });
    // Pre-fill customs
    Object.entries(activeOrPendingLimits).forEach(([coaIdStr, val]) => {
      const coaId = Number(coaIdStr);
      if (!defaultCoaIds.has(coaId)) {
        init[coaId] = val;
      }
    });
    return init;
  });

  // Resolve custom COAs from the loaded database list
  const customCoas = useMemo(() => {
    return Array.from(customCoaIds)
      .map(id => coas.find(c => c.coa_id === id))
      .filter(Boolean) as Coa[];
  }, [customCoaIds, coas]);

  const excludeCoaIds = useMemo(() => {
    const ids = new Set(BUDGET_COAS.map(c => c.id));
    customCoaIds.forEach(id => ids.add(id));
    return ids;
  }, [customCoaIds]);

  const handleLimitChange = (coaId: number, val: string) => {
    setLimitsState(prev => ({ ...prev, [coaId]: val }));
  };

  const handleAddCustomCoa = (coa: Coa) => {
    setCustomCoaIds(prev => {
      const next = new Set(prev);
      next.add(coa.coa_id);
      return next;
    });
    setLimitsState(prev => ({ ...prev, [coa.coa_id]: "" }));
  };

  const handleRemoveCustomCoa = (coaId: number) => {
    setCustomCoaIds(prev => {
      const next = new Set(prev);
      next.delete(coaId);
      return next;
    });
    setLimitsState(prev => {
      const copy = { ...prev };
      delete copy[coaId];
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    const limits: Record<number, number> = {};
    
    // Default COAs
    BUDGET_COAS.forEach(coa => {
      limits[coa.id] = parseFloat(limitsState[coa.id]) || 0;
    });

    // Custom COAs
    customCoas.forEach(coa => {
      limits[coa.coa_id] = parseFloat(limitsState[coa.coa_id]) || 0;
    });

    const payload: UpdateLimitPayload = {
      limits,
      remarks: (new FormData(e.currentTarget).get("remarks") as string) || "",
    };

    const result = await submit(limit.user_id, payload);
    if (result.success) {
      onSuccess(result.message ?? "Expense limit proposal submitted.");
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none select-none">
        <div className="pointer-events-auto w-full max-w-lg bg-background rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-border shrink-0 bg-muted/20">
            <div>
              <h2 className="text-base font-black tracking-tight text-foreground/90">Edit Expense Limit</h2>
              <p className="text-xs text-muted-foreground/80 mt-1 font-semibold">
                Propose ceiling updates for <span className="font-extrabold text-foreground">{limit.user_name ?? `User #${limit.user_id}`}</span>
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 bg-background/50">

              {limit.pending_limits && (
                <div className="px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 font-bold flex items-start gap-2.5 shadow-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  <span>Note: There is an existing pending proposal. Editing will replace it.</span>
                </div>
              )}

              {/* User Details info card */}
              <div className="space-y-1 bg-muted/10 border border-border/60 rounded-xl p-3.5 flex justify-between items-center select-text">
                <div>
                  <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground/90 block">Department</span>
                  <span className="text-xs font-bold text-foreground mt-0.5 block">{limit.user_department ?? "—"}</span>
                </div>
                {limit.user_email && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-black tracking-wider text-muted-foreground/90 block">Email Address</span>
                    <span className="text-xs font-bold text-foreground mt-0.5 block">{limit.user_email}</span>
                  </div>
                )}
              </div>

              {/* COA Ceilings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Ceiling Limits Configuration</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Default COAs */}
                  {BUDGET_COAS.map(coa => {
                    const config = getCoaConfig(coa.id, coa.name, coa.glCode);
                    const activeVal = limit.limits ? (limit.limits[coa.id] || "0.00") : "0.00";
                    return (
                      <div key={coa.id} className="relative p-4 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-border-hover hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 overflow-hidden">
                        <div className="absolute top-0 right-0 w-10 h-10 bg-gradient-to-br opacity-5 rounded-bl-full pointer-events-none" />
                        
                        <div className="flex items-center gap-2.5">
                          <div className={`p-2 rounded-lg border shrink-0 ${config.colorClass}`}>
                            <config.icon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-foreground/95 block">{config.name}</span>
                            <span className="text-[9px] text-muted-foreground font-bold font-mono bg-muted/80 px-1 py-0.5 rounded leading-none">GL: {config.glCode}</span>
                          </div>
                        </div>
                        
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₱</span>
                          <Input
                            type="number"
                            value={limitsState[coa.id] ?? ""}
                            onChange={e => handleLimitChange(coa.id, e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            required
                            className="h-9 text-xs pl-7 text-foreground font-black bg-background border-border/80 focus-visible:ring-primary rounded-lg shadow-inner"
                          />
                        </div>
                        
                        {limit.limits && (
                          <div className="text-[9px] text-muted-foreground/80 font-bold border-t border-border/40 pt-2 flex justify-between items-center select-text">
                            <span>Current Active:</span>
                            <span className="font-black text-foreground/80">{formatPeso(activeVal)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Custom COAs */}
                  {customCoas.map(coa => {
                    const config = getCoaConfig(coa.coa_id, coa.account_title, coa.gl_code);
                    const activeVal = limit.limits ? (limit.limits[coa.coa_id] || "0.00") : "0.00";
                    return (
                      <div key={coa.coa_id} className="relative p-4 rounded-xl border border-dashed border-violet-500/35 bg-violet-500/[0.01] shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:border-violet-500/60 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomCoa(coa.coa_id)}
                          className="absolute right-2 top-2 text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 p-1 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        
                        <div className="flex items-center gap-2.5 pr-6">
                          <div className={`p-2 rounded-lg border shrink-0 ${config.colorClass}`}>
                            <config.icon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-foreground/95 block truncate max-w-[120px]">{config.name}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[9px] text-muted-foreground font-bold font-mono bg-muted/80 px-1 py-0.5 rounded leading-none">GL: {config.glCode}</span>
                              <Badge variant="outline" className="text-[8px] bg-purple-500/10 text-purple-600 border-none font-bold py-0 px-1 rounded leading-none h-3.5">Custom</Badge>
                            </div>
                          </div>
                        </div>
                        
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">₱</span>
                          <Input
                            type="number"
                            value={limitsState[coa.coa_id] ?? ""}
                            onChange={e => handleLimitChange(coa.coa_id, e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            required
                            className="h-9 text-xs pl-7 text-foreground font-black bg-background border-border/80 focus-visible:ring-primary rounded-lg shadow-inner"
                          />
                        </div>

                        {limit.limits && limit.limits[coa.coa_id] !== undefined && (
                          <div className="text-[9px] text-muted-foreground/80 font-bold border-t border-border/40 pt-2 flex justify-between items-center select-text">
                            <span>Current Active:</span>
                            <span className="font-black text-foreground/80">{formatPeso(activeVal)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Dropdown to add custom COAs */}
                <div className="pt-2">
                  <SearchableCoaSelect
                    loading={coasLoading}
                    options={coas}
                    onSelect={handleAddCustomCoa}
                    excludeIds={excludeCoaIds}
                  />
                </div>
              </div>

              {/* Remarks */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground/80">Remarks / Reason for Changes <span className="text-destructive">*</span></Label>
                <textarea
                  name="remarks"
                  rows={2}
                  placeholder="Provide a reason for changing the ceilings..."
                  required
                  className="flex w-full rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 resize-none text-foreground shadow-sm hover:border-border-hover transition-colors"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive shrink-0">
                  <X className="h-3.5 w-3.5 shrink-0" /> {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-muted/20 flex justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-9 px-4 text-xs font-semibold rounded-xl">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading} className="h-9 px-4 text-xs font-bold rounded-xl gap-1.5 shadow-sm">
                {loading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…</>
                  : <><Save className="h-3.5 w-3.5" /> Submit Updates</>
                }
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}