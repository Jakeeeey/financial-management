import {
  BalanceSheetDrillDownResponse,
  BalanceSheetDrillDownResponseSchema,
  BalanceSheetResponse,
  BalanceSheetResponseSchema,
} from "../types/balance-sheet.schema";

/**
 * Server-side service for fetching balance sheet data from the external backend API.
 * Follows the same pattern as trial-balance.service.ts.
 */

interface FetchBalanceSheetParams {
  startDate: string;
  endDate: string;
  status?: string;
  includeComparison?: boolean;
  divisionName?: string;
  departmentName?: string;
  comparisonStartDate?: string;
  comparisonEndDate?: string;
}

export async function getBalanceSheet(
  params: FetchBalanceSheetParams,
  token?: string
): Promise<BalanceSheetResponse> {
  const API_BASE = `${process.env.SPRING_API_BASE_URL}/api/balance-sheet`;

  // Build query string
  const query = new URLSearchParams();
  query.set("startDate", params.startDate);
  query.set("endDate", params.endDate);

  if (params.status) {
    query.set("status", params.status);
  }
  if (params.includeComparison) {
    query.set("includeComparison", "true");
  }
  if (params.divisionName) {
    query.set("divisionName", params.divisionName);
  }
  if (params.departmentName) {
    query.set("departmentName", params.departmentName);
  }
  if (params.comparisonStartDate) {
    query.set("comparisonStartDate", params.comparisonStartDate);
  }
  if (params.comparisonEndDate) {
    query.set("comparisonEndDate", params.comparisonEndDate);
  }

  const url = `${API_BASE}?${query.toString()}`;

  try {
    const headers: Record<string, string> = {
      "cache-no-store": "true",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch balance sheet: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate the response data using Zod
    const validated = BalanceSheetResponseSchema.safeParse(data);

    if (!validated.success) {
      console.error("Balance Sheet data validation failed:", validated.error);
      // Fallback to raw data but log the schema mismatch
      return data as BalanceSheetResponse;
    }

    return validated.data;
  } catch (error) {
    console.error("Balance Sheet Service Error:", error);
    throw error;
  }
}

interface FetchDrillDownParams {
  coaId: number;
  startDate: string;
  endDate: string;
  status?: string;
  divisionName?: string;
  departmentName?: string;
}

export async function getBalanceSheetDrillDown(
  params: FetchDrillDownParams,
  token?: string
): Promise<BalanceSheetDrillDownResponse> {
  const API_BASE = `${process.env.SPRING_API_BASE_URL}/api/balance-sheet/drill-down`;
  const query = new URLSearchParams();
  query.set("coaId", String(params.coaId));
  query.set("startDate", params.startDate);
  query.set("endDate", params.endDate);
  if (params.status) query.set("status", params.status);
  if (params.divisionName) query.set("divisionName", params.divisionName);
  if (params.departmentName) query.set("departmentName", params.departmentName);

  const url = `${API_BASE}?${query.toString()}`;

  try {
    const headers: Record<string, string> = {
      "cache-no-store": "true",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch drill-down data: ${response.statusText}`);
    }

    const data = await response.json();

    const validated = BalanceSheetDrillDownResponseSchema.safeParse(data);

    if (!validated.success) {
      console.error("Drill-Down data validation failed:", validated.error);
      throw new Error("The balance sheet inspection response was incomplete.");
    }

    return validated.data;
  } catch (error) {
    console.error("Drill-Down Service Error:", error);
    throw error;
  }
}

