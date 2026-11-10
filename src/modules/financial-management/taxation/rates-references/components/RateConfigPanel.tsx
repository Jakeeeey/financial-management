"use client";

import { useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

import { percentText } from "../constants";
import { useRateConfig } from "../hooks/useRateConfig";
import type { RateSettingRow, WithholdingRateRow } from "../types";
import { EMPTY_SETTING, RateSettingDialog } from "./RateSettingDialog";

const ROW_TONE = "border-border/50";

function SettingsTable({
  rows,
  onEdit,
  onNew,
  readOnly,
}: {
  rows: RateSettingRow[];
  onEdit: (index: number) => void;
  onNew: () => void;
  readOnly: boolean;
}) {
  return (
    <section
      aria-label="Rate settings"
      className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm", ROW_TONE)}
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Rates in force</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The newest row dated on or before 1 January of the year on screen is the one the desk uses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="tabular-nums text-[11px]">
            {rows.length} {rows.length === 1 ? "version" : "versions"}
          </Badge>
          <Button type="button" size="sm" onClick={onNew} disabled={readOnly}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New version
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-muted-foreground">
          No rate version is recorded on this instance yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-muted/40 text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Starts</th>
                <th className="px-3 py-2 text-right font-medium">VAT</th>
                <th className="px-3 py-2 text-right font-medium">Percentage</th>
                <th className="px-3 py-2 text-right font-medium">Corporate</th>
                <th className="px-3 py-2 text-right font-medium">Small</th>
                <th className="px-3 py-2 text-right font-medium">MCIT</th>
                <th className="px-3 py-2 text-right font-medium">OSD</th>
                <th className="px-3 py-2 text-right font-medium">SCIT</th>
                <th className="px-3 py-2 text-right font-medium">Final tax</th>
                <th className="px-3 py-2 text-right font-medium">NTI ceiling</th>
                <th className="px-4 py-2 text-right font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {rows.map((row, index) => (
                <tr key={row.rateId ?? `new-${index}`} className="hover:bg-muted/20">
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{row.effectiveFrom || "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{percentText(row.vat)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{percentText(row.percentage)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{percentText(row.corporate)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{percentText(row.smallCorporate)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{percentText(row.mcit)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{percentText(row.osd)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{percentText(row.scit)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{percentText(row.finalTaxInterest)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(row.smallCorporateNtiCeiling)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button type="button" size="sm" variant="ghost" onClick={() => onEdit(index)} disabled={readOnly}>
                      Edit
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function WithholdingRowEditor({
  row,
  isSaving,
  onSave,
}: {
  row: WithholdingRateRow;
  isSaving: boolean;
  onSave: (next: WithholdingRateRow) => Promise<boolean>;
}) {
  const [percent, setPercent] = useState(String(Number((row.rate * 100).toFixed(4))));
  const [topAgent, setTopAgent] = useState(row.requiresTopWithholdingAgent);
  const parsed = Number(percent);
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
  const dirty = topAgent !== row.requiresTopWithholdingAgent || Math.abs(parsed / 100 - row.rate) > 1e-6;

  return (
    <tr className="hover:bg-muted/20">
      <td className="whitespace-nowrap px-4 py-2.5">{row.incomeType.toLowerCase()}</td>
      <td className="px-3 py-2.5 text-muted-foreground">{row.rateTier ? row.rateTier.toLowerCase() : "any"}</td>
      <td className="px-3 py-2.5 text-right">
        <Input
          value={percent}
          onChange={(event) => setPercent(event.target.value)}
          inputMode="decimal"
          className="ml-auto h-8 w-24 text-right tabular-nums"
          aria-label={`${row.incomeType} rate in percent`}
        />
      </td>
      <td className="px-3 py-2.5 text-center">
        <input
          type="checkbox"
          checked={topAgent}
          onChange={(event) => setTopAgent(event.target.checked)}
          aria-label={`${row.incomeType} requires a top withholding agent`}
          className="h-4 w-4"
        />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">{row.effectiveFrom || "—"}</td>
      <td className="px-4 py-2.5 text-right">
        <Button
          type="button"
          size="sm"
          variant={dirty ? "default" : "ghost"}
          disabled={!dirty || !valid || isSaving}
          onClick={() => void onSave({ ...row, rate: parsed / 100, requiresTopWithholdingAgent: topAgent })}
        >
          Save
        </Button>
      </td>
    </tr>
  );
}

type RateController = ReturnType<typeof useRateConfig>;

/** The company selector lives in the page header, so this panel only edits what it is handed. */
export function RateConfigPanel({ controller }: { controller: RateController }) {
  const rates = controller;
  const [editing, setEditing] = useState<{ row: typeof EMPTY_SETTING | null; open: boolean }>({ row: null, open: false });

  const companies = rates.config?.companies ?? [];
  const readOnly = rates.isLoading || companies.length === 0;

  return (
    <div className="space-y-4">
      {rates.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>That did not save</AlertTitle>
          <AlertDescription>{rates.error}</AlertDescription>
        </Alert>
      )}

      {rates.config?.notice && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Rates not readable</AlertTitle>
          <AlertDescription>{rates.config.notice}</AlertDescription>
        </Alert>
      )}

      {rates.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : (
        <>
          <SettingsTable
            rows={rates.config?.settings ?? []}
            readOnly={readOnly}
            onNew={() => setEditing({ row: null, open: true })}
            onEdit={(index) => setEditing({ row: rates.config?.settings[index] ?? null, open: true })}
          />

          <section
            aria-label="Withholding matrix"
            className={cn("overflow-hidden rounded-2xl border bg-card shadow-sm", ROW_TONE)}
          >
            <header className="border-b border-border/50 px-4 py-3">
              <h2 className="text-sm font-semibold">Withholding matrix</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Rent 5%, services and construction 2%, goods 1% only for a top withholding agent, and the
                professional fee split by the seller&rsquo;s tier.
              </p>
            </header>

            {(rates.config?.withholding.length ?? 0) === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No withholding rate is recorded on this instance yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Income type</th>
                      <th className="px-3 py-2 text-left font-medium">Seller tier</th>
                      <th className="px-3 py-2 text-right font-medium">Rate %</th>
                      <th className="px-3 py-2 text-center font-medium">Top agent only</th>
                      <th className="px-3 py-2 text-left font-medium">Starts</th>
                      <th className="px-4 py-2 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {(rates.config?.withholding ?? []).map((row) => (
                      <WithholdingRowEditor
                        key={row.rateId ?? `${row.incomeType}-${row.rateTier}-${row.effectiveFrom}`}
                        row={row}
                        isSaving={rates.isSaving}
                        onSave={rates.saveWithholding}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      <RateSettingDialog
        key={editing.open ? (editing.row?.rateId ?? "new") : "closed"}
        open={editing.open}
        row={editing.row}
        isSaving={rates.isSaving}
        onOpenChange={(open) => setEditing((current) => ({ ...current, open }))}
        onSave={rates.saveSetting}
      />
    </div>
  );
}
