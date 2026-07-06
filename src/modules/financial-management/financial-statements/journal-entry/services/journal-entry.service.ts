import { JournalEntry, JournalEntryListSchema, PostedAdjustmentTotals } from "../types";

/**
 * Server-side service for fetching general ledger entries from the master database.
 * This service directly communicates with the external backend API.
 */
export async function getJournalEntries(
  startDate: string,
  endDate: string,
  token?: string,
  accountNumber?: string
): Promise<JournalEntry[]> {
  const API_BASE = `${process.env.SPRING_API_BASE_URL}/api/view-general-ledger-master/filter`;
  let url = `${API_BASE}?startDate=${startDate}&endDate=${endDate}`;

  if (accountNumber) {
    url += `&accountNumber=${accountNumber}`;
  }

  try {
    const headers: Record<string, string> = {
      'cache-no-store': 'true'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch journal entries: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate the response data using Zod
    const validated = JournalEntryListSchema.safeParse(data);

    if (!validated.success) {
      console.error("Data validation failed:", validated.error);
      // Fallback to returning raw data if validation fails in a non-breaking way, 
      // but log the schema mismatch for maintenance.
      return data as JournalEntry[];
    }

    return validated.data;
  } catch (error) {
    console.error("Journal Entry Service Error:", error);
    throw error;
  }
}

export async function getGroupedJournalEntries(
  searchParams: URLSearchParams,
  token?: string
): Promise<unknown> {
  const API_BASE = `${process.env.SPRING_API_BASE_URL}/api/view-general-ledger-master/grouped`;
  const url = `${API_BASE}?${searchParams.toString()}`;

  try {
    const headers: Record<string, string> = {
      "cache-no-store": "true",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch grouped journal entries: ${response.statusText}`);
    }

    return response.json();
  } catch (error) {
    console.error("Grouped Journal Entry Service Error:", error);
    throw error;
  }
}

export async function getPostedAdjustmentTotals(
  sourceJeNos: string[],
  token?: string
): Promise<PostedAdjustmentTotals[]> {
  const uniqueSourceJeNos = Array.from(new Set(sourceJeNos.map((jeNo) => jeNo.trim()).filter(Boolean)));
  if (uniqueSourceJeNos.length === 0) return [];

  const url = `${process.env.SPRING_API_BASE_URL}/api/financial-statements/adjusting-journal-entries/posted-totals`;

  try {
    const headers: Record<string, string> = {
      "cache-no-store": "true",
      "Content-Type": "application/json",
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(uniqueSourceJeNos),
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch posted adjusting entry totals: ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) return [];

    return data.map((row: Partial<PostedAdjustmentTotals>) => ({
      sourceJeNo: String(row.sourceJeNo ?? ""),
      totalDebit: Number(row.totalDebit ?? 0),
      totalCredit: Number(row.totalCredit ?? 0),
      variance: Number(row.variance ?? 0),
    })).filter((row) => row.sourceJeNo);
  } catch (error) {
    console.error("Posted Adjustment Totals Service Error:", error);
    throw error;
  }
}

export async function getJournalEntryDrillDown(
  jeNo: string,
  token?: string
): Promise<unknown> {
  const API_BASE = `${process.env.SPRING_API_BASE_URL}/api/journal-entry/drill-down`;
  const url = `${API_BASE}?jeNo=${jeNo}`;

  try {
    const headers: Record<string, string> = {
      'cache-no-store': 'true'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch drill down data: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Journal Entry Drill Down Service Error:", error);
    throw error;
  }
}
