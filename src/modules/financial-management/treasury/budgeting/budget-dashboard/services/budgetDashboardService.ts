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
  getDepartments: budgetApprovalService.getDepartments,

  async getMetrics(filters: { year?: string; month?: string; division_id?: string; department_id?: string } = {}): Promise<DashboardMetrics> {
    // 1. Fetch Total Active Budget
    const budgetQuery = new URLSearchParams();
    budgetQuery.append("filter[status][_eq]", "Approved");
    if (filters.year) budgetQuery.append("filter[year][_eq]", filters.year);
    if (filters.month) budgetQuery.append("filter[month][_eq]", filters.month);
    if (filters.division_id) budgetQuery.append("filter[division_id][_eq]", filters.division_id);
    if (filters.department_id) budgetQuery.append("filter[department_id][_eq]", filters.department_id);
    budgetQuery.append("aggregate[sum]", "amount");
    const budgetPromise = fetchProxy<{ data?: Array<{ sum?: { amount?: string | number } }> }>(
      `${PROXY_BASE_URL}/budget?${budgetQuery.toString()}`
    );

    // 2. Fetch Total Utilized (Two-step fetch to bypass Directus relational filter limits)
    const disbHeaderQuery = new URLSearchParams();
    disbHeaderQuery.append("filter[status][_eq]", "Released");
    disbHeaderQuery.append("filter[date_released][_nnull]", "true");
    if (filters.division_id) disbHeaderQuery.append("filter[division_id][_eq]", filters.division_id);
    if (filters.department_id) disbHeaderQuery.append("filter[department_id][_eq]", filters.department_id);
    
    if (filters.year && filters.month) {
      const monthIndex = new Date(`${filters.month} 1, 2000`).getMonth();
      const startDate = new Date(Number(filters.year), monthIndex, 1, 12).toISOString().split("T")[0];
      const endDate = new Date(Number(filters.year), monthIndex + 1, 0, 12).toISOString().split("T")[0];
      disbHeaderQuery.append("filter[date_released][_between]", `${startDate},${endDate}`);
    } else if (filters.year) {
      disbHeaderQuery.append("filter[date_released][_between]", `${filters.year}-01-01,${filters.year}-12-31`);
    }
    disbHeaderQuery.append("fields", "id");

    const disbHeaderPromise = fetchProxy<{ data?: Array<{ id: number }> }>(
      `${PROXY_BASE_URL}/disbursement?${disbHeaderQuery.toString()}`
    );

    const [budgetRes, disbHeaderRes] = await Promise.all([budgetPromise, disbHeaderPromise]);
    const totalBudget = Number(budgetRes?.data?.[0]?.sum?.amount || 0);

    const validDisbIds = (disbHeaderRes?.data || []).map(d => d.id);
    let utilized = 0;

    if (validDisbIds.length > 0) {
      const dpQuery = new URLSearchParams();
      dpQuery.append("filter[disbursement_id][_in]", validDisbIds.join(","));
      dpQuery.append("aggregate[sum]", "amount");
      const dpRes = await fetchProxy<{ data?: Array<{ sum?: { amount?: string | number } }> }>(
        `${PROXY_BASE_URL}/disbursement_payments?${dpQuery.toString()}`
      );
      utilized = Number(dpRes?.data?.[0]?.sum?.amount || 0);
    }

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
    const query = new URLSearchParams();
    query.append("filter[status][_eq]", "Approved");
    query.append("filter[year][_eq]", year);
    if (divisionId) query.append("filter[division_id][_eq]", divisionId);
    if (departmentId) query.append("filter[department_id][_eq]", departmentId);

    query.append("aggregate[sum]", "amount");
    query.append("groupBy", "month");

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data?: RawBudgetItem[] }>(url);
    const data = result?.data || [];

    // Fetch actuals (disbursements) for the year
    const disbQuery = new URLSearchParams({
      "filter[status][_eq]": "Released",
      "filter[date_released][_between]": `${year}-01-01,${year}-12-31`,
      "fields": "date_released,total_amount",
      "limit": "-1"
    });
    if (divisionId) disbQuery.append("filter[division_id][_eq]", divisionId);
    if (departmentId) disbQuery.append("filter[department_id][_eq]", departmentId);

    const disbRes = await fetchProxy<{ data?: { date_released?: string; total_amount?: number | string }[] }>(`${PROXY_BASE_URL}/disbursement?${disbQuery.toString()}`);
    
    // Group actuals by month name (locale-safe, using hardcoded English names)
    const MONTH_NAMES = [
      "January", "February", "March", "April", "May", "June", 
      "July", "August", "September", "October", "November", "December"
    ];
    const actualsMap: Record<string, number> = {};
    (disbRes?.data || []).forEach(d => {
      if (d.date_released) {
        const date = new Date(d.date_released);
        const monthName = MONTH_NAMES[date.getMonth()];
        actualsMap[monthName] = (actualsMap[monthName] || 0) + Number(d.total_amount || 0);
      }
    });

    // Map both into a predictable format for all 12 months
    return MONTH_NAMES.map(month => {
      const budgetItem = data.find(d => d.month === month);
      return {
        month,
        amount: Number(budgetItem?.sum?.amount || 0),
        actual: actualsMap[month] || 0
      };
    });
  },

  async getCategoryDistribution(filters: { year: string; month?: string; division_id?: string; department_id?: string }): Promise<{ name: string; value: number }[]> {
    const query = new URLSearchParams({
      "filter[status][_eq]": "Approved",
      "filter[year][_eq]": filters.year,
      "fields": "amount,coa_id.account_title",
      "limit": "-1"
    });
    
    if (filters.month) {
      query.append("filter[month][_eq]", filters.month);
    }
    
    if (filters.division_id) {
      query.append("filter[division_id][_eq]", filters.division_id);
    }
    if (filters.department_id) {
      query.append("filter[department_id][_eq]", filters.department_id);
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

  async getDivisionComparison(filters: { year: string; month?: string; division_id?: string; department_id?: string }): Promise<{ name: string; allocated: number; actual: number }[]> {
    const query = new URLSearchParams({
      "filter[status][_eq]": "Approved",
      "filter[year][_eq]": filters.year,
      "fields": "amount,division_id.division_name",
      "limit": "-1"
    });
    if (filters.month) query.append("filter[month][_eq]", filters.month);
    if (filters.division_id) query.append("filter[division_id][_eq]", filters.division_id);
    if (filters.department_id) query.append("filter[department_id][_eq]", filters.department_id);

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data?: RawBudgetItem[] }>(url);
    const data = result?.data || [];

    const divMap: Record<string, number> = {};
    data.forEach((b: RawBudgetItem) => {
      const name = b.division_id?.division_name || "Unknown";
      divMap[name] = (divMap[name] || 0) + Number(b.amount || 0);
    });

    // Fetch real actuals from released disbursements
    const disbHeaderQuery = new URLSearchParams({
      "filter[status][_eq]": "Released",
      "filter[date_released][_nnull]": "true",
      "fields": "id,division_id.division_name",
      "limit": "-1"
    });
    if (filters.month) {
      const monthIndex = new Date(`${filters.month} 1, 2000`).getMonth();
      const monthNumber = String(monthIndex + 1).padStart(2, "0");
      const lastDay = new Date(Number(filters.year), monthIndex + 1, 0).getDate();
      disbHeaderQuery.append("filter[date_released][_between]", `${filters.year}-${monthNumber}-01,${filters.year}-${monthNumber}-${lastDay}`);
    } else {
      disbHeaderQuery.append("filter[date_released][_between]", `${filters.year}-01-01,${filters.year}-12-31`);
    }
    if (filters.division_id) disbHeaderQuery.append("filter[division_id][_eq]", filters.division_id);
    if (filters.department_id) disbHeaderQuery.append("filter[department_id][_eq]", filters.department_id);
    
    const disbRes = await fetchProxy<{ data?: Array<{ id: number; division_id?: { division_name?: string } }> }>(`${PROXY_BASE_URL}/disbursement?${disbHeaderQuery.toString()}`);
    const disbs = disbRes?.data || [];
    
    const actualMap: Record<string, number> = {};
    if (disbs.length > 0) {
      const validIds = disbs.map(d => d.id);
      const disbToDiv = new Map<number, string>();
      disbs.forEach(d => disbToDiv.set(d.id, d.division_id?.division_name || "Unknown"));

      const dpQuery = new URLSearchParams();
      dpQuery.append("filter[disbursement_id][_in]", validIds.join(","));
      dpQuery.append("fields", "disbursement_id,amount");
      dpQuery.append("limit", "-1");

      const dpRes = await fetchProxy<{ data?: Array<{ disbursement_id: number; amount: string | number }> }>(
        `${PROXY_BASE_URL}/disbursement_payments?${dpQuery.toString()}`
      );
      
      (dpRes?.data || []).forEach(dp => {
        const divName = disbToDiv.get(dp.disbursement_id);
        if (divName) {
          actualMap[divName] = (actualMap[divName] || 0) + Number(dp.amount || 0);
        }
      });
    }

    return Object.entries(divMap).map(([name, allocated]) => ({
      name,
      allocated,
      actual: actualMap[name] || 0
    }));
  },

  async getDepartmentComparison(year: string, divisionId?: string, month?: string): Promise<{ name: string; allocated: number; actual: number }[]> {
    if (!divisionId) return [];

    const query = new URLSearchParams({
      "filter[status][_eq]": "Approved",
      "filter[year][_eq]": year,
      "filter[division_id][_eq]": divisionId,
      "fields": "amount,department_id.department_name",
      "limit": "-1"
    });
    if (month) query.append("filter[month][_eq]", month);

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data?: RawBudgetItem[] }>(url);
    const data = result?.data || [];

    const deptMap: Record<string, number> = {};
    data.forEach((b: RawBudgetItem) => {
      const name = b.department_id?.department_name || "Unknown";
      deptMap[name] = (deptMap[name] || 0) + Number(b.amount || 0);
    });

    const disbHeaderQuery = new URLSearchParams({
      "filter[status][_eq]": "Released",
      "filter[date_released][_nnull]": "true",
      "filter[division_id][_eq]": divisionId,
      "fields": "id,department_id.department_name",
      "limit": "-1"
    });

    if (month) {
      const monthIndex = new Date(`${month} 1, 2000`).getMonth();
      const monthNumber = String(monthIndex + 1).padStart(2, '0');
      const lastDay = new Date(Number(year), monthIndex + 1, 0).getDate();
      disbHeaderQuery.append("filter[date_released][_between]", `${year}-${monthNumber}-01,${year}-${monthNumber}-${lastDay}`);
    } else {
      disbHeaderQuery.append("filter[date_released][_between]", `${year}-01-01,${year}-12-31`);
    }
    
    const disbRes = await fetchProxy<{ data?: Array<{ id: number; department_id?: { department_name?: string } }> }>(`${PROXY_BASE_URL}/disbursement?${disbHeaderQuery.toString()}`);
    const disbs = disbRes?.data || [];
    
    const actualMap: Record<string, number> = {};
    if (disbs.length > 0) {
      const validIds = disbs.map(d => d.id);
      const disbToDept = new Map<number, string>();
      disbs.forEach(d => disbToDept.set(d.id, d.department_id?.department_name || "Unknown"));

      const dpQuery = new URLSearchParams();
      dpQuery.append("filter[disbursement_id][_in]", validIds.join(","));
      dpQuery.append("fields", "disbursement_id,amount");
      dpQuery.append("limit", "-1");

      const dpRes = await fetchProxy<{ data?: Array<{ disbursement_id: number; amount: string | number }> }>(
        `${PROXY_BASE_URL}/disbursement_payments?${dpQuery.toString()}`
      );
      
      (dpRes?.data || []).forEach(dp => {
        const deptName = disbToDept.get(dp.disbursement_id);
        if (deptName) {
          actualMap[deptName] = (actualMap[deptName] || 0) + Number(dp.amount || 0);
        }
      });
    }

    return Object.entries(deptMap).map(([name, allocated]) => ({
      name,
      allocated,
      actual: actualMap[name] || 0
    }));
  },

  async getDepartmentUtilization(filters: { year: string; month?: string; division_id?: string; department_id?: string }): Promise<{ name: string; spent: number; total: number; utilization: number }[]> {
    const query = new URLSearchParams({
      "filter[status][_eq]": "Approved",
      "filter[year][_eq]": filters.year,
      "fields": "amount,department_id.department_name",
      "limit": "-1"
    });
    if (filters.month) query.append("filter[month][_eq]", filters.month);
    if (filters.division_id) query.append("filter[division_id][_eq]", filters.division_id);
    if (filters.department_id) query.append("filter[department_id][_eq]", filters.department_id);

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data?: RawBudgetItem[] }>(url);
    const data = result?.data || [];

    const deptMap: Record<string, number> = {};
    data.forEach((b: RawBudgetItem) => {
      const name = b.department_id?.department_name || "Unknown";
      deptMap[name] = (deptMap[name] || 0) + Number(b.amount || 0);
    });

    // Fetch real actuals
    const disbHeaderQuery = new URLSearchParams({
      "filter[status][_eq]": "Released",
      "filter[date_released][_nnull]": "true",
      "fields": "id,department_id.department_name",
      "limit": "-1"
    });
    if (filters.month) {
      const monthIndex = new Date(`${filters.month} 1, 2000`).getMonth();
      const monthNumber = String(monthIndex + 1).padStart(2, '0');
      const lastDay = new Date(Number(filters.year), monthIndex + 1, 0).getDate();
      disbHeaderQuery.append("filter[date_released][_between]", `${filters.year}-${monthNumber}-01,${filters.year}-${monthNumber}-${lastDay}`);
    } else {
      disbHeaderQuery.append("filter[date_released][_between]", `${filters.year}-01-01,${filters.year}-12-31`);
    }
    if (filters.division_id) disbHeaderQuery.append("filter[division_id][_eq]", filters.division_id);
    if (filters.department_id) disbHeaderQuery.append("filter[department_id][_eq]", filters.department_id);

    const disbRes = await fetchProxy<{ data?: Array<{ id: number; department_id?: { department_name?: string } }> }>(`${PROXY_BASE_URL}/disbursement?${disbHeaderQuery.toString()}`);
    const disbs = disbRes?.data || [];
    
    const actualMap: Record<string, number> = {};
    if (disbs.length > 0) {
      const validIds = disbs.map(d => d.id);
      const disbToDept = new Map<number, string>();
      disbs.forEach(d => disbToDept.set(d.id, d.department_id?.department_name || "Unknown"));

      const dpQuery = new URLSearchParams();
      dpQuery.append("filter[disbursement_id][_in]", validIds.join(","));
      dpQuery.append("fields", "disbursement_id,amount");
      dpQuery.append("limit", "-1");

      const dpRes = await fetchProxy<{ data?: Array<{ disbursement_id: number; amount: string | number }> }>(
        `${PROXY_BASE_URL}/disbursement_payments?${dpQuery.toString()}`
      );
      
      (dpRes?.data || []).forEach(dp => {
        const deptName = disbToDept.get(dp.disbursement_id);
        if (deptName) {
          actualMap[deptName] = (actualMap[deptName] || 0) + Number(dp.amount || 0);
        }
      });
    }

    return Object.entries(deptMap).map(([name, total]) => {
      const spent = actualMap[name] || 0;
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

  async getPendingSummary(filters: { year?: string; month?: string; division_id?: string; department_id?: string } = {}): Promise<{ total: number; highPriority: number; value: number }> {
    const query = new URLSearchParams({
      "filter[status][_eq]": "Pending",
      "fields": "amount",
      "limit": "-1"
    });
    if (filters.year) query.append("filter[year][_eq]", filters.year);
    if (filters.month) query.append("filter[month][_eq]", filters.month);
    if (filters.division_id) query.append("filter[division_id][_eq]", filters.division_id);
    if (filters.department_id) query.append("filter[department_id][_eq]", filters.department_id);

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
  },

  async getDepartmentCategoryMatrix(filters: { year: string; month?: string; division_id?: string }): Promise<{ department: string; [category: string]: number | string }[]> {
    if (!filters.division_id) return [];
    
    // For heatmap, we usually want ACTUAL expenses, but tracking actuals per COA requires full DP join.
    // For simplicity, we use allocated budget distribution, OR we can fetch DP lines.
    // Let's fetch actual disbursement_payments to get real expense categories!
    
    const disbHeaderQuery = new URLSearchParams({
      "filter[status][_eq]": "Released",
      "filter[date_released][_nnull]": "true",
      "filter[division_id][_eq]": filters.division_id,
      "fields": "id,department_id.department_name",
      "limit": "-1"
    });

    if (filters.month) {
      const monthIndex = new Date(`${filters.month} 1, 2000`).getMonth();
      const monthNumber = String(monthIndex + 1).padStart(2, '0');
      const lastDay = new Date(Number(filters.year), monthIndex + 1, 0).getDate();
      disbHeaderQuery.append("filter[date_released][_between]", `${filters.year}-${monthNumber}-01,${filters.year}-${monthNumber}-${lastDay}`);
    } else {
      disbHeaderQuery.append("filter[date_released][_between]", `${filters.year}-01-01,${filters.year}-12-31`);
    }

    const disbRes = await fetchProxy<{ data?: Array<{ id: number; department_id?: { department_name?: string } }> }>(`${PROXY_BASE_URL}/disbursement?${disbHeaderQuery.toString()}`);
    const disbs = disbRes?.data || [];
    if (disbs.length === 0) return [];

    const validIds = disbs.map(d => d.id);
    const disbToDept = new Map<number, string>();
    disbs.forEach(d => disbToDept.set(d.id, d.department_id?.department_name || "Unknown"));

    const dpQuery = new URLSearchParams();
    dpQuery.append("filter[disbursement_id][_in]", validIds.join(","));
    dpQuery.append("fields", "disbursement_id,amount,coa_id.account_title");
    dpQuery.append("limit", "-1");

    const dpRes = await fetchProxy<{ data?: Array<{ disbursement_id: number; amount: string | number; coa_id?: { account_title?: string } }> }>(`${PROXY_BASE_URL}/disbursement_payables?${dpQuery.toString()}`);
    
    // Group by department -> category -> sum
    const matrix: Record<string, Record<string, number>> = {};
    
    (dpRes?.data || []).forEach(dp => {
      const deptName = disbToDept.get(dp.disbursement_id);
      if (deptName) {
        if (!matrix[deptName]) matrix[deptName] = {};
        const catName = dp.coa_id?.account_title || "Uncategorized";
        matrix[deptName][catName] = (matrix[deptName][catName] || 0) + Number(dp.amount || 0);
      }
    });

    return Object.entries(matrix).map(([dept, cats]) => ({
      department: dept,
      ...cats
    }));
  },

  async getRecentDisbursements(filters: { year: string; month?: string; division_id?: string }): Promise<{ id?: string; payee?: { supplier_name?: string }; payee_name?: string; department_id?: { department_name?: string }; doc_no?: string; total_amount?: number | string; date_released?: string }[]> {
    if (!filters.division_id) return [];
    
    const query = new URLSearchParams({
      "filter[status][_eq]": "Released",
      "filter[date_released][_nnull]": "true",
      "filter[division_id][_eq]": filters.division_id,
      "fields": "id,doc_no,payee.supplier_name,total_amount,date_released,department_id.department_name",
      "sort": "-date_released",
      "limit": "15"
    });

    if (filters.month) {
      const monthIndex = new Date(`${filters.month} 1, 2000`).getMonth();
      const monthNumber = String(monthIndex + 1).padStart(2, '0');
      const lastDay = new Date(Number(filters.year), monthIndex + 1, 0).getDate();
      query.append("filter[date_released][_between]", `${filters.year}-${monthNumber}-01,${filters.year}-${monthNumber}-${lastDay}`);
    } else {
      query.append("filter[date_released][_between]", `${filters.year}-01-01,${filters.year}-12-31`);
    }

    const res = await fetchProxy<{ data?: Array<{ id?: string; payee?: { supplier_name?: string }; payee_name?: string; department_id?: { department_name?: string }; doc_no?: string; total_amount?: number | string; date_released?: string }> }>(`${PROXY_BASE_URL}/disbursement?${query.toString()}`);
    return res?.data || [];
  }
};


