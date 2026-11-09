import "server-only";

import { roundMoney } from "./directus";
import { loadFigures } from "./companyFigures";
import { computeTax, computeVat } from "./taxEngine";
import { defaultProfile, loadProfiles } from "./profile.service";
import { loadCarryovers } from "./carryover.service";
import { listRegistryCompaniesWithHealth } from "./registry";
import type {
  GroupAttentionItem,
  GroupCompanyRow,
  GroupOverviewData,
  GroupRowStatus,
  GroupTotals,
  QuarterFigures,
  RegistryCompany,
  RegistryCompanySummary,
} from "../types";

/**
 * One year, every company in the registry.
 *
 * The ping decides who is even attempted, so a dead instance costs one request rather
 * than five. Each company's figures are then read and computed independently: one
 * company failing never blanks its neighbours, it becomes a row with a reason.
 */

function figuresHaveActivity(figures: QuarterFigures[]): boolean {
  return figures.some(
    (quarter) =>
      quarter.sales !== 0 ||
      quarter.salesVat !== 0 ||
      quarter.returns !== 0 ||
      quarter.purchases !== 0 ||
      quarter.purchasesVat !== 0 ||
      quarter.expenses !== 0 ||
      quarter.cwt !== 0,
  );
}

function emptyRow(company: RegistryCompany, failure: string | null, status: GroupRowStatus, profileMissing: boolean): GroupCompanyRow {
  return {
    companyId: company.companyId,
    code: company.code,
    name: company.name,
    reachable: company.reachable,
    regime: null,
    grossIncome: 0,
    netTaxableIncome: 0,
    taxDue: 0,
    credits: 0,
    netPosition: 0,
    vatPayable: 0,
    withholding: 0,
    status,
    profileMissing,
    failure,
  };
}

async function buildRow(
  company: RegistryCompany,
  taxYear: number,
  profileState: { profile: ReturnType<typeof defaultProfile>; missing: boolean } | undefined,
): Promise<GroupCompanyRow> {
  const state = profileState ?? { profile: defaultProfile(company.companyId, taxYear), missing: true };

  if (!company.reachable) {
    return emptyRow(company, company.unreachableReason ?? "No answer from the instance", "UNREADABLE", state.missing);
  }

  try {
    const { figures } = await loadFigures(company, taxYear);
    const tax = computeTax(figures, state.profile);
    const vat = computeVat(figures, state.profile);
    const withholding = roundMoney(figures.reduce((total, quarter) => total + quarter.cwt, 0));
    const hasActivity = figuresHaveActivity(figures);
    const netPosition = tax.annual.netPosition;

    const status: GroupRowStatus = !hasActivity
      ? "NOT_ENTERED"
      : netPosition > 0
        ? "DUE"
        : netPosition < 0
          ? "OVERPAID"
          : "SETTLED";

    return {
      companyId: company.companyId,
      code: company.code,
      name: company.name,
      reachable: true,
      regime: state.profile.regime,
      grossIncome: tax.annual.grossIncome,
      netTaxableIncome: tax.annual.netTaxableIncome,
      taxDue: tax.annual.taxDue,
      credits: tax.annual.taxCredits,
      netPosition,
      vatPayable: roundMoney(vat.payable.reduce((total, value) => total + value, 0)),
      withholding,
      status,
      profileMissing: state.missing,
      failure: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return emptyRow(company, message, "UNREADABLE", state.missing);
  }
}

const SEVERITY_RANK: Record<GroupAttentionItem["severity"], number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2 };

export async function loadGroupOverview(taxYear: number): Promise<GroupOverviewData> {
  const registry = await listRegistryCompaniesWithHealth();
  const companies: RegistryCompanySummary[] = registry.map((company) => ({
    companyId: company.companyId,
    code: company.code,
    name: company.name,
    tin: company.tin,
    reachable: company.reachable,
    unreachableReason: company.unreachableReason,
  }));

  const [profileLoad, carryoverLoad] = await Promise.all([
    loadProfiles(
      registry.map((company) => company.companyId),
      taxYear,
    ),
    loadCarryovers(companies, taxYear),
  ]);

  const rows = await Promise.all(
    registry.map((company) => buildRow(company, taxYear, profileLoad.byCompany.get(company.companyId))),
  );

  const totals = rows.reduce<GroupTotals>(
    (acc, row) => {
      acc.taxDue += row.taxDue;
      acc.withholding += row.withholding;
      acc.vatPayable += row.vatPayable;
      if (row.netPosition > 0) acc.netPayable += row.netPosition;
      if (row.netPosition < 0) acc.overpaid += -row.netPosition;
      if (row.status === "OVERPAID") acc.overpaidCompanies += 1;
      if (row.status === "UNREADABLE") acc.unreadableCompanies += 1;
      if (row.reachable && row.status !== "UNREADABLE") acc.readableCompanies += 1;
      return acc;
    },
    {
      taxDue: 0,
      netPayable: 0,
      overpaid: 0,
      vatPayable: 0,
      withholding: 0,
      companyCount: rows.length,
      readableCompanies: 0,
      overpaidCompanies: 0,
      unreadableCompanies: 0,
    },
  );

  totals.taxDue = roundMoney(totals.taxDue);
  totals.netPayable = roundMoney(totals.netPayable);
  totals.overpaid = roundMoney(totals.overpaid);
  totals.vatPayable = roundMoney(totals.vatPayable);
  totals.withholding = roundMoney(totals.withholding);

  const attention: GroupAttentionItem[] = [];

  for (const row of rows) {
    if (row.status === "UNREADABLE") {
      attention.push({
        key: `unreadable-${row.companyId}`,
        severity: row.reachable ? "HIGH" : "CRITICAL",
        companyCode: row.code,
        title: row.reachable ? `${row.code} could not be read` : `${row.code} did not answer`,
        detail: row.failure ?? "The instance gave no reason.",
      });
    } else if (row.status === "NOT_ENTERED") {
      attention.push({
        key: `empty-${row.companyId}`,
        severity: "MEDIUM",
        companyCode: row.code,
        title: `${row.code} has no transactions in ${taxYear}`,
        detail: "The instance answered but returned no sales, purchases or expenses, so every figure is zero.",
      });
    }

    // An unreachable company already carries a CRITICAL line; its defaulted profile is noise on top.
    if (row.profileMissing && row.reachable && row.status !== "UNREADABLE") {
      attention.push({
        key: `profile-${row.companyId}`,
        severity: "MEDIUM",
        companyCode: row.code,
        title: `${row.code} has no tax profile for ${taxYear}`,
        detail: "Computed on the fallback profile: regular 25%, itemized deductions, VAT-registered, no prior-year credit.",
      });
    }
  }

  if (profileLoad.notice) {
    attention.unshift({
      key: "profile-table",
      severity: "HIGH",
      companyCode: "—",
      title: "Tax profiles are unreadable",
      detail: profileLoad.notice,
    });
  }

  attention.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.companyCode.localeCompare(b.companyCode));

  return {
    rows,
    totals,
    carryovers: carryoverLoad.lots,
    carryoverNotice: carryoverLoad.notice,
    attention,
    companies,
  };
}
