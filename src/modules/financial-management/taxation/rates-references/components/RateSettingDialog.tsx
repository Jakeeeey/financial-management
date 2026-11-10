"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { DateField } from "./DateField";

import type { RateSettingRow } from "../types";

type Draft = Record<keyof Omit<RateSettingRow, "rateId">, string>;

const PERCENT_FIELDS = [
  ["vat", "VAT"],
  ["percentage", "Percentage tax"],
  ["corporate", "Corporate income tax"],
  ["smallCorporate", "Small corporation"],
  ["mcit", "MCIT"],
  ["scit", "SCIT"],
  ["osd", "Optional standard deduction"],
  ["finalTaxInterest", "Final tax on interest"],
] as const;

function toDraft(row: RateSettingRow): Draft {
  const percent = (value: number) => String(Number((value * 100).toFixed(4)));
  return {
    effectiveFrom: row.effectiveFrom,
    vat: percent(row.vat),
    percentage: percent(row.percentage),
    corporate: percent(row.corporate),
    smallCorporate: percent(row.smallCorporate),
    smallCorporateNtiCeiling: String(row.smallCorporateNtiCeiling),
    smallCorporateAssetCeiling: String(row.smallCorporateAssetCeiling),
    mcit: percent(row.mcit),
    mcitStartYear: String(row.mcitStartYear),
    scit: percent(row.scit),
    osd: percent(row.osd),
    finalTaxInterest: percent(row.finalTaxInterest),
    notes: row.notes ?? "",
  };
}

/** A new version starts with the next calendar year, the date a law change would take hold. */
function nextYearStart(): string {
  return `${new Date().getFullYear() + 1}-01-01`;
}

export const EMPTY_SETTING: RateSettingRow = {
  rateId: null,
  effectiveFrom: nextYearStart(),
  vat: 0.12,
  percentage: 0.03,
  corporate: 0.25,
  smallCorporate: 0.2,
  smallCorporateNtiCeiling: 5_000_000,
  smallCorporateAssetCeiling: 100_000_000,
  mcit: 0.02,
  mcitStartYear: 4,
  scit: 0.05,
  osd: 0.4,
  finalTaxInterest: 0.2,
  notes: null,
};

function issuesOf(draft: Draft): string[] {
  const issues: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.effectiveFrom)) issues.push("Pick the date these rates start.");
  for (const [field, label] of PERCENT_FIELDS) {
    const value = Number(draft[field]);
    if (!Number.isFinite(value) || value < 0 || value > 100) issues.push(`${label} must be between 0 and 100%.`);
  }
  if (!Number.isFinite(Number(draft.mcitStartYear)) || Number(draft.mcitStartYear) < 1) {
    issues.push("MCIT start year must be 1 or later.");
  }
  return issues;
}

function toRow(row: RateSettingRow, draft: Draft): RateSettingRow {
  const percent = (value: string) => Number((Number(value) / 100).toFixed(6));
  return {
    rateId: row.rateId,
    effectiveFrom: draft.effectiveFrom,
    vat: percent(draft.vat),
    percentage: percent(draft.percentage),
    corporate: percent(draft.corporate),
    smallCorporate: percent(draft.smallCorporate),
    smallCorporateNtiCeiling: Number(draft.smallCorporateNtiCeiling) || 0,
    smallCorporateAssetCeiling: Number(draft.smallCorporateAssetCeiling) || 0,
    mcit: percent(draft.mcit),
    mcitStartYear: Number(draft.mcitStartYear) || 1,
    scit: percent(draft.scit),
    osd: percent(draft.osd),
    finalTaxInterest: percent(draft.finalTaxInterest),
    notes: draft.notes.trim() ? draft.notes.trim() : null,
  };
}

export function RateSettingDialog({
  open,
  row,
  isSaving,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  row: RateSettingRow | null;
  isSaving: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (next: RateSettingRow) => Promise<boolean>;
}) {
  // The panel keys this dialog, so a new row remounts it with fresh state instead of an effect.
  const [draft, setDraft] = useState<Draft>(() => toDraft(row ?? EMPTY_SETTING));
  const issues = issuesOf(draft);

  const set = (field: keyof Draft) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setDraft((current) => ({ ...current, [field]: event.target.value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{row?.rateId ? "Edit rate version" : "New rate version"}</DialogTitle>
          <DialogDescription>
            A change takes effect on its own date, so earlier years keep the rates that applied then.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="rate-effective">Applies from</Label>
            <DateField
              id="rate-effective"
              inDialog
              value={draft.effectiveFrom}
              onChange={(value) => setDraft((current) => ({ ...current, effectiveFrom: value }))}
              placeholder="Pick the first day"
              aria-label="Date these rates start"
            />
            <p className="text-xs text-muted-foreground">
              Effective from Date.
            </p>
          </div>
          {PERCENT_FIELDS.map(([field, label]) => (
            <div key={field} className="space-y-1.5">
              <Label htmlFor={`rate-${field}`}>{label} (%)</Label>
              <Input
                id={`rate-${field}`}
                inputMode="decimal"
                value={draft[field]}
                onChange={set(field)}
                className="tabular-nums"
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="rate-nti">Small corporation NTI ceiling (₱)</Label>
            <Input
              id="rate-nti"
              inputMode="decimal"
              value={draft.smallCorporateNtiCeiling}
              onChange={set("smallCorporateNtiCeiling")}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate-assets">Asset ceiling, excluding land (₱)</Label>
            <Input
              id="rate-assets"
              inputMode="decimal"
              value={draft.smallCorporateAssetCeiling}
              onChange={set("smallCorporateAssetCeiling")}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rate-mcit-year">MCIT from taxable year</Label>
            <Input
              id="rate-mcit-year"
              inputMode="numeric"
              value={draft.mcitStartYear}
              onChange={set("mcitStartYear")}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="rate-notes">Note</Label>
            <Input
              id="rate-notes"
              value={draft.notes}
              onChange={set("notes")}
              placeholder="What changed, and which issuance says so"
              maxLength={500}
            />
          </div>
        </div>

        {issues.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-300">{issues[0]}</p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isSaving || issues.length > 0}
            onClick={async () => {
              const saved = await onSave(toRow(row ?? EMPTY_SETTING, draft));
              if (saved) onOpenChange(false);
            }}
          >
            {isSaving ? "Saving…" : "Save rates"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
