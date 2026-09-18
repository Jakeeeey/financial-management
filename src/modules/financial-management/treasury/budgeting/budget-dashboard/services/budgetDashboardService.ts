import { fetchProxy } from "../../budget-creation/services/budgetService";
import { budgetApprovalService } from "../../budget-approval/services/budgetService";

const SPRING_PROXY_URL = "/api/fm/treasury/budgeting/v-budget-utilized";

export interface VBudgetUtilizedItem {
  year?: number;
  month?: string;
  division_id?: string | number | null;
  division?: string;
  department_id?: string | number | null;
  department?: string;
  coa_id?: string | number | null;
  gl_code?: string;
  coa?: string;
  total_budget?: number | string;
  utilized?: number | string;
  percentage?: number | string;
}

export interface DashboardMetrics {
  totalBudget: number;
  utilized: number;
  remaining: number;
  utilizationRate: number;
}

function buildDateRangeParams(filters: { year?: string; month?: string; division_id?: string; department_id?: string }) {
  const query = new URLSearchParams();
  if (filters.division_id) query.append("divisionId", filters.division_id);
  if (filters.department_id) query.append("departmentId", filters.department_id);

  if (filters.year && filters.month) {
    const MONTH_NAMES = [
      "january", "february", "march", "april", "may", "june",
      "july", "august", "september", "october", "november", "december"
    ];
    
    let monthIndex = -1;
    const parsedMonthNum = parseInt(filters.month, 10);
    
    if (!isNaN(parsedMonthNum) && parsedMonthNum >= 1 && parsedMonthNum <= 12) {
      monthIndex = parsedMonthNum - 1;
    } else {
      const lowerMonth = filters.month.toLowerCase().trim();
      monthIndex = MONTH_NAMES.findIndex(m => m === lowerMonth || m.startsWith(lowerMonth.substring(0, 3)));
    }

    if (monthIndex !== -1) {
      const monthNumber = String(monthIndex + 1).padStart(2, "0");
      const lastDay = new Date(Number(filters.year), monthIndex + 1, 0).getDate();
      query.append("dateFrom", `${filters.year}-${monthNumber}-01`);
      query.append("dateTo", `${filters.year}-${monthNumber}-${lastDay}`);
    } else {
      query.append("dateFrom", `${filters.year}-01-01`);
      query.append("dateTo", `${filters.year}-12-31`);
    }
  } else if (filters.year) {
    query.append("dateFrom", `${filters.year}-01-01`);
    query.append("dateTo", `${filters.year}-12-31`);
  }

  return query;
}

export const budgetDashboardService = {
  getDivisions: budgetApprovalService.getDivisions,
  getDepartments: budgetApprovalService.getDepartments,

  async fetchVBudgetUtilized(filters: { year?: string; month?: string; division_id?: string; department_id?: string } = {}): Promise<VBudgetUtilizedItem[]> {
    const query = buildDateRangeParams(filters);
    const url = `${SPRING_PROXY_URL}?${query.toString()}`;
    try {
      const res = await fetchProxy<Record<string, unknown> | Record<string, unknown>[]>(url);
      let rawList: Record<string, unknown>[] = [];
      if (Array.isArray(res)) {
        rawList = res as Record<string, unknown>[];
      } else if (res && typeof res === "object" && "data" in res && Array.isArray((res as { data: unknown }).data)) {
        rawList = (res as { data: Record<string, unknown>[] }).data;
      } else if (res && typeof res === "object" && "content" in res && Array.isArray((res as { content: unknown }).content)) {
        rawList = (res as { content: Record<string, unknown>[] }).content;
      }

      // Property normalization (handles both snake_case and camelCase from Spring Boot Entity/DTO)
      return rawList.map(item => ({
        year: item.year ? Number(item.year) : undefined,
        month: item.month as string | undefined,
        division_id: (item.division_id ?? item.divisionId ?? null) as string | number | null,
        division: (item.division ?? item.divisionName ?? "Unassigned Division") as string,
        department_id: (item.department_id ?? item.departmentId ?? null) as string | number | null,
        department: (item.department ?? item.departmentName ?? "Unassigned Department") as string,
        coa_id: (item.coa_id ?? item.coaId ?? null) as string | number | null,
        gl_code: (item.gl_code ?? item.glCode ?? "N/A") as string,
        coa: (item.coa ?? item.accountTitle ?? item.account_title ?? "Unassigned Account") as string,
        total_budget: Number(item.total_budget ?? item.totalBudget ?? item.amount ?? 0),
        utilized: Number(item.utilized ?? item.utilizedAmount ?? item.total_utilized ?? 0),
        percentage: Number(item.percentage ?? 0)
      }));
    } catch {
      console.warn("Spring Boot v-budget-utilized proxy failed or not ready, returning empty array fallback");
      return [];
    }
  },

  async getMetrics(filters: { year?: string; month?: string; division_id?: string; department_id?: string } = {}): Promise<DashboardMetrics> {
    const items = await this.fetchVBudgetUtilized(filters);
    
    let totalBudget = 0;
    let utilized = 0;

    items.forEach(item => {
      totalBudget += Number(item.total_budget || 0);
      utilized += Number(item.utilized || 0);
    });

    const remaining = totalBudget - utilized;
    const utilizationRate = totalBudget > 0 ? (utilized / totalBudget) * 100 : 0;

    return {
      totalBudget,
      utilized,
      remaining,
      utilizationRate,
    };
  },

  async getMonthlyTrend(year: string, divisionId?: string, departmentId?: string): Promise<{ month: string; amount: number; actual: number }[]> {
    // For monthly trend chart, fetch the entire year's data regardless of the currently selected month filter
    const items = await this.fetchVBudgetUtilized({ year, division_id: divisionId, department_id: departmentId });

    const MONTH_NAMES = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];

    const budgetMap: Record<string, number> = {};
    const actualMap: Record<string, number> = {};

    items.forEach(item => {
      if (item.month) {
        budgetMap[item.month] = (budgetMap[item.month] || 0) + Number(item.total_budget || 0);
        actualMap[item.month] = (actualMap[item.month] || 0) + Number(item.utilized || 0);
      }
    });

    return MONTH_NAMES.map(month => ({
      month,
      amount: budgetMap[month] || 0,
      actual: actualMap[month] || 0
    }));
  },

  async getCategoryDistribution(filters: { year: string; month?: string; division_id?: string; department_id?: string }): Promise<{ name: string; value: number }[]> {
    const items = await this.fetchVBudgetUtilized(filters);

    const distributionMap: Record<string, number> = {};
    items.forEach(item => {
      const name = item.coa || "Uncategorized";
      const amount = Number(item.total_budget || 0);
      distributionMap[name] = (distributionMap[name] || 0) + amount;
    });

    return Object.entries(distributionMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  },

  async getDivisionComparison(filters: { year: string; month?: string; division_id?: string; department_id?: string }): Promise<{ name: string; allocated: number; actual: number }[]> {
    const items = await this.fetchVBudgetUtilized(filters);

    const divAllocatedMap: Record<string, number> = {};
    const divActualMap: Record<string, number> = {};

    items.forEach(item => {
      const name = item.division || "Unassigned Division";
      divAllocatedMap[name] = (divAllocatedMap[name] || 0) + Number(item.total_budget || 0);
      divActualMap[name] = (divActualMap[name] || 0) + Number(item.utilized || 0);
    });

    return Object.keys(divAllocatedMap).map(name => ({
      name,
      allocated: divAllocatedMap[name] || 0,
      actual: divActualMap[name] || 0
    }));
  },

  async getDepartmentComparison(year: string, divisionId?: string, month?: string): Promise<{ name: string; allocated: number; actual: number }[]> {
    if (!divisionId) return [];
    const items = await this.fetchVBudgetUtilized({ year, division_id: divisionId, month });

    const deptAllocatedMap: Record<string, number> = {};
    const deptActualMap: Record<string, number> = {};

    items.forEach(item => {
      const name = item.department || "Unassigned Department";
      deptAllocatedMap[name] = (deptAllocatedMap[name] || 0) + Number(item.total_budget || 0);
      deptActualMap[name] = (deptActualMap[name] || 0) + Number(item.utilized || 0);
    });

    return Object.keys(deptAllocatedMap).map(name => ({
      name,
      allocated: deptAllocatedMap[name] || 0,
      actual: deptActualMap[name] || 0
    }));
  },

  async getDepartmentUtilization(filters: { year: string; month?: string; division_id?: string; department_id?: string }): Promise<{ name: string; spent: number; total: number; utilization: number }[]> {
    const items = await this.fetchVBudgetUtilized(filters);

    const deptTotalMap: Record<string, number> = {};
    const deptSpentMap: Record<string, number> = {};

    items.forEach(item => {
      const name = item.department || "Unassigned Department";
      deptTotalMap[name] = (deptTotalMap[name] || 0) + Number(item.total_budget || 0);
      deptSpentMap[name] = (deptSpentMap[name] || 0) + Number(item.utilized || 0);
    });

    return Object.entries(deptTotalMap).map(([name, total]) => {
      const spent = deptSpentMap[name] || 0;
      return {
        name,
        total,
        spent,
        utilization: total > 0 ? Math.round((spent / total) * 100) : 0
      };
    })
    .filter(dept => dept.utilization >= 75)
    .sort((a, b) => b.utilization - a.utilization)
    .slice(0, 5);
  },

  async getPendingSummary(_filters?: { year?: string; month?: string; division_id?: string; department_id?: string }): Promise<{ total: number; highPriority: number; value: number }> {
    // Parameter reserved for future server-side filter integration
    void _filters;
    return {
      total: 0,
      highPriority: 0,
      value: 0
    };
  },

  async getDepartmentCategoryMatrix(filters: { year: string; month?: string; division_id?: string }): Promise<{ department: string; [category: string]: number | string }[]> {
    if (!filters.division_id) return [];
    const items = await this.fetchVBudgetUtilized(filters);

    const matrix: Record<string, Record<string, number>> = {};
    items.forEach(item => {
      const deptName = item.department || "Unassigned Department";
      const catName = item.coa || "Uncategorized";
      if (!matrix[deptName]) matrix[deptName] = {};
      matrix[deptName][catName] = (matrix[deptName][catName] || 0) + Number(item.utilized || 0);
    });

    return Object.entries(matrix).map(([dept, cats]) => ({
      department: dept,
      ...cats
    }));
  },

  async getRecentDisbursements(_filters?: { year: string; month?: string; division_id?: string }): Promise<{ id?: string; payee?: { supplier_name?: string }; payee_name?: string; department_id?: { department_name?: string }; doc_no?: string; total_amount?: number | string; date_released?: string }[]> {
    // Parameter reserved for future server-side filter integration
    void _filters;
    return [];
  }
};




