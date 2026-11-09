"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TAX_YEARS } from "./constants";
import { useGroupOverview } from "./hooks/useGroupOverview";
import { AttentionPanel } from "./components/AttentionPanel";
import { CarryoverTable } from "./components/CarryoverTable";
import { CompanyTable } from "./components/CompanyTable";
import { GroupKpis } from "./components/GroupKpis";

function OverviewSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-72 rounded-lg" />
      <Skeleton className="h-80 rounded-2xl" />
    </div>
  );
}

export function GroupOverviewModule({ initialYear }: { initialYear: number }) {
  const { data, isLoading, error, year, setYear, refetch } = useGroupOverview(initialYear);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Group Overview</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Income tax, VAT and withholding across the group, with every gap named.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="group-overview-year" className="text-xs font-medium text-muted-foreground">
            Tax year
          </label>
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
            <SelectTrigger id="group-overview-year" className="h-8 w-[120px]">
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
            <RefreshCw className={isLoading ? "animate-spin" : undefined} />
            Refresh
          </Button>
        </div>
      </div>

      {error && !data ? (
        <div className="rounded-2xl border border-destructive/40 bg-card p-6">
          <p className="text-sm font-medium">The group overview could not be built.</p>
          <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
            Try again
          </Button>
        </div>
      ) : !data ? (
        <OverviewSkeleton />
      ) : (
        <>
          <GroupKpis totals={data.totals} />

          <Tabs defaultValue="companies" className="space-y-4">
            <TabsList className="max-w-full overflow-x-auto">
              <TabsTrigger value="companies" className="min-h-11 md:min-h-0">
                Companies ({data.rows.length})
              </TabsTrigger>
              <TabsTrigger value="carryovers" className="min-h-11 md:min-h-0">
                Carryovers ({data.carryovers.length})
              </TabsTrigger>
              <TabsTrigger value="attention" className="min-h-11 md:min-h-0">
                Needs attention ({data.attention.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="companies">
              <CompanyTable rows={data.rows} isLoading={isLoading} attention={data.attention} />
            </TabsContent>
            <TabsContent value="carryovers">
              <CarryoverTable lots={data.carryovers} notice={data.carryoverNotice} year={year} />
            </TabsContent>
            <TabsContent value="attention">
              <AttentionPanel attention={data.attention} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
