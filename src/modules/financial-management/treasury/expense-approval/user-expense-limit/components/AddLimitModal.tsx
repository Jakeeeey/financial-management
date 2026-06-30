// src/modules/financial-management/treasury/expense-approval/user-expense-limit/components/AddLimitModal.tsx

"use client";

import { useState, useMemo, useRef } from "react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { Badge }    from "@/components/ui/badge";
import { X, Loader2, Plus, Search, ChevronDown, Check, Trash2 } from "lucide-react";
import { useCreateLimit, useUsersWithoutLimit, useCoas } from "../hooks/useUserExpenseLimit";
import type { CreateLimitPayload, Coa } from "../types";
import { getFullName, BUDGET_COAS } from "../utils";
import { getCoaConfig } from "./LimitTable";

// ─── Searchable select for Users ───────────────────────────────────────────────
interface SearchableUserSelectProps {
  loading:  boolean;
  options:  { value: string; label: string; sub: string }[];
  value:    string;
  onChange: (val: string) => void;
}

function SearchableUserSelect({ loading, options, value, onChange }: SearchableUserSelectProps) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState("");
  const inputRef            = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() =>
    search.trim()
      ? options.filter(o =>
          o.label.toLowerCase().includes(search.toLowerCase()) ||
          o.sub.toLowerCase().includes(search.toLowerCase())
        )
      : options,
    [options, search]
  );

  const selected = options.find(o => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(v => !v); setTimeout(() => inputRef.current?.focus(), 50); }}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 hover:bg-muted/30"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {loading ? "Loading users…" : (selected?.label ?? "Select user…")}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
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
                placeholder="Search name or email…"
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground font-medium"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")}>
                  <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              )}
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No users found.</p>
              ) : (
                filtered.map(o => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => { onChange(o.value); setOpen(false); setSearch(""); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground"
                  >
                    <Check className={`h-3.5 w-3.5 shrink-0 ${value === o.value ? "opacity-100 text-primary" : "opacity-0"}`} />
                    <div>
                      <p className="text-xs font-bold text-foreground">{o.label}</p>
                      <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{o.sub}</p>
                    </div>
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
interface AddLimitModalProps {
  onClose:   () => void;
  onSuccess: (message: string) => void;
}

export function AddLimitModal({ onClose, onSuccess }: AddLimitModalProps) {
  const { submit, loading, error } = useCreateLimit();
  const { users, loading: usersLoading } = useUsersWithoutLimit();
  const { coas, loading: coasLoading } = useCoas();
  
  const [userId, setUserId] = useState("");
  const [customCoas, setCustomCoas] = useState<Coa[]>([]);
  const [limitsState, setLimitsState] = useState<Record<number, string>>(() => {
    const init: Record<number, string> = {};
    BUDGET_COAS.forEach(coa => {
      init[coa.id] = "";
    });
    return init;
  });

  const userOptions = useMemo(() =>
    users.map(u => ({
      value: String(u.user_id),
      label: getFullName(u),
      sub:   u.user_department_name ? `${u.user_email || ""} (${u.user_department_name})` : u.user_email ?? "",
    })),
    [users]
  );

  const excludeCoaIds = useMemo(() => {
    const ids = new Set(BUDGET_COAS.map(c => c.id));
    customCoas.forEach(c => ids.add(c.coa_id));
    return ids;
  }, [customCoas]);

  const handleLimitChange = (coaId: number, val: string) => {
    setLimitsState(prev => ({ ...prev, [coaId]: val }));
  };

  const handleAddCustomCoa = (coa: Coa) => {
    setCustomCoas(prev => [...prev, coa]);
    setLimitsState(prev => ({ ...prev, [coa.coa_id]: "" }));
  };

  const handleRemoveCustomCoa = (coaId: number) => {
    setCustomCoas(prev => prev.filter(c => c.coa_id !== coaId));
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

    const payload: CreateLimitPayload = {
      user_id:       Number(userId),
      limits,
      remarks:       (new FormData(e.currentTarget).get("remarks") as string) || "",
    };
    
    const result = await submit(payload);
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
              <h2 className="text-base font-black tracking-tight text-foreground/90">Add Expense Limit</h2>
              <p className="text-xs text-muted-foreground/80 mt-1 font-semibold">Propose spending ceilings for a user per Chart of Accounts</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1">
            <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 bg-background/50">

              {/* User */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground/80">
                  Select User <span className="text-destructive">*</span>
                </Label>
                <SearchableUserSelect
                  loading={usersLoading}
                  options={userOptions}
                  value={userId}
                  onChange={setUserId}
                />
                <p className="text-[10px] text-muted-foreground/75 font-semibold">
                  Only users without active limits or pending proposals are shown.
                </p>
              </div>

              {/* COA Ceilings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border pb-2.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                  <p className="text-xs font-black text-muted-foreground uppercase tracking-wider">Ceiling Limits Configuration</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Default COAs */}
                  {BUDGET_COAS.map(c => {
                    const config = getCoaConfig(c.id, c.name, c.glCode);
                    return (
                      <div key={c.id} className="relative p-4 rounded-xl border border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:border-border-hover hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 overflow-hidden">
                        <div className="absolute top-0 right-0 w-10 h-10 bg-gradient-to-br opacity-5 rounded-bl-full pointer-events-none ${config.accentColor}" />
                        
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
                            value={limitsState[c.id] ?? ""}
                            onChange={e => handleLimitChange(c.id, e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            required
                            className="h-9 text-xs pl-7 text-foreground font-black bg-background border-border/80 focus-visible:ring-primary rounded-lg shadow-inner"
                          />
                        </div>
                      </div>
                    );
                  })}

                  {/* Custom COAs */}
                  {customCoas.map(c => {
                    const config = getCoaConfig(c.coa_id, c.account_title, c.gl_code);
                    return (
                      <div key={c.coa_id} className="relative p-4 rounded-xl border border-dashed border-violet-500/35 bg-violet-500/[0.01] shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:border-violet-500/60 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-3 overflow-hidden">
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomCoa(c.coa_id)}
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
                            value={limitsState[c.coa_id] ?? ""}
                            onChange={e => handleLimitChange(c.coa_id, e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            required
                            className="h-9 text-xs pl-7 text-foreground font-black bg-background border-border/80 focus-visible:ring-primary rounded-lg shadow-inner"
                          />
                        </div>
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
                <Label className="text-xs font-bold text-foreground/80">Submitter Remarks</Label>
                <textarea
                  name="remarks"
                  rows={2}
                  placeholder="Reason for limit assignment / change..."
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
              <Button type="submit" size="sm" disabled={loading || !userId} className="h-9 px-4 text-xs font-bold rounded-xl gap-1.5 shadow-sm">
                {loading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Submitting…</>
                  : <><Plus className="h-3.5 w-3.5" /> Submit for Approval</>
                }
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}