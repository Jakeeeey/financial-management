import "server-only";

import { PERIOD_KEYS } from "../constants";
import { phtStamp } from "../pht";
import type { PeriodKey, PeriodLockRow } from "../types";
import type { Actor } from "./actor";
import { appendChangeLog, formatValues } from "./changeLog";
import { asNumber, asString, createItem, isCollectionUnavailable, listItems, updateItem } from "./directus";
import { RowNotFoundError } from "./rowErrors";

const COLLECTION = "tax_period_lock";

const FIELDS = [
  "id",
  "company_id",
  "tax_year",
  "period_key",
  "locked_at",
  "locked_by",
  "locked_by_name",
  "unlock_reason",
  "unlocked_at",
  "unlocked_by",
];

export interface LockInput {
  companyId: number;
  taxYear: number;
  periodKey: PeriodKey;
  /** Why the period is being locked; written to the change log. */
  reason?: string | null;
}

export interface UnlockInput extends LockInput {
  reason: string;
}

export interface LockLedger {
  locks: PeriodLockRow[];
  notices: string[];
}

/** Raised when a write would land inside a locked period. */
export class PeriodLockedError extends Error {
  constructor(periodKey: string) {
    super(`${periodKey} is locked, so nothing can be recorded in it. Unlock the period first, then record the correction.`);
    this.name = "PeriodLockedError";
  }
}

/** Raised when the period is not currently locked, so there is nothing to release. */
export class NotLockedError extends Error {
  constructor(periodKey: string) {
    super(`${periodKey} is not locked.`);
    this.name = "NotLockedError";
  }
}

function mapLock(raw: Record<string, unknown>): PeriodLockRow {
  const period = asString(raw.period_key);
  return {
    id: asNumber(raw.id),
    companyId: asNumber(raw.company_id),
    taxYear: asNumber(raw.tax_year),
    periodKey: (PERIOD_KEYS as string[]).includes(period) ? (period as PeriodKey) : "ANNUAL",
    lockedAt: asString(raw.locked_at),
    lockedBy: raw.locked_by == null ? null : asNumber(raw.locked_by),
    lockedByName: asString(raw.locked_by_name) || null,
    unlockReason: asString(raw.unlock_reason) || null,
    unlockedAt: asString(raw.unlocked_at) || null,
    unlockedBy: raw.unlocked_by == null ? null : asNumber(raw.unlocked_by),
  };
}

export async function loadLocks(companyId: number, taxYear: number): Promise<LockLedger> {
  try {
    const { rows } = await listItems<Record<string, unknown>>(COLLECTION, {
      fields: FIELDS,
      filter: { _and: [{ company_id: { _eq: companyId } }, { tax_year: { _eq: taxYear } }] },
      sort: "period_key",
      limit: -1,
    });
    return { locks: rows.map(mapLock), notices: [] };
  } catch (error) {
    return {
      locks: [],
      notices: [
        isCollectionUnavailable(error)
          ? "Period locks are unavailable because table tax_period_lock is not readable yet (the schema may not be loaded)."
          : `Period locks could not be read: ${error instanceof Error ? error.message : String(error)}`,
      ],
    };
  }
}

async function findLock(companyId: number, taxYear: number, periodKey: PeriodKey): Promise<PeriodLockRow | null> {
  const { rows } = await listItems<Record<string, unknown>>(COLLECTION, {
    fields: FIELDS,
    filter: {
      _and: [
        { company_id: { _eq: companyId } },
        { tax_year: { _eq: taxYear } },
        { period_key: { _eq: periodKey } },
      ],
    },
    limit: 1,
  });
  return rows.length > 0 ? mapLock(rows[0]) : null;
}

/**
 * A lock is only worth taking if it blocks writes. Every payment and certificate mutation asks this
 * first, so a locked quarter cannot collect figures behind the lock's back.
 */
export async function assertPeriodUnlocked(
  companyId: number,
  taxYear: number,
  periodKey: PeriodKey,
): Promise<void> {
  let lock: PeriodLockRow | null = null;
  try {
    lock = await findLock(companyId, taxYear, periodKey);
  } catch {
    // The lock table not being readable must not block ordinary work; it is reported in the desk.
    return;
  }
  if (lock && lock.unlockedAt === null) throw new PeriodLockedError(periodKey);
}

export async function lockPeriod(input: LockInput, actor: Actor): Promise<{ id: number; locked: boolean }> {
  const existing = await findLock(input.companyId, input.taxYear, input.periodKey);
  const stamp = phtStamp();

  if (existing && !existing.unlockedAt) {
    // Already locked: re-stamping would rewrite history for no reason.
    return { id: existing.id, locked: true };
  }

  const payload = {
    locked_at: stamp,
    locked_by: actor.userId,
    locked_by_name: actor.userName,
    unlock_reason: null,
    unlocked_at: null,
    unlocked_by: null,
  };

  const saved = existing
    ? await updateItem<Record<string, unknown>>(COLLECTION, existing.id, payload)
    : await createItem<Record<string, unknown>>(COLLECTION, {
        company_id: input.companyId,
        tax_year: input.taxYear,
        period_key: input.periodKey,
        ...payload,
      });

  const id = asNumber(saved.id);
  await appendChangeLog(
    {
      companyId: input.companyId,
      taxYear: input.taxYear,
      entity: "tax_period_lock",
      entityRef: `${input.taxYear}-${input.periodKey}`,
      field: "LOCKED",
      beforeValue: existing ? formatValues({ locked_at: existing.lockedAt, unlocked_at: existing.unlockedAt }) : null,
      afterValue: formatValues({ locked_at: stamp, by: actor.userName ?? actor.userId }),
      reason: input.reason?.trim() ? input.reason.trim() : (existing?.unlockReason ?? null),
    },
    actor,
  );

  return { id, locked: true };
}

export async function unlockPeriod(input: UnlockInput, actor: Actor): Promise<{ id: number; locked: boolean }> {
  const existing = await findLock(input.companyId, input.taxYear, input.periodKey);
  if (!existing) throw new RowNotFoundError("period lock", `${input.taxYear}-${input.periodKey}`);
  if (existing.unlockedAt) throw new NotLockedError(input.periodKey);

  const stamp = phtStamp();
  await updateItem<Record<string, unknown>>(COLLECTION, existing.id, {
    unlock_reason: input.reason,
    unlocked_at: stamp,
    unlocked_by: actor.userId,
  });

  await appendChangeLog(
    {
      companyId: input.companyId,
      taxYear: input.taxYear,
      entity: "tax_period_lock",
      entityRef: `${input.taxYear}-${input.periodKey}`,
      field: "UNLOCKED",
      beforeValue: formatValues({ locked_at: existing.lockedAt, by: existing.lockedByName ?? existing.lockedBy }),
      afterValue: formatValues({ unlocked_at: stamp, by: actor.userName ?? actor.userId }),
      reason: input.reason,
    },
    actor,
  );

  return { id: existing.id, locked: false };
}
