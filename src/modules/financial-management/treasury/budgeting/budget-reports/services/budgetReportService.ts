import { fetchProxy } from "./reportApiService";
import { AllocationReportItem } from "../types";

const PROXY_BASE_URL = "/api/fm/treasury/budgeting/budget-reports/items";
const BUDGET_CREATION_PROXY_BASE_URL = "/api/fm/treasury/budgeting/budget-creation";
const DISBURSEMENT_PAYMENT_ID_CHUNK_SIZE = 100;

interface RawBudgetItem {
  division_id?: { division_id?: string | number; id?: string | number; division_name?: string } | string | number | null;
  department_id?: { department_id?: string | number; id?: string | number; department_name?: string } | string | number | null;
  coa_id?: { coa_id?: string | number; id?: string | number; gl_code?: string; account_title?: string } | string | number | null;
  amount?: string | number;
}

interface RawDisbursementItem {
  id?: string | number;
  division_id?: { division_id?: string | number; id?: string | number; division_name?: string } | string | number | null;
  department_id?: { department_id?: string | number; id?: string | number; department_name?: string } | string | number | null;
}

interface RawDisbursementPaymentItem {
  disbursement_id?: { id?: string | number } | string | number | null;
  coa_id?: { coa_id?: string | number; id?: string | number; gl_code?: string; account_title?: string } | string | number | null;
  amount?: string | number;
}

interface RawChartOfAccountItem {
  coa_id?: string | number;
  gl_code?: string;
  account_title?: string;
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

function getEntityId(value: unknown, preferredKey: string): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const preferred = record[preferredKey];
    const fallback = record.id;
    if (typeof preferred === "string" || typeof preferred === "number") return String(preferred).trim();
    if (typeof fallback === "string" || typeof fallback === "number") return String(fallback).trim();
  }
  return "";
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

function getBudgetKey(divisionId?: string, departmentId?: string, coaId?: string) {
  return `${divisionId || ""}|${departmentId || ""}|${coaId || ""}`;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function getTimestamp(value?: string): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function mapBudgetItem(item: RawBudgetItem): AllocationReportItem {
  const divisionObj = typeof item.division_id === "object" && item.division_id !== null ? item.division_id : null;
  const departmentObj = typeof item.department_id === "object" && item.department_id !== null ? item.department_id : null;
  const coaObj = typeof item.coa_id === "object" && item.coa_id !== null ? item.coa_id : null;

  return {
    divisionId: getEntityId(item.division_id, "division_id"),
    departmentId: getEntityId(item.department_id, "department_id"),
    coaId: getEntityId(item.coa_id, "coa_id"),
    divisionName: divisionObj?.division_name || "GENERAL DIVISION",
    department: departmentObj?.department_name || "Unassigned",
    accountCode: coaObj?.gl_code || "N/A",
    accountTitle: coaObj?.account_title || "Uncategorized",
    amount: Number(item.amount || 0)
  };
}

export const budgetReportService = {
  async getBudgetAllocationReport(filters: { year: string; month?: string; months?: string[]; division_id?: string }): Promise<AllocationReportItem[]> {
    const query = new URLSearchParams({
      "filter[status][_eq]": "Approved",
      "filter[deleted_at][_null]": "true",
      "filter[year][_eq]": filters.year,
      "fields": "amount,division_id.division_id,division_id.division_name,department_id.department_id,department_id.department_name,coa_id.coa_id,coa_id.account_title,coa_id.gl_code",
      "limit": "-1"
    });

    if (filters.month) query.append("filter[month][_eq]", filters.month);
    if (filters.months?.length) query.append("filter[month][_in]", filters.months.join(","));
    if (filters.division_id) query.append("filter[division_id][_eq]", filters.division_id);

    const url = `${PROXY_BASE_URL}/budget?${query.toString()}`;
    const result = await fetchProxy<{ data: RawBudgetItem[] }>(url);
    const data = result?.data || [];

    return data.map(mapBudgetItem).sort((a: AllocationReportItem, b: AllocationReportItem) => a.department.localeCompare(b.department));
  },

  async getBudgetUtilizationReport(filters: { year: string; month?: string; months?: string[]; division_id?: string }): Promise<AllocationReportItem[]> {
    const { startDate, endDate } = getDateRange(filters);
    const endDateTime = `${endDate}T23:59:59`;
    const budgetItems = await this.getBudgetAllocationReport(filters);

    const combinedItems = new Map<string, AllocationReportItem>();

    budgetItems.forEach((item) => {
      const key = getBudgetKey(item.divisionId, item.departmentId, item.coaId);
      const existing = combinedItems.get(key);

      if (existing) {
        existing.amount += item.amount;
      } else {
        combinedItems.set(key, { ...item, utilized: item.utilized || 0 });
      }
    });

    const disbursementQuery = new URLSearchParams({
      "filter[status][_eq]": "Released",
      "filter[date_released][_nnull]": "true",
      "filter[date_released][_gte]": startDate,
      "filter[date_released][_lte]": endDateTime,
      "fields": "id,division_id.division_id,division_id.division_name,department_id.department_id,department_id.department_name",
      "limit": "-1",
    });

    if (filters.division_id) disbursementQuery.append("filter[division_id][_eq]", filters.division_id);

    const disbursementResult = await fetchProxy<{ data: RawDisbursementItem[] }>(
      `${BUDGET_CREATION_PROXY_BASE_URL}/disbursement?${disbursementQuery.toString()}`
    );
    const disbursements = disbursementResult?.data || [];
    const disbursementIds = disbursements.map((item) => getEntityId(item.id, "id")).filter(Boolean);

    if (disbursementIds.length === 0) {
      return Array.from(combinedItems.values());
    }

    const disbursementMap = new Map<string, {
      divisionId: string;
      divisionName: string;
      departmentId: string;
      department: string;
    }>();
    disbursements.forEach((item) => {
      const id = getEntityId(item.id, "id");
      if (!id) return;
      const divisionObj = typeof item.division_id === "object" && item.division_id !== null ? item.division_id : null;
      const departmentObj = typeof item.department_id === "object" && item.department_id !== null ? item.department_id : null;

      disbursementMap.set(id, {
        divisionId: getEntityId(item.division_id, "division_id"),
        divisionName: divisionObj?.division_name || "GENERAL DIVISION",
        departmentId: getEntityId(item.department_id, "department_id"),
        department: departmentObj?.department_name || "Unassigned",
      });
    });

    const paymentChunks = await Promise.all(
      chunkArray(disbursementIds, DISBURSEMENT_PAYMENT_ID_CHUNK_SIZE).map(async (ids) => {
        const paymentQuery = new URLSearchParams({
          "filter[disbursement_id][_in]": ids.join(","),
          "fields": "disbursement_id,coa_id,amount",
          "limit": "-1",
        });

        const paymentResult = await fetchProxy<{ data: RawDisbursementPaymentItem[] }>(
          `${BUDGET_CREATION_PROXY_BASE_URL}/disbursement_payments?${paymentQuery.toString()}`
        );
        return paymentResult?.data || [];
      })
    );
    const payments = paymentChunks.flat();
    const paymentCoaIds = Array.from(new Set(payments.map((payment) => getEntityId(payment.coa_id, "coa_id")).filter(Boolean)));
    const coaLookup = await this.getChartOfAccountsByIds(paymentCoaIds);

    payments.forEach((payment) => {
      const disbursementId = getEntityId(payment.disbursement_id, "id");
      const disbursement = disbursementMap.get(disbursementId);
      if (!disbursement) return;

      const coaId = getEntityId(payment.coa_id, "coa_id");
      const key = getBudgetKey(disbursement.divisionId, disbursement.departmentId, coaId);
      const coa = coaLookup.get(coaId);
      const amount = Number(payment.amount || 0);
      const existing = combinedItems.get(key);

      if (existing) {
        existing.utilized = (existing.utilized || 0) + amount;
      } else {
        combinedItems.set(key, {
          divisionId: disbursement.divisionId,
          departmentId: disbursement.departmentId,
          coaId,
          divisionName: disbursement.divisionName,
          department: disbursement.department,
          accountCode: coa?.gl_code || "N/A",
          accountTitle: coa?.account_title || `COA #${coaId || "N/A"}`,
          amount: 0,
          utilized: amount,
        });
      }
    });

    return Array.from(combinedItems.values()).sort((a, b) => {
      const divisionCompare = a.divisionName.localeCompare(b.divisionName);
      if (divisionCompare !== 0) return divisionCompare;
      const departmentCompare = a.department.localeCompare(b.department);
      if (departmentCompare !== 0) return departmentCompare;
      return a.accountTitle.localeCompare(b.accountTitle);
    });
  },

  async getChartOfAccountsByIds(coaIds: string[]): Promise<Map<string, RawChartOfAccountItem>> {
    if (coaIds.length === 0) return new Map();

    const query = new URLSearchParams({
      "filter[coa_id][_in]": coaIds.join(","),
      "fields": "coa_id,gl_code,account_title",
      "limit": "-1",
    });

    const result = await fetchProxy<{ data: RawChartOfAccountItem[] }>(
      `${BUDGET_CREATION_PROXY_BASE_URL}/chart_of_accounts?${query.toString()}`
    );
    const lookup = new Map<string, RawChartOfAccountItem>();

    (result?.data || []).forEach((item) => {
      const id = getEntityId(item.coa_id, "coa_id");
      if (id) lookup.set(id, item);
    });

    return lookup;
  },

  async getRevisedBudgetHistory(filters: { year: string; month?: string; months?: string[]; division_id?: string }): Promise<AllocationReportItem[]> {
    const query = new URLSearchParams({
      "filter[action][_eq]": "Resubmitted",
      "limit": "-1"
    });
    if (filters.year) query.append("filter[budget_id][year][_eq]", filters.year);
    if (filters.month) query.append("filter[budget_id][month][_eq]", filters.month);
    if (filters.months?.length) query.append("filter[budget_id][month][_in]", filters.months.join(","));
    if (filters.division_id) query.append("filter[budget_id][division_id][_eq]", filters.division_id);

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

  async getBudgetApprovalAuditReport(filters: { year: string; month?: string; months?: string[]; division_id?: string }): Promise<AllocationReportItem[]> {
    const query = new URLSearchParams({ "limit": "-1" });
    if (filters.year) query.append("filter[budget_id][year][_eq]", filters.year);
    if (filters.month) query.append("filter[budget_id][month][_eq]", filters.month);
    if (filters.months?.length) query.append("filter[budget_id][month][_in]", filters.months.join(","));
    if (filters.division_id) query.append("filter[budget_id][division_id][_eq]", filters.division_id);

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
