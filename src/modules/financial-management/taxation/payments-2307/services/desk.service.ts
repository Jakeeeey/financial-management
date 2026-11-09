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

/**
 * One payload for the whole page so the three tabs cannot disagree about which
 * company and year they are showing.
 */
export async function loadDesk(companyId: number | null, year: number): Promise<DeskPayload> {
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
