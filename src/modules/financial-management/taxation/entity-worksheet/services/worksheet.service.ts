import "server-only";

import { getRegistryCompany, listRegistryCompaniesWithHealth } from "./registry";
import { loadFigures } from "./companyFigures";
import { loadProfile } from "./profile.service";
import { buildLines, computeTax, computeVat } from "./taxEngine";
import type { EntitySnapshot, RegistryCompany } from "../types";

/**
 * One company, one tax year: registry row + profile + the figures summed from that
 * company's own tables + the arithmetic. Every page reads through here, so the eight
 * modules can never disagree about a number.
 */

export class TaxonomyLookupError extends Error {
  status: number;

  constructor(message: string, status = 404) {
    super(message);
    this.name = "TaxonomyLookupError";
    this.status = status;
  }
}

export async function listCompanies(): Promise<RegistryCompany[]> {
  return listRegistryCompaniesWithHealth();
}

export async function loadEntitySnapshot(companyId: number, taxYear: number): Promise<EntitySnapshot> {
  const company = await getRegistryCompany(companyId);
  if (!company) throw new TaxonomyLookupError(`Company ${companyId} is not in the registry.`);

  const peers = (await listCompanies()).filter((peer) => peer.companyId !== companyId);
  const profile = await loadProfile(companyId, taxYear);

  if (!company.reachable) {
    const notices = [
      `${company.code} is unreachable (${company.unreachableReason ?? "no answer"}). Figures are not shown rather than guessed.`,
    ];
    const empty = [0, 1, 2, 3].map(() => ({
      sales: 0,
      salesVat: 0,
      returns: 0,
      returnsVat: 0,
      purchases: 0,
      purchasesVat: 0,
      expenses: 0,
      cwt: 0,
      icSales: 0,
      icPurchases: 0,
      icSalesByCompany: {},
      icPurchasesByCompany: {},
    }));
    const computation = computeTax(empty, profile);
    return {
      company,
      profile,
      figures: empty,
      computation,
      vat: computeVat(empty, profile),
      lines: buildLines(empty, computation, profile),
      matches: [],
      notices: [...notices, ...computation.notices],
    };
  }

  const { figures, matches, notices } = await loadFigures(company, taxYear, peers);
  const computation = computeTax(figures, profile);
  const vat = computeVat(figures, profile);

  return {
    company,
    profile,
    figures,
    computation,
    vat,
    lines: buildLines(figures, computation, profile),
    matches,
    notices: [...notices, ...computation.notices],
  };
}
