"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TAX_YEARS } from "../constants";
import { usePayments2307 } from "../hooks/usePayments2307";
import { CertificatesTab } from "./CertificatesTab";
import { LocksTab } from "./LocksTab";
import { OptionCombobox } from "./OptionCombobox";
import { PaymentsTab } from "./PaymentsTab";

type TabKey = "certificates" | "payments" | "locks";

export function Payments2307Module() {
  const [tab, setTab] = useState<TabKey>("certificates");
  const desk = usePayments2307();

  const companyValue = desk.companyId === null ? "" : String(desk.companyId);
  const showSkeleton = desk.isLoading && desk.companies.length === 0;
  const lockedPeriods = new Set(desk.locks.filter((lock) => lock.unlockedAt === null).map((lock) => lock.periodKey)).size;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Payments &amp; 2307</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            What has been certified and remitted for the selected company and year.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <OptionCombobox
            options={desk.companyOptions}
            value={companyValue}
            onChange={(next) => {
              if (next) desk.selectCompany(Number(next));
            }}
            placeholder="Select a company"
            searchPlaceholder="Search company…"
            emptyLabel="No company found"
            className="w-[280px] justify-between"
          />
          <Select value={String(desk.year)} onValueChange={(next) => desk.selectYear(Number(next))}>
            <SelectTrigger className="w-[120px]" aria-label="Tax year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {TAX_YEARS.map((option) => (
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
            aria-label="Refresh"
            onClick={() => void desk.refetch()}
            disabled={desk.isLoading}
          >
            <RefreshCw className={desk.isLoading ? "size-4 animate-spin" : "size-4"} />
          </Button>
        </div>
      </div>

      {desk.notices.length > 0 ? (
        <div
          role="status"
          className="rounded-2xl border border-border/50 bg-card px-4 py-3 text-xs text-muted-foreground shadow-sm"
        >
          <ul className="list-disc space-y-1 pl-4">
            {desk.notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {desk.error ? (
        <Alert variant="destructive">
          <AlertTitle>The desk could not be loaded</AlertTitle>
          <AlertDescription>
            <p>{desk.error}</p>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void desk.refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {showSkeleton ? (
        <div className="space-y-4">
          <Skeleton className="h-9 w-full max-w-sm" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <Tabs value={tab} onValueChange={(next) => setTab(next as TabKey)} className="space-y-4">
          <div className="-mx-1 overflow-x-auto px-1">
            <TabsList>
              <TabsTrigger value="certificates" className="min-h-11 md:min-h-0">
                2307 certificates ({desk.certificates.length})
              </TabsTrigger>
              <TabsTrigger value="payments" className="min-h-11 md:min-h-0">
                Payments ({desk.payments.length})
              </TabsTrigger>
              <TabsTrigger value="locks" className="min-h-11 md:min-h-0">
                Period locks ({lockedPeriods})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="certificates">
            <CertificatesTab
              companyId={desk.companyId ?? 0}
              year={desk.year}
              companyOptions={desk.companyOptions}
              certificates={desk.certificates}
              expected={desk.expected}
              isLoading={desk.isLoading}
              isSaving={desk.isSaving}
              onCompanyChange={desk.selectCompany}
              onCreate={desk.saveCertificate}
              onUpdate={desk.amendCertificate}
              onDelete={desk.removeCertificate}
              onPrefill={desk.runPrefill}
            />
          </TabsContent>

          <TabsContent value="payments">
            <PaymentsTab
              companyId={desk.companyId ?? 0}
              year={desk.year}
              payments={desk.payments}
              isLoading={desk.isLoading}
              isSaving={desk.isSaving}
              onCreate={desk.savePayment}
              onUpdate={desk.amendPayment}
              onDelete={desk.removePayment}
            />
          </TabsContent>

          <TabsContent value="locks">
            <LocksTab
              locks={desk.locks}
              isLoading={desk.isLoading}
              isSaving={desk.isSaving}
              onLock={desk.lock}
              onUnlock={desk.unlock}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

