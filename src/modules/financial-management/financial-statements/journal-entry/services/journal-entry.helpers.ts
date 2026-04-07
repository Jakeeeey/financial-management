import { 
  JournalEntry, 
  JournalEntryGroup, 
  AnalyticsSummary, 
  FilterState 
} from "../types";

/**
 * Groups flat journal entries by their group counter and calculates row-level metadata.
 */
export function groupJournalEntries(entries: JournalEntry[]): JournalEntryGroup[] {
  const groupMap = new Map<number, JournalEntryGroup>();

  entries.forEach((e) => {
    if (!groupMap.has(e.jeGroupCounter)) {
      groupMap.set(e.jeGroupCounter, {
        jeGroupCounter: e.jeGroupCounter,
        jeNo: e.jeNo,
        transactionDate: e.transactionDate,
        sourceModule: e.sourceModule,
        description: e.description,
        status: e.status,
        division: e.division,
        department: e.department,
        creator: e.creator,
        entries: [],
        totalDebit: 0,
        totalCredit: 0,
        balance: 0,
        isImbalanced: false,
      });
    }
    const g = groupMap.get(e.jeGroupCounter)!;
    g.entries.push(e);
    g.totalDebit += e.debit;
    g.totalCredit += e.credit;
  });

  return Array.from(groupMap.values()).map((g) => {
    // Rounding to 2 decimal places to avoid floating point issues
    g.balance = Number((g.totalDebit - g.totalCredit).toFixed(2));
    g.isImbalanced = Math.abs(g.balance) > 0.01;
    return g;
  });
}

/**
 * Calculates high-level analytics for the dashboard summary cards.
 */
export function calculateAnalytics(
  entries: JournalEntry[], 
  groups: JournalEntryGroup[]
): AnalyticsSummary {
  return {
    jeCount: groups.length,
    totalDebit: groups.reduce((acc, g) => acc + g.totalDebit, 0),
    totalCredit: groups.reduce((acc, g) => acc + g.totalCredit, 0),
    netBalance: groups.reduce((acc, g) => acc + g.balance, 0),
    largestEntry: Math.max(...entries.map(e => Math.max(e.debit, e.credit)), 0),
    imbalancedCount: groups.filter(g => g.isImbalanced).length,
    postedCount: groups.filter(g => g.status === "Posted").length,
    unpostedCount: groups.filter(g => g.status !== "Posted").length,
  };
}

/**
 * Applies client-side filtering logic to the raw entry dataset.
 */
export function filterJournalEntries(entries: JournalEntry[], filters: FilterState): JournalEntry[] {
  return entries.filter((e) => {
    if (filters.search) {
      const s = filters.search.toLowerCase();
      const match = 
        e.jeNo.toLowerCase().includes(s) || 
        e.accountTitle.toLowerCase().includes(s) || 
        e.description.toLowerCase().includes(s) ||
        (e.transactionRef && e.transactionRef.toLowerCase().includes(s));
      if (!match) return false;
    }
    
    if (filters.division !== "All Divisions" && e.division !== filters.division) return false;
    if (filters.department !== "All Departments" && e.department !== filters.department) return false;
    if (filters.status !== "All Statuses" && e.status !== filters.status) return false;
    if (filters.sourceModule !== "All Source Modules" && e.sourceModule !== filters.sourceModule) return false;
    if (filters.showPostedOnly && e.status !== "Posted") return false;
    
    return true;
  });
}
