import "server-only";

import { phtStamp } from "../pht";
import { createItem } from "./directus";

/**
 * The desk's audit trail, written from this module. The Change Log page reads the same
 * table, so a profile edit is visible there without the two modules talking to each other.
 */

const MAX_FIELD = 300;

function clip(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, MAX_FIELD) : null;
}

export interface FieldChange {
  field: string;
  beforeValue: string | null;
  afterValue: string | null;
}

function comparable(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
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

export interface AuditEntry {
  companyId: number;
  taxYear: number;
  entity: string;
  entityRef: string | null;
  field: string | null;
  beforeValue: string | null;
  afterValue: string | null;
  reason?: string | null;
  actor: { userId: number | null; userName: string | null };
}

export async function appendAudit(entry: AuditEntry): Promise<void> {
  try {
    await createItem("tax_change_log", {
      company_id: entry.companyId,
      tax_year: entry.taxYear,
      actor_id: entry.actor.userId,
      actor_name: entry.actor.userName,
      occurred_at: phtStamp(),
      entity: entry.entity,
      entity_ref: clip(entry.entityRef),
      field: clip(entry.field),
      before_value: clip(entry.beforeValue),
      after_value: clip(entry.afterValue),
      reason: clip(entry.reason ?? null),
    });
  } catch (error) {
    // The save it describes already landed; failing the response would make the user
    // resubmit a saved profile. Record the audit miss for the operator instead.
    console.error("[taxation/entity-worksheet audit]", entry.entity, entry.entityRef, error);
  }
}
