import "server-only";

import { asNumber, asString, listItems } from "./directus";
import { DEFAULT_PROFILE } from "../constants";
import type { EntityProfile } from "../types";

/**
 * Company tax profile — the only part of this desk a person types in.
 * `stored` is false when the table or the row is missing, so the page can say the
 * VAT registration shown on the badge is a default rather than a recorded fact.
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

export async function loadProfile(
  companyId: number,
  taxYear: number,
): Promise<{ profile: EntityProfile; stored: boolean }> {
  try {
    const { rows } = await listItems<ProfileRow>("tax_company_profile", {
      fields: FIELDS,
      filter: { _and: [{ company_id: { _eq: companyId } }, { tax_year: { _eq: taxYear } }] },
      limit: 1,
    });
    const row = rows[0];
    if (!row) return { profile: defaultProfile(companyId, taxYear), stored: false };
    return { profile: toProfile(row, companyId, taxYear), stored: true };
  } catch {
    // Table not created yet: the page still opens with a default profile rather than dying.
    return { profile: defaultProfile(companyId, taxYear), stored: false };
  }
}

