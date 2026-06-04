import type {
  AdjustingEntry,
  AdjustingEntryPage,
  AdjustingEntryPayload,
  AdjustingEntryQuery,
  AdjustingEntrySourceJournal,
  AdjustingEntrySourceJournalSummary,
  DepartmentLookup,
  DivisionLookup,
} from "../types";

const BASE = "/api/fm/financial-statements/adjusting-journal-entries";

type JsonRecord = Record<string, unknown>;

type CoaRow = {
  coa_id?: unknown;
  gl_code?: unknown;
  account_title?: unknown;
};

type DivisionRow = {
  division_id?: unknown;
  division_name?: unknown;
};

type DepartmentRow = {
  departmentId?: unknown;
  department_id?: unknown;
  departmentName?: unknown;
  department_name?: unknown;
  parentDivision?: unknown;
  parent_division?: unknown;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractMessage(json: unknown, fallback: string): string {
  if (!isRecord(json)) return fallback;

  for (const key of ["detail", "message", "error"]) {
    const value = json[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const fieldMessages = Object.values(json).filter((value): value is string => typeof value === "string");
  return fieldMessages.length > 0 ? fieldMessages.join(", ") : fallback;
}

async function parseResponse<T>(res: Response, fallback: string): Promise<T> {
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = { message: text };
    }
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error(extractMessage(
        json,
        "Your session has expired. Please sign in again before saving adjusting journal entries.",
      ));
    }
    throw new Error(extractMessage(json, fallback));
  }

  return json as T;
}

function appendOptional(params: URLSearchParams, key: string, value: unknown) {
  if (value === undefined || value === null || value === "") return;
  params.set(key, String(value));
}

async function refreshSession() {
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
  });

  return res.ok;
}

async function fetchWithAuthRetry(input: RequestInfo | URL, init?: RequestInit) {
  const requestInit: RequestInit = {
    ...init,
    credentials: init?.credentials ?? "same-origin",
  };
  const res = await fetch(input, requestInit);
  if (res.status !== 401) return res;

  const refreshed = await refreshSession();
  if (!refreshed) return res;

  return fetch(input, requestInit);
}

export const adjustingJournalEntriesApi = {
  async list(query: AdjustingEntryQuery): Promise<AdjustingEntryPage> {
    const params = new URLSearchParams();
    params.set("page", String(query.page));
    params.set("pageSize", String(query.pageSize));
    appendOptional(params, "search", query.search?.trim());
    appendOptional(params, "status", query.status && query.status !== "All" ? query.status : undefined);
    appendOptional(params, "startDate", query.startDate);
    appendOptional(params, "endDate", query.endDate);
    appendOptional(params, "divisionId", query.divisionId);
    appendOptional(params, "departmentId", query.departmentId);
    appendOptional(params, "sourceJeNo", query.sourceJeNo?.trim());
    appendOptional(params, "sort", query.sort);

    const res = await fetchWithAuthRetry(`${BASE}?${params.toString()}`, { cache: "no-store" });
    return parseResponse<AdjustingEntryPage>(res, "Failed to load adjusting journal entries");
  },

  async get(id: number): Promise<AdjustingEntry> {
    const res = await fetchWithAuthRetry(`${BASE}/${id}`, { cache: "no-store" });
    return parseResponse<AdjustingEntry>(res, "Failed to load adjusting journal entry");
  },

  async sourceJournalEntry(jeNo: string): Promise<AdjustingEntrySourceJournal> {
    const res = await fetchWithAuthRetry(`${BASE}/source-journal-entry/${encodeURIComponent(jeNo)}`, { cache: "no-store" });
    return parseResponse<AdjustingEntrySourceJournal>(res, "Failed to load source journal entry");
  },

  async searchSourceJournalEntries(query: string, limit = 10): Promise<AdjustingEntrySourceJournalSummary[]> {
    const params = new URLSearchParams({
      q: query.trim(),
      limit: String(limit),
    });
    const res = await fetchWithAuthRetry(`${BASE}/source-journal-entries?${params.toString()}`, { cache: "no-store" });
    return parseResponse<AdjustingEntrySourceJournalSummary[]>(res, "Failed to search source journal entries");
  },

  async create(payload: AdjustingEntryPayload): Promise<AdjustingEntry> {
    const res = await fetchWithAuthRetry(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseResponse<AdjustingEntry>(res, "Failed to create adjusting journal entry");
  },

  async update(id: number, payload: AdjustingEntryPayload): Promise<AdjustingEntry> {
    const res = await fetchWithAuthRetry(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return parseResponse<AdjustingEntry>(res, "Failed to update adjusting journal entry");
  },

  async post(id: number): Promise<AdjustingEntry> {
    const res = await fetchWithAuthRetry(`${BASE}/${id}/post`, { method: "POST" });
    return parseResponse<AdjustingEntry>(res, "Failed to post adjusting journal entry");
  },

  async void(id: number): Promise<AdjustingEntry> {
    const res = await fetchWithAuthRetry(`${BASE}/${id}/void`, { method: "POST" });
    return parseResponse<AdjustingEntry>(res, "Failed to void adjusting journal entry");
  },

  async delete(id: number): Promise<void> {
    const res = await fetchWithAuthRetry(`${BASE}/${id}`, { method: "DELETE" });
    if (!res.ok) {
      await parseResponse<unknown>(res, "Failed to delete adjusting journal entry");
    }
  },
};

export async function fetchCoaOptions() {
  const res = await fetch("/api/fm/chart-of-accounts?resource=chart_of_accounts&page=1&pageSize=100", {
    cache: "no-store",
  });
  const json = await parseResponse<{ data?: CoaRow[] }>(res, "Failed to load chart of accounts");

  return (json.data ?? [])
    .map((row) => {
      const id = asNumber(row.coa_id);
      if (!id) return null;
      const code = asString(row.gl_code);
      const title = asString(row.account_title);
      return {
        value: String(id),
        label: [code, title].filter(Boolean).join(" - ") || `COA #${id}`,
      };
    })
    .filter((row): row is { value: string; label: string } => row !== null);
}

export async function fetchDivisionOptions(): Promise<DivisionLookup[]> {
  const params = new URLSearchParams({
    fields: "division_id,division_name",
    sort: "division_name",
    limit: "-1",
  });
  const res = await fetch(`/api/fm/treasury/budgeting/budget-creation/division?${params.toString()}`, {
    cache: "no-store",
  });
  const json = await parseResponse<{ data?: DivisionRow[] }>(res, "Failed to load divisions");

  return (json.data ?? [])
    .map((row) => {
      const id = asNumber(row.division_id);
      if (!id) return null;
      return { id, name: asString(row.division_name) || `Division #${id}` };
    })
    .filter((row): row is DivisionLookup => row !== null);
}

export async function fetchDepartmentOptions(): Promise<DepartmentLookup[]> {
  const res = await fetch("/api/fm/setup/departments", { cache: "no-store" });
  const json = await parseResponse<DepartmentRow[]>(res, "Failed to load departments");

  return json
    .map((row) => {
      const id = asNumber(row.departmentId ?? row.department_id);
      if (!id) return null;
      return {
        id,
        name: asString(row.departmentName ?? row.department_name) || `Department #${id}`,
        parentDivision: asNumber(row.parentDivision ?? row.parent_division),
      };
    })
    .filter((row): row is DepartmentLookup => row !== null);
}
