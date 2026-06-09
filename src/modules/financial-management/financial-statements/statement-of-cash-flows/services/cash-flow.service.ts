import {
  CashFlowEntry,
  CashFlowResponse,
  CashFlowResponseSchema,
} from "../types/cash-flow.schema";

export interface FetchCashFlowParams {
  startDate: string;
  endDate: string;
  cashFlowActivity?: string; // "Operating" | "Investing" | "Financing" | null
}

/**
 * Fetches cash flow statement data from the Spring Boot backend.
 * Endpoint: /api/view-fs-report-statement-cash-flow
 */
export async function getCashFlowStatement(
  params: FetchCashFlowParams,
  token?: string
): Promise<CashFlowEntry[]> {
  const API_BASE = "/api/fm/financial-statements/statement-of-cash-flow";

  // Build query string
  const query = new URLSearchParams();
  
  if (params.startDate) {
    query.set("startDate", params.startDate);
  }
  if (params.endDate) {
    query.set("endDate", params.endDate);
  }
  if (params.cashFlowActivity && params.cashFlowActivity !== "All") {
    query.set("cashFlowActivity", params.cashFlowActivity);
  }

  const url = `${API_BASE}?${query.toString()}`;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
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
      throw new Error(`Failed to fetch cash flow statement: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate the response data using Zod
    const validated = CashFlowResponseSchema.safeParse(data);

    if (!validated.success) {
      console.error("Cash Flow data validation failed:", validated.error);
      // Return raw data but log the schema mismatch
      return (data as CashFlowResponse).data || [];
    }

    return validated.data.data;
  } catch (error) {
    console.error("Cash Flow Service Error:", error);
    throw error;
  }
}

/**
 * Groups cash flow entries by activity type for easier rendering
 */
export function groupCashFlowEntries(entries: CashFlowEntry[]) {
  const grouped = {
    operating: [] as CashFlowEntry[],
    investing: [] as CashFlowEntry[],
    financing: [] as CashFlowEntry[],
    other: [] as CashFlowEntry[],
  };

  entries.forEach((entry) => {
    const activity = entry.cashFlowActivity?.toLowerCase() || "";
    if (activity.includes("operating")) {
      grouped.operating.push(entry);
    } else if (activity.includes("investing")) {
      grouped.investing.push(entry);
    } else if (activity.includes("financing")) {
      grouped.financing.push(entry);
    } else {
      grouped.other.push(entry);
    }
  });

  return grouped;
}

/**
 * Calculates summary totals for each cash flow activity
 */
export function calculateCashFlowSummary(entries: CashFlowEntry[]) {
  const grouped = groupCashFlowEntries(entries);

  const operatingTotal = grouped.operating.reduce(
    (sum, entry) => sum + (entry.netCashFlow || 0),
    0
  );
  const investingTotal = grouped.investing.reduce(
    (sum, entry) => sum + (entry.netCashFlow || 0),
    0
  );
  const financingTotal = grouped.financing.reduce(
    (sum, entry) => sum + (entry.netCashFlow || 0),
    0
  );

  const netIncreaseInCash = operatingTotal + investingTotal + financingTotal;

  return {
    operatingActivities: operatingTotal,
    investingActivities: investingTotal,
    financingActivities: financingTotal,
    netIncreaseInCash,
  };
}