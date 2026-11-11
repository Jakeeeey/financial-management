"use client";

import { useState } from "react";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MAPPING_GROUPS, MAPPING_KEYS_NEEDING_DECISION, MAPPING_LABELS } from "../constants";
import type { SaveMappingResult } from "../providers/onboardingApi";
import type { GlAccountOption, GlMappingRow } from "../types";
import { OptionCombobox } from "./OptionCombobox";
import { StatusBadge } from "./StatusBadge";

type PostingSetupDialogProps = {
  mapping: GlMappingRow[];
  /** Every chart row: clearing keys are not cash-titled, so the cash picker cannot serve them. */
  chartAccounts: GlAccountOption[];
  onSaveMapping: (mappingKey: string, coaId: number | null) => Promise<SaveMappingResult | null>;
  onSettleDue: () => Promise<unknown>;
  isSaving: boolean;
};

type RowState = "mapped" | "not-mapped" | "needs-decision";

function rowState(row: GlMappingRow): RowState {
  if (row.coaId !== null) return "mapped";
  return MAPPING_KEYS_NEEDING_DECISION.has(row.mappingKey) ? "needs-decision" : "not-mapped";
}

function mappingLabel(mappingKey: string): string {
  return MAPPING_LABELS[mappingKey] ?? mappingKey;
}

/**
 * Every `bank_gl_mapping` key and its GL account, behind a header button: the register is the
 * page, so the setup belongs one click away rather than above the accounts. Two empty states
 * differ — a key with no defensible account in this COA needs an accounting decision, not a pick.
 */
export function PostingSetupDialog({
  mapping,
  chartAccounts,
  onSaveMapping,
  onSettleDue,
  isSaving,
}: PostingSetupDialogProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GlMappingRow | null>(null);
  const [selected, setSelected] = useState("");
  const [dueTransfers, setDueTransfers] = useState(0);
  const [saving, setSaving] = useState(false);

  if (mapping.length === 0) return null;

  const mapped = mapping.filter((row) => row.coaId !== null).length;
  const unmapped = mapping.length - mapped;
  const options = chartAccounts.map((account) => ({
    value: String(account.coaId),
    label: `${account.glCode} · ${account.accountTitle}`,
    searchText: `${account.glCode} ${account.accountTitle}`,
  }));

  const byKey = new Map(mapping.map((row) => [row.mappingKey, row]));
  const grouped = MAPPING_GROUPS.map((group) => ({
    heading: group.heading,
    rows: group.keys.map((key) => byKey.get(key)).filter((row): row is GlMappingRow => row !== undefined),
  })).filter((group) => group.rows.length > 0);
  const groupedKeys = new Set(grouped.flatMap((group) => group.rows.map((row) => row.mappingKey)));
  const ungrouped = mapping.filter((row) => !groupedKeys.has(row.mappingKey));
  if (ungrouped.length > 0) grouped.push({ heading: "Other", rows: ungrouped });

  function openDialog() {
    setOpen(true);
    setEditing(null);
    setDueTransfers(0);
  }

  function close() {
    setOpen(false);
    setEditing(null);
    setDueTransfers(0);
  }

  function openRow(row: GlMappingRow) {
    setEditing(row);
    setSelected("");
    setDueTransfers(0);
  }

  async function handleSave() {
    if (!editing || !selected) return;
    setSaving(true);
    try {
      const result = await onSaveMapping(editing.mappingKey, Number(selected));
      if (!result) return;
      toast.success(`${mappingLabel(editing.mappingKey)} mapped`);
      if (result.dueTransfers > 0) {
        // P110: the save just unblocked leg 2 for parked transfers; settling stays a user action.
        setDueTransfers(result.dueTransfers);
        return;
      }
      setEditing(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleSettle() {
    setSaving(true);
    try {
      await onSettleDue();
      close();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={openDialog} className="min-h-11 md:min-h-0">
        <SlidersHorizontal className="mr-2 size-4" aria-hidden="true" />
        Posting setup
        {unmapped > 0 ? (
          <span
            className="ml-2 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-destructive"
            title={`${unmapped} ${unmapped === 1 ? "key is" : "keys are"} not mapped`}
          >
            {unmapped} not mapped
          </span>
        ) : null}
      </Button>

      <Dialog open={open} onOpenChange={(next) => (next ? undefined : close())}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[85vh] w-[95vw] flex-col overflow-hidden rounded-2xl p-0 sm:max-w-[980px]"
        >
          <DialogHeader className="border-b px-6 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <DialogTitle className="break-words">
                  {editing ? mappingLabel(editing.mappingKey) : "Posting setup"}
                </DialogTitle>
                <DialogDescription className="break-words">
                  {editing
                    ? editing.mappingKey
                    : "Every posting key the bank modules use. A missing mapping blocks the posting that needs it."}
                </DialogDescription>
              </div>
              {editing ? null : (
                <Badge variant="outline" className="shrink-0 tabular-nums">
                  {mapped} of {mapping.length} mapped
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {editing ? (
              <div className="space-y-3 px-6 py-4">
                {dueTransfers > 0 ? (
                  <>
                    <p className="text-sm">The clearing accounts are set now, so transfers parked in clearing can settle.</p>
                    <p className="text-sm">
                      {dueTransfers} {dueTransfers === 1 ? "transfer is" : "transfers are"} due and waiting in clearing.
                      Settle {dueTransfers === 1 ? "it" : "them"} now?
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium">GL account</p>
                    <OptionCombobox
                      options={options}
                      value={selected}
                      onChange={setSelected}
                      placeholder="Choose a GL account"
                      searchPlaceholder="Search GL code or title"
                      emptyLabel="No chart account matches that search."
                    />
                  </>
                )}
              </div>
            ) : (
              <>
                {unmapped > 0 ? (
                  // One line at the top answers "does anything block a posting" without
                  // reordering the accounting groups every time a key is fixed.
                  <p className="border-b bg-destructive/5 px-6 py-3 text-sm font-medium text-destructive">
                    {unmapped === 1 ? "1 key is not mapped." : `${unmapped} keys are not mapped.`} Postings that need{" "}
                    {unmapped === 1 ? "it" : "them"} stay blocked until a GL account is set.
                  </p>
                ) : null}
                <div className="divide-y divide-border">
                  {grouped.map((group) => (
                    <div key={group.heading}>
                      <h3 className="bg-muted/40 px-6 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.heading}
                      </h3>
                      <ul className="divide-y divide-border">
                        {group.rows.map((row) => {
                          const state = rowState(row);
                          const editable = state !== "mapped";
                          const fullAccount = `${row.glCode ?? ""} · ${row.accountTitle ?? ""}`.replace(/^ · /, "");
                          return (
                            <li
                              key={row.mappingKey}
                              title={`${mappingLabel(row.mappingKey)}: ${editable ? "not mapped, set the GL account" : "mapped, change the GL account"}`}
                              className="group flex min-h-12 flex-wrap items-center justify-between gap-x-4 gap-y-1 px-6 py-1.5 transition-colors hover:bg-muted/40"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium" title={mappingLabel(row.mappingKey)}>
                                  {mappingLabel(row.mappingKey)}
                                </p>
                                <p className="break-words font-mono text-[11px] text-muted-foreground">{row.mappingKey}</p>
                              </div>
                              <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                <span
                                  className="block w-full min-w-0 max-w-full truncate text-sm tabular-nums sm:w-[26rem] sm:shrink-0"
                                  title={row.coaId !== null ? fullAccount : undefined}
                                >
                                  {row.coaId !== null ? fullAccount : "—"}
                                </span>
                                {/* The column stays reserved on mapped rows so the badge cannot shift the account column. */}
                                <span className="w-[9.75rem] shrink-0">
                                  {row.coaId !== null ? null : (
                                    <StatusBadge
                                      status={state === "needs-decision" ? "NEEDS_DECISION" : "NOT_MAPPED"}
                                      label={state === "needs-decision" ? "Needs accounting decision" : "Not mapped"}
                                    />
                                  )}
                                </span>
                                <Button
                                  type="button"
                                  variant={editable ? "outline" : "ghost"}
                                  size="sm"
                                  aria-label={`${editable ? "Set" : "Change"} the GL account for ${mappingLabel(row.mappingKey)} (${row.mappingKey})`}
                                  title={`${editable ? "Set" : "Change"} the GL account for ${mappingLabel(row.mappingKey)}`}
                                  className={
                                    editable
                                      ? "w-[5rem] shrink-0 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                      : "w-[5rem] shrink-0 text-muted-foreground hover:text-foreground focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                  }
                                  onClick={() => openRow(row)}
                                >
                                  {editable ? "Set GL" : "Change"}
                                </Button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="justify-end border-t bg-muted/20 px-6 py-4">
            {editing ? (
              dueTransfers > 0 ? (
                <>
                  <Button type="button" variant="outline" onClick={close} disabled={saving}>
                    Not now
                  </Button>
                  <Button type="button" onClick={() => void handleSettle()} disabled={saving || isSaving}>
                    Settle {dueTransfers} {dueTransfers === 1 ? "transfer" : "transfers"}
                  </Button>
                </>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setEditing(null)} disabled={saving}>
                    <ArrowLeft className="mr-2 size-4" aria-hidden="true" />
                    Back
                  </Button>
                  <Button type="button" onClick={() => void handleSave()} disabled={saving || !selected || isSaving}>
                    Save mapping
                  </Button>
                </>
              )
            ) : (
              <Button type="button" variant="outline" onClick={close}>
                Close
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
