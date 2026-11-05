import {
  FinancialPerformanceEntry,
  FinancialPerformanceReportCriteria,
  FinancialPerformanceResponse,
  FinancialPerformanceResponseSchema,
  FinancialPerformanceTransactionsResponse,
  FinancialPerformanceTransactionsResponseSchema,
} from "../types";
import { FINANCIAL_PERFORMANCE_SOURCE_MODULES } from "../utils/report-coverage";

export interface FinancialPerformanceDivisionOption {
  divisionId: number;
  divisionName: string;
}

export interface FinancialPerformanceDepartmentOption {
  departmentId: number;
  departmentName: string;
  parentDivision: number | null;
}

async function getLookupOptions<T>(url: string): Promise<T[]> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch organizational options: ${response.statusText}`);
  }

  const data: unknown = await response.json();
  if (!Array.isArray(data)) {
    throw new Error("Organizational options response was not a list");
  }

  return data as T[];
}

export function getFinancialPerformanceDivisions(): Promise<FinancialPerformanceDivisionOption[]> {
  return getLookupOptions<FinancialPerformanceDivisionOption>("/api/fm/setup/divisions");
}

export function getFinancialPerformanceDepartments(): Promise<FinancialPerformanceDepartmentOption[]> {
  return getLookupOptions<FinancialPerformanceDepartmentOption>("/api/fm/setup/departments");
}

export interface FetchFinancialPerformanceParams {
  startDate: string;
  endDate: string;
  status?: string;
  divisionName?: string;
  departmentName?: string;
  taxRate?: number;
}

export async function getFinancialPerformance(
  params: FetchFinancialPerformanceParams
): Promise<FinancialPerformanceResponse> {
  const query = new URLSearchParams();
  query.set("startDate", params.startDate);
  query.set("endDate", params.endDate);

  if (params.status) {
    query.set("status", params.status);
  }
  if (params.divisionName && params.divisionName !== "all") {
    query.set("divisionName", params.divisionName);
  }
  if (params.departmentName && params.departmentName !== "all") {
    query.set("departmentName", params.departmentName);
  }
  if (params.taxRate !== undefined) {
    query.set("taxRate", params.taxRate.toString());
  }

  const url = `/api/fm/financial-statements/statement-of-financial-performance?${query.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      // cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch financial performance: ${response.statusText}`);
    }

    const data = await response.json();

    const validated = FinancialPerformanceResponseSchema.safeParse(data);

    if (!validated.success) {
      console.error("Income Statement data validation failed:", validated.error);
      // Fallback but warn
      return data as FinancialPerformanceResponse;
    }

    return validated.data;
  } catch (error) {
    console.error("Financial Performance Service Error:", error);
    throw error;
  }
}

export interface FetchFinancialPerformanceTransactionsParams {
  account: FinancialPerformanceEntry;
  criteria: FinancialPerformanceReportCriteria;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}

export async function getFinancialPerformanceTransactions(
  params: FetchFinancialPerformanceTransactionsParams
): Promise<FinancialPerformanceTransactionsResponse> {
  if (params.account.coaId == null) {
    throw new Error("This account is missing its chart of accounts ID.");
  }

  const query = new URLSearchParams({
    coaId: String(params.account.coaId),
    startDate: params.criteria.startDate,
    endDate: params.criteria.endDate,
    status: params.criteria.status,
    accountDivisionIsNull: String(params.account.division == null),
    accountDepartmentIsNull: String(params.account.department == null),
    page: String(params.page),
    pageSize: String(params.pageSize),
  });

  if (params.account.division != null) query.set("accountDivision", params.account.division);
  if (params.account.department != null) query.set("accountDepartment", params.account.department);
  if (params.criteria.divisionName && params.criteria.divisionName !== "all") {
    query.set("divisionName", params.criteria.divisionName);
  }
  if (params.criteria.departmentName && params.criteria.departmentName !== "all") {
    query.set("departmentName", params.criteria.departmentName);
  }
  for (const sourceModule of FINANCIAL_PERFORMANCE_SOURCE_MODULES) {
    query.append("sourceModule", sourceModule);
  }

  const response = await fetch(
    `/api/fm/financial-statements/statement-of-financial-performance/transactions?${query.toString()}`,
    { method: "GET", credentials: "include", cache: "no-store", signal: params.signal }
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error || `Failed to load account transactions: ${response.statusText}`);
  }

  const data: unknown = await response.json();
  const validated = FinancialPerformanceTransactionsResponseSchema.safeParse(data);
  if (!validated.success) {
    console.error("Income Statement transactions response validation failed:", validated.error);
    throw new Error("The account transaction response was not in the expected format.");
  }
  return validated.data;
}
