"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { MonthlyBreakdown } from "./components/MonthlyBreakdown";
import { OptionCombobox } from "./components/OptionCombobox";
import { PairDetailDialog } from "./components/PairDetailDialog";
import { PairMatrix } from "./components/PairMatrix";
import { WithholdingTable } from "./components/WithholdingTable";
import { TAX_YEARS } from "./constants";
import { useIntercompany } from "./hooks/useIntercompany";
import type { IntercompanyPair } from "./types";
import { buildWithholdingRows } from "./withholding";

/**
 * The service puts the structural caveat first (registry coverage, unreachable ledgers), so the
 * head of the list is the one worth reading; the rest fold away.
 */
/**
 * Notes arrive as "CODE: reason" once per company, so seven companies produce seven copies of one
 * sentence. Grouping by reason turns that wall into one line naming the codes.
 */
function groupNotices(notices: string[]): string[] {
  const byReason = new Map<string, string[]>();
  const ungrouped: string[] = [];
  for (const notice of notices) {
    const match = /^([A-Z0-9]{2,6}):\s+(.+)$/.exec(notice);
    if (!match) {
      ungrouped.push(notice);
      continue;
    }
    const codes = byReason.get(match[2]);
    if (codes) codes.push(match[1]);
    else byReason.set(match[2], [match[1]]);
  }
  const grouped = [...byReason.entries()].map(([reason, codes]) =>
    codes.length === 1 ? `${codes[0]}: ${reason}` : `${codes.join(", ")}: ${reason}`,
  );
  return [...ungrouped, ...grouped];
}

function Notices({ notices }: { notices: string[] }) {
  const [open, setOpen] = useState(false);
  const [lead, ...rest] = useMemo(() => groupNotices(notices), [notices]);
  if (!lead) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Alert>
        <AlertTriangle />
        <AlertDescription className="min-w-0">
          <p className="line-clamp-2 text-foreground" title={lead}>
            {lead}
          </p>
          {rest.length > 0 ? (
            <>
              <CollapsibleTrigger className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-foreground underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                {open ? "Hide notes" : `Show ${rest.length} more note${rest.length === 1 ? "" : "s"}`}
                <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
              </CollapsibleTrigger>
              <CollapsibleContent className="w-full">
                {/* Every note is listed once expanded; a "…" after six hid the reasons people read this for. */}
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {rest.map((notice, index) => (
                    <li key={index} className="break-words">
                      {notice}
                    </li>
                  ))}
                </ul>
              </CollapsibleContent>
            </>
          ) : null}
        </AlertDescription>
      </Alert>
    </Collapsible>
  );
}

/**
 * Intercompany ledger — every directed company pair derived from the group's own documents.
 * Nothing here is typed in by hand: a sale is a sales invoice whose customer is another company,
 * a purchase is a purchase order whose supplier is. The notices say what that cannot see.
 */
export function IntercompanyModule() {
  const ledger = useIntercompany(new Date().getFullYear());
  const { data, isLoading, error, companyId, year, selectedCompany, companyOptions } = ledger;
  const [selected, setSelected] = useState<IntercompanyPair | null>(null);

  const years = useMemo(() => {
    const list = new Set<number>(TAX_YEARS);
    list.add(year);
    return Array.from(list).sort((left, right) => right - left);
  }, [year]);

  const pairs = useMemo(() => data?.pairs ?? [], [data]);
  const monthly = data?.monthly ?? [];
  const notices = data?.notices ?? [];
  const unreadable = (data?.companies ?? []).filter((company) => !company.reachable);
  const oneSided = data?.oneSided ?? 0;
  const withholding = useMemo(() => buildWithholdingRows(pairs), [pairs]);
  const companyLabel = selectedCompany
    ? `${selectedCompany.code} — ${selectedCompany.name}`
    : (data?.companies ?? []).length > 0
      ? "No company selected"
      : "Loading companies";

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Intercompany Ledger</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Sales invoices matched to purchase orders across the group&apos;s companies, month by month.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[280px]">
            <OptionCombobox
              options={companyOptions}
              value={companyId ? String(companyId) : ""}
              onChange={(value) => value && ledger.selectCompany(Number(value))}
              placeholder="Choose a company"
              searchPlaceholder="Search companies…"
              emptyLabel="No company matches."
              aria-label="Company"
            />
          </div>

          <Select value={String(year)} onValueChange={(value) => ledger.selectYear(Number(value))}>
            <SelectTrigger className="w-[120px]" aria-label="Tax year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {years.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void ledger.refetch()}
            disabled={isLoading}
            aria-label="Reload the intercompany ledger"
          >
            <RefreshCw className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not build the intercompany ledger</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {unreadable.length > 0 ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {unreadable.length} {unreadable.length === 1 ? "company" : "companies"} could not be read
          </AlertTitle>
          <AlertDescription>
            <p className="break-words">
              {unreadable
                .map((company) => `${company.code} (${company.unreachableReason ?? "no answer"})`)
                .join(" · ")}
              . Their documents are missing from this ledger, so a pair they would have formed is absent rather than
              zero.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading && !data ? (
        <div className="space-y-2 rounded-2xl border border-border/50 bg-card px-4 py-6 shadow-sm">
          {Array.from({ length: 8 }, (_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      ) : null}

      <Tabs defaultValue="matrix" className="space-y-4">
        <TabsList>
          {/* Counts stay blank until the payload lands: "0 pairs" while loading is a claim, not a placeholder. */}
          <TabsTrigger value="matrix" className="min-h-11 md:min-h-0">
            {isLoading ? "Pair matrix" : `Pair matrix (${pairs.length})`}
          </TabsTrigger>
          <TabsTrigger value="monthly" className="min-h-11 md:min-h-0">
            {isLoading ? "Monthly breakdown" : `Monthly breakdown (${monthly.length})`}
          </TabsTrigger>
          <TabsTrigger value="withholding" className="min-h-11 md:min-h-0">
            {isLoading ? "Withholding" : `Withholding (${withholding.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-4">
          <PairMatrix pairs={pairs} isLoading={isLoading} oneSided={oneSided} year={year} onSelectPair={setSelected} />
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <MonthlyBreakdown rows={monthly} isLoading={isLoading} year={year} companyLabel={companyLabel} />
        </TabsContent>

        <TabsContent value="withholding" className="space-y-4">
          <WithholdingTable rows={withholding} isLoading={isLoading} />
        </TabsContent>
      </Tabs>

      <Notices notices={notices} />

      <PairDetailDialog
        pair={selected}
        monthly={monthly}
        companyCode={selectedCompany?.code ?? ""}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}

