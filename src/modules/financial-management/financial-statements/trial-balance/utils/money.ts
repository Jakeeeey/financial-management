import { formatCurrency } from "@/lib/utils";
import type { TrialBalanceItem } from "../types/trial-balance.schema";

export const PERIOD_ACTIVITY_NOTE = "Amounts show activity within the applied reporting period. Opening and closing balances are not included.";
export const PESO_NUMBER_FORMAT = '"₱"#,##0.00;-"₱"#,##0.00;"₱"0.00';

export function formatTrialBalanceAmount(amount: number): string {
  return formatCurrency(Math.round(amount * 100) === 0 ? 0 : amount);
}

export function getPeriodMovementLabel(account: Pick<TrialBalanceItem, "netBalance" | "balanceType">): string {
  return Math.round(account.netBalance * 100) === 0 ? "No net movement" : `${account.balanceType} movement`;
}
