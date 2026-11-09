import "server-only";

import { asNumber, asString, listItems } from "./directus";
import { DEFAULT_PROFILE } from "../constants";
import type { EntityProfile } from "../types";

/**
 * Tax profiles, read in one request for the whole group.
 *
 * The worksheet module needs to *edit* one company's profile; the overview only needs
 * to know which companies have one for the year, because a missing row changes every
 * figure on that company's line. Hence `missing` is part of the result here.
 */

interface ProfileRow {
  id?: number;
  company_id?: number | string;
  tax_year?: number | string;
  assets_excluding_land?: number | string | null;
  taxable_year_of_operations?: number | string | null;
  regime?: string | null;
  registered_share?: number | string | null;
  deduction_method?: string | null;
  withholding_agent?: number | string | null;
  has_top_withholding_status?: number | string | null;
  vat_registered?: number | string | null;
  efps_group?: string | null;
  owns_real_property?: number | string | null;
  tax_agent_fee_rate?: number | string | null;
  prior_year_excess_credit?: number | string | null;
  notes?: string | null;
}

const FIELDS = [
  "id",
  "company_id",
  "tax_year",
  "assets_excluding_land",
  "taxable_year_of_operations",
  "regime",
  "registered_share",
  "deduction_method",
  "withholding_agent",
  "has_top_withholding_status",
  "vat_registered",
  "efps_group",
  "owns_real_property",
  "tax_agent_fee_rate",
  "prior_year_excess_credit",
  "notes",
];

export interface ProfileState {
  profile: EntityProfile;
  /** True when the company has no `tax_company_profile` row for this year. */
  missing: boolean;
}

export function defaultProfile(companyId: number, taxYear: number): EntityProfile {
  return { companyId, taxYear, ...DEFAULT_PROFILE };
}

function toProfile(row: ProfileRow, companyId: number, taxYear: number): EntityProfile {
  return {
    companyId,
    taxYear,
    assetsExcludingLand: asNumber(row.assets_excluding_land),
    taxableYearOfOperations: asNumber(row.taxable_year_of_operations, 1),
    regime: (asString(row.regime) || "REGULAR") as EntityProfile["regime"],
    registeredShare: asNumber(row.registered_share, 100),
    deductionMethod: (asString(row.deduction_method) || "ITEMIZED") as EntityProfile["deductionMethod"],
    withholdingAgent: asNumber(row.withholding_agent, 1) === 1,
    hasTopWithholdingStatus: asNumber(row.has_top_withholding_status, 0) === 1,
    vatRegistered: asNumber(row.vat_registered, 1) === 1,
    efpsGroup: (asString(row.efps_group) || "NONE") as EntityProfile["efpsGroup"],
    ownsRealProperty: asNumber(row.owns_real_property, 0) === 1,
    taxAgentFeeRate: asNumber(row.tax_agent_fee_rate, 15),
    priorYearExcessCredit: asNumber(row.prior_year_excess_credit),
    notes: asString(row.notes) || null,
  };
}

export async function loadProfiles(
  companyIds: number[],
  taxYear: number,
): Promise<{ byCompany: Map<number, ProfileState>; notice: string | null }> {
  const byCompany = new Map<number, ProfileState>();
  if (companyIds.length === 0) return { byCompany, notice: null };

  try {
    const { rows } = await listItems<ProfileRow>("tax_company_profile", {
      fields: FIELDS,
      filter: { _and: [{ company_id: { _in: companyIds } }, { tax_year: { _eq: taxYear } }] },
      limit: companyIds.length,
    });

    for (const row of rows) {
      const companyId = asNumber(row.company_id);
      if (!companyId) continue;
      byCompany.set(companyId, { profile: toProfile(row, companyId, taxYear), missing: false });
    }
    for (const companyId of companyIds) {
      if (!byCompany.has(companyId)) byCompany.set(companyId, { profile: defaultProfile(companyId, taxYear), missing: true });
    }
    return { byCompany, notice: null };
  } catch (error) {
    // Table not created yet: the group still renders, but every company is flagged as defaulted.
    const message = error instanceof Error ? error.message : String(error);
    for (const companyId of companyIds) {
      byCompany.set(companyId, { profile: defaultProfile(companyId, taxYear), missing: true });
    }
    return { byCompany, notice: `Tax profile table is not readable (${message}); defaults apply to every company.` };
  }
}
