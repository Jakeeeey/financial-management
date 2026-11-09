import "server-only";

import { asString, listItems } from "./directus";
import { ping } from "./companyClient";
import type { RegistryCompany } from "../types";

/**
 * The company registry (`company_list` on the FM instance) is the only place the
 * group's Directus endpoints and tokens live. Nothing downstream hard-codes a URL.
 */

interface CompanyListRow {
  company_id?: number | string;
  company_code?: string | null;
  company_name?: string | null;
  company_tin?: string | null;
  directus?: string | null;
  directus_token?: string | null;
  status?: string | null;
}

const FIELDS = [
  "company_id",
  "company_code",
  "company_name",
  "company_tin",
  "directus",
  "directus_token",
  "status",
];

export async function listRegistryCompanies(): Promise<RegistryCompany[]> {
  const { rows } = await listItems<CompanyListRow>("company_list", {
    fields: FIELDS,
    filter: { status: { _eq: "ACTIVE" } },
    sort: "company_id",
    limit: 50,
  });

  const companies: RegistryCompany[] = [];
  for (const row of rows) {
    const baseUrl = asString(row.directus);
    const token = asString(row.directus_token);
    const companyId = Number(row.company_id ?? 0);
    if (!companyId || !baseUrl || !token) continue;

    companies.push({
      companyId,
      code: asString(row.company_code) || `#${companyId}`,
      name: asString(row.company_name) || `Company ${companyId}`,
      tin: asString(row.company_tin) || null,
      baseUrl,
      token,
      reachable: true,
      unreachableReason: null,
    });
  }
  return companies;
}

/**
 * Nine endpoints pinged per request made every page pay the slowest one twice. Reachability
 * wobbles on a timescale of minutes, so the answers are reused for a minute.
 */
const HEALTH_TTL_MS = 60_000;
let healthCache: { at: number; rows: RegistryCompany[] } | null = null;

/** Pings every endpoint in parallel; an unreachable company keeps its row and carries the reason. */
export async function listRegistryCompaniesWithHealth(options: { fresh?: boolean } = {}): Promise<RegistryCompany[]> {
  if (!options.fresh && healthCache && Date.now() - healthCache.at < HEALTH_TTL_MS) return healthCache.rows;

  const companies = await listRegistryCompanies();
  const health = await Promise.all(
    companies.map(async (company) => ({ companyId: company.companyId, ...(await ping(company.baseUrl, company.token)) })),
  );
  const byId = new Map(health.map((entry) => [entry.companyId, entry]));

  const rowsWithHealth = companies.map((company) => {
    const entry = byId.get(company.companyId);
    return {
      ...company,
      reachable: entry?.ok ?? false,
      unreachableReason: entry?.ok ? null : (entry?.reason ?? "No answer"),
    };
  });

  healthCache = { at: Date.now(), rows: rowsWithHealth };
  return rowsWithHealth;
}

export async function getRegistryCompany(companyId: number): Promise<RegistryCompany | null> {
  const companies = await listRegistryCompanies();
  return companies.find((company) => company.companyId === companyId) ?? null;
}
