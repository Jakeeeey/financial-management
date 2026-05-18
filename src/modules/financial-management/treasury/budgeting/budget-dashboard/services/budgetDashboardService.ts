import { fetchProxy } from "../../budget-creation/services/budgetService";
import { budgetApprovalService } from "../../budget-approval/services/budgetService";

const PROXY_BASE_URL = "/api/fm/treasury/budgeting/budget-creation";

export interface RawBudgetItem {
  month?: string;
  amount?: string | number;
  sum?: {
    amount?: string | number;
  };
  coa_id?: {
    account_title?: string;
  };
  division_id?: {
    division_name?: string;
  };
  department_id?: {
    department_name?: string;
  };
}

export interface DashboardMetrics {
  totalBudget: number;
  utilized: number;
  remaining: number;
  utilizationRate: number;
}

export const budgetDashboardService = {
  getDivisions: budgetApprovalService.getDivisions,

  async getMetrics(filters: { year?: string; month?: string; division_id?: string } = {}): Promise<DashboardMetrics> {
    const query = new URLSearchParams();
    
    // Only Approved budgets count towards the active budget
    query.append("filter[status][_eq]", "Approved");
    
    if (filters.year) query.append("filter[year][_eq]", filters.year);
    if (filters.month) query.append("filter[month][_eq]", filters.month);
    if (filters.division_id) query.append("filter[division_id][_eq]", filters.division_id);

    // Aggregation for Total Amount
    query.append("aggregate[sum]", "amount");

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data?: RawBudgetItem[] }>(url);
    
    // Directus aggregate result structure: { data: [ { sum: { amount: "123.45" } } ] }
    const sumData = result?.data?.[0]?.sum?.amount || 0;
    const totalBudget = Number(sumData);

    // Simulate Utilization at 70% as requested
    const utilized = totalBudget * 0.7;
    const remaining = totalBudget - utilized;
    const utilizationRate = totalBudget > 0 ? 70 : 0;

    return {
      totalBudget,
      utilized,
      remaining,
      utilizationRate,
    };
  },

  async getMonthlyTrend(year: string, divisionId?: string): Promise<{ month: string; amount: number }[]> {
    const query = new URLSearchParams();
    query.append("filter[status][_eq]", "Approved");
    query.append("filter[year][_eq]", year);
    if (divisionId) query.append("filter[division_id][_eq]", divisionId);

    query.append("aggregate[sum]", "amount");
    query.append("groupBy", "month");

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data?: RawBudgetItem[] }>(url);
    const data = result?.data || [];

    // Map into a predictable format
    return data.map((item: RawBudgetItem) => ({
      month: item.month || "",
      amount: Number(item.sum?.amount || 0)
    }));
  },

  async getCategoryDistribution(filters: { year: string; division_id?: string }): Promise<{ name: string; value: number }[]> {
    const query = new URLSearchParams({
      "filter[status][_eq]": "Approved",
      "filter[year][_eq]": filters.year,
      "fields": "amount,coa_id.account_title",
      "limit": "-1"
    });
    
    if (filters.division_id) {
      query.append("filter[division_id][_eq]", filters.division_id);
    }

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data?: RawBudgetItem[] }>(url);
    const data = result?.data || [];

    // Aggregate in code for reliability with relational fields
    const distributionMap: Record<string, number> = {};
    
    data.forEach((item: RawBudgetItem) => {
      const name = item.coa_id?.account_title || "Uncategorized";
      const amount = Number(item.amount || 0);
      distributionMap[name] = (distributionMap[name] || 0) + amount;
    });

    return Object.entries(distributionMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10 categories
  },

  async getDivisionComparison(year: string): Promise<{ name: string; allocated: number; actual: number }[]> {
    const query = new URLSearchParams({
      "filter[status][_eq]": "Approved",
      "filter[year][_eq]": year,
      "fields": "amount,division_id.division_name",
      "limit": "-1"
    });

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data?: RawBudgetItem[] }>(url);
    const data = result?.data || [];

    const divMap: Record<string, number> = {};
    data.forEach((b: RawBudgetItem) => {
      const name = b.division_id?.division_name || "Unknown";
      divMap[name] = (divMap[name] || 0) + Number(b.amount || 0);
    });

    return Object.entries(divMap).map(([name, allocated]) => ({
      name,
      allocated,
      // Simulate actual between 60% and 110% of allocated
      actual: allocated * (0.6 + Math.random() * 0.5)
    }));
  },

  async getDepartmentUtilization(filters: { year: string; division_id?: string }): Promise<{ name: string; spent: number; total: number; utilization: number }[]> {
    const query = new URLSearchParams({
      "filter[status][_eq]": "Approved",
      "filter[year][_eq]": filters.year,
      "fields": "amount,department_id.department_name",
      "limit": "-1"
    });
    if (filters.division_id) query.append("filter[division_id][_eq]", filters.division_id);

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data?: RawBudgetItem[] }>(url);
    const data = result?.data || [];

    const deptMap: Record<string, number> = {};
    data.forEach((b: RawBudgetItem) => {
      const name = b.department_id?.department_name || "Unknown";
      deptMap[name] = (deptMap[name] || 0) + Number(b.amount || 0);
    });

    return Object.entries(deptMap).map(([name, total]) => {
      // Variance between 60% and 110%
      const variance = 0.6 + Math.random() * 0.5;
      const spent = total * variance;
      return {
        name,
        total,
        spent,
        utilization: Math.round(variance * 100)
      };
    }).sort((a, b) => b.utilization - a.utilization).slice(0, 5);
  },

  async getPendingSummary(): Promise<{ total: number; highPriority: number; value: number }> {
    const query = new URLSearchParams({
      "filter[status][_eq]": "Pending",
      "fields": "amount",
      "limit": "-1"
    });

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data?: RawBudgetItem[] }>(url);
    const data = result?.data || [];

    let totalValue = 0;
    let highPriorityCount = 0;

    data.forEach((b: RawBudgetItem) => {
      const amt = Number(b.amount || 0);
      totalValue += amt;
      if (amt > 10000) highPriorityCount++;
    });

    return {
      total: data.length,
      highPriority: highPriorityCount,
      value: totalValue
    };
  }
};


