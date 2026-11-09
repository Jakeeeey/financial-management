import "server-only";

import { asString, listItems } from "./directus";
import type { CompanyOption, RegistryCompany } from "../types";

/**
 * The company registry (`company_list` on the FM instance) is the only place the
 * group's Directus endpoints and tokens live. Nothing downstream hard-codes a URL.
 * Copied from the entity-worksheet kernel without the health probe: this desk reads
 * the ledger lazily and reports an unreachable company as a notice.
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

const FIELDS = ["company_id", "company_code", "company_name", "company_tin", "directus", "directus_token", "status"];

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

export async function getRegistryCompany(companyId: number): Promise<RegistryCompany | null> {
  const companies = await listRegistryCompanies();
  return companies.find((company) => company.companyId === companyId) ?? null;
}

/** The shape the browser may see: no endpoint, no token. */
export function toCompanyOption(company: RegistryCompany): CompanyOption {
  return { companyId: company.companyId, code: company.code, name: company.name, tin: company.tin };
}
