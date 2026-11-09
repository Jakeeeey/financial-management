"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
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

const MAX_VISIBLE_NOTES = 6;

/**
 * The service puts the structural caveat first (registry coverage, unreachable ledgers), so the
 * head of the list is the one worth reading; the rest fold away.
 */
function Notices({ notices }: { notices: string[] }) {
  const [open, setOpen] = useState(false);
  const [lead, ...rest] = notices;
  if (!lead) return null;

  const visible = rest.slice(0, MAX_VISIBLE_NOTES);
  const truncated = rest.length > MAX_VISIBLE_NOTES;

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
                <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                  {visible.map((notice, index) => (
                    <li key={index}>{notice}</li>
                  ))}
                  {truncated ? <li aria-hidden>…</li> : null}
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
  const withholding = useMemo(() => buildWithholdingRows(pairs), [pairs]);
  const companyLabel = selectedCompany
    ? `${selectedCompany.code} — ${selectedCompany.name}`
    : (data?.companies ?? []).length > 0
      ? "No company selected"
      : "Loading companies";

  return (
    <div className="space-y-4">
      <section
        aria-label="Intercompany scope"
        className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Intercompany ledger</h2>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Derived by matching sales invoices to purchase orders across the group&apos;s companies, month by month.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-[280px] space-y-1.5">
            <Label htmlFor="intercompany-company">Company</Label>
            <OptionCombobox
              id="intercompany-company"
              options={companyOptions}
              value={companyId ? String(companyId) : ""}
              onChange={(value) => value && ledger.selectCompany(Number(value))}
              placeholder="Choose a company"
              searchPlaceholder="Search companies…"
              emptyLabel="No company matches."
            />
          </div>

          <div className="w-[120px] space-y-1.5">
            <Label htmlFor="intercompany-year">Tax year</Label>
            <Select value={String(year)} onValueChange={(value) => ledger.selectYear(Number(value))}>
              <SelectTrigger id="intercompany-year" className="w-full">
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
          </div>

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
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not build the intercompany ledger</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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
          <TabsTrigger value="matrix" className="min-h-11 md:min-h-0">Pair matrix ({pairs.length})</TabsTrigger>
          <TabsTrigger value="monthly" className="min-h-11 md:min-h-0">Monthly breakdown ({monthly.length})</TabsTrigger>
          <TabsTrigger value="withholding" className="min-h-11 md:min-h-0">Withholding ({withholding.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-4">
          <PairMatrix pairs={pairs} isLoading={isLoading} year={year} onSelectPair={setSelected} />
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
