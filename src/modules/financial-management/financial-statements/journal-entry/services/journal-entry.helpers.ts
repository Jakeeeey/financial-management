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
        divisionName: e.divisionName,
        department: e.department,
        departmentName: e.departmentName,
        creator: e.creator,
        entries: [],
        totalDebit: 0,
        totalCredit: 0,
        balance: 0,
        isImbalanced: false,
        postingDate: e.postingDate || null,
      });
    }
    const g = groupMap.get(e.jeGroupCounter)!;
    g.entries.push(e);
    g.totalDebit += e.debit;
    g.totalCredit += e.credit;
    
    // If we find a non-null posting date in any entry of the group, use it
    if (e.postingDate && !g.postingDate) {
        g.postingDate = e.postingDate;
    }
  });

  return Array.from(groupMap.values()).map((g) => {
    // Sort entries: Debits first, then Credits
    g.entries.sort((a, b) => {
      // If a is debit and b is credit, a comes first
      if (a.debit > 0 && b.debit === 0 && b.credit > 0) return -1;
      // If a is credit and b is debit, b comes first
      if (a.debit === 0 && a.credit > 0 && b.debit > 0) return 1;
      return 0;
    });

    // Rounding to 2 decimal places to avoid floating point issues
    g.balance = Number((g.totalDebit - g.totalCredit).toFixed(2));
    g.isImbalanced = Math.abs(g.balance) > 0.01;
    return g;
  });
}

/**
 * Sorts journal entry groups based on the provided filter state.
 */
export function sortJournalEntryGroups(groups: JournalEntryGroup[], filters: FilterState): JournalEntryGroup[] {
  if (!filters.sortField || !filters.sortOrder) return groups;

  const { sortField, sortOrder } = filters;
  const multiplier = sortOrder === "asc" ? 1 : -1;

  return [...groups].sort((a, b) => {
    let valA: any = "";
    let valB: any = "";

    switch (sortField) {
      case "date":
        valA = a.transactionDate;
        valB = b.transactionDate;
        break;
      case "postingDate":
        valA = a.postingDate || "";
        valB = b.postingDate || "";
        break;
      case "accountTitle":
        // Sort by the first entry's account title
        valA = a.entries[0]?.accountTitle || "";
        valB = b.entries[0]?.accountTitle || "";
        break;
      case "debit":
        valA = a.totalDebit;
        valB = b.totalDebit;
        break;
      case "credit":
        valA = a.totalCredit;
        valB = b.totalCredit;
        break;
      case "balance":
        valA = a.balance;
        valB = b.balance;
        break;
      default:
        return 0;
    }

    if (valA < valB) return -1 * multiplier;
    if (valA > valB) return 1 * multiplier;
    return 0;
  });
}

/**
 * Calculates high-level analytics for the dashboard summary cards.
 */
export function calculateAnalytics(
  entries: JournalEntry[], 
  groups: JournalEntryGroup[]
): AnalyticsSummary {
  const statusBreakdown: Record<string, number> = {};
  
  groups.forEach(g => {
    const s = g.status || "Unknown";
    statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
  });

  const highRiskEntries = groups.map(g => {
    const reasons: string[] = [];
    let severity = 0;

    // 1. Imbalance Risk
    if (g.isImbalanced) {
        reasons.push("Imbalance");
        severity += 3; // High priority
    }

    // 2. Large Amount Risk
    if (g.totalDebit > 50000) {
        reasons.push("Large Entry");
        severity += 1;
    }

    // 3. Weekend Posting Risk
    try {
        const d = new Date(g.transactionDate);
        const day = d.getDay();
        if (day === 0 || day === 6) {
            reasons.push("Weekend Posting");
            severity += 1;
        }
    } catch(e) {}

    // 4. Late Posting Risk
    if (g.postingDate && g.transactionDate) {
        try {
            const tDate = new Date(g.transactionDate);
            const pDate = new Date(g.postingDate);
            const diffTime = Math.abs(pDate.getTime() - tDate.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays > 3) {
                reasons.push("Late Posting");
                severity += 1;
            }
        } catch(e) {}
    }

    if (reasons.length > 0) {
        return {
            jeNo: g.jeNo,
            jeGroupCounter: g.jeGroupCounter,
            riskReasons: reasons,
            totalDebit: g.totalDebit,
            severity
        };
    }
    return null;
  })
  .filter((x): x is NonNullable<typeof x> => x !== null)
  .sort((a, b) => {
    // Riskiest at the top (by severity count then by amount)
    if (b.severity !== a.severity) return b.severity - a.severity;
    return b.totalDebit - a.totalDebit;
  });

  return {
    jeCount: groups.length,
    totalDebit: groups.reduce((acc, g) => acc + g.totalDebit, 0),
    totalCredit: groups.reduce((acc, g) => acc + g.totalCredit, 0),
    netBalance: Number(groups.reduce((acc, g) => acc + g.balance, 0).toFixed(2)),
    largestEntry: Math.max(...entries.map(e => Math.max(e.debit, e.credit)), 0),
    imbalancedCount: groups.filter(g => g.isImbalanced).length,
    postedCount: groups.filter(g => (g.status || "").toLowerCase() === "posted").length,
    unpostedCount: groups.filter(g => (g.status || "").toLowerCase() !== "posted").length,
    statusBreakdown,
    highRiskEntries
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
        (e.jeNo || "").toLowerCase().includes(s) || 
        (e.accountTitle || "").toLowerCase().includes(s) || 
        (e.accountNumber || "").toLowerCase().includes(s) ||
        (e.description || "").toLowerCase().includes(s) ||
        (e.transactionRef && e.transactionRef.toLowerCase().includes(s));
      if (!match) return false;
    }
    
    if (filters.accountNumber && e.accountNumber !== filters.accountNumber) return false;
    if (filters.division !== "All Divisions" && e.division !== filters.division) return false;
    if (filters.department !== "All Departments" && e.department !== filters.department) return false;
    if (filters.status !== "All Statuses" && e.status !== filters.status) return false;
    if (filters.sourceModule !== "All Source Modules" && e.sourceModule !== filters.sourceModule) return false;
    if (filters.showPostedOnly && e.status !== "Posted") return false;
    
    // Strict Date Filtering
    const entryDate = new Date(e.transactionDate);
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    
    // Set hours to 0 to compare dates only
    entryDate.setHours(0, 0, 0, 0);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    
    if (entryDate < startDate || entryDate > endDate) return false;

    return true;
  });
}
