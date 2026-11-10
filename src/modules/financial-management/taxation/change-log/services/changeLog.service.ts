import "server-only";

import { DirectusError, asNumber, asString, listItems } from "./directus";
import type { ChangeLogFilter, ChangeLogRow } from "../types";
import { CHANGE_LOG_PAGE_SIZE } from "../constants";

const COLLECTION = "tax_change_log";

const FIELDS = [
  "id",
  "company_id",
  "tax_year",
  "entity",
  "entity_ref",
  "field",
  "before_value",
  "after_value",
  "actor_id",
  "actor_name",
  "occurred_at",
  "reason",
];

type RawRow = Record<string, unknown>;

function toRow(raw: RawRow): ChangeLogRow {
  return {
    id: asNumber(raw.id),
    companyId: raw.company_id == null ? null : asNumber(raw.company_id),
    taxYear: raw.tax_year == null ? null : asNumber(raw.tax_year),
    entity: asString(raw.entity) || "UNKNOWN",
    entityRef: asString(raw.entity_ref) || null,
    field: asString(raw.field) || null,
    beforeValue: asString(raw.before_value) || null,
    afterValue: asString(raw.after_value) || null,
    actor: asString(raw.actor_name) || (raw.actor_id == null ? null : `#${asNumber(raw.actor_id)}`),
    occurredAt: asString(raw.occurred_at) || null,
    reason: asString(raw.reason) || null,
  };
}

function buildFilter(filter: ChangeLogFilter): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];

  if (filter.companyId) and.push({ company_id: { _eq: filter.companyId } });
  if (filter.year) and.push({ tax_year: { _eq: filter.year } });
  if (filter.entity && filter.entity !== "ALL") and.push({ entity: { _eq: filter.entity } });
  if (filter.from) and.push({ occurred_at: { _gte: `${filter.from}T00:00:00` } });
  if (filter.to) and.push({ occurred_at: { _lte: `${filter.to}T23:59:59` } });

  if (filter.q) {
    and.push({
      _or: [
        { entity_ref: { _contains: filter.q } },
        { reason: { _contains: filter.q } },
        { before_value: { _contains: filter.q } },
        { after_value: { _contains: filter.q } },
      ],
    });
  }

  return and.length ? { _and: and } : {};
}

type ChangeLogPage = { rows: ChangeLogRow[]; total: number; notice?: string };

/** Short on purpose: other modules append to this table, so the only freshness signal is time. */
const CHANGE_LOG_CACHE_TTL_MS = 30_000;
const changeLogCache = new Map<string, { at: number; data: ChangeLogPage }>();

/**
 * Reads the taxation change log.
 *
 * The table only exists after the owner runs `taxation-schema.sql`; until then the
 * caller gets an empty page plus a notice instead of a 500.
 */
export async function listChangeLog(
  filter: ChangeLogFilter,
  options: { fresh?: boolean } = {},
): Promise<ChangeLogPage> {
  const key = JSON.stringify(filter);
  const hit = changeLogCache.get(key);
  if (!options.fresh && hit && Date.now() - hit.at < CHANGE_LOG_CACHE_TTL_MS) return hit.data;

  const page = await buildChangeLogPage(filter);
  // The unreadable-table notice is a failure, not a result; caching it would pin the error for the TTL.
  if (!page.notice) {
    // Every filter combination is its own key, so the map is capped: a session that pages and
    // searches must not grow it without bound in a long-lived server process.
    if (changeLogCache.size >= 200) {
      const oldest = changeLogCache.keys().next().value;
      if (oldest !== undefined) changeLogCache.delete(oldest);
    }
    changeLogCache.set(key, { at: Date.now(), data: page });
  }
  return page;
}

async function buildChangeLogPage(filter: ChangeLogFilter): Promise<ChangeLogPage> {
  try {
    const { rows, total } = await listItems<RawRow>(COLLECTION, {
      fields: FIELDS,
      filter: buildFilter(filter),
      sort: "-occurred_at,-id",
      limit: CHANGE_LOG_PAGE_SIZE,
      page: filter.page,
    });
    return { rows: rows.map(toRow), total };
  } catch (error) {
    if (error instanceof DirectusError) {
      return {
        rows: [],
        total: 0,
        notice: "The change log cannot be read right now, so no edits are listed. Reload to try again.",
      };
    }
    throw error;
  }
}

