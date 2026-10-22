import { FinancialPerformanceResponse, FinancialPerformanceResponseSchema } from "../types/financial-performance.schema";

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
