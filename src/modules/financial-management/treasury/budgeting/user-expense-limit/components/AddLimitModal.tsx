// src/modules/user-expense-limit/components/AddLimitModal.tsx

"use client";

import { useState, useMemo, useRef } from "react";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Label }    from "@/components/ui/label";
import { X, Loader2, Plus, Search, ChevronDown, Check } from "lucide-react";
import { useCreateLimit, useUsersWithoutLimit } from "../hooks/useUserExpenseLimit";
import type { CreateLimitPayload } from "../types";
import { getFullName } from "../utils";

// ─── Searchable user select ───────────────────────────────────────────────────
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
        className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-xs ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
      >
        <span className={selected ? "text-foreground" : "text-muted-foreground"}>
          {loading ? "Loading users…" : (selected?.label ?? "Select user…")}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(""); }} />
          <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
            <div className="flex items-center border-b border-border px-3 py-2 gap-2">
              <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name or email…"
                className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground text-foreground"
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
                    <Check className={`h-3.5 w-3.5 shrink-0 ${value === o.value ? "opacity-100" : "opacity-0"}`} />
                    <div>
                      <p className="text-xs font-medium">{o.label}</p>
                      <p className="text-[11px] text-muted-foreground">{o.sub}</p>
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

// ─── Modal ────────────────────────────────────────────────────────────────────
interface AddLimitModalProps {
  onClose:   () => void;
  onSuccess: (message: string) => void;
}

export function AddLimitModal({ onClose, onSuccess }: AddLimitModalProps) {
  const { submit, loading, error } = useCreateLimit();
  const { users, loading: usersLoading } = useUsersWithoutLimit();
  const [userId, setUserId] = useState("");

  const userOptions = useMemo(() =>
    users.map(u => ({
      value: String(u.user_id),
      label: getFullName(u),
      sub:   u.user_email ?? "",
    })),
    [users]
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: CreateLimitPayload = {
      user_id:       Number(userId),
      expense_limit: parseFloat(fd.get("expense_limit") as string),
    };
    const result = await submit(payload);
    if (result.success) {
      onSuccess(result.message ?? "Expense limit created.");
      onClose();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto w-full max-w-md bg-background rounded-xl border border-border shadow-2xl">

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-5 border-b border-border">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Add Expense Limit</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Set a spending ceiling for a user</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-5 space-y-4">

              {/* User */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  User <span className="text-destructive">*</span>
                </Label>
                <SearchableUserSelect
                  loading={usersLoading}
                  options={userOptions}
                  value={userId}
                  onChange={setUserId}
                />
                <p className="text-[11px] text-muted-foreground">
                  Only users without an existing limit are shown.
                </p>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  Amount Limit <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">₱</span>
                  <Input
                    type="number"
                    name="expense_limit"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    required
                    className="h-9 text-xs pl-7"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                  <X className="h-3.5 w-3.5 shrink-0" /> {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-border bg-muted/30 flex justify-end gap-2 rounded-b-xl">
              <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-9 px-4 text-xs">
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading || !userId} className="h-9 px-4 text-xs gap-1.5">
                {loading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                  : <><Plus className="h-3.5 w-3.5" /> Add Limit</>
                }
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}