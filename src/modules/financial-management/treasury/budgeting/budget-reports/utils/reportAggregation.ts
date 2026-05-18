import { AllocationReportItem } from "../types";

export interface AggregatedRow {
  label: string;
  subLabel: string;
  budgeted: number;
  utilized: number;
  remaining: number;
  percentage: number;
}

export interface DivisionGroup {
  division: string;
  items: AggregatedRow[];
  subtotal: {
    budgeted: number;
    utilized: number;
    remaining: number;
    percentage: number;
  };
}

/**
 * Aggregates raw budget items into report-specific groupings
 */
export const aggregateBudgetData = (
  reportId: string, 
  rawItems: AllocationReportItem[]
): AggregatedRow[] => {
  const groupMap: Record<string, { label: string; subLabel: string; budgeted: number }> = {};

  if (reportId === "summary") {
    // Group by Department
    rawItems.forEach(item => {
      const key = item.department.toUpperCase();
      if (!groupMap[key]) groupMap[key] = { label: key, subLabel: "", budgeted: 0 };
      groupMap[key].budgeted += item.amount;
    });
  } else if (reportId === "account-wise") {
    // Group by GL Code
    rawItems.forEach(item => {
      const key = item.accountCode || "N/A";
      if (!groupMap[key]) groupMap[key] = { label: key, subLabel: item.accountTitle.toUpperCase(), budgeted: 0 };
      groupMap[key].budgeted += item.amount;
    });
  } else if (reportId === "utilization") {
    // Group by Account Title
    rawItems.forEach(item => {
      const key = item.accountTitle.toUpperCase();
      if (!groupMap[key]) groupMap[key] = { label: key, subLabel: "", budgeted: 0 };
      groupMap[key].budgeted += item.amount;
    });
  }

  // Sort and Map to final structure safely (defaulting utilized to 0 since backend source is not yet active)
  return Object.entries(groupMap)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, vals]) => {
      const utilized = 0; // Deterministic default until live backend integration is prepared
      const remaining = vals.budgeted - utilized;
      const percentage = vals.budgeted > 0 ? (utilized / vals.budgeted) * 100 : 0;

      return {
        label: vals.label,
        subLabel: vals.subLabel,
        budgeted: vals.budgeted,
        utilized,
        remaining,
        percentage
      };
    });
};

/**
 * Formats currency values consistently
 */
export const formatCurrency = (num: number) => {
  return num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/**
 * Formats percentage values consistently
 */
export const formatPercentage = (num: number) => {
  return `${num.toFixed(1)}%`;
};
