import type { TrialBalanceItem } from "../types/trial-balance.schema";

export const TRIAL_BALANCE_CATEGORY_ORDER = ["Assets", "Liabilities", "Equity", "Revenue", "Expenses", "Other"] as const;

export type TrialBalanceAccountSortKey = "glCode" | "accountTitle" | "totalDebit" | "totalCredit" | "netBalance";
export type TrialBalanceSortDirection = "asc" | "desc";

export interface TrialBalanceAccountGroup {
  category: (typeof TRIAL_BALANCE_CATEGORY_ORDER)[number];
  accounts: TrialBalanceItem[];
}

export interface TrialBalanceCategorySubtotal {
  totalDebit: number;
  totalCredit: number;
  netMovement: number;
  movementType: "Debit movement" | "Credit movement" | "No net movement";
}

export function normalizeTrialBalanceCategory(category: string): TrialBalanceAccountGroup["category"] {
  return TRIAL_BALANCE_CATEGORY_ORDER.find(value => value.toLowerCase() === category.trim().toLowerCase()) ?? "Other";
}

export function groupTrialBalanceAccounts(items: TrialBalanceItem[]): TrialBalanceAccountGroup[] {
  const groups = new Map<TrialBalanceAccountGroup["category"], TrialBalanceItem[]>();
  for (const item of items) {
    const category = normalizeTrialBalanceCategory(item.accountCategory);
    const accounts = groups.get(category) ?? [];
    accounts.push(item);
    groups.set(category, accounts);
  }

  return TRIAL_BALANCE_CATEGORY_ORDER.flatMap(category => {
    const accounts = groups.get(category);
    return accounts ? [{ category, accounts }] : [];
  });
}

export function compareTrialBalanceAccounts(
  left: TrialBalanceItem,
  right: TrialBalanceItem,
  sortKey: TrialBalanceAccountSortKey,
): number {
  if (sortKey === "glCode" || sortKey === "accountTitle") {
    return left[sortKey].localeCompare(right[sortKey], "en", { numeric: true, sensitivity: "base" });
  }
  if (sortKey === "netBalance") {
    const leftMovement = left.balanceType.toLowerCase() === "credit" ? -left.netBalance : left.netBalance;
    const rightMovement = right.balanceType.toLowerCase() === "credit" ? -right.netBalance : right.netBalance;
    return leftMovement - rightMovement;
  }
  return left[sortKey] - right[sortKey];
}

export function sortTrialBalanceAccounts(
  items: TrialBalanceItem[],
  sortKey: TrialBalanceAccountSortKey,
  direction: TrialBalanceSortDirection,
): TrialBalanceItem[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return groupTrialBalanceAccounts(items).flatMap(group =>
    [...group.accounts].sort((left, right) => multiplier * compareTrialBalanceAccounts(left, right, sortKey)),
  );
}

export function calculateTrialBalanceCategorySubtotal(items: TrialBalanceItem[]): TrialBalanceCategorySubtotal {
  const totalDebitCentavos = items.reduce((sum, item) => sum + Math.round(item.totalDebit * 100), 0);
  const totalCreditCentavos = items.reduce((sum, item) => sum + Math.round(item.totalCredit * 100), 0);
  const netCentavos = totalDebitCentavos - totalCreditCentavos;

  return {
    totalDebit: totalDebitCentavos / 100,
    totalCredit: totalCreditCentavos / 100,
    netMovement: Math.abs(netCentavos) / 100,
    movementType: netCentavos === 0 ? "No net movement" : netCentavos > 0 ? "Debit movement" : "Credit movement",
  };
}
