import "server-only";

import { cookies } from "next/headers";

import { COOKIE_NAME, decodeJwtPayload } from "@/lib/auth-utils";
import { phtStamp } from "../pht";
import { createItem } from "./directus";

/**
 * Rate edits land in the same `tax_change_log` the Change Log page reads, so a changed
 * VAT or withholding rate can be traced back to who changed it and what it was before.
 */

const MAX_FIELD = 300;

function clip(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, MAX_FIELD) : null;
}

/** Flattens a row into `key=value; …`, only for a brand-new row where every field is the change. */
export function formatValues(values: Record<string, unknown>): string {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${value == null || value === "" ? "—" : String(value)}`)
    .join("; ")
    .slice(0, MAX_FIELD);
}

export interface FieldChange {
  field: string | null;
  before: string | null;
  after: string | null;
}

function printable(value: unknown): string | null {
  if (value == null || value === "") return null;
  return String(value);
}

/** Directus returns DECIMAL columns as strings (`"0.1200"`) while the form sends `0.12`,
 *  so a text comparison would flag every rate as changed on every save. */
function same(a: string | null, b: string | null): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

/**
 * One entry per field that actually moved. A whole settings row in a single cell made two
 * edits of the same rate indistinguishable at a glance.
 */
export function diffValues(before: Record<string, unknown> | null, after: Record<string, unknown>): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const [field, value] of Object.entries(after)) {
    if (field === "company_id") continue;
    const was = printable(before?.[field]);
    const now = printable(value);
    if (same(was, now)) continue;
    changes.push({ field, before: was, after: now });
  }
  return changes;
}

/** The signed-in user, or an honest null rather than a fabricated name. */
async function currentActor(): Promise<{ userId: number | null; userName: string | null }> {
  const store = await cookies();
  const payload = decodeJwtPayload(store.get(COOKIE_NAME)?.value ?? "");
  if (!payload) return { userId: null, userName: null };
  const id = Number(payload.sub);
  // Same shape the payments module writes, so one person never shows up in two formats.
  const name = [payload.FirstName, payload.LastName].filter(Boolean).join(" ").trim();
  return {
    userId: Number.isFinite(id) ? id : null,
    userName: name || payload.email || null,
  };
}

export async function appendRateAudit(entry: {
  companyId: number;
  entity: string;
  entityRef: string | null;
  changes: FieldChange[];
  reason: string;
}): Promise<void> {
  if (entry.changes.length === 0) return;
  const actor = await currentActor();
  try {
    for (const change of entry.changes) {
      await createItem("tax_change_log", {
        company_id: entry.companyId,
        tax_year: new Date(phtStamp().slice(0, 4)).getFullYear(),
        actor_id: actor.userId,
        actor_name: actor.userName,
        occurred_at: phtStamp(),
        entity: entry.entity,
        entity_ref: clip(entry.entityRef),
        field: clip(change.field),
        before_value: clip(change.before),
        after_value: clip(change.after),
        reason: clip(entry.reason),
      });
    }
  } catch (error) {
    // The rate is already saved; a failed audit row must not fail the response.
    console.error("[taxation/rates-references audit]", entry.entity, entry.entityRef, error);
  }
}
