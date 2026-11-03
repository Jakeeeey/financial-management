import { NextRequest, NextResponse } from "next/server";
import { format } from "date-fns";
import { proxySpring, refreshedAccessToken } from "@/app/api/fm/financial-statements/adjusting-journal-entries/_spring";
import { analyticsQuery, normalizeJournalQuery } from "../_query";
import { parseJournalEntryUrlState } from "@/modules/financial-management/financial-statements/journal-entry/utils/filter-state";
import { getAppliedFilterChips } from "@/modules/financial-management/financial-statements/journal-entry/utils/applied-filter-chips";
import { loadJournalExportGroups } from "@/modules/financial-management/financial-statements/journal-entry/services/export-data";
import { generateJournalExcel, generateJournalPdf } from "@/modules/financial-management/financial-statements/journal-entry/services/export.service";
import type { JournalEntryFilterOptions } from "@/modules/financial-management/financial-statements/journal-entry/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

class ExportError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function GET(request: NextRequest) {
  const cookies = new Map<string, string>();
  let token: string | undefined;
  let retryAfter: string | null = null;
  const finish = (response: NextResponse) => {
    response.headers.set("Cache-Control", "no-store");
    for (const cookie of cookies.values()) response.headers.append("Set-Cookie", cookie);
    if (retryAfter) response.headers.set("Retry-After", retryAfter);
    return response;
  };
  const readSpring = async (path: string) => {
    request.signal.throwIfAborted();
    const response = await proxySpring(path, { signal: request.signal }, token);
    for (const cookie of response.headers.getSetCookie()) cookies.set(cookie.split("=")[0], cookie);
    token = refreshedAccessToken(response) || token;
    retryAfter = response.headers.get("Retry-After") || retryAfter;
    if (!response.ok) {
      const status = response.status;
      const message = status === 401 ? "Your session expired. Please sign in and retry the export."
        : status === 403 ? "You do not have permission to export these journals."
        : status === 429 ? "Too many requests. Please wait and retry the export."
        : "Journal data is temporarily unavailable. Please retry the export.";
      throw new ExportError(message, [401, 403, 429, 503].includes(status) ? status : 502);
    }
    return response.json();
  };

  try {
    const params = normalizeJournalQuery(new URL(request.url).searchParams);
    const output = params.get("format");
    if (output !== "pdf" && output !== "xlsx") throw new ExportError("Choose PDF or Excel for the export.", 400);
    const timeZone = params.get("timeZone") || "Asia/Manila";
    try {
      new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    } catch {
      throw new ExportError("Choose a valid time zone for the export.", 400);
    }
    for (const key of ["startDate", "endDate"]) {
      const value = params.get(key);
      if (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))
        || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value)) {
        throw new ExportError("Choose a valid reporting date range.", 400);
      }
    }
    // Keep explicit applied dates rather than deriving them again from picker state.
    params.set("presetRange", "Custom");
    const { filters } = parseJournalEntryUrlState(params);
    if (filters.startDate > filters.endDate) throw new ExportError("The start date must not follow the end date.", 400);
    const scope = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value != null) scope.set(key, String(value)); });
    const query = analyticsQuery(scope);
    query.set("sortField", filters.sortField);
    query.set("sortOrder", filters.sortOrder || "desc");
    query.set("includeAnalytics", "false");
    const groups = await loadJournalExportGroups(async (page, pageSize) => {
      query.set("page", String(page));
      query.set("pageSize", String(pageSize));
      return readSpring(`/api/view-general-ledger-master/grouped?${query}`);
    }, request.signal);

    let options: JournalEntryFilterOptions = { branches: [], divisions: [], departments: [] };
    if (filters.branch !== "All Branches" || filters.division !== "All Divisions" || filters.department !== "All Departments") {
      options = await readSpring("/api/view-general-ledger-master/filter-options");
      if (![options?.branches, options?.divisions, options?.departments].every(Array.isArray)) {
        throw new ExportError("Filter labels could not be loaded. Please retry the export.", 502);
      }
      for (const key of ["branches", "divisions", "departments"] as const) {
        options[key] = options[key].filter(item => item && item.id != null && typeof item.name === "string")
          .map(item => ({ id: String(item.id), name: item.name }));
      }
    }
    const labels = getAppliedFilterChips(filters, options).filter(chip => chip.key !== "period").map(chip => chip.label);
    const dateRange = `${format(new Date(`${filters.startDate}T00:00:00`), "MMM d, yyyy")} to ${format(new Date(`${filters.endDate}T00:00:00`), "MMM d, yyyy")}`;
    request.signal.throwIfAborted();
    const bytes = output === "pdf" ? generateJournalPdf(groups, dateRange, labels, timeZone) : generateJournalExcel(groups, dateRange, labels, timeZone);
    request.signal.throwIfAborted();
    return finish(new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": output === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="General_Journal_Export.${output}"`,
      },
    }));
  } catch (error) {
    if (request.signal.aborted) return finish(NextResponse.json({ error: "Export canceled." }, { status: 499 }));
    const message = error instanceof ExportError ? error.message
      : error instanceof Error && /^The export|^Journal results/.test(error.message) ? error.message
      : "Unable to generate the journal export. Please retry.";
    return finish(NextResponse.json({ error: message }, { status: error instanceof ExportError ? error.status : 500 }));
  }
}
