import "server-only";

import type {
  CompanyOption,
  QuarterFigures,
  RegistryCompany,
  VatSnapshot,
  VatWithholdingData,
} from "../types";
import { computeVat } from "./taxEngine";
import { loadFigures } from "./companyFigures";
import { loadTaxRates } from "./taxRates.service";
import { loadMonthlyWithholding, emptyMonthly } from "./monthlyWithholding";
import { emptyRegister, loadCertificates } from "./certificates.service";
import { loadProfile } from "./profile.service";

/**
 * Assembles one company-year of the VAT & withholding desk.
 *
 * The companies array arrives already health-checked so this file never pings twice.
 * An unreachable company still produces a full snapshot: empty figures plus a notice,
 * because a page that says "we could not read this" is more useful than a 500.
 */

export class CompanyNotFoundError extends Error {
  constructor(companyId: number) {
    super(`Company ${companyId} is not in the registry`);
    this.name = "CompanyNotFoundError";
  }
}

export function toCompanyOption(company: RegistryCompany): CompanyOption {
  return {
    companyId: company.companyId,
    code: company.code,
    name: company.name,
    tin: company.tin,
    reachable: company.reachable,
    unreachableReason: company.unreachableReason,
  };
}

function emptyQuarter(): QuarterFigures {
  return {
    sales: 0,
    salesVat: 0,
    discounts: 0,
    returns: 0,
    returnsVat: 0,
    purchases: 0,
    purchasesVat: 0,
    cogsProductCost: 0,
    expenses: 0,
    cwt: 0,
    icSales: 0,
    icPurchases: 0,
    icSalesByCompany: {},
    icPurchasesByCompany: {},
  };
}

function emptyFigures(): QuarterFigures[] {
  return [0, 1, 2, 3].map(emptyQuarter);
}

/**
 * Reading nine companies' registers costs seconds per company-year, and the desk
 * re-requests the same company-year on every switch. The token is not part of the key:
 * it decides whether the Spring sales view can be read, not whose figures they are.
 */
const CACHE_TTL_MS = 10 * 60_000;

/** A session-less read falls back to the invoice register, so it must not answer for a signed-in one. */
function authKey(springToken: string | null | undefined): string {
  return springToken ? springToken.slice(-8) : "anon";
}
const cache = new Map<string, { at: number; data: VatWithholdingData }>();

export async function loadVatWithholding(
  companyId: number,
  taxYear: number,
  companies: RegistryCompany[],
  options: { fresh?: boolean; springToken?: string | null } = {},
): Promise<VatWithholdingData> {
  const key = `${companyId}:${taxYear}:${authKey(options.springToken)}`;
  const hit = cache.get(key);
  if (!options.fresh && hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const data = await buildVatWithholding(companyId, taxYear, companies, options.springToken ?? null);
  cache.set(key, { at: Date.now(), data });
  return data;
}

async function buildVatWithholding(
  companyId: number,
  taxYear: number,
  companies: RegistryCompany[],
  springToken: string | null,
): Promise<VatWithholdingData> {
  const company = companies.find((entry) => entry.companyId === companyId);
  if (!company) throw new CompanyNotFoundError(companyId);

  const companyOptions = companies.map(toCompanyOption);
  const rates = await loadTaxRates(company, taxYear);

  if (!company.reachable) {
    const { profile } = await loadProfile(companyId, taxYear);
    const snapshot: VatSnapshot = {
      company: toCompanyOption(company),
      profile,
      figures: emptyFigures(),
      notices: [],
      figuresAvailable: false,
      failedSources: ["the company instance"],
    };
    return {
      companies: companyOptions,
      snapshot,
      vat: computeVat(snapshot.figures, profile, rates),
      monthly: emptyMonthly(),
      certificates: emptyRegister(),
    };
  }

  const [{ profile, stored }, figureResult, monthlyResult] = await Promise.all([
    loadProfile(companyId, taxYear),
    loadFigures(company, taxYear, [], { springToken }),
    loadMonthlyWithholding(company, taxYear),
  ]);

  const certificates = await loadCertificates(company, taxYear, figureResult.figures);

  const notices = [...figureResult.notices, ...monthlyResult.notices];
  if (!stored) {
    notices.push(
      `No tax profile recorded for ${company.name} in ${taxYear}. The 2550Q/2551Q badge and any percentage-tax figure use defaults.`,
    );
  }

  const snapshot: VatSnapshot = {
    company: toCompanyOption(company),
    profile,
    figures: figureResult.figures,
    notices,
    // Output VAT is the headline, so a missing sales register makes the whole panel unknown.
    figuresAvailable: !figureResult.failed.includes("sales"),
    failedSources: figureResult.failed.map((source) =>
      source === "sales" ? "sales invoices" : "purchase orders",
    ),
  };

  return {
    companies: companyOptions,
    snapshot,
    vat: computeVat(figureResult.figures, profile, rates),
    monthly: monthlyResult.monthly,
    certificates,
  };
}


