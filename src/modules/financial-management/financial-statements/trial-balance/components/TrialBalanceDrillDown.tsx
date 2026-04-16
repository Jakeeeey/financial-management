import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  ArrowLeft, 
  Search, 
  Download, 
  FileSpreadsheet,
  RotateCcw,
  Filter,
  Loader2
} from "lucide-react";
import { TrialBalanceItem, TrialBalanceDrillDownItem } from "../types/trial-balance.schema";
import { Label } from "@/components/ui/label";
import { DataTable } from "@/components/ui/new-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import { useTrialBalanceContext } from "../providers/TrialBalanceProvider";
import { toast } from "sonner";
import { exportDrillDownToExcel, exportDrillDownToCSV } from "../services/drill-down-export.service";

const safeGet = {
    journalId: (row: any) => row.journalEntryId || row.jeNo || row.reference || row.journalNo || "",
    debit: (row: any) => Number(row.debit || row.debitAmount || 0),
    credit: (row: any) => Number(row.credit || row.creditAmount || 0),
};

const columns: ColumnDef<TrialBalanceDrillDownItem>[] = [
  {
    accessorKey: "journalEntryId",
    header: "Journal ID",
    cell: ({ row }) => (
      <span className="font-medium text-xs font-mono">
        {safeGet.journalId(row.original)}
      </span>
    ),
  },
  {
    accessorKey: "date",
    header: "Date",
    cell: ({ row }) => (
      <span className="text-xs whitespace-nowrap">
        {row.original.date ? format(new Date(row.original.date), "yyyy-MM-dd") : "—"}
      </span>
    ),
  },
  {
    accessorKey: "description",
    header: "Description",
    cell: ({ row }) => <div className="text-xs">{row.original.description || "—"}</div>,
  },
  {
    accessorKey: "debit",
    header: () => <div className="text-right">Debit</div>,
    cell: ({ row }) => {
      const val = safeGet.debit(row.original);
      return (
        <div className="text-right text-xs font-mono">
          {val > 0 ? formatCurrency(val) : "—"}
        </div>
      );
    },
  },
  {
    accessorKey: "credit",
    header: () => <div className="text-right">Credit</div>,
    cell: ({ row }) => {
      const val = safeGet.credit(row.original);
      return (
        <div className="text-right text-xs font-mono text-primary">
          {val > 0 ? formatCurrency(val) : "—"}
        </div>
      );
    },
  },
  {
    accessorKey: "source",
    header: "Source",
    cell: ({ row }) => (
      <Badge variant="outline" className="text-[10px] bg-background font-normal">
        {row.original.source || "Unknown"}
      </Badge>
    ),
  },
  {
    accessorKey: "postedBy",
    header: "Posted By",
    cell: ({ row }) => (
      <span className="text-xs text-muted-foreground">
        {row.original.postedBy ?? "—"}
      </span>
    ),
  },
];

const MIN_LOADING_DELAY = 800;

export function TrialBalanceDrillDown({
  account,
  onBack,
}: {
  account: TrialBalanceItem;
  onBack: () => void;
}) {
  const { filters } = useTrialBalanceContext();
  const [lines, setLines] = useState<TrialBalanceDrillDownItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  // Draft States (Inputs)
  const [draftSearchQuery, setDraftSearchQuery] = useState("");
  const [draftMinAmount, setDraftMinAmount] = useState("");
  const [draftStartDate, setDraftStartDate] = useState(filters.startDate);
  const [draftEndDate, setDraftEndDate] = useState(filters.endDate);

  // Active States (Applied)
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [activeMinAmount, setActiveMinAmount] = useState("");
  const [activeStartDate, setActiveStartDate] = useState(filters.startDate);
  const [activeEndDate, setActiveEndDate] = useState(filters.endDate);

  const toastIdRef = useRef<string | number | undefined>(undefined);

  const formatAmount = (val: number) => {
    if (val === 0) return "—";
    return formatCurrency(val);
  };

  // Core fetch function
  const fetchDrillDown = async (startDate: string, endDate: string) => {
    const query = new URLSearchParams();
    query.set("glCode", account.glCode);
    query.set("startDate", startDate);
    query.set("endDate", endDate);

    const url = `/api/fm/financial-statements/trial-balance/drill-down?${query.toString()}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error("Failed to fetch drill-down records.");
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
  };

  // Initial load
  useEffect(() => {
    async function initialFetch() {
      setIsLoading(true);
      try {
        const data = await fetchDrillDown(activeStartDate, activeEndDate);
        setLines(data);
      } catch (err: any) {
        toast.error(`Error loading records: ${err.message}`);
        setLines([]);
      } finally {
        setIsLoading(false);
      }
    }

    initialFetch();
  }, [account.glCode]); // Only on initial mount / account change

  const filteredLines = useMemo(() => {
      return lines.filter(line => {
          const jid = safeGet.journalId(line).toLowerCase();
          const desc = (line.description || "").toLowerCase();
          const src = (line.source || "").toLowerCase();
          const pb = (line.postedBy || "").toLowerCase();
          const search = activeSearchQuery.toLowerCase();

          const matchesSearch = !activeSearchQuery || 
              jid.includes(search) || 
              desc.includes(search) || 
              src.includes(search) || 
              pb.includes(search);

          const d = safeGet.debit(line);
          const c = safeGet.credit(line);
          const maxVal = Math.max(d, c);
          const matchesMinAmount = !activeMinAmount || maxVal >= Number(activeMinAmount);

          return matchesSearch && matchesMinAmount;
      });
  }, [lines, activeSearchQuery, activeMinAmount]);

  const handleApplyFilters = async () => {
    setIsApplyingFilters(true);
    const loadingToastId = toast.loading("Applying filters...");
    toastIdRef.current = loadingToastId;

    const startTime = Date.now();
    const datesChanged = draftStartDate !== activeStartDate || draftEndDate !== activeEndDate;

    try {
      if (datesChanged) {
        // Dates changed — need to refetch from API
        const data = await fetchDrillDown(draftStartDate, draftEndDate);
        setLines(data);
        setActiveStartDate(draftStartDate);
        setActiveEndDate(draftEndDate);
      }

      // Apply client-side filters
      setActiveSearchQuery(draftSearchQuery);
      setActiveMinAmount(draftMinAmount);

      // Ensure minimum visual delay for the skeleton pulse
      const elapsed = Date.now() - startTime;
      if (elapsed < MIN_LOADING_DELAY) {
        await new Promise(resolve => setTimeout(resolve, MIN_LOADING_DELAY - elapsed));
      }

      toast.success("Filters applied successfully.", { id: loadingToastId });
    } catch (err: any) {
      toast.error(`Failed to apply filters: ${err.message}`, { id: loadingToastId });
    } finally {
      setIsApplyingFilters(false);
    }
  };

  const handleExportExcel = () => {
    exportDrillDownToExcel({
      items: filteredLines,
      glCode: account.glCode,
      accountTitle: account.accountTitle,
      startDate: activeStartDate,
      endDate: activeEndDate,
    });
    toast.success("Excel file exported successfully.");
  };

  const handleExportCSV = () => {
    exportDrillDownToCSV({
      items: filteredLines,
      glCode: account.glCode,
      accountTitle: account.accountTitle,
      startDate: activeStartDate,
      endDate: activeEndDate,
    });
    toast.success("CSV file exported successfully.");
  };

  const handleReset = () => {
    setDraftSearchQuery("");
    setDraftMinAmount("");
    setDraftStartDate(filters.startDate);
    setDraftEndDate(filters.endDate);
    
    setActiveSearchQuery("");
    setActiveMinAmount("");
    setActiveStartDate(filters.startDate);
    setActiveEndDate(filters.endDate);
  };

  const showSkeleton = isLoading || isApplyingFilters;

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex flex-col gap-4 border-b pb-4 mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold truncate">
                {account.glCode} - {account.accountTitle}
              </h2>
              <Badge variant="outline" className="shrink-0">
                {account.accountCategory} • {account.accountType}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Detailed transaction analysis • {account.balanceType} balance
            </p>
          </div>
          <div className="flex items-center gap-4 text-right">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Debit Total</p>
              <p className="font-mono font-bold">{formatAmount(account.totalDebit)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Credit Total</p>
              <p className="font-mono font-bold text-primary">{formatAmount(account.totalCredit)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Net Balance</p>
              <p className="font-mono font-bold">{formatCurrency(account.netBalance)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
        <div className="w-64 shrink-0 flex flex-col gap-6">
          <div className="space-y-4 pr-2">
            <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Workspace Filters</h3>

            <div className="space-y-2">
              <Label htmlFor="je-search" className="text-xs">Search Lines</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  id="je-search" 
                  placeholder="Journal ID, description..." 
                  className="h-9 pl-8 text-xs" 
                  value={draftSearchQuery}
                  onChange={(e) => setDraftSearchQuery(e.target.value)}
                  disabled={isApplyingFilters}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="min-amount" className="text-xs">Minimum Amount</Label>
              <Input 
                id="min-amount" 
                type="number" 
                placeholder="₱0.00" 
                className="h-9 text-xs" 
                value={draftMinAmount}
                onChange={(e) => setDraftMinAmount(e.target.value)}
                disabled={isApplyingFilters}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Date Range</Label>
              <div className="grid gap-2">
                <Input 
                  type="date" 
                  className="h-8 text-xs" 
                  value={draftStartDate} 
                  onChange={(e) => setDraftStartDate(e.target.value)}
                  disabled={isApplyingFilters}
                />
                <Input 
                  type="date" 
                  className="h-8 text-xs" 
                  value={draftEndDate} 
                  onChange={(e) => setDraftEndDate(e.target.value)}
                  disabled={isApplyingFilters}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Initialized from Trial Balance config</p>
            </div>

            <Button 
              size="sm" 
              variant="default" 
              className="w-full justify-center gap-2 h-8 text-xs mt-2" 
              onClick={handleApplyFilters}
              disabled={isApplyingFilters}
            >
              {isApplyingFilters ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Applying...
                </>
              ) : (
                <>
                  <Filter className="h-3.5 w-3.5" />
                  Apply Filters
                </>
              )}
            </Button>

            <div className="pt-4 border-t flex flex-col gap-2">
              <Button size="sm" variant="default" className="justify-start gap-2 h-8 text-xs" onClick={handleReset} disabled={isApplyingFilters}>
                <RotateCcw className="h-3.5 w-3.5" />
                Reset Workspace
              </Button>
              <Button size="sm" variant="default" className="justify-start gap-2 h-8 text-xs" onClick={handleExportExcel} disabled={isApplyingFilters}>
                <FileSpreadsheet className="h-3.5 w-3.5" />
                Export Excel
              </Button>
              <Button size="sm" variant="default" className="justify-start gap-2 h-8 text-xs" onClick={handleExportCSV} disabled={isApplyingFilters}>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <DataTable 
            columns={columns}
            data={showSkeleton ? [] : filteredLines}
            isLoading={showSkeleton}
            emptyTitle="No records found"
            emptyDescription="There are no transactions for this account in the selected date range."
            actionComponent={
              <Badge variant="outline" className="h-8 px-3 font-medium bg-background">
                {showSkeleton ? "..." : filteredLines.length} Lines
              </Badge>
            }
          />
        </div>
      </div>
    </div>
  );
}
