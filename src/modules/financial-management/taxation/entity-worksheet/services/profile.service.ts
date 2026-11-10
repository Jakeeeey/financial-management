import "server-only";

import { asNumber, asString, createItem, updateItem, listItems } from "./directus";
import { phtStamp } from "../pht";
import { DEFAULT_PROFILE } from "../constants";
import { appendAudit, changedFields } from "./auditLog";
import type { EntityProfile } from "../types";

/**
 * Company tax profile — the only part of this desk a person types in.
 * Everything numeric elsewhere is derived from the company's own ledgers.
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

/** The money-bearing profile columns the audit trail records one row per field for. */
const AUDITED_FIELDS = [
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

export async function loadProfile(companyId: number, taxYear: number): Promise<EntityProfile> {
  try {
    const { rows } = await listItems<ProfileRow>("tax_company_profile", {
      fields: FIELDS,
      filter: { _and: [{ company_id: { _eq: companyId } }, { tax_year: { _eq: taxYear } }] },
      limit: 1,
    });
    const row = rows[0];
    return row ? toProfile(row, companyId, taxYear) : defaultProfile(companyId, taxYear);
  } catch {
    // Table not created yet: the page still opens with a default profile rather than dying.
    return defaultProfile(companyId, taxYear);
  }
}

export async function saveProfile(
  profile: EntityProfile,
  actor: { userId: number | null; userName: string | null },
): Promise<EntityProfile> {
  const payload = {
    company_id: profile.companyId,
    tax_year: profile.taxYear,
    assets_excluding_land: profile.assetsExcludingLand,
    taxable_year_of_operations: profile.taxableYearOfOperations,
    regime: profile.regime,
    registered_share: profile.registeredShare,
    deduction_method: profile.deductionMethod,
    withholding_agent: profile.withholdingAgent ? 1 : 0,
    has_top_withholding_status: profile.hasTopWithholdingStatus ? 1 : 0,
    vat_registered: profile.vatRegistered ? 1 : 0,
    efps_group: profile.efpsGroup,
    owns_real_property: profile.ownsRealProperty ? 1 : 0,
    tax_agent_fee_rate: profile.taxAgentFeeRate,
    prior_year_excess_credit: profile.priorYearExcessCredit,
    notes: profile.notes,
    updated_at: phtStamp(),
    updated_by: actor.userId,
  };

  const { rows } = await listItems<ProfileRow>("tax_company_profile", {
    fields: FIELDS,
    filter: { _and: [{ company_id: { _eq: profile.companyId } }, { tax_year: { _eq: profile.taxYear } }] },
    limit: 1,
  });

  const before = (rows[0] ?? {}) as Record<string, unknown>;
  if (rows[0]?.id) {
    await updateItem("tax_company_profile", rows[0].id, payload);
  } else {
    await createItem("tax_company_profile", { ...payload, created_at: phtStamp(), created_by: actor.userId });
  }

  // The Change Log page reads `tax_change_log`; without these rows a profile edit that
  // moved the whole worksheet would leave no trace of who changed it or from what.
  for (const change of changedFields(before, payload, AUDITED_FIELDS)) {
    await appendAudit({
      companyId: profile.companyId,
      taxYear: profile.taxYear,
      entity: "tax_company_profile",
      entityRef: `${profile.companyId}:${profile.taxYear}`,
      field: change.field,
      beforeValue: change.beforeValue,
      afterValue: change.afterValue,
      reason: rows[0]?.id ? "Profile updated" : "Profile created",
      actor,
    });
  }

  return profile;
}

