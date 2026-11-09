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

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <section
        aria-label="Selection"
        className="flex flex-col gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
      >
        <h1 className="min-w-0 truncate text-base font-semibold">VAT &amp; Withholding</h1>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="w-full sm:w-64">
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
          <div className="w-full sm:w-32">
            <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
              <SelectTrigger aria-label="Tax year">
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
          </div>
          <Button variant="outline" size="sm" onClick={refetch} disabled={isLoading}>
            <RefreshCw className={isLoading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        </div>
      </section>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {data?.snapshot.notices.map((notice) => (
        <Alert key={notice}>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ))}

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-10 w-80 rounded-lg" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
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
