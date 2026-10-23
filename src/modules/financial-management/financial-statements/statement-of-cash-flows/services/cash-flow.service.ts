import {
  CashFlowEntry,
  CashFlowResponse,
  CashFlowResponseSchema,
  CashFlowTransactionDetails,
  CashFlowTransactionDetailsSchema,
} from "../types/cash-flow.schema";

export interface FetchCashFlowParams {
  startDate: string;
  endDate: string;
  cashFlowActivity?: string; // "Operating" | "Investing" | "Financing" | null
  signal?: AbortSignal;
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
      signal: params.signal,
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
    if (!params.signal?.aborted) console.error("Cash Flow Service Error:", error);
    throw error;
  }
}

export async function getCashFlowTransactionDetails(
  journalEntryId: string,
  sourceModule: string,
  signal?: AbortSignal,
): Promise<CashFlowTransactionDetails> {
  const query = new URLSearchParams({ journalEntryId, sourceModule });
  const response = await fetch(
    `/api/fm/financial-statements/statement-of-cash-flow/transactions?${query.toString()}`,
    { method: "GET", cache: "no-store", signal },
  );

  if (!response.ok) {
    throw new Error(`Unable to load journal details (${response.status}).`);
  }

  const parsed = CashFlowTransactionDetailsSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("The journal details response was not in the expected format.");
  }

  return parsed.data;
}

export type CashFlowActivityCategory = "operating" | "investing" | "financing" | "other";

export function classifyCashFlowActivity(activity: string | null | undefined): CashFlowActivityCategory {
  const normalizedActivity = activity?.toLowerCase() || "";
  if (normalizedActivity.includes("operating")) return "operating";
  if (normalizedActivity.includes("investing")) return "investing";
  if (normalizedActivity.includes("financing")) return "financing";
  return "other";
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
    grouped[classifyCashFlowActivity(entry.cashFlowActivity)].push(entry);
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
  const uncategorizedNetMovement = grouped.other.reduce(
    (sum, entry) => sum + (entry.netCashFlow || 0),
    0
  );

  const netIncreaseInCash = operatingTotal + investingTotal + financingTotal;
  const registerNetMovement = entries.reduce(
    (sum, entry) => sum + (entry.netCashFlow || 0),
    0
  );
  const reconciliationDifference = registerNetMovement - netIncreaseInCash;

  return {
    operatingActivities: operatingTotal,
    investingActivities: investingTotal,
    financingActivities: financingTotal,
    netIncreaseInCash,
    uncategorizedCount: grouped.other.length,
    uncategorizedNetMovement,
    registerNetMovement,
    reconciliationDifference,
  };
}
