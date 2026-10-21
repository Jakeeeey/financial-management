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
  ChevronDown,
  Filter,
  Loader2
} from "lucide-react";
import { TrialBalanceItem, TrialBalanceDrillDownItem } from "../types/trial-balance.schema";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DataTable } from "@/components/ui/new-data-table";
import { ColumnDef } from "@tanstack/react-table";
import { formatTrialBalanceAmount, getPeriodMovementLabel, PERIOD_ACTIVITY_NOTE } from "../utils/money";
import { format } from "date-fns";
import { useTrialBalanceContext } from "../providers/TrialBalanceProvider";
import { toast } from "sonner";
import { exportDrillDownToExcel, exportDrillDownToCSV } from "../services/drill-down-export.service";
import { getTrialBalanceReportLabels } from "../utils/filter-state";
import styles from "./TrialBalanceDrillDown.module.css";

const safeGet = {
    journalId: (row: TrialBalanceDrillDownItem) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any;
        return (r.journalEntryId || r.jeNo || r.reference || r.journalNo || "") as string;
    },
    debit: (row: TrialBalanceDrillDownItem) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any;
        return Number(r.debit ?? r.debitAmount ?? 0);
    },
    credit: (row: TrialBalanceDrillDownItem) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = row as any;
        return Number(r.credit ?? r.creditAmount ?? 0);
    },
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
    header: () => <div className="text-right">Debit amount</div>,
    cell: ({ row }) => {
      const val = safeGet.debit(row.original);
      return (
        <div className="text-right text-xs font-mono tabular-nums whitespace-nowrap">
          {formatTrialBalanceAmount(val)}
        </div>
      );
    },
  },
  {
    accessorKey: "credit",
    header: () => <div className="text-right">Credit amount</div>,
    cell: ({ row }) => {
      const val = safeGet.credit(row.original);
      return (
        <div className="text-right text-xs font-mono tabular-nums whitespace-nowrap text-primary">
          {formatTrialBalanceAmount(val)}
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
  const { reportContext: filters } = useTrialBalanceContext();
  const [lines, setLines] = useState<TrialBalanceDrillDownItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Draft States (Inputs)
  const [draftSearchQuery, setDraftSearchQuery] = useState("");
  const [draftMinAmount, setDraftMinAmount] = useState("");
  const [draftStartDate, setDraftStartDate] = useState(filters?.startDate ?? "");
  const [draftEndDate, setDraftEndDate] = useState(filters?.endDate ?? "");

  // Active States (Applied)
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [activeMinAmount, setActiveMinAmount] = useState("");
  const [activeStartDate, setActiveStartDate] = useState(filters?.startDate ?? "");
  const [activeEndDate, setActiveEndDate] = useState(filters?.endDate ?? "");

  const toastIdRef = useRef<string | number | undefined>(undefined);

  // Core fetch function
  const fetchDrillDown = async (startDate: string, endDate: string) => {
    const query = new URLSearchParams();
    query.set("glCode", account.glCode);
    query.set("startDate", startDate);
    query.set("endDate", endDate);
    if (filters?.postedOnly) query.set("postedOnly", "true");
    else if (filters?.status && filters.status !== "all") query.set("status", filters.status);
    if (filters?.divisionName) query.set("division", filters.divisionName);
    if (filters?.departmentName) query.set("department", filters.departmentName);
    if (account.accountType) query.set("accountType", account.accountType);
    for (const source of filters?.sourceModule ?? []) query.append("sourceModule", source);

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
      setLoadError(null);
      try {
        const data = await fetchDrillDown(activeStartDate, activeEndDate);
        setLines(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setLoadError(message);
        toast.error(`Error loading records: ${message}`);
        setLines([]);
      } finally {
        setIsLoading(false);
      }
    }

    initialFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
          const maxVal = Math.max(Math.abs(d), Math.abs(c));
          const matchesMinAmount = !activeMinAmount || maxVal >= Number(activeMinAmount);

          return matchesSearch && matchesMinAmount;
      });
  }, [lines, activeSearchQuery, activeMinAmount]);

  const filteredTotals = useMemo(() => filteredLines.reduce((totals, line) => ({
    debitCentavos: totals.debitCentavos + Math.round(safeGet.debit(line) * 100),
    creditCentavos: totals.creditCentavos + Math.round(safeGet.credit(line) * 100),
  }), { debitCentavos: 0, creditCentavos: 0 }), [filteredLines]);
  const reportDebitCentavos = Math.round(Number(account.totalDebit || 0) * 100);
  const reportCreditCentavos = Math.round(Number(account.totalCredit || 0) * 100);
  const debitDifferenceCentavos = filteredTotals.debitCentavos - reportDebitCentavos;
  const creditDifferenceCentavos = filteredTotals.creditCentavos - reportCreditCentavos;
  const reportScopeLabels = filters ? getTrialBalanceReportLabels(filters) : [];

  const handleApplyFilters = async () => {
    setIsApplyingFilters(true);
    const loadingToastId = toast.loading("Applying filters...");
    toastIdRef.current = loadingToastId;

    const startTime = Date.now();
    const datesChanged = draftStartDate !== activeStartDate || draftEndDate !== activeEndDate;

    try {
      if (datesChanged) {
        // Dates changed — need to refetch from API
        setLoadError(null);
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (datesChanged) setLoadError(message);
      toast.error(`Failed to apply filters: ${message}`, { id: loadingToastId });
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

  const handleReset = async () => {
    const reportStartDate = filters?.startDate ?? "";
    const reportEndDate = filters?.endDate ?? "";
    const datesChanged = activeStartDate !== reportStartDate || activeEndDate !== reportEndDate;
    if (datesChanged || loadError) {
      setIsApplyingFilters(true);
      setLoadError(null);
      try {
        const data = await fetchDrillDown(reportStartDate, reportEndDate);
        setLines(data);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setLoadError(message);
        toast.error(`Failed to restore report date range: ${message}`);
        setIsApplyingFilters(false);
        return;
      }
      setIsApplyingFilters(false);
    }
    setDraftSearchQuery("");
    setDraftMinAmount("");
    setDraftStartDate(reportStartDate);
    setDraftEndDate(reportEndDate);
    
    setActiveSearchQuery("");
    setActiveMinAmount("");
    setActiveStartDate(reportStartDate);
    setActiveEndDate(reportEndDate);
  };

  const showSkeleton = isLoading || isApplyingFilters;

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col bg-background animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="mb-6 flex min-w-0 flex-col gap-4 border-b pb-4">
        <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
          <Button variant="outline" onClick={onBack} className="shrink-0 gap-2">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back to trial balance
          </Button>
          <div className="min-w-0 flex-1 basis-[18rem]">
            <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
              <h2 className="min-w-0 max-w-full break-words text-xl font-bold [overflow-wrap:anywhere]">
                {account.glCode} - {account.accountTitle}
              </h2>
              <Badge variant="outline" className="max-w-full whitespace-normal break-words">
                {account.accountCategory} • {account.accountType}
              </Badge>
            </div>
            <p className="break-words text-sm text-muted-foreground">
              Detailed transaction analysis • {getPeriodMovementLabel(account)}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {PERIOD_ACTIVITY_NOTE}
        </p>
        <section aria-label="Account total reconciliation" className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-2">
          <div className="rounded-md bg-background p-3">
            <p className="text-xs font-semibold text-muted-foreground">Report account total</p>
            <p className="mt-1 text-xs text-muted-foreground">Original report period and applied report criteria</p>
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <p>Debit <span className="min-w-0 break-words font-mono font-semibold tabular-nums">{formatTrialBalanceAmount(account.totalDebit)}</span></p>
              <p>Credit <span className="min-w-0 break-words font-mono font-semibold tabular-nums">{formatTrialBalanceAmount(account.totalCredit)}</span></p>
            </div>
          </div>
          <div className="rounded-md bg-background p-3" aria-live="polite">
            <p className="text-xs font-semibold text-muted-foreground">Filtered transaction total</p>
            <p className="mt-1 text-xs text-muted-foreground">After workspace date, search, and minimum amount filters</p>
            <div className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              <p>Debit <span className="min-w-0 break-words font-mono font-semibold tabular-nums">{isLoading || isApplyingFilters ? "Loading…" : loadError ? "Unavailable" : formatTrialBalanceAmount(filteredTotals.debitCentavos / 100)}</span></p>
              <p>Credit <span className="min-w-0 break-words font-mono font-semibold tabular-nums">{isLoading || isApplyingFilters ? "Loading…" : loadError ? "Unavailable" : formatTrialBalanceAmount(filteredTotals.creditCentavos / 100)}</span></p>
            </div>
            {!isLoading && !isApplyingFilters && !loadError && (debitDifferenceCentavos !== 0 || creditDifferenceCentavos !== 0) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Filtered minus report total: debit {formatTrialBalanceAmount(debitDifferenceCentavos / 100)}, credit {formatTrialBalanceAmount(creditDifferenceCentavos / 100)}.
              </p>
            )}
            {!isLoading && !isApplyingFilters && !loadError && debitDifferenceCentavos === 0 && creditDifferenceCentavos === 0 && (
              <p className="mt-2 text-xs text-emerald-700">Matches the report account total.</p>
            )}
          </div>
        </section>
        <section aria-label="Inherited report criteria" className="rounded-lg border p-3">
          <h3 className="text-xs font-semibold text-muted-foreground">Inherited report scope</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="outline">Period: {filters?.startDate} to {filters?.endDate}</Badge>
            {reportScopeLabels.map(label => <Badge key={label} variant="outline" className="max-w-full whitespace-normal break-words">{label}</Badge>)}
            {filters?.search && <Badge variant="outline" className="max-w-full whitespace-normal break-words">Account search: {filters.search}</Badge>}
          </div>
        </section>
      </div>

      <div className="flex min-h-0 w-full min-w-0 flex-col gap-4">
        <Collapsible defaultOpen={false} className="w-full min-w-0 rounded-lg border bg-card">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 p-3">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="group h-auto min-w-0 justify-start gap-2 px-2 py-1 text-left">
                <Filter aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">Workspace Filters</span>
                  <span className="block break-words text-xs font-normal text-muted-foreground">Search transactions and adjust the date range</span>
                </span>
                <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
          </div>
          <CollapsibleContent className="min-w-0 border-t p-3 sm:p-4">
            <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="min-w-0 space-y-2 sm:col-span-2">
                <Label htmlFor="je-search" className="text-xs">Search Lines</Label>
                <div className="relative">
                  <Search aria-hidden="true" className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="je-search"
                    placeholder="Journal ID, description..."
                    className="h-9 min-w-0 pl-8 text-xs"
                    value={draftSearchQuery}
                    onChange={(e) => setDraftSearchQuery(e.target.value)}
                    disabled={isApplyingFilters}
                  />
                </div>
              </div>

              <div className="min-w-0 space-y-2">
                <Label htmlFor="min-amount" className="text-xs">Minimum Amount</Label>
                <Input
                  id="min-amount"
                  type="number"
                  placeholder="₱0.00"
                  min="0"
                  step="0.01"
                  aria-describedby="min-amount-help"
                  className="h-9 min-w-0 text-xs"
                  value={draftMinAmount}
                  onChange={(e) => setDraftMinAmount(e.target.value)}
                  disabled={isApplyingFilters}
                />
                <p id="min-amount-help" className="text-[10px] text-muted-foreground">
                  Uses the absolute debit or credit amount, including negative transactions.
                </p>
              </div>

              <div className="min-w-0 space-y-2 sm:col-span-2 lg:col-span-1">
                <Label className="text-xs">Date Range</Label>
                <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  <div className="min-w-0">
                    <Label htmlFor="je-start-date" className="sr-only">Start date</Label>
                    <Input
                      id="je-start-date"
                      type="date"
                      aria-label="Start date"
                      className="h-8 w-full min-w-0 text-xs"
                      value={draftStartDate}
                      onChange={(e) => setDraftStartDate(e.target.value)}
                      disabled={isApplyingFilters}
                    />
                  </div>
                  <div className="min-w-0">
                    <Label htmlFor="je-end-date" className="sr-only">End date</Label>
                    <Input
                      id="je-end-date"
                      type="date"
                      aria-label="End date"
                      className="h-8 w-full min-w-0 text-xs"
                      value={draftEndDate}
                      onChange={(e) => setDraftEndDate(e.target.value)}
                      disabled={isApplyingFilters}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Dates are limited to this account and inherited report scope.</p>
              </div>

              <div className="flex min-w-0 flex-wrap gap-2 border-t pt-4 sm:col-span-2 lg:col-span-4">
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 w-full justify-center gap-2 text-xs sm:w-auto"
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
                <Button size="sm" variant="default" className="h-8 w-full justify-start gap-2 text-xs sm:w-auto" onClick={() => void handleReset()} disabled={isApplyingFilters}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Workspace
                </Button>
                <Button size="sm" variant="default" className="h-8 w-full justify-start gap-2 text-xs sm:w-auto" onClick={handleExportExcel} disabled={isApplyingFilters}>
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Export Excel
                </Button>
                <Button size="sm" variant="default" className="h-8 w-full justify-start gap-2 text-xs sm:w-auto" onClick={handleExportCSV} disabled={isApplyingFilters}>
                  <Download className="h-3.5 w-3.5" />
                  Export CSV
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div className={`${styles.tableHost} w-full min-w-0 max-w-full`}>
          {loadError && <p role="alert" className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Transaction details could not be loaded for this scope: {loadError}</p>}
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
