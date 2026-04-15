import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getJournalEntries } from "@/modules/financial-management/financial-statements/journal-entry/services/journal-entry.service";
import { 
  filterJournalEntries, 
  groupJournalEntries, 
  sortJournalEntryGroups, 
  calculateAnalytics 
} from "@/modules/financial-management/financial-statements/journal-entry/services/journal-entry.helpers";
import { FilterState, PresetRange } from "@/modules/financial-management/financial-statements/journal-entry/types";

/**
 * Proxy and Processing API route for the general ledger entries.
 * This route fetches raw data from the external master database and performs
 * server-side filtering, grouping, and pagination to optimize client performance.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Pagination parameters
  const page = parseInt(searchParams.get("page") || "0");
  const pageSize = parseInt(searchParams.get("pageSize") || "10");
  const mode = searchParams.get("mode") || "grouped";
  
  // Extract the optional accountNumber for Drill Down views
  const accountNumber = searchParams.get("accountNumber") || undefined;

  // Extract all filter parameters from query string
  const filters: FilterState = {
    search: searchParams.get("search") || "",
    startDate: searchParams.get("startDate") || "2025-01-01",
    endDate: searchParams.get("endDate") || "2025-12-30",
    presetRange: (searchParams.get("presetRange") as PresetRange) || "Yearly",
    selectedMonth: parseInt(searchParams.get("selectedMonth") || "0"),
    selectedQuarter: parseInt(searchParams.get("selectedQuarter") || "1"),
    selectedYear: parseInt(searchParams.get("selectedYear") || "2025"),
    branch: searchParams.get("branch") || "All Branches",
    division: searchParams.get("division") || "All Divisions",
    department: searchParams.get("department") || "All Departments",
    entryType: searchParams.get("entryType") || "All Entry Types",
    coa: searchParams.get("coa") || "All Accounts",
    sourceModule: searchParams.get("sourceModule") || "All Source Modules",
    showPostedOnly: searchParams.get("showPostedOnly") === "true",
    status: searchParams.get("status") || "All Statuses",
    accountNumber: accountNumber,
    sortField: searchParams.get("sortField") || "date",
    sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
  };

  const cookieStore = await cookies();
  const token = cookieStore.get("vos_access_token")?.value;


  try {
    // 1. Fetch raw flat data from the external master database
    const entries = await getJournalEntries(filters.startDate, filters.endDate, token, accountNumber);
    
    // 2. Apply filtering (Search, Status, Division, etc.)
    const filteredEntries = filterJournalEntries(entries, filters);
    
    // Optimization: if in flat mode, bypass expensive grouping and analytics
    if (mode === "flat") {
        let totalDebit = 0;
        let totalCredit = 0;
        
        filteredEntries.forEach(e => {
            totalDebit += e.debit;
            totalCredit += e.credit;
        });
        
        return NextResponse.json({
            metadata: {
                totalDebit,
                totalCredit,
                netBalance: Number((totalDebit - totalCredit).toFixed(2)),
                count: filteredEntries.length,
                currentPage: 0,
                pageSize: filteredEntries.length,
                totalPages: 1
            },
            data: filteredEntries
        });
    }
    
    // 3. Group flat entries into transaction blocks (groups)
    const groups = groupJournalEntries(filteredEntries);
    
    // 4. Calculate Analytics on the ENTIRE filtered range (consistent with dashboard totals)
    const analytics = calculateAnalytics(filteredEntries, groups);
    
    // 5. Apply user requested sorting
    const sortedGroups = sortJournalEntryGroups(groups, filters);
    
    // 6. Paginate the grouped results
    const totalGroups = sortedGroups.length;
    const totalPages = Math.ceil(totalGroups / pageSize);
    const startIdx = page * pageSize;
    const paginatedGroups = sortedGroups.slice(startIdx, startIdx + pageSize);
    
    // 7. Extract unique source modules for the client filters
    const uniqueSourceModules = Array.from(new Set(entries.map(e => e.sourceModule).filter(Boolean))).sort();
    
    return NextResponse.json({
      metadata: {
        totalGroups,
        totalPages,
        currentPage: page,
        pageSize,
        uniqueSourceModules
      },
      analytics,
      data: paginatedGroups
    });
  } catch (error: any) {
    console.error("API Route Error (Journal Entry):", error);
    return NextResponse.json(
      { error: "Failed to fetch journal entries from the master database", details: error.message },
      { status: 500 }
    );
  }
}
