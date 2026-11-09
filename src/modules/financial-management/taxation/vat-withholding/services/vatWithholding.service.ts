import "server-only";

import type {
  CompanyOption,
  RegistryCompany,
  VatSnapshot,
  VatWithholdingData,
} from "../types";
import { computeVat } from "./taxEngine";
import { emptyFigures, loadVatFigures } from "./companyFigures";
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

export async function loadVatWithholding(
  companyId: number,
  taxYear: number,
  companies: RegistryCompany[],
): Promise<VatWithholdingData> {
  const company = companies.find((entry) => entry.companyId === companyId);
  if (!company) throw new CompanyNotFoundError(companyId);

  const options = companies.map(toCompanyOption);

  if (!company.reachable) {
    const { profile } = await loadProfile(companyId, taxYear);
    const snapshot: VatSnapshot = {
      company: toCompanyOption(company),
      profile,
      figures: emptyFigures(),
      notices: [
        `${company.name} could not be reached: ${company.unreachableReason ?? "no answer from its endpoint"}. Figures below are empty, not zero.`,
      ],
    };
    return {
      companies: options,
      snapshot,
      vat: computeVat(snapshot.figures, profile),
      monthly: emptyMonthly(),
      certificates: emptyRegister(),
    };
  }

  const [{ profile, stored }, figureResult, monthlyResult] = await Promise.all([
    loadProfile(companyId, taxYear),
    loadVatFigures(company, taxYear),
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
  };

  return {
    companies: options,
    snapshot,
    vat: computeVat(figureResult.figures, profile),
    monthly: monthlyResult.monthly,
    certificates,
  };
}
