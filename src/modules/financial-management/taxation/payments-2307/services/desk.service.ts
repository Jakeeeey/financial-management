import "server-only";

import type { CompanyOption, DeskPayload } from "../types";
import { listRegistryCompanies, toCompanyOption } from "./registry";
import { loadCertificateLedger } from "./certificates.service";
import { loadLocks } from "./locks.service";
import { loadPayments } from "./payments.service";

export type { DeskPayload };

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

const DESK_CACHE_TTL_MS = 60_000;
const deskCache = new Map<string, { at: number; data: DeskPayload }>();

/**
 * One payload for the whole page so the three tabs cannot disagree about which
 * company and year they are showing.
 */
export async function loadDesk(
  companyId: number | null,
  year: number,
  options: { fresh?: boolean } = {},
): Promise<DeskPayload> {
  // A request without a company resolves to the registry's first row, so the payload is stored
  // under the company it actually returned; invalidation by id then always finds it.
  const key = companyId === null ? null : `${companyId}:${year}`;
  const hit = key === null ? undefined : deskCache.get(key);
  if (!options.fresh && hit && Date.now() - hit.at < DESK_CACHE_TTL_MS) return hit.data;

  const data = await buildDesk(companyId, year);
  // A payload carrying notices is a degraded read; keep it out so the next request retries.
  if (data.notices.length === 0) deskCache.set(`${data.companyId}:${data.year}`, { at: Date.now(), data });
  return data;
}

/** Payments, certificates and locks ride in one payload, so a write drops the whole company. */
export function clearDeskCache(companyId?: number | null): void {
  if (companyId === undefined || companyId === null) {
    deskCache.clear();
    return;
  }
  const prefix = `${companyId}:`;
  for (const key of [...deskCache.keys()]) {
    if (key.startsWith(prefix)) deskCache.delete(key);
  }
}

async function buildDesk(companyId: number | null, year: number): Promise<DeskPayload> {
  const notices: string[] = [];
  let companies: CompanyOption[] = [];
  let registry: Awaited<ReturnType<typeof listRegistryCompanies>> = [];

  try {
    registry = await listRegistryCompanies();
    companies = registry.map(toCompanyOption);
  } catch (error) {
    notices.push(`The company registry could not be read: ${describe(error)}`);
  }

  const resolvedId =
    companyId !== null && companies.some((company) => company.companyId === companyId)
      ? companyId
      : (companies[0]?.companyId ?? companyId ?? 0);

  const company = registry.find((entry) => entry.companyId === resolvedId) ?? null;
  if (companies.length === 0) {
    notices.push("No active company is registered, so no figures can be read.");
  }

  const [certificateLedger, paymentLedger, lockLedger] = await Promise.all([
    loadCertificateLedger(company, resolvedId, year),
    loadPayments(resolvedId, year),
    loadLocks(resolvedId, year),
  ]);

  return {
    companies,
    companyId: resolvedId,
    year,
    certificates: certificateLedger.certificates,
    payments: paymentLedger.payments,
    locks: lockLedger.locks,
    expected: certificateLedger.expected,
    notices: [...notices, ...certificateLedger.notices, ...paymentLedger.notices, ...lockLedger.notices],
  };
}
