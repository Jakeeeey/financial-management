import { differenceInDays } from "date-fns";

/**
 * Calculates depreciated value using: Total Cost / Life Span (year)
 */
export function getDepreciatedValue(
  unitCost: number,
  quantity: number,
  lifeSpanYears: number, // Formula: Cost / Life Span (year)
  dateAcquired: string | Date,
  projectionDate: Date = new Date(),
) {
  const totalInitialCost = unitCost * quantity;

  // Guard against division by zero
  if (!lifeSpanYears || lifeSpanYears <= 0) return 0;

  const startDate = new Date(dateAcquired);

  // Calculate years elapsed based on days (365.25 to account for leap years)
  const daysElapsed = Math.max(0, differenceInDays(projectionDate, startDate));
  const yearsElapsed = daysElapsed / 365.25;

  // Formula: (Total Cost / Life Span Year) = Annual Depreciation
  const annualDepreciation = totalInitialCost / lifeSpanYears;

  // Current Value = Initial Cost - (Annual Depreciation * Years Passed)
  const currentValue = totalInitialCost - annualDepreciation * yearsElapsed;

  // Ensure value never drops below ₱0.00
  return Math.max(0, currentValue);
}

export const formatPHP = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount);
};
