import "server-only";

import { createItem, DirectusError, listItems, updateItem } from "./directus";
import { listRegistryCompanies } from "./registry";
import type {
  RateConfig,
  RateConfigCompany,
  RateSettingRow,
  WithholdingIncomeType,
  WithholdingRateRow,
} from "../types";

/**
 * Rates are group data: they live in the FM database next to `company_list`, one table for
 * every company, keyed by `company_id`. Editing them here writes one place, not ten.
 */

class RateTableError extends Error {}

const SETTING_FIELDS = [
  "rate_id",
  "company_id",
  "effective_from",
  "vat_rate",
  "percentage_tax_rate",
  "corporate_rate",
  "small_corporate_rate",
  "small_corporate_nti_ceiling",
  "small_corporate_asset_ceiling",
  "mcit_rate",
  "mcit_start_year",
  "scit_rate",
  "osd_rate",
  "final_tax_interest_rate",
  "notes",
];

const WITHHOLDING_FIELDS = [
  "rate_id",
  "company_id",
  "income_type",
  "rate_tier",
  "rate",
  "requires_top_withholding_agent",
  "effective_from",
];

const number = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const text = (value: unknown): string => (value == null ? "" : String(value));

function settingsRow(raw: Record<string, unknown>): RateSettingRow {
  return {
    rateId: raw.rate_id == null ? null : number(raw.rate_id),
    effectiveFrom: text(raw.effective_from).slice(0, 10),
    vat: number(raw.vat_rate),
    percentage: number(raw.percentage_tax_rate),
    corporate: number(raw.corporate_rate),
    smallCorporate: number(raw.small_corporate_rate),
    smallCorporateNtiCeiling: number(raw.small_corporate_nti_ceiling),
    smallCorporateAssetCeiling: number(raw.small_corporate_asset_ceiling),
    mcit: number(raw.mcit_rate),
    mcitStartYear: number(raw.mcit_start_year, 4),
    scit: number(raw.scit_rate),
    osd: number(raw.osd_rate),
    finalTaxInterest: number(raw.final_tax_interest_rate),
    notes: text(raw.notes) || null,
  };
}

function withholdingRow(raw: Record<string, unknown>): WithholdingRateRow {
  const tier = text(raw.rate_tier).toUpperCase();
  return {
    rateId: raw.rate_id == null ? null : number(raw.rate_id),
    incomeType: (text(raw.income_type).toUpperCase() || "OTHER") as WithholdingIncomeType,
    rateTier: tier === "LARGE" || tier === "MEDIUM" || tier === "SMALL" ? tier : null,
    rate: number(raw.rate),
    requiresTopWithholdingAgent: raw.requires_top_withholding_agent === true || Number(raw.requires_top_withholding_agent) === 1,
    effectiveFrom: text(raw.effective_from).slice(0, 10),
  };
}

function settingsPayload(companyId: number, row: RateSettingRow): Record<string, unknown> {
  return {
    company_id: companyId,
    effective_from: row.effectiveFrom,
    vat_rate: row.vat,
    percentage_tax_rate: row.percentage,
    corporate_rate: row.corporate,
    small_corporate_rate: row.smallCorporate,
    small_corporate_nti_ceiling: row.smallCorporateNtiCeiling,
    small_corporate_asset_ceiling: row.smallCorporateAssetCeiling,
    mcit_rate: row.mcit,
    mcit_start_year: row.mcitStartYear,
    scit_rate: row.scit,
    osd_rate: row.osd,
    final_tax_interest_rate: row.finalTaxInterest,
    notes: row.notes,
  };
}

function withholdingPayload(companyId: number, row: WithholdingRateRow): Record<string, unknown> {
  return {
    company_id: companyId,
    income_type: row.incomeType,
    // An empty tier keeps the unique key honest: MySQL treats NULLs as distinct in a UNIQUE index.
    rate_tier: row.rateTier ?? "",
    rate: row.rate,
    requires_top_withholding_agent: row.requiresTopWithholdingAgent ? 1 : 0,
    effective_from: row.effectiveFrom,
  };
}

async function companies(): Promise<RateConfigCompany[]> {
  const rows = await listRegistryCompanies();
  return rows.map((company) => ({ companyId: company.companyId, code: company.code, name: company.name }));
}

export async function loadRateConfig(companyId: number | null): Promise<RateConfig> {
  const list = await companies();
  const company = companyId == null ? (list[0] ?? null) : (list.find((entry) => entry.companyId === companyId) ?? null);
  if (!company) return { companies: list, company: null, settings: [], withholding: [], notice: null };

  try {
    const settings = await listItems<Record<string, unknown>>("tax_rate_settings", {
      fields: SETTING_FIELDS,
      filter: { company_id: { _eq: company.companyId } },
      sort: "-effective_from",
      limit: 50,
    });
    const withholding = await listItems<Record<string, unknown>>("tax_withholding_rates", {
      fields: WITHHOLDING_FIELDS,
      filter: { company_id: { _eq: company.companyId } },
      sort: "income_type,rate_tier",
      limit: 100,
    });
    return {
      companies: list,
      company,
      settings: settings.rows.map(settingsRow),
      withholding: withholding.rows.map(withholdingRow),
      notice: null,
    };
  } catch (error) {
    const status = error instanceof DirectusError ? error.status : 0;
    return {
      companies: list,
      company,
      settings: [],
      withholding: [],
      notice:
        status === 403 || status === 404 || status === 500
          ? "The rate tables are not in this database yet, so nothing can be read. Run .omo/drafts/tax-rate-tables.sql on the FM instance."
          : "The rate tables could not be read just now.",
    };
  }
}

export async function saveRateSetting(companyId: number, row: RateSettingRow): Promise<RateSettingRow> {
  const payload = settingsPayload(companyId, row);
  if (row.rateId == null) {
    const created = await createItem<Record<string, unknown>>("tax_rate_settings", payload);
    return settingsRow(created);
  }
  const updated = await updateItem<Record<string, unknown>>("tax_rate_settings", row.rateId, payload);
  return settingsRow(updated);
}

export async function saveWithholdingRate(companyId: number, row: WithholdingRateRow): Promise<WithholdingRateRow> {
  const payload = withholdingPayload(companyId, row);
  if (row.rateId == null) {
    const created = await createItem<Record<string, unknown>>("tax_withholding_rates", payload);
    return withholdingRow(created);
  }
  const updated = await updateItem<Record<string, unknown>>("tax_withholding_rates", row.rateId, payload);
  return withholdingRow(updated);
}

export { RateTableError };
