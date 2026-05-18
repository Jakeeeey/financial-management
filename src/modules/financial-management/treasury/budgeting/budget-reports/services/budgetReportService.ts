import { fetchProxy } from "./reportApiService";
import { AllocationReportItem } from "../types";

const PROXY_BASE_URL = "/api/fm/treasury/budgeting/budget-reports/items";

interface RawBudgetItem {
  division_id?: { division_name?: string };
  department_id?: { department_name?: string };
  coa_id?: { gl_code?: string; account_title?: string };
  amount?: string | number;
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

export const budgetReportService = {
  async getBudgetAllocationReport(filters: { year: string; month?: string; division_id?: string }): Promise<AllocationReportItem[]> {
    const query = new URLSearchParams({
      "filter[status][_eq]": "Approved",
      "filter[year][_eq]": filters.year,
      "fields": "amount,division_id.division_name,department_id.department_name,coa_id.account_title,coa_id.gl_code",
      "limit": "-1"
    });

    if (filters.month) query.append("filter[month][_eq]", filters.month);
    if (filters.division_id) query.append("filter[division_id][_eq]", filters.division_id);

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data: RawBudgetItem[] }>(url);
    const data = result?.data || [];

    return data.map((item) => ({
      divisionName: item.division_id?.division_name || "GENERAL DIVISION",
      department: item.department_id?.department_name || "Unassigned",
      accountCode: item.coa_id?.gl_code || "N/A",
      accountTitle: item.coa_id?.account_title || "Uncategorized",
      amount: Number(item.amount || 0)
    })).sort((a: AllocationReportItem, b: AllocationReportItem) => a.department.localeCompare(b.department));
  },

  async getRevisedBudgetHistory(filters: { year: string; month?: string; division_id?: string }): Promise<AllocationReportItem[]> {
    const url = `/api/fm/treasury/budgeting/budget-audit-trail?limit=-1`;
    const result = await fetchProxy<{ data: AuditProxyItem[] }>(url);
    const data = result?.data || [];

    return data
      .filter((item: AuditProxyItem) => {
        if (!item || !item.budget_id) return false;
        const b = item.budget_id;
        if (String(b.year) !== String(filters.year)) return false;
        if (filters.month && String(b.month).toLowerCase() !== String(filters.month).toLowerCase()) return false;
        if (filters.division_id) {
          const divId = typeof b.division_id === "object" ? b.division_id?.division_id : b.division_id;
          if (String(divId) !== String(filters.division_id)) return false;
        }
        return item.new_amount !== undefined && item.new_amount !== null;
      })
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
      })
      .sort((a: AllocationReportItem, b: AllocationReportItem) => (b.revisionDate || "").localeCompare(a.revisionDate || ""));
  },

  async getBudgetApprovalAuditReport(filters: { year: string; month?: string; division_id?: string }): Promise<AllocationReportItem[]> {
    const url = `/api/fm/treasury/budgeting/budget-audit-trail?limit=-1`;
    const result = await fetchProxy<{ data: ApprovalProxyItem[] }>(url);
    const data = result?.data || [];

    return data
      .filter((item: ApprovalProxyItem) => {
        if (!item || !item.budget_id) return false;
        const b = item.budget_id;
        if (String(b.year) !== String(filters.year)) return false;
        if (filters.month && String(b.month).toLowerCase() !== String(filters.month).toLowerCase()) return false;
        if (filters.division_id) {
          const divId = typeof b.division_id === "object" ? b.division_id?.division_id : b.division_id;
          if (String(divId) !== String(filters.division_id)) return false;
        }
        return true;
      })
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
          amount: Number(b.amount || 0),
          revisionDate,
          actionName: item.action || "Processed",
          performedByUser,
          performedByRole,
          auditStatus: item.new_status || "Pending"
        };
      })
      .sort((a: AllocationReportItem, b: AllocationReportItem) => (b.revisionDate || "").localeCompare(a.revisionDate || ""));
  }
};
