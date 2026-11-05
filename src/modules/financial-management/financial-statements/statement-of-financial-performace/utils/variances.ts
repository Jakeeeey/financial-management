export function getDisplayedFinancialPerformanceAmount(amount: number, isNegativeFormat = false): number {
  return isNegativeFormat ? -Math.abs(amount) : amount;
}

export function getFinancialPerformanceChange(
  current: number | undefined,
  previous: number | undefined,
  isNegativeFormat = false,
): number | undefined {
  if (current === undefined || previous === undefined) return undefined;

  const currentDisplay = getDisplayedFinancialPerformanceAmount(current, isNegativeFormat);
  const previousDisplay = getDisplayedFinancialPerformanceAmount(previous, isNegativeFormat);
  return Math.round((currentDisplay - previousDisplay) * 100) / 100;
}

export function formatFinancialPerformanceChange(
  change: number,
  formatAmount: (amount: number) => string,
): string {
  const roundedChange = Math.round(change * 100) / 100;
  if (roundedChange === 0) return "No change";

  const direction = roundedChange > 0 ? "Increased" : "Decreased";
  return `${direction} by ${formatAmount(Math.abs(roundedChange))}`;
}

export function getFinancialPerformanceRatioChange(
  current: number | null | undefined,
  previous: number | null | undefined,
): number | undefined {
  if (current == null || previous == null) return undefined;
  return Math.round((current - previous) * 100) / 100;
}

export function formatFinancialPerformanceRatioChange(change: number): string {
  const roundedChange = Math.round(change * 100) / 100;
  if (roundedChange === 0) return "No change";

  const direction = roundedChange > 0 ? "Increased" : "Decreased";
  return `${direction} by ${Math.abs(roundedChange).toFixed(2)} percentage points`;
}
