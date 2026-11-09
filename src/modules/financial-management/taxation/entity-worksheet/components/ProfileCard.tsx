"use client";

import { useState } from "react";
import { Save, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

import type { EntityProfile } from "../types";
import { DEDUCTION_METHOD_OPTIONS, EFPS_GROUPS, REGIME_OPTIONS } from "../constants";

interface Props {
  profile: EntityProfile;
  isSaving: boolean;
  onSave: (next: EntityProfile) => Promise<boolean>;
}

/** Numbers stay as typed text so the caret never jumps while a rate is half-entered. */
interface Draft {
  taxableYearOfOperations: number;
  assetsExcludingLand: string;
  regime: EntityProfile["regime"];
  registeredShare: string;
  deductionMethod: EntityProfile["deductionMethod"];
  efpsGroup: EntityProfile["efpsGroup"];
  taxAgentFeeRate: string;
  priorYearExcessCredit: string;
  withholdingAgent: boolean;
  hasTopWithholdingStatus: boolean;
  vatRegistered: boolean;
  ownsRealProperty: boolean;
  notes: string;
}

function toDraft(profile: EntityProfile): Draft {
  return {
    taxableYearOfOperations: profile.taxableYearOfOperations,
    assetsExcludingLand: String(profile.assetsExcludingLand),
    regime: profile.regime,
    registeredShare: String(profile.registeredShare),
    deductionMethod: profile.deductionMethod,
    efpsGroup: profile.efpsGroup,
    taxAgentFeeRate: String(profile.taxAgentFeeRate),
    priorYearExcessCredit: String(profile.priorYearExcessCredit),
    withholdingAgent: profile.withholdingAgent,
    hasTopWithholdingStatus: profile.hasTopWithholdingStatus,
    vatRegistered: profile.vatRegistered,
    ownsRealProperty: profile.ownsRealProperty,
    notes: profile.notes ?? "",
  };
}

function amount(raw: string): number | null {
  const cleaned = raw.replace(/[^\d.-]/g, "");
  if (!cleaned) return 0;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function percent(raw: string): number | null {
  const parsed = amount(raw);
  if (parsed === null || parsed < 0 || parsed > 100) return null;
  return parsed;
}

function money(raw: string): number | null {
  const parsed = amount(raw);
  if (parsed === null || parsed < 0) return null;
  return parsed;
}

interface Issues {
  assetsExcludingLand?: string;
  registeredShare?: string;
  taxAgentFeeRate?: string;
  priorYearExcessCredit?: string;
}

function issuesOf(draft: Draft): Issues {
  const issues: Issues = {};
  if (money(draft.assetsExcludingLand) === null) issues.assetsExcludingLand = "Enter an amount of zero or more.";
  if (percent(draft.registeredShare) === null) issues.registeredShare = "Enter a share between 0 and 100.";
  if (percent(draft.taxAgentFeeRate) === null) issues.taxAgentFeeRate = "Enter a rate between 0 and 100.";
  if (money(draft.priorYearExcessCredit) === null) issues.priorYearExcessCredit = "Enter an amount of zero or more.";
  return issues;
}

/**
 * The only editable part of the desk: profile facts come from the company's
 * registration, never from its ledgers, so a person states them and saves once.
 */
export function ProfileCard({ profile, isSaving, onSave }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(profile));

  const issues = issuesOf(draft);
  const invalid = Object.keys(issues).length > 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(profile));

  const patch = (values: Partial<Draft>) => setDraft((current) => ({ ...current, ...values }));

  const save = async () => {
    if (!dirty || invalid) return;
    const next: EntityProfile = {
      ...profile,
      taxableYearOfOperations: draft.taxableYearOfOperations,
      assetsExcludingLand: money(draft.assetsExcludingLand) ?? 0,
      regime: draft.regime,
      registeredShare: percent(draft.registeredShare) ?? 0,
      deductionMethod: draft.deductionMethod,
      efpsGroup: draft.efpsGroup,
      taxAgentFeeRate: percent(draft.taxAgentFeeRate) ?? 0,
      priorYearExcessCredit: money(draft.priorYearExcessCredit) ?? 0,
      withholdingAgent: draft.withholdingAgent,
      hasTopWithholdingStatus: draft.hasTopWithholdingStatus,
      vatRegistered: draft.vatRegistered,
      ownsRealProperty: draft.ownsRealProperty,
      notes: draft.notes.trim() ? draft.notes.trim() : null,
    };
    const saved = await onSave(next);
    if (!saved) setDraft(toDraft(profile));
  };

  const discard = () => setDraft(toDraft(profile));

  return (
    <section
      aria-label="Company tax profile"
      className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-sm"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-4 py-3">
        <h2 className="text-sm font-semibold">Profile · {profile.taxYear}</h2>
        <p className="text-[11px] text-muted-foreground">
          {dirty ? "Unsaved changes." : "Saved."} These facts drive every computed line.
        </p>
      </header>

      <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="tax-year-of-ops">Taxable year of operations</Label>
          <Select
            value={String(draft.taxableYearOfOperations)}
            onValueChange={(value) => patch({ taxableYearOfOperations: Number(value) })}
            disabled={isSaving}
          >
            <SelectTrigger id="tax-year-of-ops" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {[1, 2, 3, 4, 5, 6].map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year === 6 ? "6th year or later" : `${year}${["st", "nd", "rd", "th", "th", "th"][year - 1]} year`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">MCIT starts on the 4th taxable year.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="assets">Total assets, excluding land</Label>
          <Input
            id="assets"
            inputMode="decimal"
            className="tabular-nums"
            value={draft.assetsExcludingLand}
            disabled={isSaving}
            aria-invalid={Boolean(issues.assetsExcludingLand)}
            onChange={(event) => patch({ assetsExcludingLand: event.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">
            {issues.assetsExcludingLand ?? "Small-corporation test: ₱100,000,000 ceiling."}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="regime">Tax regime</Label>
          <Select
            value={draft.regime}
            onValueChange={(value) => patch({ regime: value as EntityProfile["regime"] })}
            disabled={isSaving}
          >
            <SelectTrigger id="regime" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {REGIME_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {draft.regime !== "REGULAR" ? (
          <div className="space-y-1.5">
            <Label htmlFor="registered-share">Share of income from registered activity (%)</Label>
            <Input
              id="registered-share"
              inputMode="decimal"
              className="tabular-nums"
              value={draft.registeredShare}
              disabled={isSaving}
              aria-invalid={Boolean(issues.registeredShare)}
              onChange={(event) => patch({ registeredShare: event.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">{issues.registeredShare ?? "0 to 100."}</p>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="deduction-method">Deduction method</Label>
          <Select
            value={draft.deductionMethod}
            onValueChange={(value) => patch({ deductionMethod: value as EntityProfile["deductionMethod"] })}
            disabled={isSaving}
          >
            <SelectTrigger id="deduction-method" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {DEDUCTION_METHOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="efps">eFPS group</Label>
          <Select
            value={draft.efpsGroup}
            onValueChange={(value) => patch({ efpsGroup: value as EntityProfile["efpsGroup"] })}
            disabled={isSaving}
          >
            <SelectTrigger id="efps" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {EFPS_GROUPS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="fee-rate">Management fee withholding rate (%)</Label>
          <Input
            id="fee-rate"
            inputMode="decimal"
            className="tabular-nums"
            value={draft.taxAgentFeeRate}
            disabled={isSaving}
            aria-invalid={Boolean(issues.taxAgentFeeRate)}
            onChange={(event) => patch({ taxAgentFeeRate: event.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">{issues.taxAgentFeeRate ?? "0 to 100."}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="prior-credit">Prior year&apos;s excess credit</Label>
          <Input
            id="prior-credit"
            inputMode="decimal"
            className="tabular-nums"
            value={draft.priorYearExcessCredit}
            disabled={isSaving}
            aria-invalid={Boolean(issues.priorYearExcessCredit)}
            onChange={(event) => patch({ priorYearExcessCredit: event.target.value })}
          />
          <p className="text-[11px] text-muted-foreground">
            {issues.priorYearExcessCredit ?? "Carried over, no expiry."}
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 p-3">
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Withholding agent</span>
            <Switch
              checked={draft.withholdingAgent}
              disabled={isSaving}
              onCheckedChange={(checked) => patch({ withholdingAgent: checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Top withholding agent</span>
            <Switch
              checked={draft.hasTopWithholdingStatus}
              disabled={isSaving}
              onCheckedChange={(checked) => patch({ hasTopWithholdingStatus: checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>VAT registered</span>
            <Switch
              checked={draft.vatRegistered}
              disabled={isSaving}
              onCheckedChange={(checked) => patch({ vatRegistered: checked })}
            />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Owns real property</span>
            <Switch
              checked={draft.ownsRealProperty}
              disabled={isSaving}
              onCheckedChange={(checked) => patch({ ownsRealProperty: checked })}
            />
          </label>
        </div>

        <div className="space-y-1.5 sm:col-span-2 xl:col-span-3">
          <Label htmlFor="profile-notes">Notes</Label>
          <Textarea
            id="profile-notes"
            rows={3}
            className="min-h-[100px] resize-none"
            placeholder="Anything the next reviewer should know about these figures."
            value={draft.notes}
            maxLength={500}
            disabled={isSaving}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 bg-muted/20 px-4 py-3">
        <p className="text-[11px] text-muted-foreground">
          {invalid ? "Fix the highlighted fields before saving." : "Nothing saves until you press Save."}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={discard} disabled={!dirty || isSaving}>
            <Undo2 className="mr-2 h-4 w-4" />
            Discard changes
          </Button>
          <Button type="button" onClick={() => void save()} disabled={!dirty || invalid || isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </footer>
    </section>
  );
}
