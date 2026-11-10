"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { phtToday } from "./pht";
import { PERIOD_KEYS, TAX_YEARS } from "./constants";
import { useVatWithholding } from "./hooks/useVatWithholding";
import { OptionCombobox, type ComboboxOption } from "./components/OptionCombobox";
import { VatTiles } from "./components/VatTiles";
import { QuarterlyVatTable } from "./components/QuarterlyVatTable";
import { MonthlyWithholdingTable } from "./components/MonthlyWithholdingTable";
import { CertificatePanel } from "./components/CertificatePanel";

const FIRST_YEAR = TAX_YEARS[0];
const LAST_YEAR = TAX_YEARS[TAX_YEARS.length - 1];

/** Reasons arrive as clauses ("refused the connection"), so they need a full stop before the next sentence. */
function terminated(reason: string) {
  const trimmed = reason.trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function defaultYear() {
  const current = Number(phtToday().slice(0, 4));
  return Math.min(Math.max(current, FIRST_YEAR), LAST_YEAR);
}

/** One company, one tax year: VAT by quarter, withholding by month, 2307s on file. */
export function VatWithholdingModule() {
  const [pickedCompanyId, setPickedCompanyId] = useState<number | null>(null);
  const [year, setYear] = useState(defaultYear);
  const { data, isLoading, error, refetch } = useVatWithholding(pickedCompanyId, year);

  const companies = data?.companies ?? [];
  const companyId = pickedCompanyId ?? data?.snapshot.company.companyId ?? null;

  const companyOptions: ComboboxOption[] = companies.map((company) => ({
    value: String(company.companyId),
    label: company.name,
    searchText: `${company.name} ${company.code} ${company.tin ?? ""}`,
    description: company.code,
  }));

  const loading = isLoading && !data;

  /**
   * The hook keeps the last payload while the next one loads, which is right for a refresh
   * but wrong for a different company or year: Hanvin's header over Men2's VAT is a lie the
   * page told for two seconds. While the keys disagree, treat it as loading.
   */
  const loadedKey = data ? `${data.snapshot.company.companyId}:${data.snapshot.profile.taxYear}` : null;
  const wantedKey = companyId == null ? null : `${companyId}:${year}`;
  const switching = loadedKey !== null && wantedKey !== null && loadedKey !== wantedKey;
  const showSkeleton = loading || switching;

  /**
   * An instance that never answered — or answered but refused the sales register — has no
   * figures. Zero is a claim about the company; showing zeros here would be a lie.
   */
  const unavailable = data ? !data.snapshot.company.reachable || !data.snapshot.figuresAvailable : false;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">VAT &amp; Withholding</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Output VAT, input VAT and expanded withholding for one company and tax year.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-[280px] max-w-full">
            <OptionCombobox
              options={companyOptions}
              value={companyId == null ? "" : String(companyId)}
              onChange={(value) => setPickedCompanyId(Number(value))}
              placeholder="Select a company"
              searchPlaceholder="Search companies…"
              emptyLabel="No active company"
              aria-label="Company"
              disabled={companies.length === 0}
            />
          </div>
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger className="w-[120px]" aria-label="Tax year">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {TAX_YEARS.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
            <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Notices belong to the payload on screen, so they stay hidden while the next one loads. */}
      {!unavailable &&
        !showSkeleton &&
        data?.snapshot.notices.map((notice) => (
          <Alert key={notice}>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        ))}

      {showSkeleton ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-10 w-80 rounded-lg" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : unavailable && data ? (
        <section
          aria-label="Company unavailable"
          className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm"
        >
          <h2 className="text-sm font-semibold">
            {data.snapshot.company.reachable
              ? `No figures for ${data.snapshot.company.name} in ${year}`
              : `${data.snapshot.company.name} did not answer`}
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {data.snapshot.company.reachable
              ? `The ${data.snapshot.failedSources.join(" and ")} could not be read, so the VAT and withholding figures are unknown rather than zero.`
              : `${terminated(data.snapshot.company.unreachableReason ?? "The instance refused the connection.")} Its VAT and withholding figures are unavailable for ${year}, not zero — nothing is shown until the instance answers.`}
          </p>
        </section>
      ) : data ? (
        <div className="flex flex-col gap-4">
          <VatTiles vat={data.vat} profile={data.snapshot.profile} />

          <Tabs defaultValue="quarterly" className="space-y-4">
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="quarterly" className="min-h-11 md:min-h-0">
                Quarterly VAT ({PERIOD_KEYS.length})
              </TabsTrigger>
              <TabsTrigger value="monthly" className="min-h-11 md:min-h-0">
                Monthly withholding ({data.monthly.length})
              </TabsTrigger>
              <TabsTrigger value="certificates" className="min-h-11 md:min-h-0">
                2307 certificates ({data.certificates.rows.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="quarterly">
              <QuarterlyVatTable figures={data.snapshot.figures} vat={data.vat} />
            </TabsContent>
            <TabsContent value="monthly">
              <MonthlyWithholdingTable rows={data.monthly} />
            </TabsContent>
            <TabsContent value="certificates">
              <CertificatePanel register={data.certificates} />
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        !error && (
          <p className="text-sm text-muted-foreground">Select a company to load its VAT and withholding figures.</p>
        )
      )}
    </div>
  );
}

