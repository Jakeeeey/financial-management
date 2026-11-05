"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Plus, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchPayableCoas,
  saveBudgetAllocations,
  type BudgetAllocationInput,
  type PayableCoaOption,
} from "../services/logisticsWerApi";
import type { LogisticsWerBudgetLine } from "../types";
import { WerCoaCombobox } from "./WerCoaCombobox";

interface BudgetDraft {
  key: string;
  coaId: string;
  amount: string;
  remarks: string;
}

interface BudgetAllocationEditorProps {
  planId: number;
  budgetLines: LogisticsWerBudgetLine[];
  disabled: boolean;
  onSaved: () => Promise<void> | void;
}

function mergeRemarks(existing: string, incoming: string): string {
  return Array.from(new Set([existing, incoming].map((value) => value.trim()).filter(Boolean))).join("; ");
}

function initialDrafts(lines: LogisticsWerBudgetLine[]): BudgetDraft[] {
  const drafts: BudgetDraft[] = [];
  const classified = new Map<number, BudgetDraft>();
  for (const line of lines) {
    if (line.coaId) {
      const current = classified.get(line.coaId);
      if (current) {
        current.amount = String((Math.round(Number(current.amount) * 100) + Math.round(line.amount * 100)) / 100);
        current.remarks = mergeRemarks(current.remarks, line.remarks || "");
      } else {
        const draft = {
          key: `coa-${line.coaId}`,
          coaId: String(line.coaId),
          amount: String(line.amount),
          remarks: line.remarks || "",
        };
        classified.set(line.coaId, draft);
        drafts.push(draft);
      }
    } else {
      drafts.push({
        key: `unclassified-${line.id}`,
        coaId: "",
        amount: String(line.amount),
        remarks: line.remarks || "",
      });
    }
  }
  return drafts;
}

export function BudgetAllocationEditor({ planId, budgetLines, disabled, onSaved }: BudgetAllocationEditorProps) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<BudgetDraft[]>([]);
  const [options, setOptions] = useState<PayableCoaOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || options.length > 0) return;
    let active = true;
    setLoadingOptions(true);
    fetchPayableCoas()
      .then((loaded) => {
        if (active) setOptions(loaded);
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load chart-of-accounts options.");
      })
      .finally(() => {
        if (active) setLoadingOptions(false);
      });
    return () => {
      active = false;
    };
  }, [open, options.length]);

  function onOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setDrafts(initialDrafts(budgetLines));
      setError(null);
    }
    setOpen(nextOpen);
  }

  function updateDraft(key: string, changes: Partial<BudgetDraft>) {
    setDrafts((current) => current.map((draft) => draft.key === key ? { ...draft, ...changes } : draft));
  }

  async function save() {
    const budgets: BudgetAllocationInput[] = [];
    const coaIds = new Set<number>();
    for (const [index, draft] of drafts.entries()) {
      const coaId = Number(draft.coaId);
      const amount = Number(draft.amount);
      if (!Number.isInteger(coaId) || coaId <= 0) {
        setError(`Choose an expense account for allocation ${index + 1}.`);
        return;
      }
      if (!Number.isFinite(amount) || amount <= 0 || Math.abs(amount * 100 - Math.round(amount * 100)) > 0.000001) {
        setError(`Allocation ${index + 1} must be greater than zero and use no more than two decimal places.`);
        return;
      }
      if (!draft.remarks.trim()) {
        setError(`Enter a purpose for allocation ${index + 1}.`);
        return;
      }
      if (coaIds.has(coaId)) {
        setError("Each expense account can only have one allocation per dispatch plan.");
        return;
      }
      coaIds.add(coaId);
      budgets.push({ coaId, amount, remarks: draft.remarks.trim() });
    }

    setSaving(true);
    setError(null);
    try {
      await saveBudgetAllocations(planId, budgets);
      setOpen(false);
      await onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save expense budget allocations.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={disabled}>
          Manage expense budget
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] w-[min(96vw,56rem)] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manage expense budget</DialogTitle>
          <DialogDescription>
            Set the available allowance for each expense account. These allocations are separate from the dispatch plan value.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {drafts.map((draft, index) => (
            <div key={draft.key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
              <div className="space-y-2">
                <Label htmlFor={`budget-coa-${draft.key}`}>Expense account</Label>
                <WerCoaCombobox
                  id={`budget-coa-${draft.key}`}
                  value={draft.coaId}
                  options={options}
                  onValueChange={(value) => updateDraft(draft.key, { coaId: value })}
                  disabled={saving || loadingOptions}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`budget-amount-${draft.key}`}>Allocated amount</Label>
                <Input
                  id={`budget-amount-${draft.key}`}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={draft.amount}
                  onChange={(event) => updateDraft(draft.key, { amount: event.target.value })}
                  disabled={saving}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="self-end"
                aria-label={`Remove allocation ${index + 1}`}
                onClick={() => setDrafts((current) => current.filter((item) => item.key !== draft.key))}
                disabled={saving}
              >
                <Trash2 className="size-4" />
              </Button>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor={`budget-purpose-${draft.key}`}>Budget purpose</Label>
                <Textarea
                  id={`budget-purpose-${draft.key}`}
                  value={draft.remarks}
                  onChange={(event) => updateDraft(draft.key, { remarks: event.target.value })}
                  placeholder="For example, fuel, tolls, or driver allowance"
                  maxLength={1000}
                  disabled={saving}
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => setDrafts((current) => [...current, {
              key: `new-${Date.now()}-${current.length}`,
              coaId: "",
              amount: "",
              remarks: "",
            }])}
            disabled={saving || loadingOptions}
          >
            <Plus className="mr-2 size-4" /> Add allocation
          </Button>

          {loadingOptions && <p className="text-xs text-muted-foreground">Loading expense accountsâ€¦</p>}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={() => void save()} disabled={saving || loadingOptions}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save expense budget
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
