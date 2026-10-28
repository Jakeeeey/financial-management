import type { FinancialPerformanceEntry } from "../types/financial-performance.schema";

export interface AlignedFinancialPerformanceEntry {
  key: string;
  current: FinancialPerformanceEntry | null;
  comparison: FinancialPerformanceEntry | null;
}

function normalizeDimension(value: string | null | undefined): string {
  return value?.trim().toLocaleLowerCase() ?? "";
}

export function financialPerformanceEntryKey(entry: FinancialPerformanceEntry): string {
  const accountIdentity = entry.coaId != null
    ? ["coa", String(entry.coaId)]
    : ["legacy", normalizeDimension(entry.glCode), normalizeDimension(entry.accountTitle)];

  return JSON.stringify([
    ...accountIdentity,
    normalizeDimension(entry.reportSection),
    normalizeDimension(entry.division),
    normalizeDimension(entry.department),
  ]);
}

export function alignFinancialPerformanceEntries(
  currentEntries: FinancialPerformanceEntry[],
  comparisonEntries: FinancialPerformanceEntry[] = [],
): AlignedFinancialPerformanceEntry[] {
  const comparisonByKey = new Map(comparisonEntries.map(entry => [financialPerformanceEntryKey(entry), entry]));
  const currentKeys = new Set<string>();
  const aligned: AlignedFinancialPerformanceEntry[] = currentEntries.map(current => {
    const key = financialPerformanceEntryKey(current);
    currentKeys.add(key);
    return { key, current, comparison: comparisonByKey.get(key) ?? null };
  });

  for (const comparison of comparisonEntries) {
    const key = financialPerformanceEntryKey(comparison);
    if (!currentKeys.has(key)) aligned.push({ key, current: null, comparison });
  }

  return aligned;
}
