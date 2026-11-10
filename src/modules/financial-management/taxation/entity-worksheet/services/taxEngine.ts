import "server-only";

import type {
  CostBasis,
  EntityProfile,
  QuarterFigures,
  TaxComputation,
  TaxRates,
  TaxScenario,
  VatComputation,
  WorksheetLine,
} from "../types";
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

/**
 * The arithmetic from the tax desk document, and nothing else.
 *
 * Every figure that arrives here was summed from the company's own tables; this
 * file decides what those sums *mean* for 1702Q/1702, 2550Q and 2551Q.
 *
 * Two rules the document states and this file keeps: the regular rate applies to net
 * taxable income (deductions included), while MCIT is 2% of gross income and ignores
 * them, so the tax is the higher of the two. Gross income already nets returns and
 * discounts, so nothing here subtracts them twice.
 */

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

const FALLBACK_RATES: TaxRates = {
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
  source: "DEFAULTS",
  missing: [],
};

function registeredOnly(profile: EntityProfile, value: number): number {
  if (profile.regime === "REGULAR") return value;
  return (value * profile.registeredShare) / 100;
}

/** Cost of sales under one of the two readings the desk shows side by side. */
function costOfSales(figures: QuarterFigures[], basis: CostBasis): number[] {
  return figures.map((quarter) =>
    basis === "PRODUCT_COST" ? quarter.cogsProductCost + quarter.icPurchases : quarter.purchases + quarter.icPurchases,
  );
}

function scenarioFor(
  figures: QuarterFigures[],
  profile: EntityProfile,
  rates: TaxRates,
  basis: CostBasis,
  creditsPerQuarter: number[],
): TaxScenario {
  const cost = costOfSales(figures, basis);
  const grossIncome = figures.map((quarter, index) =>
    round(quarter.sales + quarter.icSales - quarter.returns - quarter.discounts - cost[index]),
  );

  const deductions = figures.map((quarter, index) => {
    if (profile.deductionMethod === "OSD") return round(grossIncome[index] * rates.osd);
    return round(profile.regime === "REGULAR" ? quarter.expenses : registeredOnly(profile, quarter.expenses));
  });

  const nolcoUsed = figures.map(() => 0);
  const netTaxableIncome = figures.map((_, index) =>
    round(Math.max(0, grossIncome[index] - deductions[index] - nolcoUsed[index])),
  );

  const annualNti = round(sum(netTaxableIncome));
  const smallCorporation =
    annualNti <= rates.smallCorporateNtiCeiling && profile.assetsExcludingLand <= rates.smallCorporateAssetCeiling;
  const rate =
    profile.regime === "SCIT"
      ? rates.scit
      : profile.regime === "INCOME_TAX_HOLIDAY"
        ? 0
        : smallCorporation
          ? rates.smallCorporate
          : rates.corporate;

  const mcitApplies = profile.taxableYearOfOperations >= rates.mcitStartYear && profile.regime === "REGULAR";
  const taxDue: number[] = [];
  const payable: number[] = [];
  let cumulativeIncome = 0;
  let cumulativeGross = 0;
  let cumulativeCredits = profile.priorYearExcessCredit;
  let paidEarlier = 0;

  figures.forEach((_, index) => {
    cumulativeIncome += netTaxableIncome[index];
    // MCIT is charged on gross income: sales net of returns and discounts, less cost of sales.
    cumulativeGross += grossIncome[index];
    cumulativeCredits += creditsPerQuarter[index];

    // SCIT is 5% of gross income by definition, not of net taxable income.
    const regular = round(profile.regime === "SCIT" ? cumulativeGross * rates.scit : cumulativeIncome * rate);
    const mcit = mcitApplies ? round(cumulativeGross * rates.mcit) : 0;
    const due = Math.max(regular, mcit);
    const quarterPayable = Math.max(0, round(due - cumulativeCredits - paidEarlier));

    taxDue.push(due);
    payable.push(quarterPayable);
    paidEarlier = round(paidEarlier + quarterPayable);
  });

  const annualGross = round(sum(grossIncome));
  const annualDeductions = round(sum(deductions));
  const annualRegular = round(profile.regime === "SCIT" ? annualGross * rates.scit : annualNti * rate);
  const annualMcit = mcitApplies ? round(annualGross * rates.mcit) : 0;
  const annualDue = Math.max(annualRegular, annualMcit);
  const annualCredits = round(sum(creditsPerQuarter) + profile.priorYearExcessCredit);

  return {
    basis,
    label: basis === "PRODUCT_COST" ? "Product standard cost" : "Purchase orders",
    grossIncome,
    deductions,
    netTaxableIncome,
    taxDue,
    payable,
    annual: {
      grossIncome: annualGross,
      deductions: annualDeductions,
      netTaxableIncome: annualNti,
      regular: annualRegular,
      mcit: annualMcit,
      taxDue: annualDue,
      netPosition: round(annualDue - annualCredits),
    },
    mcitApplied: annualMcit > annualRegular,
    smallCorporation,
    rate,
  };
}

export function computeTax(
  figures: QuarterFigures[],
  profile: EntityProfile,
  rates: TaxRates = FALLBACK_RATES,
): TaxComputation {
  const notices: string[] = [];
  const creditsPerQuarter = figures.map((quarter) => quarter.cwt);

  const scenarios = [
    scenarioFor(figures, profile, rates, "PRODUCT_COST", creditsPerQuarter),
    scenarioFor(figures, profile, rates, "PURCHASES", creditsPerQuarter),
  ];
  const primary = scenarios[0];

  if (profile.regime === "SCIT") {
    notices.push("SCIT applies 5% to gross income; deductions are shown for completeness only.");
  }
  if (profile.regime === "INCOME_TAX_HOLIDAY") {
    notices.push("Income tax holiday: 0% income tax. Still file 1702Q with the holiday figures.");
  }
  if (!profile.vatRegistered) {
    notices.push(`Not VAT-registered: 2551Q percentage tax at ${(rates.percentage * 100).toFixed(0)}% applies instead of 2550Q.`);
  }
  if (rates.source === "DATABASE" && rates.missing.length > 0) {
    notices.push(
      `tax_rates supplied ${rates.missing.length === 8 ? "no" : "some"} of the eight rates; ${rates.missing.join(", ")} fall back to the built-in defaults.`,
    );
  }
  if (rates.source === "DEFAULTS") {
    notices.push("No tax_rates row answered on this instance, so every rate is the built-in default.");
  }

  return {
    grossIncome: primary.grossIncome,
    deductions: primary.deductions,
    osdAmount: figures.map((quarter, index) =>
      profile.deductionMethod === "OSD" ? round(primary.grossIncome[index] * rates.osd) : 0,
    ),
    nolcoUsed: figures.map(() => 0),
    netTaxableIncome: primary.netTaxableIncome,
    taxDue: primary.taxDue,
    taxCredits: figures.map((_, index) => round(profile.priorYearExcessCredit + sum(creditsPerQuarter.slice(0, index + 1)))),
    payable: primary.payable,
    annual: {
      grossIncome: primary.annual.grossIncome,
      deductions: primary.annual.deductions,
      netTaxableIncome: primary.annual.netTaxableIncome,
      taxDue: primary.annual.taxDue,
      taxCredits: round(sum(creditsPerQuarter) + profile.priorYearExcessCredit),
      netPosition: primary.annual.netPosition,
    },
    regimeApplied: profile.regime,
    rateApplied: primary.rate,
    smallCorporation: primary.smallCorporation,
    mcitApplied: primary.mcitApplied,
    notices,
    scenarios,
    rates,
  };
}

export function computeVat(
  figures: QuarterFigures[],
  profile: EntityProfile,
  rates: TaxRates = FALLBACK_RATES,
): VatComputation {
  const outputVat = figures.map((quarter) => round(quarter.salesVat));
  const inputVat = figures.map((quarter) => round(quarter.purchasesVat));

  if (!profile.vatRegistered) {
    const percentage = figures.map((quarter) => round((quarter.sales + quarter.icSales) * rates.percentage));
    return {
      outputVat: figures.map(() => 0),
      inputVat: figures.map(() => 0),
      netVat: figures.map(() => 0),
      payable: percentage,
      carriedIn: figures.map(() => 0),
    };
  }

  const netVat = outputVat.map((output, index) => round(output - inputVat[index]));
  const carriedIn: number[] = [];
  const payable: number[] = [];
  let carry = 0;

  netVat.forEach((net) => {
    carriedIn.push(round(carry));
    const settled = round(net - carry);
    payable.push(Math.max(0, settled));
    carry = settled < 0 ? round(-settled) : 0;
  });

  return { outputVat, inputVat, netVat, payable, carriedIn };
}

/** Builds the worksheet rows exactly as the document numbers them. */
export function buildLines(
  figures: QuarterFigures[],
  computation: TaxComputation,
  profile: EntityProfile,
): WorksheetLine[] {
  const column = (pick: (quarter: QuarterFigures, index: number) => number) =>
    figures.map((quarter, index) => round(pick(quarter, index)));

  const sales = column((quarter) => quarter.sales);
  const icSales = column((quarter) => quarter.icSales);
  const returnsAndDiscounts = column((quarter) => quarter.returns + quarter.discounts);
  const productCost = column((quarter) => quarter.cogsProductCost);
  const purchases = column((quarter) => quarter.purchases);
  const icPurchases = column((quarter) => quarter.icPurchases);
  const expenses = column((quarter) => quarter.expenses);
  const cwt = column((quarter) => quarter.cwt);

  const line = (
    lineNo: string,
    label: string,
    values: number[],
    section: WorksheetLine["section"],
    hint?: string,
    emphasis?: boolean,
    /**
     * Cumulative rows (1702Q is year-to-date) must not be added up: the year figure is the
     * Q4 value, not the sum of four running totals.
     */
    yearMode: "SUM" | "LAST" = "SUM",
  ): WorksheetLine => ({
    key: lineNo,
    lineNo,
    label,
    hint,
    section,
    source: emphasis ? "COMPUTED" : "DERIVED",
    values,
    yearValue: round(yearMode === "LAST" ? (values[values.length - 1] ?? 0) : sum(values)),
    emphasis,
  });

  const lines: WorksheetLine[] = [
    line("1", "Sales / receipts from outside customers", sales, "INCOME", "VAT-exclusive; group sales excluded"),
    line("1a", "Sales to group companies", icSales, "INCOME", "Matched from the intercompany ledger"),
    line("2", "Less: returns, allowances, discounts", returnsAndDiscounts, "INCOME"),
    line(
      "3",
      "Less: cost of sales, product standard cost",
      productCost,
      "INCOME",
      "Quantity sold × products.cost_per_unit - the headline basis",
    ),
    line("3a", "Less: cost of sales from group companies", icPurchases, "INCOME"),
    line(
      "3b",
      "Less: cost of sales if purchase orders are used",
      purchases,
      "INCOME",
      "The other reading; see the comparison below the sheet",
    ),
    line("4", "Other taxable income", figures.map(() => 0), "INCOME", "No source table − reported as zero"),
    line("5", "Gross income", computation.grossIncome, "INCOME", "Line 1 + 1a, less line 2, 3 and 3a", true),
    line("6", "Operating expenses from outside parties", expenses, "DEDUCTIONS"),
    line("6b", "Less: non-deductible expenses in line 6", figures.map(() => 0), "DEDUCTIONS", "No source table"),
  ];

  if (profile.deductionMethod === "OSD") {
    lines.push(line("6c", "Optional standard deduction (40%)", computation.osdAmount, "DEDUCTIONS", undefined, true));
  }

  lines.push(
    line("8", "Less: NOLCO applied", computation.nolcoUsed, "DEDUCTIONS", "Carryover lots live on the overview"),
    line("9", "Net taxable income", computation.netTaxableIncome, "DEDUCTIONS", undefined, true),
    line("10", "Income tax due, year to date", computation.taxDue, "TAX", "1702Q is cumulative", false, "LAST"),
    line("11", "Tax withheld by outside customers", cwt, "TAX"),
    line("12", "Payable on this return", computation.payable, "TAX", undefined, true),
  );

  return lines;
}

export function percentageTaxDue(figures: QuarterFigures[], rate: number = PERCENTAGE_TAX_RATE): number {
  return round(sum(figures.map((quarter) => (quarter.sales + quarter.icSales) * rate)));
}

export const RATES = { VAT_RATE, CORPORATE_RATE, MCIT_RATE, OSD_RATE };



