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

export async function loadEntitySnapshot(
  companyId: number,
  taxYear: number,
  /** Already health-checked rows from the route; without this the registry is pinged twice per page. */
  knownCompanies?: RegistryCompany[],
): Promise<EntitySnapshot> {
  const companies = knownCompanies ?? (await listCompanies());
  const company = companies.find((entry) => entry.companyId === companyId) ?? (await getRegistryCompany(companyId));
  if (!company) throw new TaxonomyLookupError(`Company ${companyId} is not in the registry.`);

  const peers = companies.filter((peer) => peer.companyId !== companyId);
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
      figuresAvailable: false,
      failedSources: ["the company instance"],
    };
  }

  const { figures, matches, notices, failed } = await loadFigures(company, taxYear, peers);
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
    // Gross income is the headline; without the sales register the whole sheet is unknown.
    figuresAvailable: !failed.includes("sales"),
    failedSources: failed.map((source) => (source === "sales" ? "sales invoices" : "purchase orders")),
  };
}
