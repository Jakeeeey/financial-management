import { TrialBalanceItem, TrialBalanceListSchema } from "../types/trial-balance.schema";

/**
 * Server-side service for fetching trial balance data from the external backend API.
 * Follows the same pattern as journal-entry.service.ts.
 */

interface FetchTrialBalanceParams {
  startDate: string;
  endDate: string;
  status?: string;
  accountCategory?: string;
  reviewFlag?: string;
  sourceModule?: string[];
  search?: string;
  divisionName?: string;
  departmentName?: string;
  postedOnly?: boolean;
}

export async function getTrialBalance(
  params: FetchTrialBalanceParams,
  token?: string
): Promise<TrialBalanceItem[]> {
  const API_BASE = "http://100.81.225.79:8086/api/trial-balance";

  // Build query string
  const query = new URLSearchParams();
  query.set("startDate", params.startDate);
  query.set("endDate", params.endDate);

  if (params.status && params.status !== "all") {
    query.set("status", params.status);
  }
  if (params.accountCategory && params.accountCategory !== "all") {
    query.set("accountCategory", params.accountCategory);
  }
  if (params.reviewFlag && params.reviewFlag !== "all") {
    query.set("reviewFlag", params.reviewFlag);
  }
  if (params.search) {
    query.set("search", params.search);
  }
  if (params.divisionName) {
    query.set("divisionName", params.divisionName);
  }
  if (params.departmentName) {
    query.set("departmentName", params.departmentName);
  }
  if (params.postedOnly) {
    query.set("postedOnly", "true");
  }

  // sourceModule supports multiple values
  if (params.sourceModule && params.sourceModule.length > 0) {
    for (const mod of params.sourceModule) {
      query.append("sourceModule", mod);
    }
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
      throw new Error(`Failed to fetch trial balance: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate the response data using Zod
    const validated = TrialBalanceListSchema.safeParse(data);

    if (!validated.success) {
      console.error("Trial Balance data validation failed:", validated.error);
      // Fallback to raw data but log the schema mismatch
      return data as TrialBalanceItem[];
    }

    return validated.data;
  } catch (error) {
    console.error("Trial Balance Service Error:", error);
    throw error;
  }
}

/**
 * Fetch drill-down transaction details for a specific GL account.
 */
interface FetchDrillDownParams {
  glCode: string;
  startDate: string;
  endDate: string;
}

export async function getTrialBalanceDrillDown(
  params: FetchDrillDownParams,
  token?: string
) {
  const API_BASE = "http://100.81.225.79:8086/api/trial-balance/drill-down";

  const query = new URLSearchParams();
  query.set("glCode", params.glCode);
  query.set("startDate", params.startDate);
  query.set("endDate", params.endDate);

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
      throw new Error(`Failed to fetch drill-down: ${response.statusText}`);
    }

    const json = await response.json();
    return json.data ?? [];
  } catch (error) {
    console.error("Trial Balance Drill-Down Service Error:", error);
    throw error;
  }
}
