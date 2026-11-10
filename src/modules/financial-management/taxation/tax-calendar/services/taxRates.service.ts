import "server-only";

import {
  CORPORATE_RATE,
  MCIT_RATE,
  MCIT_START_YEAR,
  OSD_RATE,
  PERCENTAGE_TAX_RATE,
  SMALL_CORPORATION_ASSET_CEILING,
  SMALL_CORPORATION_NTI_CEILING,
  SMALL_CORPORATION_RATE,
  VAT_RATE,
} from "../constants";
import { listItems } from "./directus";
import type { RegistryCompany, TaxRates } from "../types";

/**
 * Rates live in the FM database — the same database as `company_list` — keyed by
 * `company_id`, so the group reads one table instead of one table per instance.
 * `tax_rate_settings` holds versioned rates dated by `effective_from`; the desk takes the
 * newest row on or before 1 January of the year being viewed, which is why a future
 * change cannot move a past year's figures.
 */

const DEFAULTS = {
  vat: VAT_RATE,
  percentage: PERCENTAGE_TAX_RATE,
  corporate: CORPORATE_RATE,
  smallCorporate: SMALL_CORPORATION_RATE,
  mcit: MCIT_RATE,
  osd: OSD_RATE,
  scit: 0.05,
  withholding: 0.01,
  smallCorporateNtiCeiling: SMALL_CORPORATION_NTI_CEILING,
  smallCorporateAssetCeiling: SMALL_CORPORATION_ASSET_CEILING,
  mcitStartYear: MCIT_START_YEAR,
};

const RATE_COLUMNS: Array<[keyof typeof DEFAULTS, string]> = [
  ["vat", "vat_rate"],
  ["percentage", "percentage_tax_rate"],
  ["corporate", "corporate_rate"],
  ["smallCorporate", "small_corporate_rate"],
  ["mcit", "mcit_rate"],
  ["osd", "osd_rate"],
  ["scit", "scit_rate"],
];

const AMOUNT_COLUMNS: Array<[keyof typeof DEFAULTS, string]> = [
  ["smallCorporateNtiCeiling", "small_corporate_nti_ceiling"],
  ["smallCorporateAssetCeiling", "small_corporate_asset_ceiling"],
  ["mcitStartYear", "mcit_start_year"],
];

/** A rate reads as 0…1; anything outside that range is a data entry slip, not a rate. */
function toRate(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 1 ? numeric : null;
}

function toAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

export async function loadTaxRates(company: RegistryCompany, taxYear?: number): Promise<TaxRates> {
  const asOf = `${taxYear ?? new Date().getFullYear()}-01-01`;
  const baseFields = ["rate_id", "company_id", "effective_from", ...RATE_COLUMNS.map(([, column]) => column)];
  const allFields = [...baseFields, ...AMOUNT_COLUMNS.map(([, column]) => column)];

  const read = async (fields: string[]) => {
    const { rows } = await listItems<Record<string, unknown>>("tax_rate_settings", {
      fields,
      filter: { company_id: { _eq: company.companyId }, effective_from: { _lte: asOf } },
      sort: "-effective_from",
      limit: 1,
    });
    return rows[0] ?? null;
  };

  let row: Record<string, unknown> | null = null;
  let missing: string[] = [];
  try {
    row = await read(allFields);
  } catch {
    // Directus refuses the whole request when one named column is absent, so retry with the rates only.
    missing = allFields.filter((field) => !baseFields.includes(field));
    try {
      row = await read(baseFields);
    } catch {
      row = null;
    }
  }

  const rates: TaxRates = { ...DEFAULTS, source: "DEFAULTS", missing };
  if (!row) {
    rates.missing = allFields;
    return rates;
  }

  let found = 0;
  for (const [key, column] of RATE_COLUMNS) {
    const value = toRate(row[column]);
    if (value === null) {
      rates.missing.push(column);
      continue;
    }
    (rates as unknown as Record<string, number>)[key] = value;
    found += 1;
  }
  for (const [key, column] of AMOUNT_COLUMNS) {
    const value = toAmount(row[column]);
    if (value === null) {
      rates.missing.push(column);
      continue;
    }
    (rates as unknown as Record<string, number>)[key] = value;
    found += 1;
  }

  if (found > 0) rates.source = "DATABASE";
  return rates;
}
