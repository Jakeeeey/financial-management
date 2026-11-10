import "server-only";

import type {
  EntityProfile,
  QuarterFigures,
  TaxComputation,
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
 */

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function registeredOnly(profile: EntityProfile, value: number): number {
  if (profile.regime === "REGULAR") return value;
  return (value * profile.registeredShare) / 100;
}

export function computeTax(figures: QuarterFigures[], profile: EntityProfile): TaxComputation {
  const notices: string[] = [];

  const grossIncome = figures.map(
    (quarter) =>
      quarter.sales + quarter.icSales - quarter.returns - quarter.purchases - quarter.icPurchases,
  );

  const smallCorporation =
    sum(grossIncome) <= SMALL_CORPORATION_NTI_CEILING &&
    profile.assetsExcludingLand <= SMALL_CORPORATION_ASSET_CEILING;

  const rate =
    profile.regime === "SCIT"
      ? 0.05
      : profile.regime === "INCOME_TAX_HOLIDAY"
        ? 0
        : smallCorporation
          ? SMALL_CORPORATION_RATE
          : CORPORATE_RATE;

  const osdAmount = figures.map((_, index) =>
    profile.deductionMethod === "OSD" ? round(grossIncome[index] * OSD_RATE) : 0,
  );

  const deductions = figures.map((quarter, index) => {
    if (profile.deductionMethod === "OSD") return osdAmount[index];
    const itemized = quarter.expenses;
    return round(profile.regime === "REGULAR" ? itemized : registeredOnly(profile, itemized));
  });

  const nolcoUsed = figures.map(() => 0);
  const netTaxableIncome = figures.map((_, index) =>
    round(Math.max(0, grossIncome[index] - deductions[index] - nolcoUsed[index])),
  );

  const payableAndDue = figures.map(() => ({ due: 0, credit: 0, payable: 0 }));
  let cumulativeIncome = 0;
  let cumulativeGross = 0;
  let cumulativeCredits = 0;
  let paidEarlier = 0;

  figures.forEach((quarter, index) => {
    cumulativeIncome += netTaxableIncome[index];
    cumulativeGross += grossIncome[index] - quarter.returns;
    cumulativeCredits += quarter.cwt;

    const regular = round(cumulativeIncome * rate);
    const mcitApplies = profile.taxableYearOfOperations >= MCIT_START_YEAR && profile.regime === "REGULAR";
    const mcit = mcitApplies ? round(cumulativeGross * MCIT_RATE) : 0;
    const due = Math.max(regular, mcit);

    const payable = Math.max(0, round(due - cumulativeCredits - paidEarlier));
    payableAndDue[index] = { due, credit: cumulativeCredits, payable };
    paidEarlier += payable;
  });

  const annualGross = sum(grossIncome);
  const annualDeductions = sum(deductions);
  const annualNti = round(Math.max(0, annualGross - annualDeductions));
  const annualRegular = round(annualNti * rate);
  const annualMcit =
    profile.taxableYearOfOperations >= MCIT_START_YEAR && profile.regime === "REGULAR"
      ? round(annualGross * MCIT_RATE)
      : 0;
  const annualDue = Math.max(annualRegular, annualMcit);
  const annualCredits = round(sum(figures.map((quarter) => quarter.cwt)) + profile.priorYearExcessCredit);

  if (profile.regime === "SCIT") {
    notices.push("SCIT applies 5% to gross income; deductions are shown for completeness only.");
  }
  if (profile.regime === "INCOME_TAX_HOLIDAY") {
    notices.push("Income tax holiday: 0% income tax. Still file 1702Q with the holiday figures.");
  }
  if (!profile.vatRegistered) {
    notices.push("Not VAT-registered: 2551Q percentage tax applies instead of 2550Q.");
  }

  return {
    grossIncome,
    deductions,
    osdAmount,
    nolcoUsed,
    netTaxableIncome,
    taxDue: payableAndDue.map((entry) => entry.due),
    taxCredits: payableAndDue.map((entry) => entry.credit),
    payable: payableAndDue.map((entry) => entry.payable),
    annual: {
      grossIncome: round(annualGross),
      deductions: round(annualDeductions),
      netTaxableIncome: annualNti,
      taxDue: annualDue,
      taxCredits: annualCredits,
      netPosition: round(annualDue - annualCredits),
    },
    regimeApplied: profile.regime,
    rateApplied: rate,
    smallCorporation,
    mcitApplied: annualMcit > annualRegular,
    notices,
  };
}

export function computeVat(figures: QuarterFigures[], profile: EntityProfile): VatComputation {
  const outputVat = figures.map((quarter) => round(quarter.salesVat));
  const inputVat = figures.map((quarter) => round(quarter.purchasesVat));

  if (!profile.vatRegistered) {
    const percentage = figures.map((quarter) => round((quarter.sales + quarter.icSales) * PERCENTAGE_TAX_RATE));
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
  const returns = column((quarter) => quarter.returns);
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
  ): WorksheetLine => ({
    key: lineNo,
    lineNo,
    label,
    hint,
    section,
    source: emphasis ? "COMPUTED" : "DERIVED",
    values,
    yearValue: round(sum(values)),
    emphasis,
  });

  const lines: WorksheetLine[] = [
    line("1", "Sales / receipts from outside customers", sales, "INCOME", "VAT-exclusive; group sales excluded"),
    line("1a", "Sales to group companies", icSales, "INCOME", "Matched from the intercompany ledger"),
    line("2", "Less: returns, allowances, discounts", returns, "INCOME"),
    line("3", "Less: cost of sales from outside suppliers", purchases, "INCOME", "Purchase orders for the period"),
    line("3a", "Less: cost of sales from group companies", icPurchases, "INCOME"),
    line("4", "Other taxable income", figures.map(() => 0), "INCOME", "No source table — reported as zero"),
    line("5", "Gross income", computation.grossIncome, "INCOME", undefined, true),
    line("6", "Operating expenses from outside parties", expenses, "DEDUCTIONS"),
    line("6b", "Less: non-deductible expenses in line 6", figures.map(() => 0), "DEDUCTIONS", "No source table"),
  ];

  if (profile.deductionMethod === "OSD") {
    lines.push(line("6c", "Optional standard deduction (40%)", computation.osdAmount, "DEDUCTIONS", undefined, true));
  }

  lines.push(
    line("8", "Less: NOLCO applied", computation.nolcoUsed, "DEDUCTIONS", "Carryover lots live on the overview"),
    line("9", "Net taxable income", computation.netTaxableIncome, "DEDUCTIONS", undefined, true),
    line("10", "Income tax due, year to date", computation.taxDue, "TAX", "1702Q is cumulative"),
    line("11", "Tax withheld by outside customers", cwt, "TAX"),
    line("12", "Payable on this return", computation.payable, "TAX", undefined, true),
  );

  return lines;
}

export function percentageTaxDue(figures: QuarterFigures[]): number {
  return round(sum(figures.map((quarter) => (quarter.sales + quarter.icSales) * PERCENTAGE_TAX_RATE)));
}

export const RATES = { VAT_RATE, CORPORATE_RATE, MCIT_RATE, OSD_RATE };

