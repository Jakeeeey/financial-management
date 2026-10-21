import { formatCurrency } from "@/lib/utils";
import type { TrialBalanceItem, TrialBalanceReportContext, TrialBalanceSummaryData } from "../types/trial-balance.schema";

export function calculateTrialBalanceSummary(
  items: TrialBalanceItem[],
  context: TrialBalanceReportContext | null,
): TrialBalanceSummaryData {
  // Account totals arrive rounded to two decimals; sum their centavos exactly.
  const totalDebitCentavos = items.reduce((sum, item) => sum + Math.round(item.totalDebit * 100), 0);
  const totalCreditCentavos = items.reduce((sum, item) => sum + Math.round(item.totalCredit * 100), 0);
  const differenceCentavos = totalDebitCentavos - totalCreditCentavos;
  const isCompleteReport = context !== null
    && !context.search.trim()
    && context.accountCategory === "all"
    && context.reviewFlag === "all"
    && !context.divisionName.trim()
    && !context.departmentName.trim()
    && context.sourceModule.length === 0;

  return {
    totalDebit: totalDebitCentavos / 100,
    totalCredit: totalCreditCentavos / 100,
    difference: differenceCentavos / 100,
    accountCount: items.length,
    isBalanced: differenceCentavos === 0,
    scope: isCompleteReport ? "report" : "filtered",
  };
}

export function getTrialBalanceDifferenceMessage(difference: number): string {
  if (difference === 0) return "Debits and credits match";
  const direction = difference > 0 ? "Debits exceed credits" : "Credits exceed debits";
  return `${direction} by ${formatCurrency(Math.abs(difference))}`;
}
