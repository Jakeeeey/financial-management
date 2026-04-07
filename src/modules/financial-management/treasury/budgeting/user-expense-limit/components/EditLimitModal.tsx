// src/modules/user-expense-limit/components/EditLimitModal.tsx

"use client";

import { Button } from "@/components/ui/button";
import { Input }  from "@/components/ui/input";
import { Label }  from "@/components/ui/label";
import { X, Loader2, Save } from "lucide-react";
import { useUpdateLimit } from "../hooks/useUserExpenseLimit";
import type { UserExpenseLimit, UpdateLimitPayload } from "../types";
import { formatPeso } from "../utils";

interface EditLimitModalProps {
  limit:     UserExpenseLimit;
  onClose:   () => void;
  onSuccess: (message: string) => void;
}

export function EditLimitModal({ limit, onClose, onSuccess }: EditLimitModalProps) {
  const { submit, loading, error } = useUpdateLimit();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload: UpdateLimitPayload = {
      expense_limit: parseFloat(fd.get("expense_limit") as string),
    };
    const result = await submit(limit.id, payload);
    if (result.success) {
      onSuccess(result.message ?? "Expense limit updated.");
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
              <h2 className="text-base font-semibold tracking-tight">Edit Expense Limit</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Updating limit for <span className="font-medium text-foreground">{limit.user_name ?? "—"}</span>
              </p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 -mt-1 -mr-2" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-5 space-y-4">

              {/* Current amount info */}
              <div className="flex items-center justify-between px-3 py-2.5 rounded-md bg-muted/50 border border-border">
                <span className="text-xs text-muted-foreground">Current limit</span>
                <span className="text-xs font-semibold text-foreground">
                  {formatPeso(limit.expense_limit)}
                </span>
              </div>

              {/* New amount */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">
                  New Amount Limit <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">₱</span>
                  <Input
                    type="number"
                    name="expense_limit"
                    min="0.01"
                    step="0.01"
                    defaultValue={limit.expense_limit}
                    required
                    autoFocus
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
              <Button type="submit" size="sm" disabled={loading} className="h-9 px-4 text-xs gap-1.5">
                {loading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                  : <><Save className="h-3.5 w-3.5" /> Save Changes</>
                }
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}