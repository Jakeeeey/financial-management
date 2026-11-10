/**
 * The reference list states the desk's numbers; this overlay states the numbers actually in force
 * for the selected company, so a rate edit cannot leave the page describing last year's law.
 */

import { formatNumber } from "@/lib/utils";

import { percentText } from "./constants";
import type { ReferenceGroup } from "./reference.data";
import type { RateConfig, RateSettingRow, WithholdingRateRow } from "./types";

export type LiveRates = {
  companyCode: string;
  /** The row the engine would read for `year`: newest version dated on or before 1 January. */
  row: RateSettingRow | null;
  withholding: WithholdingRateRow[];
};

export function ratesInForce(config: RateConfig | null, year: number): LiveRates | null {
  if (!config || !config.company) return null;
  const anchor = `${year}-01-01`;
  const inForce = config.settings
    .filter((row) => row.effectiveFrom && row.effectiveFrom <= anchor)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  // A row dated after the anchor cannot rewrite this year, so it is not a fallback either.
  const row = inForce[0] ?? null;
  return { companyCode: config.company.code, row, withholding: config.withholding };
}

function rateOf(rows: WithholdingRateRow[], incomeType: string, tier?: string): number | null {
  const match = rows.find(
    (row) => row.incomeType === incomeType && (tier ? row.rateTier === tier : row.rateTier == null),
  );
  return match ? match.rate : null;
}

const ORDINAL = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"];

function taxableYearText(year: number): string {
  return ORDINAL[year] ?? `${year}th`;
}

/** Entries whose value the configuration owns; every other entry is law and stays as written. */
function liveValue(key: string, live: LiveRates): { value: string; note?: string } | null {
  const { row, withholding, companyCode } = live;
  if (!row) return null;
  switch (key) {
    case "regular":
      return { value: percentText(row.corporate), note: `Of net taxable income. Set for ${companyCode}.` };
    case "regular-small":
      return {
        value: percentText(row.smallCorporate),
        note: `Net taxable income at or below ${formatNumber(row.smallCorporateNtiCeiling)} and assets excluding land at or below ${formatNumber(row.smallCorporateAssetCeiling)}.`,
      };
    case "mcit":
      return {
        value: `${percentText(row.mcit)} of gross income`,
        note: `Applies from the ${taxableYearText(row.mcitStartYear)} taxable year; the desk takes whichever is higher, regular tax or MCIT.`,
      };
    case "scit":
      return { value: `${percentText(row.scit)} of gross income`, note: "Special corporate income tax for registered export enterprises." };
    case "osd":
      return { value: `${percentText(row.osd)} of gross income`, note: "Used instead of itemized deductions when the profile asks for it." };
    case "vat":
      return { value: percentText(row.vat), note: "Output on VATable sales less input on VAT purchases." };
    case "output": {
      const numerator = Math.round(row.vat * 1000) / 10;
      const denominator = Math.round((1 + row.vat) * 1000) / 10;
      return {
        value: `${numerator}/${denominator} of the VAT-inclusive invoice total`,
        note: "Sales invoice totals already include the VAT, so output VAT is the VAT share of the total.",
      };
    }
    case "percentage":
      return { value: `${percentText(row.percentage)} of gross receipts`, note: "For companies not registered for VAT (2551Q)." };
    case "rent": {
      const rent = rateOf(withholding, "RENT") ?? rateOf(withholding, "RENT", "");
      return { value: rent == null ? "Not configured" : percentText(rent), note: "On the gross rental." };
    }
    case "fee": {
      const tiers = ["LARGE", "MEDIUM", "SMALL"]
        .map((tier) => rateOf(withholding, "FEE", tier))
        .filter((rate): rate is number => rate != null);
      return {
        value: tiers.length ? tiers.map(percentText).join(", ").replace(/, ([^,]*)$/, " or $1") : "Not configured",
        note: "Taken from the seller's registered tier.",
      };
    }
    case "services": {
      const services = rateOf(withholding, "SERVICES", "") ?? rateOf(withholding, "SERVICES");
      return { value: services == null ? "Not configured" : percentText(services), note: "Including construction contracts." };
    }
    case "goods": {
      const goods = rateOf(withholding, "GOODS", "") ?? rateOf(withholding, "GOODS");
      return {
        value: goods == null ? "Not configured" : percentText(goods),
        note: "Only when the buyer is a top withholding agent; otherwise 0%.",
      };
    }
    case "final":
      return { value: percentText(row.finalTaxInterest), note: "Withheld by the bank; never part of taxable income." };
    default:
      return null;
  }
}

export function withLiveRates(groups: ReferenceGroup[], live: LiveRates | null): ReferenceGroup[] {
  if (!live || !live.row) return groups;
  return groups.map((group) => ({
    ...group,
    entries: group.entries.map((entry) => {
      const override = liveValue(entry.key, live);
      return override ? { ...entry, value: override.value, note: override.note ?? entry.note } : entry;
    }),
  }));
}
