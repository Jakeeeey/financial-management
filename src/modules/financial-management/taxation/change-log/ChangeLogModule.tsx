"use client";

import { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ChangeLogTable } from "./components/ChangeLogTable";
import { useChangeLog } from "./hooks/useChangeLog";
import { TAX_YEARS } from "./constants";

export function ChangeLogModule() {
  const [year, setYear] = useState(new Date().getFullYear());
  const log = useChangeLog(year);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">Change Log</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Every recorded edit to a profile, certificate, payment or lock — with the value before and after.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
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
          <Button variant="outline" size="sm" onClick={log.refetch} disabled={log.isLoading}>
            <RefreshCw className={log.isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden />
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {log.notice && (
        <Alert>
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>Change log unavailable</AlertTitle>
          <AlertDescription>{log.notice}</AlertDescription>
        </Alert>
      )}

      {log.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          <AlertTitle>Could not read the change log</AlertTitle>
          <AlertDescription>{log.error}</AlertDescription>
        </Alert>
      )}

      <ChangeLogTable
        rows={log.rows}
        total={log.total}
        companies={log.companies}
        filters={log.filters}
        isLoading={log.isLoading}
        page={log.page}
        pageCount={log.pageCount}
        pageSize={log.pageSize}
        onFiltersChange={log.setFilters}
        onPageChange={log.setPage}
      />
    </div>
  );
}
