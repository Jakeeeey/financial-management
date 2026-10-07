"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchPayableCoas, saveBudgetClassification, type PayableCoaOption } from "../services/logisticsWerApi";
import type { LogisticsWerBudgetLine } from "../types";
import { WerCoaCombobox } from "./WerCoaCombobox";

interface BudgetClassificationEditorProps {
  planId: number;
  line: LogisticsWerBudgetLine;
  disabled: boolean;
  onSaved: () => Promise<void> | void;
}

export function BudgetClassificationEditor({ planId, line, disabled, onSaved }: BudgetClassificationEditorProps) {
  const [open, setOpen] = useState(false);
  const [coaId, setCoaId] = useState("");
  const [remarks, setRemarks] = useState("");
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

  function openEditor(nextOpen: boolean) {
    if (nextOpen) {
      setCoaId(line.coaId ? String(line.coaId) : "");
      setRemarks(line.remarks || "");
      setError(null);
    }
    setOpen(nextOpen);
  }

  async function save() {
    const selectedCoaId = Number(coaId);
    if (!Number.isInteger(selectedCoaId) || selectedCoaId <= 0 || !remarks.trim()) {
      setError("Choose a chart-of-accounts entry and enter remarks.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await saveBudgetClassification(planId, line.id, { coaId: selectedCoaId, remarks: remarks.trim() });
      setOpen(false);
      await onSaved();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to save the budget classification.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={openEditor}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline" disabled={disabled}>
          {line.coaId && line.remarks?.trim() ? "Edit" : "Classify"}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[min(96vw,48rem)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Classify budget line</DialogTitle>
          <DialogDescription>
            Record the budget purpose and its planned expense account. This does not change WER payable lines.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-muted/20 p-3 text-sm">
            <span className="font-medium">Amount:</span> {line.amount.toLocaleString("en-PH", { style: "currency", currency: "PHP" })}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`budget-remarks-${line.id}`}>Remarks</Label>
            <Textarea
              id={`budget-remarks-${line.id}`}
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Describe the planned expense"
              maxLength={1000}
              disabled={saving}
            />
          </div>
          <div className="space-y-2">
            <Label>Chart of Accounts</Label>
            <WerCoaCombobox value={coaId} options={options} onValueChange={setCoaId} disabled={saving || loadingOptions} />
            {loadingOptions && <p className="text-xs text-muted-foreground">Loading accounts…</p>}
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
          <Button type="button" onClick={() => void save()} disabled={saving || loadingOptions || !coaId || !remarks.trim()}>
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save classification
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
