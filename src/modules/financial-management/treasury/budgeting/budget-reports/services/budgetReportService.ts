import { fetchProxy } from "./reportApiService";
import { AllocationReportItem } from "../types";

const SPRING_BUDGET_UTILIZED_PROXY_URL = "/api/fm/treasury/budgeting/v-budget-utilized";

interface SpringBudgetItem {
  year?: number;
  month?: string;
  divisionId?: number | string;
  division?: string;
  departmentId?: number | string;
  department?: string;
  coaId?: number | string;
  glCode?: string;
  coa?: string;
  totalBudget?: number;
  utilized?: number;
  percentage?: number;
}

function getMonthIndex(monthName: string): number {
  return [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ].findIndex((month) => month.toLowerCase() === monthName.toLowerCase());
}

function getDateRange(filters: { year: string; month?: string; months?: string[] }) {
  const year = Number(filters.year);
  const selectedMonths = filters.months?.length ? filters.months : filters.month ? [filters.month] : [];
  const startMonthIndex = selectedMonths.length ? Math.max(getMonthIndex(selectedMonths[0]), 0) : 0;
  const endMonthIndex = selectedMonths.length ? Math.max(getMonthIndex(selectedMonths[selectedMonths.length - 1]), startMonthIndex) : 11;
  const startDate = `${year}-${String(startMonthIndex + 1).padStart(2, "0")}-01`;
  const endDay = new Date(year, endMonthIndex + 1, 0).getDate();
  const endDate = `${year}-${String(endMonthIndex + 1).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`;

  return { startDate, endDate };
}

function mapSpringItem(item: SpringBudgetItem): AllocationReportItem {
  return {
    divisionId: item.divisionId != null ? String(item.divisionId) : "",
    departmentId: item.departmentId != null ? String(item.departmentId) : "",
    coaId: item.coaId != null ? String(item.coaId) : "",
    divisionName: item.division || "GENERAL DIVISION",
    department: item.department || "Unassigned",
    accountCode: item.glCode || "N/A",
    accountTitle: item.coa || "Uncategorized",
    amount: Number(item.totalBudget || 0),
    utilized: Number(item.utilized || 0)
  };
}

interface AuditProxyItem {
  performed_at?: string;
  previous_amount?: string | number | null;
  new_amount?: string | number | null;
  budget_id?: {
    year?: string | number;
    month?: string;
    amount?: string | number;
    division_id?: { division_id?: number | string; division_name?: string } | number | string;
    department_id?: { department_name?: string };
    coa_id?: { gl_code?: string; account_title?: string };
  };
}

interface ApprovalProxyItem {
  action?: string;
  new_amount?: string | number | null;
  new_status?: string;
  performed_at?: string;
  performed_by?: {
    user_fname?: string;
    user_lname?: string;
    user_position?: string;
  };
  budget_id?: {
    year?: string | number;
    month?: string;
    amount?: string | number;
    division_id?: { division_id?: number | string; division_name?: string } | number | string;
    department_id?: { department_name?: string };
    coa_id?: { gl_code?: string; account_title?: string };
  };
}

function getTimestamp(value?: string): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

export const budgetReportService = {
  async fetchSpringBudgetData(filters: { year: string; month?: string; months?: string[]; division_id?: string }): Promise<SpringBudgetItem[]> {
    const { startDate, endDate } = getDateRange(filters);
    const query = new URLSearchParams({
      dateFrom: startDate,
      dateTo: endDate,
    });

    if (filters.division_id) {
      query.set("divisionId", filters.division_id);
    }

    const url = `${SPRING_BUDGET_UTILIZED_PROXY_URL}?${query.toString()}`;
    const result = await fetchProxy<SpringBudgetItem[]>(url);
    const data = Array.isArray(result) ? result : [];

    // Filter by selected month/months if specified
    const selectedMonths = filters.months?.length
      ? filters.months.map(m => m.toLowerCase())
      : filters.month
      ? [filters.month.toLowerCase()]
      : [];

    if (selectedMonths.length > 0) {
      return data.filter(item => item.month && selectedMonths.includes(item.month.toLowerCase()));
    }

    return data;
  },

  async getBudgetAllocationReport(filters: { year: string; month?: string; months?: string[]; division_id?: string }): Promise<AllocationReportItem[]> {
    const data = await this.fetchSpringBudgetData(filters);
    return data
      .map(mapSpringItem)
      .sort((a, b) => a.department.localeCompare(b.department));
  },

  async getBudgetUtilizationReport(filters: { year: string; month?: string; months?: string[]; division_id?: string }): Promise<AllocationReportItem[]> {
    const data = await this.fetchSpringBudgetData(filters);
    return data
      .map(mapSpringItem)
      .sort((a, b) => {
        const divisionCompare = a.divisionName.localeCompare(b.divisionName);
        if (divisionCompare !== 0) return divisionCompare;
        const departmentCompare = a.department.localeCompare(b.department);
        if (departmentCompare !== 0) return departmentCompare;
        return a.accountTitle.localeCompare(b.accountTitle);
      });
  },

  async getRevisedBudgetHistory(filters?: { year: string; month?: string; months?: string[]; division_id?: string }): Promise<AllocationReportItem[]> {
    const query = new URLSearchParams({
      "filter[action][_eq]": "Resubmitted",
      "limit": "-1"
    });
    if (filters?.year) query.append("filter[budget_id][year][_eq]", filters.year);
    if (filters?.month) query.append("filter[budget_id][month][_eq]", filters.month);
    if (filters?.months?.length) query.append("filter[budget_id][month][_in]", filters.months.join(","));
    if (filters?.division_id) query.append("filter[budget_id][division_id][_eq]", filters.division_id);

    const url = `/api/fm/treasury/budgeting/budget-audit-trail?${query.toString()}`;
    const result = await fetchProxy<{ data: AuditProxyItem[] }>(url);
    const data = result?.data || [];

    return data
      .filter((item: AuditProxyItem) => {
        if (item.new_amount === undefined || item.new_amount === null) return false;
        const prev = Number(item.previous_amount || 0);
        const curr = Number(item.new_amount || 0);
        return prev !== curr;
      })
      .sort((a: AuditProxyItem, b: AuditProxyItem) => getTimestamp(b.performed_at) - getTimestamp(a.performed_at))
      .map((item: AuditProxyItem) => {
        const b = item.budget_id || {};
        const coa = b.coa_id || {};
        const dept = b.department_id || {};
        const div = typeof b.division_id === "object" ? (b.division_id || {}) : {};

        const revDateObj = item.performed_at ? new Date(item.performed_at) : new Date();
        const revisionDate = revDateObj.toLocaleDateString("en-PH", { year: 'numeric', month: 'short', day: '2-digit' });
        const originalAmount = Number(item.previous_amount || 0);
        const revisedAmount = Number(item.new_amount || 0);

        return {
          divisionName: (div as { division_name?: string }).division_name || "GENERAL DIVISION",
          department: dept.department_name || "Unassigned",
          accountCode: coa.gl_code || "N/A",
          accountTitle: coa.account_title || "Uncategorized",
          amount: revisedAmount,
          revisionDate,
          originalAmount,
          revisedAmount
        };
      });
  },

  async getBudgetApprovalAuditReport(filters?: { year: string; month?: string; months?: string[]; division_id?: string }): Promise<AllocationReportItem[]> {
    const query = new URLSearchParams({ "limit": "-1" });
    if (filters?.year) query.append("filter[budget_id][year][_eq]", filters.year);
    if (filters?.month) query.append("filter[budget_id][month][_eq]", filters.month);
    if (filters?.months?.length) query.append("filter[budget_id][month][_in]", filters.months.join(","));
    if (filters?.division_id) query.append("filter[budget_id][division_id][_eq]", filters.division_id);

    const url = `/api/fm/treasury/budgeting/budget-audit-trail?${query.toString()}`;
    const result = await fetchProxy<{ data: ApprovalProxyItem[] }>(url);
    const data = result?.data || [];

    return data
      .filter((item: ApprovalProxyItem) => item && item.budget_id)
      .sort((a: ApprovalProxyItem, b: ApprovalProxyItem) => getTimestamp(b.performed_at) - getTimestamp(a.performed_at))
      .map((item: ApprovalProxyItem) => {
        const b = item.budget_id || {};
        const coa = b.coa_id || {};
        const dept = b.department_id || {};
        const div = typeof b.division_id === "object" ? (b.division_id || {}) : {};

        const revDateObj = item.performed_at ? new Date(item.performed_at) : new Date();
        const revisionDate = revDateObj.toLocaleDateString("en-PH", { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });

        const u = item.performed_by || {};
        const fname = u.user_fname || "";
        const lname = u.user_lname || "";
        const performedByUser = (fname || lname) ? `${fname} ${lname}`.trim() : "System Process";
        const performedByRole = u.user_position || "Automated Workflow";

        return {
          divisionName: (div as { division_name?: string }).division_name || "GENERAL DIVISION",
          department: dept.department_name || "Unassigned",
          accountCode: coa.gl_code || "N/A",
          accountTitle: coa.account_title || "Uncategorized",
          amount: Number(item.new_amount || 0),
          revisionDate,
          actionName: item.action || "Processed",
          performedByUser,
          performedByRole,
          auditStatus: item.new_status || "Pending"
        };
      });
  }
};

