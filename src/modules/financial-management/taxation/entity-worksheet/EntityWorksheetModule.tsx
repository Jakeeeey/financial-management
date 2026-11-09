"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";

import { OptionCombobox } from "./components/OptionCombobox";
import { ProfileCard } from "./components/ProfileCard";
import { WorksheetTable } from "./components/WorksheetTable";
import { useWorksheet } from "./hooks/useWorksheet";
import { REGIME_LABELS, TAX_YEARS } from "./constants";
import type { EntityProfile } from "./types";

/** Profile facts a person has stated, i.e. moved off the default. */
function statedFields(profile: EntityProfile): number {
  return [
    profile.withholdingAgent,
    profile.hasTopWithholdingStatus,
    profile.vatRegistered,
    profile.ownsRealProperty,
    profile.assetsExcludingLand > 0,
    profile.taxAgentFeeRate > 0,
    profile.priorYearExcessCredit > 0,
    profile.efpsGroup !== "NONE",
    Boolean(profile.notes?.trim()),
  ].filter(Boolean).length;
}

/** Entity worksheet — one company, one tax year, 1702Q basis. */
export function EntityWorksheetModule() {
  const worksheet = useWorksheet(new Date().getFullYear());
  const { snapshot, isLoading, isSaving, error, companies, companyOptions } = worksheet;

  const current = snapshot?.company ?? companies.find((company) => company.companyId === worksheet.companyId);

  return (
    <div className="space-y-4">
      <section
        aria-label="Worksheet scope"
        className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm"
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Entity worksheet</h2>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Quarterly 1702Q income tax built from this company&apos;s own ledgers — estimates for review, not filings.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="w-[280px] max-w-full space-y-1.5">
            <Label htmlFor="worksheet-company">Company</Label>
            <OptionCombobox
              id="worksheet-company"
              options={companyOptions}
              value={worksheet.companyId ? String(worksheet.companyId) : ""}
              onChange={(value) => value && worksheet.selectCompany(Number(value))}
              placeholder="Choose a company"
              searchPlaceholder="Search companies…"
              emptyLabel="No company matches."
            />
          </div>

          <div className="w-[120px] space-y-1.5">
            <Label htmlFor="worksheet-year">Tax year</Label>
            <Select
              value={String(worksheet.year)}
              onValueChange={(value) => worksheet.selectYear(Number(value))}
            >
              <SelectTrigger id="worksheet-year" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {TAX_YEARS.map((year) => (
                  <SelectItem key={year} value={String(year)}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void worksheet.refetch()}
            disabled={isLoading || !worksheet.companyId}
          >
            <RefreshCw className={isLoading ? "mr-2 h-4 w-4 animate-spin" : "mr-2 h-4 w-4"} />
            Refresh
          </Button>
        </div>
      </section>

      {error ? (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Could not build the worksheet</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!error && current && !current.reachable ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{current.code} is not reachable</AlertTitle>
          <AlertDescription>
            {current.unreachableReason ?? "No answer from its Directus endpoint."} Figures stay at zero until the
            endpoint answers.
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading && !snapshot ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : null}

      {!isLoading && !snapshot && !error ? (
        <p className="rounded-2xl border border-dashed border-border/60 bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          Choose a company to build its worksheet.
        </p>
      ) : null}

      {snapshot ? (
        <>
          <section
            aria-label="Tax summary"
            className="flex flex-wrap items-center gap-6 rounded-2xl border border-border/50 bg-card px-4 py-3 shadow-sm"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Regime</p>
              <Badge variant="outline" className="mt-1 max-w-full truncate text-[11px] font-semibold">
                {REGIME_LABELS[snapshot.profile.regime]}
              </Badge>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Net taxable income</p>
              <p className="tabular-nums text-sm font-semibold">{formatCurrency(snapshot.computation.annual.netTaxableIncome)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Income tax due</p>
              <p className="tabular-nums text-sm font-semibold">{formatCurrency(snapshot.computation.annual.taxDue)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Credits</p>
              <p className="tabular-nums text-sm font-semibold">{formatCurrency(snapshot.computation.annual.taxCredits)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Net position</p>
              <p className="tabular-nums text-sm font-semibold">{formatCurrency(snapshot.computation.annual.netPosition)}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Rate applied</p>
              <p className="tabular-nums text-sm font-semibold">{(snapshot.computation.rateApplied * 100).toFixed(0)}%</p>
            </div>
          </section>

          <Tabs defaultValue="worksheet" className="space-y-4">
            <div className="-mx-1 overflow-x-auto px-1">
              <TabsList>
                <TabsTrigger value="worksheet" className="min-h-11 md:min-h-0">
                  Worksheet
                </TabsTrigger>
                <TabsTrigger value="profile" className="min-h-11 md:min-h-0">
                  Company profile ({statedFields(snapshot.profile)} fields set)
                </TabsTrigger>
                {snapshot.notices.length > 0 ? (
                  <TabsTrigger value="notices" className="min-h-11 md:min-h-0">
                    Notices ({snapshot.notices.length})
                  </TabsTrigger>
                ) : null}
              </TabsList>
            </div>

            <TabsContent value="worksheet">
              <WorksheetTable lines={snapshot.lines} total={snapshot.lines.length} />
            </TabsContent>

            <TabsContent value="profile">
              <ProfileCard
                key={`${snapshot.company.companyId}-${snapshot.profile.taxYear}-${worksheet.profileRev}`}
                profile={snapshot.profile}
                isSaving={isSaving}
                onSave={worksheet.saveProfile}
              />
            </TabsContent>

            {snapshot.notices.length > 0 ? (
              <TabsContent value="notices">
                <Alert className="rounded-2xl border-border/50 bg-card shadow-sm">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>What this worksheet cannot see</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc space-y-1 pl-4">
                      {snapshot.notices.map((notice) => (
                        <li key={notice} className="break-words">
                          {notice}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              </TabsContent>
            ) : null}
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
