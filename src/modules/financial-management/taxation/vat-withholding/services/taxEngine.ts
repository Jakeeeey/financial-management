import "server-only";

import type { EntityProfile, QuarterFigures, VatComputation } from "../types";
import { PERCENTAGE_TAX_RATE } from "../constants";

/**
 * The VAT arithmetic from the tax desk document, and nothing else.
 *
 * Every figure that arrives here was summed from the company's own tables; this file
 * decides what those sums mean for 2550Q (VAT) or 2551Q (percentage tax).
 */

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

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
