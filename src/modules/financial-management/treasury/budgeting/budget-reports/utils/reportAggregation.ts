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
  const groupMap: Record<string, { label: string; subLabel: string; budgeted: number; utilized: number }> = {};

  if (reportId === "summary") {
    // Group by Department
    rawItems.forEach(item => {
      const key = item.department.toUpperCase();
      if (!groupMap[key]) groupMap[key] = { label: key, subLabel: "", budgeted: 0, utilized: 0 };
      groupMap[key].budgeted += item.amount;
      groupMap[key].utilized += item.utilized || 0;
    });
  } else if (reportId === "account-wise") {
    // Group by account identity so rows without GL codes do not collapse together.
    rawItems.forEach(item => {
      const key = item.coaId || item.accountCode || item.accountTitle || "N/A";
      if (!groupMap[key]) groupMap[key] = { label: item.accountCode || "N/A", subLabel: item.accountTitle.toUpperCase(), budgeted: 0, utilized: 0 };
      groupMap[key].budgeted += item.amount;
      groupMap[key].utilized += item.utilized || 0;
    });
  } else if (reportId === "utilization") {
    // Group by Department and Account Title
    rawItems.forEach(item => {
      const key = `${item.department.toUpperCase()}|${item.accountTitle.toUpperCase()}`;
      if (!groupMap[key]) groupMap[key] = { label: item.department.toUpperCase(), subLabel: item.accountTitle.toUpperCase(), budgeted: 0, utilized: 0 };
      groupMap[key].budgeted += item.amount;
      groupMap[key].utilized += item.utilized || 0;
    });
  }

  // Sort and map to final structure.
  return Object.entries(groupMap)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([, vals]) => {
      const utilized = vals.utilized;
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
  return `${num.toFixed(2)}%`;
};
