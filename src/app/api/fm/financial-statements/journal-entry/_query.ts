export function normalizeJournalQuery(searchParams: URLSearchParams) {
  const params = new URLSearchParams(searchParams);
  if ((!params.has("status") || params.get("status") === "All Statuses") && params.get("showPostedOnly") === "true") {
    params.set("status", "Posted");
  }
  params.delete("showPostedOnly");
  return params;
}

export function analyticsQuery(searchParams: URLSearchParams) {
  const normalized = normalizeJournalQuery(searchParams);
  const params = new URLSearchParams();
  for (const key of ["startDate", "endDate", "search", "entryType", "branch", "division", "department", "coa", "accountNumber", "sourceModule", "status"]) {
    const value = normalized.get(key);
    if (value !== null) params.set(key, value);
  }
  return params;
}
