import type {
  CashFlowActivityFilter,
  CashFlowEntry,
  CashFlowSortField,
  CashFlowSortOrder,
  GroupedCashFlowEntries,
} from "../types/cash-flow.schema";
import { classifyCashFlowActivity } from "../services/cash-flow.service";

export function flattenCashFlowEntries(grouped: GroupedCashFlowEntries): CashFlowEntry[] {
  return [...grouped.operating, ...grouped.investing, ...grouped.financing, ...grouped.other];
}

export function filterCashFlowEntries(
  entries: CashFlowEntry[],
  search: string,
  activity: CashFlowActivityFilter,
): CashFlowEntry[] {
  const query = search.trim().toLowerCase();
  return entries.filter(entry => {
    const matchesSearch = !query
      || entry.transactionRef?.toLowerCase().includes(query)
      || entry.cashFlowActivity?.toLowerCase().includes(query);
    const category = classifyCashFlowActivity(entry.cashFlowActivity);
    const matchesActivity = activity === "all"
      || (activity === "uncategorized" ? category === "other" : category === activity);
    return Boolean(matchesSearch && matchesActivity);
  });
}

export function sortCashFlowEntries(
  entries: CashFlowEntry[],
  field: CashFlowSortField,
  order: CashFlowSortOrder,
): CashFlowEntry[] {
  const direction = order === "asc" ? 1 : -1;
  return [...entries].sort((left, right) => {
    let a: number | string;
    let b: number | string;
    switch (field) {
      case "transactionDate":
        a = left.transactionDate ? new Date(left.transactionDate).getTime() : 0;
        b = right.transactionDate ? new Date(right.transactionDate).getTime() : 0;
        break;
      case "netCashFlow":
        a = left.netCashFlow ?? 0;
        b = right.netCashFlow ?? 0;
        break;
      case "cashFlowActivity":
        a = left.cashFlowActivity ?? "";
        b = right.cashFlowActivity ?? "";
        break;
    }
    return a < b ? -direction : a > b ? direction : 0;
  });
}

export function sumCashFlowEntries(entries: CashFlowEntry[]): number {
  return entries.reduce((sum, entry) => sum + (entry.netCashFlow ?? 0), 0);
}

export function paginateCashFlowEntries<T>(items: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(Math.max(0, page), pageCount - 1);
  const startIndex = items.length === 0 ? 0 : currentPage * pageSize;
  return {
    items: items.slice(startIndex, startIndex + pageSize),
    page: currentPage,
    pageCount,
    startIndex,
    endIndex: Math.min(startIndex + pageSize, items.length),
  };
}
