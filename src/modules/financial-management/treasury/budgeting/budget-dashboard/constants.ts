export const DASHBOARD_METRICS = {
  totalBudget: 15450000,
  utilized: 11587500,
  remaining: 3862500,
  utilizationRate: 75,
};

export const BUDGET_VS_ACTUAL_DATA = [
  { name: "Industrial", allocated: 5000000, actual: 4200000 },
  { name: "Corporate", allocated: 3500000, actual: 2800000 },
  { name: "Logistics", allocated: 2500000, actual: 2650000 }, // Over budget
  { name: "HR & Admin", allocated: 1500000, actual: 1100000 },
  { name: "I.T.", allocated: 2950000, actual: 2100000 },
];

export const MONTHLY_TREND_DATA = [
  { month: "Jan", utilization: 45 },
  { month: "Feb", utilization: 52 },
  { month: "Mar", utilization: 48 },
  { month: "Apr", utilization: 61 },
  { month: "May", utilization: 75 },
  { month: "Jun", utilization: 0 },
  { month: "Jul", utilization: 0 },
  { month: "Aug", utilization: 0 },
  { month: "Sep", utilization: 0 },
  { month: "Oct", utilization: 0 },
  { month: "Nov", utilization: 0 },
  { month: "Dec", utilization: 0 },
];

export const CATEGORY_DISTRIBUTION_DATA = [
  { name: "Salaries & Wages", value: 45, color: "#0D9488" },
  { name: "Office Supplies", value: 15, color: "#0891B2" },
  { name: "Utilities", value: 10, color: "#2563EB" },
  { name: "Travel & Transpo", value: 12, color: "#4F46E5" },
  { name: "Maintenance", value: 8, color: "#7C3AED" },
  { name: "Marketing", value: 10, color: "#9333EA" },
];

export const OVER_UTILIZED_DEPTS = [
  { name: "Logistics - Delivery", utilization: 104, total: 1200000, spent: 1248000 },
  { name: "I.T. - Infrastructure", utilization: 96, total: 850000, spent: 816000 },
  { name: "Industrial - Production", utilization: 92, total: 2500000, spent: 2300000 },
  { name: "Corporate - Sales", utilization: 89, total: 1500000, spent: 1335000 },
  { name: "HR - Recruitment", utilization: 85, total: 450000, spent: 382500 },
];

export const PENDING_SUMMARY = {
  total: 12,
  highPriority: 4,
  value: 450000,
};

