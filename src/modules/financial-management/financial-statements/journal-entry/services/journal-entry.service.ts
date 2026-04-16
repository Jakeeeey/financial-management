import { JournalEntry, JournalEntryListSchema } from "../types";

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
  const API_BASE = "http://100.81.225.79:8086/api/view-general-ledger-master/filter";
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

export async function getJournalEntryDrillDown(
  jeNo: string,
  token?: string
): Promise<any> {
  const API_BASE = "http://100.81.225.79:8086/api/journal-entry/drill-down";
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
