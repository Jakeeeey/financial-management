import "server-only";

import { phtStamp } from "../pht";
import type { Actor } from "./actor";
import { createItem, roundMoney } from "./directus";

/**
 * The audit trail. Every write in this module appends one row per changed field group,
 * stamped in PHT, so a locked period and a corrected certificate can be reconstructed.
 */

const MAX_FIELD = 300;

export interface ChangeLogEntry {
  companyId: number;
  taxYear: number;
  entity: string;
  entityRef: string | null;
  field: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  reason: string | null;
}

function clip(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, MAX_FIELD) : null;
}

/** Flattens a record into `key=value; …` for the before/after columns. */
export function formatValues(values: Record<string, unknown>): string {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${value == null || value === "" ? "—" : String(value)}`)
    .join("; ")
    .slice(0, MAX_FIELD);
}

export interface FieldChange {
  field: string;
  beforeValue: string | null;
  afterValue: string | null;
}

function comparable(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(roundMoney(value)) : "";
  return String(value).trim();
}

/** One entry per field that actually moved, so before/after are never a soup of ten values. */
export function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fields) {
    const from = comparable(before[field]);
    const to = comparable(after[field]);
    if (from === to) continue;
    changes.push({ field, beforeValue: from || null, afterValue: to || null });
  }
  return changes;
}

export async function appendChangeLog(entry: ChangeLogEntry, actor: Actor): Promise<boolean> {
  try {
    await createItem("tax_change_log", {
      company_id: entry.companyId,
      tax_year: entry.taxYear,
      actor_id: actor.userId,
      actor_name: actor.userName,
      occurred_at: phtStamp(),
      entity: entry.entity,
      entity_ref: clip(entry.entityRef),
      field: clip(entry.field),
      before_value: clip(entry.beforeValue),
      after_value: clip(entry.afterValue),
      reason: clip(entry.reason),
    });
    return true;
  } catch (error) {
    // The write it describes already succeeded; failing the response here would make the
    // user retry a saved payment and duplicate it. Log the audit miss for the operator.
    console.error("[taxation/payments-2307 change-log]", entry.entity, entry.entityRef, error);
    return false;
  }
}

