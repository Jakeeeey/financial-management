import "server-only";

import { asNumber, asNumberOrNull, asString, listItems, roundMoney } from "./directus";
import type { CarryoverLot, RegistryCompanySummary } from "../types";

/**
 * Carryover lots for one tax year, from the central `tax_carryover_lot` table.
 *
 * `tax_year` is the year the lot is *used in*, not the year it came from: NOLCO earned
 * in 2022 sits on the 2025 row when 2025 is the third year it may offset. That is why
 * `origin_year` is displayed next to it.
 */

interface LotRow {
  id?: number | string;
  company_id?: number | string;
  kind?: string | null;
  origin_year?: number | string | null;
  amount?: number | string | null;
  amount_used?: number | string | null;
  expires_after_year?: number | string | null;
}

const FIELDS = ["id", "company_id", "kind", "origin_year", "amount", "amount_used", "expires_after_year"];

export async function loadCarryovers(
  companies: RegistryCompanySummary[],
  taxYear: number,
): Promise<{ lots: CarryoverLot[]; notice: string | null }> {
  const byId = new Map(companies.map((company) => [company.companyId, company]));

  try {
    const { rows } = await listItems<LotRow>("tax_carryover_lot", {
      fields: FIELDS,
      filter: { tax_year: { _eq: taxYear } },
      sort: "company_id",
      limit: 500,
    });

    const lots = rows
      .map((row): CarryoverLot | null => {
        const id = asNumber(row.id);
        const companyId = asNumber(row.company_id);
        if (!id || !companyId) return null;
        const company = byId.get(companyId);
        const amount = asNumber(row.amount);
        const used = asNumber(row.amount_used);
        return {
          id,
          companyId,
          companyCode: company?.code ?? `#${companyId}`,
          companyName: company?.name ?? `Company ${companyId}`,
          kind: asString(row.kind) || "UNKNOWN",
          originYear: asNumber(row.origin_year, taxYear),
          amount: roundMoney(amount),
          used: roundMoney(used),
          remaining: roundMoney(Math.max(0, amount - used)),
          expiresAfterYear: asNumberOrNull(row.expires_after_year),
        };
      })
      .filter((lot): lot is CarryoverLot => lot !== null);

    return { lots, notice: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      lots: [],
      notice: `tax_carryover_lot is not readable yet (${message}). Run the taxation DDL, then this table fills in.`,
    };
  }
}
