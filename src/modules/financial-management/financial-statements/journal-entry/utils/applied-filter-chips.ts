import { format } from "date-fns";
import type { FilterState, JournalEntryFilterOption, JournalEntryFilterOptions } from "../types";

export type AppliedFilterKey = "search" | "period" | "entryType" | "status" | "branch" | "division" | "department" | "sourceModule" | "coa" | "accountNumber";

export function getAppliedFilterChips(filters: FilterState, options: JournalEntryFilterOptions) {
  const chips: { key: AppliedFilterKey; label: string }[] = [];
  const now = new Date();
  const currentMonthStart = format(new Date(now.getFullYear(), now.getMonth(), 1), "yyyy-MM-dd");
  const currentMonthEnd = format(new Date(now.getFullYear(), now.getMonth() + 1, 0), "yyyy-MM-dd");
  const isDefaultPeriod = filters.presetRange === "Monthly"
    && filters.selectedMonth === now.getMonth()
    && filters.selectedYear === now.getFullYear()
    && filters.startDate.slice(0, 10) === currentMonthStart
    && filters.endDate.slice(0, 10) === currentMonthEnd;

  if (filters.search.trim()) chips.push({ key: "search", label: `Search: ${filters.search.trim()}` });
  if (!isDefaultPeriod) {
    const period = filters.presetRange === "Custom"
      ? `${format(new Date(filters.startDate), "MMM d, yyyy")} – ${format(new Date(filters.endDate), "MMM d, yyyy")}`
      : filters.presetRange === "Monthly"
        ? format(new Date(filters.selectedYear, filters.selectedMonth, 1), "MMMM yyyy")
        : filters.presetRange === "Quarterly"
          ? `Q${filters.selectedQuarter} ${filters.selectedYear}`
          : String(filters.selectedYear);
    chips.push({ key: "period", label: `Period: ${period}` });
  }
  if (filters.status !== "All Statuses") chips.push({ key: "status", label: `Status: ${filters.status}` });

  const addLookupChip = (key: "branch" | "division" | "department", allLabel: string, label: string, lookup: JournalEntryFilterOption[]) => {
    if (filters[key] === allLabel) return;
    const option = lookup.find((item) => item.id === filters[key]);
    chips.push({ key, label: `${label}: ${option?.name ?? filters[key]}` });
  };

  addLookupChip("branch", "All Branches", "Branch", options.branches);
  addLookupChip("division", "All Divisions", "Division", options.divisions);
  addLookupChip("department", "All Departments", "Department", options.departments);
  if (filters.entryType && filters.entryType !== "All Entry Types") chips.push({ key: "entryType", label: `Type: ${filters.entryType}` });
  if (filters.sourceModule !== "All Source Modules") chips.push({ key: "sourceModule", label: `Source: ${filters.sourceModule}` });
  if (filters.coa !== "All Accounts") chips.push({ key: "coa", label: `Account: ${filters.coa}` });
  if (filters.accountNumber) chips.push({ key: "accountNumber", label: `Account no.: ${filters.accountNumber}` });
  return chips;
}

